import { PDFDocument, QuizQuestion, QuizResult } from '@/types';
import { GeminiAIService } from './GeminiAIService';

export interface QuizOptions {
  scope: 'page' | 'chapter' | 'document' | 'selection';
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  includeExplanations: boolean;
  includeHints: boolean;
  questionTypes: ('multiple-choice' | 'true-false' | 'fill-blank')[];
  maxTimePerQuestion?: number; // in seconds
}

export interface QuizSession {
  id: string;
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  answers: Map<number, number>; // questionIndex -> selectedAnswerIndex
  startTime: Date;
  endTime?: Date;
  score?: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number; // in seconds
  options: QuizOptions;
}





export interface QuizAnalytics {
  totalQuizzesTaken: number;
  averageScore: number;
  bestScore: number;
  totalTimeSpent: number;
  questionsByDifficulty: {
    easy: { correct: number; total: number };
    medium: { correct: number; total: number };
    hard: { correct: number; total: number };
  };
  weakAreas: string[]; // topics where user struggles
  strongAreas: string[]; // topics where user excels
}

export class QuizService {
  private aiService: GeminiAIService;
  private currentDocument: PDFDocument | null = null;
  private activeSession: QuizSession | null = null;
  private quizHistory: QuizResult[] = [];

  constructor(aiService: GeminiAIService) {
    this.aiService = aiService;
  }

  /**
   * Set the current document for quiz generation
   */
  public setDocument(document: PDFDocument): void {
    this.currentDocument = document;
    console.log('Document set for quiz service:', document.title);
  }

  /**
   * Generate quiz questions based on options
   */
  public async generateQuiz(options: QuizOptions, selectionText?: string): Promise<QuizQuestion[]> {
    if (!this.currentDocument) {
      throw new Error('No document available for quiz generation');
    }

    try {
      let content = '';
      let pageNumbers: number[] = [];

      // Get content based on scope
      switch (options.scope) {
        case 'page':
          content = await this.getPageContent(1);
          pageNumbers = [1];
          break;
        
        case 'chapter':
          const chapterContent = await this.getChapterContent(1);
          content = chapterContent.content;
          pageNumbers = Array.from(
            { length: chapterContent.endPage - chapterContent.startPage + 1 },
            (_, i) => chapterContent.startPage + i
          );
          break;
        
        case 'document':
          content = this.currentDocument.pages.map(p => p.text).join('\n\n');
          pageNumbers = this.currentDocument.pages.map(p => p.pageNumber);
          break;
        
        case 'selection':
          if (!selectionText) {
            throw new Error('Selection text is required for selection-based quiz');
          }
          content = selectionText;
          pageNumbers = [1];
          break;
      }

      // Generate questions using AI
      const questions = await this.generateQuestions(content, options, pageNumbers);
      
      return questions;

    } catch (error) {
      console.error('Error generating quiz:', error);
      throw new Error(`Failed to generate quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate questions using AI
   */
  private async generateQuestions(
    content: string, 
    options: QuizOptions, 
    pageNumbers: number[]
  ): Promise<QuizQuestion[]> {
    const prompt = this.buildQuizPrompt(content, options);
    
    try {
      const response = await this.aiService.generateRAGResponse(prompt);
      const questions = this.parseQuestions(response, options, pageNumbers);
      
      // Validate and enhance questions
      const enhancedQuestions = await this.enhanceQuestions(questions, options);
      
      return enhancedQuestions.slice(0, options.questionCount);
    } catch (error) {
      console.error('Error generating questions:', error);
      throw new Error('Failed to generate quiz questions');
    }
  }

  /**
   * Build quiz generation prompt
   */
  private buildQuizPrompt(content: string, options: QuizOptions): string {
    const difficultyInstructions = this.getDifficultyInstructions(options.difficulty);
    const questionTypeInstructions = this.getQuestionTypeInstructions(options.questionTypes);
    
    return `Generate ${options.questionCount} ${options.difficulty} difficulty quiz questions based on the following content.

${difficultyInstructions}

${questionTypeInstructions}

Requirements:
- Each question should have exactly 4 options (A, B, C, D)
- Only one correct answer per question
- Make distractors plausible but clearly incorrect
- Questions should test understanding, not just memorization
- Include explanations for correct answers
- Include helpful hints for difficult questions

${options.includeExplanations ? '- Provide detailed explanations for why the correct answer is right' : ''}
${options.includeHints ? '- Include helpful hints for each question' : ''}

Content:
${content}

Please format your response as a JSON array with the following structure:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Explanation of why this is correct",
    "hint": "Helpful hint for the question",
    "difficulty": "${options.difficulty}",
    "questionType": "multiple-choice"
  }
]`;
  }

  /**
   * Get difficulty-specific instructions
   */
  private getDifficultyInstructions(difficulty: string): string {
    switch (difficulty) {
      case 'easy':
        return 'Create straightforward questions that test basic understanding and recall of key concepts.';
      
      case 'medium':
        return 'Create questions that require application of concepts and moderate critical thinking.';
      
      case 'hard':
        return 'Create challenging questions that require deep understanding, analysis, and synthesis of concepts.';
      
      default:
        return 'Create questions appropriate for the specified difficulty level.';
    }
  }

  /**
   * Get question type instructions
   */
  private getQuestionTypeInstructions(questionTypes: string[]): string {
    const instructions = [];
    
    if (questionTypes.includes('multiple-choice')) {
      instructions.push('Focus on traditional multiple choice questions with 4 options.');
    }
    
    if (questionTypes.includes('true-false')) {
      instructions.push('Include some true/false questions with clear, unambiguous statements.');
    }
    
    if (questionTypes.includes('fill-blank')) {
      instructions.push('Include fill-in-the-blank style questions with multiple choice options.');
    }
    
    return instructions.join(' ');
  }

  /**
   * Parse questions from AI response
   */
  private parseQuestions(
    response: string, 
    options: QuizOptions, 
    pageNumbers: number[]
  ): QuizQuestion[] {
    try {
      const parsed = JSON.parse(response);
      const questions: QuizQuestion[] = [];
      
      for (let i = 0; i < parsed.length; i++) {
        const q = parsed[i];
        
        if (q.question && q.options && Array.isArray(q.options) && q.options.length === 4) {
          const question: QuizQuestion = {
            id: `quiz_${Date.now()}_${i}`,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer || 0,
            explanation: q.explanation,
            hint: q.hint,
            difficulty: q.difficulty || options.difficulty,
            questionType: q.questionType || 'multiple-choice',
            metadata: {
              scope: options.scope,
              pageNumbers,
              generatedAt: new Date()
            }
          };
          
          questions.push(question);
        }
      }
      
      return questions;
    } catch (parseError) {
      console.warn('Failed to parse quiz questions as JSON, creating fallback questions');
      return this.createFallbackQuestions(options, pageNumbers);
    }
  }

  /**
   * Create fallback questions if parsing fails
   */
  private createFallbackQuestions(options: QuizOptions, pageNumbers: number[]): QuizQuestion[] {
    const questions: QuizQuestion[] = [];
    
    for (let i = 0; i < options.questionCount; i++) {
      questions.push({
        id: `fallback_${Date.now()}_${i}`,
        question: `Question ${i + 1} about the content?`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 0,
        explanation: 'This is a fallback question due to parsing issues.',
        hint: 'Review the content carefully.',
        difficulty: options.difficulty,
        questionType: 'multiple-choice',
        metadata: {
          scope: options.scope,
          pageNumbers,
          generatedAt: new Date()
        }
      });
    }
    
    return questions;
  }

  /**
   * Enhance questions with additional features
   */
  private async enhanceQuestions(
    questions: QuizQuestion[], 
    options: QuizOptions
  ): Promise<QuizQuestion[]> {
    const enhancedQuestions: QuizQuestion[] = [];
    
    for (const question of questions) {
      let enhancedQuestion = { ...question };
      
      // Add explanations if requested but missing
      if (options.includeExplanations && !question.explanation) {
        enhancedQuestion.explanation = await this.generateExplanation(question);
      }
      
      // Add hints if requested but missing
      if (options.includeHints && !question.hint) {
        enhancedQuestion.hint = await this.generateHint(question);
      }
      
      // Validate question quality
      if (this.validateQuestion(enhancedQuestion)) {
        enhancedQuestions.push(enhancedQuestion);
      }
    }
    
    return enhancedQuestions;
  }

  /**
   * Generate explanation for a question
   */
  private async generateExplanation(question: QuizQuestion): Promise<string> {
    const prompt = `Explain why the correct answer is right for this question:

Question: ${question.question}
Options: ${question.options.join(', ')}
Correct Answer: ${question.options[question.correctAnswer]}

Explanation:`;

    try {
      const response = await this.aiService.generateRAGResponse(prompt);
      return response;
    } catch (error) {
      return 'The correct answer is the most accurate option based on the content.';
    }
  }

  /**
   * Generate hint for a question
   */
  private async generateHint(question: QuizQuestion): Promise<string> {
    const prompt = `Provide a helpful hint for this question without giving away the answer:

Question: ${question.question}
Options: ${question.options.join(', ')}
Correct Answer: ${question.options[question.correctAnswer]}

Hint:`;

    try {
      const response = await this.aiService.generateRAGResponse(prompt);
      return response;
    } catch (error) {
      return 'Review the relevant content carefully.';
    }
  }

  /**
   * Validate question quality
   */
  private validateQuestion(question: QuizQuestion): boolean {
    // Basic validation
    if (!question.question || question.question.length < 10) return false;
    if (!question.options || question.options.length !== 4) return false;
    if (question.correctAnswer < 0 || question.correctAnswer > 3) return false;
    
    // Check for duplicate options
    const uniqueOptions = new Set(question.options);
    if (uniqueOptions.size !== 4) return false;
    
    // Check for reasonable option lengths
    const validOptions = question.options.every(option => 
      option.length > 0 && option.length < 200
    );
    
    return validOptions;
  }

  /**
   * Start a new quiz session
   */
  public startQuiz(questions: QuizQuestion[], options: QuizOptions): QuizSession {
    const session: QuizSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      questions,
      currentQuestionIndex: 0,
      answers: new Map(),
      startTime: new Date(),
      totalQuestions: questions.length,
      correctAnswers: 0,
      timeSpent: 0,
      options
    };

    this.activeSession = session;
    return session;
  }

  /**
   * Submit answer for current question
   */
  public submitAnswer(questionIndex: number, answerIndex: number): boolean {
    if (!this.activeSession) {
      throw new Error('No active quiz session');
    }

    if (questionIndex >= this.activeSession.questions.length) {
      throw new Error('Invalid question index');
    }

    const question = this.activeSession.questions[questionIndex];
    const isCorrect = answerIndex === question.correctAnswer;

    // Store the answer
    this.activeSession.answers.set(questionIndex, answerIndex);

    // Update score if correct
    if (isCorrect) {
      this.activeSession.correctAnswers++;
    }

    return isCorrect;
  }

  /**
   * Move to next question
   */
  public nextQuestion(): boolean {
    if (!this.activeSession) {
      throw new Error('No active quiz session');
    }

    if (this.activeSession.currentQuestionIndex < this.activeSession.questions.length - 1) {
      this.activeSession.currentQuestionIndex++;
      return true;
    }

    return false;
  }

  /**
   * Move to previous question
   */
  public previousQuestion(): boolean {
    if (!this.activeSession) {
      throw new Error('No active quiz session');
    }

    if (this.activeSession.currentQuestionIndex > 0) {
      this.activeSession.currentQuestionIndex--;
      return true;
    }

    return false;
  }

  /**
   * Complete the quiz session
   */
  public completeQuiz(): QuizResult {
    if (!this.activeSession) {
      throw new Error('No active quiz session');
    }

    const endTime = new Date();
    const timeSpent = (endTime.getTime() - this.activeSession.startTime.getTime()) / 1000;
    const score = (this.activeSession.correctAnswers / this.activeSession.totalQuestions) * 100;

    const result: QuizResult = {
      sessionId: this.activeSession.id,
      totalQuestions: this.activeSession.totalQuestions,
      correctAnswers: this.activeSession.correctAnswers,
      score,
      timeSpent,
      averageTimePerQuestion: timeSpent / this.activeSession.totalQuestions,
      difficulty: this.activeSession.options.difficulty,
      completedAt: endTime,
      questionResults: this.generateQuestionResults()
    };

    // Store in history
    this.quizHistory.push(result);

    // Clear active session
    this.activeSession = null;

    return result;
  }

  /**
   * Generate detailed question results
   */
  private generateQuestionResults(): Array<{
    questionId: string;
    userAnswer: number;
    correctAnswer: number;
    isCorrect: boolean;
    timeSpent: number;
  }> {
    if (!this.activeSession) return [];

    const results = [];
    
    for (let i = 0; i < this.activeSession.questions.length; i++) {
      const question = this.activeSession.questions[i];
      const userAnswer = this.activeSession.answers.get(i) ?? -1;
      
      results.push({
        questionId: question.id,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect: userAnswer === question.correctAnswer,
        timeSpent: 0 // Could be enhanced with per-question timing
      });
    }

    return results;
  }

  /**
   * Get current quiz session
   */
  public getCurrentSession(): QuizSession | null {
    return this.activeSession;
  }

  /**
   * Get quiz history
   */
  public getQuizHistory(): QuizResult[] {
    return [...this.quizHistory];
  }

  /**
   * Get quiz analytics
   */
  public getQuizAnalytics(): QuizAnalytics {
    if (this.quizHistory.length === 0) {
      return {
        totalQuizzesTaken: 0,
        averageScore: 0,
        bestScore: 0,
        totalTimeSpent: 0,
        questionsByDifficulty: {
          easy: { correct: 0, total: 0 },
          medium: { correct: 0, total: 0 },
          hard: { correct: 0, total: 0 }
        },
        weakAreas: [],
        strongAreas: []
      };
    }

    const totalQuizzes = this.quizHistory.length;
    const totalScore = this.quizHistory.reduce((sum, result) => sum + result.score, 0);
    const averageScore = totalScore / totalQuizzes;
    const bestScore = Math.max(...this.quizHistory.map(r => r.score));
    const totalTimeSpent = this.quizHistory.reduce((sum, result) => sum + result.timeSpent, 0);

    // Analyze by difficulty
    const questionsByDifficulty = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 }
    };

    this.quizHistory.forEach(result => {
      const difficulty = result.difficulty as keyof typeof questionsByDifficulty;
      if (questionsByDifficulty[difficulty]) {
        questionsByDifficulty[difficulty].correct += result.correctAnswers;
        questionsByDifficulty[difficulty].total += result.totalQuestions;
      }
    });

    return {
      totalQuizzesTaken: totalQuizzes,
      averageScore,
      bestScore,
      totalTimeSpent,
      questionsByDifficulty,
      weakAreas: this.identifyWeakAreas(),
      strongAreas: this.identifyStrongAreas()
    };
  }

  /**
   * Identify weak areas based on quiz history
   */
  private identifyWeakAreas(): string[] {
    // This could be enhanced with more sophisticated analysis
    const weakAreas: string[] = [];
    
    // Simple heuristic: if average score is low, consider it a weak area
    if (this.quizHistory.length > 0) {
      const recentQuizzes = this.quizHistory.slice(-5); // Last 5 quizzes
      const recentAverage = recentQuizzes.reduce((sum, r) => sum + r.score, 0) / recentQuizzes.length;
      
      if (recentAverage < 70) {
        weakAreas.push('Recent performance suggests need for review');
      }
    }
    
    return weakAreas;
  }

  /**
   * Identify strong areas based on quiz history
   */
  private identifyStrongAreas(): string[] {
    const strongAreas: string[] = [];
    
    if (this.quizHistory.length > 0) {
      const recentQuizzes = this.quizHistory.slice(-5);
      const recentAverage = recentQuizzes.reduce((sum, r) => sum + r.score, 0) / recentQuizzes.length;
      
      if (recentAverage > 85) {
        strongAreas.push('Strong recent performance');
      }
    }
    
    return strongAreas;
  }

  /**
   * Get content for a specific page
   */
  private async getPageContent(pageNumber: number): Promise<string> {
    if (!this.currentDocument) {
      throw new Error('No document available');
    }

    const page = this.currentDocument.pages.find(p => p.pageNumber === pageNumber);
    if (!page) {
      throw new Error(`Page ${pageNumber} not found`);
    }

    return page.text || '';
  }

  /**
   * Get content for a chapter
   */
  private async getChapterContent(chapterNumber: number): Promise<{ content: string; startPage: number; endPage: number }> {
    if (!this.currentDocument) {
      throw new Error('No document available');
    }

    // For now, treat first 5 pages as first chapter
    const startPage = 1;
    const endPage = Math.min(5, this.currentDocument.pages.length);
    
    const content = this.currentDocument.pages
      .filter(p => p.pageNumber >= startPage && p.pageNumber <= endPage)
      .map(p => p.text)
      .join('\n\n');

    return { content, startPage, endPage };
  }

  /**
   * Export quiz results
   */
  public exportQuizResults(result: QuizResult, format: 'text' | 'json' | 'csv'): string {
    switch (format) {
      case 'text':
        return this.exportAsText(result);
      case 'json':
        return this.exportAsJSON(result);
      case 'csv':
        return this.exportAsCSV(result);
      default:
        return this.exportAsText(result);
    }
  }

  /**
   * Export as text
   */
  private exportAsText(result: QuizResult): string {
    let text = `QUIZ RESULTS\n`;
    text += `Session ID: ${result.sessionId}\n`;
    text += `Completed: ${result.completedAt.toLocaleString()}\n`;
    text += `Score: ${result.score.toFixed(1)}%\n`;
    text += `Correct Answers: ${result.correctAnswers}/${result.totalQuestions}\n`;
    text += `Time Spent: ${result.timeSpent.toFixed(1)} seconds\n`;
    text += `Average Time per Question: ${result.averageTimePerQuestion.toFixed(1)} seconds\n\n`;
    
    text += `QUESTION RESULTS:\n`;
    result.questionResults.forEach((qResult, index) => {
      text += `${index + 1}. ${qResult.isCorrect ? '✓' : '✗'} (${qResult.timeSpent.toFixed(1)}s)\n`;
    });
    
    return text;
  }

  /**
   * Export as JSON
   */
  private exportAsJSON(result: QuizResult): string {
    return JSON.stringify(result, null, 2);
  }

  /**
   * Export as CSV
   */
  private exportAsCSV(result: QuizResult): string {
    let csv = 'Question,User Answer,Correct Answer,Is Correct,Time Spent\n';
    
    result.questionResults.forEach((qResult, index) => {
      csv += `${index + 1},${qResult.userAnswer},${qResult.correctAnswer},${qResult.isCorrect},${qResult.timeSpent}\n`;
    });
    
    return csv;
  }
}
