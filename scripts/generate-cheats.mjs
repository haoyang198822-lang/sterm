/**
 * scripts/generate-cheats.mjs
 *
 * Fetches all .md files from jaywcjlove/reference via curl,
 * parses them into structured JSON, writes to sterm-data/cheats/.
 *
 * Usage:
 *   node scripts/generate-cheats.mjs              # generate all 210
 *   node scripts/generate-cheats.mjs --limit 5     # dry-run first 5
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'sterm-data', 'cheats');
const INDEX_PATH = join(OUT_DIR, 'index.json');

const API_URL = 'https://api.github.com/repos/jaywcjlove/reference/contents/docs';
const RAW_BASE = 'https://raw.githubusercontent.com/jaywcjlove/reference/main/docs';

// ── Helpers: curl-based fetch (avoids Node.js proxy issues) ──────

function curlJSON(url) {
  const out = execSync(`curl -sL "${url}"`, { timeout: 30, encoding: 'utf-8' });
  return JSON.parse(out);
}

function curlText(url) {
  return execSync(`curl -sL "${url}"`, { timeout: 30, encoding: 'utf-8' });
}

// ── Parser ────────────────────────────────────────────────────────

function parseCheatsheet(md) {
  const lines = md.split('\n');
  const result = { name: '', sections: [] };
  let currentSection = null, currentEntry = null;
  let pendingText = [], codeLines = [], inCodeBlock = false;

  function flushEntry() {
    if (!currentEntry) return;
    currentEntry.description = pendingText.join('\n').trim();
    currentEntry.code = codeLines.join('\n').trim();
    pendingText = []; codeLines = []; inCodeBlock = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Setex H1: === (first occurrence only)
    if (/^={2,}\s*$/.test(line) && i > 0 && lines[i-1].trim() && !result.name) {
      result.name = lines[i-1].trim()
        .replace(/备忘清单.*$/, '').replace(/备忘单.*$/, '').trim();
      continue;
    }

    // Setex H2: ---
    if (/^-{2,}\s*$/.test(line) && i > 0 && lines[i-1].trim() && !lines[i-1].startsWith('#')) {
      flushEntry();
      if (currentEntry?.title && currentSection) currentSection.entries.push(currentEntry);
      currentEntry = null;
      currentSection = { title: lines[i-1].trim(), entries: [] };
      result.sections.push(currentSection);
      pendingText = []; codeLines = []; inCodeBlock = false;
      continue;
    }

    // ATX H1
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match && !line.startsWith('##') && !result.name) {
      result.name = h1Match[1].replace(/备忘清单.*$/, '').replace(/备忘单.*$/, '').trim();
      continue;
    }

    // ATX H3
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      flushEntry();
      if (currentEntry?.title && currentSection) currentSection.entries.push(currentEntry);
      currentEntry = { title: h3Match[1].trim(), description: '', code: '' };
      pendingText = []; codeLines = []; inCodeBlock = false;
      continue;
    }

    // ATX H4
    const h4Match = line.match(/^####\s+(.+)/);
    if (h4Match) {
      if (pendingText.length > 0) pendingText.push('');
      pendingText.push('**' + h4Match[1].trim() + '**');
      continue;
    }

    // Code block
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) { inCodeBlock = false; } else { inCodeBlock = true; codeLines = []; }
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    if (/^-{3,}\s*$/.test(line) && !lines[i-1]?.trim()) continue;
    if (line.startsWith('<!--') || line.startsWith('-->')) continue;
    if (!line.trim()) continue;
    pendingText.push(line.trim());
  }

  flushEntry();
  if (currentEntry?.title && currentSection) currentSection.entries.push(currentEntry);
  result.sections = result.sections.filter(s => s.entries.length > 0);

  // Infer category
  const categories = {
    git:'版本控制', docker:'容器', linux:'系统', bash:'Shell',
    python:'编程语言', javascript:'编程语言', js:'编程语言', typescript:'编程语言',
    node:'编程语言', react:'前端', vue:'前端', css:'前端', html:'前端',
    nginx:'服务器', sql:'数据库', redis:'数据库', mongodb:'数据库',
    vim:'编辑器', curl:'网络', ssh:'网络', tmux:'终端', make:'构建',
    cmake:'构建', cargo:'Rust', rust:'编程语言', cpp:'C++', go:'编程语言',
    java:'编程语言', ruby:'编程语言', php:'编程语言', swift:'编程语言',
    kotlin:'编程语言', flutter:'移动端', android:'移动端',
  };
  const key = (result.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  result.category = '';
  for (const [k, v] of Object.entries(categories)) {
    if (key.includes(k)) { result.category = v; break; }
  }

  return result;
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const limitIdx = process.argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) || 0 : 0;

  console.log('Fetching file list from GitHub API...');
  const items = curlJSON(API_URL);
  let mdFiles = items
    .filter(d => d.name.endsWith('.md') && d.name !== 'README.md')
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Found ${mdFiles.length} markdown files.`);
  if (limit > 0) { mdFiles = mdFiles.slice(0, limit); console.log(`LIMIT: ${limit} files.`); }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const results = [];
  let ok = 0, fail = 0, totalEntries = 0;

  for (let i = 0; i < mdFiles.length; i++) {
    const file = mdFiles[i];
    const mdUrl = `${RAW_BASE}/${file.name}`;
    const outName = file.name.replace(/\.md$/, '.json');

    try {
      const md = curlText(mdUrl);
      const parsed = parseCheatsheet(md);
      if (!parsed.name) parsed.name = file.name.replace(/\.md$/, '').replace(/[-_]/g, ' ');

      const entries = parsed.sections.reduce((n, s) => n + s.entries.length, 0);
      totalEntries += entries;

      const output = {
        name: parsed.name,
        description: `${parsed.name} 快速参考`,
        category: parsed.category,
        count: entries,
        sections: parsed.sections,
        source: `https://github.com/jaywcjlove/reference/blob/main/docs/${file.name}`,
      };

      writeFileSync(join(OUT_DIR, outName), JSON.stringify(output, null, 2) + '\n');
      results.push({ file: outName, name: parsed.name, category: parsed.category, count: entries });
      ok++;
      console.log(`  ✓ [${i + 1}/${mdFiles.length}] ${outName} (${entries} entries)`);
    } catch (err) {
      fail++;
      console.log(`  ✗ [${i + 1}/${mdFiles.length}] ${file.name} — ${err.message}`);
    }
  }

  // Write index.json
  results.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(INDEX_PATH, JSON.stringify(results, null, 2) + '\n');

  console.log(`\nDone. ${ok} succeeded, ${fail} failed, ${totalEntries} total entries.`);
  console.log(`Index: ${INDEX_PATH}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
