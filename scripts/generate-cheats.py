#!/usr/bin/env python3
"""
scripts/generate-cheats.py

Fetch all .md from jaywcjlove/reference, parse into structured JSON,
write to sterm-data/cheats/.

# Usage:
#   python3.13 scripts/generate-cheats.py          # all 210 files
#   python3.13 scripts/generate-cheats.py --limit 5 # dry-run 5 files
"""

import json, os, sys, time, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'sterm-data' / 'cheats'
INDEX_PATH = OUT_DIR / 'index.json'

API_URL = 'https://api.github.com/repos/jaywcjlove/reference/contents/docs'
RAW_BASE = 'https://raw.githubusercontent.com/jaywcjlove/reference/main/docs'

CATEGORIES = {
    'git': '版本控制', 'docker': '容器', 'linux': '系统', 'bash': 'Shell',
    'python': '编程语言', 'javascript': '编程语言', 'js': '编程语言', 'typescript': '编程语言',
    'node': '编程语言', 'react': '前端', 'vue': '前端', 'css': '前端', 'html': '前端',
    'nginx': '服务器', 'sql': '数据库', 'redis': '数据库', 'mongodb': '数据库',
    'vim': '编辑器', 'curl': '网络', 'ssh': '网络', 'tmux': '终端', 'make': '构建',
    'cmake': '构建', 'cargo': 'Rust', 'rust': '编程语言', 'go': '编程语言',
    'java': '编程语言', 'ruby': '编程语言', 'php': '编程语言', 'swift': '编程语言',
    'kotlin': '编程语言', 'flutter': '移动端', 'android': '移动端',
}

def fetch(url):
    for attempt in range(3):
        try:
            return subprocess.check_output(['curl', '-sL', '--retry', '2', url], timeout=60, encoding='utf-8')
        except subprocess.CalledProcessError as e:
            if attempt < 2:
                time.sleep(2)
                continue
            raise

def fetch_json(url):
    return json.loads(fetch(url))

# ── Parser ────────────────────────────────────────────────────────

def parse_cheatsheet(md):
    lines = md.split('\n')
    result = {'name': '', 'sections': []}
    current_section = None
    current_entry = None
    pending_text = []
    code_lines = []
    in_code = False

    def flush_entry():
        nonlocal pending_text, code_lines, in_code
        if current_entry is None:
            return
        desc = '\n'.join(pending_text).strip()
        # Table-style content (multiple pipes) with no code block → move to code, clean markdown
        if desc.count('|') > 3 and not code_lines:
            clean = []
            for line in desc.split('\n'):
                # Strip table header separator lines like :--- | :---
                if re.match(r'^:?---', line.strip()):
                    continue
                # Strip markdown bold/backtick **`xxx`** → xxx
                line = re.sub(r'\*\*`([^`]+)`\*\*', r'\1', line)
                line = re.sub(r'\*\*([^*]+)\*\*', r'\1', line)
                # Strip markdown links [text](url) → text
                line = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', line)
                clean.append(line)
            code_lines = clean
            desc = ''
        current_entry['description'] = desc
        current_entry['code'] = '\n'.join(code_lines).strip()
        pending_text = []
        code_lines = []
        in_code = False

    for i, line in enumerate(lines):
        # Setex H1
        if re.match(r'^={2,}\s*$', line) and i > 0 and lines[i-1].strip() and not result['name']:
            result['name'] = re.sub(r'备忘清单.*$', '', lines[i-1]).replace('备忘单', '').strip()
            continue

        # Setex H2
        if re.match(r'^-{2,}\s*$', line) and i > 0 and lines[i-1].strip() and not lines[i-1].startswith('#'):
            flush_entry()
            if current_entry and current_entry['title'] and current_section is not None:
                current_section['entries'].append(current_entry)
            current_entry = None
            current_section = {'title': lines[i-1].strip(), 'entries': []}
            result['sections'].append(current_section)
            pending_text = []
            code_lines = []
            in_code = False
            continue

        # ATX H1
        m = re.match(r'^#\s+(.+)', line)
        if m and not line.startswith('##') and not result['name']:
            result['name'] = re.sub(r'备忘清单.*$', '', m.group(1)).replace('备忘单', '').strip()
            continue

        # ATX H3
        m = re.match(r'^###\s+(.+)', line)
        if m:
            flush_entry()
            if current_entry and current_entry['title'] and current_section is not None:
                current_section['entries'].append(current_entry)
            current_entry = {'title': m.group(1).strip(), 'description': '', 'code': ''}
            pending_text = []
            code_lines = []
            in_code = False
            continue

        # ATX H4
        m = re.match(r'^####\s+(.+)', line)
        if m:
            if pending_text:
                pending_text.append('')
            pending_text.append('**' + m.group(1).strip() + '**')
            continue

        # Code block
        if line.lstrip().startswith('```'):
            if in_code:
                in_code = False
            else:
                in_code = True
                code_lines = []
            continue

        if in_code:
            code_lines.append(line)
            continue

        if re.match(r'^-{3,}\s*$', line) and (i == 0 or not lines[i-1].strip()):
            continue
        if line.startswith('<!--') or line.startswith('-->'):
            continue
        if not line.strip():
            continue

        pending_text.append(line.strip())

    flush_entry()
    if current_entry and current_entry['title'] and current_section is not None:
        current_section['entries'].append(current_entry)

    result['sections'] = [s for s in result['sections'] if s['entries']]

    # Infer category
    key = re.sub(r'[^a-z0-9]', '', (result['name'] or '').lower())
    result['category'] = ''
    for k, v in CATEGORIES.items():
        if k in key:
            result['category'] = v
            break

    return result

# ── Main ──────────────────────────────────────────────────────────

def main():
    limit = 0
    if '--limit' in sys.argv:
        idx = sys.argv.index('--limit')
        limit = int(sys.argv[idx + 1]) if idx + 1 < len(sys.argv) else 0

    print('Fetching file list from GitHub API...')
    items = fetch_json(API_URL)
    md_files = sorted(
        [d for d in items if d['name'].endswith('.md') and d['name'] != 'README.md'],
        key=lambda d: d['name']
    )

    print(f'Found {len(md_files)} markdown files.')
    if limit > 0:
        md_files = md_files[:limit]
        print(f'LIMIT: {limit} files.')

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    ok = fail = total_entries = 0

    for i, file in enumerate(md_files):
        md_url = f'{RAW_BASE}/{file["name"]}'
        out_name = file['name'].replace('.md', '.json')

        try:
            md = fetch(md_url)
            parsed = parse_cheatsheet(md)

            if not parsed['name']:
                parsed['name'] = file['name'].replace('.md', '').replace('-', ' ').replace('_', ' ')

            entries = sum(len(s['entries']) for s in parsed['sections'])
            total_entries += entries

            output = {
                'name': parsed['name'],
                'description': f'{parsed["name"]} 快速参考',
                'category': parsed['category'],
                'count': entries,
                'sections': parsed['sections'],
                'source': f'https://github.com/jaywcjlove/reference/blob/main/docs/{file["name"]}',
            }

            with open(OUT_DIR / out_name, 'w', encoding='utf-8') as f:
                json.dump(output, f, ensure_ascii=False, indent=2)
                f.write('\n')

            results.append({
                'file': out_name,
                'name': parsed['name'],
                'category': parsed['category'],
                'count': entries,
            })
            ok += 1
            print(f'  \u2713 [{i+1}/{len(md_files)}] {out_name} ({entries} entries)')
        except Exception as e:
            fail += 1
            print(f'  \u2717 [{i+1}/{len(md_files)}] {file["name"]} \u2014 {e}')

    results.sort(key=lambda r: r['name'])
    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'\nDone. {ok} succeeded, {fail} failed, {total_entries} total entries.')
    print(f'Index: {INDEX_PATH}')

if __name__ == '__main__':
    main()
