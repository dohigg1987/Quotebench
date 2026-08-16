# Production runbook

## Service boundaries

QuoteBench runs as a Cloudflare Worker with Neon Postgres through Hyperdrive, R2 object storage, a Queue-backed PDF consumer and Neon Auth. Transactional email and Stripe are optional external providers activated only through production secrets. The public recipient surface is token-authenticated; operator and workspace surfaces require authenticated identity and role checks.

## Service indicators

- Availability: successful `GET /api/health` responses.
- Correctness: quote pricing, issue, view, acceptance and PDF-generation success rates.
- Latency: p95 request duration for authenticated APIs and public proposal views.
- Delivery: transactional-email acceptance and webhook retry backlog.
- Durability: successful Neon recovery point and R2 inventory verification.

## Alert thresholds

Create an urgent alert for any of the following:

- health endpoint returns 503 for two consecutive five-minute checks;
- five-minute server-error rate exceeds 2 percent;
- p95 authenticated API latency exceeds two seconds for fifteen minutes;
- any tenant-boundary denial spike exceeds ten events per tenant in five minutes;
- webhook retry queue has an item older than thirty minutes;
- email bounce or complaint rate exceeds provider limits;
- backup or restore verification misses its scheduled window.

## Initial triage

1. Record the incident start time and appoint an incident lead.
2. Review worker errors by request identifier, route, status and deployment version.
3. Check Neon, Hyperdrive, R2 and Queue health separately from email and billing providers.
4. If a release caused the incident, stop further releases and redeploy the last verified version.
5. If confidentiality or tenant isolation may be affected, disable the relevant route or integration and follow the incident-response procedure.
6. Preserve logs and decision records. Do not paste customer content into public tickets.

## Common failure modes

### Email provider unavailable

Proposal links remain queued and may be copied manually by an authorised workspace member. Do not mark a message delivered unless the provider accepted it. Resume queued delivery after the provider recovers.

### Billing provider unavailable

Existing entitlements remain authoritative. Disable new checkout initiation, retain webhook events and reconcile subscription state when Stripe recovers.

### Neon or Hyperdrive degraded

Stop write traffic if inconsistent results are observed. Validate the last known Neon recovery point and choose restore, branch recovery or roll-forward according to the backup procedure.

### R2 degraded

Keep quote records available but disable new uploads and PDF generation. Never replace missing objects with a successful empty response.

## Change and rollback

Every production change must have a pull request, green required checks, a recorded deployment version and a rollback candidate. Rollback is complete only after the health endpoint, authenticated workspace shell and tokenised recipient route are verified.
