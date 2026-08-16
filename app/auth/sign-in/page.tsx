import { QuoteBenchLogo } from "../../ui/brand";
import { getCurrentUser, safeReturnPath } from "../../auth";
import { redirect } from "next/navigation";
import AuthForm from "./auth-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).return_to ?? "/");
  if (await getCurrentUser()) redirect(returnTo);

  return (
    <main className="signin-shell">
      <section className="signin-panel auth-panel">
        <QuoteBenchLogo className="signin-logo" />
        <p className="eyebrow">Secure customer workspace</p>
        <h1>Welcome to QuoteBench</h1>
        <p>Use your business email to access your organisation’s pricing, proposals and approvals.</p>
        <AuthForm returnTo={returnTo} />
        <small>Authentication is isolated from proposal recipient links. Workspace access remains tenant-scoped and role controlled.</small>
      </section>
    </main>
  );
}
