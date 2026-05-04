import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { siteConfig } from "./config/site.config.mjs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TODAY = new Date().toISOString().split("T")[0];
const SITE_DIR = process.cwd();

async function callAI(prompt, useWebSearch = false) {
  const tools = useWebSearch
    ? [{ type: "web_search_20250305", name: "web_search" }]
    : undefined;
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    tools,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content.find(b => b.type === "text")?.text ?? "";
}

async function fetchSportsTrends() {
  console.log("📡 スポーツトレンドを収集中...");
  const prompt = `
今日の${siteConfig.topics.join("・")}に関する最新ニュースやトレンドを
3つ調べて、以下のJSON形式で返してください。
{
  "trends": ["トレンド1", "トレンド2", "トレンド3"]
}
JSONのみ返してください。
`;
  const raw = await callAI(prompt, true);
  try {
    const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return json.trends;
  } catch {
    return siteConfig.topics.slice(0, 3);
  }
}

async function generateArticle(trends) {
  console.log("✍️  記事を生成中...");
  const type = siteConfig.articleTypes[
    Math.floor(Math.random() * siteConfig.articleTypes.length)
  ];
  const prompt = `
あなたはバスケットボール専門ライターです。
今日のトレンド：${trends.join(" / ")}
記事タイプ：${type}

以下のJSON形式で記事を生成してください：
{
  "title": "記事タイトル（30文字以内）",
  "description": "記事の説明（80文字以内）",
  "category": "カテゴリ名",
  "content": "記事本文（マークダウン形式・1500文字以上）",
  "tags": ["タグ1", "タグ2", "タグ3"]
}
JSONのみ返してください。最新情報を反映した具体的な内容にしてください。
`;
  const raw = await callAI(prompt, true);
  try {
    // JSON部分を抽出して解析
    const cleaned = raw.replace(/```json|```/g, "").trim();
    // {...}の範囲を抽出
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSONが見つかりません");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("JSONパース失敗。生のレスポンス:", raw.substring(0, 500));
    throw new Error("記事生成に失敗しました: " + e.message);
  }
}

function saveArticle(article) {
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
title: "${article.title}"
description: "${article.description}"
category: "${article.category}"
tags: ${JSON.stringify(article.tags)}
date: "${TODAY}"
site: "sports"
---

${article.content}`;

  fs.writeFileSync(filepath, frontmatter, "utf8");
  console.log(`✅ 保存: ${filename}`);
  return filename;
}

async function main() {
  console.log("==================================================");
  console.log(`🏀 スポーツ記事自動生成 ${new Date().toLocaleString("ja-JP")}`);
  console.log("==================================================");

  const trends = await fetchSportsTrends();
  console.log(`📊 トレンド: ${trends.join(" / ")}`);

  const article = await generateArticle(trends);
  console.log(`📌 テーマ: ${article.title}`);

  saveArticle(article);
  console.log("\n🎉 完了！");
}

main().catch(err => {
  console.error("❌ エラー:", err.message);
  process.exit(1);
});
