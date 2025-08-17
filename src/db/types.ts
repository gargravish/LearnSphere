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


