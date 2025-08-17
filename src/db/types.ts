export interface QuizQuestionAnswer {
  question: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  explanation?: string;
}

export interface QuizResult {
  id?: number;
  createdAt: number; // epoch ms
  sourceUrl: string;
  documentTitle?: string;
  totalQuestions: number;
  correctCount: number;
  percentage: number; // 0..100
  details: QuizQuestionAnswer[];
}

export interface ChatTopic {
  id?: number;
  topic: string;
  count: number;
  lastAskedAt: number; // epoch ms
  sourceUrl?: string;
  documentTitle?: string;
}

export type AnalyticsEventType =
  | 'quiz_started'
  | 'quiz_completed'
  | 'chat_asked'
  | 'summary_generated'
  | string;

export interface AnalyticsEvent<T = any> {
  id?: number;
  eventType: AnalyticsEventType;
  createdAt: number; // epoch ms
  sourceUrl?: string;
  documentTitle?: string;
  payload?: T;
}

export interface QuizStats {
  attempts: number;
  averageScore: number; // 0..100
  lastAttemptAt?: number;
}

export type RevisionStatus = 'pending' | 'in-progress' | 'done';

export interface RevisionPlanItem {
  title: string;
  description?: string;
  sourceUrl?: string;
  documentTitle?: string;
  term?: string;
  status: RevisionStatus;
}

export interface RevisionPlan {
  id?: number;
  createdAt: number; // epoch ms
  items: RevisionPlanItem[];
}

// --- Anchors / Selections ---
export type AnchorMethod = 'xpath';

export interface SerializedRangeXPath {
  startXPath: string;
  startOffset: number;
  endXPath: string;
  endOffset: number;
}

export interface AnchorRecord {
  id?: number;
  url: string;
  anchorId: string; // stable id
  method: AnchorMethod; // currently 'xpath'
  serialized: SerializedRangeXPath; // serialization payload
  snippet: string; // short text for context
  hash: string; // dedupe key
  createdAt: number; // epoch ms
  kind?: 'text' | 'image';
  imageMeta?: {
    src: string;
    alt?: string;
    naturalWidth?: number;
    naturalHeight?: number;
    rect?: { x: number; y: number; width: number; height: number };
  };
}

// --- Page cache (offline content) ---
export interface PageContentCache {
  id?: number;
  url: string;
  title?: string;
  text: string; // extracted main text (trimmed)
  updatedAt: number; // epoch ms
  contentHash?: string; // optional hash for change detection
}


