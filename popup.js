document.addEventListener('DOMContentLoaded', function() {
    // Restore saved data when popup opens
    restoreSavedData();


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
});