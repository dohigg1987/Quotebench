"use client";

import { createAuthClient } from "@neondatabase/auth/next";

type QuoteBenchAuthClient = ReturnType<typeof createAuthClient>;

let instance: QuoteBenchAuthClient | undefined;

export function getAuthClient(): QuoteBenchAuthClient {
  instance ??= createAuthClient();
  return instance;
}
