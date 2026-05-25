export const metadata = {
  title: '編集部について | Basketball Insight Lab',
  description: 'Basketball Insight Labの編集方針と運営者情報',
};

export default function AboutPage() {
  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '60px 24px',
      lineHeight: 1.9,
      color: '#e8e8e8'
    }}>
      <h1 style={{
        fontSize: '32px',
        fontWeight: 700,
        marginBottom: '32px',
        color: '#ff8c42'
      }}>編集部について</h1>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#ff8c42' }}>サイト概要</h2>
        <p style={{ color: '#e8e8e8' }}>
          Basketball Insight Lab（バスケットボール・インサイト・ラボ）は、
          NBA・Bリーグ・日本人選手の最新情報を、AIテクノロジーで分析する
          バスケットボール専門メディアです。
        </p>
        <p style={{ marginTop: '12px', color: '#e8e8e8' }}>
          スタッツの裏側にある戦術的な意図、選手の成長の背景、
          試合展開の構造的な要因など、表面的な情報だけでは見えない
          本質的なインサイトを読者の皆さまにお届けします。
        </p>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#ff8c42' }}>編集方針</h2>
        <p style={{ color: '#e8e8e8' }}>私たちが大切にしているのは、以下の3つの方針です。</p>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: '#ffffff' }}>1. ファクトチェックの徹底</h3>
          <p style={{ color: '#e8e8e8' }}>すべての記事は、執筆後にAIによるファクトチェック工程を経ます。スタッツ・選手名・試合結果などを、stats.nba.com・ESPN・Basketball Referenceなどの一次情報と照合して検証しています。</p>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: '#ffffff' }}>2. 深い分析</h3>
          <p style={{ color: '#e8e8e8' }}>勝敗や得点といった表面的な結果だけでなく、その背景にある戦術・チーム構成・選手の役割など、構造的な視点で記事を構成しています。</p>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: '#ffffff' }}>3. 透明性の確保</h3>
          <p style={{ color: '#e8e8e8' }}>記事の生成プロセスにはAIを活用していますが、テーマの選定、構成、執筆、レビュー、ファクトチェックには複数の独立した判断工程を設けています。事実の正確性を最重要視しています。</p>
        </div>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#ff8c42' }}>運営情報</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e8e8e8' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <td style={{ padding: '12px 0', fontWeight: 600, width: '30%', color: '#a0a0a0' }}>サイト名</td>
              <td>Basketball Insight Lab</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <td style={{ padding: '12px 0', fontWeight: 600, color: '#a0a0a0' }}>URL</td>
              <td>https://basketball.trend-insightlab.com</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <td style={{ padding: '12px 0', fontWeight: 600, color: '#a0a0a0' }}>運営開始</td>
              <td>2026年4月</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <td style={{ padding: '12px 0', fontWeight: 600, color: '#a0a0a0' }}>更新頻度</td>
              <td>毎日</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <td style={{ padding: '12px 0', fontWeight: 600, color: '#a0a0a0' }}>お問い合わせ</td>
              <td><a href="/contact" style={{ color: '#ff8c42', textDecoration: 'underline' }}>contact@trend-insightlab.com</a></td>
            </tr>
          </tbody>
        </table>
      </section>

      <a href="/" style={{
        display: 'inline-block',
        marginTop: '32px',
        color: '#ff8c42',
        textDecoration: 'underline'
      }}>← トップに戻る</a>
    </div>
  );
}
