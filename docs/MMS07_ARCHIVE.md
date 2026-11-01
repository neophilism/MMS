# MMS-07 public site and archive

## Implemented workflow

The legacy allowlisted event projection is now paired with a durable publication
service, explicit verifier boundary, public pages/API and producer management.
The publication contract is owned by MMS; it is not a claim about the unknown
Live Competition Engine wire format.

`createPublicationService` requires a durable store and a trusted
`verifyPublication` callback. Publishing requires an exact-tenant verified
producer, safe expected version and a literal `true` from the verifier.
The verifier must check current source authority, event finalization/results,
recording/live-stream rights and caption clearance in the actual upstream
system. No default verifier, client flag or synthetic test principal provides
production evidence. Verifier waits are bounded; late success cannot publish.

A publication explicitly selects result/recording/live permissions. Champions
are public only for verified completed results. Recordings are public only for
completed events with recording permission and a cleared caption URL/language.
Live links are public only for live events with live permission. Credentialed,
query-bearing, fragment-bearing and non-HTTPS media URLs are rejected.

`storage/publication-store.mjs` uses SQLite WAL/FULL and atomic version
compare-and-swap. It requires an absolute file in an existing owned private
directory and rejects unsafe linked/permissive files and unknown schemas.
Withdrawal writes a versioned tombstone and clears the stored public record.
Withdrawal before first publication blocks stale in-flight requests, and stale
versions cannot restore withdrawn content. Tenant/event keys are separate.
Lists are bounded and cursor ordered, with status filtering.

`http/publication.mjs` provides public JSON event/list reads and MMS home,
watch, archive, event, apply, vote and sponsor pages. HTML escapes titles and
names; links and media are validated. Cleared recordings include captions,
controls, no autoplay/preload and anonymous cross-origin media requests.
Navigation, skip link, visible focus, mobile grid and dark styles are included.
Apply/vote/sponsor are informational until their real services are connected;
no application, ballot, payment or sponsorship is offered here.

Producer publication management is separate, Bearer-authenticated and
same-origin. Bodies are bounded to 16 KiB with strict UTF-8 and exact fields;
identities and tenants never come from the body. Errors are sanitized; public
and private responses are no-store so withdrawals are visible on new reads.
`http/publication-server.mjs` bridges actual Node HTTP, rejects duplicate
security headers and ambiguous targets, and ignores forwarded origin claims.
It supplies no credentials, verifier, public listener or automatic deployment.

## Validation

Run `node --test test/*.test.mjs` on Node supporting `node:sqlite` (tested
24.22.1). All 18 tests passed: real HTTP live publication/withdrawal, escaped
public pages, every navigation route and HEAD, durable reopen, tenant and role
denial, source/verifier failure, rights/result gates, stalled verification,
in-flight stale publication, four-process version race, withdrawal rollback,
invalid input and private-file/schema rejection.

Repository CI currently runs source-integrity and PR registry checks, not these
product tests. Browser/mobile/screen-reader playback and actual caption/media
delivery remain unverified. No real event or earned certification is claimed.

## Remaining acceptance

Bind the accepted MMS-01 runtime/session contract and implement the verifier
against immutable upstream published-event/finalized-result/rights/caption
sources. Actual stream accounts/assets, rights approvals, corrected caption
delivery and production event rehearsal are external acceptance dependencies.
The local modules and synthetic test adapters cannot substitute for them.
Keep PR #12 draft until those integrations and real-browser checks pass.
