const express = require('express');
const http = require('http');
const path = require('path');
const logger = require('./lib/logger');
const { createWSServer } = require('./lib/ws-transport');

function createApp() {
  const app = express();
  const server = http.createServer(app);
  const xtermModules = [
    '@xterm/xterm/lib/xterm.js',
    '@xterm/xterm/css/xterm.css',
    '@xterm/addon-fit/lib/addon-fit.js',
    '@xterm/addon-web-links/lib/addon-web-links.js',
  ];

  xtermModules.forEach((modulePath) => {
    app.get('/node_modules/' + modulePath, (req, res) => {
      res.sendFile(path.join(__dirname, 'node_modules', modulePath));
    });
  });

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  createWSServer(server);

  return { app, server };
}

if (require.main === module) {
  const { server } = createApp();
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    logger.info('sterm', '服务启动', { port: server.address().port });
  });
}

module.exports = { createApp };
