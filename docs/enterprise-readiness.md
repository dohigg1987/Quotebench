# Enterprise readiness

QuoteBench applies enterprise controls at the product, tenant, data and deployment boundaries.

## Implemented controls

- Neon Auth email/password authentication, with explicit tenant membership and owner, admin and quoter authorisation on every internal API boundary. Platform-operator access additionally requires a SHA-256 email digest supplied through `OPERATOR_EMAIL_SHA256`, so no personal operator identifier is committed to source.
- User-selectable workspaces, isolated tenant creation and server-derived tenant context. Client-supplied tenant identifiers cannot grant access.
- Tenant-scoped Neon Postgres records through Hyperdrive, R2 object prefixes, pricing snapshots, recipient tokens, API keys and webhook endpoints.
- High-entropy recipient links, revocation, scanner suppression, qualified-view rules, possible-forward signals and workspace-level engagement tracking choice.
- Recipient event export and deletion, owner-controlled workspace soft deletion, a 30-day recovery window and scheduled physical purge of Postgres records and R2 objects.
- API keys stored as SHA-256 hashes, explicit read scopes, revocation, access logs and a 100 requests per minute per-key limit.
- HMAC-signed webhooks with bounded delivery, exponential retry and automatic endpoint disablement after 24 hours of continuous failure.
- Browser security headers, request identifiers, private API cache policy, public health reporting and bounded external calls.
- Plain-text and HTML transactional messages, idempotent metering events, atomic deal-code claims and immutable acceptance evidence.
- Reusable multi-page proposal templates with cover, standard, wide and letter formats, structured content blocks, governed pricing blocks and per-proposal composition.
- Versioned compatibility changes, deterministic pricing tests, enterprise-control conformance tests, rendered-output checks and GitHub CI.

## Platform boundaries

Authentication uses managed Neon Auth sessions through a same-origin proxy. Neon controls primary credentials and recovery, while QuoteBench controls tenant membership, roles and the independent platform-operator allowlist after authentication.

Email delivery and subscription checkout require deployment secrets for the selected providers. The application fails safely when a provider is not configured and retains delivery or billing state for operator action.

The supplied specification packs and fixture files are intentionally excluded from the public repository as directed. Conformance tests use source and behavioural assertions without publishing those restricted inputs.

## Operational release gates

Before processing real customer data, the operator must configure production email, billing and platform-operator values, verify a sending domain, confirm data-processing terms, run a restore exercise and connect alerting to the health endpoint and provider dashboards.
