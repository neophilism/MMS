# MMS-04 competition draft settings

MMS defaults are 90-second qualifiers, 180-second finals, a 14-day entry window
and manual review of ties. Judging weights total 10,000 basis points.
Optional audience voting, battles, ensemble/improv, prompts, ticketing,
sponsorship and required payments remain off by default.

## Implemented local workflow

- `domain/draft-settings.mjs` checks verified subject, exact tenant and producer
  role before reads or writes. Versions are safe integers and saves use atomic
  compare-and-swap. A stale version is never silently overwritten.
- `storage/sqlite-draft-store.mjs` persists tenant/event drafts across restarts
  with SQLite WAL and FULL synchronization. The adapter requires an absolute
  filename in an existing, owner-only directory; rejects symlinks, hard links,
  permissive files and incompatible schemas; and validates stored payloads.
  Single-statement insert/update operations enforce one winner per version.
- `http/draft-settings.mjs` provides GET/PUT on
  `/api/t/{tenant}/events/{event}/draft-settings`. PUT accepts exactly
  `{expectedVersion,settings}`. A server-bound verifier supplies identity;
  a separate server-bound resolver supplies optional capabilities. Body fields
  cannot grant capabilities or substitute a principal.
- The HTTP boundary requires Bearer authentication and a canonical HTTPS
  origin. PUT requires the exact same Origin; cross-site requests are denied.
  JSON bodies are limited to 8 KiB, streamed decoding is strict UTF-8, body and
  provider waits are bounded, and responses are private/no-store with sanitized
  errors. A version conflict returns 409.
- `http/draft-settings-server.mjs` composes the handler with Node HTTP, rejects
  duplicate security headers and ambiguous request targets, and ignores
  forwarded host/protocol values when selecting the configured origin. It has
  no default authenticator, CLI listener or public deployment.
- `views/draft-settings.mjs` renders labelled timing/rubric controls, initially
  disables saving, and supplies a host-mounted editor and session-bound client.
  The client fetches fresh authorization per call, uses relative scoped
  endpoints, omits cookies and refuses redirects. Failed or ambiguous saves
  require reload; they do not overwrite newer drafts. Optional settings are
  preserved by this timing/rubric editor and cannot be enabled through it.

The in-memory store remains an isolated-test adapter. SQLite is an available
host-local durable adapter, not evidence of an operating production volume,
backup policy or multi-host database. The host must choose its durable private
path and bind the verified session contract. Do not expose a server with a
test authenticator.

## Validation

Run `node --test test/*.test.mjs` with Node supporting `node:sqlite` (tested on
Node 24.22.1). All 26 tests passed in this activation: durable close/reopen,
tenant/event isolation, stale writes, malformed/corrupt schema/payload,
private paths, four-process creation race, actual Node HTTP round-trip,
origin/role/subject denial, capability substitution, stalled providers,
stream/body failures, client version handling and editor behavior.
Editor interaction tests use a small DOM double; no browser/a11y acceptance
is implied. Existing repository CI does not run these product tests.

## Remaining upstream integration

This is a local draft workflow only. It does not submit or publish engine
rules, claim an owner-approved live rubric, enable live voting or spend funds.
The accepted MMS-01 runtime/session binding and immutable upstream versioned
ruleset/producer capability contract remain unavailable. Bind those contracts,
map the draft to the verified engine request without inventing enum names,
then test actual engine round-trip, publication authorization and failure
recovery. Browser/mobile/screen-reader and deployment validation remain pending.
