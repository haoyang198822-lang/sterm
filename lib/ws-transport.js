const { WebSocketServer } = require('ws');
const { TerminalSession } = require('./terminal-session');
const { validateMessage } = require('./message-schema');
const logger = require('./logger');

class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  create(options = {}) {
    const session = new TerminalSession(options);
    this.sessions.set(session.id, session);
    return session;
  }

  get(id) {
    return this.sessions.get(id) || null;
  }

  destroy(id) {
    const session = this.sessions.get(id);
    if (!session) return null;
    session.destroy();
    this.sessions.delete(id);
    return session;
  }

  list() {
    return [...this.sessions.values()].map((session) => ({
      id: session.id,
      shell: session.shellType,
      createdAt: session.createdAt,
      cwd: session.cwd,
    }));
  }

  destroyAll() {
    for (const id of [...this.sessions.keys()]) this.destroy(id);
  }
}

function createWSServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });
  const sessions = new SessionManager();

  wss.on('connection', (ws) => {
    logger.info('ws', '新连接');

    const send = (payload) => {
      try { ws.send(JSON.stringify(payload)); } catch (err) { logger.error('ws', '发送消息失败', { error: err.message }); }
    };

    const bindSession = (session) => {
      session.on('data', (data) => send({ type: 'output', sessionId: session.id, text: data }));
      session.on('exit', (exitCode) => {
        send({ type: 'exited', sessionId: session.id, code: exitCode });
        sessions.destroy(session.id);
      });
    };

    const defaultSession = sessions.create();
    bindSession(defaultSession);
    send({ type: 'created', sessionId: defaultSession.id, shell: defaultSession.shellType, cwd: defaultSession.cwd });

    ws.on('message', (raw) => {
      const parsed = validateMessage(raw.toString());
      if (!parsed.valid) { logger.warn('ws', '无效消息', { error: parsed.error }); return; }
      const msg = parsed.message;
      const sessionId = msg.sessionId || defaultSession.id;
      if (msg.type === 'input') {
        const session = sessions.get(sessionId);
        if (session) session.write(msg.text);
      }
      if (msg.type === 'resize') {
        const session = sessions.get(sessionId);
        if (session) session.resize(msg.cols, msg.rows);
      }
      if (msg.type === 'create') {
        const session = sessions.create();
        bindSession(session);
        send({ type: 'created', sessionId: session.id, shell: session.shellType, cwd: session.cwd });
      }
      if (msg.type === 'list') send({ type: 'sessions', sessions: sessions.list() });
      if (msg.type === 'destroy') {
        sessions.destroy(sessionId);
        send({ type: 'destroyed', sessionId });
      }
    });

    ws.on('close', () => { logger.info('session', '连接关闭'); sessions.destroyAll(); });
    ws.on('error', (err) => { logger.error('ws', '连接异常', { error: err.message }); sessions.destroyAll(); });
  });

  return wss;
}

module.exports = { createWSServer, SessionManager };
