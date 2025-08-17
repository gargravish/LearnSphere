import { StorageService } from '@/services/StorageService';
import { KnowledgeAnalysisService } from '@/services/KnowledgeAnalysisService';
import { db } from '@/db/indexedDb';
import { RevisionPlan, RevisionPlanItem } from '@/db/types';

export class RevisionPlanService {
  static async generate(): Promise<RevisionPlan> {
    const analysis = await KnowledgeAnalysisService.analyze();

    const items: RevisionPlanItem[] = [];

    // Create page-focused actions for lowest scoring pages
    analysis.pages.slice(0, 5).forEach((p) => {
      items.push({
        title: `Revisit: ${p.documentTitle || p.sourceUrl}`,
        description: `Review the highlighted weak sections and retake a short quiz. Focus on missed questions shown under this page in Knowledge tab.`,
        sourceUrl: p.sourceUrl,
        documentTitle: p.documentTitle,
        status: 'pending'
      });
    });

    // Create term-focused practice items for frequent weak terms
    analysis.weakKeywords.slice(0, 10).forEach((k) => {
      items.push({
        title: `Revise term: ${k.term}`,
        description: `Create flashcards or short notes for "${k.term}". Then generate 3 practice MCQs for this topic.`,
        term: k.term,
        status: 'pending'
      });
    });

    const id = await db.createRevisionPlan(items);
    return { id, createdAt: Date.now(), items } as RevisionPlan;
  }

  static async getLatest(): Promise<RevisionPlan | undefined> {
    return db.getLatestRevisionPlan();
  }
}


