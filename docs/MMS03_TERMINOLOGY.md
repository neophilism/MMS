# MMS-03 terminology translation

Typed, immutable UI-only labels translate event, participant, performance,
judge, rounds and outcomes into MMS monologue vocabulary. Generic engine
identifiers remain unchanged and are not used as permission or state-machine
data. Finalist, winner and champion are distinct labels; a winner is not
silently relabeled a finalist. Count labels provide clear singular and plural
English wording. Unsupported locales fail explicitly rather than pretending
to provide translations.

Run `node --test test/terminology.test.mjs` on Node 22 or later.

Remaining: use the mapper in every rendered view after the app shell is
integrated, add approved translations, test public and authenticated screens,
and validate mobile and screen-reader wording. No generic capability or
authorization is altered by this mapping.
