import { KnowledgeAnalysisService } from '@/services/KnowledgeAnalysisService';
import { StorageService } from '@/services/StorageService';

jest.mock('@/services/StorageService');

describe('KnowledgeAnalysisService', () => {
  it('aggregates quiz results into summary and weakKeywords', async () => {
    (StorageService.getRecentQuizResults as jest.Mock).mockResolvedValue([
      { createdAt: 1, sourceUrl: 'u1', documentTitle: 'Doc1', totalQuestions: 2, correctCount: 1, percentage: 50, details: [
        { question: 'What is vectorization?', options: ['a','b','c','d'], selectedIndex: 0, correctIndex: 1, isCorrect: false, explanation: 'exp' },
        { question: 'Define matrix', options: ['a','b','c','d'], selectedIndex: 1, correctIndex: 1, isCorrect: true }
      ]},
      { createdAt: 2, sourceUrl: 'u1', documentTitle: 'Doc1', totalQuestions: 2, correctCount: 2, percentage: 100, details: [
        { question: 'Vectorization advantages', options: ['a','b','c','d'], selectedIndex: 2, correctIndex: 3, isCorrect: false, explanation: 'exp' },
        { question: 'Another', options: ['a','b','c','d'], selectedIndex: 3, correctIndex: 3, isCorrect: true }
      ]}
    ]);

    const report = await KnowledgeAnalysisService.analyze();
    expect(report.summary.totalAttempts).toBe(2);
    expect(report.pages.length).toBe(1);
    expect(report.pages[0].attempts).toBe(2);
    expect(report.weakKeywords.length).toBeGreaterThan(0);
  });
});


