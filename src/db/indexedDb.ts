import Dexie, { Table } from 'dexie';
import { QuizResult, ChatTopic, AnalyticsEvent, QuizStats } from './types';

export class LearnSphereDB extends Dexie {
  public quizResults!: Table<QuizResult, number>;
  public chatTopics!: Table<ChatTopic, number>;
  public analytics!: Table<AnalyticsEvent, number>;

  constructor() {
    super('LearnSphereDB');

    this.version(1).stores({
      quizResults: '++id, createdAt, sourceUrl, percentage',
      chatTopics: '++id, topic, lastAskedAt',
      analytics: '++id, eventType, createdAt'
    });

    this.quizResults = this.table('quizResults');
    this.chatTopics = this.table('chatTopics');
    this.analytics = this.table('analytics');
  }

  // Quiz results
  async saveQuizResult(result: QuizResult): Promise<number> {
    return this.quizResults.add({ ...result, createdAt: result.createdAt ?? Date.now() });
  }

  async getRecentQuizResults(limit = 20): Promise<QuizResult[]> {
    return this.quizResults.orderBy('createdAt').reverse().limit(limit).toArray();
  }

  async getQuizStats(): Promise<QuizStats> {
    const total = await this.quizResults.count();
    if (total === 0) return { attempts: 0, averageScore: 0 };

    const results = await this.quizResults.toArray();
    const sum = results.reduce((acc, r) => acc + (r.percentage || 0), 0);
    const last = results.reduce((acc, r) => Math.max(acc, r.createdAt || 0), 0);
    return {
      attempts: total,
      averageScore: Math.round((sum / total) * 100) / 100,
      lastAttemptAt: last
    };
  }

  // Chat topics
  async addOrIncrementTopic(topic: string, meta?: { sourceUrl?: string; documentTitle?: string }): Promise<number> {
    const existing = await this.chatTopics.where({ topic }).first();
    if (existing) {
      return this.chatTopics.update(existing.id!, { count: existing.count + 1, lastAskedAt: Date.now(), ...meta }) as any;
    }
    return this.chatTopics.add({ topic, count: 1, lastAskedAt: Date.now(), ...meta });
  }

  async getTopTopics(limit = 10): Promise<ChatTopic[]> {
    const all = await this.chatTopics.toArray();
    return all.sort((a, b) => b.count - a.count).slice(0, limit);
  }

  // Analytics
  async logEvent<T = any>(event: AnalyticsEvent<T>): Promise<number> {
    return this.analytics.add({ ...event, createdAt: event.createdAt ?? Date.now() });
  }
}

export const db = new LearnSphereDB();


