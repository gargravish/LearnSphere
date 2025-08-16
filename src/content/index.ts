import './content.css';
import { PDFViewerService } from '../services/PDFViewerService';
import { SettingsService } from '../services/SettingsService';
import { TextSelection, AreaSelection } from '../types';

// Immediate verification that content script is loading
console.log('🚀 LearnSphere: Content script file loaded successfully!');
console.log('🚀 LearnSphere: Current URL:', window.location.href);
console.log('🚀 LearnSphere: Document ready state:', document.readyState);

class LearnSphereContent {
  private sidebar: HTMLDivElement | null = null;
  private pdfViewerService!: PDFViewerService;
  private settingsService!: SettingsService;
  private isExtensionActive: boolean = false;
  private lastMouseDownPosition: { x: number; y: number } | null = null;

  constructor() {
    console.log('LearnSphere: Content script constructor called');
    console.log('LearnSphere: Current URL:', window.location.href);
    console.log('LearnSphere: Document ready state:', document.readyState);
    
    // Always initialize services and add manual activation button
    this.pdfViewerService = new PDFViewerService();
    this.settingsService = SettingsService.getInstance();
    
    // Always add a manual activation button for debugging
    this.addManualActivationButton();
    
    // Initialize immediately if DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        console.log('LearnSphere: DOMContentLoaded, initializing...');
        this.init();
      });
    } else {
      console.log('LearnSphere: DOM already ready, initializing...');
      this.init();
    }
    
    // Also try to initialize after a short delay to ensure everything is loaded
    setTimeout(() => {
      console.log('LearnSphere: Delayed initialization (1s)...');
      this.init();
    }, 1000);
    
    // And after a longer delay for slow-loading PDFs
    setTimeout(() => {
      console.log('LearnSphere: Final delayed initialization (3s)...');
      this.init();
    }, 3000);
    
    // Listen for window load event
    window.addEventListener('load', () => {
      console.log('LearnSphere: Window loaded, initializing...');
      this.init();
    });
  }

  private addManualActivationButton() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.createManualButton());
    } else {
      this.createManualButton();
    }
  }

  private createManualButton() {
    const existingButton = document.getElementById('learnsphere-manual-activate');
    if (existingButton) return;

    const button = document.createElement('div');
    button.id = 'learnsphere-manual-activate';
    button.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: linear-gradient(135deg, #ff6b6b, #ee5a24);
      color: white;
      padding: 12px 20px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      z-index: 10003;
      box-shadow: 0 4px 16px rgba(255, 107, 107, 0.4);
      border: 2px solid #ffffff;
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    button.innerHTML = '🚀 Activate LearnSphere';
    
    button.addEventListener('click', () => {
      console.log('LearnSphere: Manual activation button clicked');
      this.manualActivate();
    });
    
    document.body.appendChild(button);
    console.log('LearnSphere: Manual activation button added');
    
    // Remove button after 30 seconds
    setTimeout(() => {
      if (button.parentNode) {
        button.parentNode.removeChild(button);
        console.log('LearnSphere: Manual activation button removed');
      }
    }, 30000);
  }

  private async init() {
    console.log('LearnSphere: Init method called');

    try {
      // Check if we're on a PDF page
      const isPDF = this.isPDFPage();
      console.log('LearnSphere: Is PDF page:', isPDF);

      if (isPDF) {
        console.log('LearnSphere: PDF page detected, setting up PDF-specific features...');

        // Initialize PDF-specific features
        await this.initializeSettings();
        this.setupMessageListener();

        // Check if extension should be active
        await this.checkExistingExtensionState();

        console.log('LearnSphere: PDF initialization complete');
      } else {
        console.log('LearnSphere: Not a PDF page, setting up basic features...');

        // Initialize basic features for non-PDF pages
        this.setupMessageListener();

        console.log('LearnSphere: Basic initialization complete');
      }

      // Always show the manual activation button
      this.createManualButton();

    } catch (error) {
      console.error('LearnSphere: Error during initialization:', error);
    }
  }

  private initializeSettings() {
    // Apply current settings to the page
    this.settingsService.applySettingsToPage();
    
    // Check if extension should already be active (e.g., if API key exists and is valid)
    this.checkExistingExtensionState();
    
    // Listen for settings changes
    this.settingsService.addChangeListener((settings) => {
      console.log('LearnSphere: Settings updated, applying to page');
      this.settingsService.applySettingsToPage();
    });
  }

  private async checkExistingExtensionState() {
    try {
      const apiKey = this.settingsService.getGeminiApiKey();
      if (apiKey && this.settingsService.validateApiKey(apiKey)) {
        // Test the API key to see if it's working
        const testResult = await this.settingsService.testApiKey(apiKey);
        if (testResult.valid) {
          // Extension should be active, activate it
          this.isExtensionActive = true;
          this.enableTextSelection();
          console.log('LearnSphere: Extension automatically activated on page load');
        }
      }
    } catch (error) {
      console.log('LearnSphere: Could not check existing extension state:', error);
    }
  }

  private isPDFPage(): boolean {
    const url = window.location.href.toLowerCase();
    const contentType = document.contentType || '';
    const hasPDFElements = !!(
      document.querySelector('embed[type="application/pdf"]') ||
      document.querySelector('object[type="application/pdf"]') ||
      document.querySelector('iframe[src*=".pdf"]') ||
      document.querySelector('canvas[data-pdf-url]')
    );
    
    // Check for PDF in various ways
    const isPDF = 
      url.includes('.pdf') || 
      url.includes('application/pdf') ||
      contentType.includes('pdf') ||
      hasPDFElements ||
      document.title.toLowerCase().includes('pdf') ||
      window.location.pathname.toLowerCase().includes('.pdf');
    
    console.log('LearnSphere: PDF detection details:');
    console.log('  - URL:', url);
    console.log('  - Content type:', contentType);
    console.log('  - Has PDF elements:', hasPDFElements);
    console.log('  - Document title:', document.title);
    console.log('  - Pathname:', window.location.pathname);
    console.log('  - Is PDF page:', isPDF);
    
    return isPDF;
  }

  private async setupPDFViewer() {
    // Use the PDF viewer service to handle all PDF viewing scenarios
    await this.pdfViewerService.overrideChromePDFViewer();
  }

  // Selection methods are now handled by the PDFViewerService

  private openSidebar(selection?: TextSelection | AreaSelection, mode?: string) {
    if (!this.sidebar) {
      this.createSidebar();
    }
    
    if (selection) {
      // Pass selection context to sidebar
      this.sidebar!.dataset.selection = JSON.stringify(selection);
    }
    
    if (mode) {
      // Pass mode to sidebar
      this.sidebar!.dataset.mode = mode;
    }
    
    this.sidebar!.style.right = '0';
  }

  private createSidebar() {
    this.sidebar = document.createElement('div');
    this.sidebar.id = 'learnsphere-sidebar';
    this.sidebar.style.cssText = `
      position: fixed;
      top: 0;
      right: -400px;
      width: 400px;
      height: 100vh;
      background: white;
      border-left: 1px solid #e0e0e0;
      z-index: 10000;
      transition: right 0.3s ease;
      box-shadow: -2px 0 8px rgba(0,0,0,0.1);
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    const title = document.createElement('h2');
    title.textContent = 'LearnSphere Chat';
    title.style.margin = '0';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
    `;
    closeBtn.addEventListener('click', () => {
      this.sidebar!.style.right = '-400px';
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    this.sidebar.appendChild(header);

    const chatContainer = document.createElement('div');
    chatContainer.id = 'learnsphere-chat';
    chatContainer.style.cssText = `
      flex: 1;
      padding: 16px;
      overflow-y: auto;
    `;
    this.sidebar.appendChild(chatContainer);

    document.body.appendChild(this.sidebar);
  }

  // PDF processing is now handled by the PDFViewerService

  private setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('🚀 LearnSphere: Content script received message:', message);
      
      switch (message.action) {
        case 'ping':
          console.log('🚀 LearnSphere: Ping received, responding...');
          sendResponse({ success: true, message: 'Content script is ready!' });
          break;
          
        case 'showNotification':
          console.log('🚀 LearnSphere: Showing notification:', message.message);
          this.showNotification(message.message, 'success');
          sendResponse({ success: true });
          break;
          
        case 'activateExtension':
          console.log('🚀 LearnSphere: Activating extension with API key');
          this.activateExtension(message.apiKey);
          sendResponse({ success: true });
          break;
          
        case 'showReadyMessage':
          console.log('🚀 LearnSphere: Showing ready message:', message.message);
          this.showReadyMessage(message.message);
          sendResponse({ success: true });
          break;
          
        case 'checkExtensionStatus':
          console.log('🚀 LearnSphere: Checking extension status');
          sendResponse({ active: this.isExtensionActive });
          break;
          
        case 'contextMenuAction':
          console.log('🚀 LearnSphere: Handling context menu action:', message.type);
          this.handleContextMenuAction(message);
          sendResponse({ success: true });
          break;
          
        default:
          console.log('🚀 LearnSphere: Unknown message action:', message.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });
  }

  private handleContextMenuAction(message: any) {
    const { type, text } = message;
    
    switch (type) {
      case 'chat':
        this.openSidebar({
          text: text,
          pageNumber: 1,
          coordinates: { x: 0, y: 0, width: 0, height: 0 }
        });
        break;

      case 'summarize':
        this.openSidebar({
          text: text,
          pageNumber: 1,
          coordinates: { x: 0, y: 0, width: 0, height: 0 }
        }, 'summarize');
        break;

      case 'quiz':
        this.openSidebar({
          text: text,
          pageNumber: 1,
          coordinates: { x: 0, y: 0, width: 0, height: 0 }
        }, 'quiz');
        break;

      case 'explain':
        this.openSidebar({
          text: text,
          pageNumber: 1,
          coordinates: { x: 0, y: 0, width: 0, height: 0 }
        }, 'explain');
        break;

      case 'pageSummary':
        this.getPageText().then(pageText => {
          this.openSidebar({
            text: pageText,
            pageNumber: 1,
            coordinates: { x: 0, y: 0, width: 0, height: 0 }
          }, 'pageSummary');
        });
        break;

      case 'pageQuiz':
        this.getPageText().then(pageText => {
          this.openSidebar({
            text: pageText,
            pageNumber: 1,
            coordinates: { x: 0, y: 0, width: 0, height: 0 }
          }, 'pageQuiz');
        });
        break;

      default:
        console.error('LearnSphere: Unknown context menu action type:', type);
    }
  }

  private async getPageText(): Promise<string> {
    // Extract text from the current page
    const textElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');
    let pageText = '';
    
    textElements.forEach(element => {
      const text = element.textContent?.trim();
      if (text && text.length > 10) { // Only include substantial text
        pageText += text + '\n\n';
      }
    });
    
    return pageText.trim() || 'No text content found on this page.';
  }

  private async generateSummary() {
    const currentDocument = this.pdfViewerService.getCurrentDocument();
    if (!currentDocument) {
      console.error('No document loaded');
      return;
    }

    // TODO: Implement summary generation
    console.log('Generating summary for document:', currentDocument.title);
  }

  private async generateQuiz() {
    const currentDocument = this.pdfViewerService.getCurrentDocument();
    if (!currentDocument) {
      console.error('No document loaded');
      return;
    }

    // TODO: Implement quiz generation
    console.log('Generating quiz for document:', currentDocument.title);
  }

  private activateExtension(apiKey: string) {
    console.log('LearnSphere: Extension activated with API key');
    
    // Store the API key for use in the content script
    this.settingsService.setGeminiApiKey(apiKey);
    
    // Mark extension as active
    this.isExtensionActive = true;
    
    // Show a visual indicator that the extension is active
    this.showExtensionActiveIndicator();
    
    // Enable text selection and highlighting
    this.enableTextSelection();
    
    // Send response back to popup
    return { success: true, message: 'Extension activated successfully' };
  }

  private showReadyMessage(message: string) {
    // Show a temporary notification that the extension is ready
    this.showNotification(message, 'success');
  }

  private showExtensionActiveIndicator() {
    // Create a more prominent indicator that the extension is active
    const indicator = document.createElement('div');
    indicator.id = 'learnsphere-active-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #4caf50, #45a049);
      color: white;
      padding: 12px 20px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 600;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
      animation: slideIn 0.5s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    indicator.innerHTML = `
      <span style="font-size: 18px;">🚀</span>
      <span>LearnSphere Active</span>
      <span style="font-size: 12px; opacity: 0.8;">Ready to use!</span>
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(indicator);
    
    // Add a test button to manually test text selection
    const testButton = document.createElement('button');
    testButton.textContent = '🧪 Test Text Selection';
    testButton.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: #ff9800;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      cursor: pointer;
      z-index: 10001;
      box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
    `;
    
    testButton.addEventListener('click', () => {
      console.log('LearnSphere: Test button clicked, checking text selection...');
      this.checkForTextSelection();
      
      // Show a test message instead of creating a fake selection
      this.showNotification('Test button clicked! Try selecting some text in the PDF.');
    });
    
    document.body.appendChild(testButton);
    
    // Remove indicator after 5 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.style.animation = 'slideOut 0.5s ease';
        indicator.style.transform = 'translateX(100%)';
        indicator.style.opacity = '0';
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 500);
      }
      
      // Remove test button after indicator is gone
      if (testButton.parentNode) {
        testButton.parentNode.removeChild(testButton);
      }
    }, 5000);
    
    // Add slideOut animation
    const slideOutStyle = document.createElement('style');
    slideOutStyle.textContent = `
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(slideOutStyle);
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const notification = document.createElement('div');
    notification.id = 'learnsphere-notification';
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      max-width: 300px;
      z-index: 10001;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  private enableTextSelection() {
    console.log('LearnSphere: Enabling text selection...');
    
    // Remove any existing listeners first
    document.removeEventListener('mouseup', this.handleTextSelection.bind(this));
    document.removeEventListener('keyup', this.handleTextSelection.bind(this));
    document.removeEventListener('selectionchange', this.handleSelectionChange.bind(this));
    
    // Add multiple event listeners for better coverage
    document.addEventListener('mouseup', this.handleTextSelection.bind(this), true);
    document.addEventListener('keyup', this.handleTextSelection.bind(this), true);
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this), true);
    
    // Also listen for mouse events that might indicate text selection
    document.addEventListener('mousedown', this.handleMouseDown.bind(this), true);
    
    console.log('LearnSphere: Text selection events bound successfully');
  }

  private handleMouseDown(event: MouseEvent) {
    // Store the mouse down position for potential text selection
    this.lastMouseDownPosition = { x: event.clientX, y: event.clientY };
  }

  private handleTextSelection(event: Event) {
    console.log('LearnSphere: Text selection event triggered:', event.type);
    this.checkForTextSelection();
  }

  private handleSelectionChange(event: Event) {
    console.log('LearnSphere: Selection change event triggered');
    this.checkForTextSelection();
  }

  private checkForTextSelection() {
    const selection = window.getSelection();
    console.log('LearnSphere: Checking for text selection...');
    console.log('LearnSphere: Selection object:', selection);
    
    if (selection) {
      console.log('LearnSphere: Selection range count:', selection.rangeCount);
      console.log('LearnSphere: Selection text:', selection.toString());
      
      if (selection.rangeCount > 0 && selection.toString().trim().length > 0) {
        console.log('LearnSphere: Valid text selection found, showing button...');
        this.showSelectionActionButton(selection);
      } else {
        console.log('LearnSphere: No valid text selection found');
      }
    } else {
      console.log('LearnSphere: No selection object available');
    }
  }

  private showSelectionActionButton(selection: Selection) {
    console.log('LearnSphere: Creating selection action button...');
    
    // Remove existing button if any
    const existingButton = document.getElementById('learnsphere-selection-button');
    if (existingButton) {
      existingButton.remove();
    }
    
    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      console.log('LearnSphere: Selection rectangle:', rect);
      
      // Calculate button position - ensure it's visible
      const buttonTop = Math.max(10, rect.top - 60); // At least 10px from top
      const buttonLeft = Math.max(10, Math.min(window.innerWidth - 200, rect.left + rect.width / 2)); // Ensure it's within viewport
      
      const button = document.createElement('div');
      button.id = 'learnsphere-selection-button';
      button.style.cssText = `
        position: fixed;
        top: ${buttonTop}px;
        left: ${buttonLeft}px;
        background: linear-gradient(135deg, #1a73e8, #0d47a1);
        color: white;
        padding: 12px 20px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        z-index: 10002;
        box-shadow: 0 4px 16px rgba(26, 115, 232, 0.4);
        transform: translateX(-50%);
        animation: fadeIn 0.3s ease;
        border: 2px solid #ffffff;
        white-space: nowrap;
        user-select: none;
      `;
      button.innerHTML = `
        <span style="font-size: 16px; margin-right: 8px;">💬</span>
        <span>Chat about this</span>
      `;
      
      // Add CSS animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(style);
      
      button.addEventListener('click', () => {
        console.log('LearnSphere: Chat button clicked!');
        const selectedText = selection.toString().trim();
        console.log('LearnSphere: Selected text:', selectedText);
        
        this.openSidebar({ 
          text: selectedText, 
          pageNumber: 1, // Default to page 1 for now
          coordinates: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          }
        });
        button.remove();
      });
      
      // Add hover effects
      button.addEventListener('mouseenter', () => {
        button.style.background = 'linear-gradient(135deg, #0d47a1, #1a73e8)';
        button.style.transform = 'translateX(-50%) scale(1.05)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.background = 'linear-gradient(135deg, #1a73e8, #0d47a1)';
        button.style.transform = 'translateX(-50%) scale(1)';
      });
      
      document.body.appendChild(button);
      console.log('LearnSphere: Selection button created and added to DOM');
      
      // Remove button when selection changes or after timeout
      const removeButton = () => {
        if (button.parentNode) {
          button.parentNode.removeChild(button);
          console.log('LearnSphere: Selection button removed');
        }
      };
      
      // Remove button after 8 seconds
      setTimeout(removeButton, 8000);
      
      // Also remove button when selection changes
      const selectionObserver = () => {
        const currentSelection = window.getSelection();
        if (!currentSelection || currentSelection.toString().trim().length === 0) {
          removeButton();
          document.removeEventListener('selectionchange', selectionObserver);
        }
      };
      document.addEventListener('selectionchange', selectionObserver);
      
    } catch (error) {
      console.error('LearnSphere: Error creating selection button:', error);
    }
  }

  private async manualActivate() {
    try {
      console.log('LearnSphere: Manual activation started');
      
      // Initialize services if not already done
      if (!this.pdfViewerService) {
        this.pdfViewerService = new PDFViewerService();
      }
      if (!this.settingsService) {
        this.settingsService = SettingsService.getInstance();
      }
      
      // Check if we have a valid API key
      const apiKey = this.settingsService.getGeminiApiKey();
      if (apiKey && this.settingsService.validateApiKey(apiKey)) {
        console.log('LearnSphere: Valid API key found, activating extension');
        this.activateExtension(apiKey);
        this.showNotification('Extension activated successfully!', 'success');
      } else {
        console.log('LearnSphere: No valid API key, opening settings');
        this.showNotification('No valid API key found. Opening settings...', 'info');
        chrome.runtime.openOptionsPage();
      }
    } catch (error) {
      console.error('LearnSphere: Manual activation failed:', error);
      this.showNotification('Manual activation failed. Check console for details.', 'error');
    }
  }
}

// Initialize the content script
new LearnSphereContent();