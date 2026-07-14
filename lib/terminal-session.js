const EventEmitter = require('events');
const { spawn } = require('node-pty');
const logger = require('./logger');

class TerminalSession extends EventEmitter {
  constructor(options = {}) {
    super();
    this.id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    this._pty = null;
    this._alive = false;
    this.shellType = this._detectShell();
    this._spawn(options);
  }

  _detectShell() {
    const shellPath = process.env.SHELL || '/bin/zsh';
    return shellPath.split('/').pop() || 'sh';
  }

  _spawn(options) {
    try {
      const shell = process.env.SHELL || '/bin/zsh';
      const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CONDA_')));
      env.LANG = 'zh_CN.UTF-8';
      env.LC_ALL = 'zh_CN.UTF-8';
      this._pty = spawn(shell, [], { name: 'xterm-256color', cols: options.cols || 80, rows: options.rows || 24, cwd: process.env.HOME, env });
      this._alive = true;
      logger.info('session', 'PTY 已启动', { id: this.id, shell });
    } catch (err) {
      logger.error('session', 'PTY 启动失败', { id: this.id, error: err.message });
      this.emit('error', err);
      return;
    }

    this._pty.onData((data) => {
      try { this.emit('data', data); } catch (err) { logger.error('session', 'onData 处理失败', { id: this.id, error: err.message }); }
    });

    this._pty.onExit(({ exitCode, signal }) => {
      this._alive = false;
      logger.info('session', 'PTY 已退出', { id: this.id, exitCode, signal });
      this.emit('exit', exitCode);
    });
  }

  write(text) { if (this._alive && this._pty) this._pty.write(text); }
  resize(cols, rows) { if (this._alive && this._pty) { try { this._pty.resize(cols, rows); } catch (err) { logger.error('session', 'resize 失败', { id: this.id, error: err.message }); } } }
  destroy() { if (this._pty && this._alive) { try { this._pty.kill(); } catch (err) { logger.error('session', 'kill 失败', { id: this.id, error: err.message }); } } this._alive = false; this.removeAllListeners(); logger.info('session', '会话已销毁', { id: this.id }); }
  get alive() { return this._alive; }
}

module.exports = { TerminalSession };
