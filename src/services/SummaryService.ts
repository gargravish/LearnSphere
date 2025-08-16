import { PDFDocument, PDFPage, Summary } from '@/types';
import { GeminiAIService } from './GeminiAIService';

export interface SummaryOptions {
  scope: 'page' | 'chapter' | 'document' | 'selection';
  style: 'brief' | 'detailed' | 'bullet-points' | 'academic';
  includeKeyPoints: boolean;
  includeDefinitions: boolean;
  maxLength: number;
  language: string;
}

export interface SummaryResult {
  id: string;
  content: string;
  keyPoints?: string[];
  definitions?: Array<{ term: string; definition: string }>;
  metadata: {
    scope: SummaryOptions['scope'];
    style: SummaryOptions['style'];
    pageNumbers: number[];
    wordCount: number;
    generatedAt: Date;
    processingTime: number;
  };
}

export interface ChapterInfo {
  startPage: number;
  endPage: number;
  title: string;
  content: string;
}

export class SummaryService {
  private aiService: GeminiAIService;
  private currentDocument: PDFDocument | null = null;
  private chapterCache: Map<number, ChapterInfo> = new Map();

  constructor(aiService: GeminiAIService) {
    this.aiService = aiService;
  }

  /**
   * Set the current document for summary generation
   */
  public setDocument(document: PDFDocument): void {
    this.currentDocument = document;
    this.chapterCache.clear(); // Clear cache when document changes
    console.log('Document set for summary service:', document.title);
  }

  /**
   * Generate a summary based on the provided options
   */
  public async generateSummary(
    options: SummaryOptions,
    selectionText?: string
  ): Promise<SummaryResult> {
    if (!this.currentDocument) {
      throw new Error('No document available for summary generation');
    }

    const startTime = Date.now();
    const summaryId = `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      let content = '';
      let pageNumbers: number[] = [];

      // Get content based on scope
      switch (options.scope) {
        case 'page':
          content = await this.getPageContent(1); // Current page (can be enhanced to accept page number)
          pageNumbers = [1];
          break;
        
        case 'chapter':
          const chapterContent = await this.getChapterContent(1); // First chapter
          content = chapterContent.content;
          pageNumbers = Array.from(
            { length: chapterContent.endPage - chapterContent.startPage + 1 },
            (_, i) => chapterContent.startPage + i
          );
          break;
        
        case 'document':
          content = this.currentDocument.pages.map(p => p.text).join('\n\n');
          pageNumbers = this.currentDocument.pages.map(p => p.pageNumber);
          break;
        
        case 'selection':
          if (!selectionText) {
            throw new Error('Selection text is required for selection-based summary');
          }
          content = selectionText;
          pageNumbers = [1]; // Default to page 1 for selections
          break;
      }

      // Generate the summary using AI
      const summaryContent = await this.generateSummaryContent(content, options);
      
      // Extract key points and definitions if requested
      const keyPoints = options.includeKeyPoints ? 
        await this.extractKeyPoints(content, options) : undefined;
      
      const definitions = options.includeDefinitions ? 
        await this.extractDefinitions(content, options) : undefined;

      const processingTime = Date.now() - startTime;

      const result: SummaryResult = {
        id: summaryId,
        content: summaryContent,
        keyPoints,
        definitions,
        metadata: {
          scope: options.scope,
          style: options.style,
          pageNumbers,
          wordCount: this.countWords(summaryContent),
          generatedAt: new Date(),
          processingTime
        }
      };

      return result;

    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate summary content using AI
   */
  private async generateSummaryContent(content: string, options: SummaryOptions): Promise<string> {
    const prompt = this.buildSummaryPrompt(content, options);
    
    try {
      const response = await this.aiService.generateRAGResponse(prompt);
      return response;
    } catch (error) {
      console.error('Error generating summary content:', error);
      throw new Error('Failed to generate summary content');
    }
  }

  /**
   * Build summary prompt based on options
   */
  private buildSummaryPrompt(content: string, options: SummaryOptions): string {
    const styleInstructions = this.getStyleInstructions(options.style);
    const lengthConstraint = this.getLengthConstraint(options.maxLength);
    
    return `You are an expert at creating educational summaries. Please create a ${options.style} summary of the following content.

${styleInstructions}

${lengthConstraint}

Content to summarize:
${content}

Please provide a clear, well-structured summary that captures the main ideas and key concepts.`;
  }

  /**
   * Get style-specific instructions
   */
  private getStyleInstructions(style: SummaryOptions['style']): string {
    switch (style) {
      case 'brief':
        return 'Create a concise summary focusing on the most important points. Keep it short and to the point.';
      
      case 'detailed':
        return 'Create a comprehensive summary that covers all major topics and provides thorough explanations.';
      
      case 'bullet-points':
        return 'Create a summary in bullet-point format, organizing information clearly and hierarchically.';
      
      case 'academic':
        return 'Create an academic-style summary with formal language, proper structure, and scholarly tone.';
      
      default:
        return 'Create a clear and informative summary.';
    }
  }

  /**
   * Get length constraint based on maxLength
   */
  private getLengthConstraint(maxLength: number): string {
    if (maxLength <= 100) {
      return 'Keep the summary very brief, under 100 words.';
    } else if (maxLength <= 300) {
      return 'Keep the summary concise, under 300 words.';
    } else if (maxLength <= 500) {
      return 'Keep the summary moderate in length, under 500 words.';
    } else {
      return 'The summary can be comprehensive but should not exceed 1000 words.';
    }
  }

  /**
   * Extract key points from content
   */
  private async extractKeyPoints(content: string, options: SummaryOptions): Promise<string[]> {
    const prompt = `Extract the 5-7 most important key points from the following content. Present them as a numbered list.

Content:
${content}

Key Points:`;

    try {
      const response = await this.aiService.generateRAGResponse(prompt);
      return this.parseKeyPoints(response);
    } catch (error) {
      console.error('Error extracting key points:', error);
      return [];
    }
  }

  /**
   * Parse key points from AI response
   */
  private parseKeyPoints(response: string): string[] {
    const lines = response.split('\n');
    const keyPoints: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^\d+\.\s/) || trimmed.match(/^[-*]\s/)) {
        const point = trimmed.replace(/^\d+\.\s/, '').replace(/^[-*]\s/, '');
        if (point.length > 0) {
          keyPoints.push(point);
        }
      }
    }
    
    return keyPoints.slice(0, 7); // Limit to 7 key points
  }

  /**
   * Extract definitions from content
   */
  private async extractDefinitions(content: string, options: SummaryOptions): Promise<Array<{ term: string; definition: string }>> {
    const prompt = `Extract important terms and their definitions from the following content. Present them in this format:
Term: Definition

Content:
${content}

Terms and Definitions:`;

    try {
      const response = await this.aiService.generateRAGResponse(prompt);
      return this.parseDefinitions(response);
    } catch (error) {
      console.error('Error extracting definitions:', error);
      return [];
    }
  }

  /**
   * Parse definitions from AI response
   */
  private parseDefinitions(response: string): Array<{ term: string; definition: string }> {
    const definitions: Array<{ term: string; definition: string }> = [];
    const lines = response.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes(':')) {
        const [term, ...definitionParts] = line.split(':');
        if (definitionParts.length > 0) {
          const definition = definitionParts.join(':').trim();
          if (term.trim() && definition) {
            definitions.push({
              term: term.trim(),
              definition: definition
            });
          }
        }
      }
    }
    
    return definitions.slice(0, 10); // Limit to 10 definitions
  }

  /**
   * Get content for a specific page
   */
  private async getPageContent(pageNumber: number): Promise<string> {
    if (!this.currentDocument) {
      throw new Error('No document available');
    }

    const page = this.currentDocument.pages.find(p => p.pageNumber === pageNumber);
    if (!page) {
      throw new Error(`Page ${pageNumber} not found`);
    }

    return page.text || '';
  }

  /**
   * Get content for a chapter (pages 1-5 for now, can be enhanced with chapter detection)
   */
  private async getChapterContent(chapterNumber: number): Promise<ChapterInfo> {
    if (!this.currentDocument) {
      throw new Error('No document available');
    }

    // For now, treat first 5 pages as first chapter
    // This can be enhanced with proper chapter detection
    const startPage = 1;
    const endPage = Math.min(5, this.currentDocument.pages.length);
    
    const content = this.currentDocument.pages
      .filter(p => p.pageNumber >= startPage && p.pageNumber <= endPage)
      .map(p => p.text)
      .join('\n\n');

    return {
      startPage,
      endPage,
      title: `Chapter ${chapterNumber}`,
      content
    };
  }

  /**
   * Detect chapters in the document (basic implementation)
   */
  public async detectChapters(): Promise<ChapterInfo[]> {
    if (!this.currentDocument) {
      throw new Error('No document available');
    }

    const chapters: ChapterInfo[] = [];
    const pages = this.currentDocument.pages;

    // Simple chapter detection based on page breaks and content patterns
    // This can be enhanced with more sophisticated detection
    let currentChapter = 1;
    let chapterStart = 1;
    let chapterContent = '';

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      chapterContent += page.text + '\n\n';

      // Simple heuristic: new chapter every 5 pages or if page has chapter-like content
      if ((i + 1) % 5 === 0 || this.isChapterStart(page.text)) {
        chapters.push({
          startPage: chapterStart,
          endPage: page.pageNumber,
          title: `Chapter ${currentChapter}`,
          content: chapterContent.trim()
        });

        currentChapter++;
        chapterStart = page.pageNumber + 1;
        chapterContent = '';
      }
    }

    // Add remaining content as last chapter
    if (chapterContent.trim()) {
      chapters.push({
        startPage: chapterStart,
        endPage: pages[pages.length - 1].pageNumber,
        title: `Chapter ${currentChapter}`,
        content: chapterContent.trim()
      });
    }

    return chapters;
  }

  /**
   * Check if page content suggests a chapter start
   */
  private isChapterStart(pageText: string): boolean {
    const chapterPatterns = [
      /^chapter\s+\d+/i,
      /^section\s+\d+/i,
      /^\d+\.\s+[A-Z]/,
      /^[A-Z][A-Z\s]+$/m
    ];

    return chapterPatterns.some(pattern => pattern.test(pageText));
  }

  /**
   * Generate a comparative summary of multiple sections
   */
  public async generateComparativeSummary(
    sections: Array<{ title: string; content: string }>,
    options: SummaryOptions
  ): Promise<SummaryResult> {
    const combinedContent = sections.map(s => `${s.title}:\n${s.content}`).join('\n\n');
    
    const prompt = `Create a comparative summary of the following sections, highlighting similarities, differences, and relationships between them.

${this.getStyleInstructions(options.style)}

${this.getLengthConstraint(options.maxLength)}

Sections:
${combinedContent}

Comparative Summary:`;

    try {
      const response = await this.aiService.generateRAGResponse(prompt);
      
      return {
        id: `comparative_${Date.now()}`,
        content: response,
        metadata: {
          scope: 'document',
          style: options.style,
          pageNumbers: [],
          wordCount: this.countWords(response),
          generatedAt: new Date(),
          processingTime: 0
        }
      };
    } catch (error) {
      console.error('Error generating comparative summary:', error);
      throw new Error('Failed to generate comparative summary');
    }
  }

  /**
   * Export summary to different formats
   */
  public exportSummary(summary: SummaryResult, format: 'text' | 'markdown' | 'json'): string {
    switch (format) {
      case 'text':
        return this.exportAsText(summary);
      
      case 'markdown':
        return this.exportAsMarkdown(summary);
      
      case 'json':
        return this.exportAsJSON(summary);
      
      default:
        return this.exportAsText(summary);
    }
  }

  /**
   * Export summary as plain text
   */
  private exportAsText(summary: SummaryResult): string {
    let text = `SUMMARY\n`;
    text += `Generated: ${summary.metadata.generatedAt.toLocaleString()}\n`;
    text += `Scope: ${summary.metadata.scope}\n`;
    text += `Style: ${summary.metadata.style}\n`;
    text += `Word Count: ${summary.metadata.wordCount}\n\n`;
    
    text += `CONTENT\n${summary.content}\n\n`;
    
    if (summary.keyPoints && summary.keyPoints.length > 0) {
      text += `KEY POINTS\n`;
      summary.keyPoints.forEach((point, index) => {
        text += `${index + 1}. ${point}\n`;
      });
      text += '\n';
    }
    
    if (summary.definitions && summary.definitions.length > 0) {
      text += `DEFINITIONS\n`;
      summary.definitions.forEach(def => {
        text += `${def.term}: ${def.definition}\n`;
      });
    }
    
    return text;
  }

  /**
   * Export summary as markdown
   */
  private exportAsMarkdown(summary: SummaryResult): string {
    let markdown = `# Summary\n\n`;
    markdown += `**Generated:** ${summary.metadata.generatedAt.toLocaleString()}\n`;
    markdown += `**Scope:** ${summary.metadata.scope}\n`;
    markdown += `**Style:** ${summary.metadata.style}\n`;
    markdown += `**Word Count:** ${summary.metadata.wordCount}\n\n`;
    
    markdown += `## Content\n\n${summary.content}\n\n`;
    
    if (summary.keyPoints && summary.keyPoints.length > 0) {
      markdown += `## Key Points\n\n`;
      summary.keyPoints.forEach((point, index) => {
        markdown += `${index + 1}. ${point}\n`;
      });
      markdown += '\n';
    }
    
    if (summary.definitions && summary.definitions.length > 0) {
      markdown += `## Definitions\n\n`;
      summary.definitions.forEach(def => {
        markdown += `**${def.term}:** ${def.definition}\n\n`;
      });
    }
    
    return markdown;
  }

  /**
   * Export summary as JSON
   */
  private exportAsJSON(summary: SummaryResult): string {
    return JSON.stringify(summary, null, 2);
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Get available summary scopes for the current document
   */
  public getAvailableScopes(): Array<{ value: string; label: string; description: string }> {
    if (!this.currentDocument) {
      return [];
    }

    const scopes = [
      {
        value: 'page',
        label: 'Current Page',
        description: 'Summarize the current page only'
      },
      {
        value: 'chapter',
        label: 'Current Chapter',
        description: 'Summarize the current chapter or section'
      },
      {
        value: 'document',
        label: 'Entire Document',
        description: 'Summarize the complete document'
      },
      {
        value: 'selection',
        label: 'Selected Text',
        description: 'Summarize only the selected text'
      }
    ];

    return scopes;
  }

  /**
   * Get available summary styles
   */
  public getAvailableStyles(): Array<{ value: string; label: string; description: string }> {
    return [
      {
        value: 'brief',
        label: 'Brief',
        description: 'Concise summary focusing on key points'
      },
      {
        value: 'detailed',
        label: 'Detailed',
        description: 'Comprehensive summary with thorough explanations'
      },
      {
        value: 'bullet-points',
        label: 'Bullet Points',
        description: 'Organized summary in bullet-point format'
      },
      {
        value: 'academic',
        label: 'Academic',
        description: 'Formal academic-style summary'
      }
    ];
  }
}
