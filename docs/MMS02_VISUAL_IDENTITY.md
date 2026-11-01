# MMS-02 visual foundation

MMS owns semantic color, spacing and surface tokens, a responsive grid, visible
keyboard focus, dark mode and reduced-motion styles. Static landing, performer,
industry and audience layouts and Watch/Apply/Vote/Archive/Sponsor information
pages are available from `design/pages.mjs`. The primary navigation now resolves
to real informational views and identifies its current page. Views contain no
applicant information and do not offer live submissions, votes or payments.

Run `node --test test/*.test.mjs` on Node 22 or later. The 13 tests cover
navigation targets, page landmarks and availability messages, contrast,
GET/HEAD, rejected writes, security headers, private-route fallthrough and
ambiguous request targets. These source/HTTP tests are not a WCAG audit.

For a local read-only preview, run `node design/preview-server.mjs`; it binds
loopback only. `createPublicHandler()` can be composed before the application
shell's authenticated router. It returns false without writing a response for
unknown/private routes. The caller must then run its existing authorization
checks and default-deny unknown requests. Never treat a public role information
page as an authenticated account or industry profile.

The public handler emits only allowlisted static HTML/CSS and ignores queries.
It denies state-changing methods on public paths, refuses ambiguous targets,
disallows forms/scripts/embedding through CSP, and does not process identity,
cookies, tenant data, applications or payments.

## Remaining acceptance

The assigned branch has no application shell. The main snapshot
`c71fa6e38f3581d8408525f6851457564c213cbf` returns HTTP 404 for
`src/app.mjs`. The MMS-01 implementation remains separate in PR #6, with an
unresolved upstream identity question. Integrate this public handler with the
accepted app runtime after that dependency is available; retain private-route
authorization and add real cross-role/tenant integration checks.

Browser keyboard/mobile/a11y verification and deployment remain unverified.
Playwright launch in this activation failed with “Executable doesn't exist” for
the installed Chromium headless shell. No browser acceptance is claimed.
