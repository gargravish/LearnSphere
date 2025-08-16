import { QuizService, QuizOptions } from '@/services/QuizService';
import { QuizQuestion } from '@/types';

export interface QuizGeneratorConfig {
  containerId: string;
  onQuizGenerated: (questions: QuizQuestion[]) => void;
  onError: (error: string) => void;
}

export class QuizGenerator {
  private config: QuizGeneratorConfig;
  private quizService: QuizService;
  private container: HTMLElement | null = null;
  private isVisible = false;

  constructor(config: QuizGeneratorConfig, quizService: QuizService) {
    this.config = config;
    this.quizService = quizService;
  }

  /**
   * Initialize the quiz generator UI
   */
  public initialize(): void {
    this.createUI();
    this.setupEventListeners();
  }

  /**
   * Create the quiz generator UI
   */
  private createUI(): void {
    // Remove existing UI if any
    const existingUI = document.getElementById(this.config.containerId);
    if (existingUI) {
      existingUI.remove();
    }

    this.container = document.createElement('div');
    this.container.id = this.config.containerId;
    this.container.className = 'quiz-generator';
    this.container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-width: 90vw;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      z-index: 10001;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    `;

    this.createHeader();
    this.createForm();
    this.createActions();

    document.body.appendChild(this.container);
  }

  /**
   * Create the header section
   */
  private createHeader(): void {
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px 24px 16px;
      border-bottom: 1px solid #e0e0e0;
      background: #f8f9fa;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Generate Quiz';
    title.style.cssText = `
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #333;
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Create a quiz to test your understanding of the document';
    subtitle.style.cssText = `
      margin: 8px 0 0 0;
      font-size: 14px;
      color: #666;
    `;

    header.appendChild(title);
    header.appendChild(subtitle);
    this.container!.appendChild(header);
  }

  /**
   * Create the form section
   */
  private createForm(): void {
    const form = document.createElement('div');
    form.style.cssText = `
      padding: 24px;
    `;

    // Scope selection
    const scopeSection = this.createSelectSection(
      'scope',
      'Quiz Scope',
      'Choose what content to quiz on',
      [
        { value: 'page', label: 'Current Page' },
        { value: 'chapter', label: 'Current Chapter' },
        { value: 'document', label: 'Entire Document' },
        { value: 'selection', label: 'Selected Text' }
      ]
    );

    // Difficulty selection
    const difficultySection = this.createSelectSection(
      'difficulty',
      'Difficulty Level',
      'Choose the difficulty of questions',
      [
        { value: 'easy', label: 'Easy' },
        { value: 'medium', label: 'Medium' },
        { value: 'hard', label: 'Hard' }
      ]
    );

    // Question count selection
    const countSection = this.createSelectSection(
      'questionCount',
      'Number of Questions',
      'How many questions to generate',
      [
        { value: '5', label: '5 Questions' },
        { value: '10', label: '10 Questions' },
        { value: '15', label: '15 Questions' },
        { value: '20', label: '20 Questions' }
      ]
    );

    // Question types selection
    const typesSection = this.createMultiSelectSection(
      'questionTypes',
      'Question Types',
      'Select types of questions to include',
      [
        { value: 'multiple-choice', label: 'Multiple Choice' },
        { value: 'true-false', label: 'True/False' },
        { value: 'fill-blank', label: 'Fill in the Blank' }
      ]
    );

    // Options checkboxes
    const optionsSection = this.createOptionsSection();

    form.appendChild(scopeSection);
    form.appendChild(difficultySection);
    form.appendChild(countSection);
    form.appendChild(typesSection);
    form.appendChild(optionsSection);

    this.container!.appendChild(form);
  }

  /**
   * Create a select section
   */
  private createSelectSection(
    name: string,
    label: string,
    description: string,
    options: Array<{ value: string; label: string }>
  ): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 20px;
    `;

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.cssText = `
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    `;

    const descriptionElement = document.createElement('p');
    descriptionElement.textContent = description;
    descriptionElement.style.cssText = `
      margin: 0 0 8px 0;
      font-size: 12px;
      color: #666;
    `;

    const select = document.createElement('select');
    select.name = name;
    select.style.cssText = `
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
      background: white;
      outline: none;
      transition: border-color 0.2s ease;
    `;

    select.addEventListener('focus', () => {
      select.style.borderColor = '#1a73e8';
    });

    select.addEventListener('blur', () => {
      select.style.borderColor = '#e0e0e0';
    });

    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      select.appendChild(optionElement);
    });

    section.appendChild(labelElement);
    section.appendChild(descriptionElement);
    section.appendChild(select);

    return section;
  }

  /**
   * Create a multi-select section for question types
   */
  private createMultiSelectSection(
    name: string,
    label: string,
    description: string,
    options: Array<{ value: string; label: string }>
  ): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 20px;
    `;

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.cssText = `
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    `;

    const descriptionElement = document.createElement('p');
    descriptionElement.textContent = description;
    descriptionElement.style.cssText = `
      margin: 0 0 8px 0;
      font-size: 12px;
      color: #666;
    `;

    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    options.forEach(option => {
      const checkboxWrapper = document.createElement('div');
      checkboxWrapper.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
      `;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = `${name}_${option.value}`;
      checkbox.id = `${name}_${option.value}`;
      checkbox.value = option.value;
      checkbox.checked = option.value === 'multiple-choice'; // Default to multiple choice
      checkbox.style.cssText = `
        margin: 0;
      `;

      const checkboxLabel = document.createElement('label');
      checkboxLabel.htmlFor = `${name}_${option.value}`;
      checkboxLabel.textContent = option.label;
      checkboxLabel.style.cssText = `
        font-size: 14px;
        color: #333;
        cursor: pointer;
        margin: 0;
      `;

      checkboxWrapper.appendChild(checkbox);
      checkboxWrapper.appendChild(checkboxLabel);
      checkboxContainer.appendChild(checkboxWrapper);
    });

    section.appendChild(labelElement);
    section.appendChild(descriptionElement);
    section.appendChild(checkboxContainer);

    return section;
  }

  /**
   * Create options section with checkboxes
   */
  private createOptionsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 20px;
    `;

    const label = document.createElement('label');
    label.textContent = 'Additional Features';
    label.style.cssText = `
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    `;

    const options = [
      { name: 'includeExplanations', label: 'Include Explanations', description: 'Show explanations for correct answers' },
      { name: 'includeHints', label: 'Include Hints', description: 'Provide helpful hints for questions' }
    ];

    options.forEach(option => {
      const checkboxContainer = document.createElement('div');
      checkboxContainer.style.cssText = `
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 8px;
      `;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = option.name;
      checkbox.id = option.name;
      checkbox.checked = true; // Default to enabled
      checkbox.style.cssText = `
        margin-top: 2px;
      `;

      const labelContainer = document.createElement('div');
      labelContainer.style.cssText = `
        flex: 1;
      `;

      const checkboxLabel = document.createElement('label');
      checkboxLabel.htmlFor = option.name;
      checkboxLabel.textContent = option.label;
      checkboxLabel.style.cssText = `
        font-size: 14px;
        font-weight: 500;
        color: #333;
        cursor: pointer;
        display: block;
      `;

      const checkboxDescription = document.createElement('p');
      checkboxDescription.textContent = option.description;
      checkboxDescription.style.cssText = `
        margin: 2px 0 0 0;
        font-size: 12px;
        color: #666;
      `;

      labelContainer.appendChild(checkboxLabel);
      labelContainer.appendChild(checkboxDescription);
      checkboxContainer.appendChild(checkbox);
      checkboxContainer.appendChild(labelContainer);
      section.appendChild(checkboxContainer);
    });

    section.insertBefore(label, section.firstChild);
    return section;
  }

  /**
   * Create actions section
   */
  private createActions(): void {
    const actions = document.createElement('div');
    actions.style.cssText = `
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
      background: #f8f9fa;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    `;

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
      padding: 10px 16px;
      background: transparent;
      color: #666;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    cancelButton.addEventListener('click', () => this.hide());
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = '#f0f0f0';
    });
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = 'transparent';
    });

    const generateButton = document.createElement('button');
    generateButton.textContent = 'Generate Quiz';
    generateButton.style.cssText = `
      padding: 10px 20px;
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
    `;

    generateButton.addEventListener('click', () => this.generateQuiz());
    generateButton.addEventListener('mouseenter', () => {
      generateButton.style.background = '#1557b0';
    });
    generateButton.addEventListener('mouseleave', () => {
      generateButton.style.background = '#1a73e8';
    });

    actions.appendChild(cancelButton);
    actions.appendChild(generateButton);
    this.container!.appendChild(actions);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isVisible && this.container && !this.container.contains(e.target as Node)) {
        this.hide();
      }
    });
  }

  /**
   * Show the quiz generator
   */
  public show(): void {
    if (!this.container) return;

    this.container.style.display = 'block';
    this.isVisible = true;

    // Add backdrop
    this.addBackdrop();
  }

  /**
   * Hide the quiz generator
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
    backdrop.id = 'quiz-generator-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
    `;

    backdrop.addEventListener('click', () => this.hide());
    document.body.appendChild(backdrop);
  }

  /**
   * Remove backdrop overlay
   */
  private removeBackdrop(): void {
    const backdrop = document.getElementById('quiz-generator-backdrop');
    if (backdrop) {
      backdrop.remove();
    }
  }

  /**
   * Generate quiz based on form data
   */
  private async generateQuiz(): Promise<void> {
    if (!this.container) return;

    const formData = this.getFormData();
    if (!formData) return;

    // Show loading state
    this.setLoadingState(true);

    try {
      const questions = await this.quizService.generateQuiz(formData);
      this.config.onQuizGenerated(questions);
      this.hide();
    } catch (error) {
      console.error('Error generating quiz:', error);
      this.config.onError(error instanceof Error ? error.message : 'Failed to generate quiz');
    } finally {
      this.setLoadingState(false);
    }
  }

  /**
   * Get form data
   */
  private getFormData(): QuizOptions | null {
    if (!this.container) return null;

    const scope = (this.container.querySelector('select[name="scope"]') as HTMLSelectElement)?.value;
    const difficulty = (this.container.querySelector('select[name="difficulty"]') as HTMLSelectElement)?.value;
    const questionCount = parseInt((this.container.querySelector('select[name="questionCount"]') as HTMLSelectElement)?.value || '10');
    const includeExplanations = (this.container.querySelector('input[name="includeExplanations"]') as HTMLInputElement)?.checked || false;
    const includeHints = (this.container.querySelector('input[name="includeHints"]') as HTMLInputElement)?.checked || false;

    // Get selected question types
    const questionTypes: string[] = [];
    const typeCheckboxes = this.container.querySelectorAll('input[name^="questionTypes_"]') as NodeListOf<HTMLInputElement>;
    typeCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        questionTypes.push(checkbox.value);
      }
    });

    if (!scope || !difficulty || questionTypes.length === 0) {
      this.config.onError('Please fill in all required fields');
      return null;
    }

    return {
      scope: scope as QuizOptions['scope'],
      difficulty: difficulty as QuizOptions['difficulty'],
      questionCount,
      includeExplanations,
      includeHints,
      questionTypes: questionTypes as QuizOptions['questionTypes']
    };
  }

  /**
   * Set loading state
   */
  private setLoadingState(loading: boolean): void {
    if (!this.container) return;

    const generateButton = this.container.querySelector('button:last-child') as HTMLButtonElement;
    if (!generateButton) return;

    if (loading) {
      generateButton.textContent = 'Generating...';
      generateButton.disabled = true;
      generateButton.style.background = '#ccc';
    } else {
      generateButton.textContent = 'Generate Quiz';
      generateButton.disabled = false;
      generateButton.style.background = '#1a73e8';
    }
  }
}
