import React, { useState, useEffect } from 'react';
import { SettingsService } from '@/services/SettingsService';
import './Popup.css';

const Popup: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isValidKey, setIsValidKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [apiKeyWorking, setApiKeyWorking] = useState(false);
  const [settingsService] = useState(() => SettingsService.getInstance());

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    console.log('LearnSphere Popup: Loading settings...');
    
    // Force reload settings from storage
    await settingsService.reloadSettings();
    
    const currentApiKey = settingsService.getGeminiApiKey();
    console.log('LearnSphere Popup: Retrieved API key:', currentApiKey ? 'EXISTS' : 'NOT FOUND');
    
    setApiKey(currentApiKey || '');
    const isValid = settingsService.validateApiKey(currentApiKey);
    setIsValidKey(isValid);
    
    console.log('LearnSphere Popup: API key valid:', isValid);
    
    // Test if the API key is actually working
    if (isValid && currentApiKey) {
      try {
        console.log('LearnSphere Popup: Testing API key...');
        const testResult = await settingsService.testApiKey(currentApiKey);
        console.log('LearnSphere Popup: API key test result:', testResult);
        
        setApiKeyWorking(testResult.valid);
        
        // Check if extension is already active on current page
        if (testResult.valid) {
          await checkExtensionStatus();
          
          // If extension is already active, close popup immediately
          if (apiKeyWorking) {
            setMessage('Extension is already active! Closing popup...');
            setTimeout(() => {
              window.close();
            }, 1500);
          }
        }
      } catch (error) {
        console.error('LearnSphere Popup: Error testing API key:', error);
        setApiKeyWorking(false);
      }
    } else {
      console.log('LearnSphere Popup: API key not valid or missing');
      setApiKeyWorking(false);
    }
  };

  const checkExtensionStatus = async () => {
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.id) {
        // Check if we're on a PDF page
        if (tab.url && tab.url.toLowerCase().includes('.pdf')) {
          // Send message to content script to check if it's already active
          const response = await chrome.tabs.sendMessage(tab.id, { 
            action: 'checkExtensionStatus'
          });
          
          if (response && response.active) {
            // Extension is already active, update UI accordingly
            setMessage('Extension is already active on this page! Closing popup...');
            
            // Show that the extension is ready to use
            setApiKeyWorking(true);
            
            // Close popup after showing the message
            setTimeout(() => {
              window.close();
            }, 2000);
          }
        } else {
          // Not on a PDF page
          setMessage('Navigate to a PDF page to use LearnSphere');
          setTimeout(() => setMessage(''), 3000);
        }
      }
    } catch (error) {
      // Content script not loaded yet, which is normal for non-PDF pages
      console.log('Extension status check: Content script not loaded yet');
    }
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newApiKey = e.target.value;
    setApiKey(newApiKey);
    setIsValidKey(settingsService.validateApiKey(newApiKey));
    setMessage('');
    // Reset working status when user changes the key
    setApiKeyWorking(false);
  };

  const handleSaveApiKey = async () => {
    if (!isValidKey) {
      setMessage('Please enter a valid Gemini API key');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      await settingsService.setGeminiApiKey(apiKey);
      
      // Test the API key by making a simple request
      const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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

      if (testResponse.ok) {
        setMessage('API key saved and tested successfully!');
        setApiKeyWorking(true);
        
        // Activate the extension by sending message to content script
        await activateExtension();
        
        // Refresh the settings to update the UI state
        await loadSettings();
        
        // Show success message and close popup after a short delay
        setTimeout(() => {
          setMessage('Extension activated! Closing popup...');
          setTimeout(() => {
            window.close();
          }, 1000);
        }, 2000);
      } else {
        setMessage('API key saved but test failed. Please check your key.');
        setApiKeyWorking(false);
        // Clear error message after 5 seconds
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      setMessage('Failed to save API key. Please try again.');
      console.error('Error saving API key:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const activateExtension = async () => {
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.id) {
        // Send message to content script to activate the extension
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'activateExtension',
          apiKey: apiKey 
        });
        
        // Also send a message to show that the extension is ready
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'showReadyMessage',
          message: 'LearnSphere is now active! Select text in the PDF to start learning.'
        });
      }
    } catch (error) {
      console.log('Extension activation message sent (content script may not be loaded yet)');
    }
  };

  const handleClearApiKey = async () => {
    setIsLoading(true);
    try {
      await settingsService.setGeminiApiKey('');
      setApiKey('');
      setIsValidKey(false);
      setMessage('API key cleared successfully!');
    } catch (error) {
      setMessage('Failed to clear API key. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualInject = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        console.log('LearnSphere: Manually injecting content script...');
        
        // Inject content script
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        // Inject CSS
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        });
        
        setMessage('Content script injected successfully! Check console for LearnSphere messages.');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('LearnSphere: Manual injection failed:', error);
      setMessage('Manual injection failed. Check console for details.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const openSidebar = async () => {
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        setMessage('No active tab found. Please refresh and try again.');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        setMessage('Cannot open sidebar on this page. Please navigate to a regular webpage.');
        setTimeout(() => setMessage(''), 5000);
        return;
      }
      
      console.log('LearnSphere Popup: Attempting to open sidebar on tab:', tab.id, 'URL:', tab.url);
      
      // Always inject content script to ensure it's loaded
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('LearnSphere Popup: Content script injected successfully');
        
        // Also inject CSS
        try {
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content.css']
          });
          console.log('LearnSphere Popup: CSS injected successfully');
        } catch (cssError) {
          console.log('LearnSphere Popup: CSS injection failed (may already be loaded):', cssError);
        }
        
      } catch (injectionError) {
        console.log('LearnSphere Popup: Content script may already be loaded:', injectionError);
      }
      
      // Wait for content script to initialize and set up message listeners
      console.log('LearnSphere Popup: Waiting for content script to initialize...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now try to send the message with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      let response = null;
      
      while (retryCount < maxRetries && !response) {
        try {
          console.log(`LearnSphere Popup: Attempt ${retryCount + 1} to send message...`);
          response = await chrome.tabs.sendMessage(tab.id, { 
            action: 'openChatSidebar'
          });
          console.log('LearnSphere Popup: Sidebar response received:', response);
          break;
        } catch (messageError) {
          retryCount++;
          console.log(`LearnSphere Popup: Message attempt ${retryCount} failed:`, messageError);
          
          if (retryCount < maxRetries) {
            console.log('LearnSphere Popup: Retrying in 500ms...');
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      if (response && response.success) {
        setMessage('✅ Sidebar opened successfully!');
        setTimeout(() => {
          setMessage('');
          window.close(); // Close popup after success
        }, 1500);
      } else {
        setMessage('Sidebar opened but may not be fully functional. Check the page for the sidebar.');
        setTimeout(() => setMessage(''), 3000);
      }
      
    } catch (error) {
      console.error('LearnSphere Popup: Error opening sidebar:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('Could not establish connection')) {
        setMessage('❌ Content script not loaded. Try refreshing the page or use "Inject Content Script" button.');
        setTimeout(() => setMessage(''), 5000);
      } else if (errorMessage.includes('Receiving end does not exist')) {
        setMessage('❌ Content script not responding. Use "Inject Content Script" button to fix this.');
        setTimeout(() => setMessage(''), 5000);
      } else {
        setMessage(`❌ Failed to open sidebar: ${errorMessage}`);
        setTimeout(() => setMessage(''), 5000);
      }
    }
  };

  // Debug actions removed per request to keep popup clean

  return (
    <div className="popup">
      <div className="popup-header">
        <h1>LearnSphere</h1>
        <p>AI-Powered PDF Learning Assistant</p>
      </div>

      <div className="popup-content">
        <div className="api-key-section">
          <h3>Gemini API Configuration</h3>
          <p className="description">
            Enter your Google Gemini API key to enable AI features. 
            Get your key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.
          </p>
          
          <div className="input-group">
            <input
              type="password"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="Enter your Gemini API key"
              className={isValidKey ? 'valid' : apiKey ? 'invalid' : ''}
            />
            <div className="validation-indicator">
              {isValidKey && <span className="valid">✓</span>}
              {apiKey && !isValidKey && <span className="invalid">✗</span>}
            </div>
          </div>

          <div className="button-group">
            <button 
              onClick={handleSaveApiKey} 
              disabled={!isValidKey || isLoading}
              className="primary-button"
            >
              {isLoading ? 'Saving...' : 'Save API Key'}
            </button>
            <button 
              onClick={handleClearApiKey} 
              disabled={!apiKey || isLoading}
              className="secondary-button"
            >
              Clear
            </button>
          </div>

          {message && (
            <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
        </div>

        <div className="features-section">
          <h3>Features</h3>
          <ul>
            <li>✅ PDF Viewer Override</li>
            <li>✅ Text & Area Selection</li>
            <li>✅ Highlighting System</li>
            <li>✅ Chat Sidebar</li>
            <li>{apiKeyWorking ? '✅' : '❌'} AI Chat (Gemini)</li>
            <li>{apiKeyWorking ? '✅' : '❌'} Document Summaries</li>
            <li>{apiKeyWorking ? '✅' : '❌'} Quiz Generation</li>
          </ul>
          
          {/* API Status */}
          <div className={`api-status ${apiKeyWorking ? 'active' : 'warning'}`}>
            <div className="status-indicator">
              {apiKeyWorking ? '✅' : '⚠️'}
            </div>
            <span>
              {apiKeyWorking ? 'API Key Active & Working' : 'API Key Saved but Not Working'}
            </span>
          </div>

          {/* Extension Status */}
          {apiKeyWorking && (
            <div className="extension-status">
              <div className="status-indicator active">
                🚀
              </div>
              <span>Extension Ready to Use</span>
            </div>
          )}

          {/* User Instructions */}
          {apiKeyWorking && (
            <div className="user-instructions">
              <h3>🎯 How to Use LearnSphere:</h3>
              <ol>
                <li><strong>Select Text:</strong> Click and drag to select any text in the PDF</li>
                <li><strong>Chat Button:</strong> A "💬 Chat about this" button will appear above your selection</li>
                <li><strong>Click to Chat:</strong> Click the button to open the AI chat sidebar</li>
                <li><strong>Ask Questions:</strong> Ask the AI about the selected text, request summaries, or generate quizzes</li>
              </ol>
              <div className="instruction-note">
                💡 <strong>Tip:</strong> The popup will close automatically so you can start using the extension!
              </div>
            </div>
          )}
        </div>

        <div className="actions-section">
          <button onClick={openOptions} className="secondary-button">
            Open Settings
          </button>
          <button onClick={loadSettings} className="refresh-button">
            Refresh Status
          </button>
          {apiKeyWorking && (
            <>
              <button onClick={activateExtension} className="activate-button">
                Activate Extension
              </button>
              <button onClick={openSidebar} className="primary-button">
                🚀 Open LearnSphere Sidebar
              </button>
            </>
          )}
          {/* Removed debug buttons to simplify UI */}
        </div>
      </div>

      <div className="popup-footer">
        <p>Select text in any PDF to start learning!</p>
      </div>
    </div>
  );
};

export default Popup;
