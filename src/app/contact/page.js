export const metadata = {
  title: 'お問い合わせ | Basketball Insight Lab',
  description: 'Basketball Insight Labへのお問い合わせはこちらから',
};

export default function ContactPage() {
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
      }}>お問い合わせ</h1>

      <p style={{ marginBottom: '24px', color: '#e8e8e8' }}>
        Basketball Insight Labへのご意見・ご感想・取材依頼などは、
        以下のメールアドレスまでお気軽にお問い合わせください。
      </p>

      <div style={{
        padding: '32px',
        backgroundColor: 'rgba(255,140,66,0.08)',
        border: '1px solid rgba(255,140,66,0.3)',
        borderRadius: '4px',
        marginBottom: '32px'
      }}>
        <div style={{
          fontSize: '12px',
          color: '#a0a0a0',
          letterSpacing: '0.1em',
          marginBottom: '8px',
          fontWeight: 600
        }}>EMAIL</div>
        <div style={{
          fontSize: '20px',
          fontWeight: 600,
          color: '#ff8c42'
        }}>contact@trend-insightlab.com</div>
      </div>

      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', marginTop: '32px', color: '#ff8c42' }}>お問い合わせ内容例</h2>
      <ul style={{ paddingLeft: '24px', marginBottom: '24px', color: '#e8e8e8' }}>
        <li>記事内容に関するご質問・ご意見</li>
        <li>取材・寄稿のご依頼</li>
        <li>広告掲載のお問い合わせ</li>
        <li>その他のお問い合わせ</li>
      </ul>

      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', marginTop: '32px', color: '#ff8c42' }}>返信について</h2>
      <p style={{ color: '#e8e8e8' }}>
        いただいたお問い合わせには、内容を確認の上、3営業日以内に
        ご返信させていただきます。返信が届かない場合は、
        メールアドレスの誤入力やドメイン受信制限の可能性がございますので、
        お手数ですが再度ご連絡ください。
      </p>

      <a href="/" style={{
        display: 'inline-block',
        marginTop: '32px',
        color: '#ff8c42',
        textDecoration: 'underline'
      }}>← トップに戻る</a>
    </div>
  );
}
