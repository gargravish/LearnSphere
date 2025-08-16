// Enhanced background script with persistence
console.log('🚀 LearnSphere: Background script starting...');

// Keep service worker alive
let keepAliveInterval: NodeJS.Timeout;

function keepAlive() {
  console.log('🚀 LearnSphere: Keeping service worker alive...');
  // This prevents the service worker from going inactive
}

// Start keep-alive mechanism
keepAliveInterval = setInterval(keepAlive, 25000); // Every 25 seconds

// Test basic Chrome API availability
try {
  console.log('🚀 LearnSphere: Chrome runtime available:', !!chrome.runtime);
  console.log('🚀 LearnSphere: Chrome runtime ID:', chrome.runtime.id);
} catch (error) {
  console.error('🚀 LearnSphere: Chrome runtime test failed:', error);
}

// Simple message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🚀 LearnSphere: Received message:', message);
  
  if (message.action === 'testServiceWorker') {
    console.log('🚀 LearnSphere: Service worker test successful!');
    sendResponse({ 
      success: true, 
      message: 'Service worker is working!',
      timestamp: new Date().toISOString()
    });
  }
  
  // Keep service worker alive on any message
  keepAlive();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('🚀 LearnSphere: Context menu clicked:', info.menuItemId);
  console.log('🚀 LearnSphere: Tab info:', tab);
  
  // Keep service worker alive
  keepAlive();
  
  // Check if we have a valid tab
  if (!tab) {
    console.log('🚀 LearnSphere: No tab object found');
    return;
  }
  
  if (!tab.id || tab.id === -1) {
    console.log('🚀 LearnSphere: Invalid tab ID:', tab.id);
    return;
  }
  
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    console.log('🚀 LearnSphere: Invalid tab URL for injection:', tab.url);
    return;
  }

  try {
    if (info.menuItemId === 'test-menu') {
      console.log('🚀 LearnSphere: Test menu clicked, injecting content script...');
      
      const tabId = tab.id; // Store tab ID in variable
      
      // Inject content script programmatically
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      console.log('🚀 LearnSphere: Content script injected successfully');
      
      // Also inject CSS
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content.css']
      });
      
      console.log('🚀 LearnSphere: CSS injected successfully');
      
      // Send a message to the content script to show it's working
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'showNotification',
            message: 'LearnSphere is now active on this page!'
          });
          console.log('🚀 LearnSphere: Notification message sent to content script');
        } catch (error) {
          console.error('🚀 LearnSphere: Error sending notification:', error);
        }
      }, 1000);
      
    } else if (info.menuItemId === 'page-menu') {
      console.log('🚀 LearnSphere: Page menu clicked, injecting content script...');
      
      const tabId = tab.id;
      
      // Inject content script for page-level actions
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      console.log('🚀 LearnSphere: Page content script injected successfully');
      
      // Send page-level activation message
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'showNotification',
            message: 'LearnSphere activated for page-level features!'
          });
        } catch (error) {
          console.error('🚀 LearnSphere: Error sending page message:', error);
        }
      }, 1000);
    }
  } catch (error) {
    console.error('🚀 LearnSphere: Error handling context menu action:', error);
    console.error('🚀 LearnSphere: Error details:', {
      tabId: tab?.id,
      tabUrl: tab?.url,
      menuItemId: info.menuItemId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('🚀 LearnSphere: Extension installed/updated, setting up context menus...');
  setupContextMenus();
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('🚀 LearnSphere: Extension starting up...');
  setupContextMenus();
});

// Setup context menus function
function setupContextMenus() {
  try {
    // Remove existing menus first
    chrome.contextMenus.removeAll(() => {
      console.log('🚀 LearnSphere: Existing context menus cleared');
      
      // Create test menu for text selection
      chrome.contextMenus.create({
        id: 'test-menu',
        title: '🚀 Test LearnSphere',
        contexts: ['selection']
      });
      
      // Create page-level menu
      chrome.contextMenus.create({
        id: 'page-menu',
        title: '🚀 LearnSphere Page Tools',
        contexts: ['page']
      });
      
      console.log('🚀 LearnSphere: Context menus created successfully');
    });
  } catch (error) {
    console.error('🚀 LearnSphere: Context menu creation failed:', error);
  }
}

// Initial setup
setupContextMenus();

// Simple tab update listener for PDFs
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('🚀 LearnSphere: Tab updated:', tab.url);
    
    // Check if this is a PDF page
    if (tab.url.toLowerCase().includes('.pdf') || 
        tab.url.includes('application/pdf') ||
        tab.url.startsWith('file://')) {
      
      console.log('🚀 LearnSphere: PDF page detected, will inject content script...');
      
      // Simple injection after a delay
      setTimeout(async () => {
        try {
          console.log('🚀 LearnSphere: Injecting content script on PDF...');
          
          // Inject content script
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          });
          console.log('🚀 LearnSphere: Content script injected on PDF load');
          
          // Inject CSS
          await chrome.scripting.insertCSS({
            target: { tabId: tabId },
            files: ['content.css']
          });
          console.log('🚀 LearnSphere: CSS injected on PDF load');
          
          console.log('🚀 LearnSphere: PDF injection complete');
          
        } catch (error) {
          console.error('🚀 LearnSphere: Error injecting on PDF load:', error);
        }
      }, 3000); // Wait 3 seconds
      
    }
  }
  
  // Keep service worker alive
  keepAlive();
});

// Cleanup on unload
chrome.runtime.onSuspend.addListener(() => {
  console.log('🚀 LearnSphere: Service worker suspending, cleaning up...');
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
});

console.log('🚀 LearnSphere: Background script loaded successfully');
