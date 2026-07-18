const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function resolveDbPath() {
  // 优先 USER_DATA_DIR（Electron 打包后使用）
  const userDataDir = process.env.USER_DATA_DIR;
  if (userDataDir && fs.existsSync(path.join(userDataDir, 'cheats.db'))) {
    return path.join(userDataDir, 'cheats.db');
  }
  // 开发模式：相对于项目根目录
  const devPath = path.join(__dirname, '..', 'sterm-data', 'cheats.db');
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  // 兜底
  return devPath;
}
const DB_PATH = resolveDbPath();

const SEARCH_COMMANDS_TOOL = {
  type: 'function',
  function: {
    name: 'search_commands',
    description: '在速查数据库中搜索命令，支持自然语言查询。查询时要将用户的中文意图翻译为英文关键词以获得更好的匹配效果。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '命令描述或关键词（英文），例如："git revert commit"、"check port usage"、"compress files"',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

function searchCommands(query) {
  const cleanedQuery = String(query || '').trim();
  if (!cleanedQuery) {
    return [];
  }

  const sql = [
    'SELECT c.name, c.code, c.description',
    'FROM commands_fts f',
    'JOIN commands c ON c.id = f.rowid',
    'WHERE commands_fts MATCH ' + escapeSqlLiteral(cleanedQuery),
    'ORDER BY bm25(commands_fts)',
    'LIMIT 5;',
  ].join(' ');

  const output = execFileSync('sqlite3', [
    '-json',
    DB_PATH,
    sql,
  ], { encoding: 'utf-8' });

  const rows = output.trim() ? JSON.parse(output) : [];
  return rows.map((row) => ({
    name: row.name,
    command: row.code,
    description: row.description,
  }));
}

function getCategories() {
  const sql = [
    "SELECT category, COUNT(*) as count FROM commands",
    "WHERE category != '' AND category != '<无分类>'",
    'GROUP BY category',
    'ORDER BY count DESC;',
  ].join(' ');
  const output = execFileSync('sqlite3', ['-json', DB_PATH, sql], { encoding: 'utf-8' });
  return output.trim() ? JSON.parse(output) : [];
}

function browseCategory(category, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const sql = [
    'SELECT name, code, description',
    'FROM commands',
    'WHERE category = ' + escapeSqlLiteral(category),
    'ORDER BY name',
    'LIMIT ' + parseInt(limit, 10),
    'OFFSET ' + parseInt(offset, 10) + ';',
  ].join(' ');
  const output = execFileSync('sqlite3', ['-json', DB_PATH, sql], { encoding: 'utf-8' });
  return output.trim() ? JSON.parse(output) : [];
}

function escapeSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

module.exports = { SEARCH_COMMANDS_TOOL, searchCommands, getCategories, browseCategory };
