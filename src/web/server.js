const express = require('express');
const session = require('express-session');
const path = require('path');
const logger = require('../utils/logger');
const apiRoutes = require('./routes/api');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust Railway's proxy
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;

app.use(session({
  secret: process.env.SESSION_SECRET || 'rabbit-bot-secret-key',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);

// Health check for Railway
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/login', (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.DASHBOARD_URL + '/callback');
  const scope = encodeURIComponent('identify guilds');

  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DASHBOARD_URL + '/callback'
      })
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      logger.error('OAuth token error: ' + tokens.error);
      return res.redirect('/?error=token_error');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    });

    const user = await userResponse.json();

    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    });

    const guilds = await guildsResponse.json();

    req.session.user = user;
    req.session.guilds = guilds;
    req.session.accessToken = tokens.access_token;

    res.redirect('/dashboard.html');
  } catch (error) {
    logger.error('OAuth callback error', error);
    res.redirect('/?error=callback_error');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
  if (req.path.endsWith('.html') && !req.session.user && req.path !== '/index.html') {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', req.path));
});

let discordClient = null;

function setDiscordClient(client) {
  discordClient = client;
  app.set('discordClient', client);
}

function getDiscordClient() {
  return discordClient;
}

function startServer(port = 3000) {
  const serverPort = process.env.PORT || port;
  logger.info(`Starting web server on port ${serverPort}...`);

  const server = app.listen(serverPort, '0.0.0.0', () => {
    logger.success(`Dashboard running on port ${serverPort}`);
  });

  server.on('error', (err) => {
    logger.error(`Server error: ${err.message}`);
  });
}

module.exports = { app, startServer, setDiscordClient, getDiscordClient };
