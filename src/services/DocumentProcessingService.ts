import { PDFDocument, PDFPage, TextSelection, AreaSelection } from '@/types';
import { OCRService } from './OCRService';

export interface ProcessedContent {
  text: string;
  images: ImageData[];
  metadata: {
    pageNumber: number;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    confidence?: number;
  };
}

export interface ImageData {
  dataUrl: string;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type: 'image' | 'diagram' | 'chart' | 'equation';
  confidence: number;
}

export interface EmbeddingData {
  text: string;
  embedding: number[];
  metadata: {
    pageNumber: number;
    startIndex: number;
    endIndex: number;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

export class DocumentProcessingService {
  private pdfjsLib: any = null;
  private vertexAI: any = null;
  private ocrService: OCRService;
  private embeddingsCache: Map<string, EmbeddingData[]> = new Map();

  constructor() {
    this.ocrService = new OCRService();
    this.init();
  }

  private async init() {
    await this.loadPDFJS();
    await this.initVertexAI();
    await this.ocrService.initializeWorker();
  }

  private async loadPDFJS(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).pdfjsLib) {
        this.pdfjsLib = (window as any).pdfjsLib;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        this.pdfjsLib = (window as any).pdfjsLib;
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

  private async initVertexAI(): Promise<void> {
    // TODO: Initialize Vertex AI client
    // This will be implemented when we add the actual Vertex AI integration
    console.log('Vertex AI initialization placeholder');
  }

  /**
   * Process a PDF document and extract all content for RAG indexing
   */
  public async processDocument(pdfUrl: string): Promise<{
    document: PDFDocument;
    embeddings: EmbeddingData[];
    images: ImageData[];
  }> {
    if (!this.pdfjsLib) {
      throw new Error('PDF.js not loaded');
    }

    try {
      // Load the PDF
      const loadingTask = this.pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;

      // Create document object
      const document: PDFDocument = {
        id: this.generateDocumentId(),
        title: pdf.info?.Title || 'Untitled Document',
        url: pdfUrl,
        pages: [],
        metadata: {
          author: pdf.info?.Author,
          subject: pdf.info?.Subject,
          keywords: pdf.info?.Keywords?.split(',').map((k: string) => k.trim()),
          creationDate: pdf.info?.CreationDate,
          modificationDate: pdf.info?.ModDate
        }
      };

      const allEmbeddings: EmbeddingData[] = [];
      const allImages: ImageData[] = [];

      // Process each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const processedContent = await this.processPage(page, pageNum);
        
        // Add page to document
        document.pages.push({
          pageNumber: pageNum,
          text: processedContent.text,
          images: processedContent.images.map(img => ({
            src: img.dataUrl,
            alt: `${img.type} on page ${pageNum}`,
            coordinates: img.coordinates
          })),
          coordinates: processedContent.metadata.coordinates
        });

        // Generate embeddings for text chunks
        const pageEmbeddings = await this.generateEmbeddings(
          processedContent.text,
          pageNum,
          processedContent.metadata.coordinates
        );
        allEmbeddings.push(...pageEmbeddings);

        // Add images
        allImages.push(...processedContent.images);
      }

      // Cache embeddings for this document
      this.embeddingsCache.set(document.id, allEmbeddings);

      return {
        document,
        embeddings: allEmbeddings,
        images: allImages
      };

    } catch (error) {
      console.error('Error processing document:', error);
      throw new Error(`Failed to process document: ${error}`);
    }
  }

  /**
   * Process a single PDF page and extract text and images
   */
  private async processPage(page: any, pageNumber: number): Promise<ProcessedContent> {
    const viewport = page.getViewport({ scale: 1.0 });
    
    // Extract text content
    const textContent = await page.getTextContent();
    const text = this.extractTextFromContent(textContent);
    
    // Extract images and other visual elements
    const images = await this.extractImages(page, viewport);
    
    // Perform OCR if text extraction is poor
    let ocrText = '';
    if (text.trim().length < 50) { // Low text content, might be scanned
      ocrText = await this.performOCR(page, viewport);
    }

    const finalText = text + (ocrText ? '\n' + ocrText : '');

    return {
      text: finalText,
      images,
      metadata: {
        pageNumber,
        coordinates: {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height
        },
        confidence: this.calculateConfidence(finalText, images)
      }
    };
  }

  /**
   * Extract text from PDF.js text content
   */
  private extractTextFromContent(textContent: any): string {
    let text = '';
    let lastY = -1;
    let lineHeight = 0;

    for (const item of textContent.items) {
      const { str, transform } = item;
      
      if (str.trim()) {
        const y = transform[5];
        
        // Add line break if Y position changes significantly
        if (lastY !== -1 && Math.abs(y - lastY) > lineHeight * 0.5) {
          text += '\n';
        }
        
        text += str;
        lastY = y;
        lineHeight = Math.max(lineHeight, Math.abs(transform[3]));
      }
    }

    return text.trim();
  }

  /**
   * Extract images and visual elements from a page
   */
  private async extractImages(page: any, viewport: any): Promise<ImageData[]> {
    const images: ImageData[] = [];
    
    try {
      // Get page operators to find image objects
      const opList = await page.getOperatorList();
      const commonObjs = page.commonObjs;
      
      // Look for image objects in the page
      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const args = opList.argsArray[i];
        
        if (fn === this.pdfjsLib.OPS.paintImageXObject) {
          const imageObj = commonObjs.get(args[0]);
          if (imageObj && imageObj.data) {
            // Convert image data to base64
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (ctx && imageObj.data) {
              const imageData = new ImageData(
                new Uint8ClampedArray(imageObj.data),
                imageObj.width,
                imageObj.height
              );
              
              ctx.putImageData(imageData, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              
              // Estimate coordinates (this is approximate)
              const coordinates = {
                x: 0,
                y: 0,
                width: imageObj.width,
                height: imageObj.height
              };
              
              images.push({
                dataUrl,
                coordinates,
                type: this.classifyImageType(imageObj),
                confidence: 0.8
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error extracting images:', error);
    }
    
    return images;
  }

  /**
   * Classify the type of image (diagram, chart, equation, etc.)
   */
  private classifyImageType(imageObj: any): 'image' | 'diagram' | 'chart' | 'equation' {
    // Simple classification based on image properties
    // In a real implementation, this would use ML models
    
    const { width, height } = imageObj;
    const aspectRatio = width / height;
    
    if (aspectRatio > 2 || aspectRatio < 0.5) {
      return 'chart'; // Wide or tall images are likely charts
    }
    
    if (width < 100 && height < 100) {
      return 'equation'; // Small images are likely equations
    }
    
    return 'diagram'; // Default to diagram
  }

  /**
   * Perform OCR on a page using Tesseract.js
   */
  private async performOCR(page: any, viewport: any): Promise<string> {
    try {
      // Render page to canvas for OCR
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        console.warn('Failed to get canvas context for OCR');
        return '';
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Preprocess image for better OCR results
      this.ocrService.preprocessImage(canvas);

      // Perform OCR
      const ocrResult = await this.ocrService.recognizeCanvas(canvas, {
        tessedit_pageseg_mode: 6, // Assume uniform block of text
        preserve_interword_spaces: '1'
      });

      return ocrResult.text;
    } catch (error) {
      console.warn('OCR processing failed:', error);
      return '';
    }
  }

  /**
   * Calculate confidence score for extracted content
   */
  private calculateConfidence(text: string, images: ImageData[]): number {
    let confidence = 0.5; // Base confidence
    
    // Text confidence
    if (text.length > 100) {
      confidence += 0.3;
    } else if (text.length > 50) {
      confidence += 0.2;
    }
    
    // Image confidence
    if (images.length > 0) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Generate embeddings for text chunks
   */
  private async generateEmbeddings(
    text: string,
    pageNumber: number,
    coordinates: { x: number; y: number; width: number; height: number }
  ): Promise<EmbeddingData[]> {
    const embeddings: EmbeddingData[] = [];
    
    // Split text into chunks (approximately 512 tokens each)
    const chunks = this.chunkText(text, 512);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.getEmbedding(chunk);
      
      embeddings.push({
        text: chunk,
        embedding,
        metadata: {
          pageNumber,
          startIndex: i * 512,
          endIndex: (i + 1) * 512,
          coordinates
        }
      });
    }
    
    return embeddings;
  }

  /**
   * Split text into chunks for embedding
   */
  private chunkText(text: string, maxTokens: number): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;
    
    for (const word of words) {
      if (currentLength + word.length > maxTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [word];
        currentLength = word.length;
      } else {
        currentChunk.push(word);
        currentLength += word.length + 1; // +1 for space
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }
    
    return chunks;
  }

  /**
   * Get embedding for text using Vertex AI
   */
  private async getEmbedding(text: string): Promise<number[]> {
    // TODO: Implement actual Vertex AI embedding
    // For now, return a placeholder embedding
    console.log('Getting embedding for:', text.substring(0, 50) + '...');
    
    // Placeholder: return random embedding vector
    const embedding = new Array(768).fill(0).map(() => Math.random() - 0.5);
    return embedding;
  }

  /**
   * Search for similar content using embeddings
   */
  public async searchSimilarContent(
    query: string,
    documentId: string,
    topK: number = 5
  ): Promise<EmbeddingData[]> {
    const queryEmbedding = await this.getEmbedding(query);
    const documentEmbeddings = this.embeddingsCache.get(documentId);
    
    if (!documentEmbeddings) {
      throw new Error('Document embeddings not found');
    }
    
    // Calculate cosine similarity
    const similarities = documentEmbeddings.map(embedding => ({
      ...embedding,
      similarity: this.cosineSimilarity(queryEmbedding, embedding.embedding)
    }));
    
    // Sort by similarity and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(({ similarity, ...embedding }) => embedding);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Process user selection for RAG context
   */
  public async processSelection(
    selection: TextSelection | AreaSelection,
    document: PDFDocument
  ): Promise<{
    context: string;
    relatedContent: EmbeddingData[];
  }> {
    let context = '';
    
    if ('text' in selection) {
      // Text selection
      context = selection.text;
    } else {
      // Area selection - extract text from the area
      const page = document.pages.find(p => p.pageNumber === selection.pageNumber);
      if (page) {
        context = this.extractTextFromArea(page.text, selection.coordinates);
      }
    }
    
    // Find related content using embeddings
    const relatedContent = await this.searchSimilarContent(
      context,
      document.id,
      3
    );
    
    return {
      context,
      relatedContent
    };
  }

  /**
   * Extract text from a specific area (simplified implementation)
   */
  private extractTextFromArea(
    pageText: string,
    coordinates: { x: number; y: number; width: number; height: number }
  ): string {
    // Simplified: return a portion of the page text
    // In a real implementation, this would use more sophisticated spatial analysis
    const words = pageText.split(/\s+/);
    const startIndex = Math.floor(coordinates.x / 100) * 10;
    const endIndex = Math.min(startIndex + 50, words.length);
    
    return words.slice(startIndex, endIndex).join(' ');
  }

  /**
   * Generate document ID
   */
  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear cached embeddings for a document
   */
  public clearCache(documentId: string): void {
    this.embeddingsCache.delete(documentId);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; documents: string[] } {
    return {
      size: this.embeddingsCache.size,
      documents: Array.from(this.embeddingsCache.keys())
    };
  }
}
