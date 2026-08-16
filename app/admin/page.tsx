import { signInPath, getCurrentUser } from "../auth";
import { hasOperatorAccess } from "../../db/workspace-store";
import OperatorScreen from "../operator-screen";
import Link from "next/link";
import { QuoteBenchLogo, QuoteBenchMark } from "../ui/brand";

export const dynamic = "force-dynamic";

export default async function PlatformAdminPage() {
  const user = await getCurrentUser();
  if (!user) return <main className="signin-shell"><section className="signin-panel"><QuoteBenchLogo className="signin-logo" /><p className="eyebrow">Restricted platform control plane</p><h1>Operator sign-in required</h1><p>Customer administration requires an authenticated and explicitly authorised operator identity.</p><a className="button primary" href={signInPath("/admin")}>Sign in to QuoteBench</a></section></main>;
  if (!await hasOperatorAccess(user)) return <main className="signin-shell"><section className="signin-panel"><span className="signin-mark">!</span><p className="eyebrow">Access denied</p><h1>Operator authority required</h1><p>This identity is authenticated but is not authorised to access cross-customer administration.</p><Link className="button secondary" href="/">Return to workspace</Link></section></main>;
  return <main className="admin-shell"><header className="admin-topbar"><Link className="admin-brand" href="/"><QuoteBenchMark /><strong>QuoteBench</strong></Link><div><span>Platform administration</span><Link href="/">Customer workspace</Link><a href="/auth/sign-out?return_to=%2F">Sign out</a></div></header><OperatorScreen /></main>;
}
