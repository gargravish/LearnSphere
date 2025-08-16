export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
  lines: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

export interface OCRConfig {
  language?: string;
  tessedit_char_whitelist?: string;
  tessedit_pageseg_mode?: number;
  preserve_interword_spaces?: string;
}

export class OCRService {
  private tesseract: any = null;
  private isInitialized = false;
  private worker: any = null;

  constructor() {
    this.init();
  }

  private async init() {
    await this.loadTesseract();
  }

  private async loadTesseract(): Promise<void> {
    return new Promise((resolve) => {
      // Check if Tesseract is already loaded
      if ((window as any).Tesseract) {
        this.tesseract = (window as any).Tesseract;
        resolve();
        return;
      }

      // Load Tesseract.js from CDN
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/tesseract.js@4.1.1/dist/tesseract.min.js';
      script.onload = () => {
        this.tesseract = (window as any).Tesseract;
        resolve();
      };
      script.onerror = () => {
        console.error('Failed to load Tesseract.js');
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize Tesseract worker
   */
  public async initializeWorker(language: string = 'eng'): Promise<void> {
    if (!this.tesseract) {
      throw new Error('Tesseract.js not loaded');
    }

    try {
      this.worker = await this.tesseract.createWorker(language);
      this.isInitialized = true;
      console.log('OCR service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw error;
    }
  }

  /**
   * Perform OCR on a canvas element
   */
  public async recognizeCanvas(
    canvas: HTMLCanvasElement,
    config: OCRConfig = {}
  ): Promise<OCRResult> {
    if (!this.isInitialized || !this.worker) {
      throw new Error('OCR service not initialized');
    }

    try {
      // Set OCR configuration
      if (config.language) {
        await this.worker.loadLanguage(config.language);
        await this.worker.initialize(config.language);
      }

      // Apply configuration parameters
      if (config.tessedit_char_whitelist) {
        await this.worker.setParameters({
          tessedit_char_whitelist: config.tessedit_char_whitelist
        });
      }

      if (config.tessedit_pageseg_mode !== undefined) {
        await this.worker.setParameters({
          tessedit_pageseg_mode: config.tessedit_pageseg_mode
        });
      }

      if (config.preserve_interword_spaces) {
        await this.worker.setParameters({
          preserve_interword_spaces: config.preserve_interword_spaces
        });
      }

      // Perform OCR
      const result = await this.worker.recognize(canvas);

      return {
        text: result.data.text,
        confidence: result.data.confidence / 100, // Convert to 0-1 scale
        words: result.data.words.map((word: any) => ({
          text: word.text,
          confidence: word.confidence / 100,
          bbox: word.bbox
        })),
        lines: result.data.lines.map((line: any) => ({
          text: line.text,
          confidence: line.confidence / 100,
          bbox: line.bbox
        }))
      };
    } catch (error) {
      console.error('OCR recognition failed:', error);
      throw error;
    }
  }

  /**
   * Perform OCR on an image URL
   */
  public async recognizeImage(
    imageUrl: string,
    config: OCRConfig = {}
  ): Promise<OCRResult> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const result = await this.recognizeCanvas(canvas, config);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = imageUrl;
    });
  }

  /**
   * Perform OCR on image data
   */
  public async recognizeImageData(
    imageData: ImageData,
    config: OCRConfig = {}
  ): Promise<OCRResult> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);

    return this.recognizeCanvas(canvas, config);
  }

  /**
   * Perform OCR on a specific region of a canvas
   */
  public async recognizeRegion(
    canvas: HTMLCanvasElement,
    region: { x: number; y: number; width: number; height: number },
    config: OCRConfig = {}
  ): Promise<OCRResult> {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) {
      throw new Error('Failed to get canvas context');
    }

    tempCanvas.width = region.width;
    tempCanvas.height = region.height;
    
    tempCtx.drawImage(
      canvas,
      region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height
    );

    return this.recognizeCanvas(tempCanvas, config);
  }

  /**
   * Detect if an image contains text (confidence check)
   */
  public async detectText(
    canvas: HTMLCanvasElement,
    threshold: number = 0.3
  ): Promise<{ hasText: boolean; confidence: number }> {
    try {
      const result = await this.recognizeCanvas(canvas, {
        tessedit_pageseg_mode: 6 // Assume uniform block of text
      });

      return {
        hasText: result.confidence > threshold,
        confidence: result.confidence
      };
    } catch (error) {
      console.warn('Text detection failed:', error);
      return {
        hasText: false,
        confidence: 0
      };
    }
  }

  /**
   * Extract text from multiple regions
   */
  public async recognizeMultipleRegions(
    canvas: HTMLCanvasElement,
    regions: Array<{ x: number; y: number; width: number; height: number }>,
    config: OCRConfig = {}
  ): Promise<OCRResult[]> {
    const promises = regions.map(region => 
      this.recognizeRegion(canvas, region, config)
    );
    
    return Promise.all(promises);
  }

  /**
   * Get available languages
   */
  public async getAvailableLanguages(): Promise<string[]> {
    if (!this.tesseract) {
      throw new Error('Tesseract.js not loaded');
    }

    try {
      const langs = await this.tesseract.getLanguages();
      return Object.keys(langs);
    } catch (error) {
      console.error('Failed to get available languages:', error);
      return ['eng']; // Default to English
    }
  }

  /**
   * Set OCR parameters
   */
  public async setParameters(parameters: Record<string, any>): Promise<void> {
    if (!this.isInitialized || !this.worker) {
      throw new Error('OCR service not initialized');
    }

    await this.worker.setParameters(parameters);
  }

  /**
   * Terminate the worker
   */
  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }

  /**
   * Get service status
   */
  public getStatus(): {
    initialized: boolean;
    tesseractLoaded: boolean;
    workerActive: boolean;
  } {
    return {
      initialized: this.isInitialized,
      tesseractLoaded: !!this.tesseract,
      workerActive: !!this.worker
    };
  }

  /**
   * Preprocess image for better OCR results
   */
  public preprocessImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale and enhance contrast
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const enhanced = gray > 128 ? 255 : 0; // Simple thresholding
      
      data[i] = enhanced;     // Red
      data[i + 1] = enhanced; // Green
      data[i + 2] = enhanced; // Blue
      // Alpha channel remains unchanged
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Batch OCR processing
   */
  public async batchRecognize(
    images: Array<HTMLCanvasElement | string>,
    config: OCRConfig = {}
  ): Promise<OCRResult[]> {
    const promises = images.map(image => {
      if (typeof image === 'string') {
        return this.recognizeImage(image, config);
      } else {
        return this.recognizeCanvas(image, config);
      }
    });

    return Promise.all(promises);
  }
}
