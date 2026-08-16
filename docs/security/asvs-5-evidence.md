# OWASP ASVS 5 evidence register

QuoteBench targets ASVS Level 2 for the web application. This register is an engineering evidence index, not an independent certification.

| Control area | Evidence | Status |
|---|---|---|
| Encoding and sanitisation | React rendering, `escapeHtml`, input limits | implemented and tested |
| Validation and business logic | pricing engine, role caps, proposal-state guards | implemented and tested |
| Web frontend security | CSP, HSTS, frame denial, MIME and referrer headers | implemented; inline framework bootstrap remains permitted until nonce support is available |
| API security | identity, membership, role and API-key scope checks | implemented, integration coverage required |
| File handling | type and size allowlists, tenant R2 prefixes, expiry | implemented, malware scanning required before high-risk uploads |
| Authentication | Sign in with ChatGPT platform boundary | inherited plus workspace membership checks |
| Session management | platform-managed | obtain platform assurance evidence |
| Authorisation | owner, admin and quoter checks; operator allowlist | implemented, tenant attack tests required |
| Token security | high-entropy recipient tokens and hashing in secondary records | implemented and tested |
| OAuth/OIDC | platform-managed Sign in with ChatGPT | obtain platform assurance evidence |
| Cryptography | Web Crypto SHA-256 and HMAC; TLS transport | implemented, key-management review required |
| Secure communication | HTTPS and HSTS | implemented |
| Configuration | runtime secrets, safe failure, environment register | production values still require operator configuration |
| Data protection | tenant scoping, retention, export and purge | implemented, DPIA and restore evidence required |
| Secure coding and architecture | threat model, type checking, CodeQL, dependency audit | implemented in CI |
| Security logging | request IDs, security events, delivery history | implemented, alert integration required |
| WebRTC | not used | not applicable |

The release cannot claim ASVS conformance until all required items are mapped to versioned ASVS identifiers and independently verified.
