# MMS-02 visual foundation

MMS owns semantic color, spacing and surface tokens, a responsive grid, visible
keyboard focus, dark mode and reduced-motion styles. Static landing and role
pages are available from `design/pages.mjs`. They include navigation landmarks,
a skip link and distinct performer, industry and audience information areas.
These views contain placeholders only; they expose no applicant information
and do not suggest live submission or payment.

Run `node --test test/design.test.mjs test/pages.test.mjs` on Node 22 or later.
The app runtime does not yet serve these pages. Browser keyboard, mobile and
contrast verification plus engine integration are required before MMS-02
acceptance. These source-level tests are not a WCAG audit.
