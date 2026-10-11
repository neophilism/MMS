> **Canonical PR work plan:** [`registry/roadmap.json`](../registry/roadmap.json). The detailed historic instructions below remain authoritative for scope, while all current planned work/PR links must be updated in the canonical registry.

# MMS — original eight-milestone downstream development plan

**Recovery provenance:** original October 7, 2026 conversation specifying this downstream application and its 8-PR roadmap. **All 8 original milestone names recovered.** The implementation/acceptance expansion here is technical guidance grounded in that conversation, not a purported verbatim transcript. Milestone numbers are not necessarily GitHub PR issue numbers.

## Product purpose and boundary

A performer- and industry-centered timed monologue competition application on Live-Competition-Engine. Brand and navigation use MMS only; do not expand the acronym. This repository must own its UI, policy and defaults; generic judging/events/streaming/payment capabilities are supplied upstream.

## Non-negotiable product requirements

- Timed monologue performances; short-form qualifiers; professional/industry judges; optional audience voting; winners and champion history.
- Applications include headshots, résumés, reels, representation and union-status information with explicit privacy controls and applicant consent.
- Verified-industry profiles can save/bookmark actors; never let this role silently access private applicant data.
- Public user routes should include watch, apply, vote, archive and sponsor, with clear event/event-status messaging.
- Optional battles, ensemble/improv modes and audience prompts are feature-flagged off by default; future optional modes use reusable core capabilities, not hidden MMS-only engine changes.
- All monetization controls are optional and independently configurable at platform/tenant/event/account; no implied paywall.

## Dependencies and architecture

Requires Live-Competition-Engine foundational domain/tenant/auth roles, applicants, scoring, producer control, voting/results, streaming, optional payment components. An app prototype can use stubs, but production claims require real upstream connections.

## Original ordered implementation plan

### MMS-01 — Application shell

- **Implement:** Create app runtime and engine-SDK integration, routes, identity, access boundary, tests and configuration.
- **Dependencies:** original milestones 1–0 as needed, plus the corresponding reviewed upstream core capability; do not represent missing upstream features as complete.
- **Acceptance:** Demonstrate the scoped workflow with unit/integration tests, authorization and relevant failure paths; round-trip every persisted setting/record; no unauthorized cross-tenant/private access or non-consensual publication.

### MMS-02 — Visual identity

- **Implement:** Build responsive MMS-specific pages, palette, typography, public experience, accessible performer/industry layouts.
- **Dependencies:** original milestones 1–1 as needed, plus the corresponding reviewed upstream core capability; do not represent missing upstream features as complete.
- **Acceptance:** Demonstrate the scoped workflow with unit/integration tests, authorization and relevant failure paths; round-trip every persisted setting/record; no unauthorized cross-tenant/private access or non-consensual publication.

### MMS-03 — MMS terminology

- **Implement:** Map generic engine nouns into audition, monologue, applicant, industry judge, finalist, champion and the approved MMS user terminology.
- **Dependencies:** original milestones 1–2 as needed, plus the corresponding reviewed upstream core capability; do not represent missing upstream features as complete.
- **Acceptance:** Demonstrate the scoped workflow with unit/integration tests, authorization and relevant failure paths; round-trip every persisted setting/record; no unauthorized cross-tenant/private access or non-consensual publication.

### MMS-04 — Competition defaults

- **Implement:** Configure timed short-form qualifier/finals, judge rubric, entrant window, tie rules and optional audience votes; battles/off modes disabled.
- **Dependencies:** original milestones 1–3 as needed, plus the corresponding reviewed upstream core capability; do not represent missing upstream features as complete.
- **Acceptance:** Demonstrate the scoped workflow with unit/integration tests, authorization and relevant failure paths; round-trip every persisted setting/record; no unauthorized cross-tenant/private access or non-consensual publication.

### MMS-05 — Actor application experience

- **Implement:** Profile creation, headshot/résumé/reel uploads, representation/union status, consents, private review and notification.
- **Dependencies:** original milestones 1–4 as needed, plus the corresponding reviewed upstream core capability; do not represent missing upstream features as complete.
- **Acceptance:** Demonstrate the scoped workflow with unit/integration tests, authorization and relevant failure paths; round-trip every persisted setting/record; no unauthorized cross-tenant/private access or non-consensual publication.

### MMS-06 — Industry discovery

- **Implement:** Verify industry accounts; offer searchable permitted actor profiles, saved-actor function and contact permissions.
- **Dependencies:** original milestones 1–5 as needed, plus the corresponding reviewed upstream core capability; do not represent missing upstream features as complete.
- **Acceptance:** Demonstrate the scoped workflow with unit/integration tests, authorization and relevant failure paths; round-trip every persisted setting/record; no unauthorized cross-tenant/private access or non-consensual publication.

### MMS-07 — Public site and archive

- **Implement:** Watch/apply/vote/sponsor pages, live status, results, winner/champion history, recordings and corrected captions.
- **Dependencies:** original milestones 1–6 as needed, plus the corresponding reviewed upstream core capability; do not represent missing upstream features as complete.
- **Acceptance:** Demonstrate the scoped workflow with unit/integration tests, authorization and relevant failure paths; round-trip every persisted setting/record; no unauthorized cross-tenant/private access or non-consensual publication.

### MMS-08 — Production validation

- **Implement:** Run full application through upstream Live-Competition-Engine with real media/stream and privacy/authorization tests, accessibility, deployment and monitored operations.
- **Dependencies:** original milestones 1–7 as needed, plus the corresponding reviewed upstream core capability; do not represent missing upstream features as complete.
- **Acceptance:** At least one scripted realistic event: applicant submits media; producer selects qualifiers; judge scores a timed monologue; votes if enabled; results finalized; public can watch archive; verified industry user saves permitted applicant; privacy, opt-out and cross-role negative tests pass.

## Verified release acceptance

At least one scripted realistic event: applicant submits media; producer selects qualifiers; judge scores a timed monologue; votes if enabled; results finalized; public can watch archive; verified industry user saves permitted applicant; privacy, opt-out and cross-role negative tests pass.

Test both payment-enabled and no-payment modes, mobile/keyboard accessibility, public/private page leakage, signed media access, user consent, CI, backups/restore, telemetry and basic production smoke. Demo actors, streams, events and revenue must be clearly marked synthetic unless backed by a live service.

## Handoff for another ChatGPT account

1. First read this complete file and `README.md`, then inspect the newest `main` commit, open/closed PRs, CI, upstream engine branch, Render/Neon status, and `.exechub/project.yml` if present. Confirm that upstream APIs really support the next milestone.
2. Treat these milestones as **planned** until code + tests are merged; empty repo or a file commit does not constitute app implementation. Map milestone IDs to actual PRs in the work-status tracking system, keeping a source-of-truth and recording evidence links.
3. Choose ordinary technical decisions independently. Chain passing PRs; stop only on a failed gate, lacking credentials/permissions, legal/commercial commitment or material product change. Do not leak production secrets into commits or tests.
4. The app is a separate repository/deployment; do not edit the engine to bake in this app's labels, product defaults or branding.

## Recovery status

The original numbered plan and product constraints are recoverable; external API selections, credential readiness and present-day deployment cannot be certified from a past conversation. Do not infer current availability from this handoff document.
