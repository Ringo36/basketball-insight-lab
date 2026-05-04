/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_SITE_NAME: "Sports Insight Lab",
    NEXT_PUBLIC_SITE_URL: "https://sports.trend-insightlab.com",
  },
};

export default nextConfig;
