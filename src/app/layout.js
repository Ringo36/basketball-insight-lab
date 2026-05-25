import "./globals.css";

export const metadata = {
  title: {
    default: "Basketball Insight Lab",
    template: "%s | Basketball Insight Lab",
  },
  description: "NBA・Bリーグ・日本人選手の最新情報をAIが深く分析。バスケットボールの本質に迫るインサイトメディア。",
  openGraph: {
    siteName: "Basketball Insight Lab",
    locale: "ja_JP",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1463566260092039"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a href="/" className="site-logo">
          <span className="ball-icon">🏀</span>
          Basketball Insight Lab
        </a>
        <nav className="site-nav">
          <a href="/">ホーム</a>
          <a href="/nba">NBA</a>
          <a href="/bleague">Bリーグ</a>
          <a href="/japan">日本人選手</a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-logo">🏀 Basketball Insight Lab</div>
        <div className="footer-links">
          <a href="/">ホーム</a>
          <a href="/nba">NBA</a>
          <a href="/bleague">Bリーグ</a>
          <a href="/japan">日本人選手</a>
          <a href="/about">編集部について</a>
          <a href="/privacy">プライバシーポリシー</a>
          <a href="/contact">お問い合わせ</a>
        </div>
        <p className="footer-copy">
          © {year} Basketball Insight Lab. AIが届けるバスケットボールインサイト。
        </p>
      </div>
    </footer>
  );
}
