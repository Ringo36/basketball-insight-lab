export const metadata = {
  title: 'プライバシーポリシー | Basketball Insight Lab',
  description: 'Basketball Insight Labのプライバシーポリシーについて',
};

export default function PrivacyPage() {
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
      }}>プライバシーポリシー</h1>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: '#ff8c42' }}>個人情報の収集について</h2>
        <p style={{ color: '#e8e8e8' }}>Basketball Insight Lab（以下「当サイト」）では、お問い合わせフォーム等のご利用時に、氏名・メールアドレスなどの個人情報をご提供いただく場合があります。ご提供いただいた個人情報は、お問い合わせへの返信およびご連絡以外の目的で使用することはありません。</p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: '#ff8c42' }}>Cookieの使用について</h2>
        <p style={{ color: '#e8e8e8' }}>当サイトでは、サービス向上およびアクセス解析のため、Cookieを使用することがあります。Cookieはブラウザの設定により無効化することができます。</p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: '#ff8c42' }}>Google AdSenseについて</h2>
        <p style={{ color: '#e8e8e8' }}>当サイトでは、第三者配信の広告サービス「Google AdSense」を利用しています。Google等の第三者配信事業者がCookieを使用して、ユーザーのウェブサイトへのアクセス情報に基づいて広告を配信することがあります。</p>
        <p style={{ marginTop: '12px', color: '#e8e8e8' }}>Google広告設定ページ（<a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" style={{ color: '#ff8c42', textDecoration: 'underline' }}>https://www.google.com/settings/ads</a>）から、パーソナライズド広告を無効にすることができます。</p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: '#ff8c42' }}>アクセス解析ツールについて</h2>
        <p style={{ color: '#e8e8e8' }}>当サイトでは、Googleアナリティクスによるアクセス解析を行っております。Googleアナリティクスはトラフィックデータの収集のためにCookieを使用しています。収集されたデータは匿名で収集されており、個人を特定するものではありません。</p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: '#ff8c42' }}>免責事項</h2>
        <p style={{ color: '#e8e8e8' }}>当サイトに掲載されている情報の正確性については万全を期しておりますが、内容の正確性および完全性を保証するものではありません。当サイトの情報の利用により生じた損害について、一切の責任を負いかねますのでご了承ください。</p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: '#ff8c42' }}>プライバシーポリシーの変更</h2>
        <p style={{ color: '#e8e8e8' }}>本プライバシーポリシーの内容は予告なく変更されることがあります。変更後のプライバシーポリシーは、当サイトに掲載した時点で効力を生じるものとします。</p>
      </section>

      <p style={{ fontSize: '12px', color: '#a0a0a0', marginTop: '48px' }}>制定日：2026年5月25日</p>

      <a href="/" style={{
        display: 'inline-block',
        marginTop: '32px',
        color: '#ff8c42',
        textDecoration: 'underline'
      }}>← トップに戻る</a>
    </div>
  );
}
