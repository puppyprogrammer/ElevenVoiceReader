// Background service worker

console.log('**ElevenVoiceReader SW loaded**');

function createContextMenu() {
  chrome.contextMenus.remove('brave-voice-reader', () => {
    chrome.contextMenus.create({
      id: 'brave-voice-reader',
      title: '🔊 Read Aloud with ElevenVoiceReader',
      contexts: ['selection']
    });
    console.log('**Context menu created**');
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('**Background: Menu clicked**', info.menuItemId, 'text length:', info.selectionText?.length, 'tab:', tab.id);
  
  if (info.menuItemId === 'brave-voice-reader') {
    try {
      const text = info.selectionText.trim();
      console.log('**Dispatching TTS**', text.substring(0, 50) + '...');
      
      chrome.tabs.sendMessage(tab.id, {
        action: 'initiateTTS',
        text
      }).then(() => console.log('**Message sent success**'))
        .catch(err => console.error('**Send message failed**', err));
    } catch (error) {
      console.error('**Dispatch error**', error);
    }
  } else {
    console.log('**Unknown menu ID**', info.menuItemId);
  }
});

// Handle messages from popup (for controls)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'controlAudio') {
    chrome.tabs.sendMessage(sender.tab.id, {
      action: request.control // 'pauseAudio', 'stopAudio', etc.
    }, { frameId: sender.frameId });
    sendResponse({ success: true });
  }
});