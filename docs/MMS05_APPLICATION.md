# MMS-05 private actor application draft

The local validator accepts only scoped tenant/event/applicant IDs, consent
revision, private content digests and bounded representation and union-status
categories. A validation bug in the original field ordering was corrected.
The privacy projection disallows public and industry discovery by default.

The draft service enforces verified applicant ownership, tenant matching,
versioned saves, explicit current consent before submission, and withdrawal.
Only verified producer/reviewer roles can read submitted records, and withdrawal
immediately removes reviewer access. It records a server-clock consent receipt.
The in-memory adapter is for isolated tests only.

Run `node --test test/applications.test.mjs test/application-service.test.mjs`
on Node 22 or later.

No actual files are uploaded or securely stored. Digests alone do not establish
malware safety or authenticity. Missing work includes encrypted durable storage,
verified upstream identity, applicant consent UI, signed uploads, scanning,
notification, retention/export/delete, browser tests and Live Competition Engine
integration. Do not serve the in-memory adapter in production.
