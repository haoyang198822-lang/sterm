const { app, BrowserWindow, Menu, clipboard, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../lib/logger');

let mainWindow = null;
let serverProcess = null;
/** Cmd+C 请求防重入：处理中时忽略新请求 */
let copyPending = false;

function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function findNodePath() {
  const candidates = ['/Users/mac/.nvm/versions/node/v22.22.3/bin/node', '/usr/local/bin/node', '/opt/homebrew/bin/node', '/usr/bin/node'];
  for (const p of candidates) { try { require('fs').accessSync(p); return p; } catch {} }
  try { return require('child_process').execSync('which node', { encoding: 'utf8' }).trim(); } catch { return '/usr/local/bin/node'; }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const isPackaged = app.isPackaged;
    const baseDir = isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname, '..');
    const serverPath = path.join(baseDir, 'server.js');
    const nodePath = findNodePath();
    const userDataDir = (app && typeof app.getPath === 'function') ? app.getPath('userData') : path.join(require('os').homedir(), 'Library/Application Support/sterm');
    serverProcess = spawn(nodePath, [serverPath], { cwd: baseDir, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PORT: '0', NODE_ENV: 'production', USER_DATA_DIR: userDataDir } });

    let started = false;
    serverProcess.stdout.on('data', (data) => {
      const text = data.toString();
      logger.debug('main', 'server stdout', { text: text.trim() });
      const match = text.match(/port":(\d+)/) || text.match(/port:\s*(\d+)/) || text.match(/localhost:(\d+)/);
      if (match && !started) { started = true; resolve(parseInt(match[1], 10)); }
    });
    serverProcess.stderr.on('data', (data) => logger.warn('main', 'server stderr', { text: data.toString().trim() }));
    serverProcess.on('exit', (code) => { if (!started) reject(new Error('server exited with code ' + code)); });
    serverProcess.on('error', (err) => { if (!started) reject(err); });
    setTimeout(() => { if (!started) reject(new Error('server start timeout')); }, 10000);
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({ width: 900, height: 600, minWidth: 600, minHeight: 360, title: 'Sterm', backgroundColor: '#1A1B1D', titleBarStyle: 'hidden', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  mainWindow.loadURL('http://127.0.0.1:' + port);
}

app.whenReady().then(async () => {
  buildAppMenu();
  try { const port = await startServer(); createWindow(port); } catch (err) { logger.error('main', '启动失败', { error: err.message }); app.quit(); }
});
app.on('window-all-closed', () => { if (serverProcess) serverProcess.kill(); app.quit(); });
app.on('activate', () => { if (mainWindow === null) app.whenReady().then(async () => { const port = await startServer(); createWindow(port); }); });
app.on('before-quit', () => { if (serverProcess) serverProcess.kill(); });
