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
  if (panels.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>No ticket panels created yet</p>
        <p style="color: var(--text-secondary); font-size: 14px;">Use /panel command in Discord to create one</p>
      </div>
    `;
  }

  return `
    <div class="card">
      <div class="card-body">
        <table class="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Title</th>
              <th>Button</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${panels.map(panel => `
              <tr>
                <td>${panel.panel_type}</td>
                <td>${panel.title}</td>
                <td>${panel.button_label}</td>
                <td>${new Date(panel.created_at).toLocaleDateString()}</td>
                <td>
                  <button class="btn btn-small btn-danger delete-panel" data-id="${panel.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
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
                  Questions: ${type.questionCount}/5 | Cooldown: ${type.cooldownHours}h | Creates Ticket: ${type.createTicket ? 'Yes' : 'No'}
                </p>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-small btn-secondary edit-app-type" data-id="${type.id}">Edit</button>
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
      <div class="modal-content">
        <h3>Create Application Type</h3>
        <input type="text" id="app-name" placeholder="Name (e.g., Staff Application)" class="input">
        <textarea id="app-description" placeholder="Description" class="input" rows="3"></textarea>
        <input type="number" id="app-cooldown" placeholder="Cooldown (hours)" class="input" value="24">
        <label style="display: flex; align-items: center; gap: 8px; margin: 12px 0;">
          <input type="checkbox" id="app-create-ticket" checked>
          Create ticket on submission
        </label>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="hideModal('create-app-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="createAppType()">Create</button>
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

function showCreateAppTypeModal() {
  document.getElementById('create-app-modal').style.display = 'flex';
}

async function createAppType() {
  const name = document.getElementById('app-name').value;
  const description = document.getElementById('app-description').value;
  const cooldownHours = parseInt(document.getElementById('app-cooldown').value) || 24;
  const createTicket = document.getElementById('app-create-ticket').checked;

  if (!name) return alert('Please enter a name');

  await fetch(`/api/guild/${currentGuild.id}/application-types`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, cooldownHours, createTicket })
  });

  hideModal('create-app-modal');
  loadApplications();
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

init();
