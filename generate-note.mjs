import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

async function callClaude(prompt, maxTokens = 1024, retries = 2) {
  const safeMaxTokens = Math.min(maxTokens, 8192);
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: safeMaxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      return msg.content[0].type === "text" ? msg.content[0].text : "";
    } catch (e) {
      if (attempt > retries) throw e;
      await new Promise(r => setTimeout(r, attempt * 5000));
    }
  }
}

function extractJSON(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start === -1 || end === 0) throw new Error("JSONが見つかりません");
  return JSON.parse(text.slice(start, end));
}

function getLatestArticle() {
  const dir = path.join(process.cwd(), "content");
  if (!fs.existsSync(dir)) throw new Error("contentフォルダが見つかりません");
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(".md"))
    .sort()
    .reverse();
  if (files.length === 0) throw new Error("記事が見つかりません");
  const raw = fs.readFileSync(path.join(dir, files[0]), "utf8");
  const { data, content } = matter(raw);
  return { ...data, content, slug: files[0].replace(".md", "") };
}

async function generateMeta(freeArticle) {
  console.log("📋 ① メタ情報を生成中...");
  const text = await callClaude(`現在は${CURRENT_YEAR}年${CURRENT_MONTH}月です。
以下のNBA・バスケットボール記事をベースにnote無料記事のメタ情報を生成してください。

タイトル: ${freeArticle.title}
カテゴリ: ${freeArticle.category}
概要: ${freeArticle.description}

ルール：
- NBAコアファン・バスケ好きに刺さるタイトルにする
- summaryはバスケファンの興味・共感から入る
- 無料記事として公開することを前提にする
- tagsはNBA・バスケ関連のキーワードにする
- priceは必ず0にする

以下のJSONのみ出力：
{"noteTitle":"noteタイトル（50文字以内）","summary":"冒頭文（150文字以内・バスケファンへの共感から入る）","price":0,"tags":["タグ1","タグ2","タグ3"]}`, 512);
  return extractJSON(text);
}

async function designStructure(freeArticle) {
  console.log("📐 ② 構成を設計中...");
  const text = await callClaude(`現在は${CURRENT_YEAR}年${CURRENT_MONTH}月です。
以下のNBA・バスケットボール無料記事の深掘り版となるnote有料記事の構成を設計してください。

タイトル: ${freeArticle.title}
概要: ${freeArticle.description}

設計ルール：
- NBAコアファン向けの深い分析・考察を盛り込む
- スタッツ・戦術・契約・トレードなどの専門的視点を取り入れる
- 無料記事の続き・深掘りとして自然につながる構成
- 各セクションは前のセクションの内容を受けて発展する
- 末尾セクションは読者の行動・考察を促す

重要な注意：
- JSONは必ず1行で出力すること
- keyPointsの各要素は15文字以内にすること
- 日本語の括弧や記号は使わないこと

以下のJSONのみ出力：
{"sections":[{"title":"## セクション1タイトル","role":"役割1文","keyPoints":["ポイント1","ポイント2","ポイント3"],"transitionFrom":""},{"title":"## セクション2タイトル","role":"役割1文","keyPoints":["ポイント1","ポイント2"],"transitionFrom":"前セクションとの接続"},{"title":"## セクション3タイトル","role":"役割1文","keyPoints":["ポイント1","ポイント2"],"transitionFrom":"前セクションとの接続"},{"title":"## セクション4タイトル","role":"役割1文","keyPoints":["ポイント1","ポイント2"],"transitionFrom":"前セクションとの接続"}]}`, 1024);
  return extractJSON(text);
}

async function writeSequentially(freeArticle, structure) {
  console.log("✍️  ③ 順次生成中...");
  const sections = [];
  let previousContent = "";

  for (const [index, section] of structure.sections.entries()) {
    console.log(`   セクション${index + 1}/${structure.sections.length}: ${section.title}`);

    const prompt = `現在は${CURRENT_YEAR}年${CURRENT_MONTH}月です。
NBAコアファン向けnote有料記事のセクションを執筆してください。

【記事テーマ】${freeArticle.title}

【全体構成】
${structure.sections.map((s, i) => `${i + 1}. ${s.title}（${s.role}）`).join("\n")}

【前のセクションまでの内容】
${previousContent || "（最初のセクションです）"}

【今回のセクション】
タイトル: ${section.title}
役割: ${section.role}
前セクションからの接続: ${section.transitionFrom || "記事の冒頭として自然に始める"}
書くべきポイント:
${section.keyPoints.map(p => `- ${p}`).join("\n")}

執筆ルール：
- NBAコアファン向けの深い分析・考察を書く
- スタッツ・戦術・契約詳細などの専門的内容を積極的に盛り込む
- バスケ用語はカタカナのまま使用（過度な説明不要）
- 前のセクションから自然につながるよう書く
- 「このセクションでは〇〇します」などの予告文を書かない
- です・ます調
- 600〜800文字
- ${section.title} の見出しから始める
- 記事末尾に以下の誘導文を必ず含める：
  「より詳しい分析・最新情報はこちら → https://basketball.trend-insightlab.com」
- 本文のみ出力`;

    const sectionText = await callClaude(prompt, 1024);
    sections.push(sectionText.trim());
    previousContent += `\n\n${sectionText.trim()}`;
  }

  return sections.join("\n\n");
}

async function reviewConsistency(content, freeArticle) {
  console.log("🔍 ④ 一貫性レビュー中...");
  const text = await callClaude(`あなたはNBAメディアの編集者です。
以下のnote有料記事を読んで、一貫性の問題を指摘してください。

【記事テーマ】${freeArticle.title}

【本文全文】
${content}

チェック項目：
1. 冒頭で予告した内容が本文に存在するか
2. セクション間の文脈が自然につながっているか
3. 同じ内容の重複がないか
4. 話が突然変わる箇所がないか
5. 結論が冒頭の問題提起に対応しているか

重要な注意：
- JSONは必ず1行で出力すること
- 各フィールドの値は30文字以内にすること
- 日本語の括弧や記号は使わないこと
- issuesが空の場合は {"score":90,"hasIssues":false,"issues":[]} と出力

以下のJSONのみ出力：
{"score":80,"hasIssues":true,"issues":[{"location":"問題箇所","problem":"問題の内容","fix":"修正方法"}]}`, 1024);
  return extractJSON(text);
}

async function fixConsistency(content, review) {
  if (!review.hasIssues || review.issues.length === 0) {
    console.log("✅ 一貫性の問題なし");
    return content;
  }

  console.log(`🔄 ⑤ 外科的修正中（${review.issues.length}件）...`);
  let fixedContent = content;

  for (const [index, issue] of review.issues.entries()) {
    console.log(`   修正${index + 1}/${review.issues.length}: ${issue.location}`);

    const prompt = `以下のnote記事の特定箇所のみを修正してください。

【修正対象の問題】
場所: ${issue.location}
問題: ${issue.problem}
修正方法: ${issue.fix}

【記事全文】
${fixedContent}

ルール：
- 指摘された箇所のみを最小限修正する
- 他の箇所は一切変更しない
- 文字数を減らさない
- です・ます調を維持する
- 修正後の記事全文を出力する`;

    const fixed = await callClaude(prompt, 8192);
    if (fixed && fixed.length > fixedContent.length * 0.8) {
      fixedContent = fixed;
    } else {
      console.log(`   ⚠️ 修正結果が不正のためスキップ`);
    }
  }

  return fixedContent;
}

async function scoreQuality(content, meta) {
  console.log("📊 ⑥ 品質スコアリング中...");
  const text = await callClaude(`あなたはNBAメディアの編集長です。
以下のnote有料記事を評価してください（100点満点）。

タイトル: ${meta.noteTitle}
冒頭: ${meta.summary}
本文:
${content}

評価基準（各項目を個別採点してから合計）：

1. 集客力・タイトルの魅力（30点）
   - NBAファンがクリックしたくなるか
   - noteで拡散されやすい内容か

2. 一貫性・文脈の流れ（25点）
   - セクション間が自然につながっているか
   - 冒頭と結論が対応しているか

3. サイト誘導効果（25点）
   - 記事を読んだ後にサイトを訪問したくなるか
   - 続きを読みたくなる余白があるか

4. 文章品質（20点）
   - 読みやすいか
   - 自然な日本語か

以下のJSONのみ出力：
{"score":82,"breakdown":{"analysis":24,"consistency":21,"readerValue":20,"writing":17},"approved":true,"feedback":"総評（2文）"}`, 512);
  return extractJSON(text);
}

function saveNoteArticle(meta, content, baseSlug, scoreResult) {
  const today = new Date().toISOString().split("T")[0];
  const dir = path.join(process.cwd(), "content-note");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const cleanSlug = baseSlug.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  const filename = `${today}-${cleanSlug}-note.md`;
  const filepath = path.join(dir, filename);

  if (fs.existsSync(filepath)) {
    console.log(`⚠️ 既に存在: ${filename} — スキップ`);
    return null;
  }

  const fileContent = `---
title: "${meta.noteTitle}"
price: ${meta.price}
tags: ${JSON.stringify(meta.tags)}
date: "${today}"
status: "draft"
qualityScore: ${scoreResult.score}
noteUrl: ""
---

${meta.summary}

${content}

---

🏀 **NBA・バスケ最新情報はこちら**
より詳しい分析・速報記事を毎日更新中です。
👉 https://basketball.trend-insightlab.com
`;

  fs.writeFileSync(filepath, fileContent, "utf8");
  console.log(`✅ note保存: content-note/${filename}`);
  console.log(`💰 推奨価格: ¥${meta.price}`);
  return filename;
}

async function main() {
  console.log("=".repeat(50));
  console.log(`📓 note生成パイプライン ${new Date().toLocaleString("ja-JP")}`);
  console.log("=".repeat(50));

  try {
    const freeArticle = getLatestArticle();
    console.log(`📖 ベース記事: ${freeArticle.title}`);

    const meta = await generateMeta(freeArticle);
    console.log(`📌 noteタイトル: ${meta.noteTitle}`);

    const structure = await designStructure(freeArticle);
    console.log(`📐 セクション数: ${structure.sections.length}`);

    let content = await writeSequentially(freeArticle, structure);
    console.log(`📝 生成完了: ${content.length}文字`);

    const consistencyReview = await reviewConsistency(content, freeArticle);
    console.log(`🔍 一貫性スコア: ${consistencyReview.score}点 / 問題: ${consistencyReview.issues?.length || 0}件`);

    for (let i = 0; i < 2; i++) {
      if (!consistencyReview.hasIssues || consistencyReview.issues?.length === 0) break;
      content = await fixConsistency(content, consistencyReview);
      const recheck = await reviewConsistency(content, freeArticle);
      console.log(`🔄 修正後スコア: ${recheck.score}点`);
      if (!recheck.hasIssues) break;
      consistencyReview.hasIssues = recheck.hasIssues;
      consistencyReview.issues = recheck.issues;
    }

    const scoreResult = await scoreQuality(content, meta);
    console.log(`📊 品質スコア: ${scoreResult.score}点 / 承認: ${scoreResult.approved}`);
    console.log(`💬 総評: ${scoreResult.feedback}`);

    const saved = saveNoteArticle(meta, content, freeArticle.slug, scoreResult);

    console.log("\n📊 生成レポート:");
    console.log(`  noteタイトル: ${meta.noteTitle}`);
    console.log(`  文字数: ${content.length}文字`);
    console.log(`  品質スコア: ${scoreResult.score}点`);
    console.log(`  推奨価格: ¥${meta.price}`);
    console.log("\n🎉 完了！");
    process.exit(0);
  } catch (err) {
    console.error("❌ エラー:", err.message);
    process.exit(1);
  }
}

main();
