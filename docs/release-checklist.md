# Production release checklist

- [ ] Pull request approved by a code owner.
- [ ] Type checking, lint, tests, production build and production dependency audit pass.
- [ ] CodeQL has no unresolved high or critical result.
- [ ] Database migrations reviewed and applied to a recovery-tested copy.
- [ ] No secret or restricted specification material is included.
- [ ] Email, billing, operator and public-origin configuration smoke tests pass where enabled.
- [ ] Tenant-isolation, recipient decision and PDF regression tests pass.
- [ ] WCAG automated checks pass and keyboard/assistive-technology spot checks are recorded.
- [ ] Deployment succeeds and live health, sign-in, proposal and rollback checks pass.
- [ ] Release version, approver, deployment time and rollback version are recorded.

Real-customer launch additionally requires completed controller details, privacy documentation, subprocessor approval, restore drill, alert routing and an independent security review.
