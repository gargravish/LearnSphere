import React, { useState, useEffect } from 'react';
import { SettingsService } from '@/services/SettingsService';
import './SettingsPage.css';

interface SettingsPageProps {
  onClose?: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
  const [settingsService] = useState(() => SettingsService.getInstance());
  const [settings, setSettings] = useState(settingsService.getAll());
  const [activeTab, setActiveTab] = useState('general');
  const [dataUsage, setDataUsage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [settingsSummary, setSettingsSummary] = useState<any>(null);

  useEffect(() => {
    loadDataUsage();
    loadSettingsSummary();
  }, []);

  const loadDataUsage = async () => {
    try {
      const usage = await settingsService.getDataUsage();
      setDataUsage(usage);
    } catch (error) {
      console.error('Failed to load data usage:', error);
    }
  };

  const loadSettingsSummary = async () => {
    try {
      const summary = settingsService.getSettingsSummary();
      try {
        if (!summary.criticalSettings || summary.criticalSettings.length > 0) {
          const sync = await chrome.storage.sync.get('learnsphere_settings');
          const local = await chrome.storage.local.get('learnsphere_settings');
          const hasKey = !!(sync?.learnsphere_settings?.geminiApiKey || local?.learnsphere_settings?.geminiApiKey);
          if (hasKey && Array.isArray(summary.criticalSettings)) {
            summary.criticalSettings = summary.criticalSettings.filter((s: string) => !s.includes('Gemini API Key'));
          }
        }
      } catch {}
      setSettingsSummary(summary);
    } catch (error) {
      console.error('Failed to load settings summary:', error);
    }
  };

  const handleSettingChange = async <K extends keyof typeof settings>(
    key: K,
    value: typeof settings[K]
  ) => {
    try {
      await settingsService.set(key, value);
      setSettings({ ...settings, [key]: value });
      loadSettingsSummary(); // Update summary after setting change
      setMessage('Setting updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to update setting');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleAccessibilityChange = async (key: keyof typeof settings.accessibilityOptions, value: boolean) => {
    const newAccessibility = { ...settings.accessibilityOptions, [key]: value };
    await handleSettingChange('accessibilityOptions', newAccessibility);
    loadSettingsSummary(); // Update summary after accessibility change
  };

  const handleResetCategory = async (category: 'ai' | 'quiz' | 'chat' | 'privacy' | 'accessibility') => {
    try {
      setIsLoading(true);
      await settingsService.resetCategory(category);
      setSettings(settingsService.getAll());
      setMessage(`${category} settings reset to defaults`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to reset settings');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearUserData = async () => {
    if (window.confirm('Are you sure you want to clear all user data? This action cannot be undone.')) {
      try {
        setIsLoading(true);
        await settingsService.clearUserData();
        setSettings(settingsService.getAll());
        setMessage('All user data cleared successfully');
        setTimeout(() => setMessage(''), 3000);
        await loadDataUsage();
      } catch (error) {
        setMessage('Failed to clear user data');
        setTimeout(() => setMessage(''), 3000);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleExportSettings = async () => {
    try {
      setIsLoading(true);
      const dataStr = await settingsService.exportAllUserData();
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `learnsphere-data-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('All data exported successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to export data');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          setIsLoading(true);
          const content = e.target?.result as string;
          await settingsService.importAllUserData(content);
          setSettings(settingsService.getAll());
          await loadDataUsage();
          setMessage('All data imported successfully');
          setTimeout(() => setMessage(''), 3000);
        } catch (error) {
          setMessage('Failed to import data: ' + (error instanceof Error ? error.message : 'Unknown error'));
          setTimeout(() => setMessage(''), 5000);
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'ai', label: 'AI Settings', icon: '🤖' },
    { id: 'quiz', label: 'Quiz Settings', icon: '🧠' },
    { id: 'chat', label: 'Chat Settings', icon: '💬' },
    { id: 'privacy', label: 'Privacy & Data', icon: '🔒' },
    { id: 'accessibility', label: 'Accessibility', icon: '♿' },
    { id: 'highlights', label: 'Highlights', icon: '🖍️' }
  ];

  const renderGeneralTab = () => (
    <div className="settings-tab">
      <h3>General Settings</h3>
      
      {settingsSummary && (
        <div className="settings-summary">
          <h4>Settings Overview</h4>
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-label">Configured:</span>
              <span className="stat-value">{settingsSummary.configuredSettings}/{settingsSummary.totalSettings}</span>
            </div>
            {settingsSummary.criticalSettings.length > 0 && (
              <div className="critical-warnings">
                <span className="warning-icon">⚠️</span>
                <span className="warning-text">Critical settings missing</span>
              </div>
            )}
            {settingsSummary.warnings.length > 0 && (
              <div className="warnings">
                <span className="warning-icon">ℹ️</span>
                <span className="warning-text">{settingsSummary.warnings.length} warning(s)</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="setting-group">
        <label>Theme</label>
        <select
          value={settings.theme}
          onChange={(e) => handleSettingChange('theme', e.target.value as 'light' | 'dark' | 'auto')}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">Auto (System)</option>
        </select>
        <p className="setting-description">Choose your preferred theme</p>
      </div>

      <div className="setting-group">
        <label>Language</label>
        <select
          value={settings.language}
          onChange={(e) => handleSettingChange('language', e.target.value)}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="zh">中文</option>
          <option value="ja">日本語</option>
        </select>
        <p className="setting-description">Select your preferred language</p>
      </div>

      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.enableNotifications}
            onChange={(e) => handleSettingChange('enableNotifications', e.target.checked)}
          />
          Enable Notifications
        </label>
        <p className="setting-description">Show notifications for important events</p>
      </div>
    </div>
  );

  const renderAITab = () => (
    <div className="settings-tab">
      <h3>AI Configuration</h3>
      
      <div className="setting-group">
        <label>Gemini API Key</label>
        <div className="api-key-input-group">
          <input
            type="password"
            value={settings.geminiApiKey}
            onChange={(e) => handleSettingChange('geminiApiKey', e.target.value)}
            placeholder="Enter your Gemini API key"
          />
          <button
            className="test-api-button"
            onClick={async () => {
              if (settings.geminiApiKey) {
                setIsLoading(true);
                try {
                  const result = await settingsService.testApiKey(settings.geminiApiKey);
                  if (result.valid) {
                    setMessage('API key is valid!');
                  } else {
                    setMessage(`API key test failed: ${result.error}`);
                  }
                } catch (error) {
                  setMessage('Failed to test API key');
                } finally {
                  setIsLoading(false);
                  setTimeout(() => setMessage(''), 5000);
                }
              }
            }}
            disabled={!settings.geminiApiKey || isLoading}
          >
            Test
          </button>
        </div>
        <p className="setting-description">
          Get your API key from{' '}
          <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
            Google AI Studio
          </a>
        </p>
      </div>

      <div className="setting-group">
        <label>Max Tokens</label>
        <input
          type="number"
          value={settings.maxTokens}
          onChange={(e) => handleSettingChange('maxTokens', parseInt(e.target.value))}
          min="100"
          max="8192"
          step="100"
        />
        <p className="setting-description">Maximum tokens for AI responses (100-8192)</p>
      </div>

      <div className="setting-group">
        <label>Temperature</label>
        <input
          type="range"
          value={settings.temperature}
          onChange={(e) => handleSettingChange('temperature', parseFloat(e.target.value))}
          min="0"
          max="1"
          step="0.1"
        />
        <span className="range-value">{settings.temperature}</span>
        <p className="setting-description">Controls randomness in AI responses (0 = focused, 1 = creative)</p>
      </div>

      <button
        className="reset-button"
        onClick={() => handleResetCategory('ai')}
        disabled={isLoading}
      >
        Reset AI Settings
      </button>
    </div>
  );

  const renderQuizTab = () => (
    <div className="settings-tab">
      <h3>Quiz Configuration</h3>
      
      <div className="setting-group">
        <label>Default Difficulty</label>
        <select
          value={settings.defaultQuizDifficulty}
          onChange={(e) => handleSettingChange('defaultQuizDifficulty', e.target.value as 'easy' | 'medium' | 'hard')}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <p className="setting-description">Default difficulty for generated quizzes</p>
      </div>

      <div className="setting-group">
        <label>Default Question Count</label>
        <select
          value={settings.defaultQuizQuestionCount}
          onChange={(e) => handleSettingChange('defaultQuizQuestionCount', parseInt(e.target.value))}
        >
          <option value="5">5 Questions</option>
          <option value="10">10 Questions</option>
          <option value="15">15 Questions</option>
          <option value="20">20 Questions</option>
        </select>
        <p className="setting-description">Default number of questions per quiz</p>
      </div>

      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.enableQuizHints}
            onChange={(e) => handleSettingChange('enableQuizHints', e.target.checked)}
          />
          Enable Quiz Hints
        </label>
        <p className="setting-description">Show helpful hints during quizzes</p>
      </div>

      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.enableQuizExplanations}
            onChange={(e) => handleSettingChange('enableQuizExplanations', e.target.checked)}
          />
          Enable Quiz Explanations
        </label>
        <p className="setting-description">Show explanations for correct answers</p>
      </div>

      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.autoSaveQuizResults}
            onChange={(e) => handleSettingChange('autoSaveQuizResults', e.target.checked)}
          />
          Auto-save Quiz Results
        </label>
        <p className="setting-description">Automatically save quiz results for analysis</p>
      </div>

      <button
        className="reset-button"
        onClick={() => handleResetCategory('quiz')}
        disabled={isLoading}
      >
        Reset Quiz Settings
      </button>
    </div>
  );

  const renderChatTab = () => (
    <div className="settings-tab">
      <h3>Chat Sidebar Configuration</h3>
      
      <div className="setting-group">
        <label>Sidebar Position</label>
        <select
          value={settings.chatSidebarPosition}
          onChange={(e) => handleSettingChange('chatSidebarPosition', e.target.value as 'left' | 'right')}
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
        <p className="setting-description">Choose where the chat sidebar appears</p>
      </div>

      <div className="setting-group">
        <label>Sidebar Width</label>
        <input
          type="range"
          value={settings.chatSidebarWidth}
          onChange={(e) => handleSettingChange('chatSidebarWidth', parseInt(e.target.value))}
          min="300"
          max="600"
          step="25"
        />
        <span className="range-value">{settings.chatSidebarWidth}px</span>
        <p className="setting-description">Adjust the width of the chat sidebar</p>
      </div>

      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.autoOpenChat}
            onChange={(e) => handleSettingChange('autoOpenChat', e.target.checked)}
          />
          Auto-open Chat
        </label>
        <p className="setting-description">Automatically open chat when selecting text</p>
      </div>

      <button
        className="reset-button"
        onClick={() => handleResetCategory('chat')}
        disabled={isLoading}
      >
        Reset Chat Settings
      </button>
    </div>
  );

  const renderPrivacyTab = () => (
    <div className="settings-tab">
      <h3>Privacy & Data Management</h3>
      
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.enableLearningAnalytics}
            onChange={(e) => handleSettingChange('enableLearningAnalytics', e.target.checked)}
          />
          Enable Learning Analytics
        </label>
        <p className="setting-description">Track learning progress and performance</p>
      </div>

      <div className="setting-group">
        <label>Data Retention Period</label>
        <select
          value={settings.dataRetentionDays}
          onChange={(e) => handleSettingChange('dataRetentionDays', parseInt(e.target.value))}
        >
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="180">180 days</option>
          <option value="365">1 year</option>
          <option value="0">Keep forever</option>
        </select>
        <p className="setting-description">How long to keep your learning data</p>
      </div>

      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.enableCloudSync}
            onChange={(e) => handleSettingChange('enableCloudSync', e.target.checked)}
          />
          Enable Cloud Sync
        </label>
        <p className="setting-description">Sync settings across devices (requires Google account)</p>
      </div>

      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.privacyMode}
            onChange={(e) => handleSettingChange('privacyMode', e.target.checked)}
          />
          Privacy Mode
        </label>
        <p className="setting-description">Minimize data collection and storage</p>
      </div>

      {dataUsage && (
        <div className="data-usage">
          <h4>Data Usage</h4>
          <p>Local Storage: {dataUsage.estimatedSize}</p>
          <button
            className="danger-button"
            onClick={handleClearUserData}
            disabled={isLoading}
          >
            Clear All User Data
          </button>
        </div>
      )}

      <button
        className="reset-button"
        onClick={() => handleResetCategory('privacy')}
        disabled={isLoading}
      >
        Reset Privacy Settings
      </button>
    </div>
  );

  const renderAccessibilityTab = () => (
    <div className="settings-tab">
      <h3>Accessibility Options</h3>
      
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.accessibilityOptions.highContrast}
            onChange={(e) => handleAccessibilityChange('highContrast', e.target.checked)}
          />
          High Contrast Mode
        </label>
        <p className="setting-description">Increase contrast for better visibility</p>
      </div>

      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.accessibilityOptions.largeText}
            onChange={(e) => handleAccessibilityChange('largeText', e.target.checked)}
          />
          Large Text
        </label>
        <p className="setting-description">Increase text size for better readability</p>
      </div>

      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.accessibilityOptions.reduceMotion}
            onChange={(e) => handleAccessibilityChange('reduceMotion', e.target.checked)}
          />
          Reduce Motion
        </label>
        <p className="setting-description">Minimize animations and transitions</p>
      </div>

      <button
        className="reset-button"
        onClick={() => handleResetCategory('accessibility')}
        disabled={isLoading}
      >
        Reset Accessibility Settings
      </button>
    </div>
  );

  const renderHighlightsTab = () => (
    <div className="settings-tab">
      <h3>Highlight Configuration</h3>
      
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.autoSaveHighlights}
            onChange={(e) => handleSettingChange('autoSaveHighlights', e.target.checked)}
          />
          Auto-save Highlights
        </label>
        <p className="setting-description">Automatically save highlights to storage</p>
      </div>

      <div className="setting-group">
        <label>Highlight Colors</label>
        <div className="color-picker">
          {settings.highlightColors.map((color, index) => (
            <input
              key={index}
              type="color"
              value={color}
              onChange={(e) => {
                const newColors = [...settings.highlightColors];
                newColors[index] = e.target.value;
                handleSettingChange('highlightColors', newColors);
              }}
              title={`Color ${index + 1}`}
            />
          ))}
        </div>
        <p className="setting-description">Customize the colors available for highlighting</p>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralTab();
      case 'ai':
        return renderAITab();
      case 'quiz':
        return renderQuizTab();
      case 'chat':
        return renderChatTab();
      case 'privacy':
        return renderPrivacyTab();
      case 'accessibility':
        return renderAccessibilityTab();
      case 'highlights':
        return renderHighlightsTab();
      default:
        return renderGeneralTab();
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>LearnSphere Settings</h1>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="settings-content">
        <div className="settings-sidebar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="settings-main">
          {renderTabContent()}
        </div>
      </div>

      <div className="settings-footer">
        <div className="import-export">
          <label className="import-button">
            Import All Data
            <input
              type="file"
              accept=".json"
              onChange={handleImportSettings}
              style={{ display: 'none' }}
            />
          </label>
          <button className="export-button" onClick={handleExportSettings}>
            Export All Data
          </button>
        </div>

        <div className="reset-all">
          <button
            className="reset-all-button"
            onClick={() => settingsService.reset()}
            disabled={isLoading}
          >
            Reset All Settings
          </button>
        </div>

        {message && (
          <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
