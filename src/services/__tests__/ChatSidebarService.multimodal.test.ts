/**
 * @jest-environment jsdom
 */
import { ChatSidebarService } from '@/services/ChatSidebarService';
import { GeminiAIService } from '@/services/GeminiAIService';

// Mock UI components used by ChatSidebarService to avoid heavy DOM logic
jest.mock('@/components/SummaryGenerator', () => ({
  SummaryGenerator: class MockSummaryGenerator {
    constructor(_cfg: any, _svc: any) {}
    initialize() {}
    show() {}
  }
}));
jest.mock('@/components/QuizGenerator', () => ({
  QuizGenerator: class MockQuizGenerator {
    constructor(_cfg: any, _svc: any) {}
    initialize() {}
    show() {}
  }
}));
jest.mock('@/components/QuizInterface', () => ({
  QuizInterface: class MockQuizInterface {
    constructor(_cfg: any, _svc: any) {}
    initialize() {}
    startQuiz() {}
  }
}));

// Stub chrome API used by SettingsService under the hood
// @ts-ignore
global.chrome = {
  storage: {
    sync: { get: jest.fn().mockResolvedValue({}) },
    local: { get: jest.fn().mockResolvedValue({}) }
  }
};

// Provide a basic matchMedia stub used by SettingsService
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

describe('ChatSidebarService multimodal clipboard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // Online by default
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    // Stub URL.createObjectURL for image preview
    // @ts-ignore
    if (!(window as any).URL) (window as any).URL = {};
    // @ts-ignore
    (window as any).URL.createObjectURL = jest.fn(() => 'blob:mock');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('clicking Paste from Clipboard with image triggers multimodal send with imageBlob', async () => {
    // Spy and stub AI init + multimodal method
    jest.spyOn(GeminiAIService.prototype as any, 'initialize').mockResolvedValue(undefined);
    const multimodalSpy = jest
      .spyOn(GeminiAIService.prototype as any, 'generateRAGResponseMultimodal')
      .mockResolvedValue('AI response');
    // Also stub text-only path to avoid init checks if fallback triggers
    jest.spyOn(GeminiAIService.prototype as any, 'generateRAGResponse').mockResolvedValue('AI text');

    // Stub clipboard.read to return a PNG image
    const pngBlob = new Blob([new Uint8Array([137,80,78,71])], { type: 'image/png' });
    // @ts-ignore
    global.navigator.clipboard = {
      read: jest.fn().mockResolvedValue([
        {
          types: ['image/png'],
          getType: (t: string) => (t === 'image/png' ? Promise.resolve(pngBlob) : Promise.reject(new Error('type')))
        }
      ])
    };

    const svc = new ChatSidebarService();
    await svc.initialize('AIza-test');
    svc.open();

    // Find controls
    const pasteBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Paste from Clipboard')) as HTMLButtonElement;
    expect(pasteBtn).toBeTruthy();

    // Trigger paste button (image)
    pasteBtn.click();
    await new Promise(r => setTimeout(r, 0));

    // Preview image should be rendered
    expect(document.querySelector('#learnsphere-chat-sidebar img')).toBeTruthy();

    // Enter a question and send
    const ta = document.getElementById('chat-input') as HTMLTextAreaElement;
    ta.value = 'Explain this image';
    const sendBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Send') as HTMLButtonElement;
    sendBtn.click();
    await new Promise(r => setTimeout(r, 0));

    expect(multimodalSpy).toHaveBeenCalledTimes(1);
    const args = multimodalSpy.mock.calls[0];
    expect(args[0]).toContain('Explain this image');
    expect(args[1]).toMatchObject({ imageBlob: expect.any(Blob) });
  });

  test('clicking Paste from Clipboard with text triggers multimodal send with pastedText', async () => {
    jest.spyOn(GeminiAIService.prototype as any, 'initialize').mockResolvedValue(undefined);
    const multimodalSpy = jest
      .spyOn(GeminiAIService.prototype as any, 'generateRAGResponseMultimodal')
      .mockResolvedValue('AI response');
    jest.spyOn(GeminiAIService.prototype as any, 'generateRAGResponse').mockResolvedValue('AI text');

    const textBlob: any = { type: 'text/plain', text: () => Promise.resolve('figure 1 shows the process') };
    // @ts-ignore
    global.navigator.clipboard = {
      read: jest.fn().mockResolvedValue([
        {
          types: ['text/plain'],
          getType: (t: string) => (t === 'text/plain' ? Promise.resolve(textBlob) : Promise.reject(new Error('type')))
        }
      ])
    };

    const svc = new ChatSidebarService();
    await svc.initialize('AIza-test');
    svc.open();

    const pasteBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Paste from Clipboard')) as HTMLButtonElement;
    pasteBtn.click();
    await new Promise(r => setTimeout(r, 0));

    // Preview text chip should be rendered
    const chip = Array.from(document.querySelectorAll('#learnsphere-chat-sidebar span')).find(s => s.textContent?.includes('figure 1'));
    expect(chip).toBeTruthy();

    const ta = document.getElementById('chat-input') as HTMLTextAreaElement;
    ta.value = 'What does the figure mean?';
    const sendBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Send') as HTMLButtonElement;
    sendBtn.click();
    await new Promise(r => setTimeout(r, 0));

    expect(multimodalSpy).toHaveBeenCalledTimes(1);
    const args = multimodalSpy.mock.calls[0];
    expect(args[1]).toMatchObject({ pastedText: expect.stringContaining('figure 1') });
  });

  test('clipboard.read throws but readText succeeds (fallback path)', async () => {
    jest.spyOn(GeminiAIService.prototype as any, 'initialize').mockResolvedValue(undefined);
    const multimodalSpy = jest
      .spyOn(GeminiAIService.prototype as any, 'generateRAGResponseMultimodal')
      .mockResolvedValue('AI response');
    jest.spyOn(GeminiAIService.prototype as any, 'generateRAGResponse').mockResolvedValue('AI text');

    // @ts-ignore
    global.navigator.clipboard = {
      read: jest.fn().mockRejectedValue(new Error('denied')),
      readText: jest.fn().mockResolvedValue('fallback snippet from clipboard')
    };

    const svc = new ChatSidebarService();
    await svc.initialize('AIza-test');
    svc.open();

    const pasteBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Paste from Clipboard')) as HTMLButtonElement;
    pasteBtn.click();
    await new Promise(r => setTimeout(r, 0));

    const ta = document.getElementById('chat-input') as HTMLTextAreaElement;
    ta.value = 'Use fallback content';
    const sendBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Send') as HTMLButtonElement;
    sendBtn.click();
    await new Promise(r => setTimeout(r, 0));

    expect(multimodalSpy).toHaveBeenCalledTimes(1);
    const args = multimodalSpy.mock.calls[0];
    expect(args[1]).toMatchObject({ pastedText: expect.stringContaining('fallback snippet') });
  });

  test('paste button disabled when offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    jest.spyOn(GeminiAIService.prototype as any, 'initialize').mockResolvedValue(undefined);
    const svc = new ChatSidebarService();
    await svc.initialize('AIza-test');
    svc.open();

    const pasteBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Paste from Clipboard')) as HTMLButtonElement;
    expect(pasteBtn.disabled).toBe(true);
  });
});


