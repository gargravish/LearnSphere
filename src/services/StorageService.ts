import { db } from '@/db/indexedDb';
import { QuizResult, AnalyticsEvent, AnchorRecord, PageContentCache } from '@/db/types';

/**
 * StorageService is a thin modular wrapper around IndexedDB (Dexie) to persist
 * LearnSphere data. It does not alter existing behaviors; consumers opt-in.
 */
export const StorageService = {
  async saveQuizResult(result: QuizResult) {
    return db.saveQuizResult(result);
  },

  async getRecentQuizResults(limit = 20) {
    try {
      const dexieItems = await db.getRecentQuizResults(limit);
      // Also read from chrome.storage.local for results saved from content pages
      const local = await chrome.storage.local.get('quizResults');
      const localItems = Array.isArray(local?.quizResults) ? local.quizResults : [];
      const all = [...dexieItems, ...localItems];
      const unique = new Map<number, any>();
      all
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .forEach((r) => unique.set((r.id as number) || r.createdAt, r));
      return Array.from(unique.values()).slice(0, limit);
    } catch {
      const local = await chrome.storage.local.get('quizResults');
      return Array.isArray(local?.quizResults) ? local.quizResults.slice(0, limit) : [];
    }
  },

  async getQuizStats() {
    return db.getQuizStats();
  },

  async addChatTopic(topic: string, meta?: { sourceUrl?: string; documentTitle?: string }) {
    return db.addOrIncrementTopic(topic, meta);
  },

  async getTopChatTopics(limit = 10) {
    return db.getTopTopics(limit);
  },

  async logEvent<T = any>(event: AnalyticsEvent<T>) {
    return db.logEvent(event);
  },

  async logSummaryGenerated(meta: { sourceUrl?: string; documentTitle?: string }) {
    return db.logEvent({ eventType: 'summary_generated', createdAt: Date.now(), ...meta });
  },

  async logChatAsked(topic: string, meta?: { sourceUrl?: string; documentTitle?: string }) {
    await db.addOrIncrementTopic(topic, meta);
    return db.logEvent({ eventType: 'chat_asked', createdAt: Date.now(), payload: { topic }, ...meta });
  },

  // Anchors API
  async saveAnchor(rec: Omit<AnchorRecord, 'id' | 'createdAt'>) {
    return db.upsertAnchor({ ...rec, createdAt: Date.now() } as AnchorRecord);
  },

  async getAnchors(url: string) {
    return db.getAnchorsByUrl(url);
  },

  // Page cache (offline)
  async savePageCache(entry: Omit<PageContentCache, 'id' | 'updatedAt'> & { updatedAt?: number }) {
    return db.upsertPageCache({ ...entry, updatedAt: entry.updatedAt ?? Date.now() });
  },

  async getPageCache(url: string) {
    return db.getPageCache(url);
  }
};


