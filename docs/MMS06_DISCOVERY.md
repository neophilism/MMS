# MMS-06 industry discovery

## Privacy and authorization boundary

Only server-verified industry principals with exact tenant membership and
`industryVerified === true` may search, bookmark or request contact. Only the
matching verified applicant may publish, revoke or decide contact requests.
Profiles contain exactly applicant ID, tenant ID, display name and a public
HTTPS portfolio URL. Private application/contact fields, credential-bearing
URLs, unexpected fields and unsafe markup are rejected or escaped.

## Durable consent generations

`storage/sqlite-discovery.mjs` stores public profiles, bookmarks and contact
requests in one SQLite WAL/FULL database. Its filename must be absolute and
inside an existing owned 0700 directory; database files must be owned regular
0600 files without links. Unknown/incompatible schemas fail closed.

Publication requires explicit consent, a notice revision and the exact current
`expectedGeneration` (zero only for a new record). Atomic compare-and-swap
advances the generation. Revocation advances it, clears public name/URL and
transactionally deletes bookmarks. Revoking before initial publication creates
a tombstone, so an in-flight initial publication cannot undo the revocation.
Revocation remains possible at generation exhaustion; publication then closes.

Bookmarks and contact requests bind to a specific active consent generation.
Contact approval/decline is an atomic transition from PENDING for that
generation. A revoked and republished profile cannot revive an old bookmark,
approval or old-tab decision. Applicant decisions carry `expectedGeneration`;
request listing exposes that generation without private contact details.
Repeated requests cannot reset an existing approval/decline for the same
generation. These records confer permission only; they reveal no email/phone.

Search uses a bounded tenant-scoped query, literal Unicode-normalized name
matching, stable applicant-ID ordering and an opaque-to-the-UI ID cursor.
Bookmark/request lists are bounded to 50 records. They contain current
consented data only. The memory adapter remains an isolated-test implementation.

## HTTP and views

`http/discovery.mjs` accepts a trusted verifier, canonical HTTPS origin and
configured approved notice revision. GET profiles provides paginated search;
GET/PUT/DELETE me reads/publishes/revokes the caller's public profile;
bookmarks supports listing/saving/removing; contacts supports requesting,
checking status and applicant decisions; requests lists the applicant's
current contact requests. No body can supply tenant, subject, role or industry
verification. Mutations require the exact same Origin. JSON is bounded to
8 KiB and strictly decoded; provider/body waits have deadlines; errors are
sanitized and responses are no-store.

`http/discovery-server.mjs` bridges actual Node HTTP, denies duplicate security
headers and noncanonical targets, and does not trust forwarded host/protocol.
It has no default authenticator or public listener. Bind only the real accepted
session verifier, not a synthetic test principal.

`views/discovery.mjs` provides escaped industry and contact views, scoped
session-bound clients, search/pagination and permission actions. Stale search
responses cannot replace newer results; disposal clears rendered profile data.
`views/portfolio-consent.mjs` supplies a public-only applicant editor that
requires host-supplied approved notice text/revision and an unchecked explicit
consent checkbox. A mismatched notice or unavailable session leaves no editor.
No legal notice is invented by these modules.

## Evidence and remaining acceptance

Run `node --test test/*.test.mjs` on Node with `node:sqlite` (tested Node 24.22.1).
All 31 tests pass: full consent/contact HTTP workflow, four-process publication
race, competing decisions, stale bookmark race, restart, transactional rollback,
cross-role/tenant/origin denial, malformed input, safe rendering and client
ordering. View controller tests use DOM doubles; no real-browser, screen-reader
or production acceptance is claimed. Existing repository CI runs source and
registry checks, not these product tests.

The MMS-01 accepted runtime and real upstream identity/industry-verification
contract remain unresolved (Coffee thread 73bd2913-0d63-409f-808a-a8944cabfded).
Approved publication notice text/revision must be provided by the host.
Deployment, real-session integration, browser/mobile/a11y and operational
backup/restore validation remain pending. Keep the mapped PR draft.
