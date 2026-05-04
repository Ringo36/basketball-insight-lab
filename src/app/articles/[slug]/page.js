import { getArticle, getArticles, getRelatedArticles } from "../../../lib/articles.js";
import { marked } from "marked";

export async function generateStaticParams() {
  const articles = getArticles();
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }) {
  const article = getArticle(params.slug);
  if (!article) return { title: "記事が見つかりません" };
  return {
    title: article.title,
    description: article.description ?? "",
  };
}

export default function ArticlePage({ params }) {
  const article = getArticle(params.slug);

  if (!article) {
    return (
      <div className="article-detail">
        <div className="container">
          <div className="empty-state" style={{ paddingTop: "80px" }}>
            <span className="emoji">🏀</span>
            <p>記事が見つかりません。</p>
            <a href="/" className="back-link" style={{ justifyContent: "center", marginTop: "20px" }}>
              ← トップに戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  const htmlContent = marked(article.content ?? "");
  const tags = Array.isArray(article.tags) ? article.tags : [];
  const related = getRelatedArticles(article.slug, article.category ?? "");

  return (
    <div className="article-detail">
      {/* Article Header */}
      <div className="article-header">
        <div className="article-header-inner">
          <a href="/" className="back-link">← トップに戻る</a>
          {article.category && (
            <span className="article-category-badge">{article.category}</span>
          )}
          <h1 className="article-title">{article.title}</h1>
          <div className="article-meta">
            <span>📅 {article.date ?? "—"}</span>
            {tags.length > 0 && (
              <span>🏷 {tags.join(" / ")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Article Body */}
      <div className="container">
        <article
          className="article-body"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>

      {/* Related Articles */}
      {related.length > 0 && (
        <div className="related-section">
          <h2 className="related-title">関連記事</h2>
          <div className="article-grid">
            {related.map((rel) => (
              <a key={rel.slug} href={`/articles/${rel.slug}/`} className="article-card">
                <div className="article-card-body">
                  {rel.category && (
                    <span className="article-card-category">{rel.category}</span>
                  )}
                  <h3 className="article-card-title">{rel.title}</h3>
                  {rel.description && (
                    <p className="article-card-desc">{rel.description}</p>
                  )}
                  <div className="article-card-meta">
                    <span>📅 {rel.date ?? "—"}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
