const { app, BrowserWindow, Menu, clipboard, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../lib/logger');

let mainWindow = null;
let serverProcess = null;
/** Cmd+C 请求防重入：处理中时忽略新请求 */
let copyPending = false;

function findNodePath() {
  if (process.execPath && process.execPath.includes('Electron')) {
    return process.execPath;
  }

  try {
    const { execSync } = require('child_process');
    return execSync('which node', { encoding: 'utf8' }).trim();
  } catch {
    return '/usr/local/bin/node';
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const isPackaged = app.isPackaged;
    const baseDir = isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname, '..');
    const serverPath = path.join(baseDir, 'server.js');
    const nodePath = findNodePath();
    serverProcess = spawn(nodePath, [serverPath], { cwd: baseDir, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PORT: '0' } });

    let started = false;
    serverProcess.stdout.on('data', (data) => {
      const text = data.toString();
      logger.debug('main', 'server stdout', { text: text.trim() });
      const match = text.match(/port":(\d+)/) || text.match(/localhost:(\d+)/);
      if (match && !started) { started = true; resolve(parseInt(match[1], 10)); }
    });
    serverProcess.stderr.on('data', (data) => logger.warn('main', 'server stderr', { text: data.toString().trim() }));
    serverProcess.on('exit', (code) => { if (!started) reject(new Error('server exited with code ' + code)); });
    serverProcess.on('error', (err) => { if (!started) reject(err); });
    setTimeout(() => { if (!started) reject(new Error('server start timeout')); }, 10000);
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({ width: 900, height: 600, minWidth: 600, minHeight: 360, title: 'Sterm', backgroundColor: '#1A1B1D', titleBarStyle: 'hiddenInset', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  mainWindow.loadURL('http://127.0.0.1:' + port);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isMod = input.meta || input.control;
    if (!isMod || input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    if (key === 'c') {
      event.preventDefault();
      if (copyPending) return; // 防重入
      copyPending = true;
      mainWindow.webContents.send('sterm-copy-request');
    }
    if (key === 'v') {
      event.preventDefault();
      const text = clipboard.readText();
      if (text && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('sterm-paste', text);
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* IPC 处理器（在 createWindow 外注册，避免重复 listener） */
ipcMain.on('sterm-copy-response', (_event, selection) => {
  copyPending = false;
  if (selection) {
    clipboard.writeText(selection);
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sterm-paste', '\x03');
  }
});

Menu.setApplicationMenu(null);

app.whenReady().then(async () => { try { const port = await startServer(); createWindow(port); } catch (err) { logger.error('main', '启动失败', { error: err.message }); app.quit(); } });
app.on('window-all-closed', () => { if (serverProcess) serverProcess.kill(); app.quit(); });
app.on('activate', () => { if (mainWindow === null) app.whenReady().then(async () => { const port = await startServer(); createWindow(port); }); });
app.on('before-quit', () => { if (serverProcess) serverProcess.kill(); });
