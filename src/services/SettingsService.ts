export interface ExtensionSettings {
  geminiApiKey: string;
  geminiModel?: string;
  theme: 'light' | 'dark' | 'auto';
  chatSidebarPosition: 'left' | 'right';
  chatSidebarWidth: number;
  autoSaveHighlights: boolean;
  enableNotifications: boolean;
  language: string;
  maxTokens: number;
  temperature: number;
  // Thinking controls
  enableThinking?: boolean;
  thinkingBudgetTokens?: number;
  // New settings for enhanced configuration
  autoOpenChat: boolean;
  highlightColors: string[];
  defaultQuizDifficulty: 'easy' | 'medium' | 'hard';
  defaultQuizQuestionCount: number;
  enableQuizHints: boolean;
  enableQuizExplanations: boolean;
  autoSaveQuizResults: boolean;
  enableLearningAnalytics: boolean;
  dataRetentionDays: number;
  enableCloudSync: boolean;
  privacyMode: boolean;
  accessibilityOptions: {
    highContrast: boolean;
    largeText: boolean;
    reduceMotion: boolean;
  };
}

export class SettingsService {
  private static instance: SettingsService;
  private settings: ExtensionSettings;
  private storageKey = 'learnsphere_settings';
  private changeListeners: Array<(settings: ExtensionSettings) => void> = [];

  private constructor() {
    this.settings = this.getDefaultSettings();
    this.loadSettings();
    this.setupSystemThemeListener();
    // Listen for external storage changes (e.g., popup saves) and sync in-memory state
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync') return;
        const changed = changes[this.storageKey];
        if (changed && changed.newValue) {
          this.settings = { ...this.settings, ...changed.newValue };
          this.applySettingsToPage();
          this.notifyListeners();
        }
      });
    } catch {}
  }

  /**
   * Setup listener for system theme changes
   */
  private setupSystemThemeListener(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleThemeChange = (e: MediaQueryListEvent) => {
        if (this.settings.theme === 'auto') {
          this.applySettingsToPage();
        }
      };
      
      // Add listener for theme changes
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleThemeChange);
      } else {
        // Fallback for older browsers
        mediaQuery.addListener(handleThemeChange);
      }
    }
  }

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Add a listener for settings changes
   */
  public addChangeListener(listener: (settings: ExtensionSettings) => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * Remove a change listener
   */
  public removeChangeListener(listener: (settings: ExtensionSettings) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of settings changes
   */
  private notifyListeners(): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(this.settings);
      } catch (error) {
        console.error('Error in settings change listener:', error);
      }
    });
  }

  /**
   * Apply settings to the current page
   */
  public applySettingsToPage(): void {
    try {
      // Apply theme
      this.applyTheme();
      
      // Apply accessibility settings
      this.applyAccessibilitySettings();
      
      // Apply chat sidebar settings
      this.applyChatSidebarSettings();
      
      // Notify listeners
      this.notifyListeners();
    } catch (error) {
      console.error('Error applying settings to page:', error);
    }
  }

  /**
   * Apply theme settings to the page
   */
  private applyTheme(): void {
    const themeSettings = this.getThemeSettings();
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('learnsphere-light', 'learnsphere-dark');
    
    // Add current theme class
    if (themeSettings.isDark) {
      root.classList.add('learnsphere-dark');
    } else {
      root.classList.add('learnsphere-light');
    }
    
    // Apply CSS custom properties
    root.style.setProperty('--learnsphere-bg-color', themeSettings.backgroundColor);
    root.style.setProperty('--learnsphere-text-color', themeSettings.textColor);
  }

  /**
   * Apply accessibility settings to the page
   */
  private applyAccessibilitySettings(): void {
    const root = document.documentElement;
    const accessibility = this.settings.accessibilityOptions;
    
    // Apply high contrast
    if (accessibility.highContrast) {
      root.classList.add('learnsphere-high-contrast');
    } else {
      root.classList.remove('learnsphere-high-contrast');
    }
    
    // Apply large text
    if (accessibility.largeText) {
      root.classList.add('learnsphere-large-text');
    } else {
      root.classList.remove('learnsphere-large-text');
    }
    
    // Apply reduce motion
    if (accessibility.reduceMotion) {
      root.classList.add('learnsphere-reduce-motion');
    } else {
      root.classList.remove('learnsphere-reduce-motion');
    }
  }

  /**
   * Apply chat sidebar settings
   */
  private applyChatSidebarSettings(): void {
    const sidebar = document.getElementById('learnsphere-sidebar');
    if (sidebar) {
      const config = this.getChatSidebarConfig();
      
      if (config.position === 'left') {
        sidebar.style.left = '0';
        sidebar.style.right = 'auto';
      } else {
        sidebar.style.right = '0';
        sidebar.style.left = 'auto';
      }
      
      sidebar.style.width = `${config.width}px`;
    }
  }

  /**
   * Get all settings
   */
  public getAllSettings(): ExtensionSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  public updateSettings(newSettings: Partial<ExtensionSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): ExtensionSettings {
    return {
      geminiApiKey: '',
      geminiModel: 'gemini-2.5-flash',
      theme: 'auto',
      chatSidebarPosition: 'right',
      chatSidebarWidth: 400,
      autoSaveHighlights: true,
      enableNotifications: true,
      language: 'en',
      maxTokens: 8192,
      temperature: 0.7,
      enableThinking: false,
      thinkingBudgetTokens: 0,
      // New default settings
      autoOpenChat: false,
      highlightColors: ['#ffeb3b', '#4caf50', '#2196f3', '#f44336', '#9c27b0'],
      defaultQuizDifficulty: 'medium',
      defaultQuizQuestionCount: 10,
      enableQuizHints: true,
      enableQuizExplanations: true,
      autoSaveQuizResults: true,
      enableLearningAnalytics: true,
      dataRetentionDays: 365,
      enableCloudSync: false,
      privacyMode: false,
      accessibilityOptions: {
        highContrast: false,
        largeText: false,
        reduceMotion: false
      }
    };
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      console.log('LearnSphere SettingsService: Loading settings from storage...');
      const result = await chrome.storage.sync.get(this.storageKey);
      console.log('LearnSphere SettingsService: Storage result:', result);
      
      if (result[this.storageKey]) {
        console.log('LearnSphere SettingsService: Found saved settings:', result[this.storageKey]);
        this.settings = { ...this.settings, ...result[this.storageKey] };
      } else {
        console.log('LearnSphere SettingsService: No saved settings found, using defaults');
      }
      
      // Check for legacy settings and migrate if needed
      await this.migrateLegacySettings();
      
      console.log('LearnSphere SettingsService: Final settings:', this.settings);
    } catch (error) {
      console.warn('Failed to load settings from storage:', error);
    }
  }

  /**
   * Force reload settings from storage (public method)
   */
  public async reloadSettings(): Promise<void> {
    await this.loadSettings();
  }

  /**
   * Migrate settings from legacy format
   */
  private async migrateLegacySettings(): Promise<void> {
    try {
      // Check for old settings format
      const legacyResult = await chrome.storage.sync.get(['settings']);
      if (legacyResult.settings) {
        console.log('LearnSphere: Migrating legacy settings format');
        
        // Map old settings to new format
        const legacySettings = legacyResult.settings;
        const migratedSettings: Partial<ExtensionSettings> = {};
        
        if (legacySettings.aiModel) {
          // Old aiModel setting is no longer used, but we can preserve other settings
          console.log('LearnSphere: Legacy aiModel setting found, migrating other settings');
        }
        
        if (legacySettings.theme) {
          migratedSettings.theme = legacySettings.theme;
        }
        
        if (legacySettings.language) {
          migratedSettings.language = legacySettings.language;
        }
        
        if (legacySettings.autoSave !== undefined) {
          migratedSettings.autoSaveHighlights = legacySettings.autoSave;
        }
        
        if (legacySettings.cloudSync !== undefined) {
          migratedSettings.enableCloudSync = legacySettings.cloudSync;
        }
        
        if (legacySettings.notifications !== undefined) {
          migratedSettings.enableNotifications = legacySettings.notifications;
        }
        
        // Apply migrated settings
        if (Object.keys(migratedSettings).length > 0) {
          this.settings = { ...this.settings, ...migratedSettings };
          await this.saveSettings();
          
          // Clean up old settings
          await chrome.storage.sync.remove(['settings']);
          console.log('LearnSphere: Legacy settings migrated and cleaned up');
        }
      }
    } catch (error) {
      console.warn('Failed to migrate legacy settings:', error);
    }
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      console.log('LearnSphere SettingsService: Saving settings to storage:', this.settings);
      await chrome.storage.sync.set({
        [this.storageKey]: this.settings
      });
      console.log('LearnSphere SettingsService: Settings saved successfully');
      
      // Apply settings to the current page
      this.applySettingsToPage();
    } catch (error) {
      console.error('Failed to save settings to storage:', error);
    }
  }

  /**
   * Get a setting value
   */
  public get<K extends keyof ExtensionSettings>(key: K): ExtensionSettings[K] {
    return this.settings[key];
  }

  /**
   * Set a setting value
   */
  public async set<K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]): Promise<void> {
    this.settings[key] = value;
    await this.saveSettings();
  }

  /**
   * Get all settings
   */
  public getAll(): ExtensionSettings {
    return { ...this.settings };
  }

  /**
   * Update multiple settings at once
   */
  public async update(updates: Partial<ExtensionSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  /**
   * Reset settings to defaults
   */
  public async reset(): Promise<void> {
    this.settings = this.getDefaultSettings();
    await this.saveSettings();
  }

  /**
   * Check if Gemini API key is configured
   */
  public hasGeminiApiKey(): boolean {
    return !!this.settings.geminiApiKey && this.settings.geminiApiKey.trim().length > 0;
  }

  /**
   * Get Gemini API key
   */
  public getGeminiApiKey(): string {
    return this.settings.geminiApiKey;
  }

  /** Get chosen Gemini model */
  public getGeminiModel(): string {
    return this.settings.geminiModel || 'gemini-2.5-flash';
  }

  /**
   * Set Gemini API key
   */
  public async setGeminiApiKey(apiKey: string): Promise<void> {
    await this.set('geminiApiKey', apiKey);
  }

  /**
   * Export settings as JSON
   */
  public exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  public async importSettings(jsonString: string): Promise<void> {
    try {
      const importedSettings = JSON.parse(jsonString);
      this.settings = { ...this.getDefaultSettings(), ...importedSettings };
      await this.saveSettings();
    } catch (error) {
      throw new Error('Invalid settings format');
    }
  }

  /**
   * Validate API key format (basic validation)
   */
  public validateApiKey(apiKey: string): boolean {
    // Basic validation for Gemini API key format
    return apiKey.length > 0 && apiKey.includes('AIza');
  }

  /**
   * Test the Gemini API key by making a simple request
   */
  public async testApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const model = this.getGeminiModel();
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: 'Hello' }]
          }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.1,
            maxOutputTokens: 10
          }
        })
      });

      if (response.ok) {
        return { valid: true };
      } else {
        const errorData = await response.json();
        return { 
          valid: false, 
          error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}` 
        };
      }
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  /**
   * Get theme-specific settings
   */
  public getThemeSettings(): { isDark: boolean; backgroundColor: string; textColor: string } {
    const isDark = this.settings.theme === 'dark';
    return {
      isDark,
      backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
      textColor: isDark ? '#ffffff' : '#000000'
    };
  }

  /**
   * Get chat sidebar configuration
   */
  public getChatSidebarConfig(): { position: 'left' | 'right'; width: number } {
    return {
      position: this.settings.chatSidebarPosition,
      width: this.settings.chatSidebarWidth
    };
  }

  /**
   * Get AI configuration
   */
  public getAIConfig(): { maxTokens: number; temperature: number } {
    return {
      maxTokens: this.settings.maxTokens,
      temperature: this.settings.temperature
    };
  }

  /**
   * Get quiz configuration
   */
  public getQuizConfig(): {
    defaultDifficulty: 'easy' | 'medium' | 'hard';
    defaultQuestionCount: number;
    enableHints: boolean;
    enableExplanations: boolean;
    autoSaveResults: boolean;
  } {
    return {
      defaultDifficulty: this.settings.defaultQuizDifficulty,
      defaultQuestionCount: this.settings.defaultQuizQuestionCount,
      enableHints: this.settings.enableQuizHints,
      enableExplanations: this.settings.enableQuizExplanations,
      autoSaveResults: this.settings.autoSaveQuizResults
    };
  }

  /**
   * Get accessibility configuration
   */
  public getAccessibilityConfig(): {
    highContrast: boolean;
    largeText: boolean;
    reduceMotion: boolean;
  } {
    return this.settings.accessibilityOptions;
  }

  /**
   * Get privacy and data configuration
   */
  public getPrivacyConfig(): {
    enableLearningAnalytics: boolean;
    dataRetentionDays: number;
    enableCloudSync: boolean;
    privacyMode: boolean;
  } {
    return {
      enableLearningAnalytics: this.settings.enableLearningAnalytics,
      dataRetentionDays: this.settings.dataRetentionDays,
      enableCloudSync: this.settings.enableCloudSync,
      privacyMode: this.settings.privacyMode
    };
  }

  /**
   * Get highlight configuration
   */
  public getHighlightConfig(): {
    colors: string[];
    autoSave: boolean;
  } {
    return {
      colors: this.settings.highlightColors,
      autoSave: this.settings.autoSaveHighlights
    };
  }

  /**
   * Get chat configuration
   */
  public getChatConfig(): {
    position: 'left' | 'right';
    width: number;
    autoOpen: boolean;
  } {
    return {
      position: this.settings.chatSidebarPosition,
      width: this.settings.chatSidebarWidth,
      autoOpen: this.settings.autoOpenChat
    };
  }

  /**
   * Check if system prefers dark mode
   */
  public getSystemTheme(): 'light' | 'dark' {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  /**
   * Get effective theme (handles 'auto' setting)
   */
  public getEffectiveTheme(): 'light' | 'dark' {
    if (this.settings.theme === 'auto') {
      return this.getSystemTheme();
    }
    return this.settings.theme;
  }

  /**
   * Reset specific setting categories
   */
  public async resetCategory(category: 'ai' | 'quiz' | 'chat' | 'privacy' | 'accessibility'): Promise<void> {
    const defaults = this.getDefaultSettings();
    
    switch (category) {
      case 'ai':
        await this.update({
          maxTokens: defaults.maxTokens,
          temperature: defaults.temperature
        });
        break;
      case 'quiz':
        await this.update({
          defaultQuizDifficulty: defaults.defaultQuizDifficulty,
          defaultQuizQuestionCount: defaults.defaultQuizQuestionCount,
          enableQuizHints: defaults.enableQuizHints,
          enableQuizExplanations: defaults.enableQuizExplanations,
          autoSaveQuizResults: defaults.autoSaveQuizResults
        });
        break;
      case 'chat':
        await this.update({
          chatSidebarPosition: defaults.chatSidebarPosition,
          chatSidebarWidth: defaults.chatSidebarWidth,
          autoOpenChat: defaults.autoOpenChat
        });
        break;
      case 'privacy':
        await this.update({
          enableLearningAnalytics: defaults.enableLearningAnalytics,
          dataRetentionDays: defaults.dataRetentionDays,
          enableCloudSync: defaults.enableCloudSync,
          privacyMode: defaults.privacyMode
        });
        break;
      case 'accessibility':
        await this.update({
          accessibilityOptions: defaults.accessibilityOptions
        });
        break;
    }
  }

  /**
   * Clear all user data (for privacy mode)
   */
  public async clearUserData(): Promise<void> {
    try {
      // Clear local storage
      await chrome.storage.local.clear();
      // Clear sync storage
      await chrome.storage.sync.clear();
      // Reset settings to defaults
      this.settings = this.getDefaultSettings();
      await this.saveSettings();
    } catch (error) {
      console.error('Failed to clear user data:', error);
      throw new Error('Failed to clear user data');
    }
  }

  /**
   * Get data usage statistics
   */
  public async getDataUsage(): Promise<{
    localStorageSize: number;
    syncStorageSize: number;
    estimatedSize: string;
  }> {
    try {
      const localData = await chrome.storage.local.get(null);
      const syncData = await chrome.storage.sync.get(null);
      
      const localSize = JSON.stringify(localData).length;
      const syncSize = JSON.stringify(syncData).length;
      const totalSize = localSize + syncSize;
      
      const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };
      
      return {
        localStorageSize: localSize,
        syncStorageSize: syncSize,
        estimatedSize: formatSize(totalSize)
      };
    } catch (error) {
      console.error('Failed to get data usage:', error);
      return {
        localStorageSize: 0,
        syncStorageSize: 0,
        estimatedSize: '0 B'
      };
    }
  }

  /**
   * Export all user data as JSON
   */
  public async exportAllUserData(): Promise<string> {
    try {
      // Get all data from storage
      const [localData, syncData] = await Promise.all([
        chrome.storage.local.get(null),
        chrome.storage.sync.get(null)
      ]);
      
      // Filter out sensitive data and organize
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        settings: this.settings,
        highlights: localData.highlights || [],
        quizResults: localData.quizResults || [],
        chatHistory: localData.chatHistory || [],
        learningAnalytics: localData.learning_analytics || {},
        documentData: Object.keys(localData)
          .filter(key => key.startsWith('document_'))
          .reduce((acc, key) => {
            acc[key] = localData[key];
            return acc;
          }, {} as any)
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export user data:', error);
      throw new Error('Failed to export user data');
    }
  }

  /**
   * Import all user data from JSON
   */
  public async importAllUserData(jsonString: string): Promise<void> {
    try {
      const importData = JSON.parse(jsonString);
      
      // Validate import data structure
      if (!importData.version || !importData.settings) {
        throw new Error('Invalid import data format');
      }
      
      // Import settings
      if (importData.settings) {
        this.settings = { ...this.getDefaultSettings(), ...importData.settings };
        await this.saveSettings();
      }
      
      // Import other data
      const dataToImport: any = {};
      
      if (importData.highlights) {
        dataToImport.highlights = importData.highlights;
      }
      
      if (importData.quizResults) {
        dataToImport.quizResults = importData.quizResults;
      }
      
      if (importData.chatHistory) {
        dataToImport.chatHistory = importData.chatHistory;
      }
      
      if (importData.learningAnalytics) {
        dataToImport.learning_analytics = importData.learningAnalytics;
      }
      
      if (importData.documentData) {
        Object.assign(dataToImport, importData.documentData);
      }
      
      // Save imported data to local storage
      if (Object.keys(dataToImport).length > 0) {
        await chrome.storage.local.set(dataToImport);
      }
      
      console.log('LearnSphere: User data imported successfully');
    } catch (error) {
      console.error('Failed to import user data:', error);
      throw new Error('Failed to import user data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Validate all settings and return any validation errors
   */
  public validateSettings(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate API key if provided
    if (this.settings.geminiApiKey && !this.validateApiKey(this.settings.geminiApiKey)) {
      errors.push('Invalid Gemini API key format');
    }
    
    // Validate numeric ranges
    if (this.settings.maxTokens < 100 || this.settings.maxTokens > 8192) {
      errors.push('Max tokens must be between 100 and 8192');
    }
    
    if (this.settings.temperature < 0 || this.settings.temperature > 1) {
      errors.push('Temperature must be between 0 and 1');
    }
    
    if (this.settings.chatSidebarWidth < 300 || this.settings.chatSidebarWidth > 600) {
      errors.push('Chat sidebar width must be between 300 and 600 pixels');
    }
    
    if (this.settings.defaultQuizQuestionCount < 1 || this.settings.defaultQuizQuestionCount > 50) {
      errors.push('Default quiz question count must be between 1 and 50');
    }
    
    if (this.settings.dataRetentionDays < 0 || this.settings.dataRetentionDays > 3650) {
      errors.push('Data retention days must be between 0 and 3650 (10 years)');
    }
    
    // Validate highlight colors
    if (!Array.isArray(this.settings.highlightColors) || this.settings.highlightColors.length === 0) {
      errors.push('At least one highlight color must be specified');
    }
    
    // Validate language code
    const validLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ja'];
    if (!validLanguages.includes(this.settings.language)) {
      errors.push('Invalid language code');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get settings summary for display
   */
  public getSettingsSummary(): {
    totalSettings: number;
    configuredSettings: number;
    criticalSettings: string[];
    warnings: string[];
  } {
    const criticalSettings: string[] = [];
    const warnings: string[] = [];
    
    // Check critical settings
    if (!this.settings.geminiApiKey) {
      criticalSettings.push('Gemini API Key not configured');
    }
    
    if (this.settings.enableCloudSync && !this.settings.geminiApiKey) {
      warnings.push('Cloud sync enabled but API key not configured');
    }
    
    if (this.settings.privacyMode && this.settings.enableLearningAnalytics) {
      warnings.push('Privacy mode enabled but learning analytics still active');
    }
    
    // Count configured vs total settings
    const totalSettings = Object.keys(this.settings).length;
    const configuredSettings = Object.values(this.settings).filter(value => 
      value !== '' && value !== null && value !== undefined
    ).length;
    
    return {
      totalSettings,
      configuredSettings,
      criticalSettings,
      warnings
    };
  }
}
