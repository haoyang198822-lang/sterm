#!/usr/bin/env python3
"""Regenerate placeholder JSON files and rebuild index."""
import json, subprocess, os, re, glob

RAW_BASE = 'https://raw.githubusercontent.com/jaywcjlove/reference/main/docs'

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
        if current_entry is None: return
        current_entry['description'] = '\n'.join(pending_text).strip()
        current_entry['code'] = '\n'.join(code_lines).strip()
        pending_text = []; code_lines = []; in_code = False

    for i, line in enumerate(lines):
        if re.match(r'^={2,}\s*$', line) and i > 0 and lines[i-1].strip() and not result['name']:
            result['name'] = re.sub(r'备忘清单.*$', '', lines[i-1]).replace('备忘单', '').strip()
            continue
        if re.match(r'^-{2,}\s*$', line) and i > 0 and lines[i-1].strip() and not lines[i-1].startswith('#'):
            flush_entry()
            if current_entry and current_entry['title'] and current_section is not None:
                current_section['entries'].append(current_entry)
            current_entry = None
            current_section = {'title': lines[i-1].strip(), 'entries': []}
            result['sections'].append(current_section)
            pending_text = []; code_lines = []; in_code = False
            continue
        m = re.match(r'^#\s+(.+)', line)
        if m and not line.startswith('##') and not result['name']:
            result['name'] = re.sub(r'备忘清单.*$', '', m.group(1)).replace('备忘单', '').strip()
            continue
        m = re.match(r'^###\s+(.+)', line)
        if m:
            flush_entry()
            if current_entry and current_entry['title'] and current_section is not None:
                current_section['entries'].append(current_entry)
            current_entry = {'title': m.group(1).strip(), 'description': '', 'code': ''}
            pending_text = []; code_lines = []; in_code = False
            continue
        m = re.match(r'^####\s+(.+)', line)
        if m:
            if pending_text: pending_text.append('')
            pending_text.append('**' + m.group(1).strip() + '**')
            continue
        if line.lstrip().startswith('```'):
            if in_code: in_code = False
            else: in_code = True; code_lines = []
            continue
        if in_code: code_lines.append(line); continue
        if re.match(r'^-{3,}\s*$', line) and (i == 0 or not lines[i-1].strip()): continue
        if line.startswith('<!--') or line.startswith('-->'): continue
        if not line.strip(): continue
        pending_text.append(line.strip())

    flush_entry()
    if current_entry and current_entry['title'] and current_section is not None:
        current_section['entries'].append(current_entry)
    result['sections'] = [s for s in result['sections'] if s['entries']]

    cat_map = {
        'git':'版本控制', 'docker':'容器', 'linux':'系统', 'bash':'Shell',
        'python':'编程语言', 'javascript':'编程语言', 'css':'前端', 'html':'前端',
        'node':'编程语言', 'react':'前端', 'vue':'前端', 'nginx':'服务器',
        'sql':'数据库', 'redis':'数据库', 'vim':'编辑器', 'curl':'网络',
        'ssh':'网络', 'tmux':'终端', 'make':'构建',
    }
    key = re.sub(r'[^a-z0-9]', '', (result['name'] or '').lower())
    result['category'] = ''
    for k, v in cat_map.items():
        if k in key: result['category'] = v; break
    return result

# Find and fix placeholder files
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cheats_dir = os.path.join(ROOT, 'sterm-data', 'cheats')

for p in sorted(glob.glob(os.path.join(cheats_dir, '*.json'))):
    if p.endswith('index.json'): continue
    with open(p) as f:
        content = f.read(200)
    if 'placeholder' not in content:
        continue

    fname = os.path.basename(p).replace('.json', '')
    md_url = f'{RAW_BASE}/{fname}.md'
    print(f'Downloading {fname}...')

    for attempt in range(5):
        try:
            md = subprocess.check_output(['curl', '-sL', '--retry', '2', md_url], timeout=60, encoding='utf-8')
            parsed = parse_cheatsheet(md)
            entries = sum(len(s['entries']) for s in parsed['sections'])
            out = {
                'name': parsed['name'] or fname.replace('-',' ').replace('_',' '),
                'description': f'{parsed["name"] or fname} 快速参考',
                'category': parsed.get('category', ''),
                'count': entries,
                'sections': parsed['sections'],
                'source': f'{RAW_BASE}/{fname}.md',
            }
            with open(p, 'w', encoding='utf-8') as f:
                json.dump(out, f, ensure_ascii=False, indent=2)
                f.write('\n')
            print(f'  -> {fname}.json ({entries} entries)')
            break
        except Exception as e:
            if attempt < 4:
                import time; time.sleep(3)
                continue
            print(f'  FAILED: {e}')

# Rebuild index
results = []
for p in sorted(glob.glob(os.path.join(cheats_dir, '*.json'))):
    if p.endswith('index.json'): continue
    with open(p) as f:
        try:
            d = json.load(f)
            results.append({
                'file': os.path.basename(p),
                'name': d['name'],
                'category': d.get('category', ''),
                'count': d['count'],
            })
        except:
            print(f'BAD JSON, removing: {p}')
            os.remove(p)

results.sort(key=lambda r: r['name'])
with open(os.path.join(cheats_dir, 'index.json'), 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
    f.write('\n')

total = sum(r['count'] for r in results)
print(f'\nDone. {len(results)} files, {total} entries.')
