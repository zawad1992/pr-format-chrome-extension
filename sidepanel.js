document.addEventListener('DOMContentLoaded', function() {
    // Restore saved data when popup opens
    restoreSavedData();

    // Check for pending tickets periodically
    setInterval(checkPendingTickets, 1000);


    // Handle project prefix selection
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('project-prefix')) {
            const ticketContainer = e.target.closest('.ticket-container');
            const ticketNumber = ticketContainer.querySelector('.ticket-number');
            const ticketUrl = ticketContainer.querySelector('.ticket-url');
            
            if (e.target.value === 'N/A') {
                ticketNumber.value = 'N/A';
                ticketNumber.readOnly = true;
                ticketUrl.value = '';
                ticketUrl.readOnly = true;
            } else {
                ticketNumber.value = '';
                ticketNumber.readOnly = false;
                ticketUrl.value = '';
                ticketUrl.readOnly = false;
            }
            saveFormData();
        }
    });
    
    // Type selection
    const typeButtons = document.querySelectorAll('.type-tag');
    typeButtons.forEach(button => {
        button.addEventListener('click', function() {
            this.classList.toggle('selected');
        });
    });

    // Add ticket
    document.getElementById('addTicket').addEventListener('click', function() {
        const newTicket = `
            <div class="ticket-container mb-2">
                <div class="row g-2">
                    <div class="col-2">
                        <select class="form-select project-prefix">
                            <option value="">SELECT</option>
                            <option value="DRCOOL">DRCOOL</option>
                            <option value="IP">IP</option>
                            <option value="N/A">N/A</option>
                        </select>
                    </div>
                    <div class="col-3">
                        <input type="text" class="form-control ticket-number" placeholder="1234 or N/A">
                    </div>
                    <div class="col">
                        <input type="text" class="form-control ticket-url" placeholder="Jira URL">
                    </div>
                    <div class="col-auto">
                        <button class="btn btn-danger remove-ticket">×</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('ticketsContainer').insertAdjacentHTML('beforeend', newTicket);
    });

    // Remove ticket
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-ticket')) {
            const ticketContainers = document.querySelectorAll('.ticket-container');
            if (ticketContainers.length > 1) {
                e.target.closest('.ticket-container').remove();
                saveFormData();
            }
        }
    });

    // Save data when input changes
    document.addEventListener('input', function(e) {
        if (e.target.matches('input, textarea, select')) {
            saveFormData();
        }
    });

    // Function to save form data
    function saveFormData() {
      const formData = {
          selectedTypes: Array.from(document.querySelectorAll('.type-tag.selected')).map(tag => tag.textContent),
          title: document.getElementById('title').value,
          summary: document.getElementById('summary').value,
          tickets: Array.from(document.querySelectorAll('.ticket-container')).map(container => ({
              prefix: container.querySelector('.project-prefix').value,
              number: container.querySelector('.ticket-number').value,
              url: container.querySelector('.ticket-url').value
          })),
          latestCode: document.getElementById('latestCode').checked,
          ticketsAddressed: document.getElementById('ticketsAddressed').checked
      };

      chrome.storage.local.set({ formData: formData });
    }
    

    // Function to restore saved data
    function restoreSavedData() {
      chrome.storage.local.get('formData', function(result) {
          if (result.formData) {
              const data = result.formData;

              // Restore selected types
              document.querySelectorAll('.type-tag').forEach(tag => {
                  if (data.selectedTypes.includes(tag.textContent)) {
                      tag.classList.add('selected');
                  }
              });

              // Restore title and summary
              document.getElementById('title').value = data.title || '';
              document.getElementById('summary').value = data.summary || '';

              // Remove default ticket container
              document.getElementById('ticketsContainer').innerHTML = '';

              // Restore tickets
              data.tickets.forEach(ticket => {
                  const newTicket = `
                      <div class="ticket-container mb-2">
                          <div class="row g-2">
                              <div class="col-2">
                                  <select class="form-select project-prefix">
                                      <option value="">SELECT</option>
                                      <option value="DRCOOL" ${ticket.prefix === 'DRCOOL' ? 'selected' : ''}>DRCOOL</option>
                                      <option value="N/A" ${ticket.prefix === 'N/A' ? 'selected' : ''}>N/A</option>
                                  </select>
                              </div>
                              <div class="col-3">
                                  <input type="text" class="form-control ticket-number" placeholder="1234 or N/A" value="${ticket.number}" ${ticket.prefix === 'N/A' ? 'readonly' : ''}>
                              </div>
                              <div class="col">
                                  <input type="text" class="form-control ticket-url" placeholder="Jira URL" value="${ticket.url}" ${ticket.prefix === 'N/A' ? 'readonly' : ''}>
                              </div>
                              <div class="col-auto">
                                  <button class="btn btn-danger remove-ticket">×</button>
                              </div>
                          </div>
                      </div>
                  `;
                  document.getElementById('ticketsContainer').insertAdjacentHTML('beforeend', newTicket);
              });

              // Restore checkboxes
              document.getElementById('latestCode').checked = data.latestCode;
              document.getElementById('ticketsAddressed').checked = data.ticketsAddressed;

              // Generate the format to show the output
              document.getElementById('generate').click();
          }
      });
    }


    // Generate format
    document.getElementById('generate').addEventListener('click', function() {
        // Collect selected types
        const types = Array.from(document.querySelectorAll('.type-tag.selected'))
            .map(tag => tag.textContent);

        // Collect tickets
        const tickets = Array.from(document.querySelectorAll('.ticket-container'))
            .map(container => {
                const prefix = container.querySelector('.project-prefix').value;
                if (prefix === 'N/A') {
                    return { id: 'N/A', url: '' };
                }
                
                const number = container.querySelector('.ticket-number').value;
                const url = container.querySelector('.ticket-url').value;
                const id = prefix ? `${prefix}-${number}` : number;

                return { id, url };
            })
            .filter(t => t.id);

        // Get checklist status
        const latestCode = document.getElementById('latestCode').checked ? 'Yes' : 'No';
        const ticketsAddressed = document.getElementById('ticketsAddressed').checked ? 'Yes' : 'No';

        // Generate title
        const typeStr = types.length ? `[${types.join(', ')}]` : '';
        const ticketStr = tickets.map(t => t.id).join(', ');
        const customTitle = document.getElementById('title').value;
        const titleContent = `${typeStr} ${ticketStr}: ${customTitle}`.trim();

        // Process summary with line breaks
        const summaryText = document.getElementById('summary').value
            .split('\n')
            .map(line => line.trim() ? `- ${line}` : '')
            .filter(Boolean)
            .join('\n');

        // Generate Jira tickets section with special handling for N/A
        const ticketSection = tickets.map(t => {
            const trimmedUrl = t.url.trim();
            if (t.id.trim().toLowerCase() === 'n/a') {
                return `- ${t.id}`;
            }
            return `- [${t.id}](${trimmedUrl})`;
        }).join('\n');

        // Generate description
        const descriptionContent = `# Summary
${summaryText}

# Jira Tickets
${ticketSection}

# Checklist (Yes / No)
- Pull the latest code from dev. ${latestCode}
- All tickets are addressed. ${ticketsAddressed}`;

        // Display results
        document.getElementById('titleOutput').textContent = titleContent;
        document.getElementById('descriptionOutput').textContent = descriptionContent;
    });

    // Copy title to clipboard
    document.getElementById('copyTitle').addEventListener('click', function() {
        const titleText = document.getElementById('titleOutput').textContent;
        navigator.clipboard.writeText(titleText).then(function() {
            const successMessage = document.querySelector('.copy-success-title');
            successMessage.style.display = 'inline';
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 2000);
        });
    });

    // Copy description to clipboard
    document.getElementById('copyDescription').addEventListener('click', function() {
        const descriptionText = document.getElementById('descriptionOutput').textContent;
        navigator.clipboard.writeText(descriptionText).then(function() {
            const successMessage = document.querySelector('.copy-success-desc');
            successMessage.style.display = 'inline';
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 2000);
        });
    });


  // Add this with your other event listeners
  document.getElementById('clearForm').addEventListener('click', function() {
    // Clear selected types
    document.querySelectorAll('.type-tag.selected').forEach(tag => {
        tag.classList.remove('selected');
    });

    // Clear title and summary
    document.getElementById('title').value = '';
    document.getElementById('summary').value = '';

    // Reset tickets container to initial state
    document.getElementById('ticketsContainer').innerHTML = `
        <div class="ticket-container mb-2">
            <div class="row g-2">
                <div class="col-2">
                    <select class="form-select project-prefix">
                        <option value="">SELECT</option>
                        <option value="DRCOOL">DRCOOL</option>
                        <option value="N/A">N/A</option>
                    </select>
                </div>
                <div class="col-3">
                    <input type="text" class="form-control ticket-number" placeholder="1234 or N/A">
                </div>
                <div class="col">
                    <input type="text" class="form-control ticket-url" placeholder="Jira URL">
                </div>
                <div class="col-auto">
                    <button class="btn btn-danger remove-ticket">×</button>
                </div>
            </div>
        </div>
    `;

    // Clear checkboxes
    document.getElementById('latestCode').checked = false;
    document.getElementById('ticketsAddressed').checked = false;

    // Clear outputs
    document.getElementById('titleOutput').textContent = '';
    document.getElementById('descriptionOutput').textContent = '';

    // Clear stored data
    chrome.storage.local.remove('formData');
  });


  function checkPendingTickets() {
    chrome.storage.local.get(['pendingTickets', 'formData'], (result) => {
        const pendingTickets = result.pendingTickets || [];
        const formData = result.formData || { tickets: [] };
        
        if (pendingTickets.length > 0) {
            pendingTickets.forEach(ticket => {
                if (ticket.action === 'add') {
                    // Find first empty ticket container or add new one
                    let targetContainer = Array.from(document.querySelectorAll('.ticket-container'))
                        .find(container => {
                            const prefix = container.querySelector('.project-prefix').value;
                            const number = container.querySelector('.ticket-number').value;
                            return !prefix && !number;
                        });
                    
                    // If no empty container found, add new one
                    if (!targetContainer) {
                        document.getElementById('addTicket').click();
                        targetContainer = document.querySelector('.ticket-container:last-child');
                    }
                    
                    // Extract project prefix and number
                    const [prefix, number] = ticket.id.split('-');
                    
                    // Set values
                    targetContainer.querySelector('.project-prefix').value = prefix;
                    targetContainer.querySelector('.ticket-number').value = number;
                    targetContainer.querySelector('.ticket-url').value = ticket.url;
                    
                    // Add ticket title to summary if not already present
                    const summaryElem = document.getElementById('summary');
                    const summaryLines = summaryElem.value.split('\n');
                    const ticketHeader = `${ticket.id}: ${ticket.title}`;
                    
                    if (!summaryLines.includes(ticketHeader)) {
                        summaryElem.value = summaryElem.value
                            ? `${summaryElem.value}\n${ticketHeader}`
                            : ticketHeader;
                    }
                } else if (ticket.action === 'remove') {
                  // Find and remove the ticket
                  const containers = document.querySelectorAll('.ticket-container');
                  containers.forEach(container => {
                      const prefix = container.querySelector('.project-prefix').value;
                      const number = container.querySelector('.ticket-number').value;
                      const ticketId = `${prefix}-${number}`;
                      
                      if (ticketId === ticket.id) {
                          // Remove the container if it's not the last one
                          if (containers.length > 1) {
                              container.remove();
                          } else {
                              // Clear the fields if it's the last container
                              container.querySelector('.project-prefix').value = '';
                              container.querySelector('.ticket-number').value = '';
                              container.querySelector('.ticket-url').value = '';
                          }
                          
                          // Remove ticket header from summary
                          const summaryElem = document.getElementById('summary');
                          const summaryLines = summaryElem.value.split('\n');
                          const ticketHeader = `${ticket.id}: ${ticket.title}`;
                          const filteredLines = summaryLines.filter(line => !line.startsWith(ticketId));
                          summaryElem.value = filteredLines.join('\n');
                      }
                  });
                }
            });
            
            // Clear pending tickets and save form data
            chrome.storage.local.set({ 
                pendingTickets: [],
                formData: { ...formData, tickets: getTicketsFromForm() }
            });
            
            // Update output
            document.getElementById('generate').click();
        }
    });
  }

  // Helper function to get current tickets from form
  function getTicketsFromForm() {
      return Array.from(document.querySelectorAll('.ticket-container'))
          .map(container => ({
              prefix: container.querySelector('.project-prefix').value,
              number: container.querySelector('.ticket-number').value,
              url: container.querySelector('.ticket-url').value
          }))
          .filter(ticket => ticket.prefix && ticket.number);
  }
});