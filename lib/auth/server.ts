import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

let instance: NeonAuth | null | undefined;

export function getAuth(): NeonAuth | null {
  if (instance !== undefined) return instance;

  const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
  const secret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();
  if (!baseUrl || !secret || secret.length < 32) {
    instance = null;
    return instance;
  }

  instance = createNeonAuth({
    baseUrl,
    cookies: {
      secret,
      sessionDataTtl: 300,
    },
    logLevel: process.env.NODE_ENV === "production" ? "warn" : "info",
  });
  return instance;
}

export function requireAuthConfiguration(): NeonAuth {
  const auth = getAuth();
  if (!auth) {
    throw new Error(
      "Neon Auth is not configured. Set NEON_AUTH_BASE_URL and a 32+ character NEON_AUTH_COOKIE_SECRET.",
    );
  }
  return auth;
}
