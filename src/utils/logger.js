const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function info(message) {
  console.log(`${colors.cyan}[${getTimestamp()}] [INFO]${colors.reset} ${message}`);
}

function success(message) {
  console.log(`${colors.green}[${getTimestamp()}] [SUCCESS]${colors.reset} ${message}`);
}

function warn(message) {
  console.log(`${colors.yellow}[${getTimestamp()}] [WARN]${colors.reset} ${message}`);
}

function error(message, err = null) {
  console.log(`${colors.red}[${getTimestamp()}] [ERROR]${colors.reset} ${message}`);
  if (err) console.error(err);
}

function debug(message) {
  if (process.env.DEBUG === 'true') {
    console.log(`${colors.magenta}[${getTimestamp()}] [DEBUG]${colors.reset} ${message}`);
  }
}

module.exports = { info, success, warn, error, debug };
