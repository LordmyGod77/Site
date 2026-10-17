# Avrey Apartment Site v0.4 — privacy-first staged upgrade

This package modifies the v0.3 site. It is an **interim Apps Script + Sheets build**, not a production-ready SQL migration or a property-scheduler API integration.

## What changed

- Listing **Learn more / Schedule tour** buttons open a compact responsive modal. Direct social-media links still open `/schedule-tour/?floorplan-id=...` as a full page, and both use the same form.
- The public backend no longer returns community names, addresses, property websites, exact map coordinates, original property photo links, property-contact email addresses, or raw special/source notes. It returns a generalized coordinate grid for an approximate noninteractive map.
- Approved photos may show only after you independently rehost them under an allowlisted host and record `PublicMediaURLs` in `PropertySupport`. Until then, listings say "No images available." Rehosting **does not** defeat reverse-image identification.
- Guest card and tour request emails must both succeed **before** the backend sends the renter a 48-hour private-details link. The private page displays the property's name, address, website, and available official scheduling link. The optional provider link is a handoff, **not** an automated booking.
- Free custom apartment search records contact + broad optional screening topics, computes up to 6 nearest eligible price/bedroom matches from geocoded area to private community coordinates (up to 50 miles), and emails anonymized listing links. Missing coordinates or API/error cases require agent follow-up. The screening topics do **not** determine approval.
- Footer on every page contains Privacy Policy, Terms, and configured IABS/CN-1 links; homepage and tour form prominently surface the completed IABS. The terms/privacy pages are **working drafts**, not approved policies.
- HUD pre-screen compares income locally in the browser. The browser requests only the public HUD limit, not the visitor's annual income.
- All public POSTs require server-validated Cloudflare Turnstile. The Apps Script Turnstile secret and Gmail tokens must not appear in GitHub.

## Requirements and limitations

GitHub Pages serves only the public site. Apps Script performs server-side spreadsheet access and Gmail sends. `PropertySupport.TourAvailabilityJSON` supplies **cached, validated date/time values only**. There is no verified live Knock/RentCafe/Yardi API adapter in this package. Never call a requested tour a confirmed booking unless an actual property/provider confirmation exists.

OpenStreetMap receives a map request from the visitor's browser when a listing map loads. The map uses a coarse grid, has no property pin and is noninteractive. Visitors might still identify a property from publicly available photos, unusual descriptions or other independent sources.

Public form submission protection is fail-closed until you configure Turnstile. Do not switch it off on a live site. Apps Script's existing iframe-post + status-poll transport cannot provide a guarantee of exactly-once emails under every network failure or concurrent request; migrate that workflow to transactional SQL before high-volume use. If the site reports an unconfirmed submission, check the Operations logs before submitting again.

## Deployment

Read `START_HERE.md`. Keep your live `assets/js/config.js` values when updating; the ZIP ships with a placeholder Apps Script URL because credentials and your deployment identifier are not embedded. **Back up your live extension, Apps Script and GitHub repo before replacing anything.**

The website is not launch-ready until you fill in the current completed IABS 1-2, unmodified Consumer Protection Notice CN 1-5, reviewed privacy policy and terms, and Cloudflare Turnstile settings.


## v0.5 additions
- Public listing API now exposes community display name + actual floorplan name for indexable pages, while retaining address/source/contact privacy.
- `tools/build-seo-pages.mjs` pre-renders one crawlable landing page per floorplan and one local hub per city.
- Automatic `sitemap.xml` + `robots.txt`.
- Canonical/OG/search metadata improvements.
- Schema.org Apartment + Offer semantics on generated listing pages.
- Crawlable listing links from the live search grid.
- CSP/referrer policy in HTML and `_headers` starter for Cloudflare Pages security headers.
- Public phone updated to 737-431-8778.
