const fs = require('fs');
const path = require('path');

async function generateTranscript(channel, ticket) {
  const messages = await fetchAllMessages(channel);
  const html = buildHtml(messages, channel, ticket);

  const transcriptsDir = path.join(__dirname, '../../transcripts');
  if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
  }

  const filename = `ticket-${ticket.ticket_number}-${Date.now()}.html`;
  const filepath = path.join(transcriptsDir, filename);

  fs.writeFileSync(filepath, html);

  return { filepath, filename };
}

async function fetchAllMessages(channel) {
  const messages = [];
  let lastId;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const fetched = await channel.messages.fetch(options);
    if (fetched.size === 0) break;

    messages.push(...fetched.values());
    lastId = fetched.last().id;

    if (fetched.size < 100) break;
  }

  return messages.reverse();
}

function buildHtml(messages, channel, ticket) {
  const styles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: #36393f;
        color: #dcddde;
        padding: 20px;
      }
      .header {
        background: #2f3136;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 20px;
      }
      .header h1 { color: #fff; margin-bottom: 10px; }
      .header p { color: #b9bbbe; }
      .messages { display: flex; flex-direction: column; gap: 4px; }
      .message {
        display: flex;
        padding: 8px 16px;
        border-radius: 4px;
      }
      .message:hover { background: #32353b; }
      .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        margin-right: 16px;
        flex-shrink: 0;
      }
      .content { flex: 1; min-width: 0; }
      .author {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 4px;
      }
      .username { color: #fff; font-weight: 500; }
      .bot-tag {
        background: #5865f2;
        color: #fff;
        font-size: 10px;
        padding: 1px 4px;
        border-radius: 3px;
      }
      .timestamp { color: #72767d; font-size: 12px; }
      .text { color: #dcddde; line-height: 1.375; word-wrap: break-word; }
      .embed {
        max-width: 520px;
        background: #2f3136;
        border-left: 4px solid #5865f2;
        border-radius: 4px;
        padding: 12px;
        margin-top: 8px;
      }
      .embed-title { color: #fff; font-weight: 600; margin-bottom: 8px; }
      .embed-description { color: #dcddde; }
      .embed-field { margin-top: 8px; }
      .embed-field-name { color: #fff; font-weight: 600; font-size: 14px; }
      .embed-field-value { color: #dcddde; font-size: 14px; }
      .attachment {
        margin-top: 8px;
        padding: 10px;
        background: #2f3136;
        border-radius: 4px;
        display: inline-block;
      }
      .attachment a { color: #00b0f4; text-decoration: none; }
      .attachment a:hover { text-decoration: underline; }
      .reactions { display: flex; gap: 4px; margin-top: 8px; }
      .reaction {
        background: #2f3136;
        border: 1px solid #40444b;
        border-radius: 8px;
        padding: 2px 6px;
        font-size: 14px;
      }
    </style>
  `;

  const header = `
    <div class="header">
      <h1>Ticket #${ticket.ticket_number}</h1>
      <p>Channel: #${channel.name}</p>
      <p>Created: ${new Date(ticket.created_at).toLocaleString()}</p>
      <p>Closed: ${ticket.closed_at ? new Date(ticket.closed_at).toLocaleString() : 'N/A'}</p>
      <p>Total Messages: ${messages.length}</p>
    </div>
  `;

  const messagesHtml = messages.map(msg => {
    const avatarUrl = msg.author.displayAvatarURL({ format: 'png', size: 64 });
    const timestamp = new Date(msg.createdTimestamp).toLocaleString();

    let embedsHtml = '';
    msg.embeds.forEach(embed => {
      embedsHtml += `
        <div class="embed" style="border-left-color: ${embed.hexColor || '#5865f2'}">
          ${embed.title ? `<div class="embed-title">${escapeHtml(embed.title)}</div>` : ''}
          ${embed.description ? `<div class="embed-description">${escapeHtml(embed.description)}</div>` : ''}
          ${embed.fields.map(f => `
            <div class="embed-field">
              <div class="embed-field-name">${escapeHtml(f.name)}</div>
              <div class="embed-field-value">${escapeHtml(f.value)}</div>
            </div>
          `).join('')}
        </div>
      `;
    });

    let attachmentsHtml = '';
    msg.attachments.forEach(att => {
      attachmentsHtml += `
        <div class="attachment">
          <a href="${att.url}" target="_blank">${escapeHtml(att.name)}</a>
          (${formatBytes(att.size)})
        </div>
      `;
    });

    let reactionsHtml = '';
    if (msg.reactions.cache.size > 0) {
      reactionsHtml = '<div class="reactions">';
      msg.reactions.cache.forEach(reaction => {
        reactionsHtml += `<span class="reaction">${reaction.emoji.toString()} ${reaction.count}</span>`;
      });
      reactionsHtml += '</div>';
    }

    return `
      <div class="message">
        <img class="avatar" src="${avatarUrl}" alt="Avatar">
        <div class="content">
          <div class="author">
            <span class="username">${escapeHtml(msg.author.displayName || msg.author.username)}</span>
            ${msg.author.bot ? '<span class="bot-tag">BOT</span>' : ''}
            <span class="timestamp">${timestamp}</span>
          </div>
          ${msg.content ? `<div class="text">${escapeHtml(msg.content)}</div>` : ''}
          ${embedsHtml}
          ${attachmentsHtml}
          ${reactionsHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Transcript - Ticket #${ticket.ticket_number}</title>
      ${styles}
    </head>
    <body>
      ${header}
      <div class="messages">
        ${messagesHtml}
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = { generateTranscript };
