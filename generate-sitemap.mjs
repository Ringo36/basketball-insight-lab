import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const baseUrl = 'https://basketball.trend-insightlab.com';
const contentDir = path.join(process.cwd(), 'content');
const outDir = path.join(process.cwd(), 'public');

function getArticles() {
  if (!fs.existsSync(contentDir)) return [];
  return fs.readdirSync(contentDir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const raw = fs.readFileSync(path.join(contentDir, f), 'utf8');
      const { data } = matter(raw);
      return { slug: f.replace('.md', ''), date: data.date ?? '' };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

const articles = getArticles();

const urls = [
  `  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,
  ...articles.map(a => `  <url>
    <loc>${baseUrl}/articles/${a.slug}/</loc>
    <lastmod>${a.date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)
].join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

fs.writeFileSync(path.join(outDir, 'sitemap.xml'), xml, 'utf8');
console.log(`✅ sitemap.xml を生成しました（${articles.length + 1}件）`);
