// Minimal PDF.js loader for local/file and http/https PDFs inside our own page.
// We use the prebuilt PDF.js from a CDN to avoid bundling heavy assets.

// Use local bundled pdf.js ESM from pdfjs-dist to avoid CSP issues
const PDFJS_URL = chrome.runtime.getURL('pdf.min.mjs');
const PDFJS_WORKER_URL = chrome.runtime.getURL('pdf.worker.min.mjs');
const PDFJS_VIEWER_URL = chrome.runtime.getURL('pdf_viewer.mjs');

async function loadPdfJsModule(): Promise<any> {
  const cached = (window as any)._learnsphere_pdfjs_module;
  if (cached) return cached;
  const mod = await import(/* webpackIgnore: true */ PDFJS_URL);
  // Configure ESM worker
  mod.GlobalWorkerOptions.workerPort = new Worker(PDFJS_WORKER_URL, { type: 'module' });
  (window as any)._learnsphere_pdfjs_module = mod;
  return mod;
}

async function loadPdfViewerModule(): Promise<any> {
  const cached = (window as any)._learnsphere_pdfjs_viewer;
  if (cached) return cached;
  const mod = await import(/* webpackIgnore: true */ PDFJS_VIEWER_URL);
  (window as any)._learnsphere_pdfjs_viewer = (mod as any).pdfjsViewer || mod;
  return (window as any)._learnsphere_pdfjs_viewer;
}

async function openPdf(urlOrBlob: string | Blob) {
  const pdfjsLib = await loadPdfJsModule();
  const pdfjsViewer = await loadPdfViewerModule();
  const container = document.getElementById('viewerContainer')!;
  const viewer = document.getElementById('viewer')!;
  viewer.innerHTML = '';

  const eventBus = new pdfjsViewer.EventBus();
  const linkService = new pdfjsViewer.PDFLinkService({ eventBus });
  const findController = new pdfjsViewer.PDFFindController({ eventBus, linkService });
  const pdfViewer = new pdfjsViewer.PDFViewer({
    container,
    viewer,
    eventBus,
    linkService,
    findController,
    textLayerMode: 1 // ENABLE
  });
  linkService.setViewer(pdfViewer);

  let src: any;
  if (typeof urlOrBlob !== 'string') {
    src = URL.createObjectURL(urlOrBlob);
  } else {
    src = urlOrBlob;
  }
  const loadingTask = pdfjsLib.getDocument(src);
  const pdf = await loadingTask.promise;
  pdfViewer.setDocument(pdf);
  linkService.setDocument(pdf);

  (document.getElementById('page') as HTMLElement).textContent = `1 / ${pdf.numPages}`;

  (document.getElementById('prev') as HTMLButtonElement).onclick = () => {
    if (pdfViewer.currentPageNumber > 1) { pdfViewer.currentPageNumber -= 1; updatePageLabel(pdfViewer); }
  };
  (document.getElementById('next') as HTMLButtonElement).onclick = () => {
    if (pdfViewer.currentPageNumber < pdf.numPages) { pdfViewer.currentPageNumber += 1; updatePageLabel(pdfViewer); }
  };
}

function updatePageLabel(pdfViewer: any) {
  (document.getElementById('page') as HTMLElement).textContent = `${pdfViewer.currentPageNumber} / ${pdfViewer.pagesCount}`;
}

function init() {
  const openBtn = document.getElementById('open') as HTMLButtonElement;
  const fileInput = document.getElementById('file') as HTMLInputElement;

  openBtn.onclick = () => fileInput.click();
  fileInput.onchange = () => {
    const f = fileInput.files?.[0];
    if (f) openPdf(f);
  };

  // Enable paste of screenshot directly into viewer (for local PDFs)
  document.addEventListener('paste', (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of items) {
      if (it.type === 'image/png' || it.type === 'image/jpeg') {
        const blob = it.getAsFile();
        if (blob) {
          // forward to content script chat if available
          try { chrome.runtime.sendMessage({ action: 'openSidebar' }); } catch {}
          // store on window for content script to pick up via paste handler if needed
          (window as any).__ls_last_pasted_image = blob;
          e.preventDefault();
          break;
        }
      }
    }
  });

  // Support query string: viewer.html?file=<url>
  const params = new URLSearchParams(location.search);
  const file = params.get('file');
  if (file) {
    const decoded = decodeURIComponent(file);
    if (decoded.startsWith('file://')) {
      console.warn('LearnSphere Viewer: Cannot fetch local file via URL due to browser restrictions. Use Open PDF.');
      // Optionally show a small notice in the page area
      const container = document.getElementById('pdf')!;
      const note = document.createElement('div');
      note.style.color = '#e5e7eb';
      note.style.padding = '12px';
      note.textContent = 'This is a local PDF. Click "Open PDF" to select the file from disk.';
      container.appendChild(note);
    } else {
      openPdf(decoded);
    }
  }
}

document.addEventListener('DOMContentLoaded', init);


