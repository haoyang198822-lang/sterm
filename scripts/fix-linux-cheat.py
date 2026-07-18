#!/usr/bin/env python3
"""Regenerate linux-command.json with fixed parser (table→code)."""
import json, subprocess, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = 'https://raw.githubusercontent.com/jaywcjlove/reference/main/docs/linux-command.md'

def parse(md):
    lines = md.split('\n')
    result = {'name': '', 'sections': []}
    cs = None; ce = None; pt = []; cl = []; ic = False
    def flush():
        nonlocal pt, cl, ic
        if ce is None: return
        d = '\n'.join(pt).strip()
        if d.count('|') > 3 and not cl:
            clean = []
            for line in d.split('\n'):
                if re.match(r'^:?---', line.strip()): continue
                line = re.sub(r'\*\*`([^`]+)`\*\*', r'\1', line)
                line = re.sub(r'\*\*([^*]+)\*\*', r'\1', line)
                line = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', line)
                clean.append(line)
            cl = clean; d = ''
        ce['description'] = d
        ce['code'] = '\n'.join(cl).strip()
        pt = []; cl = []; ic = False
    for i, l in enumerate(lines):
        m = re.match(r'^={2,}\s*$', l)
        if m and i > 0 and lines[i-1].strip() and not result['name']:
            result['name'] = re.sub(r'备忘清单.*$', '', lines[i-1]).replace('备忘单', '').strip()
            continue
        m = re.match(r'^-{2,}\s*$', l)
        if m and i > 0 and lines[i-1].strip() and not lines[i-1].startswith('#'):
            flush()
            if ce and ce['title'] and cs is not None: cs['entries'].append(ce)
            ce = None; cs = {'title': lines[i-1].strip(), 'entries': []}
            result['sections'].append(cs); pt = []; cl = []; ic = False
            continue
        m = re.match(r'^###\s+(.+)', l)
        if m:
            flush()
            if ce and ce['title'] and cs is not None: cs['entries'].append(ce)
            ce = {'title': m.group(1).strip(), 'description': '', 'code': ''}
            pt = []; cl = []; ic = False; continue
        if l.lstrip().startswith('```'):
            ic = False if ic else True
            if ic: cl = []
            continue
        if ic: cl.append(l); continue
        if not l.strip() or l.startswith('<!--') or l.startswith('-->'): continue
        pt.append(l.strip())
    flush()
    if ce and ce['title'] and cs is not None: cs['entries'].append(ce)
    result['sections'] = [s for s in result['sections'] if s['entries']]
    return result

md = subprocess.check_output(['curl', '-sL', RAW], timeout=30, encoding='utf-8')
parsed = parse(md)
entries = sum(len(s['entries']) for s in parsed['sections'])

out = {
    'name': 'Linux 命令速查表',
    'description': 'Linux 命令速查表 — 快速参考',
    'category': '系统',
    'count': entries,
    'sections': parsed['sections'],
    'source': 'https://github.com/jaywcjlove/reference/blob/main/docs/linux-command.md',
}
path = os.path.join(ROOT, 'sterm-data', 'cheats', 'linux-command.json')
with open(path, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
    f.write('\n')

# Verify
s0 = parsed['sections'][0]; e0 = s0['entries'][0]
print(f'{entries} entries, {len(parsed["sections"])} sections')
print(f'First entry: [{e0["title"]}] code={len(e0["code"])}B desc={len(e0["description"])}B')
print(f'Code preview: {e0["code"][:120]}')
print(f'Written: {path}')
