import { PDFDocument, PDFPage } from '@/types';
import { DocumentProcessingService } from './DocumentProcessingService';
import { TextSelectionService } from './TextSelectionService';
import { ChatSidebarService } from './ChatSidebarService';

export class PDFViewerService {
  private currentDocument: PDFDocument | null = null;
  private pdfContainer: HTMLElement | null = null;
  private pdfjsLib: any = null;
  private documentProcessor: DocumentProcessingService;
  private textSelectionService: TextSelectionService;
  private chatSidebar: ChatSidebarService;

  constructor() {
    this.documentProcessor = new DocumentProcessingService();
    this.textSelectionService = new TextSelectionService();
    this.chatSidebar = new ChatSidebarService();
    this.init();
  }

  private async init() {
    await this.loadPDFJS();
  }

  private async loadPDFJS(): Promise<void> {
    return new Promise((resolve) => {
      // Check if PDF.js is already loaded
      if ((window as any).pdfjsLib) {
        this.pdfjsLib = (window as any).pdfjsLib;
        resolve();
        return;
      }

      // Load PDF.js from CDN
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        this.pdfjsLib = (window as any).pdfjsLib;
        // Set worker path
        this.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = () => {
        console.error('Failed to load PDF.js');
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  public async detectPDFViewer(): Promise<'chrome' | 'external' | 'none'> {
    const url = window.location.href.toLowerCase();
    
    // Check if it's Chrome's built-in PDF viewer
    if (url.includes('chrome-extension://') && 
        (document.querySelector('embed[type="application/pdf"]') || 
         document.querySelector('object[type="application/pdf"]'))) {
      return 'chrome';
    }
    
    // Check if there's an external PDF viewer
    if (document.querySelector('embed[type="application/pdf"]') ||
        document.querySelector('object[type="application/pdf"]') ||
        document.querySelector('iframe[src*=".pdf"]')) {
      return 'external';
    }
    
    // Check if URL points to a PDF
    if (url.includes('.pdf')) {
      return 'none'; // Direct PDF URL, no viewer detected
    }
    
    return 'none';
  }

  public async overrideChromePDFViewer(): Promise<void> {
    const viewerType = await this.detectPDFViewer();
    
    switch (viewerType) {
      case 'chrome':
        await this.overrideChromeViewer();
        break;
      case 'external':
        await this.integrateWithExternalViewer();
        break;
      case 'none':
        await this.createCustomViewer();
        break;
    }
  }

  private async overrideChromeViewer(): Promise<void> {
    // Hide Chrome's default PDF viewer
    const originalViewer = document.querySelector('embed[type="application/pdf"]') as HTMLElement;
    if (originalViewer) {
      originalViewer.style.display = 'none';
    }

    // Create our custom container
    this.createPDFContainer();
    
    // Load and render the PDF
    await this.loadAndRenderPDF(window.location.href);
  }

  private async integrateWithExternalViewer(): Promise<void> {
    // For external viewers, we'll inject our UI without overriding
    this.createPDFContainer();
    
    // Try to extract PDF URL from iframe or embed
    const iframe = document.querySelector('iframe[src*=".pdf"]') as HTMLIFrameElement;
    const embed = document.querySelector('embed[type="application/pdf"]') as HTMLEmbedElement;
    const object = document.querySelector('object[type="application/pdf"]') as HTMLObjectElement;
    
    let pdfUrl = '';
    if (iframe && iframe.src) {
      pdfUrl = iframe.src;
    } else if (embed && embed.src) {
      pdfUrl = embed.src;
    } else if (object && object.data) {
      pdfUrl = object.data;
    }
    
    if (pdfUrl) {
      await this.loadAndRenderPDF(pdfUrl);
    }
  }

  private async createCustomViewer(): Promise<void> {
    // For direct PDF URLs, create a full custom viewer
    this.createPDFContainer();
    await this.loadAndRenderPDF(window.location.href);
  }

  private createPDFContainer(): void {
    // Remove existing container if any
    const existingContainer = document.getElementById('learnsphere-pdf-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    // Create new container
    this.pdfContainer = document.createElement('div');
    this.pdfContainer.id = 'learnsphere-pdf-container';
    this.pdfContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9999;
      background: white;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Add toolbar
    const toolbar = this.createToolbar();
    this.pdfContainer.appendChild(toolbar);

    // Add pages container
    const pagesContainer = document.createElement('div');
    pagesContainer.id = 'learnsphere-pages-container';
    pagesContainer.style.cssText = `
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    `;
    this.pdfContainer.appendChild(pagesContainer);

    document.body.appendChild(this.pdfContainer);
  }

  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
      position: sticky;
      top: 0;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 1000;
    `;

    // Document title
    const title = document.createElement('h1');
    title.textContent = 'LearnSphere PDF Viewer';
    title.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    `;

    // Controls
    const controls = document.createElement('div');
    controls.style.cssText = `
      display: flex;
      gap: 12px;
      align-items: center;
    `;

    // Zoom controls
    const zoomOut = this.createButton('−', () => this.zoomOut());
    const zoomIn = this.createButton('+', () => this.zoomIn());
    const zoomReset = this.createButton('Reset', () => this.zoomReset());

                // Page controls
            const prevPage = this.createButton('←', () => this.previousPage());
            const nextPage = this.createButton('→', () => this.nextPage());
            const pageInfo = document.createElement('span');
            pageInfo.id = 'page-info';
            pageInfo.style.cssText = `
              font-size: 14px;
              color: #666;
              margin: 0 8px;
            `;

            // Chat toggle button
            const chatButton = this.createButton('💬', () => this.chatSidebar.toggle());
            chatButton.title = 'Toggle Chat (Ctrl+Shift+C)';

            controls.appendChild(zoomOut);
            controls.appendChild(zoomIn);
            controls.appendChild(zoomReset);
            const separator1 = document.createElement('div');
            separator1.style.cssText = 'width: 1px; height: 20px; background: #e0e0e0; margin: 0 8px;';
            controls.appendChild(separator1);
            controls.appendChild(prevPage);
            controls.appendChild(pageInfo);
            controls.appendChild(nextPage);
            const separator2 = document.createElement('div');
            separator2.style.cssText = 'width: 1px; height: 20px; background: #e0e0e0; margin: 0 8px;';
            controls.appendChild(separator2);
            controls.appendChild(chatButton);

    toolbar.appendChild(title);
    toolbar.appendChild(controls);

    return toolbar;
  }

  private createButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      padding: 8px 12px;
      border: 1px solid #dadce0;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
    `;
    button.addEventListener('click', onClick);
    button.addEventListener('mouseenter', () => {
      button.style.background = '#f8f9fa';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'white';
    });
    return button;
  }

  private async loadAndRenderPDF(url: string): Promise<void> {
    if (!this.pdfjsLib) {
      console.error('PDF.js not loaded');
      return;
    }

    try {
      // Show loading indicator
      this.showLoading();

      // Process document for RAG indexing
      const processingResult = await this.documentProcessor.processDocument(url);
      this.currentDocument = processingResult.document;

      // Load the PDF for rendering
      const loadingTask = this.pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;

      // Render all pages
      await this.renderAllPages(pdf);

      // Hide loading
      this.hideLoading();

      // Setup interaction handlers
      this.setupInteractionHandlers();
      
      // Initialize text selection service
      this.textSelectionService.initialize();
      
      // Initialize chat sidebar service
      await this.chatSidebar.initialize();
      
      // Set document context for AI service
      this.chatSidebar.setDocumentContext(this.currentDocument);

      console.log('Document processed successfully:', {
        pages: this.currentDocument.pages.length,
        embeddings: processingResult.embeddings.length,
        images: processingResult.images.length
      });

    } catch (error) {
      console.error('Error loading PDF:', error);
      this.showError('Failed to load PDF. Please try again.');
    }
  }

  private async renderAllPages(pdf: any): Promise<void> {
    const pagesContainer = document.getElementById('learnsphere-pages-container');
    if (!pagesContainer) return;

    const numPages = pdf.numPages;
    let currentScale = 1.5;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });

      // Create page container
      const pageContainer = document.createElement('div');
      pageContainer.className = 'learnsphere-page';
      pageContainer.dataset.pageNumber = pageNum.toString();
      pageContainer.style.cssText = `
        background: white;
        margin: 20px auto;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        overflow: hidden;
        position: relative;
      `;

      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.cssText = `
        display: block;
        max-width: 100%;
        height: auto;
      `;

      // Render page
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      pageContainer.appendChild(canvas);

      // Extract text content
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(' ');

      // Store page data
      this.currentDocument!.pages.push({
        pageNumber: pageNum,
        text,
        images: [], // Will be populated later
        coordinates: {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height
        }
      });

      pagesContainer.appendChild(pageContainer);
    }

    // Update page info
    this.updatePageInfo(1, numPages);
  }

  private setupInteractionHandlers(): void {
    // Text selection and highlighting are now handled by TextSelectionService
    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  // Text selection and area selection are now handled by TextSelectionService

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      // Ctrl/Cmd + S to save
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        this.saveDocument();
      }
      
      // Ctrl/Cmd + F to search
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        this.openSearch();
      }
    });
  }

  private findPageElement(element: Element | Node): HTMLElement | null {
    let current = element;
    while (current && current !== document.body) {
      if (current instanceof Element && current.classList.contains('learnsphere-page')) {
        return current as HTMLElement;
      }
      current = current.parentNode!;
    }
    return null;
  }

  // Selection prompts are now handled by TextSelectionService

  private showLoading(): void {
    const loading = document.createElement('div');
    loading.id = 'learnsphere-loading';
    loading.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 12px;
    `;
    loading.innerHTML = `
      <div class="loading-spinner"></div>
      <span>Loading PDF...</span>
    `;
    document.body.appendChild(loading);
  }

  private hideLoading(): void {
    const loading = document.getElementById('learnsphere-loading');
    if (loading) {
      loading.remove();
    }
  }

  private showError(message: string): void {
    const error = document.createElement('div');
    error.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #dc3545;
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 10000;
      text-align: center;
    `;
    error.textContent = message;
    document.body.appendChild(error);

    setTimeout(() => {
      if (document.body.contains(error)) {
        error.remove();
      }
    }, 5000);
  }

  private updatePageInfo(current: number, total: number): void {
    const pageInfo = document.getElementById('page-info');
    if (pageInfo) {
      pageInfo.textContent = `${current} / ${total}`;
    }
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Zoom controls
  private zoomIn(): void {
    // TODO: Implement zoom in
    console.log('Zoom in');
  }

  private zoomOut(): void {
    // TODO: Implement zoom out
    console.log('Zoom out');
  }

  private zoomReset(): void {
    // TODO: Implement zoom reset
    console.log('Zoom reset');
  }

  // Page navigation
  private previousPage(): void {
    // TODO: Implement previous page
    console.log('Previous page');
  }

  private nextPage(): void {
    // TODO: Implement next page
    console.log('Next page');
  }

  // Additional features
  private saveDocument(): void {
    // TODO: Implement save functionality
    console.log('Save document');
  }

  private openSearch(): void {
    // TODO: Implement search functionality
    console.log('Open search');
  }

  public getCurrentDocument(): PDFDocument | null {
    return this.currentDocument;
  }
}
