import { ChatMessage, ChatSession, TextSelection, AreaSelection } from '@/types';
import { GeminiAIService } from './GeminiAIService';
import { SettingsService } from './SettingsService';
import { SummaryService } from './SummaryService';
import { SummaryGenerator, SummaryGeneratorConfig } from '@/components/SummaryGenerator';
import { QuizService } from './QuizService';
import { QuizGenerator, QuizGeneratorConfig } from '@/components/QuizGenerator';
import { QuizInterface, QuizInterfaceConfig } from '@/components/QuizInterface';

export interface ChatSidebarState {
  isOpen: boolean;
  isMinimized: boolean;
  currentSession: ChatSession | null;
  isLoading: boolean;
  error: string | null;
}

export interface ChatSidebarConfig {
  width: number;
  maxWidth: number;
  minWidth: number;
  position: 'left' | 'right';
  theme: 'light' | 'dark';
}

export class ChatSidebarService {
  private state: ChatSidebarState;
  private config: ChatSidebarConfig;
  private sidebar: HTMLElement | null = null;
  private isInitialized = false;
  private resizeObserver: ResizeObserver | null = null;
  private messageQueue: ChatMessage[] = [];
  private aiService: GeminiAIService;
  private currentSelection: TextSelection | AreaSelection | null = null;
  private settingsService: SettingsService;
  private summaryService: SummaryService;
  private summaryGenerator: SummaryGenerator;
  private quizService: QuizService;
  private quizGenerator: QuizGenerator;
  private quizInterface: QuizInterface;

  constructor() {
    this.state = {
      isOpen: false,
      isMinimized: false,
      currentSession: null,
      isLoading: false,
      error: null
    };

    this.config = {
      width: 400,
      maxWidth: 600,
      minWidth: 300,
      position: 'right',
      theme: 'light'
    };

    this.aiService = new GeminiAIService();
    this.settingsService = SettingsService.getInstance();
    this.summaryService = new SummaryService(this.aiService);
    this.quizService = new QuizService(this.aiService);
    
    const summaryConfig: SummaryGeneratorConfig = {
      containerId: 'learnsphere-summary-generator',
      onSummaryGenerated: (summary) => this.handleSummaryGenerated(summary),
      onError: (error) => this.setError(error)
    };
    
    const quizConfig: QuizGeneratorConfig = {
      containerId: 'learnsphere-quiz-generator',
      onQuizGenerated: (questions) => this.handleQuizGenerated(questions),
      onError: (error) => this.setError(error)
    };

    const quizInterfaceConfig: QuizInterfaceConfig = {
      containerId: 'learnsphere-quiz-interface',
      onQuizCompleted: (result) => this.handleQuizCompleted(result),
      onQuizClosed: () => this.handleQuizClosed()
    };
    
    this.summaryGenerator = new SummaryGenerator(summaryConfig, this.summaryService);
    this.quizGenerator = new QuizGenerator(quizConfig, this.quizService);
    this.quizInterface = new QuizInterface(quizInterfaceConfig, this.quizService);
  }

  /**
   * Get effective theme (handles 'auto' setting)
   */
  private getEffectiveTheme(theme: 'light' | 'dark' | 'auto'): 'light' | 'dark' {
    if (theme === 'auto') {
      return this.settingsService.getEffectiveTheme();
    }
    return theme;
  }

  /**
   * Initialize the chat sidebar service
   */
  public async initialize(apiKey?: string): Promise<void> {
    if (this.isInitialized) return;

    // Load settings
    const settings = this.settingsService.getAll();
    this.config = {
      ...this.config,
      position: settings.chatSidebarPosition,
      width: settings.chatSidebarWidth,
      theme: this.getEffectiveTheme(settings.theme)
    };

    this.createSidebar();
    this.setupEventListeners();
    
    // Initialize summary generator
    this.summaryGenerator.initialize();
    
    // Initialize quiz generator and interface
    this.quizGenerator.initialize();
    this.quizInterface.initialize();
    
    // Initialize AI service with stored API key or provided key
    const geminiApiKey = apiKey || settings.geminiApiKey;
    if (geminiApiKey && this.settingsService.validateApiKey(geminiApiKey)) {
      try {
        await this.aiService.initialize(geminiApiKey);
        console.log('AI service initialized successfully');
      } catch (error) {
        console.warn('Failed to initialize AI service:', error);
        this.setError('AI service not available. Please check your API key in settings.');
      }
    } else {
      console.warn('No valid Gemini API key found. AI features will be disabled.');
      this.setError('Please configure your Gemini API key in settings to enable AI features.');
    }
    
    this.isInitialized = true;
    console.log('Chat Sidebar Service initialized');
  }

  /**
   * Create the chat sidebar element
   */
  private createSidebar(): void {
    // Remove existing sidebar if any
    const existingSidebar = document.getElementById('learnsphere-chat-sidebar');
    if (existingSidebar) {
      existingSidebar.remove();
    }

    this.sidebar = document.createElement('div');
    this.sidebar.id = 'learnsphere-chat-sidebar';
    this.sidebar.className = 'learnsphere-chat-sidebar';
    this.sidebar.style.cssText = `
      position: fixed;
      top: 0;
      ${this.config.position}: 0;
      width: ${this.config.width}px;
      height: 100vh;
      background: white;
      border-left: 1px solid #e0e0e0;
      box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      transform: translateX(${this.config.position === 'right' ? '100%' : '-100%'});
      transition: transform 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    this.createSidebarHeader();
    this.createChatContainer();
    this.createInputArea();

    document.body.appendChild(this.sidebar);
  }

  /**
   * Create the sidebar header
   */
  private createSidebarHeader(): void {
    const header = document.createElement('div');
    header.className = 'chat-sidebar-header';
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
      background: #f8f9fa;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    `;

    const title = document.createElement('h2');
    title.textContent = 'LearnSphere Chat';
    title.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    `;

    const controls = document.createElement('div');
    controls.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    // Summary button
    const summaryBtn = this.createIconButton('📝', () => this.showSummaryGenerator());
    summaryBtn.title = 'Generate Summary';

    // Quiz button
    const quizBtn = this.createIconButton('🧠', () => this.showQuizGenerator());
    quizBtn.title = 'Generate Quiz';

    // Minimize button
    const minimizeBtn = this.createIconButton('−', () => this.toggleMinimize());
    minimizeBtn.title = 'Minimize';

    // Close button
    const closeBtn = this.createIconButton('×', () => this.close());
    closeBtn.title = 'Close';

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.style.cssText = `
      width: 4px;
      height: 100%;
      background: #e0e0e0;
      cursor: col-resize;
      position: absolute;
      ${this.config.position === 'right' ? 'left' : 'right'}: 0;
      top: 0;
    `;

    controls.appendChild(summaryBtn);
    controls.appendChild(quizBtn);
    controls.appendChild(minimizeBtn);
    controls.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(controls);
    this.sidebar!.appendChild(header);
    this.sidebar!.appendChild(resizeHandle);
  }

  /**
   * Create the chat messages container
   */
  private createChatContainer(): void {
    const container = document.createElement('div');
    container.id = 'chat-messages-container';
    container.className = 'chat-messages-container';
    container.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    // Add welcome message
    const welcomeMessage = this.createMessage({
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I\'m LearnSphere, your AI study assistant. Select any text or area in the PDF and ask me questions about it. I\'ll help you understand the content better!',
      timestamp: new Date()
    });

    container.appendChild(welcomeMessage);
    this.sidebar!.appendChild(container);
  }

  /**
   * Create the input area
   */
  private createInputArea(): void {
    const inputArea = document.createElement('div');
    inputArea.className = 'chat-input-area';
    inputArea.style.cssText = `
      padding: 20px;
      border-top: 1px solid #e0e0e0;
      background: white;
      flex-shrink: 0;
    `;

    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      display: flex;
      gap: 12px;
      align-items: flex-end;
    `;

    const textarea = document.createElement('textarea');
    textarea.id = 'chat-input';
    textarea.placeholder = 'Ask a question about the selected content...';
    textarea.style.cssText = `
      flex: 1;
      min-height: 40px;
      max-height: 120px;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
      outline: none;
    `;

    const sendButton = document.createElement('button');
    sendButton.textContent = 'Send';
    sendButton.style.cssText = `
      padding: 12px 20px;
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
    `;

    sendButton.addEventListener('click', () => this.sendMessage());
    sendButton.addEventListener('mouseenter', () => {
      sendButton.style.background = '#1557b0';
    });
    sendButton.addEventListener('mouseleave', () => {
      sendButton.style.background = '#1a73e8';
    });

    // Handle Enter key
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });

    inputContainer.appendChild(textarea);
    inputContainer.appendChild(sendButton);
    inputArea.appendChild(inputContainer);
    this.sidebar!.appendChild(inputArea);
  }

  /**
   * Create an icon button
   */
  private createIconButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      border-radius: 4px;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s ease;
    `;

    button.addEventListener('click', onClick);
    button.addEventListener('mouseenter', () => {
      button.style.background = '#f0f0f0';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'transparent';
    });

    return button;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Resize functionality
    this.setupResizeHandling();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + C to toggle chat
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Setup resize handling
   */
  private setupResizeHandling(): void {
    const resizeHandle = this.sidebar?.querySelector('.resize-handle') as HTMLElement;
    if (!resizeHandle) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = this.config.width;
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = this.config.position === 'right' 
        ? startX - e.clientX 
        : e.clientX - startX;
      
      const newWidth = Math.max(
        this.config.minWidth,
        Math.min(this.config.maxWidth, startWidth + deltaX)
      );

      this.config.width = newWidth;
      if (this.sidebar) {
        this.sidebar.style.width = newWidth + 'px';
      }
    };

    const handleMouseUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }

  /**
   * Open the chat sidebar
   */
  public open(): void {
    if (!this.sidebar) return;

    this.state.isOpen = true;
    this.sidebar.style.transform = 'translateX(0)';
    
    // Focus on input
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (input) {
      input.focus();
    }
  }

  /**
   * Close the chat sidebar
   */
  public close(): void {
    if (!this.sidebar) return;

    this.state.isOpen = false;
    const translateX = this.config.position === 'right' ? '100%' : '-100%';
    this.sidebar.style.transform = `translateX(${translateX})`;
  }

  /**
   * Toggle the chat sidebar
   */
  public toggle(): void {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Toggle minimize state
   */
  public toggleMinimize(): void {
    this.state.isMinimized = !this.state.isMinimized;
    
    if (this.state.isMinimized) {
      this.sidebar!.style.height = '60px';
      this.sidebar!.style.overflow = 'hidden';
    } else {
      this.sidebar!.style.height = '100vh';
      this.sidebar!.style.overflow = 'visible';
    }
  }

  /**
   * Send a message
   */
  public async sendMessage(): Promise<void> {
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!input || !input.value.trim()) return;

    const messageText = input.value.trim();
    input.value = '';
    input.style.height = 'auto';

    // Create user message
    const userMessage: ChatMessage = {
      id: this.generateMessageId(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    this.addMessage(userMessage);

    // Show loading state
    this.setLoading(true);

    try {
      // Get AI response using RAG
      const aiResponse = await this.aiService.generateRAGResponse(messageText, this.currentSelection || undefined);
      
      const assistantMessage: ChatMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };

      this.addMessage(assistantMessage);
    } catch (error) {
      console.error('Error getting AI response:', error);
      this.setError('Failed to get response. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Set document context for AI service
   */
  public setDocumentContext(document: any): void {
    this.aiService.setDocumentContext(document);
    this.summaryService.setDocument(document);
    this.quizService.setDocument(document);
  }

  /**
   * Set current selection for context
   */
  public setCurrentSelection(selection: TextSelection | AreaSelection | null): void {
    this.currentSelection = selection;
  }

  /**
   * Initialize AI service with API key
   */
  public async initializeAI(apiKey: string): Promise<void> {
    try {
      await this.aiService.initialize(apiKey);
      console.log('AI service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      throw error;
    }
  }

  /**
   * Get AI service status
   */
  public getAIStatus(): any {
    return this.aiService.getStatus();
  }

  /**
   * Show summary generator
   */
  public showSummaryGenerator(): void {
    this.summaryGenerator.show();
  }

  /**
   * Show quiz generator
   */
  public showQuizGenerator(): void {
    this.quizGenerator.show();
  }

  /**
   * Handle summary generated
   */
  private handleSummaryGenerated(summary: any): void {
    // Add summary to chat as a special message
    const summaryMessage: ChatMessage = {
      id: `summary_${Date.now()}`,
      role: 'assistant',
      content: this.formatSummaryForChat(summary),
      timestamp: new Date()
    };

    this.addMessage(summaryMessage);
  }

  /**
   * Handle quiz generated
   */
  private handleQuizGenerated(questions: any[]): void {
    // Start the quiz interface
    this.quizInterface.startQuiz(questions, {
      difficulty: 'medium',
      questionCount: questions.length
    });
  }

  /**
   * Handle quiz completed
   */
  private handleQuizCompleted(result: any): void {
    // Add quiz results to chat
    const quizMessage: ChatMessage = {
      id: `quiz_${Date.now()}`,
      role: 'assistant',
      content: this.formatQuizResultsForChat(result),
      timestamp: new Date()
    };

    this.addMessage(quizMessage);
  }

  /**
   * Handle quiz closed
   */
  private handleQuizClosed(): void {
    // Quiz interface was closed
    console.log('Quiz interface closed');
  }

  /**
   * Format summary for chat display
   */
  private formatSummaryForChat(summary: any): string {
    let content = `📝 **Summary Generated**\n\n`;
    content += `**Scope:** ${summary.metadata.scope}\n`;
    content += `**Style:** ${summary.metadata.style}\n`;
    content += `**Word Count:** ${summary.metadata.wordCount}\n\n`;
    
    content += `**Content:**\n${summary.content}\n\n`;
    
    if (summary.keyPoints && summary.keyPoints.length > 0) {
      content += `**Key Points:**\n`;
      summary.keyPoints.forEach((point: string, index: number) => {
        content += `${index + 1}. ${point}\n`;
      });
      content += '\n';
    }
    
    if (summary.definitions && summary.definitions.length > 0) {
      content += `**Definitions:**\n`;
      summary.definitions.forEach((def: any) => {
        content += `• **${def.term}:** ${def.definition}\n`;
      });
    }
    
    return content;
  }

  /**
   * Format quiz results for chat display
   */
  private formatQuizResultsForChat(result: any): string {
    let content = `🧠 **Quiz Results**\n\n`;
    content += `**Score:** ${result.score.toFixed(1)}%\n`;
    content += `**Correct Answers:** ${result.correctAnswers}/${result.totalQuestions}\n`;
    content += `**Time Spent:** ${result.timeSpent.toFixed(1)}s\n`;
    content += `**Average Time per Question:** ${result.averageTimePerQuestion.toFixed(1)}s\n`;
    content += `**Difficulty:** ${result.difficulty}\n\n`;
    
    content += `**Performance:** ${this.getQuizPerformanceMessage(result.score)}\n\n`;
    
    content += `**Question Results:**\n`;
    result.questionResults.forEach((qResult: any, index: number) => {
      const status = qResult.isCorrect ? '✓' : '✗';
      content += `${index + 1}. ${status} (${qResult.timeSpent.toFixed(1)}s)\n`;
    });
    
    return content;
  }

  /**
   * Get quiz performance message
   */
  private getQuizPerformanceMessage(score: number): string {
    if (score >= 90) return 'Excellent! You have a strong understanding of this material.';
    if (score >= 80) return 'Great job! You have a good grasp of the concepts.';
    if (score >= 70) return 'Good work! You understand most of the material.';
    if (score >= 60) return 'Not bad! Consider reviewing some areas for improvement.';
    return 'Keep studying! Review the material and try again.';
  }

  /**
   * Add a message to the chat
   */
  public addMessage(message: ChatMessage): void {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    const messageElement = this.createMessage(message);
    container.appendChild(messageElement);
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Create a message element
   */
  private createMessage(message: ChatMessage): HTMLElement {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${message.role}`;
    messageDiv.style.cssText = `
      display: flex;
      gap: 12px;
      align-items: flex-start;
      animation: messageSlideIn 0.3s ease;
    `;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      flex-shrink: 0;
    `;

    if (message.role === 'user') {
      avatar.textContent = '👤';
      avatar.style.background = '#1a73e8';
      avatar.style.color = 'white';
    } else {
      avatar.textContent = '🤖';
      avatar.style.background = '#f0f0f0';
      avatar.style.color = '#333';
    }

    const content = document.createElement('div');
    content.className = 'message-content';
    content.style.cssText = `
      flex: 1;
      background: ${message.role === 'user' ? '#1a73e8' : '#f8f9fa'};
      color: ${message.role === 'user' ? 'white' : '#333'};
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    `;
    content.textContent = message.content;

    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.style.cssText = `
      font-size: 11px;
      color: #999;
      margin-top: 4px;
      text-align: ${message.role === 'user' ? 'right' : 'left'};
    `;
    timestamp.textContent = this.formatTimestamp(message.timestamp);

    content.appendChild(timestamp);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    return messageDiv;
  }

  /**
   * Set loading state
   */
  private setLoading(loading: boolean): void {
    this.state.isLoading = loading;
    
    const sendButton = this.sidebar?.querySelector('button') as HTMLButtonElement;
    if (sendButton) {
      if (loading) {
        sendButton.textContent = '...';
        sendButton.disabled = true;
      } else {
        sendButton.textContent = 'Send';
        sendButton.disabled = false;
      }
    }
  }

  /**
   * Set error state
   */
  private setError(error: string): void {
    this.state.error = error;
    
    const errorMessage: ChatMessage = {
      id: this.generateMessageId(),
      role: 'assistant',
      content: `❌ ${error}`,
      timestamp: new Date()
    };

    this.addMessage(errorMessage);
  }

  /**
   * Open chat with selection context
   */
  public openWithSelection(selection: TextSelection | AreaSelection): void {
    this.open();
    this.setCurrentSelection(selection);
    
    // Pre-fill input with context
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (input) {
      if ('text' in selection) {
        input.placeholder = `Ask about: "${selection.text.substring(0, 50)}${selection.text.length > 50 ? '...' : ''}"`;
      } else {
        input.placeholder = 'Ask about the selected area...';
      }
      input.focus();
    }
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format timestamp
   */
  private formatTimestamp(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Get current state
   */
  public getState(): ChatSidebarState {
    return { ...this.state };
  }

  /**
   * Get configuration
   */
  public getConfig(): ChatSidebarConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ChatSidebarConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.sidebar) {
      this.sidebar.style.width = this.config.width + 'px';
      this.sidebar.style[this.config.position] = '0';
    }
  }

  /**
   * Clear chat history
   */
  public clearHistory(): void {
    const container = document.getElementById('chat-messages-container');
    if (container) {
      container.innerHTML = '';
      
      // Add welcome message back
      const welcomeMessage = this.createMessage({
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! I\'m LearnSphere, your AI study assistant. Select any text or area in the PDF and ask me questions about it. I\'ll help you understand the content better!',
        timestamp: new Date()
      });
      
      container.appendChild(welcomeMessage);
    }
  }
}
