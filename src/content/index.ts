console.log('🚀 LearnSphere: Content script initializing...');
import { QuizPersistenceService } from '@/services/QuizPersistenceService';
import { StorageService } from '@/services/StorageService';
import { ContentExtractionService } from '@/services/ContentExtractionService';

// Minimal Gemini integration (no external imports)
let geminiApiKey: string | null = null;
let GEMINI_MODEL = 'gemini-2.5-flash';

async function loadGeminiKey(): Promise<string | null> {
  try {
    // Prefer synced settings; fall back to local if sync unavailable
    let key: string | null = null;
    try {
      // @ts-ignore
      const result = await (chrome?.storage?.sync?.get?.('learnsphere_settings') ?? Promise.resolve(null));
      if (result && result.learnsphere_settings) {
        key = result.learnsphere_settings.geminiApiKey || null;
        if (result.learnsphere_settings.geminiModel) {
          GEMINI_MODEL = result.learnsphere_settings.geminiModel;
        }
      }
    } catch {}
    if (!key) {
      try {
        // @ts-ignore
        const local = await (chrome?.storage?.local?.get?.('learnsphere_settings') ?? Promise.resolve(null));
        if (local && local.learnsphere_settings) {
          key = local.learnsphere_settings.geminiApiKey || null;
          if (local.learnsphere_settings.geminiModel) {
            GEMINI_MODEL = local.learnsphere_settings.geminiModel;
          }
        }
      } catch {}
    }
    if (!key && typeof localStorage !== 'undefined') {
      key = localStorage.getItem('learnsphere_gemini_api_key');
    }
    geminiApiKey = key;
    return key;
  } catch (e) {
    console.warn('LearnSphere: Failed to load API key from storage', e);
    return null;
  }
}

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function callGemini(prompt: string): Promise<string> {
  const key = geminiApiKey || (await loadGeminiKey());
  if (!key) throw new Error('Gemini API key not configured. Open the extension popup and set the API key.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  let attempt = 0;
  let lastError: any = null;
  const maxAttempts = 3;
  while (attempt < maxAttempts) {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('You appear to be offline. Please check your internet connection.');
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }]}],
          generationConfig: { temperature: 0.3, topK: 20, topP: 0.8, maxOutputTokens: 800 }
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        // Retry on 5xx/transient errors
        if (res.status >= 500 && res.status < 600) throw new Error(`Gemini server error ${res.status}: ${errText}`);
        throw new Error(`Gemini error ${res.status}: ${res.statusText} — ${errText}`);
      }
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '(No response)';
    } catch (e) {
      lastError = e;
      attempt += 1;
      if (attempt >= maxAttempts) break;
      await sleep(400 * attempt); // naive backoff
    }
  }
  throw lastError || new Error('Unknown error while calling Gemini');
}

// Multimodal Gemini call with optional image/text parts
async function callGeminiMultimodal(prompt: string, opts?: { imageBlob?: Blob; pastedText?: string }): Promise<string> {
  const key = geminiApiKey || (await loadGeminiKey());
  if (!key) throw new Error('Gemini API key not configured. Open the extension popup and set the API key.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  parts.push({ text: prompt });
  if (opts?.pastedText && opts.pastedText.trim()) {
    parts.push({ text: `\n\nAdditional pasted text context provided by user:\n${opts.pastedText.trim()}` });
  }
  if (opts?.imageBlob) {
    const base64 = await blobToBase64(opts.imageBlob);
    parts.push({ inlineData: { mimeType: opts.imageBlob.type || 'image/png', data: base64 } });
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('You appear to be offline. Please check your internet connection.');
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.3, topK: 20, topP: 0.8, maxOutputTokens: 800 } })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${res.statusText} — ${errText}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '(No response)';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result);
      const idx = res.indexOf(',');
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// --- Markdown rendering utilities (safe subset) ---
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineFormat(s: string): string {
  // bold then italic then code then links
  let out = s;
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__(.+?)__/g, '<strong>$1</strong>');
  out = out.replace(/_(.+?)_/g, '<em>$1</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/g, (m) => {
    const href = m.startsWith('http') ? m : `https://${m}`;
    return `<a href="${href}" target="_blank" rel="noopener">${m}</a>`;
  });
  return out;
}

function markdownToHtml(md: string): string {
  const lines = escapeHtml(md).split(/\r?\n/);
  const html: string[] = [];
  let listOpen = false;
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listOpen && listType) {
      html.push(`</${listType}>`);
      listOpen = false;
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      html.push(`<h${level}>${inlineFormat(h[2])}</h${level}>`);
      continue;
    }

    const ol = line.match(/^(\d+)\.\s+(.*)$/);
    if (ol) {
      if (!listOpen || listType !== 'ol') { closeList(); html.push('<ol>'); listOpen = true; listType = 'ol'; }
      html.push(`<li>${inlineFormat(ol[2])}</li>`);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      if (!listOpen || listType !== 'ul') { closeList(); html.push('<ul>'); listOpen = true; listType = 'ul'; }
      html.push(`<li>${inlineFormat(ul[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inlineFormat(line)}</p>`);
  }
  closeList();
  return `<div class="ls-md">${html.join('\n')}</div>`;
}

// Inject minimal styles so we don't rely on external CSS
function ensureSidebarStyles(): void {
  if (document.getElementById('learnsphere-inline-styles')) return;
  const style = document.createElement('style');
  style.id = 'learnsphere-inline-styles';
  style.textContent = `
    #learnsphere-sidebar { position: fixed; top: 0; right: 0; height: 100%; width: 380px; max-width: 92vw; background: #ffffff; box-shadow: -2px 0 12px rgba(0,0,0,0.15); z-index: 2147483647; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, Arial, sans-serif; }
    .ls-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #eee; }
    .ls-header h2 { margin: 0; font-size: 16px; }
    .ls-close { border: none; background: transparent; font-size: 18px; cursor: pointer; line-height: 1; padding: 4px 8px; }
    .ls-tabs { display: flex; gap: 6px; padding: 8px 12px; border-bottom: 1px solid #f1f1f1; }
    .ls-tab { padding: 6px 10px; border-radius: 6px; border: 1px solid #e5e7eb; background: #f9fafb; cursor: pointer; font-size: 12px; }
    .ls-tab.active { background: #e6f0ff; border-color: #bcd2ff; }
    .ls-content { flex: 1; overflow: auto; padding: 12px; }
    .ls-footer { border-top: 1px solid #eee; padding: 8px 12px; }
    .ls-textarea { width: 100%; min-height: 70px; resize: vertical; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; }
    .ls-button { margin-top: 8px; width: 100%; padding: 8px 10px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; font-size: 13px; }
    .ls-btn-row .ls-button { margin-top: 0; width: auto; }
    .ls-chip { display: inline-block; padding: 2px 6px; background: #f3f4f6; border-radius: 999px; font-size: 11px; color: #374151; }
    .ls-message { padding: 10px 12px; border-radius: 8px; margin: 8px 0; font-size: 13px; line-height: 1.55; }
    .ls-message.user { background: #eef2ff; border: 1px solid #e0e7ff; color: #1e3a8a; }
    .ls-message.assistant { background: #eef6ff; border: 1px solid #dbeafe; color: #1e40af; }
    .ls-banner { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; padding: 8px 10px; border-radius: 8px; margin: 8px 0; font-size: 12px; }
    .ls-spinner { border: 3px solid #e5e7eb; border-top-color: #2563eb; width: 16px; height: 16px; border-radius: 50%; animation: ls-spin 1s linear infinite; display: inline-block; vertical-align: middle; margin-right: 6px; }
    @keyframes ls-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .ls-md h1 { font-size: 18px; margin: 10px 0 8px; }
    .ls-md h2 { font-size: 16px; margin: 10px 0 6px; }
    .ls-md h3 { font-size: 15px; margin: 8px 0 6px; }
    .ls-md p { margin: 8px 0; }
    .ls-md ul, .ls-md ol { margin: 8px 0 8px 18px; }
    .ls-md li { margin: 4px 0; }
    .ls-md code { background: #f3f4f6; padding: 2px 4px; border-radius: 4px; }
    .ls-md pre { background: #0f172a; color: #e2e8f0; padding: 8px; border-radius: 6px; overflow: auto; }
    .ls-md a { color: #1d4ed8; text-decoration: underline; }
    .ls-md strong { font-weight: 600; }
    .ls-md em { font-style: italic; }
    /* Quiz specific */
    .ls-quiz-q { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin: 18px 0 24px; background: #ffffff; }
    .ls-quiz-q h4 { margin: 0 0 10px; font-size: 14px; }
    .ls-quiz-options { display: grid; gap: 10px; margin: 10px 0 12px; }
    .ls-quiz-option { display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; }
    .ls-quiz-option input { margin-top: 3px; }
    .ls-quiz-option.correct { border-color: #22c55e; background: #f0fdf4; }
    .ls-quiz-option.incorrect { border-color: #ef4444; background: #fef2f2; }
    .ls-quiz-result { margin-top: 10px; font-size: 12px; padding: 8px 10px; border-left: 3px solid #93c5fd; background: #eff6ff; border-radius: 6px; }
  `;
  document.head.appendChild(style);
}

// --- Selection serialization (XPath-based) ---
function getXPath(node: Node): string {
  if (node.nodeType === Node.DOCUMENT_NODE) return '/';
  const parent = node.parentNode;
  if (!parent) return '/';
  const siblings = Array.from(parent.childNodes).filter(n => n.nodeName === node.nodeName) as Node[];
  const index = siblings.findIndex(n => n === node) + 1;
  return `${getXPath(parent)}/${node.nodeName}[${index}]`;
}

function serializeSelectionToXPath(): { startXPath: string; startOffset: number; endXPath: string; endOffset: number; snippet: string } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const snippet = range.toString().slice(0, 200);
  return {
    startXPath: getXPath(range.startContainer),
    startOffset: range.startOffset,
    endXPath: getXPath(range.endContainer),
    endOffset: range.endOffset,
    snippet
  };
}

function nodeFromXPath(xpath: string): Node | null {
  try {
    const res = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return res.singleNodeValue as Node | null;
  } catch {
    return null;
  }
}

function restoreRangeFromXPath(serialized: { startXPath: string; startOffset: number; endXPath: string; endOffset: number }): Range | null {
  const start = nodeFromXPath(serialized.startXPath);
  const end = nodeFromXPath(serialized.endXPath);
  if (!start || !end) return null;
  const r = document.createRange();
  try {
    r.setStart(start, Math.min(serialized.startOffset, (start.textContent || '').length));
    r.setEnd(end, Math.min(serialized.endOffset, (end.textContent || '').length));
    return r;
  } catch {
    return null;
  }
}

function highlightRange(range: Range, anchorId?: string): void {
  const mark = document.createElement('mark');
  mark.style.background = '#fff3b0';
  mark.style.padding = '0 2px';
  if (anchorId) {
    mark.id = anchorId;
    mark.setAttribute('data-ls-anchor', anchorId);
  }
  const contents = range.extractContents();
  mark.appendChild(contents);
  range.insertNode(mark);
}

async function scrollToAnchor(anchorId: string): Promise<void> {
  let el = document.getElementById(anchorId) as HTMLElement | null;
  if (!el) {
    el = document.querySelector(`mark[data-ls-anchor="${anchorId}"]`) as HTMLElement | null;
  }
  if (!el) {
    try {
      const anchors = await StorageService.getAnchors(location.href);
      const rec = anchors.find(a => (a as any).anchorId === anchorId);
      if (rec && (rec as any).kind !== 'image' && (rec as any).serialized) {
        const r = restoreRangeFromXPath(((rec as any).serialized) as any);
        if (r) {
          highlightRange(r, anchorId);
          el = document.getElementById(anchorId) as HTMLElement | null;
        }
      } else if (rec && (rec as any).kind === 'image' && (rec as any).imageMeta?.src) {
        const candidate = document.querySelector(`img[src="${CSS.escape((rec as any).imageMeta.src)}"]`) as HTMLElement | null;
        if (candidate) {
          el = candidate;
        }
      } else if (rec && (rec as any).snippet) {
        // Fallback: try to locate by text snippet
        const r = createRangeFromSnippet((rec as any).snippet as string);
        if (r) {
          highlightRange(r, anchorId);
          el = document.getElementById(anchorId) as HTMLElement | null;
        }
      }
    } catch {}
  }
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el as HTMLElement).style.transition = 'background-color 0.6s';
    const old = (el as HTMLElement).style.background;
    (el as HTMLElement).style.background = '#fde68a';
    setTimeout(() => { (el as HTMLElement).style.background = old || '#fff3b0'; }, 800);
  }
}

function createRangeFromSnippet(snippet: string): Range | null {
  const text = snippet.trim();
  if (!text) return null;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const idx = (node.textContent || '').indexOf(text);
    if (idx !== -1) {
      const r = document.createRange();
      try {
        r.setStart(node, idx);
        r.setEnd(node, idx + text.length);
        return r;
      } catch { return null; }
    }
    node = walker.nextNode();
  }
  return null;
}

function removeExistingSidebar(): void {
  const existing = document.getElementById('learnsphere-sidebar');
  if (existing) existing.remove();
}

function createSidebar(type: 'chat' | 'summary' | 'quiz', selection?: string): void {
  ensureSidebarStyles();
  removeExistingSidebar();

  const root = document.createElement('div');
  root.id = 'learnsphere-sidebar';

    const header = document.createElement('div');
  header.className = 'ls-header';
    const title = document.createElement('h2');
  title.textContent = type === 'chat' ? 'LearnSphere — Chat' : type === 'summary' ? 'LearnSphere — Summary' : 'LearnSphere — Quiz';
  const close = document.createElement('button');
  close.className = 'ls-close';
  close.textContent = '×';
  close.title = 'Close';
  close.addEventListener('click', () => root.remove());
  header.append(title, close);

  const tabs = document.createElement('div');
  tabs.className = 'ls-tabs';
  const tabDefs: Array<{key: 'chat'|'summary'|'quiz'; label: string}> = [
    { key: 'chat', label: 'Chat' },
    { key: 'summary', label: 'Summary' },
    { key: 'quiz', label: 'Quiz' }
  ];
  tabDefs.forEach(def => {
    const b = document.createElement('button');
    b.className = 'ls-tab' + (def.key === type ? ' active' : '');
    b.textContent = def.label;
    b.addEventListener('click', () => createSidebar(def.key, selection));
    tabs.appendChild(b);
  });

  const content = document.createElement('div');
  content.className = 'ls-content';

  const footer = document.createElement('div');
  footer.className = 'ls-footer';

  // Offline banner
  const banner = document.createElement('div');
  banner.className = 'ls-banner';
  banner.style.display = 'none';
  banner.textContent = 'You are offline. Some features may be unavailable.';
  const updateOnline = () => {
    banner.style.display = typeof navigator !== 'undefined' && !navigator.onLine ? 'block' : 'none';
  };
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();
  content.appendChild(banner);

  if (type === 'chat') {
    if (selection) {
      const chip = document.createElement('div');
      chip.className = 'ls-chip';
      chip.textContent = `Selected: ${selection.slice(0, 60)}${selection.length > 60 ? '…' : ''}`;
      content.appendChild(chip);
    }

    const history = document.createElement('div');
    history.id = 'ls-chat-history';
    const hello = document.createElement('div');
    hello.className = 'ls-message assistant';
    hello.innerHTML = markdownToHtml('Ask me anything about this page or your selection.');
    history.appendChild(hello);
    content.appendChild(history);

    // Preview container for pasted content
    const preview = document.createElement('div');
    preview.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;';
    content.appendChild(preview);

    let pendingPastedImage: Blob | null = null;
    let pendingPastedText: string | null = null;

    const ta = document.createElement('textarea');
    ta.id = 'ls-chat-input';
    // Save anchor button
    const saveAnchorBtn = document.createElement('button');
    saveAnchorBtn.className = 'ls-button';
    saveAnchorBtn.textContent = 'Save Anchor';
    saveAnchorBtn.addEventListener('click', async () => {
      try {
        // Prefer text selection; if none, check if an image is in focus/nearby
        const sel = window.getSelection();
        let data = serializeSelectionToXPath();
        let usedImage = false;
        let imageMeta: any = null;
        if (!data && sel && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0);
          const node = (r.commonAncestorContainer as HTMLElement);
          const img = (node && (node.nodeType === 1 ? node.closest('img') : node.parentElement?.closest('img'))) as HTMLImageElement | null;
          if (img) {
            const rect = img.getBoundingClientRect();
            imageMeta = { src: img.currentSrc || img.src, alt: img.alt || undefined, naturalWidth: img.naturalWidth || undefined, naturalHeight: img.naturalHeight || undefined, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
            usedImage = true;
          }
        }
        if (!data && !usedImage) { showErrorChip('No selection to anchor.'); return; }
        const hash = btoa(unescape(encodeURIComponent(`${location.href}|${data?.startXPath}|${data?.startOffset}|${data?.endXPath}|${data?.endOffset}`))).slice(0, 64);
        const anchorId = `a_${Date.now()}`;
        await StorageService.saveAnchor({
          url: location.href,
          anchorId,
          method: 'xpath',
          serialized: { startXPath: data?.startXPath || '', startOffset: data?.startOffset || 0, endXPath: data?.endXPath || '', endOffset: data?.endOffset || 0 },
          snippet: usedImage ? (imageMeta?.alt || 'Image') : (data?.snippet || ''),
          hash,
          kind: usedImage ? 'image' : 'text',
          imageMeta: usedImage ? imageMeta : undefined
        } as any);
        // Immediately highlight text anchors
        if (data) {
          const range = restoreRangeFromXPath({ startXPath: data.startXPath, startOffset: data.startOffset, endXPath: data.endXPath, endOffset: data.endOffset });
          if (range) highlightRange(range, anchorId);
        }
        const msg = makeMessage('assistant', `Saved anchor for this selection.`);
        history.appendChild(msg);
      } catch (e) {
        showErrorChip((e as Error).message);
      }
    });
    ta.placeholder = 'Type your question…';
    ta.className = 'ls-textarea';

    // Paste button
    const pasteBtn = document.createElement('button');
    pasteBtn.className = 'ls-button';
    pasteBtn.textContent = '📋 Paste from Clipboard';
    pasteBtn.addEventListener('click', async () => {
      try {
        // @ts-ignore
        if (navigator?.clipboard?.read) {
          // @ts-ignore
          const items: ClipboardItems = await navigator.clipboard.read();
          for (const item of items as any[]) {
            const types: string[] = item.types || [];
            if (types.includes('image/png')) { const blob = await item.getType('image/png'); setPastedImage(blob); return; }
            if (types.includes('image/jpeg')) { const blob = await item.getType('image/jpeg'); setPastedImage(blob); return; }
            if (types.includes('text/plain')) { const blob = await item.getType('text/plain'); const text = await blob.text(); setPastedText(text); return; }
          }
          showErrorChip('Clipboard does not contain supported image or text.');
          return;
        }
      } catch (err) {
        console.warn('Clipboard read failed, fallback to readText/paste', err);
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) { setPastedText(text.trim()); return; }
        } catch {}
        showErrorChip('Unable to access clipboard. Try Cmd/Ctrl+V in the input.');
        return;
      }
      showErrorChip('Clipboard API not supported. Use Cmd/Ctrl+V to paste.');
    });

    // Fallback: paste handler in textarea
    ta.addEventListener('paste', (event: ClipboardEvent) => {
      const dt = event.clipboardData;
      if (!dt) return;
      for (const item of dt.items) {
        if (item.type === 'image/png' || item.type === 'image/jpeg') {
          const blob = item.getAsFile();
          if (blob) { event.preventDefault(); setPastedImage(blob); return; }
        }
      }
      const text = dt.getData('text/plain');
      if (text && text.trim()) setPastedText(text.trim());
    });

    function setPastedImage(blob: Blob) {
      pendingPastedImage = blob; pendingPastedText = null; renderPreviewChip({ type: 'image', blob });
    }
    function setPastedText(text: string) {
      pendingPastedText = text; pendingPastedImage = null; renderPreviewChip({ type: 'text', text });
    }
    function showErrorChip(msg: string) { renderPreviewChip({ type: 'text', text: `Error: ${msg}` }); }
    function renderPreviewChip(input: { type: 'image'; blob: Blob } | { type: 'text'; text: string }) {
      preview.innerHTML = '';
      const chip = document.createElement('div');
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:8px;border:1px solid #d1d5db;background:#f9fafb;color:#111827;border-radius:9999px;padding:6px 10px;max-width:100%';
      if (input.type === 'image') {
        const img = document.createElement('img'); img.style.cssText = 'width:36px;height:36px;border-radius:6px;object-fit:cover;'; img.src = URL.createObjectURL(input.blob); chip.appendChild(img);
        const label = document.createElement('span'); label.textContent = 'Pasted image ready to send'; label.style.cssText = 'font-size:12px;white-space:nowrap;'; chip.appendChild(label);
      } else {
        const icon = document.createElement('span'); icon.textContent = '📝'; chip.appendChild(icon);
        const label = document.createElement('span'); label.textContent = input.text.length > 60 ? input.text.slice(0,60)+'…' : input.text; label.style.cssText = 'font-size:12px;'; chip.appendChild(label);
      }
      const removeBtn = document.createElement('button'); removeBtn.textContent = '×'; removeBtn.title = 'Remove'; removeBtn.style.cssText = 'width:20px;height:20px;line-height:20px;text-align:center;border:none;border-radius:50%;background:#e5e7eb;cursor:pointer;font-weight:700;';
      removeBtn.addEventListener('click', () => { pendingPastedImage = null; pendingPastedText = null; preview.innerHTML = ''; });
      chip.appendChild(removeBtn);
      preview.appendChild(chip);
    }

    const send = document.createElement('button');
    send.className = 'ls-button';
    send.textContent = 'Send';
    send.addEventListener('click', async () => {
      const text = ta.value.trim();
      if (!text) return;
      const userMsg = document.createElement('div');
      userMsg.className = 'ls-message user';
      userMsg.innerHTML = markdownToHtml(text);
      history.appendChild(userMsg);

      ta.value = '';
      const thinking = document.createElement('div');
      thinking.className = 'ls-message assistant';
      thinking.innerHTML = `<span class="ls-spinner"></span>Thinking…`;
      history.appendChild(thinking);
      history.scrollTop = history.scrollHeight;
      try {
        const guidelines = 'Respond in clean Markdown with headings, bullet points, and numbered steps when helpful. Keep answers concise and scannable.';
        const context = selection ? `\n\nContext (selected):\n${selection}` : '';
        // Auto-create an anchor for current selection (no UI button)
        let anchorSnippet = '';
        try {
          const data = serializeSelectionToXPath();
          if (data) {
            const hash = btoa(unescape(encodeURIComponent(`${location.href}|${data.startXPath}|${data.startOffset}|${data.endXPath}|${data.endOffset}`))).slice(0, 64);
            const anchorId = `a_${Date.now()}`;
            await StorageService.saveAnchor({
              url: location.href,
              anchorId,
              method: 'xpath',
              serialized: { startXPath: data.startXPath, startOffset: data.startOffset, endXPath: data.endXPath, endOffset: data.endOffset },
              snippet: data.snippet,
              hash
            } as any);
            const range = restoreRangeFromXPath({ startXPath: data.startXPath, startOffset: data.startOffset, endXPath: data.endXPath, endOffset: data.endOffset });
            if (range) highlightRange(range, anchorId);
            anchorSnippet = `\n\nContext (anchor):\n${data.snippet}`;
          }
        } catch {}

        let answer: string;
        if (pendingPastedImage || pendingPastedText) {
          answer = await callGeminiMultimodal(`${guidelines}\n\nQuestion: ${text}${context}${anchorSnippet}`, { imageBlob: pendingPastedImage || undefined, pastedText: pendingPastedText || undefined });
        } else {
          answer = await callGemini(`${guidelines}\n\nQuestion: ${text}${context}${anchorSnippet}`);
        }
        thinking.innerHTML = markdownToHtml(answer);
        // Jump-to-context removed for now
        try { await StorageService.logChatAsked(text.slice(0, 80), { sourceUrl: location.href, documentTitle: document.title }); } catch {}
        // Clear preview after send
        pendingPastedImage = null; pendingPastedText = null; preview.innerHTML = '';
      } catch (e) {
        const msg = (e as Error).message || 'Unknown error';
        thinking.innerHTML = markdownToHtml(`**Error:** ${msg}\n\nTry again in a few seconds. If the issue persists, verify your network and API key in Settings.`);
      }
      history.scrollTop = history.scrollHeight;
    });

    // Place buttons side-by-side, Send first for proper tab order
    const btnRow = document.createElement('div');
    btnRow.className = 'ls-btn-row';
    btnRow.style.cssText = 'display:flex; gap:8px; justify-content:flex-end; align-items:center; margin-top:8px; flex-wrap:nowrap;';
    // Override global button width and layout so they sit side by side
    Object.assign(send.style, { width: 'auto', display: 'inline-flex', flex: '0 0 auto', marginTop: '0' });
    Object.assign(pasteBtn.style, { width: 'auto', display: 'inline-flex', flex: '0 0 auto', marginTop: '0' });
    // Ensure tabbing from textarea goes to Send first (order in DOM already enforces this)
    send.tabIndex = 0;
    pasteBtn.tabIndex = 0;
    btnRow.appendChild(send);
    btnRow.appendChild(pasteBtn);

    footer.append(ta, btnRow);

    // Offline indicator
    const net = document.createElement('div');
    net.style.cssText = 'margin-top:6px;font-size:12px;color:#6b7280;display:flex;align-items:center;gap:6px;';
    const dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:9999px;display:inline-block;background:#10b981;';
    const label = document.createElement('span');
    function updateNet() {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      dot.style.background = offline ? '#9ca3af' : '#10b981';
      label.textContent = offline ? 'Offline: AI disabled, using cached content when available' : 'Online';
    }
    updateNet();
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
    net.append(dot, label);
    footer.appendChild(net);
  }

  if (type === 'summary') {
    const msg = document.createElement('div');
    msg.className = 'ls-message assistant';
    msg.innerHTML = markdownToHtml(`**Selected Text**\n\n${selection || 'No text selected.'}`);
    content.appendChild(msg);

    const out = document.createElement('div');
    out.id = 'ls-summary-output';
    out.className = 'ls-message assistant';
    out.textContent = 'Click the button below to generate a summary.';
    content.appendChild(out);

    const btn = document.createElement('button');
    btn.className = 'ls-button';
    btn.textContent = 'Generate Summary';
    btn.addEventListener('click', async () => {
      try {
        // Offline fallback: if offline, show cached snippet instead of calling AI
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cache = await StorageService.getPageCache(location.href);
          if (cache && cache.text) {
            const snippet = extractOfflineSnippet(cache.text, selection, '');
            out.innerHTML = markdownToHtml(`**Offline fallback (no AI)**\n\n${snippet}`);
          } else {
            out.innerHTML = markdownToHtml('**Offline**: No cached content available for this page. Try again when online.');
          }
          return;
        }
        const base = selection || window.getSelection()?.toString() || document.title;
        const prompt = `Summarize the following text using Markdown. Include a short title, key bullet points, and a brief takeaway section.\n\n${base}`;
        out.innerHTML = `<span class="ls-spinner"></span>Generating…`;
        const ans = await callGemini(prompt);
        out.innerHTML = markdownToHtml(ans);
        try { await StorageService.logSummaryGenerated({ sourceUrl: location.href, documentTitle: document.title }); } catch {}
      } catch (e) {
        const msg = (e as Error).message || 'Unknown error';
        out.innerHTML = markdownToHtml(`**Error:** ${msg}`);
      }
    });
    footer.appendChild(btn);
  }

  if (type === 'quiz') {
    const msg = document.createElement('div');
    msg.className = 'ls-message assistant';
    msg.innerHTML = markdownToHtml(`**Selected Text**\n\n${selection || 'No text selected.'}`);
    content.appendChild(msg);

    const out = document.createElement('div');
    out.id = 'ls-quiz-output';
    out.className = 'ls-message assistant';
    out.textContent = 'Click the button below to generate a quiz.';
    content.appendChild(out);

    const btn = document.createElement('button');
    btn.className = 'ls-button';
    btn.textContent = 'Generate Quiz';
    btn.addEventListener('click', async () => {
      try {
        const base = selection || window.getSelection()?.toString() || document.title;
        // Read preferred question count from synced settings
        let preferredCount = 5;
        try {
          const sync = await chrome.storage.sync.get('learnsphere_settings');
          const cfg = sync?.learnsphere_settings;
          if (cfg?.defaultQuizQuestionCount) preferredCount = Number(cfg.defaultQuizQuestionCount);
        } catch {}

        const prompt = `Return ONLY valid JSON (no markdown fences, no extra text): an array of ${preferredCount} objects with fields 
{"question": string, "options": [string,string,string,string], "correctAnswer": number (0-3), "explanation": string} 
based on this text: \n${base}`;
        out.innerHTML = `<span class="ls-spinner"></span>Generating…`;
        const raw = await callGemini(prompt);
        const questions = tryParseQuizJSON(raw);
        if (!questions || !questions.length) {
          out.innerHTML = markdownToHtml('**Sorry**: Could not parse quiz data. Please try again.');
      return;
    }
        // Render interactive quiz
        out.innerHTML = '';
        renderInteractiveQuiz(out, questions);
        // Add Save Result button (modular, does nothing if user doesn't click)
        const saveBtn = document.createElement('button');
        saveBtn.className = 'ls-button';
        saveBtn.textContent = 'Save Result';
        saveBtn.addEventListener('click', () => saveCurrentQuiz(out, questions));
        out.appendChild(document.createElement('div')).appendChild(saveBtn);
      } catch (e) {
        const msg = (e as Error).message || 'Unknown error';
        out.innerHTML = markdownToHtml(`**Error:** ${msg}`);
      }
    });
    footer.appendChild(btn);
  }

  root.append(header, tabs, content, footer);
  document.body.appendChild(root);
  // Cache page content for offline mode
  (async () => {
    try {
      const extracted = ContentExtractionService.extractFromCurrentPage();
      if (extracted.text && extracted.text.length >= 200) {
        await StorageService.savePageCache({ url: location.href, title: document.title || extracted.title, text: extracted.text });
      }
    } catch {}
  })();

  // Re-highlight saved anchors for this URL (still useful without explicit UI buttons)
  (async () => {
    try {
      const anchors = await StorageService.getAnchors(location.href);
      anchors.forEach(a => {
        if (a.method === 'xpath') {
          const r = restoreRangeFromXPath(a.serialized as any);
          if (r) highlightRange(r, a.anchorId as any);
        }
      });
    } catch {}
  })();
}

function makeMessage(role: 'user' | 'assistant', text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `ls-message ${role}`;
  el.innerHTML = markdownToHtml(text);
  return el;
}

interface QuizQuestion { question: string; options: string[]; correctAnswer: number; explanation: string; }

function stripCodeFences(s: string): string { return s.replace(/^```[a-zA-Z]*\n/m, '').replace(/```\s*$/m, ''); }

function tryParseQuizJSON(text: string): QuizQuestion[] | null {
  try {
    const clean = stripCodeFences(text).trim();
    // If response has prose, try to extract JSON array by first '[' and last ']'
    const first = clean.indexOf('[');
    const last = clean.lastIndexOf(']');
    const jsonStr = first !== -1 && last !== -1 ? clean.slice(first, last + 1) : clean;
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(q => q && Array.isArray(q.options) && typeof q.correctAnswer === 'number')
        .map(q => ({
          question: String(q.question || ''),
          options: q.options.slice(0, 4).map((o: any) => String(o)),
          correctAnswer: Math.min(Math.max(Number(q.correctAnswer), 0), 3),
          explanation: String(q.explanation || '')
        }));
    }
    return null;
  } catch {
    return null;
  }
}

function renderInteractiveQuiz(container: HTMLElement, questions: QuizQuestion[]): void {
  // Create a stable group id so we can read selections later
  const groupId = String(Date.now());
  container.setAttribute('data-quiz-group', groupId);

  questions.forEach((q, idx) => {
    const qWrap = document.createElement('div');
    qWrap.className = 'ls-quiz-q';

    const title = document.createElement('h4');
    title.textContent = `Q${idx + 1}. ${q.question}`;
    qWrap.appendChild(title);

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'ls-quiz-options';

    const name = `lsq-${groupId}-${idx}`;
    q.options.forEach((opt, i) => {
      const label = document.createElement('label');
      label.className = 'ls-quiz-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = name;
      input.value = String(i);

      const span = document.createElement('span');
      span.innerHTML = markdownToHtml(opt);

      label.append(input, span);
      optionsWrap.appendChild(label);
    });

    const result = document.createElement('div');
    result.className = 'ls-quiz-result';

    optionsWrap.addEventListener('change', (e) => {
      const selected = Number((e.target as HTMLInputElement).value);
      // Reset visual states
      optionsWrap.querySelectorAll('.ls-quiz-option').forEach(el => el.classList.remove('correct', 'incorrect'));
      const all = Array.from(optionsWrap.querySelectorAll('.ls-quiz-option')) as HTMLElement[];
      if (selected === q.correctAnswer) {
        all[selected].classList.add('correct');
        result.innerHTML = markdownToHtml('**Correct!**\n\n' + q.explanation);
      } else {
        all[selected].classList.add('incorrect');
        if (all[q.correctAnswer]) all[q.correctAnswer].classList.add('correct');
        result.innerHTML = markdownToHtml('**Incorrect.**\n\n' + q.explanation);
      }
    });

    qWrap.append(optionsWrap, result);
    container.appendChild(qWrap);
  });
}

// Extract a reasonable offline snippet from cached page text
function extractOfflineSnippet(cached: string, selection: string | undefined, query: string): string {
  const base = (selection && selection.trim()) || query || '';
  if (!cached) return 'No cached text.';
  if (!base) return cached.slice(0, 1000) + (cached.length > 1000 ? '…' : '');
  const idx = cached.toLowerCase().indexOf(base.toLowerCase().slice(0, Math.min(32, base.length)));
  if (idx === -1) {
    return cached.slice(0, 1000) + (cached.length > 1000 ? '…' : '');
  }
  const start = Math.max(0, idx - 300);
  const end = Math.min(cached.length, idx + Math.max(300, base.length + 300));
  return cached.slice(start, end);
}

function collectSelections(container: HTMLElement, questions: QuizQuestion[]): number[] {
  const groupId = container.getAttribute('data-quiz-group') || '';
  return questions.map((_q, idx) => {
    const selector = `input[name="lsq-${groupId}-${idx}"]`;
    const inputs = container.querySelectorAll(selector) as NodeListOf<HTMLInputElement>;
    const checked = Array.from(inputs).find(i => i.checked);
    return checked ? Number(checked.value) : -1;
  });
}

async function saveCurrentQuiz(container: HTMLElement, questions: QuizQuestion[]) {
  try {
    const selections = collectSelections(container, questions);
    const complete = selections.every(i => i >= 0);
    if (!complete) {
      container.appendChild(makeMessage('assistant', '**Please answer all questions before saving.**'));
      return;
    }
    const result = await QuizPersistenceService.saveResult({
      questions,
      selections,
      sourceUrl: location.href,
      documentTitle: document.title
    });
    container.appendChild(makeMessage('assistant', `**Saved.** Score: ${result.correctCount}/${result.totalQuestions} (${result.percentage}%).`));
  } catch (e) {
    container.appendChild(makeMessage('assistant', `**Save failed:** ${(e as Error).message}`));
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message.action === 'ping') {
      sendResponse({ success: true, message: 'pong' });
      return true;
    }
    if (message.action === 'openChatSidebar') {
      createSidebar('chat', message.selection);
      sendResponse({ success: true });
      return true;
    }
    if (message.action === 'generateSummary') {
      createSidebar('summary', message.selection);
      sendResponse({ success: true });
      return true;
    }
    if (message.action === 'generateQuiz') {
      createSidebar('quiz', message.selection);
      sendResponse({ success: true });
      return true;
    }
    sendResponse({ success: false, message: 'Unknown action' });
  } catch (e) {
    console.error('🚀 LearnSphere: Error in message handler:', e);
    sendResponse({ success: false, message: (e as Error).message });
  }
  return true;
});

console.log('🚀 LearnSphere: Content script ready.');

// --- Floating selection toolbar (Ask / Summarize / Quiz) ---
let lsSelectionToolbarHost: HTMLDivElement | null = null;
let lsSelectionToolbarShadow: ShadowRoot | null = null;
let lsSelectionToolbarVisible = false;

function ensureSelectionToolbar(): { host: HTMLDivElement; shadow: ShadowRoot } {
  if (lsSelectionToolbarHost && lsSelectionToolbarShadow) return { host: lsSelectionToolbarHost, shadow: lsSelectionToolbarShadow };
  const host = document.createElement('div');
  host.id = 'learnsphere-selection-toolbar-host';
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.zIndex = '2147483647';
  host.style.pointerEvents = 'none';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    .wrap { pointer-events: auto; background: rgba(17,24,39,.92); backdrop-filter: saturate(120%) blur(6px); color: #fff; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.35); padding: 6px; display: flex; gap: 4px; align-items: center; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; border: 1px solid rgba(59,130,246,.25); }
    button { all: unset; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; background: #111827; color: #e5e7eb; border-radius: 8px; cursor: pointer; font-size: 14px; line-height: 1; }
    button:hover { background: #1f2937; }
    .tooltip { position: absolute; bottom: 100%; transform: translateY(-6px); background:#111827; color:#e5e7eb; padding:2px 6px; font-size:11px; border-radius:6px; white-space:nowrap; opacity:0; pointer-events:none; transition:opacity .12s ease; }
    button:hover .tooltip { opacity: 1; }
  `;
  shadow.appendChild(style);
  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  const ask = document.createElement('button'); ask.innerHTML = '<span>💬</span><span class="tooltip">Ask</span>';
  const sum = document.createElement('button'); sum.innerHTML = '<span>📝</span><span class="tooltip">Summarize</span>';
  const quiz = document.createElement('button'); quiz.innerHTML = '<span>🧠</span><span class="tooltip">Quiz</span>';
  wrap.append(ask, sum, quiz);
  shadow.appendChild(wrap);

  // Button handlers set at show time to capture current selection text
  (ask as any)._handler = null;
  (sum as any)._handler = null;
  (quiz as any)._handler = null;

  lsSelectionToolbarHost = host;
  lsSelectionToolbarShadow = shadow;
  return { host, shadow };
}

function hideSelectionToolbar() {
  if (!lsSelectionToolbarHost) return;
  lsSelectionToolbarHost.style.transform = 'translate(-9999px, -9999px)';
  lsSelectionToolbarVisible = false;
}

function showSelectionToolbarForSelection() {
  try {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { hideSelectionToolbar(); return; }
    const range = sel.getRangeAt(0);
    // Ignore selections inside our own UI
    const container = range.commonAncestorContainer as HTMLElement;
    if (container && (container.closest('#learnsphere-sidebar') || container.closest('#learnsphere-selection-toolbar-host'))) {
      hideSelectionToolbar();
      return;
    }
    const text = (sel.toString() || '').trim();
    if (!text || text.length < 2) { hideSelectionToolbar(); return; }
    const rects = range.getClientRects();
    const rect = rects.length ? rects[0] : range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) { hideSelectionToolbar(); return; }

    const { host, shadow } = ensureSelectionToolbar();
    const wrap = shadow.querySelector('.wrap') as HTMLDivElement;
    const [ask, sum, quiz] = Array.from(wrap.querySelectorAll('button')) as HTMLButtonElement[];
    // Reset existing listeners
    if ((ask as any)._handler) ask.removeEventListener('click', (ask as any)._handler);
    if ((sum as any)._handler) sum.removeEventListener('click', (sum as any)._handler);
    if ((quiz as any)._handler) quiz.removeEventListener('click', (quiz as any)._handler);
    // New listeners capturing current selection text
    const onAsk = () => { createSidebar('chat', text); hideSelectionToolbar(); };
    const onSum = () => { createSidebar('summary', text); hideSelectionToolbar(); };
    const onQuiz = () => { createSidebar('quiz', text); hideSelectionToolbar(); };
    ask.addEventListener('click', onAsk); (ask as any)._handler = onAsk;
    sum.addEventListener('click', onSum); (sum as any)._handler = onSum;
    quiz.addEventListener('click', onQuiz); (quiz as any)._handler = onQuiz;

    // Positioning (fixed coordinates)
    const padding = 8;
    const desiredLeft = Math.max(8, Math.min(rect.left + rect.width / 2, window.innerWidth - 8));
    // measure width to center
    wrap.style.visibility = 'hidden';
    host.style.transform = `translate(${Math.round(desiredLeft)}px, ${Math.round(rect.top + rect.height + padding)}px)`;
    wrap.getBoundingClientRect();
    wrap.style.visibility = 'visible';
    const w = wrap.getBoundingClientRect().width;
    const left = Math.max(8, Math.min(desiredLeft - w / 2, window.innerWidth - w - 8));
    host.style.transform = `translate(${Math.round(left)}px, ${Math.round(rect.top + rect.height + padding)}px)`;
    lsSelectionToolbarVisible = true;
  } catch {
    hideSelectionToolbar();
  }
}

function handleGlobalMouseUp() { setTimeout(showSelectionToolbarForSelection, 0); }
function handleGlobalKeyUp(e: KeyboardEvent) {
  if (e.key === 'Escape') { hideSelectionToolbar(); try { const sel = window.getSelection(); sel?.removeAllRanges(); } catch {} return; }
  setTimeout(showSelectionToolbarForSelection, 0);
}
function handleGlobalScroll() { if (lsSelectionToolbarVisible) showSelectionToolbarForSelection(); }
function handleDocClick(e: MouseEvent) {
  // Hide when clicking outside toolbar
  const path = (e.composedPath && e.composedPath()) || [];
  const inside = path.some((n: any) => n === lsSelectionToolbarHost || (n instanceof HTMLElement && n.id === 'learnsphere-sidebar'));
  if (!inside) hideSelectionToolbar();
}

document.addEventListener('mouseup', handleGlobalMouseUp);
document.addEventListener('keyup', handleGlobalKeyUp);
document.addEventListener('scroll', handleGlobalScroll, true);
document.addEventListener('mousedown', handleDocClick, true);