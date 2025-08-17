// Simple, reliable background script based on working Application Buddy pattern
console.log('🚀 LearnSphere: Background script starting...');

// Create context menus when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('🚀 LearnSphere: Extension installed/updated, creating context menus...');
  createContextMenus();
});

// Create context menus
function createContextMenus() {
  try {
    // Remove existing menus first
    chrome.contextMenus.removeAll(() => {
      console.log('🚀 LearnSphere: Existing context menus removed');
      
      // Create main menu
      chrome.contextMenus.create({
        id: 'learnsphere-main',
        title: '🚀 LearnSphere',
        contexts: ['all']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('🚀 LearnSphere: Error creating main menu:', chrome.runtime.lastError);
        } else {
          console.log('🚀 LearnSphere: Main context menu created');
          
          // Create sub-menus
          const subMenus = [
            {
              id: 'learnsphere-chat',
              parentId: 'learnsphere-main',
              title: '💬 Chat about this',
              contexts: ['selection' as chrome.contextMenus.ContextType]
            },
            {
              id: 'learnsphere-summary',
              parentId: 'learnsphere-main',
              title: '📝 Generate Summary',
              contexts: ['selection' as chrome.contextMenus.ContextType]
            },
            {
              id: 'learnsphere-quiz',
              parentId: 'learnsphere-main',
              title: '🧠 Create Quiz',
              contexts: ['selection' as chrome.contextMenus.ContextType]
            },
            {
              id: 'learnsphere-open-sidebar',
              parentId: 'learnsphere-main',
              title: '🚀 Open LearnSphere Sidebar',
              contexts: ['all' as chrome.contextMenus.ContextType]
            }
          ];
          
          subMenus.forEach(menu => {
            chrome.contextMenus.create(menu, () => {
              if (chrome.runtime.lastError) {
                console.error('🚀 LearnSphere: Error creating sub-menu:', menu.id, chrome.runtime.lastError);
              } else {
                console.log('🚀 LearnSphere: Sub-menu created:', menu.id);
              }
            });
          });
        }
      });
    });
  } catch (error) {
    console.error('🚀 LearnSphere: Error creating context menus:', error);
  }
}

// Helper function to ensure content script is injected
async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    // First, try to ping the content script
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    console.log('🚀 LearnSphere: Content script already loaded');
    return true;
  } catch (error) {
    console.log('🚀 LearnSphere: Content script not loaded, injecting now...');
    try {
      // Inject the content script
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      console.log('🚀 LearnSphere: Content script injected successfully');
      
      // Wait longer for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to ping the content script to confirm it's ready
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        console.log('🚀 LearnSphere: Content script confirmed ready');
        return true;
      } catch (pingError) {
        console.warn('🚀 LearnSphere: Content script not responding to ping after injection');
        return false;
      }
    } catch (injectError) {
      console.error('🚀 LearnSphere: Failed to inject content script:', injectError);
      return false;
    }
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('🚀 LearnSphere: Context menu clicked:', info.menuItemId, 'on tab:', tab?.id);
  
  // Get the current active tab if the context menu tab is invalid
  let targetTabId = tab?.id;
  
  if (!targetTabId || targetTabId < 0) {
    try {
      // Get the current active tab instead
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      targetTabId = activeTab?.id;
      console.log(' LearnSphere: Using active tab ID:', targetTabId);
    } catch (error) {
      console.error('🚀 LearnSphere: Failed to get active tab:', error);
      return;
    }
  }
  
  if (!targetTabId || targetTabId < 0) {
    console.error('🚀 LearnSphere: No valid tab ID available');
    return;
  }
  
  try {
    // Check if we can access the tab
    const tabInfo = await chrome.tabs.get(targetTabId);
    if (!tabInfo) {
      console.error('🚀 LearnSphere: Tab not accessible:', targetTabId);
      return;
    }
    
    // Check if this is a restricted URL
    if (tabInfo.url?.startsWith('chrome://') || 
        tabInfo.url?.startsWith('chrome-extension://') ||
        tabInfo.url?.startsWith('edge://') ||
        tabInfo.url?.startsWith('about:')) {
      console.error('🚀 LearnSphere: Cannot inject content script on restricted page:', tabInfo.url);
      return;
    }
    // If it's a file:// URL, ensure "Allow access to file URLs" is enabled, otherwise content scripts cannot run
    if (tabInfo.url?.startsWith('file://')) {
      console.warn('🚀 LearnSphere: Page is a local file. Ensure "Allow access to file URLs" is enabled for this extension.');
    }
    
    // Ensure content script is loaded
    const scriptLoaded = await ensureContentScript(targetTabId);
    if (!scriptLoaded) {
      console.error('🚀 LearnSphere: Could not load content script');
      return;
    }
    
    // Handle different menu actions
    switch (info.menuItemId) {
      case 'learnsphere-chat':
        if (info.selectionText) {
          console.log('🚀 LearnSphere: Chat requested for selection:', info.selectionText.substring(0, 50) + '...');
          // Store selection and open sidebar
          await chrome.storage.local.set({
            'selectedText': info.selectionText,
            'pendingAction': 'chat',
            'timestamp': Date.now()
          });
          // Open sidebar
          try {
            await chrome.tabs.sendMessage(targetTabId, { action: 'openChatSidebar', selection: info.selectionText });
            console.log('🚀 LearnSphere: Chat sidebar message sent successfully');
          } catch (error) {
            console.error('🚀 LearnSphere: Failed to send chat sidebar message:', error);
          }
        }
        break;
        
      case 'learnsphere-summary':
        if (info.selectionText) {
          console.log('🚀 LearnSphere: Summary requested for selection');
          await chrome.storage.local.set({
            'selectedText': info.selectionText,
            'pendingAction': 'summary',
            'timestamp': Date.now()
          });
          try {
            await chrome.tabs.sendMessage(targetTabId, { action: 'generateSummary', selection: info.selectionText });
            console.log('🚀 LearnSphere: Summary message sent successfully');
          } catch (error) {
            console.error('🚀 LearnSphere: Failed to send summary message:', error);
          }
        }
        break;
        
      case 'learnsphere-quiz':
        if (info.selectionText) {
          console.log('🚀 LearnSphere: Quiz requested for selection');
          await chrome.storage.local.set({
            'selectedText': info.selectionText,
            'pendingAction': 'quiz',
            'timestamp': Date.now()
          });
          try {
            await chrome.tabs.sendMessage(targetTabId, { action: 'generateQuiz', selection: info.selectionText });
            console.log('🚀 LearnSphere: Quiz message sent successfully');
          } catch (error) {
            console.error('🚀 LearnSphere: Failed to send quiz message:', error);
          }
        }
        break;
        
      case 'learnsphere-open-sidebar':
        console.log('🚀 LearnSphere: Opening sidebar via context menu');
        try {
          await chrome.tabs.sendMessage(targetTabId, { action: 'openChatSidebar' });
          console.log('🚀 LearnSphere: Open sidebar message sent successfully');
        } catch (error) {
          console.error('🚀 LearnSphere: Failed to send open sidebar message:', error);
        }
        break;
        
      default:
        console.log('🚀 LearnSphere: Unknown context menu action:', info.menuItemId);
    }
  } catch (error) {
    console.error(' LearnSphere: Error handling context menu action:', error);
  }
});

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🚀 LearnSphere: Background received message:', message);
  
  switch (message.action) {
    case 'testServiceWorker':
      sendResponse({ 
        success: true, 
        message: 'Service worker is working!', 
        timestamp: new Date().toISOString() 
      });
      break;
      
    case 'openSidebar':
      // Handle sidebar opening request
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, { action: 'openChatSidebar' })
          .then(() => {
            sendResponse({ success: true, message: 'Sidebar opening request sent' });
          })
          .catch((error) => {
            console.error('🚀 LearnSphere: Failed to send sidebar opening request:', error);
            sendResponse({ success: false, message: 'Failed to send sidebar request: ' + error.message });
          });
      } else {
        sendResponse({ success: false, message: 'No valid tab ID' });
      }
      break;
      
    default:
      sendResponse({ success: false, message: 'Unknown action' });
  }
  
  return true; // Keep message channel open for async response
});

console.log('🚀 LearnSphere: Background script setup complete!');
