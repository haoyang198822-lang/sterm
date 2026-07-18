#!/usr/bin/env python3
"""
scripts/preprocess_cheats.py

将 sterm-data/cheats/*.json（211 文件，6780 条目）预处理为 SQLite FTS5 数据库，
供 Reactive Agent 搜索使用。

- 扁平化 section/entries 层级
- 自动补全空描述（title + section 拼接）
- 过滤无代码条目（纯概念条目对"查命令"无用）
- 建立 FTS5 全文索引
"""

import json
import os
import sqlite3
import sys
import glob
import re
from pathlib import Path

# === 配置 ===
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CHEATS_DIR = PROJECT_ROOT / "sterm-data" / "cheats"
DB_PATH = PROJECT_ROOT / "sterm-data" / "cheats.db"

# === 数据清洗 ===


def parse_entry(
    entry: dict, section_title: str, category: str, source_file: str
) -> dict | None:
    """解析单条 entry，清洗后返回扁平结构。无代码的条目过滤掉。"""
    title = (entry.get("title") or "").strip()
    code = (entry.get("code") or "").strip()
    description = (entry.get("description") or "").strip()

    # 过滤：必须有代码
    if not code:
        return None

    # 补描述：空的用 title + section 拼接
    if not description:
        parts = [title]
        if section_title and section_title.lower() not in title.lower():
            parts.append(f"（{section_title}）")
        description = " ".join(parts)

    # 从 code 中提取关键命令（第一行非注释的命令）
    first_cmd = ""
    for line in code.split("\n"):
        line = line.strip()
        if (
            line
            and not line.startswith("#")
            and not line.startswith("//")
            and not line.startswith("<!--")
        ):
            # 去掉 $ 前缀
            first_cmd = re.sub(r"^\$\s*", "", line)
            break

    # tags：从 section title 和 category 自动生成
    tag_parts = []
    if category and category != "<无分类>":
        tag_parts.append(category)
    if section_title and section_title != category:
        tag_parts.append(section_title)
    tags = ",".join(tag_parts)

    return {
        "name": title,
        "code": code,
        "description": description[:500],  # 截断过长描述
        "first_cmd": first_cmd[:200],
        "tags": tags,
        "category": category,
        "section": section_title,
        "source_file": source_file,
    }


def load_all_cheats(cheats_dir: str) -> list[dict]:
    """加载所有 JSON，返回扁平化的命令列表。"""
    files = sorted(glob.glob(os.path.join(cheats_dir, "*.json")))
    commands = []

    for fpath in files:
        fname = os.path.basename(fpath)
        with open(fpath, encoding="utf-8") as f:
            data = json.load(f)

        # 兼容 dict 和 list 两种格式
        if isinstance(data, list):
            sections = data
            category = "<无分类>"
        else:
            category = (data.get("category") or "").strip() or "<无分类>"
            sections = data.get("sections", [])

        for sec in sections:
            if not isinstance(sec, dict):
                continue
            section_title = (sec.get("title") or "").strip()
            for entry in sec.get("entries", []):
                if not isinstance(entry, dict):
                    continue
                parsed = parse_entry(entry, section_title, category, fname)
                if parsed:
                    commands.append(parsed)

    return commands


# === SQLite + FTS5 ===


def create_db(commands: list[dict], db_path: str):
    """建表 + FTS5 全文索引 + 写入数据。"""
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=OFF")
    cur = conn.cursor()

    # 主表
    cur.execute("""
        CREATE TABLE commands (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            code        TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            first_cmd   TEXT NOT NULL DEFAULT '',
            tags        TEXT NOT NULL DEFAULT '',
            category    TEXT NOT NULL DEFAULT '',
            section     TEXT NOT NULL DEFAULT '',
            source_file TEXT NOT NULL DEFAULT ''
        )
    """)

    # FTS5 全文索引（查询速度毫秒级）
    cur.execute("""
        CREATE VIRTUAL TABLE commands_fts USING fts5(
            name, description, tags, category, code,
            content='commands',
            content_rowid='id',
            tokenize='unicode61 remove_diacritics 2'
        )
    """)

    # 触发器：保持 FTS 与主表同步
    cur.execute("""
        CREATE TRIGGER commands_ai AFTER INSERT ON commands BEGIN
            INSERT INTO commands_fts(rowid, name, description, tags, category, code)
            VALUES (new.id, new.name, new.description, new.tags, new.category, new.code);
        END
    """)
    cur.execute("""
        CREATE TRIGGER commands_ad AFTER DELETE ON commands BEGIN
            INSERT INTO commands_fts(commands_fts, rowid, name, description, tags, category, code)
            VALUES ('delete', old.id, old.name, old.description, old.tags, old.category, old.code);
        END
    """)
    cur.execute("""
        CREATE TRIGGER commands_au AFTER UPDATE ON commands BEGIN
            INSERT INTO commands_fts(commands_fts, rowid, name, description, tags, category, code)
            VALUES ('delete', old.id, old.name, old.description, old.tags, old.category, old.code);
            INSERT INTO commands_fts(rowid, name, description, tags, category, code)
            VALUES (new.id, new.name, new.description, new.tags, new.category, new.code);
        END
    """)

    # 批量写入
    rows = [
        (
            c["name"],
            c["code"],
            c["description"],
            c["first_cmd"],
            c["tags"],
            c["category"],
            c["section"],
            c["source_file"],
        )
        for c in commands
    ]
    cur.executemany(
        "INSERT INTO commands (name, code, description, first_cmd, tags, category, section, source_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        rows,
    )

    # 额外索引
    cur.execute("CREATE INDEX idx_commands_category ON commands(category)")
    cur.execute("CREATE INDEX idx_commands_source ON commands(source_file)")

    conn.commit()

    # 验证
    count = cur.execute("SELECT COUNT(*) FROM commands").fetchone()[0]
    fts_count = cur.execute(
        "SELECT COUNT(*) FROM commands_fts"
    ).fetchone()[0]

    conn.close()
    return count, fts_count


# === 数据质量报告 ===


def print_report(commands: list[dict], raw_count: int):
    """打印清洗前后的质量对比。"""
    total = len(commands)
    no_desc = sum(1 for c in commands if not c["description"])
    has_first_cmd = sum(1 for c in commands if c["first_cmd"])

    # 分类分布
    cat_dist = {}
    for c in commands:
        cat_dist[c["category"]] = cat_dist.get(c["category"], 0) + 1

    print()
    print("=" * 50)
    print("  数据预处理报告")
    print("=" * 50)
    print(f"  原始条目:               {raw_count}")
    print(f"  过滤后（有代码的）:      {total}")
    print(f"  过滤掉（无代码的）:      {raw_count - total}")
    print(f"  补全描述:               已自动补全")
    print(f"  提取 first_cmd:          {has_first_cmd}/{total}")
    print()
    print(f"  --- 分类分布 Top 10 ---")
    for cat, cnt in sorted(cat_dist.items(), key=lambda x: -x[1])[:10]:
        print(f"    {cnt:5d}  {cat}")
    print()
    if no_desc > 0:
        print(f"  ⚠️  仍有 {no_desc} 条无描述（通常是 section 本身也无标题）")
    print(f"  ✅ 数据清洗完成")


# === 主入口 ===


def main():
    print(f"加载数据: {CHEATS_DIR}")
    raw_files = glob.glob(os.path.join(str(CHEATS_DIR), "*.json"))
    print(f"  共 {len(raw_files)} 个 JSON 文件")

    commands = load_all_cheats(str(CHEATS_DIR))
    raw_count = len(commands)  # 先记带代码过滤前的总数
    # 重新读取原始计数（包括无代码的）
    raw_all = []
    for fpath in raw_files:
        with open(fpath, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            sections = data
        else:
            sections = data.get("sections", [])
        for sec in sections:
            if isinstance(sec, dict):
                raw_all.extend(sec.get("entries", []))
    raw_total = len(raw_all)

    # 过滤无代码的已经在 parse_entry 里做了
    print(f"  原始条目: {raw_total}")
    print(f"  有效命令: {len(commands)}")
    print(f"  过滤掉:   {raw_total - len(commands)}")

    count, fts_count = create_db(commands, str(DB_PATH))
    print(f"\n写入数据库: {DB_PATH}")
    print(f"  commands 表:   {count} 行")
    print(f"  commands_fts:  {fts_count} 行")

    # 验证搜索
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    test_queries = ["撤销提交", "端口", "压缩", "git stash", "权限"]
    print(f"\n--- FTS5 搜索验证 ---")
    for q in test_queries:
        cur.execute(
            "SELECT c.name, c.first_cmd, rank FROM commands_fts f JOIN commands c ON c.id = f.rowid WHERE commands_fts MATCH ? ORDER BY rank LIMIT 3",
            (q,),
        )
        rows = cur.fetchall()
        print(f"\n  搜索: '{q}'")
        if rows:
            for name, cmd, rank in rows:
                print(f"    [{rank:.2f}] {name} → {cmd or '(无快捷命令)'}")
        else:
            print("    (无结果)")
    conn.close()

    print_report(commands, raw_total)
    print("\n✅ 预处理完成")
    print(f"  数据库: {DB_PATH}")
    print(f"  大小:   {os.path.getsize(str(DB_PATH)) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
