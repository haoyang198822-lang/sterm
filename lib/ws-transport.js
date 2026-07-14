const { WebSocketServer } = require('ws');
const { TerminalSession } = require('./terminal-session');
const { validateMessage } = require('./message-schema');
const logger = require('./logger');

function createWSServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    logger.info('ws', '新连接');
    const session = new TerminalSession();
    const sessionId = session.id;

    session.on('data', (data) => {
      try { ws.send(JSON.stringify({ type: 'data', text: data })); } catch (err) { logger.error('ws', '发送 data 失败', { sessionId, error: err.message }); }
    });

    session.on('exit', (exitCode) => {
      try { ws.send(JSON.stringify({ type: 'exit', code: exitCode })); ws.close(); } catch (err) { logger.error('ws', '发送 exit 失败', { sessionId, error: err.message }); }
    });

    ws.on('message', (raw) => {
      const parsed = validateMessage(raw.toString());
      if (!parsed.valid) { logger.warn('ws', '无效消息', { sessionId, error: parsed.error }); return; }
      const msg = parsed.message;
      if (msg.type === 'input') session.write(msg.text);
      if (msg.type === 'resize') session.resize(msg.cols, msg.rows);
    });

    ws.on('close', () => { logger.info('session', '连接关闭', { sessionId }); session.destroy(); });
    ws.on('error', (err) => { logger.error('ws', '连接异常', { sessionId, error: err.message }); session.destroy(); });
  });

  return wss;
}

module.exports = { createWSServer };
