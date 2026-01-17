require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,

  colors: {
    primary: 0x5865F2,
    success: 0x57F287,
    warning: 0xFEE75C,
    danger: 0xED4245,
    info: 0x5865F2
  },

  priorities: {
    low: { color: 0x57F287, emoji: '🟢' },
    normal: { color: 0x5865F2, emoji: '🔵' },
    high: { color: 0xFEE75C, emoji: '🟡' },
    urgent: { color: 0xED4245, emoji: '🔴' }
  },

  buttonColors: {
    primary: 1,
    secondary: 2,
    success: 3,
    danger: 4
  },

  defaults: {
    ticketLimit: 3,
    autoCloseHours: 0,
    applicationCooldown: 24
  }
};
