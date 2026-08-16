# Threat model

## Protected assets

Customer and recipient identity, proposal content, service pricing, margin assumptions, tenant configuration, API credentials, recipient tokens, stored files, acceptance evidence and audit records.

## Trust boundaries

- browser to public Worker;
- authenticated Neon Auth session to workspace membership and role enforcement;
- recipient token to a single proposal and recipient record;
- Worker through Hyperdrive to Neon Postgres, and to R2;
- Worker to transactional email, Stripe and customer webhook endpoints;
- build pipeline to production deployment.

## Principal threats and controls

| Threat | Primary controls | Residual action |
|---|---|---|
| Cross-tenant access | server-derived tenant context, membership checks, tenant predicates | maintain integration tests for every resource |
| Recipient-link guessing or leakage | 256-bit token material, hashes in rate-limit/evidence records, revocation | advise recipients not to forward links |
| Pricing manipulation | branded integer money types, server pricing engine, snapshots, role discount caps | expand property and boundary tests |
| Stored or reflected injection | React escaping, HTML-email escaping, CSP, bounded inputs | independent ASVS verification |
| CSRF | same-origin enforcement for unsafe API methods | test all exemptions on each release |
| SSRF through webhooks | public HTTPS validation, blocked private/reserved literals, no redirect following | route outbound webhooks through controlled egress for DNS-level enforcement at scale |
| Acceptance race or repudiation | conditional state transition, evidence certificate, token/IP hashes, snapshot hash | obtain jurisdiction-specific e-signature review |
| Dependency compromise | lockfile, production audit, Dependabot, CodeQL | add provenance and SBOM attestation |
| Data loss | Neon recovery/PITR, environment branches, R2 inventory, export, compatible migrations | complete restore drills |
| Operator misuse | hashed operator allowlist, audit events, least privilege | separate duties as the team grows |

## Review triggers

Review this model after authentication changes, new integrations, storage changes, new public routes, changes to acceptance evidence, or a material incident.
