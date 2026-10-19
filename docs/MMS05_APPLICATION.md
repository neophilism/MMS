# MMS-05 private actor application draft

The local validator accepts scoped tenant/event/applicant IDs, consent revision,
private content digests and bounded representation and union-status categories.
A field-ordering validation bug was corrected. The privacy projection disallows
public and industry discovery by default.

The draft service enforces verified applicant ownership, tenant matching,
versioned saves, explicit current consent before submission and withdrawal.
Only verified producer/reviewer roles can read submitted records. Withdrawal
immediately removes reviewer access. Submission stores a server-clock consent
receipt and requires verification of every referenced private media object.

The private-media service checks type and size, requires an injected scanner,
encrypts with AES-256-GCM using an injected tenant key, and verifies ciphertext
authenticity and digest before submission. Its in-memory object store is only
for isolated tests. Production requires durable private storage, managed keys,
a real scanner and streaming for large files.

Run `node --test test/*.test.mjs` on Node 22 or later.

Missing work includes verified upstream identity, applicant consent UI, signed
uploads, notification, retention/export/delete, browser tests and Live
Competition Engine integration. Do not serve the in-memory adapters in production.
