import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TODAY = new Date().toISOString().split("T")[0];
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const SITE_DIR = process.cwd();
const MODEL = "claude-sonnet-4-20250514";

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
  let cleaned = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

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
// STEP1+2: トレンド収集・スコアリング
// ========================================
async function fetchSportsTrends() {
  console.log("\n━━━ STEP1: トレンド収集（3ソース並行） ━━━");

  const [redditRaw, espnRaw, jpRaw] = await Promise.all([
    callAI(
      "Reddit検索",
      `Search Reddit r/nba for what's trending and most discussed today ${CURRENT_YEAR}. List the top 5 most talked-about topics, players, games, or news stories right now. Return only a numbered list.`,
      true
    ),
    callAI(
      "ESPN検索",
      `Search for the latest NBA news today ${CURRENT_YEAR} from ESPN and Bleacher Report. List the top 5 most important stories, game results, injuries, trades, or developments. Return only a numbered list.`,
      true
    ),
    callAI(
      "日本語検索",
      `「NBA バスケットボール 最新ニュース 今日 ${CURRENT_YEAR}年${CURRENT_MONTH}月」で検索して、今日のNBAに関する重要な話題を5件リストアップしてください。番号付きリストのみ返してください。`,
      true
    ),
  ]);

  console.log("\n━━━ STEP2: スコアリング・重複チェック ━━━");

  const recentArticles = getRecentArticleTitles(10);
  const recentTitlesText = recentArticles.length > 0
    ? recentArticles.map(a => `- ${a.date}: ${a.title}`).join("\n")
    : "（なし）";

  const scoringPrompt = `現在は${CURRENT_YEAR}年${CURRENT_MONTH}月です。
以下の3ソースから収集したNBAトレンド情報を分析し、記事化する上位トピックを選定してください。

【ソース① Reddit r/nba】
${redditRaw}

【ソース② ESPN / Bleacher Report】
${espnRaw}

【ソース③ 日本語ニュース】
${jpRaw}

【直近10件の公開済み記事（重複チェック用）】
${recentTitlesText}

スコアリング基準：
- 鮮度（直近24時間以内か）: 最大40点
- 話題性（複数ソースで言及されているか）: 最大35点
- NBA的重要度（スタッツ・戦術・契約・トレード・PO展望など）: 最大25点

重複ペナルティ：
- 同じ選手・チーム名が直近3日以内の記事にあれば-30点
- 直近1日以内にあれば候補から除外（score: 0として選ばない）

除外するテーマ：ギャンブル・賭博・暴力・私生活スキャンダル

候補を3件スコアリングし、最高スコアを"selected"に設定してください。

以下のJSONのみ出力（説明不要。必ず{から始める）：
{"candidates":[{"topic":"トピック名","whyHot":"注目理由（1文）","score":85,"penalty":"ペナルティ理由（なければ空文字）"},{"topic":"トピック2","whyHot":"理由","score":75,"penalty":""},{"topic":"トピック3","whyHot":"理由","score":65,"penalty":""}],"selected":{"topic":"最高スコアのトピック名","whyHot":"注目理由（2文）","score":85}}`;

  const scoringText = await callAI("スコアリングAI", scoringPrompt);
  const result = extractJSON(scoringText);

  console.log(`📊 候補スコア:`);
  result.candidates.forEach(c =>
    console.log(`   ${String(c.score).padStart(3)}点: ${c.topic}${c.penalty ? ` （${c.penalty}）` : ""}`)
  );
  console.log(`🎯 選定: 【${result.selected.topic}】（${result.selected.score}点）`);

  return result.selected;
}

// ========================================
// STEP3: 構成設計
// ========================================
async function designArticleStructure(topic) {
  console.log("\n━━━ STEP3: 構成設計 ━━━");

  const prompt = `現在は${CURRENT_YEAR}年${CURRENT_MONTH}月です。
あなたはNBAコアファン向けバスケットボール専門メディアの編集長です。
以下のトピックで記事構成を設計してください。

トピック: ${topic.topic}
注目理由: ${topic.whyHot}

ターゲット：NBAコアファン。専門用語・スタッツ・戦術分析を積極的に使用。過度な説明不要。

以下のJSONのみ出力：
{
  "title": "SEOタイトル（40文字以内・トピックのキーワードを含む）",
  "description": "meta description（120文字以内・キーワードを自然に含む）",
  "category": "カテゴリ（NBA／Bリーグ／日本人選手／分析・コラム のいずれか）",
  "tags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"],
  "points": ["冒頭ポイント1（30文字以内）", "冒頭ポイント2（30文字以内）", "冒頭ポイント3（30文字以内）"],
  "sections": [
    {"heading": "## 見出し1（キーワード含む）", "focus": "このセクションで扱う内容（1文）"},
    {"heading": "## 見出し2", "focus": "内容"},
    {"heading": "## 見出し3", "focus": "内容"},
    {"heading": "## 見出し4", "focus": "内容"}
  ],
  "summary": "まとめセクションの方向性（1文）"
}
注意：sectionsは4〜5個。pointsは1点30文字以内。`;

  const text = await callAI("構成設計AI", prompt);
  const structure = extractJSON(text);
  console.log(`📐 タイトル: ${structure.title}`);
  console.log(`📋 セクション数: ${structure.sections.length}`);
  return structure;
}

// ========================================
// STEP4: 本文執筆
// ========================================
async function writeArticle(topic, structure) {
  console.log("\n━━━ STEP4: 本文執筆 ━━━");

  const sectionsText = structure.sections
    .map(s => `${s.heading}\n担当内容: ${s.focus}`)
    .join("\n\n");

  const prompt = `現在は${CURRENT_YEAR}年${CURRENT_MONTH}月です。
あなたはNBAコアファン向けバスケットボール専門ライターです。
以下の構成に沿って、NBAコアファンが満足する専門的な記事を執筆してください。

【トピック】${topic.topic}
【注目理由】${topic.whyHot}
【記事タイトル】${structure.title}

【冒頭ポイント（箇条書きで配置すること）】
${structure.points.map(p => `- ${p}`).join("\n")}

【セクション構成】
${sectionsText}

【まとめの方向性】${structure.summary}

執筆ルール：
- Markdown形式
- 1500文字以上
- です・ます調
- 冒頭に「## この記事のポイント」として上記3点を箇条書きで配置
- 各セクションを上記見出しで執筆
- 末尾に「## まとめ」セクションを追加
- PER・TS%・USG%・WS・BPMなどのアドバンスドスタッツを積極的に使用
- トレード・サラリーキャップ・バードライツ・ドラフト・PO展望などNBA固有の文脈を盛り込む
- バスケ用語はカタカナのまま（ファイブアウト・P&R・アイソレーション・スモールボール等）
- 数字・固有名詞を具体的に記述
- AIが書いたとわからない自然な文体

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
      `（正確性:${bd.accuracy ?? "-"} 専門性:${bd.expertise ?? "-"} 構成:${bd.structure ?? "-"} SEO:${bd.seo ?? "-"}）`
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
以下の記事を85点レベルに改善してください。

【現在の記事】
${current}

【改善が必要な点】
${improvements}

【改善指針】
1. アドバンスドスタッツ（PER・TS%・USG%・WS・BPM等）を具体的な数値で追加する
2. 戦術的な分析（オフェンシブレーティング・P&R守備・ゾーン対策等）を深める
3. NBA固有の文脈（サラリーキャップ・バードライツ・トレードデッドライン・PO展望）を強化する
4. 見出しにキーワードを含める
5. 冒頭ポイントとまとめを整合させる

【ルール】
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

  const id = Date.now().toString().slice(-4);
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
    // STEP1+2: トレンド収集・スコアリング
    const topic = await fetchSportsTrends();

    // STEP3: 構成設計
    const structure = await designArticleStructure(topic);

    // STEP4: 本文執筆
    const draft = await writeArticle(topic, structure);

    // STEP5: 品質レビュー・リライト
    const result = await reviewAndRefineArticle(topic, structure, draft);

    // 保存
    console.log("\n━━━ 💾 保存処理 ━━━");
    const filename = saveArticle(structure, result.content, result.score);

    // 最終レポート
    console.log("\n==================================================");
    console.log("📊 生成レポート");
    console.log("==================================================");
    console.log(`タイトル  : ${structure.title}`);
    console.log(`トピック  : ${topic.topic}`);
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
