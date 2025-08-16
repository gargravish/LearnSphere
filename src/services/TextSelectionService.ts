import { TextSelection, AreaSelection } from '@/types';
import { ChatSidebarService } from './ChatSidebarService';

export interface SelectionRange {
  startContainer: Node;
  startOffset: number;
  endContainer: Node;
  endOffset: number;
}

export interface HighlightedText {
  id: string;
  text: string;
  pageNumber: number;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  color: string;
  timestamp: Date;
  notes?: string;
}

export interface SelectionState {
  isSelecting: boolean;
  startX: number;
  startY: number;
  currentSelection: TextSelection | AreaSelection | null;
  highlights: HighlightedText[];
}

export class TextSelectionService {
  private state: SelectionState;
  private selectionBox: HTMLElement | null = null;
  private highlightLayer: HTMLElement | null = null;
  private chatSidebar: ChatSidebarService;
  private isInitialized = false;

  constructor() {
    this.state = {
      isSelecting: false,
      startX: 0,
      startY: 0,
      currentSelection: null,
      highlights: []
    };
    this.chatSidebar = new ChatSidebarService();
  }

  /**
   * Initialize the text selection service
   */
  public initialize(): void {
    if (this.isInitialized) return;

    this.createHighlightLayer();
    this.setupEventListeners();
    this.chatSidebar.initialize();
    this.isInitialized = true;
    console.log('Text Selection Service initialized');
  }

  /**
   * Create a layer for highlighting text
   */
  private createHighlightLayer(): void {
    // Remove existing layer if any
    const existingLayer = document.getElementById('learnsphere-highlight-layer');
    if (existingLayer) {
      existingLayer.remove();
    }

    this.highlightLayer = document.createElement('div');
    this.highlightLayer.id = 'learnsphere-highlight-layer';
    this.highlightLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
    `;

    document.body.appendChild(this.highlightLayer);
  }

  /**
   * Setup event listeners for text selection
   */
  private setupEventListeners(): void {
    // Text selection events
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Keyboard events for area selection
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Selection change events
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
    
    // Context menu for selection actions
    document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
  }

  /**
   * Handle mouse down events
   */
  private handleMouseDown(event: MouseEvent): void {
    // Check if we're on a PDF page
    const pageElement = this.findPageElement(event.target as Element);
    if (!pageElement) return;

    // Start text selection
    this.state.isSelecting = true;
    this.state.startX = event.clientX;
    this.state.startY = event.clientY;

    // Clear any existing selection
    window.getSelection()?.removeAllRanges();
  }

  /**
   * Handle mouse move events
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.state.isSelecting) return;

    // Update selection box for area selection (Alt key)
    if (event.altKey) {
      this.updateSelectionBox(event);
    }
  }

  /**
   * Handle mouse up events
   */
  private handleMouseUp(event: MouseEvent): void {
    if (!this.state.isSelecting) return;

    this.state.isSelecting = false;

    // Handle area selection (Alt key)
    if (event.altKey) {
      this.handleAreaSelection(event);
    } else {
      // Handle text selection
      this.handleTextSelection();
    }

    // Clean up selection box
    this.removeSelectionBox();
  }

  /**
   * Handle key down events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Ctrl/Cmd + A for select all
    if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
      event.preventDefault();
      this.selectAllText();
    }

    // Escape to clear selection
    if (event.key === 'Escape') {
      this.clearSelection();
    }
  }

  /**
   * Handle key up events
   */
  private handleKeyUp(event: KeyboardEvent): void {
    // Handle Alt key release
    if (event.key === 'Alt') {
      this.removeSelectionBox();
    }
  }

  /**
   * Handle selection change events
   */
  private handleSelectionChange(): void {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      this.showSelectionToolbar();
    } else {
      this.hideSelectionToolbar();
    }
  }

  /**
   * Handle context menu events
   */
  private handleContextMenu(event: MouseEvent): void {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      event.preventDefault();
      this.showContextMenu(event);
    }
  }

  /**
   * Handle text selection
   */
  private handleTextSelection(): void {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const pageElement = this.findPageElement(range.startContainer as Element);
    
    if (!pageElement) return;

    const pageNumber = parseInt(pageElement.dataset.pageNumber || '1');
    
    const textSelection: TextSelection = {
      text: selection.toString(),
      pageNumber,
      coordinates: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      }
    };

    this.state.currentSelection = textSelection;
    this.highlightText(textSelection);
    this.showSelectionPrompt(textSelection);
  }

  /**
   * Handle area selection
   */
  private handleAreaSelection(event: MouseEvent): void {
    if (!this.selectionBox) return;

    const rect = this.selectionBox.getBoundingClientRect();
    const pageElement = this.findPageElement(event.target as Element);
    
    if (!pageElement) return;

    const pageNumber = parseInt(pageElement.dataset.pageNumber || '1');
    
    const areaSelection: AreaSelection = {
      pageNumber,
      coordinates: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      },
      type: 'image' // Default type, can be refined
    };

    this.state.currentSelection = areaSelection;
    this.showSelectionPrompt(areaSelection);
  }

  /**
   * Update selection box for area selection
   */
  private updateSelectionBox(event: MouseEvent): void {
    if (!this.selectionBox) {
      this.createSelectionBox();
    }

    if (this.selectionBox) {
      const currentX = event.clientX;
      const currentY = event.clientY;
      
      const left = Math.min(this.state.startX, currentX);
      const top = Math.min(this.state.startY, currentY);
      const width = Math.abs(currentX - this.state.startX);
      const height = Math.abs(currentY - this.state.startY);
      
      this.selectionBox.style.left = left + 'px';
      this.selectionBox.style.top = top + 'px';
      this.selectionBox.style.width = width + 'px';
      this.selectionBox.style.height = height + 'px';
    }
  }

  /**
   * Create selection box for area selection
   */
  private createSelectionBox(): void {
    this.selectionBox = document.createElement('div');
    this.selectionBox.className = 'learnsphere-selection-box';
    this.selectionBox.style.cssText = `
      position: fixed;
      border: 2px dashed #1a73e8;
      background: rgba(26, 115, 232, 0.1);
      pointer-events: none;
      z-index: 10000;
    `;
    document.body.appendChild(this.selectionBox);
  }

  /**
   * Remove selection box
   */
  private removeSelectionBox(): void {
    if (this.selectionBox) {
      document.body.removeChild(this.selectionBox);
      this.selectionBox = null;
    }
  }

  /**
   * Highlight selected text
   */
  private highlightText(selection: TextSelection): void {
    const highlight: HighlightedText = {
      id: this.generateHighlightId(),
      text: selection.text,
      pageNumber: selection.pageNumber,
      coordinates: selection.coordinates,
      color: this.getNextHighlightColor(),
      timestamp: new Date()
    };

    this.state.highlights.push(highlight);
    this.renderHighlight(highlight);
  }

  /**
   * Render a highlight on the page
   */
  private renderHighlight(highlight: HighlightedText): void {
    if (!this.highlightLayer) return;

    const highlightElement = document.createElement('div');
    highlightElement.className = 'learnsphere-highlight';
    highlightElement.dataset.highlightId = highlight.id;
    highlightElement.style.cssText = `
      position: absolute;
      left: ${highlight.coordinates.x}px;
      top: ${highlight.coordinates.y}px;
      width: ${highlight.coordinates.width}px;
      height: ${highlight.coordinates.height}px;
      background: ${highlight.color};
      opacity: 0.3;
      pointer-events: none;
      border-radius: 2px;
    `;

    this.highlightLayer.appendChild(highlightElement);
  }

  /**
   * Show selection prompt
   */
  private showSelectionPrompt(selection: TextSelection | AreaSelection): void {
    const prompt = document.createElement('div');
    prompt.className = 'learnsphere-selection-prompt';
    prompt.style.cssText = `
      position: fixed;
      top: ${selection.coordinates.y - 40}px;
      left: ${selection.coordinates.x}px;
      background: #1a73e8;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      z-index: 10001;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    prompt.innerHTML = `
      <span>Ask LearnSphere</span>
      <button class="highlight-btn" style="background: none; border: none; color: white; cursor: pointer; font-size: 12px;">📝</button>
      <button class="note-btn" style="background: none; border: none; color: white; cursor: pointer; font-size: 12px;">📌</button>
    `;
    
    // Add event listeners
    prompt.addEventListener('click', (e) => {
      if ((e.target as Element).classList.contains('highlight-btn')) {
        this.toggleHighlight(selection);
      } else if ((e.target as Element).classList.contains('note-btn')) {
        this.addNote(selection);
      } else {
        this.openChat(selection);
      }
    });

    document.body.appendChild(prompt);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(prompt)) {
        document.body.removeChild(prompt);
      }
    }, 5000);
  }

  /**
   * Show selection toolbar
   */
  private showSelectionToolbar(): void {
    // Remove existing toolbar
    this.hideSelectionToolbar();

    const toolbar = document.createElement('div');
    toolbar.id = 'learnsphere-selection-toolbar';
    toolbar.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 8px;
      display: flex;
      gap: 8px;
      z-index: 10002;
      font-size: 14px;
    `;

    const selection = window.getSelection();
    if (selection) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      toolbar.style.left = rect.left + 'px';
      toolbar.style.top = (rect.top - 50) + 'px';
    }

    toolbar.innerHTML = `
      <button class="toolbar-btn highlight-btn" style="padding: 4px 8px; border: none; background: #f0f0f0; border-radius: 4px; cursor: pointer;">📝 Highlight</button>
      <button class="toolbar-btn note-btn" style="padding: 4px 8px; border: none; background: #f0f0f0; border-radius: 4px; cursor: pointer;">📌 Note</button>
      <button class="toolbar-btn chat-btn" style="padding: 4px 8px; border: none; background: #1a73e8; color: white; border-radius: 4px; cursor: pointer;">💬 Ask</button>
    `;

    // Add event listeners
    toolbar.addEventListener('click', (e) => {
      const target = e.target as Element;
      if (target.classList.contains('highlight-btn')) {
        this.toggleHighlight(this.state.currentSelection!);
      } else if (target.classList.contains('note-btn')) {
        this.addNote(this.state.currentSelection!);
      } else if (target.classList.contains('chat-btn')) {
        this.openChat(this.state.currentSelection!);
      }
    });

    document.body.appendChild(toolbar);
  }

  /**
   * Hide selection toolbar
   */
  private hideSelectionToolbar(): void {
    const toolbar = document.getElementById('learnsphere-selection-toolbar');
    if (toolbar) {
      toolbar.remove();
    }
  }

  /**
   * Show context menu
   */
  private showContextMenu(event: MouseEvent): void {
    const menu = document.createElement('div');
    menu.className = 'learnsphere-context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${event.clientX}px;
      top: ${event.clientY}px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 4px 0;
      z-index: 10003;
      font-size: 14px;
      min-width: 150px;
    `;

    menu.innerHTML = `
      <div class="menu-item" style="padding: 8px 12px; cursor: pointer; hover: background: #f5f5f5;">📝 Highlight</div>
      <div class="menu-item" style="padding: 8px 12px; cursor: pointer; hover: background: #f5f5f5;">📌 Add Note</div>
      <div class="menu-item" style="padding: 8px 12px; cursor: pointer; hover: background: #f5f5f5;">💬 Ask LearnSphere</div>
      <div class="menu-separator" style="height: 1px; background: #e0e0e0; margin: 4px 0;"></div>
      <div class="menu-item" style="padding: 8px 12px; cursor: pointer; hover: background: #f5f5f5;">📋 Copy</div>
    `;

    // Add event listeners
    menu.addEventListener('click', (e) => {
      const target = e.target as Element;
      if (target.classList.contains('menu-item')) {
        const text = target.textContent;
        if (text?.includes('Highlight')) {
          this.toggleHighlight(this.state.currentSelection!);
        } else if (text?.includes('Note')) {
          this.addNote(this.state.currentSelection!);
        } else if (text?.includes('Ask')) {
          this.openChat(this.state.currentSelection!);
        } else if (text?.includes('Copy')) {
          this.copySelection();
        }
      }
      document.body.removeChild(menu);
    });

    document.body.appendChild(menu);

    // Close menu when clicking outside
    setTimeout(() => {
      const closeMenu = () => {
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
        document.removeEventListener('click', closeMenu);
      };
      document.addEventListener('click', closeMenu);
    }, 100);
  }

  /**
   * Toggle highlight for selection
   */
  private toggleHighlight(selection: TextSelection | AreaSelection): void {
    if ('text' in selection) {
      // Text selection
      const existingHighlight = this.state.highlights.find(h => 
        h.text === selection.text && h.pageNumber === selection.pageNumber
      );

      if (existingHighlight) {
        this.removeHighlight(existingHighlight.id);
      } else {
        this.highlightText(selection);
      }
    }
  }

  /**
   * Remove highlight
   */
  private removeHighlight(highlightId: string): void {
    this.state.highlights = this.state.highlights.filter(h => h.id !== highlightId);
    
    const highlightElement = document.querySelector(`[data-highlight-id="${highlightId}"]`);
    if (highlightElement) {
      highlightElement.remove();
    }
  }

  /**
   * Add note to selection
   */
  private addNote(selection: TextSelection | AreaSelection): void {
    const note = prompt('Add a note for this selection:');
    if (note) {
      const highlight = this.state.highlights.find(h => 
        'text' in selection ? h.text === selection.text : true
      );
      
      if (highlight) {
        highlight.notes = note;
      }
    }
  }

  /**
   * Open chat with selection
   */
  private openChat(selection: TextSelection | AreaSelection): void {
    this.chatSidebar.setCurrentSelection(selection);
    this.chatSidebar.openWithSelection(selection);
  }

  /**
   * Copy selection to clipboard
   */
  private copySelection(): void {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      navigator.clipboard.writeText(selection.toString()).then(() => {
        this.showToast('Text copied to clipboard');
      });
    }
  }

  /**
   * Select all text on current page
   */
  private selectAllText(): void {
    const pageElement = document.querySelector('.learnsphere-page');
    if (pageElement) {
      const range = document.createRange();
      range.selectNodeContents(pageElement);
      
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  /**
   * Clear current selection
   */
  private clearSelection(): void {
    window.getSelection()?.removeAllRanges();
    this.hideSelectionToolbar();
    this.state.currentSelection = null;
  }

  /**
   * Find page element containing the target
   */
  private findPageElement(element: Element | null): HTMLElement | null {
    let current = element;
    while (current && current !== document.body) {
      if (current.classList.contains('learnsphere-page')) {
        return current as HTMLElement;
      }
      current = current.parentElement;
    }
    return null;
  }

  /**
   * Generate highlight ID
   */
  private generateHighlightId(): string {
    return `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get next highlight color
   */
  private getNextHighlightColor(): string {
    const colors = [
      '#ffeb3b', // Yellow
      '#4caf50', // Green
      '#2196f3', // Blue
      '#ff9800', // Orange
      '#e91e63', // Pink
      '#9c27b0', // Purple
      '#00bcd4', // Cyan
      '#ff5722'  // Red
    ];
    
    const index = this.state.highlights.length % colors.length;
    return colors[index];
  }

  /**
   * Show toast notification
   */
  private showToast(message: string): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      z-index: 10004;
      font-size: 14px;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
  }

  /**
   * Get current selection state
   */
  public getSelectionState(): SelectionState {
    return { ...this.state };
  }

  /**
   * Get all highlights
   */
  public getHighlights(): HighlightedText[] {
    return [...this.state.highlights];
  }

  /**
   * Clear all highlights
   */
  public clearAllHighlights(): void {
    this.state.highlights = [];
    if (this.highlightLayer) {
      this.highlightLayer.innerHTML = '';
    }
  }

  /**
   * Export highlights
   */
  public exportHighlights(): string {
    return JSON.stringify(this.state.highlights, null, 2);
  }

  /**
   * Import highlights
   */
  public importHighlights(highlightsJson: string): void {
    try {
      const highlights = JSON.parse(highlightsJson) as HighlightedText[];
      this.state.highlights = highlights;
      
      // Re-render highlights
      if (this.highlightLayer) {
        this.highlightLayer.innerHTML = '';
        highlights.forEach(highlight => this.renderHighlight(highlight));
      }
    } catch (error) {
      console.error('Failed to import highlights:', error);
    }
  }
}
