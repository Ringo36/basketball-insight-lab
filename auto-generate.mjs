import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TODAY = new Date().toISOString().split("T")[0];
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const SITE_DIR = process.cwd();
const MODEL = "claude-sonnet-4-6";

const NBA_TEAMS = [
  "Boston Celtics", "New York Knicks", "Philadelphia 76ers",
  "Brooklyn Nets", "Toronto Raptors", "Cleveland Cavaliers",
  "Chicago Bulls", "Milwaukee Bucks", "Indiana Pacers",
  "Detroit Pistons", "Miami Heat", "Orlando Magic",
  "Atlanta Hawks", "Charlotte Hornets", "Washington Wizards",
  "Oklahoma City Thunder", "Denver Nuggets", "Minnesota Timberwolves",
  "Golden State Warriors", "Los Angeles Lakers", "Los Angeles Clippers",
  "Phoenix Suns", "Sacramento Kings", "Portland Trail Blazers",
  "Utah Jazz", "Dallas Mavericks", "Memphis Grizzlies",
  "New Orleans Pelicans", "Houston Rockets", "San Antonio Spurs",
];

const NBA_KEYWORDS = [
  "contract extension", "trade rumor", "playoff",
  "rookie", "role player", "stats leader",
  "injury update", "draft", "G League call-up",
  "coaching strategy", "salary cap", "free agency",
];

// NBAシーズンカレンダー（月で判定）
// 10月〜6月：シーズン中（レギュラー＋プレーオフ）
// 7月〜9月：オフシーズン
const IS_OFFSEASON = CURRENT_MONTH >= 7 && CURRENT_MONTH <= 9;

const OFFSEASON_QUERIES = [
  "NBA free agency news today",
  "NBA trade rumors today",
  "NBA draft 2026 news",
  "NBA summer league news",
  "NBA contract extension news",
];

const INSEASON_QUERIES = [
  "NBA news today 2026",
  "site:reddit.com/r/nba hot today",
  "NBA バスケットボール 最新ニュース 今日",
];

// ========================================
// 共通ヘルパー
// ========================================
async function callAI(role, prompt, useWebSearch = false, retries = 2) {
  const tools = useWebSearch
    ? [{ type: "web_search_20250305", name: "web_search" }]
    : undefined;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      console.log(`🤖 [${role}] 起動中...（試行${attempt}回目）`);
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        tools,
        messages: [{ role: "user", content: prompt }],
      });
      const text = msg.content.find(b => b.type === "text")?.text ?? "";
      console.log(`✅ [${role}] 完了`);
      return text;
    } catch (e) {
      console.log(`⚠️ [${role}] 試行${attempt}回目失敗: ${e.message}`);
      if (attempt > retries) throw e;
      const wait = attempt * 5000;
      console.log(`⏳ ${wait / 1000}秒後にリトライ...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

async function callAILong(role, prompt, useWebSearch = false) {
  const tools = useWebSearch
    ? [{ type: "web_search_20250305", name: "web_search" }]
    : undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`🤖 [${role}] 起動中...（試行${attempt}回目）`);
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        tools,
        messages: [{ role: "user", content: prompt }],
      });
      const text = msg.content.find(b => b.type === "text")?.text ?? "";
      console.log(`✅ [${role}] 完了（${text.length}文字）`);
      return text;
    } catch (e) {
      console.log(`⚠️ [${role}] 試行${attempt}回目失敗: ${e.message}`);
      if (attempt >= 3) throw e;
      const wait = attempt * 5000;
      console.log(`⏳ ${wait / 1000}秒後にリトライ...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

function extractJSON(text) {
  // コードブロックがあればその中身を取得
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let cleaned = codeBlock ? codeBlock[1].trim() : text.trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}") + 1;
  if (start === -1 || end === 0) {
    throw new Error("JSONが見つかりません: " + cleaned.slice(0, 200));
  }

  const jsonStr = cleaned.slice(start, end);

  try {
    return JSON.parse(jsonStr);
  } catch {
    const fixed = jsonStr
      .replace(/[\x00-\x1F\x7F]/g, " ")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    try {
      return JSON.parse(fixed);
    } catch (e2) {
      console.log("⚠️ JSON修復失敗。先頭300文字:", jsonStr.slice(0, 300));
      throw new Error(`JSON解析失敗: ${e2.message}`);
    }
  }
}

// ========================================
// 直近記事タイトル取得（重複チェック用）
// ========================================
function getRecentArticleTitles(limit = 10) {
  const contentDir = path.join(SITE_DIR, "content");
  if (!fs.existsSync(contentDir)) return [];
  return fs.readdirSync(contentDir)
    .filter(f => f.endsWith(".md"))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit)
    .map(f => {
      try {
        const raw = fs.readFileSync(path.join(contentDir, f), "utf8");
        const { data } = matter(raw);
        return { filename: f, title: data.title ?? "", date: data.date ?? "" };
      } catch {
        return { filename: f, title: "", date: "" };
      }
    });
}

// ========================================
// STEP0: Balldontlie APIでリアルスタッツ取得
// ========================================
async function fetchRealStats() {
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey) {
    console.log("⚠️ BALLDONTLIE_API_KEY未設定 - スタッツ取得をスキップ");
    return null;
  }

  if (IS_OFFSEASON) {
    console.log("📅 オフシーズン中 - スタッツ取得をスキップ");
    return null;
  }

  try {
    console.log("📊 Balldontlie APIでリアルスタッツを取得中...");

    // 直近の試合結果を取得（プレーオフ含む）
    const gamesRes = await fetch(
      "https://api.balldontlie.io/v1/games?per_page=10&seasons[]=2025",
      { headers: { "Authorization": apiKey } }
    );
    const gamesData = await gamesRes.json();
    const recentGames = gamesData.data ?? [];

    // 直近試合のスタッツを取得
    const statsRes = await fetch(
      "https://api.balldontlie.io/v1/stats?per_page=20&seasons[]=2025",
      { headers: { "Authorization": apiKey } }
    );
    const statsData = await statsRes.json();
    const recentStats = statsData.data ?? [];

    const summary = {
      isOffseason: false,
      recentGames: recentGames.slice(0, 5).map(g => ({
        date: g.date,
        homeTeam: g.home_team?.full_name,
        homeScore: g.home_team_score,
        visitorTeam: g.visitor_team?.full_name,
        visitorScore: g.visitor_team_score,
        status: g.status,
      })),
      topPerformers: recentStats
        .filter(s => s.pts >= 20)
        .slice(0, 5)
        .map(s => ({
          player: `${s.player?.first_name} ${s.player?.last_name}`,
          team: s.team?.full_name,
          pts: s.pts,
          reb: s.reb,
          ast: s.ast,
          date: s.game?.date,
        })),
    };

    console.log(`✅ 直近試合: ${summary.recentGames.length}件`);
    console.log(`✅ 20得点以上: ${summary.topPerformers.length}件`);

    if (summary.recentGames.length === 0) {
      console.log("⚠️ 試合データなし - オフシーズン扱いに切り替え");
      return { isOffseason: true };
    }

    return summary;
  } catch (e) {
    console.log(`⚠️ Balldontlie API取得失敗: ${e.message} - スキップして続行`);
    return null;
  }
}

// ========================================
// STEP1+2: トレンド収集・スコアリング
// ========================================
async function fetchSportsTrends(realStats = null) {
  console.log("\n━━━ STEP1: トレンド収集 ━━━");

  const isOffseason = IS_OFFSEASON || realStats?.isOffseason === true;
  const searchQueries = isOffseason ? OFFSEASON_QUERIES : INSEASON_QUERIES;

  if (isOffseason) {
    console.log("📅 オフシーズンモード: 移籍・ドラフト・FA情報を収集");
  } else {
    console.log("🏀 シーズンモード: 試合結果・スタッツ情報を収集");
  }

  // 3つのクエリで並行Web検索
  const [news1, news2, news3] = await Promise.all([
    callAI(
      "検索①",
      `Search for "${searchQueries[0]}" and summarize the top NBA stories you find. Return the key headlines and details.`,
      true
    ),
    callAI(
      "検索②",
      `Search for "${searchQueries[1]}" and summarize the results. Return the main topics and stories found.`,
      true
    ),
    callAI(
      "検索③",
      `Search for "${searchQueries[2]}" and summarize the results. Return the key NBA news and topics found.`,
      true
    ),
  ]);

  // スタッツコンテキスト生成
  const statsContext = (realStats && !realStats.isOffseason)
    ? `
【直近の実際の試合結果】
${realStats.recentGames.map(g =>
  `${g.date}: ${g.homeTeam} ${g.homeScore} - ${g.visitorScore} ${g.visitorTeam}`
).join("\n")}

【直近の20得点以上パフォーマンス】
${realStats.topPerformers.map(p =>
  `${p.player}（${p.team}）: ${p.pts}得点 ${p.reb}リバウンド ${p.ast}アシスト（${p.date}）`
).join("\n")}

上記の実際のデータを優先的にトレンド分析に使用してください。
`
    : isOffseason
    ? `
【オフシーズン中】
試合データはありません。以下に注目してトレンドを抽出してください：
- フリーエージェント・移籍情報
- ドラフト関連ニュース
- 契約延長・サイン情報
- トレード噂・交渉情報
- サマーリーグ情報
- 来シーズン展望・補強ポイント
`
    : "";

  // 3つの検索結果からトレンドを抽出
  const extractPrompt = `上記の検索結果から今日のNBAで最も話題になっているトピックを5つ抽出してください。スター選手だけでなく、ロールプレーヤー・契約・トレード・戦術・チーム動向なども含めてください。

以下が3つのWeb検索結果です：

【検索①: ${searchQueries[0]}】
${news1}

【検索②: ${searchQueries[1]}】
${news2}

【検索③: ${searchQueries[2]}】
${news3}
${statsContext}
以下のJSON形式のみで返してください：
{
  "trends": [
    {
      "topic": "トピック名",
      "whyHot": "なぜ今日話題なのか",
      "source": "reddit or ESPN or 日本語メディア"
    }
  ],
  "hasEnoughTrends": true
}
トレンドが3件未満または内容が薄い場合は hasEnoughTrends を false にしてください。`;

  const extractText = await callAI("トレンド抽出", extractPrompt);
  let trendsData = extractJSON(extractText);

  console.log(`📊 取得トレンド数: ${trendsData.trends?.length ?? 0}件 / 十分: ${trendsData.hasEnoughTrends}`);

  // 予備検索（トレンドが不十分な場合）
  if (!trendsData.hasEnoughTrends || (trendsData.trends?.length ?? 0) < 3) {
    console.log("⚠️ トレンド不足 → 予備検索を実行");

    const team1 = NBA_TEAMS[Math.floor(Math.random() * NBA_TEAMS.length)];
    const team2 = NBA_TEAMS[Math.floor(Math.random() * NBA_TEAMS.length)];
    const kw1 = NBA_KEYWORDS[Math.floor(Math.random() * NBA_KEYWORDS.length)];
    const kw2 = NBA_KEYWORDS[Math.floor(Math.random() * NBA_KEYWORDS.length)];

    console.log(`🔍 予備検索: [${team1} + ${kw1}] / [${team2} + ${kw2}]`);

    const [backup1, backup2] = await Promise.all([
      callAI(
        "予備検索①",
        `Search for "${team1} NBA ${kw1} ${CURRENT_YEAR}" and summarize what you find.`,
        true
      ),
      callAI(
        "予備検索②",
        `Search for "${team2} NBA ${kw2} ${CURRENT_YEAR}" and summarize what you find.`,
        true
      ),
    ]);

    const backupPrompt = `以下の追加検索結果から新しいトピックを抽出し、既存のトレンドリストと合わせて整理してください。

【既存のトレンド】
${JSON.stringify(trendsData.trends ?? [], null, 2)}

【追加検索①: ${team1} NBA ${kw1} ${CURRENT_YEAR}】
${backup1}

【追加検索②: ${team2} NBA ${kw2} ${CURRENT_YEAR}】
${backup2}

合計5件を目標に、以下のJSON形式のみで返してください：
{
  "trends": [
    {
      "topic": "トピック名",
      "whyHot": "なぜ今日話題なのか",
      "source": "reddit or ESPN or 日本語メディア"
    }
  ],
  "hasEnoughTrends": true
}`;

    const backupText = await callAI("予備トレンド抽出", backupPrompt);
    trendsData = extractJSON(backupText);
    console.log(`📊 予備検索後トレンド数: ${trendsData.trends?.length ?? 0}件`);
  }

  // STEP2: スコアリング・トピック選定
  console.log("\n━━━ STEP2: スコアリング・トピック選定 ━━━");

  const recentArticles = getRecentArticleTitles(10);
  const recentTitlesText = recentArticles.length > 0
    ? recentArticles.map(a => `- ${a.date}: ${a.title}`).join("\n")
    : "（なし）";

  const scoringPrompt = `以下のトレンド候補をスコアリングして上位1件を選定してください。

【トレンド候補】
${JSON.stringify(trendsData.trends ?? [], null, 2)}

【直近10件の公開済み記事（重複チェック用）】
${recentTitlesText}

スコアリング基準：
- 鮮度（直近24時間以内か）: 最大40点
- 話題性（複数ソースで言及されているか）: 最大35点
- NBA的重要度（スタッツ・戦術・契約・トレード・PO展望など）: 最大25点

重複ペナルティ：
- 同じ選手・チーム名が直近3日以内の記事にあれば-30点
- 直近1日以内にあれば候補から除外（score: 0にして選ばない）

除外するテーマ：ギャンブル・賭博・暴力・私生活スキャンダル

以下のJSONのみ出力（説明不要。必ず{から始める）：
{"candidates":[{"topic":"トピック名","whyHot":"理由（1文）","score":85,"penalty":"ペナルティ理由（なければ空文字）"},{"topic":"トピック2","whyHot":"理由","score":75,"penalty":""}],"selected":{"topic":"最高スコアのトピック名","whyHot":"注目理由（2文）","score":85}}`;

  const scoringText = await callAI("スコアリングAI", scoringPrompt);
  const scoring = extractJSON(scoringText);

  console.log("📊 候補スコア:");
  (scoring.candidates ?? []).forEach(c =>
    console.log(`   ${String(c.score).padStart(3)}点: ${c.topic}${c.penalty ? ` (${c.penalty})` : ""}`)
  );
  console.log(`🎯 選定: 【${scoring.selected.topic}】（${scoring.selected.score}点）`);

  return scoring.selected;
}

// ========================================
// STEP3: 構成設計
// ========================================
async function designArticleStructure(topic, whyHot) {
  console.log("\n━━━ STEP3: 構成設計 ━━━");

  const prompt = `現在は${CURRENT_YEAR}年${CURRENT_MONTH}月です。
あなたはNBAコアファン向けバスケットボール専門メディアの編集長です。
以下のトピックで記事構成を設計してください。

トピック: ${topic}
注目理由: ${whyHot}

ターゲット：NBAコアファン。専門用語・スタッツ・戦術分析を積極的に使用。過度な説明不要。
記事はすべて日本語で執筆します。

以下のJSON形式のみで返してください：
{
  "title": "SEOタイトル（40文字以内・日本語・トピックのキーワードを含む）",
  "description": "meta description（120文字以内・日本語・キーワードを自然に含む）",
  "sections": ["## 見出し1（キーワード含む）", "## 見出し2", "## 見出し3", "## 見出し4"],
  "points": ["冒頭ポイント1（30文字以内）", "冒頭ポイント2（30文字以内）", "冒頭ポイント3（30文字以内）"],
  "summary": "まとめセクションの方向性（1文）",
  "category": "カテゴリ（NBA／Bリーグ／日本人選手／分析・コラム のいずれか）",
  "tags": ["タグ1", "タグ2", "タグ3"]
}
注意：sectionsは4〜5個の文字列配列。`;

  const text = await callAI("構成設計AI", prompt);
  const structure = extractJSON(text);
  console.log(`📐 タイトル: ${structure.title}`);
  console.log(`📋 セクション数: ${structure.sections?.length ?? 0}`);
  return structure;
}

// ========================================
// STEP4: 本文執筆
// ========================================
async function writeArticle(topic, whyHot, structure) {
  console.log("\n━━━ STEP4: 本文執筆 ━━━");

  const prompt = `現在は${CURRENT_YEAR}年${CURRENT_MONTH}月です。
あなたはNBAコアファン向けバスケットボール専門ライターです。
以下の構成に沿って、NBAコアファンが満足する専門的な記事を日本語で執筆してください。

【トピック】${topic}
【注目理由】${whyHot}
【記事タイトル】${structure.title}

【冒頭に配置するポイント（箇条書き3点）】
${structure.points.map(p => `- ${p}`).join("\n")}

【セクション構成】
${structure.sections.join("\n")}

【まとめの方向性】${structure.summary}

執筆ルール：
- 記事はすべて日本語で執筆
- Markdown形式
- 1500文字以上
- です・ます調
- 冒頭に「## この記事のポイント」として上記3点を箇条書きで配置
- 上記セクション見出し（H2）に沿って本文を展開
- 末尾に「## まとめ」セクションを追加（上記まとめ方向性に沿って）
- PER・TS%・USG%・WS・BPM・ORtg・DRtgなどのアドバンスドスタッツを積極的に活用
- トレード・サラリーキャップ・バードライツ・ドラフト・PO展望などNBA固有の文脈を盛り込む
- バスケ用語はカタカナのまま（ファイブアウト・P&R・アイソレーション・スモールボール等）
- 具体的な数字・選手名・チーム名を積極的に記述
- AIが書いたとわからない自然な文体

重要な制約：
- 架空・仮想のスタッツや試合結果を生成してはいけない
- Balldontlie APIから取得した実際のスタッツのみ数値として記載する
- 具体的なスタッツが不明な場合は数値を書かず「好調を維持している」「高い効率を誇る」などの表現を使う
- 「仮想」「架空」「シナリオ」という表現は一切使わない
- 不確かな情報は「〜とみられる」「〜が予想される」と表現する
- Web検索で取得した実際の情報のみを使用する
- オフシーズン中は移籍・ドラフト・FA情報を中心に執筆する

本文のみ出力（JSONやfrontmatter不要）:`;

  const content = await callAILong("執筆AI", prompt, true);
  console.log(`📝 本文生成完了: ${content.length}文字`);
  return content;
}

// ========================================
// STEP5: 品質レビュー・リライト
// ========================================
async function reviewAndRefineArticle(topic, structure, content) {
  console.log("\n━━━ STEP5: 品質レビュー・リライト ━━━");

  let current = content;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const reviewPrompt = `あなたはNBAコアファン向け専門メディアの編集長です。
以下の記事を100点満点で評価してください。

【記事本文】
${current}

評価基準（必ず個別採点してから合計）：
1. 情報の正確性・具体性（30点）：選手名・スタッツ・試合結果・契約額が具体的か
2. NBAコアファンへの専門性・深さ（30点）：戦術・アドバンスドスタッツ・NBA固有の文脈があるか
3. 読みやすい構成・流れ（20点）：冒頭ポイント・見出し・まとめが整っているか
4. SEO（20点）：タイトルと見出しにキーワードが含まれているか

以下のJSONのみ出力：
{"score":85,"approved":true,"breakdown":{"accuracy":25,"expertise":28,"structure":18,"seo":16},"improvements":[{"point":"改善点","reason":"理由","howTo":"具体的な修正方法"}]}`;

    const reviewText = await callAI("レビューAI", reviewPrompt);
    const review = extractJSON(reviewText);
    const bd = review.breakdown ?? {};
    console.log(
      `📊 スコア: ${review.score}点` +
      `（正確性:${bd.accuracy ?? "-"} 専門性:${bd.expertise ?? "-"}` +
      ` 構成:${bd.structure ?? "-"} SEO:${bd.seo ?? "-"}）`
    );

    if (review.score >= 85) {
      console.log("✅ 85点以上達成・確定");
      return { content: current, score: review.score };
    }

    if (attempt >= maxAttempts) {
      console.log(`⚠️ 最大リライト回数到達（${review.score}点）`);
      return { content: current, score: review.score };
    }

    console.log(`🔄 リライト ${attempt}回目...`);
    const improvements = Array.isArray(review.improvements)
      ? review.improvements
          .map(imp =>
            typeof imp === "object"
              ? `・${imp.point}\n  理由: ${imp.reason}\n  対処: ${imp.howTo}`
              : `・${imp}`
          )
          .join("\n")
      : String(review.improvements);

    const rewritePrompt = `あなたはNBAコアファン向けバスケットボール専門ライターです。
以下の記事を85点レベルに改善してください。すべて日本語で執筆してください。

【現在の記事】
${current}

【改善が必要な点】
${improvements}

【改善指針】
1. アドバンスドスタッツ（PER・TS%・USG%・WS・BPM・ORtg・DRtg等）を具体的な数値で追加する
2. 戦術的な分析（オフェンシブレーティング・P&R守備・スペーシング・ゾーン対策等）を深める
3. NBA固有の文脈（サラリーキャップ・バードライツ・トレードデッドライン・PO展望）を強化する
4. 見出しにキーワードを含める
5. 冒頭ポイントとまとめを整合させる

【ルール】
- すべて日本語で執筆
- です・ます調を維持
- 1500文字以上を維持
- 改善された本文のみ出力（前置き不要）`;

    current = await callAILong("執筆AI（リライト）", rewritePrompt);
    console.log(`📝 リライト完了: ${current.length}文字`);
  }

  return { content: current, score: 70 };
}

// ========================================
// ファイル保存
// ========================================
function saveArticle(structure, content, score) {
  const contentDir = path.join(SITE_DIR, "content");
  if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });

  const id = Math.floor(1000 + Math.random() * 9000).toString();
  const filename = `${TODAY}-${id}.md`;
  const filepath = path.join(contentDir, filename);

  if (fs.existsSync(filepath)) {
    console.log("⚠️ 既に存在します — スキップ");
    return null;
  }

  const frontmatter = `---
title: "${structure.title}"
description: "${structure.description}"
category: "${structure.category}"
tags: ${JSON.stringify(structure.tags)}
date: "${TODAY}"
site: "sports"
qualityScore: ${score}
---

${content}`;

  fs.writeFileSync(filepath, frontmatter, "utf8");
  console.log(`✅ 保存: ${filename}`);
  return filename;
}

// ========================================
// メイン
// ========================================
async function main() {
  console.log("==================================================");
  console.log(`🏀 NBA記事自動生成 ${new Date().toLocaleString("ja-JP")}`);
  console.log("==================================================");

  try {
    // STEP0: リアルスタッツ取得
    console.log("━━━ STEP0: リアルスタッツ取得 ━━━");
    const realStats = await fetchRealStats();

    // STEP1+2: トレンド収集・スコアリング
    const selected = await fetchSportsTrends(realStats);

    // STEP3: 構成設計
    const structure = await designArticleStructure(selected.topic, selected.whyHot);

    // STEP4: 本文執筆
    const draft = await writeArticle(selected.topic, selected.whyHot, structure);

    // STEP5: 品質レビュー・リライト
    const result = await reviewAndRefineArticle(selected.topic, structure, draft);

    // 保存
    console.log("\n━━━ 💾 保存処理 ━━━");
    const filename = saveArticle(structure, result.content, result.score);

    // 最終レポート
    console.log("\n==================================================");
    console.log("📊 生成レポート");
    console.log("==================================================");
    console.log(`タイトル  : ${structure.title}`);
    console.log(`トピック  : ${selected.topic}`);
    console.log(`スコア    : ${result.score}点`);
    console.log(`ファイル  : ${filename ?? "スキップ"}`);
    console.log("==================================================");
    console.log("\n🎉 完了！");
  } catch (err) {
    console.error("❌ エラー:", err.message);
    process.exit(1);
  }
}

main();
