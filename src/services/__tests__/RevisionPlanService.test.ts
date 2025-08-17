import { RevisionPlanService } from '@/services/RevisionPlanService';
import { KnowledgeAnalysisService } from '@/services/KnowledgeAnalysisService';
import { db } from '@/db/indexedDb';

jest.mock('@/services/KnowledgeAnalysisService');

describe('RevisionPlanService', () => {
  it('generates items from knowledge analysis', async () => {
    (KnowledgeAnalysisService.analyze as jest.Mock).mockResolvedValue({
      pages: [
        { sourceUrl: 'u1', documentTitle: 'Doc1', attempts: 2, averageScore: 60, lastAttemptAt: 2, recentMissed: [] }
      ],
      weakKeywords: [ { term: 'vectorization', count: 3 } ],
      summary: { totalAttempts: 2, overallAverage: 80, lastAttemptAt: 2 }
    });

    const plan = await RevisionPlanService.generate();
    expect(plan.items.length).toBeGreaterThan(0);
    const saved = await db.getLatestRevisionPlan();
    expect(saved).toBeTruthy();
  });
});


