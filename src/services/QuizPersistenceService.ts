import { StorageService } from './StorageService';
import { QuizResult, QuizQuestionAnswer } from '@/db/types';

export class QuizPersistenceService {
  static async saveResult(params: {
    questions: Array<{ question: string; options: string[]; correctAnswer: number; explanation?: string }>;
    selections: number[]; // same length as questions
    sourceUrl: string;
    documentTitle?: string;
  }) {
    const details: QuizQuestionAnswer[] = params.questions.map((q, i) => ({
      question: q.question,
      options: q.options,
      selectedIndex: params.selections[i],
      correctIndex: q.correctAnswer,
      isCorrect: params.selections[i] === q.correctAnswer,
      explanation: q.explanation
    }));

    const correctCount = details.filter(d => d.isCorrect).length;
    const percentage = Math.round((correctCount / details.length) * 10000) / 100; // 2 decimals

    const result: QuizResult = {
      createdAt: Date.now(),
      sourceUrl: params.sourceUrl,
      documentTitle: params.documentTitle,
      totalQuestions: details.length,
      correctCount,
      percentage,
      details
    };

    // Save to IndexedDB (preferred)
    await StorageService.saveQuizResult(result);
    // Also mirror to chrome.storage.local for visibility in options page even if DB fails
    try {
      const existing = await chrome.storage.local.get('quizResults');
      const list: QuizResult[] = Array.isArray(existing?.quizResults) ? existing.quizResults : [];
      list.unshift(result);
      await chrome.storage.local.set({ quizResults: list.slice(0, 100) });
    } catch {}
    await StorageService.logEvent({ eventType: 'quiz_completed', payload: { percentage }, createdAt: Date.now(), sourceUrl: params.sourceUrl, documentTitle: params.documentTitle });

    return result;
  }
}


