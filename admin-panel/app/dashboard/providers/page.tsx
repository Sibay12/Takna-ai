"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type AiProvider } from "@/lib/api";

const TYPES = [
  { value: "gemini", label: "Google Gemini" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI" },
];

type FormState = {
  type: string;
  displayName: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  isDefault: boolean;
};

const emptyForm: FormState = { type: "gemini", displayName: "", model: "", apiKey: "", enabled: true, isDefault: false };

export default function ProvidersPage() {
  const { idToken, me } = useAuth();
  const isSuperAdmin = me?.role === "SUPER_ADMIN";
  const [providers, setProviders] = useState<AiProvider[] | null>(null);
  const [keyStorageConfigured, setKeyStorageConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // provider id, or "new"
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const load = async () => {
    const token = await idToken();
    if (!token) return;
    try {
      const r = await api.providers(token);
      setProviders(r.providers);
      setKeyStorageConfigured(r.keyStorageConfigured);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load AI providers.");
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startNew = () => { setForm(emptyForm); setEditing("new"); };
  const startEdit = (p: AiProvider) => {
    setForm({ type: p.type, displayName: p.displayName, model: p.model, apiKey: "", enabled: p.enabled, isDefault: p.isDefault });
    setEditing(p.id);
  };

  const save = async () => {
    const token = await idToken();
    if (!token || !editing) return;
    setSaving(true);
    setError(null);
    try {
      if (editing === "new") {
        if (!form.apiKey) throw new ApiError(400, "validation_error", "An API key is required for a new connection.");
        await api.createProvider(token, { ...form });
      } else {
        const body: Record<string, unknown> = {
          displayName: form.displayName,
          model: form.model,
          enabled: form.enabled,
          isDefault: form.isDefault,
        };
        if (form.apiKey) body.apiKey = form.apiKey; // only sent when the admin actually typed a new one
        await api.updateProvider(token, editing, body);
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save this AI connection.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: AiProvider) => {
    if (!confirm(`Delete "${p.displayName}"? Chats will stop using it immediately.`)) return;
    const token = await idToken();
    if (!token) return;
    try { await api.deleteProvider(token, p.id); await load(); } catch (e) { alert(e instanceof ApiError ? e.message : "Could not delete."); }
  };

  const test = async (p: AiProvider) => {
    const token = await idToken();
    if (!token) return;
    setTestResult((s) => ({ ...s, [p.id]: "Testing…" }));
    try {
      const r = await api.testProvider(token, p.id);
      setTestResult((s) => ({ ...s, [p.id]: r.connection.ok ? "Connected" : `Failed: ${r.connection.error ?? "error"}` }));
    } catch (e) {
      setTestResult((s) => ({ ...s, [p.id]: e instanceof ApiError ? e.message : "Test failed." }));
    }
  };

  if (!isSuperAdmin) {
    return (
      <div>
        <h1 style={{ marginTop: 0 }}>AI providers</h1>
        <p className="error-text">Only a super admin can view or change AI provider keys.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginTop: 0 }}>AI providers</h1>
        <button className="btn" onClick={startNew}>Add connection</button>
      </div>
      <p className="muted">
        The name you set here as <strong>Display name</strong> is what every customer sees in the app. Replies never reveal which
        AI company actually answered — only "TAKNA AI" is shown to customers.
      </p>
      {!keyStorageConfigured && (
        <p className="error-text">
          Key storage is not set up on the server yet (KEY_ENCRYPTION_SECRET is missing on Render). Keys cannot be saved until that is set.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}

      {editing && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>{editing === "new" ? "Add AI connection" : "Edit AI connection"}</h3>
          <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <div>
              <label className="muted">AI vendor</label>
              <select
                value={form.type}
                disabled={editing !== "new"}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                style={{ marginTop: 6 }}
              >
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="muted">Display name (shown to customers)</label>
              <input
                type="text" value={form.displayName} placeholder="e.g. TAKNA Smart"
                onChange={(e) => setForm({ ...form, displayName: e.target.value })} style={{ marginTop: 6 }}
              />
            </div>
            <div>
              <label className="muted">Model id</label>
              <input
                type="text" value={form.model} placeholder="e.g. gemini-flash-latest"
                onChange={(e) => setForm({ ...form, model: e.target.value })} style={{ marginTop: 6 }}
              />
            </div>
            <div>
              <label className="muted">
                {editing === "new" ? "API key" : "New API key (leave blank to keep the current one)"}
              </label>
              <input
                type="password" value={form.apiKey} placeholder={editing === "new" ? "" : "••••••••"}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })} style={{ marginTop: 6 }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              Enabled
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
              Default (used when the app doesn&apos;t ask for a specific model)
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
              <button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {!providers ? (
        <p className="muted">Loading…</p>
      ) : providers.length === 0 ? (
        <p className="muted">No AI connections yet. Add one above.</p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr><th>Display name</th><th>Vendor</th><th>Model</th><th>Key</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id}>
                  <td>{p.displayName}{p.isDefault && <span className="badge ok" style={{ marginLeft: 8 }}>default</span>}</td>
                  <td className="muted">{p.type}</td>
                  <td className="muted">{p.model}</td>
                  <td className="muted">{p.keyHint}</td>
                  <td><span className={`badge ${p.enabled ? "ok" : "bad"}`}>{p.enabled ? "enabled" : "disabled"}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button className="btn secondary" onClick={() => startEdit(p)}>Edit</button>
                      <button className="btn secondary" onClick={() => test(p)}>Test</button>
                      <button className="btn danger" onClick={() => remove(p)}>Delete</button>
                    </div>
                    {testResult[p.id] && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{testResult[p.id]}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
