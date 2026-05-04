import fs from "fs";
import path from "path";
import matter from "gray-matter";

const contentDir = path.join(process.cwd(), "content");

export function getArticleSlugs() {
  if (!fs.existsSync(contentDir)) return [];
  return fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(".md", ""));
}

export function getArticle(slug) {
  const filepath = path.join(contentDir, `${slug}.md`);
  if (!fs.existsSync(filepath)) return null;
  const raw = fs.readFileSync(filepath, "utf8");
  const { data, content } = matter(raw);
  return { slug, content, ...data };
}

export function getAllArticles() {
  return getArticleSlugs()
    .map((slug) => getArticle(slug))
    .filter(Boolean)
    .sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0));
}

export function getArticlesByCategory(category) {
  return getAllArticles().filter((a) => a.category === category);
}

export function getRelatedArticles(currentSlug, category, limit = 3) {
  return getAllArticles()
    .filter((a) => a.slug !== currentSlug && a.category === category)
    .slice(0, limit);
}
