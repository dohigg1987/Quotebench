"use client";

type AuthModule = typeof import("@neondatabase/auth/next");
type QuoteBenchAuthClient = ReturnType<AuthModule["createAuthClient"]>;

let instance: QuoteBenchAuthClient | undefined;

export async function getAuthClient(): Promise<QuoteBenchAuthClient> {
  if (instance) return instance;
  const { createAuthClient } = await import("@neondatabase/auth/next");
  instance = createAuthClient();
  return instance;
}
