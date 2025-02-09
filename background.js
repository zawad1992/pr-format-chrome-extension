// Initialize the side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'addTicketToFormat') {
      chrome.storage.local.get('pendingTickets', (result) => {
          const pendingTickets = result.pendingTickets || [];
          pendingTickets.push({
              action: 'add',
              ...message.ticket
          });
          chrome.storage.local.set({ pendingTickets });
      });
  } else if (message.action === 'removeTicketFromFormat') {
      chrome.storage.local.get('pendingTickets', (result) => {
          const pendingTickets = result.pendingTickets || [];
          pendingTickets.push({
              action: 'remove',
              ...message.ticket
          });
          chrome.storage.local.set({ pendingTickets });
      });
  }
});
