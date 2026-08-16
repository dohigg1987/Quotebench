import process from "node:process";

const [kind, url] = process.argv.slice(2);
if (!kind || !["approval", "incident", "monitor", "recovery"].includes(kind)) throw new Error("Alert kind must be approval, incident, monitor or recovery.");
const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM;
const to = process.env.ALERT_WHATSAPP_TO;
if (!sid || !token || !from || !to) {
  console.log("WhatsApp alert skipped because optional Twilio secrets are not configured.");
  process.exit(0);
}
if (kind === "approval" && (!url || !/^https:\/\/github\.com\//.test(url))) throw new Error("Approval alerts require a GitHub HTTPS URL.");
const body = kind === "approval"
  ? `QuoteBench production promotion is awaiting your approval. The approval action is available only while this GitHub run is pending: ${url}`
  : kind === "incident"
    ? "QuoteBench release assurance failed and automated rollback did not restore a healthy service. Open GitHub Actions now. No customer data is included in this message."
    : kind === "monitor"
      ? "QuoteBench production monitoring detected an unhealthy service. Open the GitHub Actions production monitor now. No customer data is included in this message."
    : "QuoteBench automated rollback restored the last known healthy Worker version. Review the failed GitHub Actions run before retrying.";
const form = new URLSearchParams({ From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`, To: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`, Body: body });
const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
  method: "POST",
  headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
  body: form,
});
if (!response.ok) throw new Error(`WhatsApp alert failed with status ${response.status}.`);
console.log(`WhatsApp ${kind} alert sent without tenant or customer data.`);
