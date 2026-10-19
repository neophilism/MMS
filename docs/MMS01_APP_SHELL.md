# MMS-01 application shell

The Node server serves responsive public navigation and read-only placeholders.
Organizer, industry and account pages require a server-provided authentication
resolver that returns a verified subject, tenant ID and role Set. Client headers
never establish identity. Tenant-prefixed private routes require an exact tenant
match. Without a resolver, private views fail closed.

`/health` reports process liveness. `/ready` checks the configured engine health
endpoint and returns 503 when disconnected. Neither claims production readiness.
Engine origins require HTTPS except for local loopback.

Run `npm test` on Node 22 or later. The shell performs no live applications,
votes, payments or media access.

Remaining: bind resolver to a verified upstream session contract; integrate engine
SDK/API operations and persistence; verify upstream capability, browser accessibility,
deployment and full end-to-end acceptance.
