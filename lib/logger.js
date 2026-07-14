const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LEVEL = (process.env.LOG_LEVEL || 'INFO').toUpperCase();

function formatTime() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function shouldLog(level) {
  return (LOG_LEVELS[level] ?? LOG_LEVELS.INFO) >= (LOG_LEVELS[CURRENT_LEVEL] ?? LOG_LEVELS.INFO);
}

function log(level, tag, message, data) {
  if (!shouldLog(level)) return;
  const prefix = `[${formatTime()}] [${level}] [${tag}]`;
  if (data !== undefined) {
    console.log(prefix, message, JSON.stringify(data));
    return;
  }
  console.log(prefix, message);
}

module.exports = {
  debug: (tag, msg, data) => log('DEBUG', tag, msg, data),
  info: (tag, msg, data) => log('INFO', tag, msg, data),
  warn: (tag, msg, data) => log('WARN', tag, msg, data),
  error: (tag, msg, data) => log('ERROR', tag, msg, data),
};
