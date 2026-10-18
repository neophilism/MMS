# MMS-01 partial app shell

Standalone Node server provides responsive public navigation and placeholder views.
Organizer, industry and account paths deny anonymous access; no private session or
client-submitted claims confer access. Engine origins require HTTPS (except local
loopback), but production SDK integration is not enabled. Health reports
productionReady false, with no application, payment, or voting operation enabled.

Run node --test test/*.test.mjs on Node 22 or later. This is not proof of
browser accessibility, live upstream compatibility or deployment.

Remaining: authenticated session and tenant boundary, engine SDK and API
integration, persisted settings, upstream capability evidence, accessibility,
production deployment and full end-to-end acceptance.
