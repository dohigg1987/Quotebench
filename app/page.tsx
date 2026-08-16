import QuoteBench from "./quote-bench";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { hasOperatorAccess } from "../db/workspace-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) {
    return (
      <main className="signin-shell">
        <section className="signin-panel">
          <span className="signin-mark">Q</span>
          <p className="eyebrow">Governed commercial workspace</p>
          <h1>Sign in to QuoteBench</h1>
          <p>Operator access requires an authenticated ChatGPT identity. Recipient proposals use separate, tokenised links.</p>
          <a className="button primary" href={chatGPTSignInPath("/")}>Sign in with ChatGPT</a>
          <small>Pricing, quote records and audit evidence remain tenant-scoped.</small>
        </section>
      </main>
    );
  }
  return <QuoteBench currentUser={user} operatorAccess={await hasOperatorAccess(user)} />;
}
