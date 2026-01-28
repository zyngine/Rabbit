let currentGuild = null;
let currentPage = 'overview';
let userData = null;
let guildChannels = null;
let guildRoles = null;

async function init() {
  try {
    const response = await fetch('/api/user');
    if (!response.ok) {
      window.location.href = '/';
      return;
    }

    userData = await response.json();
    document.getElementById('username').textContent = userData.user.username;
    document.getElementById('user-avatar').src = userData.user.avatar
      ? `https://cdn.discordapp.com/avatars/${userData.user.id}/${userData.user.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.user.discriminator || '0') % 5}.png`;

    await loadGuilds();
    setupNavigation();
  } catch (error) {
    console.error('Init error:', error);
    window.location.href = '/';
  }
}

async function loadGuilds() {
  const guildList = document.getElementById('guild-list');

  try {
    const response = await fetch('/api/guilds');
    const guilds = await response.json();

    const botGuilds = guilds.filter(g => g.botInGuild);

    if (botGuilds.length === 0) {
      guildList.innerHTML = `
        <div class="empty-state">
          <p>No servers found</p>
          <a href="https://discord.com/api/oauth2/authorize?client_id=1462166761007878174&permissions=8&scope=bot%20applications.commands" class="btn btn-primary btn-small" target="_blank">Add Bot</a>
        </div>
      `;
      return;
    }

    guildList.innerHTML = botGuilds.map(guild => `
      <div class="guild-item" data-guild-id="${guild.id}">
        <div class="guild-icon">
          ${guild.icon
            ? `<img src="https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png" alt="">`
            : guild.name.charAt(0)
          }
        </div>
        <span class="guild-name">${guild.name}</span>
      </div>
    `).join('');

    document.querySelectorAll('.guild-item').forEach(item => {
      item.addEventListener('click', () => selectGuild(item.dataset.guildId, guilds));
    });

    if (botGuilds.length > 0) {
      selectGuild(botGuilds[0].id, guilds);
    }
  } catch (error) {
    console.error('Failed to load guilds:', error);
    guildList.innerHTML = '<p style="color: var(--danger);">Failed to load servers</p>';
  }
}

async function selectGuild(guildId, guilds) {
  currentGuild = guilds.find(g => g.id === guildId);

  document.querySelectorAll('.guild-item').forEach(item => {
    item.classList.toggle('active', item.dataset.guildId === guildId);
  });

  // Load channels and roles for this guild
  try {
    const [channelsRes, rolesRes] = await Promise.all([
      fetch(`/api/guild/${guildId}/channels`),
      fetch(`/api/guild/${guildId}/roles`)
    ]);

    if (channelsRes.ok) {
      guildChannels = await channelsRes.json();
    } else {
      guildChannels = { textChannels: [], categories: [] };
    }

    if (rolesRes.ok) {
      guildRoles = await rolesRes.json();
    } else {
      guildRoles = [];
    }
  } catch (e) {
    console.error('Failed to load guild data:', e);
    guildChannels = { textChannels: [], categories: [] };
    guildRoles = [];
  }

  loadPage(currentPage);
}

function setupNavigation() {
  document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;

      document.querySelectorAll('.sidebar-item[data-page]').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      currentPage = page;
      loadPage(page);
    });
  });
}

async function loadPage(page) {
  if (!currentGuild) {
    document.getElementById('content').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👈</div>
        <p>Select a server from the sidebar</p>
      </div>
    `;
    return;
  }

  document.getElementById('page-title').textContent = `${currentGuild.name} - ${page.charAt(0).toUpperCase() + page.slice(1)}`;

  switch (page) {
    case 'overview':
      await loadOverview();
      break;
    case 'tickets':
      await loadTickets();
      break;
    case 'applications':
      await loadApplications();
      break;
    case 'settings':
      await loadSettings();
      break;
  }
}

async function loadOverview() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const response = await fetch(`/api/guild/${currentGuild.id}/stats`);
    const stats = await response.json();

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.openTickets}</div>
          <div class="stat-label">Open Tickets</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">${stats.closedTickets}</div>
          <div class="stat-label">Closed Tickets</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.totalTickets}</div>
          <div class="stat-label">Total Tickets</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">${stats.pendingApplications}</div>
          <div class="stat-label">Pending Applications</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.avgRating || 'N/A'}</div>
          <div class="stat-label">Avg Rating</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Recent Tickets</h3>
        </div>
        <div class="card-body">
          ${stats.recentTickets.length > 0 ? `
            <table class="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                ${stats.recentTickets.map(ticket => `
                  <tr>
                    <td>${ticket.ticket_number}</td>
                    <td>${ticket.user_id}</td>
                    <td>${ticket.panel_type || 'Support'}</td>
                    <td><span class="badge badge-${ticket.status}">${ticket.status}</span></td>
                    <td>${new Date(ticket.created_at).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<div class="empty-state"><p>No tickets yet</p></div>'}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load overview:', error);
    content.innerHTML = '<div class="empty-state"><p>Failed to load data</p></div>';
  }
}

async function loadTickets() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const [ticketsRes, panelsRes, blacklistRes] = await Promise.all([
      fetch(`/api/guild/${currentGuild.id}/tickets`),
      fetch(`/api/guild/${currentGuild.id}/panels`),
      fetch(`/api/guild/${currentGuild.id}/blacklist`)
    ]);

    const ticketsData = await ticketsRes.json();
    const panels = await panelsRes.json();
    const blacklist = await blacklistRes.json();

    content.innerHTML = `
      <div class="tabs">
        <div class="tab active" data-tab="tickets">Tickets</div>
        <div class="tab" data-tab="panels">Panels (${panels.length})</div>
        <div class="tab" data-tab="blacklist">Blacklist (${blacklist.length})</div>
      </div>

      <div id="tab-content">
        ${renderTicketsTab(ticketsData)}
      </div>
    `;

    // Tab switching
    document.querySelectorAll('.tabs .tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabName = tab.dataset.tab;
        if (tabName === 'tickets') {
          document.getElementById('tab-content').innerHTML = renderTicketsTab(ticketsData);
          setupTicketFilters();
        } else if (tabName === 'panels') {
          document.getElementById('tab-content').innerHTML = renderPanelsTab(panels);
          setupPanelActions();
        } else if (tabName === 'blacklist') {
          document.getElementById('tab-content').innerHTML = renderBlacklistTab(blacklist);
          setupBlacklistActions();
        }
      });
    });

    setupTicketFilters();
  } catch (error) {
    console.error('Failed to load tickets:', error);
    content.innerHTML = '<div class="empty-state"><p>Failed to load tickets</p></div>';
  }
}

function renderTicketsTab(data) {
  return `
    <div class="filter-bar" style="margin-bottom: 16px;">
      <button class="btn btn-small filter-btn active" data-filter="">All</button>
      <button class="btn btn-small filter-btn" data-filter="open">Open</button>
      <button class="btn btn-small filter-btn" data-filter="closed">Closed</button>
    </div>
    <div class="card">
      <div class="card-body" id="tickets-table">
        ${renderTicketsTable(data.tickets)}
      </div>
    </div>
  `;
}

function setupTicketFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      const url = filter
        ? `/api/guild/${currentGuild.id}/tickets?status=${filter}`
        : `/api/guild/${currentGuild.id}/tickets`;

      const res = await fetch(url);
      const data = await res.json();
      document.getElementById('tickets-table').innerHTML = renderTicketsTable(data.tickets);
    });
  });
}

function renderPanelsTab(panels) {
  const channelOptions = guildChannels?.textChannels?.map(c =>
    `<option value="${c.id}">#${c.name}</option>`
  ).join('') || '';

  const categoryOptions = guildChannels?.categories?.map(c =>
    `<option value="${c.id}">${c.name}</option>`
  ).join('') || '';

  return `
    <div class="card">
      <div class="card-header">
        <h3>Ticket Panels</h3>
        <button class="btn btn-small btn-primary" onclick="showCreatePanelModal()">+ Create Panel</button>
      </div>
      <div class="card-body">
        ${panels.length > 0 ? `
          <table class="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Ticket Types</th>
                <th>Style</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${panels.map(panel => {
                const types = panel.ticket_types ? JSON.parse(panel.ticket_types) : [{ name: panel.panel_type, label: panel.button_label }];
                return `
                <tr>
                  <td>${panel.title}</td>
                  <td>${types.map(t => t.name).join(', ')}</td>
                  <td>${panel.style || 'buttons'}</td>
                  <td>${new Date(panel.created_at).toLocaleDateString()}</td>
                  <td>
                    <button class="btn btn-small btn-danger delete-panel" data-id="${panel.id}">Delete</button>
                  </td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
        ` : '<div class="empty-state"><p>No panels yet. Create one to get started!</p></div>'}
      </div>
    </div>

    <div id="create-panel-modal" class="modal" style="display:none;">
      <div class="modal-content" style="max-width: 600px;">
        <h3>Create Ticket Panel</h3>
        <div class="form-group">
          <label>Panel Title</label>
          <input type="text" id="panel-title" placeholder="Support Tickets" class="input">
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="panel-description" placeholder="Select a category below to create a ticket" class="input"></textarea>
        </div>
        <div class="form-group">
          <label>Display Style</label>
          <select id="panel-style" class="input">
            <option value="buttons">Buttons (up to 5 types)</option>
            <option value="select">Dropdown Menu (up to 25 types)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Channel to Post In</label>
          <select id="panel-channel" class="input">
            <option value="">Select a channel...</option>
            ${channelOptions}
          </select>
        </div>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <label style="margin: 0; font-weight: 600;">Ticket Types</label>
            <button class="btn btn-small btn-secondary" onclick="addTicketType()">+ Add Type</button>
          </div>
          <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">Each ticket type can have its own category where tickets are created.</p>
          <div id="ticket-types-list"></div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="hideModal('create-panel-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="createPanel()">Create Panel</button>
        </div>
      </div>
    </div>
  `;
}

function setupPanelActions() {
  document.querySelectorAll('.delete-panel').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this panel?')) return;

      const panelId = btn.dataset.id;
      await fetch(`/api/guild/${currentGuild.id}/panels/${panelId}`, { method: 'DELETE' });
      loadTickets();
    });
  });

  // Setup style change listener
  const styleSelect = document.getElementById('panel-style');
  if (styleSelect) {
    styleSelect.addEventListener('change', renderTicketTypesList);
  }
}

function renderBlacklistTab(blacklist) {
  return `
    <div class="card">
      <div class="card-header">
        <h3>Blacklisted Users</h3>
        <button class="btn btn-small btn-primary" onclick="showAddBlacklistModal()">Add User</button>
      </div>
      <div class="card-body">
        ${blacklist.length > 0 ? `
          <table class="table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Reason</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${blacklist.map(b => `
                <tr>
                  <td>${b.user_id}</td>
                  <td>${b.reason || 'No reason'}</td>
                  <td>${new Date(b.created_at).toLocaleDateString()}</td>
                  <td>
                    <button class="btn btn-small btn-danger remove-blacklist" data-id="${b.user_id}">Remove</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<div class="empty-state"><p>No blacklisted users</p></div>'}
      </div>
    </div>
    <div id="blacklist-modal" class="modal" style="display:none;">
      <div class="modal-content">
        <h3>Add to Blacklist</h3>
        <input type="text" id="blacklist-user-id" placeholder="User ID" class="input">
        <input type="text" id="blacklist-reason" placeholder="Reason (optional)" class="input">
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="hideModal('blacklist-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="addToBlacklist()">Add</button>
        </div>
      </div>
    </div>
  `;
}

function setupBlacklistActions() {
  document.querySelectorAll('.remove-blacklist').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.id;
      await fetch(`/api/guild/${currentGuild.id}/blacklist/${userId}`, { method: 'DELETE' });
      loadTickets();
    });
  });
}

function showAddBlacklistModal() {
  document.getElementById('blacklist-modal').style.display = 'flex';
}

function hideModal(id) {
  document.getElementById(id).style.display = 'none';
}

async function addToBlacklist() {
  const userId = document.getElementById('blacklist-user-id').value;
  const reason = document.getElementById('blacklist-reason').value;

  if (!userId) return alert('Please enter a user ID');

  await fetch(`/api/guild/${currentGuild.id}/blacklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, reason })
  });

  hideModal('blacklist-modal');
  loadTickets();
}

function renderTicketsTable(tickets) {
  if (tickets.length === 0) {
    return '<div class="empty-state"><div class="empty-state-icon">🎫</div><p>No tickets found</p></div>';
  }

  return `
    <table class="table">
      <thead>
        <tr>
          <th>#</th>
          <th>User ID</th>
          <th>Type</th>
          <th>Priority</th>
          <th>Status</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${tickets.map(ticket => `
          <tr>
            <td>${ticket.ticket_number}</td>
            <td>${ticket.user_id}</td>
            <td>${ticket.panel_type || 'Support'}</td>
            <td>${ticket.priority}</td>
            <td><span class="badge badge-${ticket.status}">${ticket.status}</span></td>
            <td>${new Date(ticket.created_at).toLocaleDateString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function loadApplications() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const [appsRes, typesRes] = await Promise.all([
      fetch(`/api/guild/${currentGuild.id}/applications`),
      fetch(`/api/guild/${currentGuild.id}/application-types`)
    ]);

    const appsData = await appsRes.json();
    const types = await typesRes.json();

    content.innerHTML = `
      <div class="tabs">
        <div class="tab active" data-tab="submissions">Submissions</div>
        <div class="tab" data-tab="types">Application Types (${types.length})</div>
      </div>

      <div id="app-tab-content">
        ${renderApplicationsTab(appsData, types)}
      </div>
    `;

    document.querySelectorAll('.tabs .tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabName = tab.dataset.tab;
        if (tabName === 'submissions') {
          document.getElementById('app-tab-content').innerHTML = renderApplicationsTab(appsData, types);
          setupAppFilters(types);
        } else if (tabName === 'types') {
          document.getElementById('app-tab-content').innerHTML = await renderAppTypesTab(types);
          setupAppTypeActions();
        }
      });
    });

    setupAppFilters(types);
  } catch (error) {
    console.error('Failed to load applications:', error);
    content.innerHTML = '<div class="empty-state"><p>Failed to load applications</p></div>';
  }
}

function renderApplicationsTab(data, types) {
  return `
    <div class="filter-bar" style="margin-bottom: 16px;">
      <button class="btn btn-small filter-btn active" data-filter="">All</button>
      <button class="btn btn-small filter-btn" data-filter="pending">Pending</button>
      <button class="btn btn-small filter-btn" data-filter="accepted">Accepted</button>
      <button class="btn btn-small filter-btn" data-filter="denied">Denied</button>
    </div>
    <div class="card">
      <div class="card-body" id="applications-table">
        ${renderApplicationsTable(data.applications)}
      </div>
    </div>
  `;
}

function setupAppFilters(types) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      const url = filter
        ? `/api/guild/${currentGuild.id}/applications?status=${filter}`
        : `/api/guild/${currentGuild.id}/applications`;

      const res = await fetch(url);
      const data = await res.json();
      document.getElementById('applications-table').innerHTML = renderApplicationsTable(data.applications);
    });
  });
}

async function renderAppTypesTab(types) {
  const channelOptions = guildChannels?.textChannels?.map(c =>
    `<option value="${c.id}">#${c.name}</option>`
  ).join('') || '';

  const roleOptions = guildRoles?.map(r =>
    `<option value="${r.id}">@${r.name}</option>`
  ).join('') || '';

  return `
    <div class="card">
      <div class="card-header">
        <h3>Application Types</h3>
        <button class="btn btn-small btn-primary" onclick="showCreateAppTypeModal()">Create New</button>
      </div>
      <div class="card-body">
        ${types.length > 0 ? types.map(type => `
          <div class="app-type-card" style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h4 style="margin-bottom: 4px;">${type.name} ${type.active ? '<span class="badge badge-open">Active</span>' : '<span class="badge badge-closed">Inactive</span>'}</h4>
                <p style="color: var(--text-secondary); font-size: 14px;">${type.description || 'No description'}</p>
                <p style="color: var(--text-secondary); font-size: 12px; margin-top: 8px;">
                  Questions: ${type.questionCount}/10 | Cooldown: ${type.cooldownHours}h | Creates Ticket: ${type.createTicket ? 'Yes' : 'No'}
                </p>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn btn-small btn-primary deploy-app-type" data-id="${type.id}" data-name="${type.name}" data-description="${type.description || ''}">Deploy</button>
                <button class="btn btn-small btn-secondary manage-questions" data-id="${type.id}" data-name="${type.name}">Questions</button>
                <button class="btn btn-small ${type.active ? 'btn-warning' : 'btn-success'} toggle-app-type" data-id="${type.id}" data-active="${type.active}">${type.active ? 'Disable' : 'Enable'}</button>
                <button class="btn btn-small btn-danger delete-app-type" data-id="${type.id}">Delete</button>
              </div>
            </div>
          </div>
        `).join('') : '<div class="empty-state"><p>No application types created</p></div>'}
      </div>
    </div>

    <div id="create-app-modal" class="modal" style="display:none;">
      <div class="modal-content" style="max-width: 500px;">
        <h3>Create Application Type</h3>
        <div class="form-group">
          <input type="text" id="app-name" placeholder="Name (e.g., Staff Application)" class="input">
        </div>
        <div class="form-group">
          <textarea id="app-description" placeholder="Description" class="input" rows="3"></textarea>
        </div>
        <div class="form-group">
          <input type="number" id="app-cooldown" placeholder="Cooldown (hours)" class="input" value="24">
        </div>
        <label style="display: flex; align-items: center; gap: 8px; margin: 12px 0;">
          <input type="checkbox" id="app-create-ticket" checked>
          Create ticket on submission
        </label>
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
          <h4 style="margin-bottom: 12px; font-size: 14px;">Auto-Assign Roles</h4>
          <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">Automatically assign roles based on application status (up to 2 per status)</p>
          <div class="form-group">
            <label style="font-size: 12px;">On Submit (Pending)</label>
            <div style="display: flex; gap: 8px;">
              <select id="app-pending-role-1" class="input">
                <option value="">None</option>
                ${roleOptions}
              </select>
              <select id="app-pending-role-2" class="input">
                <option value="">None</option>
                ${roleOptions}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label style="font-size: 12px;">On Accept</label>
            <div style="display: flex; gap: 8px;">
              <select id="app-accepted-role-1" class="input">
                <option value="">None</option>
                ${roleOptions}
              </select>
              <select id="app-accepted-role-2" class="input">
                <option value="">None</option>
                ${roleOptions}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label style="font-size: 12px;">On Deny</label>
            <div style="display: flex; gap: 8px;">
              <select id="app-denied-role-1" class="input">
                <option value="">None</option>
                ${roleOptions}
              </select>
              <select id="app-denied-role-2" class="input">
                <option value="">None</option>
                ${roleOptions}
              </select>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="hideModal('create-app-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="createAppType()">Create</button>
        </div>
      </div>
    </div>

    <div id="deploy-app-modal" class="modal" style="display:none;">
      <div class="modal-content">
        <h3>Deploy Application Panel</h3>
        <p style="color: var(--text-secondary); margin-bottom: 16px;">This will post an application panel to the selected channel where users can apply.</p>
        <input type="hidden" id="deploy-app-type-id">
        <div class="form-group">
          <label>Application Type</label>
          <input type="text" id="deploy-app-name" class="input" readonly>
        </div>
        <div class="form-group">
          <label>Panel Title</label>
          <input type="text" id="deploy-app-title" class="input" placeholder="Staff Applications">
        </div>
        <div class="form-group">
          <label>Panel Description</label>
          <textarea id="deploy-app-description" class="input" rows="3" placeholder="Click the button below to apply"></textarea>
        </div>
        <div class="form-group">
          <label>Button Label</label>
          <input type="text" id="deploy-app-button" class="input" value="Apply Now">
        </div>
        <div class="form-group">
          <label>Channel</label>
          <select id="deploy-app-channel" class="input">
            <option value="">Select a channel...</option>
            ${channelOptions}
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="hideModal('deploy-app-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="deployAppType()">Deploy</button>
        </div>
      </div>
    </div>

    <div id="questions-modal" class="modal" style="display:none;">
      <div class="modal-content" style="max-width: 600px;">
        <h3>Manage Questions - <span id="questions-app-name"></span></h3>
        <div id="questions-list"></div>
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
          <h4>Add Question</h4>
          <input type="text" id="new-question" placeholder="Question text" class="input">
          <select id="new-question-type" class="input">
            <option value="short">Short Text</option>
            <option value="paragraph">Paragraph</option>
          </select>
          <button class="btn btn-primary" onclick="addQuestion()">Add Question</button>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="hideModal('questions-modal')">Close</button>
        </div>
      </div>
    </div>
  `;
}

function setupAppTypeActions() {
  document.querySelectorAll('.toggle-app-type').forEach(btn => {
    btn.addEventListener('click', async () => {
      const typeId = btn.dataset.id;
      const currentActive = btn.dataset.active === 'true';

      await fetch(`/api/guild/${currentGuild.id}/application-types/${typeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive })
      });

      loadApplications();
    });
  });

  document.querySelectorAll('.delete-app-type').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this application type?')) return;

      const typeId = btn.dataset.id;
      await fetch(`/api/guild/${currentGuild.id}/application-types/${typeId}`, { method: 'DELETE' });
      loadApplications();
    });
  });

  document.querySelectorAll('.manage-questions').forEach(btn => {
    btn.addEventListener('click', async () => {
      const typeId = btn.dataset.id;
      const typeName = btn.dataset.name;
      await showQuestionsModal(typeId, typeName);
    });
  });

  document.querySelectorAll('.deploy-app-type').forEach(btn => {
    btn.addEventListener('click', () => {
      const typeId = btn.dataset.id;
      const typeName = btn.dataset.name;
      const typeDescription = btn.dataset.description;
      showDeployAppModal(typeId, typeName, typeDescription);
    });
  });
}

function showDeployAppModal(typeId, typeName, typeDescription) {
  document.getElementById('deploy-app-type-id').value = typeId;
  document.getElementById('deploy-app-name').value = typeName;
  document.getElementById('deploy-app-title').value = typeName;
  document.getElementById('deploy-app-description').value = typeDescription || 'Click the button below to submit your application.';
  document.getElementById('deploy-app-button').value = 'Apply Now';
  document.getElementById('deploy-app-channel').value = '';
  document.getElementById('deploy-app-modal').style.display = 'flex';
}

async function deployAppType() {
  const typeId = document.getElementById('deploy-app-type-id').value;
  const title = document.getElementById('deploy-app-title').value;
  const description = document.getElementById('deploy-app-description').value;
  const buttonLabel = document.getElementById('deploy-app-button').value || 'Apply Now';
  const channelId = document.getElementById('deploy-app-channel').value;

  if (!title) return alert('Please enter a title');
  if (!channelId) return alert('Please select a channel');

  try {
    const response = await fetch(`/api/guild/${currentGuild.id}/application-types/${typeId}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, buttonLabel, channelId })
    });

    const result = await response.json();
    if (response.ok) {
      hideModal('deploy-app-modal');
      alert('Application panel deployed successfully!');
    } else {
      alert(result.error || 'Failed to deploy application panel');
    }
  } catch (error) {
    console.error('Failed to deploy application:', error);
    alert('Failed to deploy application panel');
  }
}

let currentAppTypeId = null;

async function showQuestionsModal(typeId, typeName) {
  currentAppTypeId = typeId;
  document.getElementById('questions-app-name').textContent = typeName;

  const res = await fetch(`/api/guild/${currentGuild.id}/application-types/${typeId}/questions`);
  const questions = await res.json();

  document.getElementById('questions-list').innerHTML = questions.length > 0
    ? questions.map((q, i) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 8px;">
          <div>
            <strong>${i + 1}.</strong> ${q.question}
            <span style="color: var(--text-secondary); font-size: 12px;">(${q.question_type})</span>
          </div>
          <button class="btn btn-small btn-danger" onclick="deleteQuestion(${q.id})">Delete</button>
        </div>
      `).join('')
    : '<p style="color: var(--text-secondary);">No questions added yet</p>';

  document.getElementById('questions-modal').style.display = 'flex';
}

async function addQuestion() {
  const question = document.getElementById('new-question').value;
  const questionType = document.getElementById('new-question-type').value;

  if (!question) return alert('Please enter a question');

  await fetch(`/api/guild/${currentGuild.id}/application-types/${currentAppTypeId}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, questionType })
  });

  document.getElementById('new-question').value = '';
  showQuestionsModal(currentAppTypeId, document.getElementById('questions-app-name').textContent);
}

async function deleteQuestion(questionId) {
  await fetch(`/api/guild/${currentGuild.id}/application-types/${currentAppTypeId}/questions/${questionId}`, {
    method: 'DELETE'
  });
  showQuestionsModal(currentAppTypeId, document.getElementById('questions-app-name').textContent);
}

let panelTicketTypes = [];

function showCreatePanelModal() {
  panelTicketTypes = [];
  document.getElementById('ticket-types-list').innerHTML = '<p style="color: var(--text-secondary);">No ticket types added. Click "Add Type" to add one.</p>';
  document.getElementById('create-panel-modal').style.display = 'flex';
}

function addTicketType() {
  const style = document.getElementById('panel-style').value;
  const maxTypes = style === 'buttons' ? 5 : 25;

  if (panelTicketTypes.length >= maxTypes) {
    return alert(`Maximum ${maxTypes} ticket types for ${style} style`);
  }

  panelTicketTypes.push({
    id: Date.now(),
    name: '',
    label: '',
    description: '',
    emoji: '',
    color: 'primary',
    categoryId: '',
    supportRoles: []
  });

  renderTicketTypesList();
}

function removeTicketType(id) {
  panelTicketTypes = panelTicketTypes.filter(t => t.id !== id);
  renderTicketTypesList();
}

function updateTicketType(id, field, value) {
  const type = panelTicketTypes.find(t => t.id === id);
  if (type) {
    type[field] = value;
  }
}

function addTypeRole(typeId) {
  const select = document.getElementById(`add-role-${typeId}`);
  const roleId = select.value;
  if (!roleId) return;

  const type = panelTicketTypes.find(t => t.id === typeId);
  if (type) {
    if (!type.supportRoles) type.supportRoles = [];
    if (!type.supportRoles.includes(roleId)) {
      type.supportRoles.push(roleId);
      renderTicketTypesList();
    }
  }
}

function removeTypeRole(typeId, roleId) {
  const type = panelTicketTypes.find(t => t.id === typeId);
  if (type && type.supportRoles) {
    type.supportRoles = type.supportRoles.filter(r => r !== roleId);
    renderTicketTypesList();
  }
}

function renderTicketTypesList() {
  const list = document.getElementById('ticket-types-list');
  const style = document.getElementById('panel-style').value;

  if (panelTicketTypes.length === 0) {
    list.innerHTML = '<p style="color: var(--text-secondary);">No ticket types added. Click "Add Type" to add one.</p>';
    return;
  }

  const categoryOptions = guildChannels?.categories?.map(c =>
    `<option value="${c.id}">${c.name}</option>`
  ).join('') || '';

  list.innerHTML = panelTicketTypes.map((type, index) => `
    <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 500;">Type ${index + 1}</span>
        <button class="btn btn-small btn-danger" onclick="removeTicketType(${type.id})">Remove</button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <input type="text" placeholder="Type Name (e.g., support)" class="input"
          value="${type.name}" onchange="updateTicketType(${type.id}, 'name', this.value)">
        <input type="text" placeholder="Button/Option Label" class="input"
          value="${type.label}" onchange="updateTicketType(${type.id}, 'label', this.value)">
      </div>
      <div style="display: grid; grid-template-columns: ${style === 'buttons' ? '1fr 1fr 1fr' : '2fr 1fr 1fr'}; gap: 8px; margin-top: 8px;">
        ${style === 'select' ? `
          <input type="text" placeholder="Description (optional)" class="input"
            value="${type.description}" onchange="updateTicketType(${type.id}, 'description', this.value)">
        ` : ''}
        <input type="text" placeholder="Emoji (optional)" class="input"
          value="${type.emoji}" onchange="updateTicketType(${type.id}, 'emoji', this.value)">
        ${style === 'buttons' ? `
          <select class="input" onchange="updateTicketType(${type.id}, 'color', this.value)">
            <option value="primary" ${type.color === 'primary' ? 'selected' : ''}>Blue</option>
            <option value="success" ${type.color === 'success' ? 'selected' : ''}>Green</option>
            <option value="secondary" ${type.color === 'secondary' ? 'selected' : ''}>Gray</option>
            <option value="danger" ${type.color === 'danger' ? 'selected' : ''}>Red</option>
          </select>
        ` : ''}
        <select class="input" onchange="updateTicketType(${type.id}, 'categoryId', this.value)">
          <option value="">Use server default</option>
          ${guildChannels?.categories?.map(c =>
            `<option value="${c.id}" ${type.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`
          ).join('') || ''}
        </select>
      </div>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);">
        <label style="font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 6px;">Support Roles for this ticket type:</label>
        <div id="type-roles-${type.id}" style="margin-bottom: 8px; min-height: 24px;">
          ${(type.supportRoles || []).length > 0
            ? type.supportRoles.map(roleId => {
                const role = guildRoles?.find(r => r.id === roleId);
                return `
                  <span style="display: inline-flex; align-items: center; gap: 4px; background: var(--bg-secondary); padding: 3px 8px; border-radius: 4px; margin: 2px; font-size: 12px;">
                    <span style="color: ${role?.color || '#fff'}">${role?.name || roleId}</span>
                    <button onclick="removeTypeRole(${type.id}, '${roleId}')" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0; font-size: 14px;">×</button>
                  </span>
                `;
              }).join('')
            : '<span style="color: var(--text-secondary); font-size: 12px;">Uses global support roles</span>'
          }
        </div>
        <div style="display: flex; gap: 6px;">
          <select id="add-role-${type.id}" class="input" style="flex: 1; padding: 6px 10px; font-size: 12px;">
            <option value="">Add a support role...</option>
            ${guildRoles?.filter(r => !(type.supportRoles || []).includes(r.id)).map(r =>
              `<option value="${r.id}">${r.name}</option>`
            ).join('') || ''}
          </select>
          <button class="btn btn-small btn-secondary" onclick="addTypeRole(${type.id})" style="padding: 6px 12px;">Add</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function createPanel() {
  const title = document.getElementById('panel-title').value;
  const description = document.getElementById('panel-description').value;
  const style = document.getElementById('panel-style').value;
  const channelId = document.getElementById('panel-channel').value;

  if (!title) return alert('Please enter a title');
  if (!channelId) return alert('Please select a channel');
  if (panelTicketTypes.length === 0) return alert('Please add at least one ticket type');

  // Validate ticket types
  for (const type of panelTicketTypes) {
    if (!type.name) return alert('All ticket types must have a name');
    if (!type.label) return alert('All ticket types must have a label');
  }

  try {
    const response = await fetch(`/api/guild/${currentGuild.id}/panels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        style,
        channelId,
        ticketTypes: panelTicketTypes.map(t => ({
          name: t.name,
          label: t.label,
          description: t.description,
          emoji: t.emoji,
          color: t.color,
          categoryId: t.categoryId || null,
          supportRoles: t.supportRoles || []
        }))
      })
    });

    const result = await response.json();
    if (response.ok) {
      hideModal('create-panel-modal');
      // Clear form
      document.getElementById('panel-title').value = '';
      document.getElementById('panel-description').value = '';
      document.getElementById('panel-channel').value = '';
      panelTicketTypes = [];
      loadTickets();
    } else {
      alert(result.error || 'Failed to create panel');
    }
  } catch (error) {
    console.error('Failed to create panel:', error);
    alert('Failed to create panel');
  }
}

function showCreateAppTypeModal() {
  document.getElementById('create-app-modal').style.display = 'flex';
}

async function createAppType() {
  const name = document.getElementById('app-name').value;
  const description = document.getElementById('app-description').value;
  const cooldownHours = parseInt(document.getElementById('app-cooldown').value) || 24;
  const createTicket = document.getElementById('app-create-ticket').checked;

  // Collect roles as arrays (filter out empty values)
  const pendingRoles = [
    document.getElementById('app-pending-role-1').value,
    document.getElementById('app-pending-role-2').value
  ].filter(r => r);
  const acceptedRoles = [
    document.getElementById('app-accepted-role-1').value,
    document.getElementById('app-accepted-role-2').value
  ].filter(r => r);
  const deniedRoles = [
    document.getElementById('app-denied-role-1').value,
    document.getElementById('app-denied-role-2').value
  ].filter(r => r);

  if (!name) return alert('Please enter a name');

  try {
    const response = await fetch(`/api/guild/${currentGuild.id}/application-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, cooldownHours, createTicket, pendingRoles, acceptedRoles, deniedRoles })
    });

    const result = await response.json();

    if (!response.ok) {
      return alert(result.error || 'Failed to create application type');
    }

    // Clear form
    document.getElementById('app-name').value = '';
    document.getElementById('app-description').value = '';
    document.getElementById('app-cooldown').value = '24';
    document.getElementById('app-create-ticket').checked = true;
    document.getElementById('app-pending-role-1').value = '';
    document.getElementById('app-pending-role-2').value = '';
    document.getElementById('app-accepted-role-1').value = '';
    document.getElementById('app-accepted-role-2').value = '';
    document.getElementById('app-denied-role-1').value = '';
    document.getElementById('app-denied-role-2').value = '';

    hideModal('create-app-modal');
    loadApplications();
  } catch (error) {
    console.error('Failed to create application type:', error);
    alert('Failed to create application type');
  }
}

function renderApplicationsTable(applications) {
  if (applications.length === 0) {
    return '<div class="empty-state"><div class="empty-state-icon">📝</div><p>No applications found</p></div>';
  }

  return `
    <table class="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>User ID</th>
          <th>Status</th>
          <th>Submitted</th>
          <th>Reviewed</th>
        </tr>
      </thead>
      <tbody>
        ${applications.map(app => `
          <tr>
            <td>${app.id}</td>
            <td>${app.user_id}</td>
            <td><span class="badge badge-${app.status}">${app.status}</span></td>
            <td>${new Date(app.created_at).toLocaleDateString()}</td>
            <td>${app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString() : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function loadSettings() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const response = await fetch(`/api/guild/${currentGuild.id}/settings`);
    const settings = await response.json();

    const channelOptions = guildChannels?.textChannels?.map(c =>
      `<option value="${c.id}" ${settings.ticketLogChannel === c.id ? 'selected' : ''}>#${c.name}</option>`
    ).join('') || '';

    const categoryOptions = guildChannels?.categories?.map(c =>
      `<option value="${c.id}" ${settings.ticketCategory === c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('') || '';

    const roleOptions = guildRoles?.map(r =>
      `<option value="${r.id}">${r.name}</option>`
    ).join('') || '';

    content.innerHTML = `
      <div class="settings-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
        <div class="card">
          <div class="card-header">
            <h3>Ticket Settings</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label>Ticket Limit per User</label>
              <input type="number" id="ticketLimit" value="${settings.ticketLimit}" min="1" max="10" class="input">
            </div>
            <div class="form-group">
              <label>Auto-Close (hours, 0 to disable)</label>
              <input type="number" id="autoCloseHours" value="${settings.autoCloseHours}" min="0" max="720" class="input">
            </div>
            <div class="form-group">
              <label>Log Channel</label>
              <select id="ticketLogChannel" class="input">
                <option value="">None</option>
                ${channelOptions}
              </select>
            </div>
            <div class="form-group">
              <label>Transcript Channel</label>
              <select id="ticketTranscriptChannel" class="input">
                <option value="">None</option>
                ${guildChannels?.textChannels?.map(c =>
                  `<option value="${c.id}" ${settings.ticketTranscriptChannel === c.id ? 'selected' : ''}>#${c.name}</option>`
                ).join('') || ''}
              </select>
            </div>
            <div class="form-group">
              <label>Ticket Category</label>
              <select id="ticketCategory" class="input">
                <option value="">None</option>
                ${categoryOptions}
              </select>
            </div>
            <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Support Roles</h3>
          </div>
          <div class="card-body">
            <div id="support-roles-list">
              ${settings.supportRoles.length > 0
                ? settings.supportRoles.map(roleId => {
                    const role = guildRoles?.find(r => r.id === roleId);
                    return `
                      <div class="role-tag" style="display: inline-flex; align-items: center; gap: 8px; background: var(--bg-tertiary); padding: 6px 12px; border-radius: 6px; margin: 4px;">
                        <span style="color: ${role?.color || '#fff'}">${role?.name || roleId}</span>
                        <button class="btn btn-small btn-danger" onclick="removeSupportRole('${roleId}')" style="padding: 2px 6px;">×</button>
                      </div>
                    `;
                  }).join('')
                : '<p style="color: var(--text-secondary);">No support roles configured</p>'
              }
            </div>
            <div style="margin-top: 16px; display: flex; gap: 8px;">
              <select id="add-support-role" class="input" style="flex: 1;">
                <option value="">Select a role...</option>
                ${roleOptions}
              </select>
              <button class="btn btn-primary" onclick="addSupportRole()">Add</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Auto Roles</h3>
            <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Roles automatically assigned to new members when they join</p>
          </div>
          <div class="card-body">
            <div id="auto-roles-list">
              ${(settings.autoRoles || []).length > 0
                ? settings.autoRoles.map(roleId => {
                    const role = guildRoles?.find(r => r.id === roleId);
                    return `
                      <div class="role-tag" style="display: inline-flex; align-items: center; gap: 8px; background: var(--bg-tertiary); padding: 6px 12px; border-radius: 6px; margin: 4px;">
                        <span style="color: ${role?.color || '#fff'}">${role?.name || roleId}</span>
                        <button class="btn btn-small btn-danger" onclick="removeAutoRole('${roleId}')" style="padding: 2px 6px;">×</button>
                      </div>
                    `;
                  }).join('')
                : '<p style="color: var(--text-secondary);">No auto roles configured</p>'
              }
            </div>
            <div style="margin-top: 16px; display: flex; gap: 8px;">
              <select id="add-auto-role" class="input" style="flex: 1;">
                <option value="">Select a role...</option>
                ${roleOptions}
              </select>
              <button class="btn btn-primary" onclick="addAutoRole()">Add</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load settings:', error);
    content.innerHTML = '<div class="empty-state"><p>Failed to load settings</p></div>';
  }
}

async function saveSettings() {
  const ticketLimit = document.getElementById('ticketLimit').value;
  const autoCloseHours = document.getElementById('autoCloseHours').value;
  const ticketLogChannel = document.getElementById('ticketLogChannel').value;
  const ticketTranscriptChannel = document.getElementById('ticketTranscriptChannel').value;
  const ticketCategory = document.getElementById('ticketCategory').value;

  try {
    const response = await fetch(`/api/guild/${currentGuild.id}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketLimit: parseInt(ticketLimit),
        autoCloseHours: parseInt(autoCloseHours),
        ticketLogChannel: ticketLogChannel || null,
        ticketTranscriptChannel: ticketTranscriptChannel || null,
        ticketCategory: ticketCategory || null
      })
    });

    if (response.ok) {
      alert('Settings saved!');
    } else {
      alert('Failed to save settings');
    }
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('Failed to save settings');
  }
}

async function addSupportRole() {
  const roleId = document.getElementById('add-support-role').value;
  if (!roleId) return alert('Please select a role');

  await fetch(`/api/guild/${currentGuild.id}/support-roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId })
  });

  loadSettings();
}

async function removeSupportRole(roleId) {
  await fetch(`/api/guild/${currentGuild.id}/support-roles/${roleId}`, { method: 'DELETE' });
  loadSettings();
}

async function addAutoRole() {
  const roleId = document.getElementById('add-auto-role').value;
  if (!roleId) return alert('Please select a role');

  await fetch(`/api/guild/${currentGuild.id}/auto-roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId })
  });

  loadSettings();
}

async function removeAutoRole(roleId) {
  await fetch(`/api/guild/${currentGuild.id}/auto-roles/${roleId}`, { method: 'DELETE' });
  loadSettings();
}

init();
