import { redirect } from "next/navigation";
import { getAuth } from "../lib/auth/server";

export type QuoteBenchUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const SIGN_IN_PATH = "/auth/sign-in";
const SIGN_OUT_PATH = "/auth/sign-out";

export async function getCurrentUser(): Promise<QuoteBenchUser | null> {
  const auth = getAuth();
  if (!auth) return null;

  const { data: session } = await auth.getSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!session?.user || !email) return null;

  const fullName = session.user.name?.trim() || null;
  return {
    id: session.user.id,
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

export async function requireCurrentUser(
  returnTo: string,
): Promise<QuoteBenchUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(signInPath(returnTo));
}

export function signInPath(returnTo: string): string {
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function signOutPath(returnTo = "/"): string {
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function safeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const url = new URL(value, "https://app.quotebench.local");
    if (url.origin !== "https://app.quotebench.local") return "/";
    if (url.pathname.startsWith("/auth/")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
