import Dexie, { Table } from 'dexie';
import { QuizResult, ChatTopic, AnalyticsEvent, QuizStats, RevisionPlan, AnchorRecord, PageContentCache } from './types';

export class LearnSphereDB extends Dexie {
  public quizResults!: Table<QuizResult, number>;
  public chatTopics!: Table<ChatTopic, number>;
  public analytics!: Table<AnalyticsEvent, number>;
  public revisionPlans!: Table<RevisionPlan, number>;
  public anchors!: Table<AnchorRecord, number>;
  public pageCache!: Table<PageContentCache, number>;

  constructor() {
    super('LearnSphereDB');

    this.version(1).stores({
      quizResults: '++id, createdAt, sourceUrl, percentage',
      chatTopics: '++id, topic, lastAskedAt',
      analytics: '++id, eventType, createdAt'
    });

    // v2: add documentTitle index and ensure chatTopics topic index exists
    this.version(2).stores({
      quizResults: '++id, createdAt, sourceUrl, percentage, documentTitle',
      chatTopics: '++id, topic, lastAskedAt, count',
      analytics: '++id, eventType, createdAt'
    }).upgrade(async (tx) => {
      try {
        const results = await tx.table('quizResults').toArray();
        for (const r of results) {
          if (!('documentTitle' in r)) {
            r.documentTitle = r.documentTitle || '';
            await tx.table('quizResults').put(r);
          }
        }
      } catch (e) {
        // ignore migration errors; DB remains usable
      }
    });

    // v3: add revisionPlans store
    this.version(3).stores({
      quizResults: '++id, createdAt, sourceUrl, percentage, documentTitle',
      chatTopics: '++id, topic, lastAskedAt, count',
      analytics: '++id, eventType, createdAt',
      revisionPlans: '++id, createdAt'
    });

    // v4: add anchors store
    this.version(4).stores({
      quizResults: '++id, createdAt, sourceUrl, percentage, documentTitle',
      chatTopics: '++id, topic, lastAskedAt, count',
      analytics: '++id, eventType, createdAt',
      revisionPlans: '++id, createdAt',
      anchors: '++id, url, anchorId, hash, createdAt'
    });

    // v5: add pageCache store (url unique)
    this.version(5).stores({
      quizResults: '++id, createdAt, sourceUrl, percentage, documentTitle',
      chatTopics: '++id, topic, lastAskedAt, count',
      analytics: '++id, eventType, createdAt',
      revisionPlans: '++id, createdAt',
      anchors: '++id, url, anchorId, hash, createdAt',
      pageCache: '++id, url, updatedAt'
    });

    this.quizResults = this.table('quizResults');
    this.chatTopics = this.table('chatTopics');
    this.analytics = this.table('analytics');
    this.revisionPlans = this.table('revisionPlans');
    this.anchors = this.table('anchors');
    // @ts-ignore
    this.pageCache = this.table('pageCache');
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

  // Revision plans
  async createRevisionPlan(items: RevisionPlan['items']): Promise<number> {
    return this.revisionPlans.add({ createdAt: Date.now(), items });
  }

  async getLatestRevisionPlan(): Promise<RevisionPlan | undefined> {
    return this.revisionPlans.orderBy('createdAt').reverse().first();
  }

  // Anchors
  async upsertAnchor(record: AnchorRecord): Promise<number> {
    const existing = await this.anchors.where({ url: record.url, hash: record.hash }).first();
    if (existing) return existing.id!;
    return this.anchors.add({ ...record, createdAt: record.createdAt ?? Date.now() });
  }

  async getAnchorsByUrl(url: string): Promise<AnchorRecord[]> {
    return this.anchors.where({ url }).toArray();
  }

  // Page cache
  async upsertPageCache(entry: PageContentCache): Promise<number> {
    const existing = await this.pageCache.where({ url: entry.url }).first();
    if (existing) {
      await this.pageCache.update(existing.id!, { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
      return existing.id!;
    }
    return this.pageCache.add({ ...entry, updatedAt: entry.updatedAt ?? Date.now() });
  }

  async getPageCache(url: string): Promise<PageContentCache | undefined> {
    return this.pageCache.where({ url }).first();
  }
}

// In Node/Jest, Dexie needs indexedDB shim. Skip if not available.
let instance: LearnSphereDB;
try {
  // @ts-ignore
  if (typeof indexedDB === 'undefined') {
    // no-op fallback: use Dexie with fake shim memory (skip operations will throw). Consumers should mock in tests.
    // We still construct to keep API shape for modules that import db.
  }
  instance = new LearnSphereDB();
} catch {
  instance = new LearnSphereDB();
}

export const db = instance;


