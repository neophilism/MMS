# MMS-06 industry discovery boundary

Only verified industry principals with exact tenant membership can search,
save and view consented public-portfolio projections. Applicant private
application fields never enter search results. Unexpected profile fields and
token-bearing portfolio URLs fail closed.

The discovery service lets a verified applicant publish a scoped public
profile with explicit consent, revoke that consent, and remove existing
bookmarks. Search and saved-actor reads recheck current consent so stale
bookmarks do not reveal a revoked profile. The in-memory adapter is for
isolated tests only. Production storage must make revocation and bookmark
cleanup transactional and use tenant-scoped indexes.

Run `node --test test/*.test.mjs` on Node 22 or later.

Remaining: bind real verified industry identity and applicant consent UI,
persist records and bookmarks durably, paginate large searches, escape names
in rendered HTML, and run browser/privacy integration tests. No private
application data or production endpoint is exposed by this module.
