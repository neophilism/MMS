# MMS-04 competition default profile

The product draft uses 90-second qualifiers, 180-second finals, a 14-day
entrant window and manual review of ties. A 10,000-basis-point preliminary
judging rubric is defined. Audience voting, battles, ensemble, improvisation,
prompts and monetary functions are disabled by default. Optional features
cannot be enabled in the local validator without an explicit capability set;
that set must come from trusted, verified upstream configuration.

A draft-settings service requires a verified producer principal, exact tenant match, an atomic compare-and-swap storage adapter and version checks. The bundled in-memory adapter is for isolated tests only; it is not production persistence.\n\nRun `node --test test/defaults.test.mjs test/draft-settings.test.mjs` on Node 22 or later.

These are local proposal values only. Actual venue policies, owner-approved
rubric, tenant overrides, persisted signed engine rulesets, chronological event
validation, audience voting, prize and wallet controls, and production rehearsal
are missing. Do not submit these values to engine writes without verified
capability, organizer authorization and reviewed event rules.
