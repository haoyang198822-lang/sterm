// 测试：解析参考项目的 markdown → 结构化 JSON
// 支持 setex (===/---) 和 ATX (#) 两种标题格式

import { readFileSync } from 'fs';

function parseCheatsheet(md) {
  const lines = md.split('\n');
  const result = { name: '', sections: [] };

  let currentSection = null;
  let currentEntry = null;
  let pendingText = [];
  let inCodeBlock = false;
  let codeLines = [];
  let i = 0;

  function flushEntry() {
    if (!currentEntry) return;
    currentEntry.description = pendingText.join('\n').trim();
    currentEntry.code = codeLines.join('\n').trim();
    pendingText = [];
    codeLines = [];
    inCodeBlock = false;
  }

  function addEntry(title) {
    flushEntry();
    if (currentEntry && currentEntry.title && currentSection) {
      currentSection.entries.push(currentEntry);
    }
    currentEntry = { title: title.trim(), description: '', code: '' };
  }

  while (i < lines.length) {
    const line = lines[i];

    // === 风格 H1 (setex): current line is ===, previous line is title
    if (/^={2,}\s*$/.test(line) && i > 0 && lines[i-1].trim()) {
      result.name = lines[i-1].trim().replace(/备忘清单.*$/, '').replace(/备忘单.*$/, '').trim();
      i++;
      continue;
    }

    // --- 风格 H2 (setex)
    if (/^-{2,}\s*$/.test(line) && i > 0 && lines[i-1].trim() && !lines[i-1].startsWith('#')) {
      const h2Title = lines[i-1].trim();
      flushEntry();
      if (currentEntry && currentEntry.title && currentSection) currentSection.entries.push(currentEntry);
      currentEntry = null;
      currentSection = { title: h2Title, entries: [] };
      result.sections.push(currentSection);
      pendingText = [];
      codeLines = [];
      inCodeBlock = false;
      i++;
      continue;
    }

    // ATX H1
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match && !line.startsWith('##')) {
      result.name = h1Match[1].replace(/备忘清单.*$/, '').replace(/备忘单.*$/, '').trim();
      i++;
      continue;
    }

    // ATX H2
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match && !line.startsWith('###')) {
      flushEntry();
      if (currentEntry && currentEntry.title && currentSection) currentSection.entries.push(currentEntry);
      currentEntry = null;
      currentSection = { title: h2Match[1].trim(), entries: [] };
      result.sections.push(currentSection);
      pendingText = [];
      codeLines = [];
      inCodeBlock = false;
      i++;
      continue;
    }

    // ATX H3
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      addEntry(h3Match[1]);
      i++;
      continue;
    }

    // ATX H4
    const h4Match = line.match(/^####\s+(.+)/);
    if (h4Match) {
      pendingText.push('__' + h4Match[1].trim() + '__');
      i++;
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLines = [];
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      i++;
      continue;
    }

    // Skip separators and HTML comments
    if (/^-{3,}\s*$/.test(line) && i > 0 && !lines[i-1].trim()) {
      i++;
      continue;
    }
    if (line.startsWith('<!--') || line.startsWith('-->')) {
      i++;
      continue;
    }
    // Empty line reset pending for non-content
    if (!line.trim()) {
      if (pendingText.length > 0 && pendingText[pendingText.length-1] !== '') {
        pendingText.push('');
      }
      i++;
      continue;
    }

    // Regular text
    pendingText.push(line.trim());
    i++;
  }

  // Flush last entry
  flushEntry();
  if (currentEntry && currentEntry.title && currentSection) currentSection.entries.push(currentEntry);

  // Clean up empty sections and entries
  result.sections = result.sections.filter(s => s.entries.length > 0);

  return result;
}

// Test
const files = ['test-git.md', 'test-css.md', 'test-vim.md'];

for (const file of files) {
  console.log(`\n========== ${file} ==========`);
  
  const md = readFileSync(`/tmp/${file}`, 'utf-8');
  const parsed = parseCheatsheet(md);
  
  console.log(`Name: "${parsed.name}"`);
  console.log(`Sections: ${parsed.sections.length}`);
  
  let totalEntries = 0;
  for (const sec of parsed.sections) {
    totalEntries += sec.entries.length;
    const preview = sec.entries.slice(0, 2).map(e => {
      const codeLen = e.code.length;
      const descLen = e.description.length;
      return `    [${e.title}] code=${codeLen}B desc=${descLen}B`;
    }).join('\n');
    console.log(`  [${sec.title}] ${sec.entries.length} entries`);
    console.log(preview);
    if (sec.entries.length > 2) console.log(`    ... ${sec.entries.length - 2} more`);
  }
  
  const jsonStr = JSON.stringify(parsed, null, 2);
  console.log(`  Total: ${totalEntries} entries`);
  console.log(`  Raw MD: ${md.length}B → JSON: ${jsonStr.length}B (${(jsonStr.length/md.length*100).toFixed(0)}%)`);
}
