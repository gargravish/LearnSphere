import { ChatMessage, TextSelection, AreaSelection, PDFDocument } from '@/types';

export interface GeminiConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  safetySettings: SafetySetting[];
}

export interface SafetySetting {
  category: string;
  threshold: string;
}

export interface GeminiRequest {
  contents: Array<{
    role: string;
    parts: Array<{
      text?: string;
      inlineData?: {
        mimeType: string;
        data: string;
      };
    }>;
  }>;
  generationConfig?: {
    temperature: number;
    topK: number;
    topP: number;
    maxOutputTokens: number;
    stopSequences: string[];
  };
  safetySettings?: SafetySetting[];
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  promptFeedback?: {
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  };
}

export interface RAGContext {
  document: PDFDocument;
  relevantText: string[];
  selectedContent?: TextSelection | AreaSelection;
  chatHistory: ChatMessage[];
}

export interface AIPromptTemplate {
  system: string;
  user: string;
  assistant: string;
}

export class GeminiAIService {
  private config: GeminiConfig;
  private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models';
  private isInitialized = false;
  private conversationHistory: ChatMessage[] = [];
  private documentContext: PDFDocument | null = null;

  constructor(config?: Partial<GeminiConfig>) {
    this.config = {
      apiKey: '',
      model: 'gemini-1.5-flash',
      maxTokens: 2048,
      temperature: 0.7,
      topP: 0.8,
      topK: 40,
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
      ],
      ...config
    };
  }

  /**
   * Initialize the Gemini AI service
   */
  public async initialize(apiKey?: string): Promise<void> {
    if (this.isInitialized) return;

    if (apiKey) {
      this.config.apiKey = apiKey;
    }

    if (!this.config.apiKey) {
      throw new Error('Gemini API key is required. Please provide it in the configuration.');
    }

    // Test the connection
    await this.testConnection();
    
    this.isInitialized = true;
    console.log('Gemini AI Service initialized successfully');
  }

  /**
   * Test the connection to Gemini API
   */
  private async testConnection(): Promise<void> {
    try {
      const testRequest: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: 'Hello, this is a test message.' }]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.1,
          maxOutputTokens: 10,
          stopSequences: []
        }
      };

      const response = await this.makeRequest(testRequest);
      
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('Invalid response from Gemini API');
      }

      console.log('Gemini API connection test successful');
    } catch (error) {
      console.error('Gemini API connection test failed:', error);
      throw new Error(`Failed to connect to Gemini API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set the current document context for RAG
   */
  public setDocumentContext(document: PDFDocument): void {
    this.documentContext = document;
    console.log('Document context set for RAG:', document.title);
  }

  /**
   * Clear the current document context
   */
  public clearDocumentContext(): void {
    this.documentContext = null;
    this.conversationHistory = [];
    console.log('Document context cleared');
  }

  /**
   * Add message to conversation history
   */
  public addToHistory(message: ChatMessage): void {
    this.conversationHistory.push(message);
    
    // Keep only last 20 messages to prevent context overflow
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }

  /**
   * Get relevant context from document based on user query
   */
  private async getRelevantContext(query: string, selection?: TextSelection | AreaSelection): Promise<string[]> {
    if (!this.documentContext) {
      return [];
    }

    const relevantText: string[] = [];

    // If there's a specific selection, prioritize it
    if (selection) {
      if ('text' in selection) {
        relevantText.push(`Selected text: "${selection.text}"`);
      } else {
        relevantText.push(`Selected area on page ${selection.pageNumber}`);
      }
    }

    // Search through document pages for relevant content
    for (const page of this.documentContext.pages) {
      if (page.text) {
        // Simple keyword matching (can be enhanced with embeddings later)
        const queryWords = query.toLowerCase().split(' ');
        const pageWords = page.text.toLowerCase().split(' ');
        
        const matches = queryWords.filter(word => 
          pageWords.some(pageWord => pageWord.includes(word))
        );

        if (matches.length > 0) {
          // Extract relevant sentences around matches
          const sentences = page.text.split(/[.!?]+/);
          const relevantSentences = sentences.filter(sentence => 
            queryWords.some(word => sentence.toLowerCase().includes(word))
          );

          if (relevantSentences.length > 0) {
            relevantText.push(`Page ${page.pageNumber}: ${relevantSentences.slice(0, 3).join('. ')}`);
          }
        }
      }
    }

    return relevantText.slice(0, 5); // Limit to 5 most relevant pieces
  }

  /**
   * Generate a response using RAG (Retrieval Augmented Generation)
   */
  public async generateRAGResponse(
    userMessage: string, 
    selection?: TextSelection | AreaSelection
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Gemini AI Service not initialized');
    }

    try {
      // Get relevant context from document
      const relevantContext = await this.getRelevantContext(userMessage, selection);
      
      // Build the prompt with context
      const prompt = this.buildRAGPrompt(userMessage, relevantContext, selection);
      
      // Create the request
      const request: GeminiRequest = {
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: this.config.temperature,
          topK: this.config.topK,
          topP: this.config.topP,
          maxOutputTokens: this.config.maxTokens,
          stopSequences: []
        },
        safetySettings: this.config.safetySettings
      };

      // Make the request
      const response = await this.makeRequest(request);
      
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response generated from Gemini API');
      }

      const generatedText = response.candidates[0].content.parts[0].text;
      
      // Add to conversation history
      this.addToHistory({
        id: `msg_${Date.now()}`,
        role: 'user',
        content: userMessage,
        timestamp: new Date()
      });

      this.addToHistory({
        id: `msg_${Date.now()}_ai`,
        role: 'assistant',
        content: generatedText,
        timestamp: new Date()
      });

      return generatedText;

    } catch (error) {
      console.error('Error generating RAG response:', error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a response using RAG with optional multimodal clipboard inputs
   */
  public async generateRAGResponseMultimodal(
    userMessage: string,
    opts: {
      imageBlob?: Blob;
      pastedText?: string;
      selection?: TextSelection | AreaSelection;
    }
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Gemini AI Service not initialized');
    }

    const { imageBlob, pastedText, selection } = opts;

    // Build parts array for Gemini: text prompt + optional inlineData image + optional pasted text
    const relevantContext = await this.getRelevantContext(userMessage, selection);
    const prompt = this.buildRAGPrompt(userMessage, relevantContext, selection);

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    parts.push({ text: prompt });

    if (pastedText && pastedText.trim()) {
      parts.push({ text: `\n\nAdditional pasted text context provided by user:\n${pastedText.trim()}` });
    }

    if (imageBlob) {
      const base64 = await this.blobToBase64(imageBlob);
      const mimeType = imageBlob.type || 'image/png';
      parts.push({ inlineData: { mimeType, data: base64 } });
    }

    const request: GeminiRequest = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: this.config.temperature,
        topK: this.config.topK,
        topP: this.config.topP,
        maxOutputTokens: this.config.maxTokens,
        stopSequences: []
      },
      safetySettings: this.config.safetySettings
    };

    const response = await this.makeRequest(request);
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No response generated from Gemini API');
    }
    const generatedText = response.candidates[0].content.parts[0].text;

    this.addToHistory({ id: `msg_${Date.now()}`, role: 'user', content: userMessage, timestamp: new Date() });
    this.addToHistory({ id: `msg_${Date.now()}_ai`, role: 'assistant', content: generatedText, timestamp: new Date() });
    return generatedText;
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        const idx = res.indexOf(',');
        resolve(idx >= 0 ? res.slice(idx + 1) : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Build RAG prompt with context
   */
  private buildRAGPrompt(
    userMessage: string, 
    relevantContext: string[], 
    selection?: TextSelection | AreaSelection
  ): string {
    const systemPrompt = `You are LearnSphere, an AI study assistant designed to help students understand PDF documents. You have access to the document content and should provide helpful, educational responses based on the context provided.

Key guidelines:
- Always base your responses on the document content provided
- Be educational and helpful, explaining concepts clearly
- If the user asks about something not in the document, acknowledge this and suggest they look elsewhere
- Use a friendly, encouraging tone
- Keep responses concise but informative
- If asked about specific text or areas, reference them directly`;

    let contextSection = '';
    
    if (relevantContext.length > 0) {
      contextSection = `\n\nRelevant document context:\n${relevantContext.join('\n\n')}`;
    }

    let selectionContext = '';
    if (selection) {
      if ('text' in selection) {
        selectionContext = `\n\nUser has selected this text: "${selection.text}"`;
      } else {
        selectionContext = `\n\nUser has selected an area on page ${selection.pageNumber}`;
      }
    }

    const conversationHistory = this.conversationHistory
      .slice(-6) // Last 6 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const historySection = conversationHistory ? `\n\nRecent conversation:\n${conversationHistory}` : '';

    return `${systemPrompt}${contextSection}${selectionContext}${historySection}

User: ${userMessage}
LearnSphere:`;
  }

  /**
   * Generate a summary of the document
   */
  public async generateSummary(scope: 'page' | 'chapter' | 'document' = 'document'): Promise<string> {
    if (!this.documentContext) {
      throw new Error('No document context available');
    }

    const prompt = this.buildSummaryPrompt(scope);
    
    const request: GeminiRequest = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 20,
        topP: 0.8,
        maxOutputTokens: 1000,
        stopSequences: []
      }
    };

    try {
      const response = await this.makeRequest(request);
      return response.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build summary prompt
   */
  private buildSummaryPrompt(scope: 'page' | 'chapter' | 'document'): string {
    if (!this.documentContext) {
      throw new Error('No document context available');
    }

    let content = '';
    let instruction = '';

    switch (scope) {
      case 'page':
        // For now, summarize the first page (can be enhanced to accept page number)
        content = this.documentContext.pages[0]?.text || '';
        instruction = 'Provide a concise summary of this page, highlighting the key points and main concepts.';
        break;
      
      case 'chapter':
        // For now, summarize first few pages as "chapter" (can be enhanced with chapter detection)
        content = this.documentContext.pages.slice(0, 5).map(p => p.text).join('\n\n');
        instruction = 'Provide a comprehensive summary of this chapter, organizing the key concepts and main ideas.';
        break;
      
      case 'document':
        content = this.documentContext.pages.map(p => p.text).join('\n\n');
        instruction = 'Provide a comprehensive summary of this document, highlighting the main topics, key concepts, and overall structure.';
        break;
    }

    return `You are an expert at summarizing educational content. ${instruction}

Document content:
${content}

Summary:`;
  }

  /**
   * Generate quiz questions based on document content
   */
  public async generateQuizQuestions(
    count: number = 5, 
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ): Promise<Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>> {
    if (!this.documentContext) {
      throw new Error('No document context available');
    }

    const content = this.documentContext.pages.map(p => p.text).join('\n\n');
    const prompt = `Generate ${count} multiple choice questions based on the following document content. The questions should be ${difficulty} difficulty level.

Requirements:
- Each question should have 4 options (A, B, C, D)
- Only one correct answer per question
- Include explanations for the correct answer
- Questions should test understanding, not just memorization
- Make distractors plausible but clearly incorrect

Document content:
${content}

Please format your response as a JSON array with the following structure:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Explanation of why this is correct"
  }
]`;

    const request: GeminiRequest = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 2000,
        stopSequences: []
      }
    };

    try {
      const response = await this.makeRequest(request);
      const responseText = response.candidates[0].content.parts[0].text;
      
      // Try to parse JSON response
      try {
        const questions = JSON.parse(responseText);
        return questions;
      } catch (parseError) {
        console.warn('Failed to parse quiz questions as JSON, returning raw response');
        return [{
          question: 'Failed to generate structured quiz questions',
          options: ['Please try again'],
          correctAnswer: 0,
          explanation: responseText
        }];
      }
    } catch (error) {
      console.error('Error generating quiz questions:', error);
      throw new Error(`Failed to generate quiz questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make request to Gemini API
   */
  private async makeRequest(request: GeminiRequest): Promise<GeminiResponse> {
    const url = `${this.baseUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<GeminiConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): GeminiConfig {
    return { ...this.config };
  }

  /**
   * Get conversation history
   */
  public getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  public clearConversationHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get service status
   */
  public getStatus(): {
    initialized: boolean;
    hasApiKey: boolean;
    hasDocumentContext: boolean;
    conversationLength: number;
  } {
    return {
      initialized: this.isInitialized,
      hasApiKey: !!this.config.apiKey,
      hasDocumentContext: !!this.documentContext,
      conversationLength: this.conversationHistory.length
    };
  }
}
