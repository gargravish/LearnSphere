import { StorageService } from '@/services/StorageService';
import { QuizResult } from '@/db/types';

export interface PageStat {
  sourceUrl: string;
  documentTitle?: string;
  attempts: number;
  averageScore: number; // 0..100
  lastAttemptAt?: number;
  recentMissed: Array<{ question: string; explanation?: string }>; // up to 3
}

export interface KnowledgeReport {
  pages: PageStat[];
  weakKeywords: Array<{ term: string; count: number }>;
  summary: {
    totalAttempts: number;
    overallAverage: number;
    lastAttemptAt?: number;
  };
}

const STOPWORDS = new Set([
  'the','a','an','and','or','for','to','of','in','on','at','by','with','from','as','is','are','be','was','were','this','that','these','those','which','what','how','why','when','where','who','whom','into','about','it','its','their','there','than','then','over','under','can','could','should','would','may','might','using','use','used','based','such','per','each','more','most','least','many','much'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

export class KnowledgeAnalysisService {
  static async analyze(): Promise<KnowledgeReport> {
    // Pull last 100 results from both stores via StorageService
    const results = await StorageService.getRecentQuizResults(100);
    const pagesMap = new Map<string, PageStat>();
    const keywordCounts = new Map<string, number>();

    let totalAttempts = 0;
    let totalPct = 0;
    let lastAttemptAt = 0;

    const pushPage = (url: string, title?: string) => {
      if (!pagesMap.has(url)) {
        pagesMap.set(url, {
          sourceUrl: url,
          documentTitle: title,
          attempts: 0,
          averageScore: 0,
          lastAttemptAt: 0,
          recentMissed: []
        });
      }
      return pagesMap.get(url)!;
    };

    (results as QuizResult[]).forEach(r => {
      totalAttempts += 1;
      totalPct += r.percentage || 0;
      lastAttemptAt = Math.max(lastAttemptAt, r.createdAt || 0);

      const page = pushPage(r.sourceUrl, r.documentTitle);
      page.attempts += 1;
      page.averageScore = ((page.averageScore * (page.attempts - 1)) + (r.percentage || 0)) / page.attempts;
      page.lastAttemptAt = Math.max(page.lastAttemptAt || 0, r.createdAt || 0);

      // Aggregate incorrect questions and keywords
      if (Array.isArray(r.details)) {
        r.details.forEach(d => {
          if (!d.isCorrect) {
            if (page.recentMissed.length < 3) {
              page.recentMissed.push({ question: d.question, explanation: d.explanation });
            }
            tokenize(d.question).forEach(term => {
              keywordCounts.set(term, (keywordCounts.get(term) || 0) + 1);
            });
          }
        });
      }
    });

    const pages = Array.from(pagesMap.values())
      .sort((a, b) => (a.averageScore - b.averageScore) || ((b.attempts || 0) - (a.attempts || 0)));

    const weakKeywords = Array.from(keywordCounts.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const summary = {
      totalAttempts,
      overallAverage: totalAttempts ? Math.round((totalPct / totalAttempts) * 100) / 100 : 0,
      lastAttemptAt
    };

    return { pages, weakKeywords, summary };
  }
}


