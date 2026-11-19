# Website release — safe listing improvements (2026-11-19)

## Included in this release
- Updated /listings/ layout with bedrooms, rent, city, housing type, verified-only credit and eviction considerations, affordable housing, and availability controls.
- Free locating assistance, urgent move-in inquiry, and call links.
- Generic public listing labels built from broad area, city, state and ZIP instead of displaying community or marketing floorplan names.
- A working shareable on-site /listings/?floorplan-id=... URL, pagination and approximate neighborhood maps.
- Approved-media carousel code is prepared for the future D1/R2 privacy-contract feed. The existing Apps Script catalog stays available; legacy images without confirmed public-use rights are deliberately hidden.
- Existing Apps Script tour-request modal and scheduling flow are preserved.
- Custom-search assistance fields and redirects from old approval-help / affordable-housing pages are included.
- Existing legal notices, public configuration and the **newer Owner login · Advertising & Walkthrough Studio** footer link are preserved.
- Safer SEO generator script and optional guarded SSD sync helpers included as repository files; not automatically executed or deployed.

## Deliberately NOT included
- `renter-portal.js`, Firebase sign-in, private property details and guest-card disclosure, because the Worker auth API has not passed production verification.
- The strict configured-scrape D1-only public listing feed, since previous live D1 audit found zero eligible configured-and-scraped floorplans with valid location under that contract. Configure and stage after backfilling genuine city/ZIP values.
- Replacement of the live Apps Script backend or deployment of any Cloudflare Worker, D1 migration, or new public media endpoint.
- Full site media rights approval: legacy photo URLs and metadata remain unsuitable for public display without explicit rights evidence. The new gallery is empty for those records.

## QA
- 12/12 focused JS mock checks passed: current public listings feed, generic title, unverified media hidden, working floorplan link, tour action, credit-only matches, no guessed eviction matches, affordable filter, latest owner footer, JS parsing, filter controls and styles.
- No browser E2E test against deployed live domain: web origin unavailable to remote browsing from the current environment.
- No server deployment or database writes have been performed.

## Follow-up
1. Confirm GitHub Pages builds and `/listings/` responds, and submit one authorized test tour request only after confirming recipient routing.
2. Configure the secure owner login using BusinessDOCS admin-only PR #2 after standalone Worker QA.
3. Verify and repair city/ZIP in D1, stage the reviewed anonymous public feed, then enable `renterApiUrl` in website configuration.
4. Verify per-asset public media permission records and R2 objects before re-enabling photo and video carousels.
5. Deploy the companion Google Apps Script improvements separately after reviewing spreadsheet schema and ensuring current live action handlers remain compatible.
