import { DARK_TERMINAL_THEME, LIGHT_TERMINAL_THEME } from './theme.js';

const terminalContainer = document.getElementById('terminal-container');
const statusDot = document.getElementById('statusDot');
const statusConn = document.getElementById('statusConn');
const btnTheme = document.getElementById('btnTheme');

let terminal = null;
let fitAddon = null;
let webLinksAddon = null;
let ws = null;
let reconnectTimer = null;
let isLightTheme = localStorage.getItem('sterm-theme') === 'light';

function applyTheme() {
  document.body.classList.toggle('light', isLightTheme);
  btnTheme.textContent = isLightTheme ? '☾' : '☀';
  if (terminal) {
    terminal.options.theme = isLightTheme ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME;
  }
}

function setConnectionStatus(connected) {
  statusDot.classList.toggle('disconnected', !connected);
  statusConn.classList.toggle('disconnected', !connected);
  statusConn.textContent = connected ? '已连接' : '已断开';
}

function sendResize() {
  if (!terminal || !fitAddon || !ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  const dims = fitAddon.proposeDimensions();
  if (dims) {
    ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
  }
}

function connectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    setConnectionStatus(true);
    sendResize();
  };

  ws.onclose = () => {
    setConnectionStatus(false);
    reconnectTimer = setTimeout(connectWebSocket, 5000);
  };

  ws.onerror = () => {};

  ws.onmessage = (event) => {
    if (!terminal) {
      return;
    }

    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'data') {
        terminal.write(msg.text);
      } else if (msg.type === 'exit') {
        terminal.write(`\r\n\x1b[31m[进程退出，代码: ${msg.code}]\x1b[0m\r\n`);
      }
    } catch (error) {
      console.warn('[ws] 无法解析消息', error);
    }
  };
}

function initTerminal() {
  terminal = new Terminal({
    theme: isLightTheme ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME,
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', 'Consolas', monospace",
    cursorBlink: true,
    cursorStyle: 'bar',
    allowProposedApi: true,
    cols: 80,
    rows: 24,
    unicodeVersion: 11,
  });

  fitAddon = new FitAddon.FitAddon();
  webLinksAddon = new WebLinksAddon.WebLinksAddon();

  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);
  terminal.open(terminalContainer);

  setTimeout(() => {
    fitAddon.fit();
    sendResize();
  }, 50);

  const resizeObserver = new ResizeObserver(() => {
    fitAddon.fit();
    sendResize();
  });
  resizeObserver.observe(terminalContainer);

  terminal.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', text: data }));
    }
  });

  window.addEventListener('resize', () => {
    if (fitAddon) {
      fitAddon.fit();
      sendResize();
    }
  });

  if (window.electronAPI && window.electronAPI.onPaste) {
    window.electronAPI.onPaste((text) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', text }));
      }
    });
  }

  if (window.electronAPI && window.electronAPI.onCopyRequest) {
    window.electronAPI.onCopyRequest(() => {
      return terminal && terminal.hasSelection() ? terminal.getSelection() : '';
    });
  }
}

function initUI() {
  btnTheme.addEventListener('click', () => {
    isLightTheme = !isLightTheme;
    localStorage.setItem('sterm-theme', isLightTheme ? 'light' : 'dark');
    applyTheme();
  });

  document.getElementById('btn-new-tab').addEventListener('click', () => {
    if (terminal) {
      terminal.write('\r\n$ ');
    }
  });

  document.querySelectorAll('.tab-close').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (terminal) {
        terminal.dispose();
      }
      if (ws) {
        ws.close();
      }
    });
  });

  // 拖放文件 — 从 Finder 拖入自动输入路径
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    const uriList = e.dataTransfer.getData('text/uri-list');
    const plain = e.dataTransfer.getData('text/plain');

    // 诊断：打印可用信息
    const debug = `[drop] files=${files.length} uri=${uriList} plain=${plain}`;
    console.log(debug);

    // 取路径
    let filePath = '';
    if (files[0] && window.electronAPI && window.electronAPI.getFilePath) {
      filePath = window.electronAPI.getFilePath(files[0]);
    }
    if (!filePath && uriList) {
      filePath = decodeURIComponent(uriList.replace(/^file:\/\//, '').split('\n')[0].trim());
    }
    if (!filePath && plain) {
      filePath = decodeURIComponent(plain.replace(/^file:\/\//, '').trim());
    }

    if (!filePath) return;

    const path = filePath.includes(' ') ? `'${filePath}'` : filePath;
    console.log('[sterm] sending:', path);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', text: path }));
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  setConnectionStatus(false);
  initTerminal();
  initUI();
  connectWebSocket();
});
