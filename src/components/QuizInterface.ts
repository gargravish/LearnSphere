import { QuizService, QuizSession } from '@/services/QuizService';
import { QuizQuestion, QuizResult } from '@/types';

export interface QuizInterfaceConfig {
  containerId: string;
  onQuizCompleted: (result: QuizResult) => void;
  onQuizClosed: () => void;
}

export class QuizInterface {
  private config: QuizInterfaceConfig;
  private quizService: QuizService;
  private container: HTMLElement | null = null;
  private isVisible = false;
  private currentSession: QuizSession | null = null;
  private questionStartTime: number = 0;

  constructor(config: QuizInterfaceConfig, quizService: QuizService) {
    this.config = config;
    this.quizService = quizService;
  }

  /**
   * Initialize the quiz interface
   */
  public initialize(): void {
    this.createUI();
    this.setupEventListeners();
  }

  /**
   * Create the quiz interface UI
   */
  private createUI(): void {
    // Remove existing UI if any
    const existingUI = document.getElementById(this.config.containerId);
    if (existingUI) {
      existingUI.remove();
    }

    this.container = document.createElement('div');
    this.container.id = this.config.containerId;
    this.container.className = 'quiz-interface';
    this.container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      max-width: 90vw;
      max-height: 80vh;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      z-index: 10001;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    `;

    document.body.appendChild(this.container);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.closeQuiz();
      }
    });
  }

  /**
   * Show the quiz interface
   */
  public show(): void {
    if (!this.container) return;

    this.container.style.display = 'block';
    this.isVisible = true;

    // Add backdrop
    this.addBackdrop();
  }

  /**
   * Hide the quiz interface
   */
  public hide(): void {
    if (!this.container) return;

    this.container.style.display = 'none';
    this.isVisible = false;

    // Remove backdrop
    this.removeBackdrop();
  }

  /**
   * Add backdrop overlay
   */
  private addBackdrop(): void {
    const backdrop = document.createElement('div');
    backdrop.id = 'quiz-interface-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
    `;

    document.body.appendChild(backdrop);
  }

  /**
   * Remove backdrop overlay
   */
  private removeBackdrop(): void {
    const backdrop = document.getElementById('quiz-interface-backdrop');
    if (backdrop) {
      backdrop.remove();
    }
  }

  /**
   * Start a quiz session
   */
  public startQuiz(questions: QuizQuestion[], options: any): void {
    this.currentSession = this.quizService.startQuiz(questions, options);
    this.renderQuiz();
    this.show();
  }

  /**
   * Render the quiz interface
   */
  private renderQuiz(): void {
    if (!this.container || !this.currentSession) return;

    this.container.innerHTML = '';
    this.createQuizHeader();
    this.createQuizContent();
    this.createQuizFooter();
  }

  /**
   * Create quiz header
   */
  private createQuizHeader(): void {
    if (!this.currentSession) return;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px 24px;
      border-bottom: 1px solid #e0e0e0;
      background: #f8f9fa;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const title = document.createElement('h2');
    title.textContent = `Quiz - ${this.currentSession.options.difficulty} Difficulty`;
    title.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    `;

    const progress = document.createElement('div');
    progress.style.cssText = `
      font-size: 14px;
      color: #666;
    `;
    progress.textContent = `Question ${this.currentSession.currentQuestionIndex + 1} of ${this.currentSession.totalQuestions}`;

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      color: #666;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s ease;
    `;

    closeButton.addEventListener('click', () => this.closeQuiz());
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#e0e0e0';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'transparent';
    });

    header.appendChild(title);
    header.appendChild(progress);
    header.appendChild(closeButton);
    this.container!.appendChild(header);
  }

  /**
   * Create quiz content
   */
  private createQuizContent(): void {
    if (!this.currentSession) return;

    const content = document.createElement('div');
    content.style.cssText = `
      padding: 24px;
      max-height: 400px;
      overflow-y: auto;
    `;

    const currentQuestion = this.currentSession.questions[this.currentSession.currentQuestionIndex];
    if (!currentQuestion) return;

    // Question text
    const questionText = document.createElement('h3');
    questionText.textContent = currentQuestion.question;
    questionText.style.cssText = `
      margin: 0 0 20px 0;
      font-size: 16px;
      font-weight: 500;
      color: #333;
      line-height: 1.5;
    `;

    // Options
    const optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    currentQuestion.options.forEach((option, index) => {
      const optionButton = document.createElement('button');
      optionButton.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
      optionButton.style.cssText = `
        padding: 12px 16px;
        background: white;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        text-align: left;
        font-size: 14px;
        color: #333;
        cursor: pointer;
        transition: all 0.2s ease;
        line-height: 1.4;
      `;

      // Check if this option was already selected
      const userAnswer = this.currentSession!.answers.get(this.currentSession!.currentQuestionIndex);
      if (userAnswer === index) {
        optionButton.style.borderColor = '#1a73e8';
        optionButton.style.background = '#f0f7ff';
      }

      optionButton.addEventListener('click', () => this.selectAnswer(index));
      optionButton.addEventListener('mouseenter', () => {
        if (userAnswer !== index) {
          optionButton.style.borderColor = '#1a73e8';
          optionButton.style.background = '#f8f9fa';
        }
      });
      optionButton.addEventListener('mouseleave', () => {
        if (userAnswer !== index) {
          optionButton.style.borderColor = '#e0e0e0';
          optionButton.style.background = 'white';
        }
      });

      optionsContainer.appendChild(optionButton);
    });

    // Hint (if available and not answered)
    if (currentQuestion.hint && !this.currentSession.answers.has(this.currentSession.currentQuestionIndex)) {
      const hintContainer = document.createElement('div');
      hintContainer.style.cssText = `
        margin-top: 20px;
        padding: 12px;
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 6px;
      `;

      const hintLabel = document.createElement('div');
      hintLabel.textContent = '💡 Hint:';
      hintLabel.style.cssText = `
        font-size: 12px;
        font-weight: 600;
        color: #856404;
        margin-bottom: 4px;
      `;

      const hintText = document.createElement('div');
      hintText.textContent = currentQuestion.hint;
      hintText.style.cssText = `
        font-size: 13px;
        color: #856404;
        line-height: 1.4;
      `;

      hintContainer.appendChild(hintLabel);
      hintContainer.appendChild(hintText);
      content.appendChild(hintContainer);
    }

    content.appendChild(questionText);
    content.appendChild(optionsContainer);
    this.container!.appendChild(content);
  }

  /**
   * Create quiz footer
   */
  private createQuizFooter(): void {
    if (!this.currentSession) return;

    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
      background: #f8f9fa;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    // Navigation buttons
    const navContainer = document.createElement('div');
    navContainer.style.cssText = `
      display: flex;
      gap: 12px;
    `;

    const prevButton = document.createElement('button');
    prevButton.textContent = '← Previous';
    prevButton.style.cssText = `
      padding: 8px 16px;
      background: transparent;
      color: #666;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    prevButton.disabled = this.currentSession.currentQuestionIndex === 0;

    if (prevButton.disabled) {
      prevButton.style.opacity = '0.5';
      prevButton.style.cursor = 'not-allowed';
    } else {
      prevButton.addEventListener('click', () => this.previousQuestion());
      prevButton.addEventListener('mouseenter', () => {
        prevButton.style.background = '#f0f0f0';
      });
      prevButton.addEventListener('mouseleave', () => {
        prevButton.style.background = 'transparent';
      });
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = this.currentSession.currentQuestionIndex === this.currentSession.totalQuestions - 1 ? 'Finish Quiz' : 'Next →';
    nextButton.style.cssText = `
      padding: 8px 16px;
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    `;

    nextButton.addEventListener('click', () => {
      if (this.currentSession!.currentQuestionIndex === this.currentSession!.totalQuestions - 1) {
        this.completeQuiz();
      } else {
        this.nextQuestion();
      }
    });

    nextButton.addEventListener('mouseenter', () => {
      nextButton.style.background = '#1557b0';
    });
    nextButton.addEventListener('mouseleave', () => {
      nextButton.style.background = '#1a73e8';
    });

    navContainer.appendChild(prevButton);
    navContainer.appendChild(nextButton);

    // Progress indicator
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    for (let i = 0; i < this.currentSession.totalQuestions; i++) {
      const indicator = document.createElement('div');
      indicator.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${this.getProgressIndicatorColor(i)};
        transition: background-color 0.2s ease;
      `;
      progressContainer.appendChild(indicator);
    }

    footer.appendChild(navContainer);
    footer.appendChild(progressContainer);
    this.container!.appendChild(footer);
  }

  /**
   * Get progress indicator color
   */
  private getProgressIndicatorColor(questionIndex: number): string {
    if (!this.currentSession) return '#e0e0e0';

    if (questionIndex === this.currentSession.currentQuestionIndex) {
      return '#1a73e8'; // Current question
    } else if (this.currentSession.answers.has(questionIndex)) {
      return '#34a853'; // Answered
    } else {
      return '#e0e0e0'; // Not answered
    }
  }

  /**
   * Select an answer
   */
  private selectAnswer(answerIndex: number): void {
    if (!this.currentSession) return;

    const isCorrect = this.quizService.submitAnswer(this.currentSession.currentQuestionIndex, answerIndex);
    
    // Show immediate feedback
    this.showAnswerFeedback(isCorrect);
    
    // Re-render to update UI
    setTimeout(() => {
      this.renderQuiz();
    }, 1500);
  }

  /**
   * Show answer feedback
   */
  private showAnswerFeedback(isCorrect: boolean): void {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 16px 24px;
      background: ${isCorrect ? '#d4edda' : '#f8d7da'};
      color: ${isCorrect ? '#155724' : '#721c24'};
      border: 1px solid ${isCorrect ? '#c3e6cb' : '#f5c6cb'};
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      z-index: 10002;
      animation: fadeInOut 1.5s ease-in-out;
    `;

    feedback.textContent = isCorrect ? '✓ Correct!' : '✗ Incorrect';

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(feedback);

    setTimeout(() => {
      document.body.removeChild(feedback);
      document.head.removeChild(style);
    }, 1500);
  }

  /**
   * Move to next question
   */
  private nextQuestion(): void {
    if (!this.currentSession) return;

    if (this.quizService.nextQuestion()) {
      this.currentSession = this.quizService.getCurrentSession();
      this.renderQuiz();
    }
  }

  /**
   * Move to previous question
   */
  private previousQuestion(): void {
    if (!this.currentSession) return;

    if (this.quizService.previousQuestion()) {
      this.currentSession = this.quizService.getCurrentSession();
      this.renderQuiz();
    }
  }

  /**
   * Complete the quiz
   */
  private completeQuiz(): void {
    if (!this.currentSession) return;

    const result = this.quizService.completeQuiz();
    this.showQuizResults(result);
  }

  /**
   * Show quiz results
   */
  private showQuizResults(result: QuizResult): void {
    if (!this.container) return;

    this.container.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px 24px;
      border-bottom: 1px solid #e0e0e0;
      background: #f8f9fa;
      text-align: center;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Quiz Complete!';
    title.style.cssText = `
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #333;
    `;

    header.appendChild(title);
    this.container.appendChild(header);

    const content = document.createElement('div');
    content.style.cssText = `
      padding: 24px;
      text-align: center;
    `;

    // Score display
    const scoreContainer = document.createElement('div');
    scoreContainer.style.cssText = `
      margin-bottom: 24px;
    `;

    const scoreCircle = document.createElement('div');
    scoreCircle.style.cssText = `
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: ${this.getScoreColor(result.score)};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 24px;
      font-weight: 700;
      color: white;
    `;
    scoreCircle.textContent = `${result.score.toFixed(0)}%`;

    const scoreText = document.createElement('div');
    scoreText.style.cssText = `
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    `;
    scoreText.textContent = `${result.correctAnswers} out of ${result.totalQuestions} correct`;

    const timeText = document.createElement('div');
    timeText.style.cssText = `
      font-size: 14px;
      color: #666;
    `;
    timeText.textContent = `Time: ${result.timeSpent.toFixed(1)}s (${result.averageTimePerQuestion.toFixed(1)}s per question)`;

    scoreContainer.appendChild(scoreCircle);
    scoreContainer.appendChild(scoreText);
    scoreContainer.appendChild(timeText);

    // Performance message
    const performanceMessage = document.createElement('div');
    performanceMessage.style.cssText = `
      margin: 20px 0;
      padding: 16px;
      background: ${this.getPerformanceBackground(result.score)};
      border-radius: 8px;
      font-size: 16px;
      color: ${this.getPerformanceColor(result.score)};
    `;
    performanceMessage.textContent = this.getPerformanceMessage(result.score);

    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 24px;
    `;

    const reviewButton = document.createElement('button');
    reviewButton.textContent = 'Review Answers';
    reviewButton.style.cssText = `
      padding: 10px 20px;
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      padding: 10px 20px;
      background: transparent;
      color: #666;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    reviewButton.addEventListener('click', () => this.reviewAnswers());
    closeButton.addEventListener('click', () => this.closeQuiz());

    buttonContainer.appendChild(reviewButton);
    buttonContainer.appendChild(closeButton);

    content.appendChild(scoreContainer);
    content.appendChild(performanceMessage);
    content.appendChild(buttonContainer);
    this.container.appendChild(content);

    // Notify parent of completion
    this.config.onQuizCompleted(result);
  }

  /**
   * Get score color
   */
  private getScoreColor(score: number): string {
    if (score >= 90) return '#28a745';
    if (score >= 80) return '#17a2b8';
    if (score >= 70) return '#ffc107';
    if (score >= 60) return '#fd7e14';
    return '#dc3545';
  }

  /**
   * Get performance background
   */
  private getPerformanceBackground(score: number): string {
    if (score >= 90) return '#d4edda';
    if (score >= 80) return '#d1ecf1';
    if (score >= 70) return '#fff3cd';
    if (score >= 60) return '#ffeaa7';
    return '#f8d7da';
  }

  /**
   * Get performance color
   */
  private getPerformanceColor(score: number): string {
    if (score >= 90) return '#155724';
    if (score >= 80) return '#0c5460';
    if (score >= 70) return '#856404';
    if (score >= 60) return '#a17f1a';
    return '#721c24';
  }

  /**
   * Get performance message
   */
  private getPerformanceMessage(score: number): string {
    if (score >= 90) return 'Excellent! You have a strong understanding of this material.';
    if (score >= 80) return 'Great job! You have a good grasp of the concepts.';
    if (score >= 70) return 'Good work! You understand most of the material.';
    if (score >= 60) return 'Not bad! Consider reviewing some areas for improvement.';
    return 'Keep studying! Review the material and try again.';
  }

  /**
   * Review answers
   */
  private reviewAnswers(): void {
    // This could be enhanced to show detailed review of all questions
    alert('Review functionality will be implemented in a future update.');
  }

  /**
   * Close quiz
   */
  private closeQuiz(): void {
    this.hide();
    this.currentSession = null;
    this.config.onQuizClosed();
  }
}
