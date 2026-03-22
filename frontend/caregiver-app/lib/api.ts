import type { UserProfile, UserProfileCreate, RiskScore, ActionPlan } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createUser: (body: UserProfileCreate) =>
    request<UserProfile>("/users", { method: "POST", body: JSON.stringify(body) }),

  getScore: (userId: string) =>
    request<RiskScore>(`/scores/${userId}`),

  getPlan: (userId: string) =>
    request<ActionPlan>(`/plans/${userId}`),

  triggerWelfareCheck: (userId: string) =>
    request("/welfare/check", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, trigger_reason: "manual" }),
    }),
};
