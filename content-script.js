// content-script.js

// Configuration and constants
const CONFIG = {
    BUTTON_STYLES: {
        ADD: {
            background: '#a103fc',
            text: '+ PR'
        },
        REMOVE: {
            background: '#DE350B',
            text: '- PR'
        }
    },
    SELECTORS: {
        TITLE: 'h1[data-testid="issue.views.issue-base.foundation.summary.heading"]',
        BUTTON_CONTAINER: '[data-testid="issue.views.issue-base.foundation.status.actions-wrapper"]',
        EXISTING_BUTTON: '.pr-format-btn'
    },
    BUTTON_CLASS: 'pr-format-btn',
    DELAY: 1000
};

// Utility functions
const log = (message, error = false) => {
    const method = error ? 'error' : 'log';
    console[method](`[PR Format Extension] ${message}`);
};

const createButton = (isAdded = false) => {
    const button = document.createElement('button');
    const config = isAdded ? CONFIG.BUTTON_STYLES.REMOVE : CONFIG.BUTTON_STYLES.ADD;
    
    button.className = `${CONFIG.BUTTON_CLASS} ${isAdded ? 'remove' : 'add'}`;
    button.innerHTML = config.text;
    button.style.cssText = `
        padding: 0 8px;
        height: 32px;
        border-radius: 3px;
        background: ${config.background};
        color: white;
        border: none;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        margin-left: 8px;
        transition: background-color 0.2s;
    `;
    
    return button;
};

const getTicketInfo = () => {
    let ticketId = null;
    
    // Check URL path first (for direct ticket views)
    const urlMatch = window.location.pathname.match(/\/browse\/([A-Z]+-\d+)/);
    if (urlMatch) {
        ticketId = urlMatch[1];
    }
    
    // If not found, check query parameters (for backlog/board views)
    if (!ticketId) {
        const params = new URLSearchParams(window.location.search);
        ticketId = params.get('selectedIssue');
    }
    
    if (!ticketId) {
        log('Could not find ticket ID in URL or query parameters', true);
        return null;
    }
    
    const titleElement = document.querySelector(CONFIG.SELECTORS.TITLE);
    const ticketTitle = titleElement?.textContent?.trim() || '';
    const ticketUrl = window.location.origin + '/browse/' + ticketId;
    
    return {
        id: ticketId,
        title: ticketTitle,
        url: ticketUrl
    };
};

const checkExistingTickets = async (ticketId) => {
    const result = await chrome.storage.local.get('formData');
    const addedTickets = new Set(
        (result.formData?.tickets || [])
            .map(ticket => ticket.prefix && ticket.number ? `${ticket.prefix}-${ticket.number}` : null)
            .filter(Boolean)
    );
    return addedTickets.has(ticketId);
};

const handleClick = async (ticketInfo, isAdded) => {
    const newPendingTicket = {
        action: isAdded ? 'remove' : 'add',
        ...ticketInfo
    };

    // Get current pending tickets and form data
    const result = await chrome.storage.local.get(['pendingTickets', 'formData']);
    const pendingTickets = result.pendingTickets || [];
    const formData = result.formData || { tickets: [] };

    console.log('pendingTickets', pendingTickets);  
    // Check if ticket is already in form data
    const ticketExists = formData.tickets.some(ticket => 
        `${ticket.prefix}-${ticket.number}` === ticketInfo.id
    );

    // Only proceed if we're removing an existing ticket or adding a new one
    if ((isAdded && ticketExists) || (!isAdded && !ticketExists)) {
        // Remove any pending tickets for this ID
        const filteredPendingTickets = pendingTickets.filter(ticket => 
            ticket.id !== ticketInfo.id
        );
        
        // Add the new pending ticket
        filteredPendingTickets.push(newPendingTicket);
        await chrome.storage.local.set({ pendingTickets: filteredPendingTickets });
    }

    // Send message to background script
    chrome.runtime.sendMessage({
        action: isAdded ? 'removeTicketFromFormat' : 'addTicketToFormat',
        ticket: ticketInfo
    });

    // Update button state
    updateButton(!isAdded);
};

const updateButton = (isAdded) => {
    const container = document.querySelector(CONFIG.SELECTORS.BUTTON_CONTAINER);
    const existingButton = container?.querySelector(CONFIG.SELECTORS.EXISTING_BUTTON);
    
    if (existingButton) {
        existingButton.remove();
    }
    
    if (container) {
        const newButton = createButton(isAdded);
        newButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const ticketInfo = getTicketInfo();
            if (ticketInfo) {
                console.log('ticketInfo', ticketInfo);
                await handleClick(ticketInfo, isAdded);
            }
        });
        container.appendChild(newButton);
    }
};

const addButtonToDetails = async () => {
    try {
        // Remove any existing buttons first
        const existingButtons = document.querySelectorAll(CONFIG.SELECTORS.EXISTING_BUTTON);
        existingButtons.forEach(button => button.remove());

        // Find the container for the button
        const container = document.querySelector(CONFIG.SELECTORS.BUTTON_CONTAINER);
        if (!container) {
            log('Button container not found, will retry...', true);
            return false;
        }

        // Get ticket information
        const ticketInfo = getTicketInfo();
        if (!ticketInfo) return false;

        // Check if ticket is already added
        const isAdded = await checkExistingTickets(ticketInfo.id);
        
        // Create and add button
        const button = createButton(isAdded);
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await handleClick(ticketInfo, isAdded);
        });
        
        container.appendChild(button);
        log('Button added successfully');
        return true;
        
    } catch (error) {
        log(`Error adding button: ${error.message}`, true);
        return false;
    }
};

// Setup observers and listeners
const setupObserver = () => {
    let buttonAddTimeout;
    
    const observer = new MutationObserver((mutations) => {
        // Clear any pending timeout
        if (buttonAddTimeout) {
            clearTimeout(buttonAddTimeout);
        }
        
        // Set a new timeout to add the button
        buttonAddTimeout = setTimeout(() => {
            const buttonContainer = document.querySelector(CONFIG.SELECTORS.BUTTON_CONTAINER);
            const existingButton = document.querySelector(CONFIG.SELECTORS.EXISTING_BUTTON);
            
            // Only add if container exists and button doesn't
            if (buttonContainer && !existingButton) {
                addButtonToDetails();
            }
        }, 100); // Small delay to prevent multiple executions
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
    
    return observer;
};

// Initialize the extension
const init = () => {
    setTimeout(async () => {
        const success = await addButtonToDetails();
        if (!success) {
            log('Initial button addition failed, setting up observer');
        }
        setupObserver();
    }, CONFIG.DELAY);

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.formData) {
            const ticketInfo = getTicketInfo();
            if (ticketInfo) {
                const isAdded = changes.formData.newValue?.tickets?.some(
                    ticket => `${ticket.prefix}-${ticket.number}` === ticketInfo.id
                );
                updateButton(isAdded);
            }
        }
    });
};

// Start the extension
init();