import { getAllArticles } from "../lib/articles.js";

export const metadata = {
  title: "Basketball Insight Lab — NBA・Bリーグ・日本人選手のインサイトメディア",
};

const CATEGORIES = ["NBA", "Bリーグ", "日本人選手", "試合結果", "移籍情報"];

export default function HomePage() {
  const articles = getAllArticles();
  const latest = articles.slice(0, 6);

  const nbaArticles = articles
    .filter((a) => ["NBA", "試合結果まとめ", "MVP候補徹底分析", "チーム戦力分析", "プレーオフ展望"].includes(a.category))
    .slice(0, 3);

  const japanArticles = articles
    .filter((a) => ["日本人選手最新動向", "日本人選手"].includes(a.category))
    .slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">AI-Powered Basketball Media</div>
        <h1 className="hero-title">
          バスケを、もっと<span>深く</span>。
        </h1>
        <p className="hero-sub">
          NBA・Bリーグ・日本人選手の最新情報をAIが分析。
          数字の裏側にある本質的なインサイトをお届けします。
        </p>
      </section>

      {/* Latest Articles */}
      <section className="section section-bg">
        <div className="container">
          <h2 className="section-title">最新記事</h2>
          {latest.length > 0 ? (
            <div className="article-grid">
              {latest.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          ) : (
            <EmptyState message="記事を生成中です。しばらくお待ちください。" />
          )}
        </div>
      </section>

      {/* NBA Section */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">🏆 NBA</h2>
          {nbaArticles.length > 0 ? (
            <div className="article-grid">
              {nbaArticles.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          ) : (
            <EmptyState message="NBA記事は準備中です。" />
          )}
        </div>
      </section>

      {/* Japan Players Section */}
      <section className="section section-bg">
        <div className="container">
          <h2 className="section-title">🇯🇵 日本人選手</h2>
          {japanArticles.length > 0 ? (
            <div className="article-grid">
              {japanArticles.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          ) : (
            <EmptyState message="日本人選手の記事は準備中です。" />
          )}
        </div>
      </section>
    </>
  );
}

function ArticleCard({ article }) {
  const tags = Array.isArray(article.tags) ? article.tags.slice(0, 3) : [];
  return (
    <a href={`/articles/${article.slug}/`} className="article-card">
      <div className="article-card-body">
        {article.category && (
          <span className="article-card-category">{article.category}</span>
        )}
        <h3 className="article-card-title">{article.title}</h3>
        {article.description && (
          <p className="article-card-desc">{article.description}</p>
        )}
        <div className="article-card-meta">
          <span>📅 {article.date ?? "—"}</span>
        </div>
        {tags.length > 0 && (
          <div className="article-card-tags">
            {tags.map((tag) => (
              <span key={tag} className="tag">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

function EmptyState({ message }) {
  return (
    <div className="empty-state">
      <span className="emoji">🏀</span>
      <p>{message}</p>
    </div>
  );
}
