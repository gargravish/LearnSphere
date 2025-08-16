export interface VertexAIConfig {
  projectId: string;
  location: string;
  apiKey?: string;
  accessToken?: string;
}

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage: {
    promptTokenCount: number;
    totalTokenCount: number;
  };
}

export interface VectorSearchRequest {
  query: string;
  indexId: string;
  topK?: number;
  filter?: string;
}

export interface VectorSearchResponse {
  matches: Array<{
    id: string;
    score: number;
    metadata: Record<string, any>;
  }>;
  totalCount: number;
}

export class VertexAIService {
  private config: VertexAIConfig;
  private baseUrl: string;
  private isInitialized = false;

  constructor(config: VertexAIConfig) {
    this.config = config;
    this.baseUrl = `https://${config.location}-aiplatform.googleapis.com/v1`;
  }

  /**
   * Initialize the Vertex AI service
   */
  public async initialize(): Promise<void> {
    try {
      // Check if we have the necessary credentials
      if (!this.config.apiKey && !this.config.accessToken) {
        throw new Error('Either API key or access token is required');
      }

      // Test the connection
      await this.testConnection();
      this.isInitialized = true;
      console.log('Vertex AI service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Vertex AI service:', error);
      throw error;
    }
  }

  /**
   * Test the connection to Vertex AI
   */
  private async testConnection(): Promise<void> {
    const endpoint = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.location}/models`;
    
    const response = await this.makeRequest(endpoint, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Vertex AI connection test failed: ${response.status}`);
    }
  }

  /**
   * Get embeddings for text using Vertex AI
   */
  public async getEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.isInitialized) {
      throw new Error('Vertex AI service not initialized');
    }

    const model = request.model || 'textembedding-gecko@003';
    const endpoint = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/${model}:predict`;

    const payload = {
      instances: [
        {
          content: request.text
        }
      ]
    };

    try {
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Embedding request failed: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        embedding: data.predictions[0].embeddings.values,
        model,
        usage: {
          promptTokenCount: data.predictions[0].embeddings.statistics.tokenCount || 0,
          totalTokenCount: data.predictions[0].embeddings.statistics.tokenCount || 0
        }
      };
    } catch (error) {
      console.error('Error getting embeddings:', error);
      throw error;
    }
  }

  /**
   * Create a vector search index
   */
  public async createVectorIndex(
    indexId: string,
    dimensions: number = 768,
    description?: string
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Vertex AI service not initialized');
    }

    const endpoint = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.location}/indexes`;
    
    const payload = {
      displayName: indexId,
      description: description || `Vector index for ${indexId}`,
      metadata: {
        contentsDeltaUri: `gs://${this.config.projectId}-learnsphere/${indexId}/contents`,
        config: {
          dimensions,
          approximateNeighborsCount: 150,
          distanceMeasureType: 'COSINE_DISTANCE',
          algorithmConfig: {
            treeAhConfig: {
              leafNodeEmbeddingCount: 500,
              leafNodesToSearchPercent: 10
            }
          }
        }
      }
    };

    try {
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to create vector index: ${response.status}`);
      }

      const data = await response.json();
      return data.name;
    } catch (error) {
      console.error('Error creating vector index:', error);
      throw error;
    }
  }

  /**
   * Upsert vectors to the index
   */
  public async upsertVectors(
    indexId: string,
    vectors: Array<{
      id: string;
      embedding: number[];
      metadata?: Record<string, any>;
    }>
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Vertex AI service not initialized');
    }

    const endpoint = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.location}/indexes/${indexId}:upsertDatapoints`;

    const payload = {
      datapoints: vectors.map(vector => ({
        datapointId: vector.id,
        featureVector: {
          values: vector.embedding
        },
        restricts: vector.metadata ? Object.entries(vector.metadata).map(([key, value]) => ({
          namespace: key,
          allowList: [value]
        })) : []
      }))
    };

    try {
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to upsert vectors: ${response.status}`);
      }
    } catch (error) {
      console.error('Error upserting vectors:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  public async vectorSearch(request: VectorSearchRequest): Promise<VectorSearchResponse> {
    if (!this.isInitialized) {
      throw new Error('Vertex AI service not initialized');
    }

    const endpoint = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.location}/indexes/${request.indexId}:findNeighbors`;

    const payload = {
      deployedIndexId: request.indexId,
      queries: [
        {
          datapoint: {
            featureVector: {
              values: await this.getEmbeddings({ text: request.query }).then(res => res.embedding)
            }
          },
          neighborCount: request.topK || 5,
          ...(request.filter && { filter: request.filter })
        }
      ]
    };

    try {
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Vector search failed: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        matches: data.nearestNeighbors[0].neighbors.map((neighbor: any) => ({
          id: neighbor.datapoint.datapointId,
          score: neighbor.distance,
          metadata: neighbor.datapoint.restricts || {}
        })),
        totalCount: data.nearestNeighbors[0].neighbors.length
      };
    } catch (error) {
      console.error('Error performing vector search:', error);
      throw error;
    }
  }

  /**
   * Delete a vector index
   */
  public async deleteVectorIndex(indexId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Vertex AI service not initialized');
    }

    const endpoint = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.location}/indexes/${indexId}`;

    try {
      const response = await this.makeRequest(endpoint, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete vector index: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting vector index:', error);
      throw error;
    }
  }

  /**
   * List all vector indexes
   */
  public async listVectorIndexes(): Promise<Array<{
    name: string;
    displayName: string;
    description: string;
    state: string;
  }>> {
    if (!this.isInitialized) {
      throw new Error('Vertex AI service not initialized');
    }

    const endpoint = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.location}/indexes`;

    try {
      const response = await this.makeRequest(endpoint, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Failed to list vector indexes: ${response.status}`);
      }

      const data = await response.json();
      
      return data.indexes.map((index: any) => ({
        name: index.name,
        displayName: index.displayName,
        description: index.description,
        state: index.state
      }));
    } catch (error) {
      console.error('Error listing vector indexes:', error);
      throw error;
    }
  }

  /**
   * Make authenticated requests to Vertex AI
   */
  private async makeRequest(url: string, options: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    };

    // Add authentication
    if (this.config.apiKey) {
      headers['X-Goog-Api-Key'] = this.config.apiKey;
    } else if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    }

    return fetch(url, {
      ...options,
      headers
    });
  }

  /**
   * Get service status
   */
  public getStatus(): {
    initialized: boolean;
    projectId: string;
    location: string;
  } {
    return {
      initialized: this.isInitialized,
      projectId: this.config.projectId,
      location: this.config.location
    };
  }

  /**
   * Batch get embeddings for multiple texts
   */
  public async getBatchEmbeddings(texts: string[]): Promise<EmbeddingResponse[]> {
    const promises = texts.map(text => this.getEmbeddings({ text }));
    return Promise.all(promises);
  }

  /**
   * Get embedding model information
   */
  public async getModelInfo(model: string): Promise<{
    name: string;
    version: string;
    maxInputTokens: number;
    outputTokenLimit: number;
  }> {
    const endpoint = `${this.baseUrl}/projects/${this.config.projectId}/locations/${this.config.location}/models/${model}`;

    try {
      const response = await this.makeRequest(endpoint, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Failed to get model info: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        name: data.name,
        version: data.versionId,
        maxInputTokens: data.supportedGenerationMethods?.[0]?.maxInputTokens || 0,
        outputTokenLimit: data.supportedGenerationMethods?.[0]?.outputTokenLimit || 0
      };
    } catch (error) {
      console.error('Error getting model info:', error);
      throw error;
    }
  }
}
