import { getAllArticles } from '../../lib/articles';

export default function sitemap() {
  const articles = getAllArticles();
  const baseUrl = 'https://basketball.trend-insightlab.com';

  const articleUrls = articles.map((article) => ({
    url: `${baseUrl}/articles/${article.slug}/`,
    lastModified: new Date(article.date ?? Date.now()),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...articleUrls,
  ];
}
