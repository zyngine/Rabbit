let currentGuild = null;
let currentPage = 'overview';
let userData = null;

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

function selectGuild(guildId, guilds) {
  currentGuild = guilds.find(g => g.id === guildId);

  document.querySelectorAll('.guild-item').forEach(item => {
    item.classList.toggle('active', item.dataset.guildId === guildId);
  });

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
    const response = await fetch(`/api/guild/${currentGuild.id}/tickets`);
    const data = await response.json();

    content.innerHTML = `
      <div class="tabs">
        <div class="tab active" data-filter="">All</div>
        <div class="tab" data-filter="open">Open</div>
        <div class="tab" data-filter="closed">Closed</div>
      </div>

      <div class="card">
        <div class="card-body" id="tickets-table">
          ${renderTicketsTable(data.tickets)}
        </div>
      </div>
    `;

    document.querySelectorAll('.tabs .tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const filter = tab.dataset.filter;
        const url = filter
          ? `/api/guild/${currentGuild.id}/tickets?status=${filter}`
          : `/api/guild/${currentGuild.id}/tickets`;

        const res = await fetch(url);
        const d = await res.json();
        document.getElementById('tickets-table').innerHTML = renderTicketsTable(d.tickets);
      });
    });
  } catch (error) {
    console.error('Failed to load tickets:', error);
    content.innerHTML = '<div class="empty-state"><p>Failed to load tickets</p></div>';
  }
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
      <div class="stats-grid" style="margin-bottom: 20px;">
        ${types.map(type => `
          <div class="stat-card">
            <div class="stat-value">${type.questionCount}</div>
            <div class="stat-label">${type.name} (${type.active ? 'Active' : 'Inactive'})</div>
          </div>
        `).join('')}
      </div>

      <div class="tabs">
        <div class="tab active" data-filter="">All</div>
        <div class="tab" data-filter="pending">Pending</div>
        <div class="tab" data-filter="accepted">Accepted</div>
        <div class="tab" data-filter="denied">Denied</div>
      </div>

      <div class="card">
        <div class="card-body" id="applications-table">
          ${renderApplicationsTable(appsData.applications)}
        </div>
      </div>
    `;

    document.querySelectorAll('.tabs .tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const filter = tab.dataset.filter;
        const url = filter
          ? `/api/guild/${currentGuild.id}/applications?status=${filter}`
          : `/api/guild/${currentGuild.id}/applications`;

        const res = await fetch(url);
        const d = await res.json();
        document.getElementById('applications-table').innerHTML = renderApplicationsTable(d.applications);
      });
    });
  } catch (error) {
    console.error('Failed to load applications:', error);
    content.innerHTML = '<div class="empty-state"><p>Failed to load applications</p></div>';
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

    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Ticket Settings</h3>
        </div>
        <div class="card-body">
          <div style="display: grid; gap: 20px; max-width: 400px;">
            <div>
              <label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">Ticket Limit per User</label>
              <input type="number" id="ticketLimit" value="${settings.ticketLimit}" min="1" max="10"
                style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary);">
            </div>
            <div>
              <label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">Auto-Close (hours, 0 to disable)</label>
              <input type="number" id="autoCloseHours" value="${settings.autoCloseHours}" min="0" max="720"
                style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary);">
            </div>
            <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border);">
            <h4 style="margin-bottom: 16px;">Current Configuration</h4>
            <p style="color: var(--text-secondary);">
              <strong>Log Channel:</strong> ${settings.ticketLogChannel || 'Not set'}<br>
              <strong>Transcript Channel:</strong> ${settings.ticketTranscriptChannel || 'Not set'}<br>
              <strong>Ticket Category:</strong> ${settings.ticketCategory || 'Not set'}<br>
              <strong>Support Roles:</strong> ${settings.supportRoles.length || 0} configured
            </p>
            <p style="color: var(--text-secondary); margin-top: 12px; font-size: 14px;">
              Use Discord commands to configure channels and roles.
            </p>
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

  try {
    const response = await fetch(`/api/guild/${currentGuild.id}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketLimit: parseInt(ticketLimit),
        autoCloseHours: parseInt(autoCloseHours)
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

init();
