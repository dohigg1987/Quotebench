import { getDatabase } from "./database.ts";

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  fromName?: string;
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendTransactionalEmail(input: EmailInput) {
  const { env } = await import("cloudflare:workers");
  if (!env.EMAIL_API_KEY) {
    return { sent: false, provider: "platform_outbox", reason: "provider_not_configured" };
  }

  const endpoint = String(env.EMAIL_API_ENDPOINT ?? "https://api.resend.com/emails");
  const fromAddress = String(env.EMAIL_FROM_ADDRESS ?? "proposals@quotebench.example");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.EMAIL_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: `${input.fromName ?? "QuoteBench"} <${fromAddress}>`,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await response.text();
  return {
    sent: response.ok,
    provider: "transactional_email",
    reason: response.ok ? null : payload.slice(0, 300),
  };
}

export async function sendProposalDelivery(
  tenantId: string,
  reference: string,
  recipient: { name: string; email: string; token: string },
  origin: string,
  message: string,
) {
  const { env } = await import("cloudflare:workers");
  const siteOrigin = origin || String(env.PUBLIC_SITE_URL ?? "https://quotebench.invalid");
  const link = `${siteOrigin}/q/${recipient.token}`;
  const brand = await (await getDatabase()).prepare("SELECT sending_name,reply_to FROM brand_profiles WHERE tenant_id=? ORDER BY is_default DESC LIMIT 1")
    .bind(tenantId)
    .first<{ sending_name: string; reply_to: string }>();

  return sendTransactionalEmail({
    to: recipient.email,
    subject: `Proposal ${reference} ready for review`,
    fromName: brand?.sending_name ?? "QuoteBench",
    replyTo: brand?.reply_to,
    text: `Hello ${recipient.name},\n\n${message}\n\nReview secure proposal ${reference}: ${link}\n\nThis link is unique to you and may be revoked by the sender.`,
    html: `<p>Hello ${escapeHtml(recipient.name)},</p><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(link)}">Review secure proposal ${escapeHtml(reference)}</a></p><p>This link is unique to you and may be revoked by the sender.</p>`,
  });
}

export async function sendAcceptanceNotifications(input: {
  reference: string;
  clientName: string;
  recipientEmail: string | null;
  ownerEmail: string;
  acceptedBy: string;
  token: string;
}) {
  const { env } = await import("cloudflare:workers");
  const origin = String(env.PUBLIC_SITE_URL ?? "https://quotebench.invalid");
  const link = `${origin}/q/${input.token}`;
  const safeReference = escapeHtml(input.reference);
  const safeClient = escapeHtml(input.clientName);
  const safeAcceptedBy = escapeHtml(input.acceptedBy);
  const safeLink = escapeHtml(link);
  const tasks = [sendTransactionalEmail({
    to: input.ownerEmail,
    subject: `${input.reference} accepted by ${input.acceptedBy}`,
    text: `${input.reference} for ${input.clientName} was accepted by ${input.acceptedBy}.\n\nOpen accepted proposal: ${link}`,
    html: `<p>${safeReference} for ${safeClient} was accepted by ${safeAcceptedBy}.</p><p><a href="${safeLink}">Open accepted proposal</a></p>`,
  })];

  if (input.recipientEmail) {
    tasks.push(sendTransactionalEmail({
      to: input.recipientEmail,
      subject: `Confirmation of acceptance for ${input.reference}`,
      text: `Thank you, ${input.acceptedBy}. Your acceptance of ${input.reference} has been recorded.\n\nOpen your accepted proposal: ${link}`,
      html: `<p>Thank you, ${safeAcceptedBy}. Your acceptance of ${safeReference} has been recorded.</p><p><a href="${safeLink}">Open accepted proposal</a></p>`,
    }));
  }
  return Promise.all(tasks);
}
