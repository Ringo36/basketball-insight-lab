import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { siteConfig } from "./config/site.config.mjs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TODAY = new Date().toISOString().split("T")[0];
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const SITE_DIR = process.cwd();

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
        model: "claude-sonnet-4-6",
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

async function callAILong(role, prompt, retries = 2) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      console.log(`🤖 [${role}] 起動中...（試行${attempt}回目）`);
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      const text = msg.content.find(b => b.type === "text")?.text ?? "";
      console.log(`✅ [${role}] 完了（${text.length}文字）`);
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
  } catch (e) {
    const fixed = jsonStr
      .replace(/[\x00-\x1F\x7F]/g, " ")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    try {
      return JSON.parse(fixed);
    } catch (e2) {
      console.log("⚠️ JSON修復を試みます...");
      console.log("元のJSON先頭300文字:", jsonStr.slice(0, 300));
      throw new Error(`JSON解析失敗: ${e2.message}`);
    }
  }
}

// ========================================
// ① トレンド収集
// ========================================
async function fetchSportsTrends() {
  console.log("\n━━━ ① トレンド収集 ━━━");
  const prompt = `
現在は${CURRENT_YEAR}年${CURRENT_MONTH}月です。
今日の${siteConfig.topics.join("・")}に関する最新ニュースやトレンドを
Web検索で調べて、以下のJSON形式で返してください。
{
  "trends": ["トレンド1の具体的な内容", "トレンド2の具体的な内容", "トレンド3の具体的な内容", "トレンド4の具体的な内容", "トレンド5の具体的な内容"]
}
JSONのみ返してください。各トレンドは具体的な選手名・チーム名・試合結果を含めてください。
`;
  const raw = await callAI("トレンド収集AI", prompt, true);
  try {
    const json = extractJSON(raw);
    console.log(`📊 取得トレンド数: ${json.trends.length}件`);
    return json.trends;
  } catch {
    return siteConfig.topics.slice(0, 5);
  }
}

// ========================================
// ② トレンドスコアリング・テーマ選出
// ========================================
async function scoreTrends(trends) {
  console.log("\n━━━ ② トレンドスコアリング・テーマ選出 ━━━");

  const prompt = `現在は${CURRENT_YEAR}年${CURRENT_MONTH}月です。
あなたはバスケットボール専門メディアの編集長です。

以下のバスケ関連トレンドを分析して、記事化価値が高い上位3件を選出してください。

【トレンド一覧】
${trends.map((t, i) => `${i + 1}. ${t}`).join("\n")}

選出基準：
- ファンが最も読みたいと思う話題か
- 深掘りできるインサイトがあるか
- NBA・Bリーグ・日本人選手のどれかに関連するか

絶対に除外するテーマ：
- ギャンブル・賭博関連
- 選手のスキャンダル・私生活
- 政治・宗教・暴力

以下のJSONのみ出力（説明・前置き不要。必ず{から始める）：
{"candidates":[{"topic":"トレンドキーワード","whyBuzzing":"注目される理由（2文）","insightPotential":"深掘りできる角度（2文）","score":85},{"topic":"トレンドキーワード2","whyBuzzing":"理由","insightPotential":"角度","score":80},{"topic":"トレンドキーワード3","whyBuzzing":"理由","insightPotential":"角度","score":75}]}`;

  const text = await callAI("スコアリングAI", prompt);
  return extractJSON(text);
}

// ========================================
// ③ 記事構成設計
// ========================================
async function designArticleStructure(candidate) {
  console.log("\n━━━ ③ 記事構成設計 ━━━");

  const prompt = `現在は${CURRENT_YEAR}年${CURRENT_MONTH}月です。
あなたはバスケットボール専門ライターです。
以下のテーマで読者が最後まで読み切れる記事構成を設計してください。

テーマ: ${candidate.topic}
注目の理由: ${candidate.whyBuzzing}
深掘り角度: ${candidate.insightPotential}

以下のJSONのみ出力：
{
  "title": "記事タイトル（40文字以内・具体的でインパクトある表現）",
  "description": "記事説明（120文字以内・SEO最適化・キーワードを自然に含める）",
  "category": "カテゴリ名（NBA／Bリーグ／日本人選手／分析・コラム のいずれか）",
  "tags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"],
  "structure": [
    {
      "section": "セクション見出し（## 始まり）",
      "purpose": "このセクションの目的（1文）",
      "keyPoints": ["ポイント1（10文字以内）", "ポイント2（10文字以内）"]
    }
  ]
}
注意：structureは導入・本論2〜3セクション・まとめの4〜5セクション構成にすること。keyPointsは10文字以内。`;

  const text = await callAILong("構成設計AI", prompt);
  return extractJSON(text);
}

// ========================================
// ④ 記事本文生成
// ========================================
async function writeArticle(structure, candidate) {
  console.log("\n━━━ ④ 記事本文生成 ━━━");

  const prompt = `現在は${CURRENT_YEAR}年${CURRENT_MONTH}月です。
あなたはバスケットボール専門ライターです。
以下の構成に沿って、ファンが読みたくなる高品質な記事を執筆してください。

テーマ: ${candidate.topic}
タイトル: ${structure.title}

構成:
${structure.structure.map(s => `
${s.section}
目的: ${s.purpose}
含めるポイント: ${s.keyPoints.join(", ")}
`).join("")}

執筆ルール：
- Markdown形式
- 1,500〜2,000文字
- です・ます調
- 具体的な選手名・スタッツ・試合結果を含める
- 最初のセクション前に「## この記事のポイント」として3つの箇条書きを追加
- 最後に「## まとめ」セクションを追加（読者へのアクション提案を含む）
- ファンが「なるほど！」と感じる独自の視点を入れる
- AIが書いたとわからない自然な文体

本文のみ出力（JSONやfrontmatter不要）:`;

  return await callAILong("執筆AI", prompt);
}

// ========================================
// ⑤ 品質チェック＆リライト
// ========================================
async function reviewAndRefineArticle(article, structure, candidate) {
  console.log("\n━━━ ⑤ 品質チェック＆リライト ━━━");

  let currentArticle = article;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const reviewPrompt = `あなたはバスケットボール専門メディアの編集長です。
以下の記事を100点満点で評価してください。

【記事本文】
${currentArticle}

評価基準：
- 情報の正確性・具体性（25点）：選手名・スタッツ・試合結果が具体的か
- 独自視点・分析（25点）：ファンが「なるほど」と思える視点があるか
- 読みやすさ・構成（25点）：見出し・まとめが整っているか
- ファン満足度（25点）：読後に満足感・共有したい気持ちになるか

以下のJSONのみ出力：
{
  "score": 85,
  "approved": false,
  "breakdown": {
    "accuracy": 20,
    "insight": 18,
    "readability": 22,
    "fanSatisfaction": 20
  },
  "improvements": [
    {
      "point": "改善点",
      "reason": "なぜ問題か",
      "howTo": "具体的にどう直すか"
    }
  ]
}`;

    const reviewText = await callAI("レビューAI", reviewPrompt);
    const review = extractJSON(reviewText);
    console.log(`📊 記事スコア: ${review.score}点 / 承認: ${review.approved}`);

    if (review.score >= 85) {
      console.log("✅ 85点以上達成！記事確定");
      return { article: currentArticle, score: review.score, approved: true };
    }

    attempts++;
    if (attempts >= maxAttempts) {
      console.log(`⚠️ ${maxAttempts}回リライト後のスコア: ${review.score}点`);
      return { article: currentArticle, score: review.score, approved: review.score >= 70 };
    }

    console.log(`🔄 リライト ${attempts}回目...`);
    const improvements = Array.isArray(review.improvements)
      ? review.improvements.map(imp =>
          typeof imp === "object"
            ? `・${imp.point}\n  理由: ${imp.reason}\n  対処: ${imp.howTo}`
            : `・${imp}`
        ).join("\n")
      : String(review.improvements);

    const rewritePrompt = `あなたはバスケットボール専門ライターです。
以下の記事を85点レベルに改善してください。

【現在の記事】
${currentArticle}

【必ず改善すべき点】
${improvements}

【改善指針】
1. 具体的な選手名・スタッツ・試合結果を最低3つ追加する
2. ファンが「なるほど！」と思える独自の視点を強化する
3. 見出し・まとめ構成を整える
4. 読後に「シェアしたい」と思わせる仕上げにする

【ルール】
- です・ます調を維持
- 1,500〜2,000文字を維持
- 改善された本文のみ出力（前置き不要）`;

    currentArticle = await callAILong("執筆AI（リライト）", rewritePrompt);
  }

  return { article: currentArticle, score: 70, approved: false };
}

// ========================================
// ファイル保存
// ========================================
function saveArticle(article, structure, score) {
  const contentDir = path.join(SITE_DIR, "content");
  if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });

  const id = Date.now().toString().slice(-4);
  const filename = `${TODAY}-${id}.md`;
  const filepath = path.join(contentDir, filename);

  if (fs.existsSync(filepath)) {
    console.log("⚠️  既に存在します — スキップ");
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

${article}`;

  fs.writeFileSync(filepath, frontmatter, "utf8");
  console.log(`✅ 保存: ${filename}`);
  return filename;
}

// ========================================
// メイン
// ========================================
async function main() {
  console.log("==================================================");
  console.log(`🏀 スポーツ記事自動生成 ${new Date().toLocaleString("ja-JP")}`);
  console.log("==================================================");

  // ① トレンド収集
  const trends = await fetchSportsTrends();
  console.log(`📊 トレンド: ${trends.slice(0, 3).join(" / ")}`);

  // ② トレンドスコアリング・テーマ選出
  const scored = await scoreTrends(trends);
  const topCandidate = scored.candidates[0];
  console.log(`🎯 選定テーマ: ${topCandidate.topic}（スコア: ${topCandidate.score}）`);

  // ③ 記事構成設計
  const structure = await designArticleStructure(topCandidate);
  console.log(`📐 タイトル: ${structure.title}`);

  // ④ 記事本文生成
  const article = await writeArticle(structure, topCandidate);
  console.log(`📝 本文生成完了: ${article.length}文字`);

  // ⑤ 品質チェック＆リライト
  const result = await reviewAndRefineArticle(article, structure, topCandidate);
  console.log(`📊 最終スコア: ${result.score}点`);

  // 保存
  console.log("\n━━━ 💾 保存処理 ━━━");
  saveArticle(result.article, structure, result.score);

  // 最終レポート
  console.log("\n==================================================");
  console.log("📊 生成レポート");
  console.log("==================================================");
  console.log(`タイトル    : ${structure.title}`);
  console.log(`テーマ      : ${topCandidate.topic}`);
  console.log(`記事スコア  : ${result.score}点`);
  console.log(`承認状態    : ${result.approved ? "✅ 承認" : "⚠️ 要確認"}`);
  console.log("==================================================");
  console.log("\n🎉 完了！");
}

main().catch(err => {
  console.error("❌ エラー:", err.message);
  process.exit(1);
});
