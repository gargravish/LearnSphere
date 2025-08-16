// PDF-related types
export interface PDFPage {
  pageNumber: number;
  text: string;
  images: PDFImage[];
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PDFImage {
  src: string;
  alt: string;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PDFDocument {
  id: string;
  title: string;
  url: string;
  pages: PDFPage[];
  metadata: {
    author?: string;
    subject?: string;
    keywords?: string[];
    creationDate?: string;
    modificationDate?: string;
  };
}

// Selection types
export interface TextSelection {
  text: string;
  pageNumber: number;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AreaSelection {
  pageNumber: number;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type: 'image' | 'diagram' | 'chart' | 'equation';
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: {
    selection?: TextSelection | AreaSelection;
    pageNumber?: number;
  };
}

export interface ChatSession {
  id: string;
  documentId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// Study Aid types
export interface Summary {
  id: string;
  documentId: string;
  scope: 'page' | 'chapter' | 'document';
  content: string;
  type: 'brief' | 'detailed';
  createdAt: Date;
}

export interface Flashcard {
  id: string;
  documentId: string;
  term: string;
  definition: string;
  pageNumber?: number;
  createdAt: Date;
  lastReviewed?: Date;
  reviewCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  hint?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'multiple-choice' | 'true-false' | 'fill-blank';
  metadata: {
    scope: string;
    pageNumbers: number[];
    generatedAt: Date;
  };
}

export interface QuizResult {
  sessionId: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number; // percentage
  timeSpent: number; // in seconds
  averageTimePerQuestion: number;
  difficulty: string;
  completedAt: Date;
  questionResults: Array<{
    questionId: string;
    userAnswer: number;
    correctAnswer: number;
    isCorrect: boolean;
    timeSpent: number;
  }>;
}

// Learning Analytics types
export interface LearningEvent {
  id: string;
  type: 'quiz_completed' | 'chat_query' | 'summary_generated' | 'flashcard_reviewed';
  documentId: string;
  data: any;
  timestamp: Date;
}

export interface KnowledgeGap {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  missedQuestions: number;
  totalQuestions: number;
  lastAttempted: Date;
}

export interface LearningProfile {
  userId: string;
  totalDocuments: number;
  totalQuizzes: number;
  averageScore: number;
  knowledgeGaps: KnowledgeGap[];
  preferredLearningStyle: 'visual' | 'textual' | 'mixed';
  createdAt: Date;
  updatedAt: Date;
}

// Settings types
export interface ExtensionSettings {
  aiModel: 'gemini-pro' | 'gemini-ultra';
  theme: 'light' | 'dark' | 'auto';
  autoSave: boolean;
  cloudSync: boolean;
  notifications: boolean;
  language: string;
}

// API types
export interface GeminiRequest {
  prompt: string;
  context?: {
    text?: string;
    image?: string;
    pageNumber?: number;
  };
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GeminiResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Database types
export interface DatabaseSchema {
  documents: PDFDocument[];
  chatSessions: ChatSession[];
  summaries: Summary[];
  flashcards: Flashcard[];
  quizQuestions: QuizQuestion[];
  quizResults: QuizResult[];
  learningEvents: LearningEvent[];
  learningProfiles: LearningProfile[];
  settings: ExtensionSettings;
}
