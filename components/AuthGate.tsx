"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.loadingText}>Opening T&amp;T Tools Business App…</div>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main style={styles.page}>
        <form style={styles.card} onSubmit={signIn}>
          <div style={styles.brand}>T&amp;T Tools</div>
          <h1 style={styles.title}>Business App Login</h1>
          <p style={styles.subtitle}>
            Use the same email and password on mobile and computer.
          </p>

          <label style={styles.label}>
            Email
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {message ? <p style={styles.error}>{message}</p> : null}

          <button style={styles.button} type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    padding: "18px",
    background: "#eef3f8",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "min(390px, 100%)",
    padding: "24px",
    border: "1px solid #d7dee8",
    borderRadius: "16px",
    background: "#ffffff",
    boxShadow: "0 14px 36px rgba(15, 23, 42, 0.10)",
  },
  brand: {
    color: "#8d0000",
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "7px 0 5px",
    color: "#111827",
    fontSize: "25px",
    lineHeight: 1.1,
  },
  subtitle: {
    margin: "0 0 18px",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  label: {
    display: "grid",
    gap: "5px",
    marginTop: "12px",
    color: "#374151",
    fontSize: "12px",
    fontWeight: 700,
  },
  input: {
    width: "100%",
    height: "42px",
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    padding: "0 11px",
    color: "#111827",
    background: "#ffffff",
    fontSize: "14px",
    outline: "none",
  },
  error: {
    margin: "12px 0 0",
    color: "#b91c1c",
    fontSize: "12px",
    fontWeight: 700,
  },
  button: {
    width: "100%",
    minHeight: "43px",
    marginTop: "16px",
    border: 0,
    borderRadius: "9px",
    background: "#8d0000",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  loadingText: {
    color: "#374151",
    fontSize: "14px",
    fontWeight: 700,
    textAlign: "center",
  },
};
