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
      color: '#1a1a2e'
    }}>
      <h1 style={{
        fontSize: '32px',
        fontWeight: 700,
        marginBottom: '32px',
        color: '#0a2540'
      }}>お問い合わせ</h1>

      <p style={{ marginBottom: '24px' }}>
        Basketball Insight Labへのご意見・ご感想・取材依頼などは、
        以下のメールアドレスまでお気軽にお問い合わせください。
      </p>

      <div style={{
        padding: '32px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #e8e8e4',
        borderRadius: '4px',
        marginBottom: '32px'
      }}>
        <div style={{
          fontSize: '12px',
          color: '#5a5a6e',
          letterSpacing: '0.1em',
          marginBottom: '8px',
          fontWeight: 600
        }}>EMAIL</div>
        <div style={{
          fontSize: '20px',
          fontWeight: 600,
          color: '#0a2540'
        }}>contact@trend-insightlab.com</div>
      </div>

      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', marginTop: '32px' }}>お問い合わせ内容例</h2>
      <ul style={{ paddingLeft: '24px', marginBottom: '24px' }}>
        <li>記事内容に関するご質問・ご意見</li>
        <li>取材・寄稿のご依頼</li>
        <li>広告掲載のお問い合わせ</li>
        <li>その他のお問い合わせ</li>
      </ul>

      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', marginTop: '32px' }}>返信について</h2>
      <p>
        いただいたお問い合わせには、内容を確認の上、3営業日以内に
        ご返信させていただきます。返信が届かない場合は、
        メールアドレスの誤入力やドメイン受信制限の可能性がございますので、
        お手数ですが再度ご連絡ください。
      </p>

      <a href="/" style={{
        display: 'inline-block',
        marginTop: '32px',
        color: '#0a2540',
        textDecoration: 'underline'
      }}>← トップに戻る</a>
    </div>
  );
}
