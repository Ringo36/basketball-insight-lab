import anthropic
import os, sys, json, re, subprocess, random, sqlite3
from datetime import datetime, date, timedelta
from pathlib import Path
import requests
import frontmatter

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

CURRENT_YEAR = datetime.now().year
CURRENT_MONTH = datetime.now().month
TODAY = date.today().isoformat()
CONTENT_DIR = Path("content")
CONTENT_NOTE_DIR = Path("content-note")
HISTORY_DIR = Path("history")

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

NBA_TEAMS = [
    "Boston Celtics", "New York Knicks", "Philadelphia 76ers",
    "Brooklyn Nets", "Toronto Raptors", "Cleveland Cavaliers",
    "Chicago Bulls", "Milwaukee Bucks", "Indiana Pacers",
    "Detroit Pistons", "Miami Heat", "Orlando Magic",
    "Atlanta Hawks", "Charlotte Hornets", "Washington Wizards",
    "Oklahoma City Thunder", "Denver Nuggets", "Minnesota Timberwolves",
    "Golden State Warriors", "Los Angeles Lakers", "Los Angeles Clippers",
    "Phoenix Suns", "Sacramento Kings", "Portland Trail Blazers",
    "Utah Jazz", "Dallas Mavericks", "Memphis Grizzlies",
    "New Orleans Pelicans", "Houston Rockets", "San Antonio Spurs"
]

NBA_KEYWORDS = [
    "contract extension", "trade rumor", "playoff",
    "rookie", "role player", "stats leader",
    "injury update", "draft", "G League call-up",
    "coaching strategy", "salary cap", "free agency"
]

MODEL_HEAVY = "claude-opus-4-6"    # 本文執筆・リライト・note生成
MODEL_LIGHT = "claude-sonnet-4-6"  # レビュー・FC・トレンド・スコアリング


# ========================================
# 共通ヘルパー関数
# ========================================
def yaml_escape(text: str) -> str:
    return str(text).replace('"', '\\"')


def call_ai(role: str, prompt: str, schema: dict,
            model: str = MODEL_LIGHT, use_web: bool = False) -> dict:
    """tool_use JSON強制モードでAIを呼び出す"""
    tools = []
    if use_web:
        tools.append({"type": "web_search_20250305", "name": "web_search"})
    tools.append({
        "name": "output_json",
        "description": "構造化データを出力する",
        "input_schema": schema
    })

    for attempt in range(1, 4):
        try:
            print(f"🤖 [{role}] 起動中...（試行{attempt}回目）")
            msg = client.messages.create(
                model=model,
                max_tokens=2048,
                tools=tools,
                tool_choice={"type": "any"},
                messages=[{"role": "user", "content": prompt}]
            )
            for block in msg.content:
                if block.type == "tool_use" and block.name == "output_json":
                    print(f"✅ [{role}] 完了")
                    return block.input
            # textブロックからフォールバック
            for block in msg.content:
                if block.type == "text" and block.text.strip():
                    text = block.text
                    start = text.find("{")
                    end = text.rfind("}") + 1
                    if start != -1 and end > 0:
                        return json.loads(text[start:end])
        except Exception as e:
            print(f"⚠️ [{role}] 試行{attempt}回目失敗: {e}")
            if attempt < 3:
                import time; time.sleep(attempt * 5)
    raise RuntimeError(f"[{role}] 全試行失敗")


def call_ai_long(role: str, prompt: str,
                 model: str = MODEL_HEAVY, use_web: bool = False) -> str:
    """長文テキスト生成用（本文執筆・リライト）"""
    tools = []
    if use_web:
        tools.append({"type": "web_search_20250305", "name": "web_search"})

    for attempt in range(1, 4):
        try:
            print(f"🤖 [{role}] 起動中...（試行{attempt}回目）")
            if tools:
                msg = client.messages.create(
                    model=model,
                    max_tokens=4096,
                    tools=tools,
                    messages=[{"role": "user", "content": prompt}]
                )
            else:
                msg = client.messages.create(
                    model=model,
                    max_tokens=4096,
                    messages=[{"role": "user", "content": prompt}]
                )
            text = " ".join(
                b.text for b in msg.content if b.type == "text"
            ).strip()
            print(f"✅ [{role}] 完了（{len(text)}文字）")
            return text
        except Exception as e:
            print(f"⚠️ [{role}] 試行{attempt}回目失敗: {e}")
            if attempt < 3:
                import time; time.sleep(attempt * 5)
    raise RuntimeError(f"[{role}] 全試行失敗")


def call_ai_long_safe(role: str, prompt: str,
                      model: str = MODEL_HEAVY,
                      use_web: bool = False) -> str:
    """途中切れチェック付きの長文生成"""
    for attempt in range(1, 3):
        text = call_ai_long(role, prompt, model=model, use_web=use_web)

        stripped = text.strip()
        ends_ok = any([
            "まとめ" in stripped[-200:],
            stripped.endswith("。"),
            stripped.endswith("！"),
            stripped.endswith("？"),
            stripped.endswith("✅"),
            len(stripped) >= 1200
        ])

        if ends_ok:
            return text

        print(f"⚠️ [{role}] 途中切れ検出（{len(stripped)}文字）→ 補完リトライ")
        prompt = f"""以下の記事は途中で切れています。
「## まとめ」セクションを含む続きを書いてください。

【途中までの記事】
{stripped}

続きのみ出力してください。"""
        continuation = call_ai_long(
            f"{role}（補完）", prompt, model=model, use_web=False
        )
        return stripped + "\n\n" + continuation.strip()

    return text


# ========================================
# STEP1: トレンド収集
# ========================================
def fetch_sports_trends(hm) -> dict:
    """3クエリ並行Web検索＋予備検索でNBAトレンドを収集"""
    print("\n━━━ STEP1: トレンド収集 ━━━")

    # 直近10件のタイトルを取得（重複チェック用）
    recent_titles = []
    if CONTENT_DIR.exists():
        files = sorted(CONTENT_DIR.glob("*.md"), reverse=True)[:10]
        for f in files:
            try:
                post = frontmatter.load(str(f))
                if post.get("title"):
                    recent_titles.append({
                        "title": post["title"],
                        "date": post.get("date", "")
                    })
            except Exception:
                pass

    recent_context = "\n".join([
        f"- {t['title']}（{t['date']}）" for t in recent_titles
    ]) if recent_titles else "なし"

    result = call_ai(
        "トレンド収集AI",
        f"""現在は{CURRENT_YEAR}年{CURRENT_MONTH}月です。
NBAおよびバスケットボールの今日の最新トレンドを以下の3つのソースから収集してください：

検索①: "NBA news today {CURRENT_YEAR}"
検索②: "site:reddit.com/r/nba hot today"
検索③: "NBA バスケットボール 最新ニュース 今日"

【直近の公開記事（重複回避に使用）】
{recent_context}

スター選手だけでなく、ロールプレーヤー・契約・トレード・
戦術・チーム動向なども含めて5件抽出してください。
トレンドが3件未満または内容が薄い場合はhasEnoughTrendsをfalseにしてください。""",
        schema={
            "type": "object",
            "properties": {
                "trends": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "topic": {"type": "string"},
                            "whyHot": {"type": "string"},
                            "source": {"type": "string"}
                        },
                        "required": ["topic", "whyHot", "source"]
                    },
                    "minItems": 1
                },
                "hasEnoughTrends": {"type": "boolean"}
            },
            "required": ["trends", "hasEnoughTrends"]
        },
        use_web=True
    )

    trends = result.get("trends", [])
    has_enough = result.get("hasEnoughTrends", True)
    print(f"📊 取得トレンド数: {len(trends)}件 / 十分: {has_enough}")

    # 予備検索
    if not has_enough or len(trends) < 3:
        print("⚠️ トレンド不足 → 予備検索を実行")
        team = random.choice(NBA_TEAMS)
        keyword = random.choice(NBA_KEYWORDS)
        print(f"🔍 予備検索: [{team} + {keyword}]")

        backup = call_ai(
            "予備検索AI",
            f"""現在は{CURRENT_YEAR}年{CURRENT_MONTH}月です。
「{team} {keyword} {CURRENT_YEAR}」で検索して
今日のNBAで話題になっているトピックを3件追加してください。""",
            schema={
                "type": "object",
                "properties": {
                    "trends": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "topic": {"type": "string"},
                                "whyHot": {"type": "string"},
                                "source": {"type": "string"}
                            }
                        }
                    }
                },
                "required": ["trends"]
            },
            use_web=True
        )
        trends.extend(backup.get("trends", []))
        print(f"📊 予備検索後トレンド数: {len(trends)}件")

    return {"trends": trends, "recent_titles": recent_titles}


# ========================================
# STEP2: スコアリング
# ========================================
def score_trends(trends: list, recent_titles: list) -> dict:
    """鮮度40点・話題性35点・重要度25点でスコアリング"""
    print("\n━━━ STEP2: スコアリング・トピック選定 ━━━")

    recent_context = "\n".join([
        f"- {t['title']}（{t['date']}）" for t in recent_titles
    ]) if recent_titles else "なし"

    result = call_ai(
        "スコアリングAI",
        f"""現在は{CURRENT_YEAR}年{CURRENT_MONTH}月（今日: {TODAY}）です。
以下のNBAトレンド候補をスコアリングして最適なトピックを1件選定してください。

【トレンド候補】
{json.dumps(trends, ensure_ascii=False, indent=2)}

【直近の公開記事（重複チェック用）】
{recent_context}

スコアリング基準：
- 鮮度（直近24時間以内か）: 最大40点
- 話題性（複数ソースで言及されているか）: 最大35点
- NBA的重要度（スタッツ・戦術・契約・トレード・PO展望など）: 最大25点
- 重複ペナルティ: 同じ選手・チーム名が直近3日以内にあれば-30点、直近1日以内なら除外（score=0）

各候補のスコアとペナルティを明示し、最高スコアのトピックを選定してください。""",
        schema={
            "type": "object",
            "properties": {
                "candidates": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "topic": {"type": "string"},
                            "score": {"type": "integer"},
                            "penalty": {"type": "string"}
                        },
                        "required": ["topic", "score"]
                    }
                },
                "selected": {
                    "type": "object",
                    "properties": {
                        "topic": {"type": "string"},
                        "whyHot": {"type": "string"},
                        "score": {"type": "integer"}
                    },
                    "required": ["topic", "whyHot", "score"]
                }
            },
            "required": ["candidates", "selected"]
        }
    )

    for c in result.get("candidates", []):
        penalty = f" ({c.get('penalty', '')})" if c.get("penalty") else ""
        print(f"  {c['score']:4d}点: {c['topic'][:40]}{penalty}")

    selected = result["selected"]
    print(f"🎯 選定: 【{selected['topic']}】（{selected['score']}点）")
    return selected


# ========================================
# STEP3: 構成設計
# ========================================
def design_structure(topic: str, why_hot: str) -> dict:
    """記事構成を設計（60点未満なら最大3回再設計）"""
    print("\n━━━ STEP3: 構成設計 ━━━")

    for attempt in range(1, 4):
        result = call_ai(
            f"構成設計AI（{attempt}回目）",
            f"""現在は{CURRENT_YEAR}年{CURRENT_MONTH}月です。
NBAコアファン向け記事の構成を設計してください。

トピック: {topic}
なぜ今日話題か: {why_hot}

設計ルール：
- SEOタイトル（40文字以内・日本語）
- meta description（120文字以内・日本語）
- 「この記事のポイント」3点（各30文字以内）
- 4〜5個の見出し（H2）
- スタッツ・戦術・契約詳細などNBAコアファン向けの深い内容
- まとめセクション必須""",
            schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "points": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 3,
                        "maxItems": 3
                    },
                    "sections": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 4,
                        "maxItems": 5
                    },
                    "summary": {"type": "string"},
                    "category": {"type": "string"},
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 3,
                        "maxItems": 5
                    },
                    "structure_score": {"type": "integer"}
                },
                "required": ["title", "description", "points", "sections",
                             "summary", "category", "tags", "structure_score"]
            }
        )

        score = result.get("structure_score", 70)
        print(f"📐 タイトル: {result.get('title', '')}")
        print(f"📋 セクション数: {len(result.get('sections', []))} / "
              f"構成スコア: {score}点")

        if score >= 60:
            return result
        print(f"⚠️ 構成スコア{score}点 → 再設計（{attempt}/3）")

    return result


# ========================================
# STEP4: 本文執筆
# ========================================
def write_article(topic: str, why_hot: str, structure: dict) -> str:
    """本文執筆（Web検索連動・stats.nba.com参照）"""
    print("\n━━━ STEP4: 本文執筆 ━━━")

    points_md = "\n".join([f"- {p}" for p in structure.get("points", [])])
    sections_md = "\n".join([f"- {s}" for s in structure.get("sections", [])])

    content = call_ai_long_safe(
        "執筆AI",
        f"""現在は{CURRENT_YEAR}年{CURRENT_MONTH}月です。
あなたはNBAコアファン向けバスケットボール専門ライターです。

トピック: {topic}
なぜ今日話題か: {why_hot}
タイトル: {structure.get('title', '')}
カテゴリ: {structure.get('category', '')}

【記事構成】
ポイント3点:
{points_md}

セクション:
{sections_md}

まとめ: {structure.get('summary', '')}

執筆ルール：
- 冒頭に「## この記事のポイント」と箇条書き3点を必ず配置
- 4〜5個のH2見出しで構成
- NBAコアファン向けの深い分析・スタッツ・戦術・契約詳細を積極的に盛り込む
- バスケ用語はカタカナのまま使用（過度な説明不要）
- 末尾に「## まとめ」セクションを配置
- 1500文字以上
- 全て日本語で執筆

重要な制約：
- スタッツを記載する場合は stats.nba.com・ESPN.com/nba・basketball-reference.com を参照すること
- 確認できたスタッツのみ数値として記載する
- 架空・仮想のスタッツや試合結果を生成してはいけない
- 「仮想」「架空」「シナリオ」という表現は一切使わない
- 不確かな情報は「〜とみられる」「〜が予想される」と表現する

markdown形式で本文のみ出力してください。""",
        model=MODEL_HEAVY,
        use_web=True
    )

    print(f"📝 本文生成完了: {len(content)}文字")
    return content


# ========================================
# STEP5: 品質レビュー・リライト
# ========================================
def review_and_refine(topic: str, structure: dict, content: str) -> dict:
    """85点以上になるまで最大3回リライト（ベストスコア管理付き）"""
    print("\n━━━ STEP5: 品質レビュー・リライト ━━━")

    best_content = content
    best_score = 0

    for attempt in range(1, 4):
        result = call_ai(
            "レビューAI",
            f"""以下のNBAコアファン向け記事を評価してください（100点満点）。

タイトル: {structure.get('title', '')}
トピック: {topic}

【本文】
{content[:3000]}

評価基準：
- 情報の正確性・具体性（30点）
- NBAコアファンへの専門性・深さ（30点）
- 読みやすい構成・流れ（20点）
- SEO（タイトル・見出しにキーワード含有）（20点）""",
            schema={
                "type": "object",
                "properties": {
                    "score": {"type": "integer"},
                    "accuracy": {"type": "integer"},
                    "expertise": {"type": "integer"},
                    "structure": {"type": "integer"},
                    "seo": {"type": "integer"},
                    "feedback": {"type": "string"}
                },
                "required": ["score", "accuracy", "expertise",
                             "structure", "seo"]
            },
            model=MODEL_LIGHT
        )

        score = result.get("score", 0)
        print(f"📊 スコア: {score}点（正確性:{result.get('accuracy', 0)} "
              f"専門性:{result.get('expertise', 0)} "
              f"構成:{result.get('structure', 0)} "
              f"SEO:{result.get('seo', 0)}）")

        if score > best_score:
            best_score = score
            best_content = content

        if score >= 85:
            print("✅ 85点以上達成・確定")
            return {"content": best_content, "score": best_score}

        if attempt < 3:
            print(f"🔄 リライト {attempt}回目...")
            content = call_ai_long_safe(
                "執筆AI（リライト）",
                f"""以下の記事を改善してください。

【改善指示】
{result.get('feedback', '専門性と具体性を高めてください')}

【元の記事】
{best_content}

改善ルール：
- NBAコアファン向けの深い分析・スタッツ・戦術を追加
- stats.nba.com・ESPN等で確認できたスタッツのみ数値として記載
- 架空スタッツは絶対に使わない
- 1500文字以上を維持
- ## まとめ セクションを必ず末尾に配置
- markdown形式で本文のみ出力""",
                model=MODEL_HEAVY,
                use_web=True
            )

    print(f"⚠️ 最大リライト回数到達（{best_score}点）")
    return {"content": best_content, "score": best_score}


# ========================================
# STEP6: ファクトチェック
# ========================================
def fact_check(article: str) -> str:
    """FC-1〜FC-3: 事実検証・修正"""
    print("\n━━━ ファクトチェック ━━━")

    # FC-1: 検証すべき事実をリストアップ
    print("\n━━━ FC-1: 事実リスト抽出 ━━━")
    result = call_ai(
        "FC-1 事実リストアップAI",
        f"""以下のNBA・バスケットボール記事から検証が必要な事実を
必ず最低3件以上リストアップしてください。

【記事全文】
{article}

以下は必ず検証対象として抽出してください：
- 選手名・チーム名・コーチ名（実在するか）
- 試合スコア・日付・シリーズ状況
- 具体的なスタッツ（得点・リバウンド・アシスト等）
- 契約金額・年数・移籍情報
- プレーオフの勝敗・順位情報

上記の情報が記事に1件でも含まれていれば必ず抽出してください。
「検証すべき事実なし」は不可です。""",
        schema={
            "type": "object",
            "properties": {
                "facts": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "claim": {"type": "string"},
                            "searchQuery": {"type": "string"}
                        },
                        "required": ["claim", "searchQuery"]
                    },
                    "minItems": 3
                }
            },
            "required": ["facts"]
        },
        model=MODEL_LIGHT
    )

    facts = result.get("facts", [])
    if not facts:
        print("✅ 検証すべき事実なし")
        return article

    print(f"📋 検証対象: {len(facts)}件")

    # FC-2: 1件ずつWeb検索で検証
    print("\n━━━ FC-2: 1件ずつWeb検索で検証 ━━━")
    verified = []

    for i, fact in enumerate(facts):
        print(f"🔍 [{i+1}/{len(facts)}] {fact['claim'][:50]}...")
        result = call_ai(
            f"FC-2 検証AI[{i+1}]",
            f"""現在は{CURRENT_YEAR}年{CURRENT_MONTH}月です。
以下の1つの事実をWeb検索で検証してください。

【検証対象】
{fact['claim']}
検索キーワード: {fact['searchQuery']}

NBA公式・ESPN・Basketball Reference・The Athleticなどを参照して検証してください。""",
            schema={
                "type": "object",
                "properties": {
                    "claim": {"type": "string"},
                    "status": {
                        "type": "string",
                        "enum": ["confirmed", "false", "unverifiable"]
                    },
                    "correction": {"type": "string"},
                    "action": {
                        "type": "string",
                        "enum": ["keep", "fix", "soften"]
                    },
                    "confidence": {"type": "integer"}
                },
                "required": ["claim", "status", "action"]
            },
            use_web=True,
            model=MODEL_LIGHT
        )

        action = result.get("action", "soften")
        icon = "✅" if action == "keep" else "❌" if action == "fix" else "⚠️"
        confidence = result.get("confidence", 0)
        print(f"  {icon} {result.get('status', '')} "
              f"(信頼度{confidence}%) {fact['claim'][:40]}")
        verified.append(result)

    issues = [r for r in verified if r.get("action") != "keep"]
    print(f"\n📊 FC-2 結果: 問題{len(issues)}件 / 全{len(verified)}件")

    if not issues:
        print("✅ 事実確認済み — 修正不要")
        return article

    # FC-3: 外科的修正
    print("\n━━━ FC-3: 外科的修正 ━━━")
    fix_instructions = "\n".join([
        f"・対象: {i['claim']}\n"
        f"  問題: {'誤り → 正しくは: ' + i.get('correction', '不明') if i['status'] == 'false' else '確認不可'}\n"
        f"  対処: {'正しい情報に修正' if i['action'] == 'fix' else '「〜とされています」に変更'}"
        for i in issues
    ])

    fixed = call_ai_long(
        "FC-3 修正AI",
        f"""以下の記事の事実誤りを修正してください。

【元の記事】
{article}

【修正指示】
{fix_instructions}

ルール：
- 指摘箇所のみ最小限修正する
- 他の箇所は変更しない
- 記事冒頭に修正内容の説明・注記・免責事項を追加しない
- です・ます調を維持する
- バスケ用語はカタカナのまま維持する
- 修正後の記事全文のみ出力""",
        model=MODEL_HEAVY
    )

    if fixed and len(fixed) > len(article) * 0.7:
        print(f"✅ FC-3 修正完了: {len(fixed)}文字")
        return fixed
    return article


# ========================================
# 記事保存
# ========================================
def save_article(structure: dict, content: str, score: int) -> str:
    """記事をmarkdownで保存"""
    CONTENT_DIR.mkdir(exist_ok=True)

    article_id = str(random.randint(1000, 9999))
    filename = f"{TODAY}-{article_id}.md"
    filepath = CONTENT_DIR / filename

    if filepath.exists():
        print(f"⚠️ 既に存在: {filename} — スキップ")
        return None

    tags_yaml = json.dumps(structure.get("tags", []), ensure_ascii=False)

    md = f"""---
title: "{yaml_escape(structure.get('title', ''))}"
description: "{yaml_escape(structure.get('description', ''))}"
category: "{yaml_escape(structure.get('category', ''))}"
tags: {tags_yaml}
date: "{TODAY}"
site: "sports"
qualityScore: {score}
---

{content}
"""

    filepath.write_text(md, encoding="utf-8")
    print(f"✅ 保存: {filename}")
    return filename


# ========================================
# note生成
# ========================================
def generate_note(article_path: str) -> dict:
    """サイト記事をベースに無料note原稿を生成（サイト誘導型）"""
    print("\n━━━ note生成パイプライン ━━━")

    CONTENT_NOTE_DIR.mkdir(exist_ok=True)

    post = frontmatter.load(article_path)
    free_article = {
        "title": post.get("title", ""),
        "description": post.get("description", ""),
        "category": post.get("category", ""),
        "content": post.content,
        "slug": Path(article_path).stem
    }
    print(f"📖 ベース記事: {free_article['title']}")

    # ① メタ情報生成
    print("📋 ① メタ情報を生成中...")
    meta = call_ai(
        "note メタAI",
        f"""現在は{CURRENT_YEAR}年{CURRENT_MONTH}月です。
以下のNBA・バスケットボール記事をベースにnote無料記事のメタ情報を生成してください。

タイトル: {free_article['title']}
カテゴリ: {free_article['category']}
概要: {free_article['description']}

ルール：
- NBAコアファン・バスケ好きに刺さるタイトルにする
- summaryはバスケファンの興味・共感から入る
- 無料記事として公開することを前提にする
- priceは必ず0にする
- tagsはNBA・バスケ関連のキーワードにする""",
        schema={
            "type": "object",
            "properties": {
                "noteTitle": {"type": "string"},
                "summary": {"type": "string"},
                "price": {"type": "integer"},
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 3,
                    "maxItems": 5
                }
            },
            "required": ["noteTitle", "summary", "price", "tags"]
        },
        model=MODEL_LIGHT
    )
    print(f"📌 noteタイトル: {meta.get('noteTitle', '')}")

    # ② 構成設計
    print("📐 ② 構成を設計中...")
    structure = call_ai(
        "note 構成AI",
        f"""現在は{CURRENT_YEAR}年{CURRENT_MONTH}月です。
以下のNBA記事の深掘り版となるnote無料記事の構成を設計してください。

タイトル: {free_article['title']}
概要: {free_article['description']}

設計ルール：
- NBAコアファン向けの深い分析・考察を盛り込む
- スタッツ・戦術・契約・トレードなどの専門的視点を取り入れる
- 無料記事の続き・深掘りとして自然につながる構成
- 末尾にbasketball.trend-insightlab.comへの誘導を配置""",
        schema={
            "type": "object",
            "properties": {
                "sections": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "role": {"type": "string"},
                            "keyPoints": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 2,
                                "maxItems": 3
                            },
                            "transitionFrom": {"type": "string"}
                        },
                        "required": ["title", "role", "keyPoints"]
                    },
                    "minItems": 3,
                    "maxItems": 4
                }
            },
            "required": ["sections"]
        },
        model=MODEL_LIGHT
    )
    sections = structure.get("sections", [])
    sections = [s for s in sections if isinstance(s, dict) and s.get("title")][:4]
    print(f"📐 セクション数: {len(sections)}")

    # ③ 順次生成
    print("✍️  ③ 順次生成中...")
    note_sections = []
    previous = ""

    for i, section in enumerate(sections):
        print(f"   セクション{i+1}/{len(sections)}: {section.get('title', '')}")
        text = call_ai_long_safe(
            f"note 執筆AI[{i+1}]",
            f"""現在は{CURRENT_YEAR}年{CURRENT_MONTH}月です。
NBAコアファン向けnote無料記事のセクションを執筆してください。

【記事テーマ】{free_article['title']}

【前のセクションまでの内容】
{previous or "（最初のセクションです）"}

【今回のセクション】
タイトル: {section.get('title', '')}
役割: {section.get('role', '')}
前セクションからの接続: {section.get('transitionFrom', '記事の冒頭として自然に始める')}
書くべきポイント:
{chr(10).join(['- ' + p for p in section.get('keyPoints', [])])}

執筆ルール：
- NBAコアファン向けの深い分析・考察を書く
- バスケ用語はカタカナのまま使用
- です・ます調
- 600〜800文字
- {section.get('title', '')} の見出しから始める
- 最終セクションの末尾に必ず以下を追加：
  「より詳しい分析・最新情報はこちら → https://basketball.trend-insightlab.com」
- 本文のみ出力""",
            model=MODEL_HEAVY
        )
        note_sections.append(text.strip())
        previous += f"\n\n{text.strip()}"

    note_content = "\n\n".join(note_sections)
    print(f"📝 生成完了: {len(note_content)}文字")

    # ④ 一貫性レビュー
    print("🔍 ④ 一貫性レビュー中...")
    review = call_ai(
        "note レビューAI",
        f"""あなたはNBAメディアの編集者です。
以下のnote記事の一貫性の問題を指摘してください。

【記事テーマ】{free_article['title']}
【本文全文】{note_content}

チェック項目：セクション間の接続・重複・突然の話題転換・結論と冒頭の対応""",
        schema={
            "type": "object",
            "properties": {
                "score": {"type": "integer"},
                "hasIssues": {"type": "boolean"},
                "issues": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "location": {"type": "string"},
                            "problem": {"type": "string"},
                            "fix": {"type": "string"}
                        }
                    }
                }
            },
            "required": ["score", "hasIssues", "issues"]
        },
        model=MODEL_LIGHT
    )
    print(f"🔍 一貫性スコア: {review.get('score', 0)}点 / "
          f"問題: {len(review.get('issues', []))}件")

    # ⑤ 修正（最大2回・2件バッチ）
    for fix_round in range(2):
        issues = review.get("issues", [])
        if not review.get("hasIssues") or not issues:
            break

        batch = issues[:2]
        print(f"🔄 ⑤ 外科的修正中（{len(batch)}件バッチ）...")

        fix_instructions = "\n".join([
            f"・場所: {i.get('location', '不明')}\n"
            f"  問題: {i.get('problem', i.get('issue', '内容不明'))}\n"
            f"  修正方法: {i.get('fix', i.get('solution', '改善してください'))}"
            for i in batch
        ])

        fixed = call_ai_long_safe(
            "note 修正AI",
            f"""以下のnote記事の特定箇所のみを修正してください。

【修正対象】
{fix_instructions}

【記事全文】
{note_content}

ルール：指摘箇所のみ最小限修正・他は変更しない・です・ます調維持・修正後の全文のみ出力""",
            model=MODEL_HEAVY
        )

        if fixed and len(fixed) > len(note_content) * 0.8:
            note_content = fixed

        review = call_ai(
            "note 再レビューAI",
            f"""以下のnote記事の一貫性を再チェックしてください。
【本文】{note_content[:2000]}""",
            schema={
                "type": "object",
                "properties": {
                    "score": {"type": "integer"},
                    "hasIssues": {"type": "boolean"},
                    "issues": {"type": "array", "items": {"type": "object"}}
                },
                "required": ["score", "hasIssues", "issues"]
            },
            model=MODEL_LIGHT
        )
        print(f"🔄 修正後スコア: {review.get('score', 0)}点")

    # ⑥ 品質スコアリング
    print("📊 ⑥ 品質スコアリング中...")
    quality = call_ai(
        "note 品質AI",
        f"""以下のnote無料記事を評価してください（100点満点）。

タイトル: {meta.get('noteTitle', '')}
冒頭: {meta.get('summary', '')}
本文: {note_content[:2000]}

評価基準：
1. 集客力・タイトルの魅力（30点）: NBAファンがクリックしたくなるか
2. 一貫性・文脈の流れ（25点）: セクション間が自然につながっているか
3. サイト誘導効果（25点）: 読後にbasketball.trend-insightlab.comを訪問したくなるか
4. 文章品質（20点）: 読みやすい自然な日本語か""",
        schema={
            "type": "object",
            "properties": {
                "score": {"type": "integer"},
                "approved": {"type": "boolean"},
                "feedback": {"type": "string"}
            },
            "required": ["score", "approved", "feedback"]
        },
        model=MODEL_LIGHT
    )

    note_score = quality.get("score", 0)
    print(f"📊 品質スコア: {note_score}点 / 承認: {quality.get('approved', False)}")
    print(f"💬 総評: {quality.get('feedback', '')}")

    # 保存
    clean_slug = Path(article_path).stem.replace(f"{TODAY}-", "")
    note_filename = f"{TODAY}-{clean_slug}-note.md"
    note_filepath = CONTENT_NOTE_DIR / note_filename

    if note_filepath.exists():
        print(f"⚠️ 既に存在: {note_filename} — スキップ")
        return {"score": note_score, "filename": note_filename}

    note_md = f"""---
title: "{yaml_escape(meta.get('noteTitle', ''))}"
price: 0
tags: {json.dumps(meta.get('tags', []), ensure_ascii=False)}
date: "{TODAY}"
status: "draft"
qualityScore: {note_score}
noteUrl: ""
---

{meta.get('summary', '')}

{note_content}

---

🏀 **NBA・バスケ最新情報はこちら**
より詳しい分析・速報記事を毎日更新中です。
👉 https://basketball.trend-insightlab.com
"""

    note_filepath.write_text(note_md, encoding="utf-8")
    print(f"✅ note保存: content-note/{note_filename}")
    return {"score": note_score, "filename": note_filename}


# ========================================
# Git push
# ========================================
def git_push(title: str, score: int):
    """記事をGitHubにプッシュ"""
    try:
        subprocess.run(
            ["git", "config", "user.name", "github-actions[bot]"],
            check=True
        )
        subprocess.run(
            ["git", "config", "user.email",
             "github-actions[bot]@users.noreply.github.com"],
            check=True
        )
        subprocess.run(["git", "add", "content/", "content-note/",
                        "history/"], check=True)

        diff = subprocess.run(["git", "diff", "--staged", "--quiet"])
        if diff.returncode == 0:
            print("⚠️ コミットする変更なし")
            return

        commit_msg = f"auto: {title[:40]}（品質スコア{score}点）"
        subprocess.run(["git", "commit", "-m", commit_msg], check=True)
        subprocess.run(["git", "pull", "--rebase"], check=True)
        subprocess.run(["git", "push"], check=True)
        print("✅ GitHubにプッシュ完了")
    except subprocess.CalledProcessError as e:
        print(f"⚠️ git操作失敗: {e}")


# ========================================
# メイン
# ========================================
def main():
    print("=" * 60)
    print(f"🏀 NBA記事自動生成（Python版） "
          f"{datetime.now().strftime('%Y/%m/%d %H:%M:%S')}")
    print("=" * 60)

    from history_manager import HistoryManager
    hm = HistoryManager()

    # STEP1: トレンド収集
    trend_result = fetch_sports_trends(hm)
    trends = trend_result["trends"]
    recent_titles = trend_result["recent_titles"]

    # STEP2: スコアリング
    selected = score_trends(trends, recent_titles)
    topic = selected["topic"]
    why_hot = selected["whyHot"]

    # 重複チェック
    if hm.is_duplicate_theme(topic):
        print(f"⚠️ 重複テーマ検出: {topic}")

    # STEP3: 構成設計
    structure = design_structure(topic, why_hot)

    # STEP4: 本文執筆
    content = write_article(topic, why_hot, structure)

    # STEP5: 品質レビュー・リライト
    refined = review_and_refine(topic, structure, content)

    # STEP6: ファクトチェック
    checked_content = fact_check(refined["content"])

    # 保存
    print("\n━━━ 💾 保存処理 ━━━")
    filename = save_article(
        structure, checked_content, refined["score"]
    )

    if filename:
        # SQLite履歴に記録
        hm.save_theme(
            topic,
            structure.get("title", ""),
            refined["score"]
        )
        hm.save_scores(
            filename,
            refined["score"],
            0,  # note_score（後で更新）
            structure.get("structure_score", 0)
        )

        # note生成
        article_path = str(CONTENT_DIR / filename)
        note_result = generate_note(article_path)

        # note_scoreを更新
        if note_result:
            hm.save_scores(
                filename,
                refined["score"],
                note_result.get("score", 0),
                structure.get("structure_score", 0)
            )

        # Git push
        git_push(structure.get("title", topic), refined["score"])

    print("\n" + "=" * 60)
    print("📊 生成レポート")
    print("=" * 60)
    print(f"タイトル  : {structure.get('title', '')}")
    print(f"トピック  : {topic}")
    print(f"スコア    : {refined['score']}点")
    print(f"ファイル  : {filename}")
    print("=" * 60)
    print("\n🎉 完了！")


if __name__ == "__main__":
    main()
