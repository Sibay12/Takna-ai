const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = json?.error ?? {};
    throw new ApiError(res.status, err.code ?? `http_${res.status}`, err.message ?? "Something went wrong.");
  }
  return json as T;
}

// ---- types mirrored from the backend (docs/API.md) ----
export interface MeUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: "USER" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN";
  status: "active" | "suspended";
  emailVerified: boolean;
  createdAt: string;
}
export interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: "USER" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN";
  status: "active" | "suspended";
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}
export interface AiProvider {
  id: string;
  type: "gemini" | "anthropic" | "openai";
  displayName: string;
  model: string;
  keyHint: string;
  enabled: boolean;
  isDefault: boolean;
  updatedAt: string;
}
export interface RetentionStatus {
  policy: { days: number; mandatory: boolean; appliesTo: string; adjustable: boolean };
  ttlIndexes: Record<string, unknown>;
  expiredButNotYetPurged: { messages: number; conversations: number };
  messagesMissingExpiry: number;
  lastCleanup: unknown;
}

export const api = {
  me: (token: string) => call<{ user: MeUser }>("GET", "/me", token),

  users: (token: string, page = 1, search = "") =>
    call<{ total: number; page: number; pageSize: number; users: AdminUser[] }>(
      "GET",
      `/admin/users?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      token,
    ),
  setUserStatus: (token: string, uid: string, status: "active" | "suspended") =>
    call<{ uid: string; status: string }>("PATCH", `/admin/users/${uid}/status`, token, { status }),

  retention: (token: string) => call<RetentionStatus>("GET", "/admin/retention", token),

  providers: (token: string) => call<{ keyStorageConfigured: boolean; providers: AiProvider[] }>("GET", "/admin/ai/providers", token),
  createProvider: (
    token: string,
    body: { type: string; displayName: string; model: string; apiKey: string; enabled: boolean; isDefault: boolean },
  ) => call<{ provider: AiProvider }>("POST", "/admin/ai/providers", token, body),
  updateProvider: (
    token: string,
    id: string,
    body: Partial<{ displayName: string; model: string; apiKey: string; enabled: boolean; isDefault: boolean }>,
  ) => call<{ provider: AiProvider }>("PATCH", `/admin/ai/providers/${id}`, token, body),
  deleteProvider: (token: string, id: string) => call<{ id: string; deleted: boolean }>("DELETE", `/admin/ai/providers/${id}`, token),
  testProvider: (token: string, id: string) =>
    call<{ connection: { ok: boolean; error?: string }; availableModels: string[] | null }>(
      "POST",
      `/admin/ai/providers/${id}/test`,
      token,
    ),
};
