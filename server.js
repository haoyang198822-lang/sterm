const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const logger = require('./lib/logger');
const { createWSServer } = require('./lib/ws-transport');
const { agentLoop } = require('./scripts/agent');
const { getCategories, browseCategory, searchCommands } = require('./scripts/agent-tools');

const DATA_DIR = process.env.USER_DATA_DIR || path.join(__dirname, 'sterm-data');
const COMMANDS_PATH = path.join(DATA_DIR, 'snippets.json');

// Ensure data directory exists
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

function readSnippetsFile() {
  try {
    const raw = fs.readFileSync(COMMANDS_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.snippets) ? data.snippets : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function writeSnippetsFile(snippets) {
  const current = (() => {
    try {
      const raw = fs.readFileSync(COMMANDS_PATH, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      return { version: 1, snippets: [], recentCommands: [] };
    }
  })();

  const next = {
    ...current,
    snippets,
  };

  fs.writeFileSync(COMMANDS_PATH, JSON.stringify(next, null, 2));
}

function toCommandItem(snippet) {
  return {
    id: snippet.id,
    command: snippet.command,
    description: snippet.label || '',
    category: Array.isArray(snippet.tags) && snippet.tags.length > 0 ? snippet.tags[0] : '',
    createdAt: snippet.createdAt,
  };
}

function createApp() {
  const app = express();
  const server = http.createServer(app);
  const isDev = process.env.NODE_ENV === 'development';
  const xtermModules = [
    '@xterm/xterm/lib/xterm.js',
    '@xterm/xterm/css/xterm.css',
    '@xterm/addon-fit/lib/addon-fit.js',
    '@xterm/addon-web-links/lib/addon-web-links.js',
  ];

  app.use(express.json());

  app.post('/api/agent/ask', async (req, res) => {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: '缺少 query 参数' });
    }

    try {
      const answer = await agentLoop(query);
      return res.json({ answer });
    } catch (error) {
      logger.error('agent', '查询失败', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  // 速查搜索 — 桥接到 agent 后端，兼容 React 前端调用
  app.get('/api/cheats/search', async (req, res) => {
    const query = (req.query.q || '').trim();
    if (!query) {
      return res.json([]);
    }

    try {
      const answer = await agentLoop(query);
      return res.json([{ title: '结果', description: answer, commands: [] }]);
    } catch (error) {
      logger.error('cheats', '搜索失败', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/cheats/local', (req, res) => {
    const q = String(req.query.q || '').trim();
    try {
      return res.json({ results: q ? searchCommands(q) : [], categories: getCategories() });
    } catch (error) {
      logger.error('cheats', 'local 搜索失败', { error: error.message, query: q });
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/cheats/categories', (req, res) => {
    try {
      return res.json(getCategories());
    } catch (error) {
      logger.error('cheats', '获取分类失败', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/cheats/browse', (req, res) => {
    const category = String(req.query.category || '').trim();
    if (!category) {
      return res.status(400).json({ error: '缺少 category 参数' });
    }
    try {
      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
      return res.json(browseCategory(category, page, limit));
    } catch (error) {
      logger.error('cheats', '浏览分类失败', { error: error.message, category });
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/commands', (req, res) => {
    try {
      const snippets = readSnippetsFile();
      return res.json(snippets.map(toCommandItem));
    } catch (error) {
      logger.error('commands', '读取失败', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/commands', (req, res) => {
    const { command, description, category } = req.body || {};
    if (!command || !description) {
      return res.status(400).json({ error: '缺少 command 或 description 参数' });
    }

    try {
      const snippets = readSnippetsFile();
      const now = new Date().toISOString();
      const snippet = {
        id: 'snp_' + Date.now(),
        command,
        label: description,
        tags: category ? [category] : [],
        shortcut: '',
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      snippets.unshift(snippet);
      writeSnippetsFile(snippets);
      return res.status(201).json(toCommandItem(snippet));
    } catch (error) {
      logger.error('commands', '创建失败', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/commands/:id', (req, res) => {
    const { id } = req.params;
    const { command, description, category } = req.body || {};

    try {
      const snippets = readSnippetsFile();
      const index = snippets.findIndex((item) => item.id === id);
      if (index === -1) {
        return res.status(404).json({ error: '命令不存在' });
      }

      const current = snippets[index];
      const updated = {
        ...current,
        ...(command !== undefined ? { command } : {}),
        ...(description !== undefined ? { label: description } : {}),
        ...(category !== undefined ? { tags: category ? [category] : [] } : {}),
        updatedAt: new Date().toISOString(),
      };

      snippets[index] = updated;
      writeSnippetsFile(snippets);
      return res.json(toCommandItem(updated));
    } catch (error) {
      logger.error('commands', '更新失败', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/commands/:id', (req, res) => {
    const { id } = req.params;

    try {
      const snippets = readSnippetsFile();
      const filtered = snippets.filter((item) => item.id !== id);
      writeSnippetsFile(filtered);
      return res.status(204).send();
    } catch (error) {
      logger.error('commands', '删除失败', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/commands/categories', (req, res) => {
    try {
      const snippets = readSnippetsFile();
      const categories = [...new Set(snippets.flatMap((item) => (Array.isArray(item.tags) ? item.tags : [])))];
      return res.json(categories);
    } catch (error) {
      logger.error('commands', '分类读取失败', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  xtermModules.forEach((modulePath) => {
    app.get('/node_modules/' + modulePath, (req, res) => {
      res.sendFile(path.join(__dirname, 'node_modules', modulePath));
    });
  });

  app.use('/sterm-data', express.static(path.join(__dirname, 'sterm-data')));

  if (isDev) {
    app.use(express.static(path.join(__dirname, 'public')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  } else {
    const frontendDist = path.join(__dirname, 'frontend', 'dist');
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(frontendDist, 'index.html'));
      }
    });
  }

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
