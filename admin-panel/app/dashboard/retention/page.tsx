"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type RetentionStatus } from "@/lib/api";

export default function RetentionPage() {
  const { idToken } = useAuth();
  const [data, setData] = useState<RetentionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await idToken();
      if (!token) return;
      try { setData(await api.retention(token)); } catch (e) { setError(e instanceof ApiError ? e.message : "Could not load retention status."); }
    })();
  }, [idToken]);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Retention</h1>
      <p className="muted">
        Chats are kept for {data?.policy.days ?? 7} days and then removed automatically. This is mandatory on every plan and read-only here.
      </p>
      {error && <p className="error-text">{error}</p>}
      {data && (
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Cleanup queue right now</h3>
            <p>Messages past their expiry, not yet purged: <strong>{data.expiredButNotYetPurged.messages}</strong></p>
            <p>Conversations past their expiry, not yet purged: <strong>{data.expiredButNotYetPurged.conversations}</strong></p>
            <p>Messages with no expiry set (should be 0): <strong>{data.messagesMissingExpiry}</strong></p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Database TTL indexes</h3>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: 0 }}>{JSON.stringify(data.ttlIndexes, null, 2)}</pre>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Last cleanup run</h3>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: 0 }}>{JSON.stringify(data.lastCleanup, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
