import QuoteBench, { type Screen } from "./quote-bench";
import { signInPath, getCurrentUser } from "./auth";
import { hasOperatorAccess } from "../db/workspace-store";
import { QuoteBenchLogo } from "./ui/brand";

export const dynamic = "force-dynamic";

const screens = new Set<Screen>(["builder", "quotes", "clients", "catalogue", "rules", "activity", "integrations", "team", "usage", "documents", "delivery", "templates", "billing", "governance", "engagement", "ai"]);

export default async function Home({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  const requestedScreen = (await searchParams).screen;
  const initialScreen = requestedScreen && screens.has(requestedScreen as Screen) ? requestedScreen as Screen : "builder";
  const returnTo = initialScreen === "builder" ? "/" : `/?screen=${initialScreen}`;
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="signin-shell">
        <section className="signin-panel">
          <QuoteBenchLogo className="signin-logo" />
          <p className="eyebrow">Governed commercial workspace</p>
          <h1>Sign in to QuoteBench</h1>
          <p>Operator access requires an authenticated QuoteBench account. Recipient proposals use separate, tokenised links.</p>
          <a className="button primary" href={signInPath(returnTo)}>Sign in to QuoteBench</a>
          <small>Pricing, quote records and audit evidence remain tenant-scoped.</small>
        </section>
      </main>
    );
  }
  return <QuoteBench currentUser={user} operatorAccess={await hasOperatorAccess(user)} initialScreen={initialScreen} />;
}
