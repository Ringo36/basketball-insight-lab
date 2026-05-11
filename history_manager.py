import sqlite3
import json
import os
from datetime import datetime, date
from pathlib import Path

DB_PATH = Path(__file__).parent / "history" / "basketball_history.db"
SITE = "sports"


def init_db():
    """DBとテーブルを初期化"""
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS themes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            theme TEXT NOT NULL,
            slug TEXT,
            site TEXT NOT NULL DEFAULT 'sports',
            article_score INTEGER,
            note_score INTEGER,
            published INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            site TEXT NOT NULL DEFAULT 'sports',
            structure_score INTEGER,
            article_score INTEGER,
            note_score INTEGER,
            fc_issues INTEGER DEFAULT 0,
            rewrite_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()
    print("✅ DB初期化完了")


def is_duplicate_theme(theme: str, site: str = SITE, days: int = 30) -> bool:
    """過去N日以内に同じテーマが使われていないか確認"""
    if not DB_PATH.exists():
        return False
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT COUNT(*) FROM themes
        WHERE site = ?
        AND date >= date('now', ?)
        AND (
            theme LIKE ?
            OR ? LIKE '%' || theme || '%'
        )
    """, (site, f'-{days} days', f'%{theme[:10]}%', theme))
    count = cur.fetchone()[0]
    conn.close()
    return count > 0


def save_theme(date_str: str, theme: str, slug: str, site: str,
               article_score: int, note_score: int, published: bool):
    """テーマと採点結果を保存"""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO themes (date, theme, slug, site, article_score, note_score, published)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (date_str, theme, slug, site, article_score, note_score,
          1 if published else 0))
    conn.commit()
    conn.close()


def save_scores(date_str: str, site: str, structure_score: int,
                article_score: int, note_score: int,
                fc_issues: int, rewrite_count: int):
    """採点結果を保存"""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO scores
        (date, site, structure_score, article_score, note_score, fc_issues, rewrite_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (date_str, site, structure_score, article_score, note_score,
          fc_issues, rewrite_count))
    conn.commit()
    conn.close()


def get_recent_themes(site: str = SITE, limit: int = 30) -> list:
    """最近のテーマ一覧を取得（重複チェック用）"""
    if not DB_PATH.exists():
        return []
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT theme, date, article_score FROM themes
        WHERE site = ?
        ORDER BY date DESC
        LIMIT ?
    """, (site, limit))
    rows = cur.fetchall()
    conn.close()
    return [{"theme": r[0], "date": r[1], "score": r[2]} for r in rows]


def get_score_stats(site: str = SITE, days: int = 30) -> dict:
    """採点結果の統計を取得"""
    if not DB_PATH.exists():
        return {}
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT
            AVG(article_score) as avg_article,
            AVG(note_score) as avg_note,
            AVG(fc_issues) as avg_fc,
            AVG(rewrite_count) as avg_rewrite,
            COUNT(*) as total
        FROM scores
        WHERE site = ?
        AND date >= date('now', ?)
    """, (site, f'-{days} days'))
    row = cur.fetchone()
    conn.close()
    return {
        "avg_article_score": round(row[0] or 0, 1),
        "avg_note_score": round(row[1] or 0, 1),
        "avg_fc_issues": round(row[2] or 0, 1),
        "avg_rewrite_count": round(row[3] or 0, 1),
        "total_articles": row[4]
    }


class HistoryManager:
    """sports版履歴管理クラス（auto_generate.pyから利用）"""

    def __init__(self):
        init_db()

    def is_duplicate_theme(self, theme: str, days: int = 30) -> bool:
        return is_duplicate_theme(theme, SITE, days)

    def save_theme(self, theme: str, slug: str, article_score: int,
                   note_score: int = 0, published: bool = True):
        today = date.today().isoformat()
        save_theme(today, theme, slug, SITE, article_score, note_score,
                   published)

    def save_scores(self, slug: str, article_score: int, note_score: int,
                    structure_score: int, fc_issues: int = 0,
                    rewrite_count: int = 0):
        today = date.today().isoformat()
        save_scores(today, SITE, structure_score, article_score, note_score,
                    fc_issues, rewrite_count)

    def get_recent_themes(self, limit: int = 30) -> list:
        return get_recent_themes(SITE, limit)

    def get_stats(self, days: int = 30) -> dict:
        return get_score_stats(SITE, days)


if __name__ == "__main__":
    hm = HistoryManager()
    stats = hm.get_stats()
    print(f"📊 過去30日の統計: {json.dumps(stats, ensure_ascii=False)}")
