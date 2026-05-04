"use client";

import { useState, useEffect, useCallback } from "react";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "";
const OWNER = process.env.NEXT_PUBLIC_GITHUB_OWNER ?? "Ringo36";
const REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? "basketball-insight-lab";

export default function AdminPage() {
  const [step, setStep] = useState("login"); // "login" | "panel"
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [loginError, setLoginError] = useState("");
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState({ text: "", ok: true });

  const handleLogin = (e) => {
    e.preventDefault();
    if (!password || !token) {
      setLoginError("パスワードとGitHubトークンを両方入力してください");
      return;
    }
    if (password !== ADMIN_PASSWORD) {
      setLoginError("パスワードが正しくありません");
      return;
    }
    setLoginError("");
    setStep("panel");
  };

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setMessage({ text: "", ok: true });
    try {
      const res = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/content`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status === 401) throw new Error("GitHubトークンが無効です");
      if (!res.ok) throw new Error(`取得失敗: ${res.status}`);
      const data = await res.json();
      const files = Array.isArray(data)
        ? data
            .filter((f) => f.name.endsWith(".md"))
            .sort((a, b) => b.name.localeCompare(a.name))
        : [];
      setArticles(files);
    } catch (e) {
      setMessage({ text: `❌ ${e.message}`, ok: false });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (step === "panel") fetchArticles();
  }, [step, fetchArticles]);

  const handleDelete = async (article) => {
    if (
      !confirm(
        `「${article.name}」を削除しますか？\nこの操作は元に戻せません。`
      )
    )
      return;

    setDeleting(article.sha);
    setMessage({ text: "", ok: true });
    try {
      const res = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${article.path}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `delete: ${article.name}`,
            sha: article.sha,
          }),
        }
      );
      if (res.status === 401) throw new Error("GitHubトークンが無効です");
      if (!res.ok) throw new Error(`削除失敗: ${res.status}`);
      setMessage({
        text: `✅ ${article.name} を削除しました（Vercelが自動再デプロイします）`,
        ok: true,
      });
      setArticles((prev) => prev.filter((a) => a.sha !== article.sha));
    } catch (e) {
      setMessage({ text: `❌ ${e.message}`, ok: false });
    } finally {
      setDeleting(null);
    }
  };

  // ── ログイン画面 ────────────────────────────
  if (step === "login") {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1 style={styles.h1}>🏀 管理者ログイン</h1>
          <form onSubmit={handleLogin} style={styles.form}>
            <label style={styles.label}>パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="管理者パスワード"
              style={styles.input}
              autoFocus
            />
            <label style={styles.label}>
              GitHub Token
              <span style={styles.hint}>（Contents: read & write 権限が必要）</span>
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              style={styles.input}
            />
            {loginError && <p style={styles.error}>{loginError}</p>}
            <button type="submit" style={styles.btnPrimary}>
              ログイン
            </button>
          </form>
          <p style={styles.note}>
            ※ GitHubトークンはこの画面にのみ保存されます。
            <br />
            ページを閉じると破棄されます。
          </p>
        </div>
      </div>
    );
  }

  // ── 管理パネル ────────────────────────────
  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <h1 style={styles.h1}>🏀 記事管理パネル</h1>
        <div style={styles.headerRight}>
          <span style={styles.repoLabel}>
            {OWNER}/{REPO}
          </span>
          <button
            onClick={fetchArticles}
            disabled={loading}
            style={styles.btnSecondary}
          >
            {loading ? "読込中..." : "更新"}
          </button>
          <button
            onClick={() => {
              setStep("login");
              setToken("");
              setArticles([]);
            }}
            style={styles.btnLogout}
          >
            ログアウト
          </button>
        </div>
      </div>

      {message.text && (
        <div style={{ ...styles.message, background: message.ok ? "#14532d" : "#7f1d1d" }}>
          {message.text}
        </div>
      )}

      {loading && <p style={styles.loadingText}>記事を読み込み中...</p>}

      {!loading && articles.length === 0 && (
        <p style={styles.emptyText}>記事が見つかりません</p>
      )}

      <div style={styles.list}>
        {articles.map((article) => (
          <div key={article.sha} style={styles.row}>
            <div style={styles.rowInfo}>
              <span style={styles.filename}>{article.name}</span>
              <a
                href={`/articles/${article.name.replace(".md", "")}/`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.viewLink}
              >
                記事を見る →
              </a>
            </div>
            <button
              onClick={() => handleDelete(article)}
              disabled={deleting === article.sha}
              style={{
                ...styles.btnDelete,
                opacity: deleting === article.sha ? 0.5 : 1,
              }}
            >
              {deleting === article.sha ? "削除中..." : "削除"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  center: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0d0d0d",
    padding: "20px",
  },
  card: {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "12px",
    padding: "40px",
    width: "100%",
    maxWidth: "440px",
  },
  h1: {
    color: "#f97316",
    fontSize: "1.5rem",
    marginBottom: "24px",
    fontWeight: "700",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    color: "#ccc",
    fontSize: "0.85rem",
    marginTop: "8px",
  },
  hint: {
    color: "#666",
    fontSize: "0.75rem",
    marginLeft: "8px",
  },
  input: {
    background: "#111",
    border: "1px solid #444",
    borderRadius: "6px",
    color: "#fff",
    padding: "10px 14px",
    fontSize: "0.95rem",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  error: {
    color: "#f87171",
    fontSize: "0.85rem",
    margin: "4px 0",
  },
  btnPrimary: {
    marginTop: "16px",
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "12px",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
  },
  note: {
    color: "#666",
    fontSize: "0.75rem",
    marginTop: "20px",
    lineHeight: "1.6",
  },
  panel: {
    minHeight: "100vh",
    background: "#0d0d0d",
    padding: "32px 24px",
    maxWidth: "900px",
    margin: "0 auto",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "24px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  repoLabel: {
    color: "#666",
    fontSize: "0.8rem",
    fontFamily: "monospace",
  },
  btnSecondary: {
    background: "#1a1a1a",
    color: "#ccc",
    border: "1px solid #444",
    borderRadius: "6px",
    padding: "8px 16px",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  btnLogout: {
    background: "transparent",
    color: "#666",
    border: "1px solid #333",
    borderRadius: "6px",
    padding: "8px 16px",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  message: {
    color: "#fff",
    borderRadius: "8px",
    padding: "12px 16px",
    marginBottom: "20px",
    fontSize: "0.9rem",
  },
  loadingText: {
    color: "#888",
    textAlign: "center",
    padding: "40px",
  },
  emptyText: {
    color: "#666",
    textAlign: "center",
    padding: "40px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "8px",
    padding: "14px 16px",
    gap: "12px",
  },
  rowInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  filename: {
    color: "#eee",
    fontSize: "0.9rem",
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  viewLink: {
    color: "#f97316",
    fontSize: "0.75rem",
    textDecoration: "none",
  },
  btnDelete: {
    flexShrink: 0,
    background: "#7f1d1d",
    color: "#fca5a5",
    border: "1px solid #991b1b",
    borderRadius: "6px",
    padding: "8px 16px",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
