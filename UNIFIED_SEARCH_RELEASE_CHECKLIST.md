# Unified apartment search — verification and deployment checklist

This branch replaces separate public approval/affordable pages with the main listings search and adds verified housing categories, credit/eviction flags, and free renter-assistance calls to action.

## Data contract

In the existing `PropertySupport` operations sheet, enter these exact headers (or run `locatorUpgrade()` after deploying the matching Apps Script backend, which adds missing columns without replacing existing records):

- `HousingType`: one of `Conventional`, `Affordable`, `55+`, `Student`. An empty value is **unknown**, not Conventional. A verified, non-empty `AffordableProgram` also classifies a property as Affordable.
- `CreditIssuesConsidered`: `Yes` or `No`; only an explicit Yes appears as a confirmed search match.
- `EvictionIssuesConsidered`: `Yes` or `No`; only an explicit Yes appears as a confirmed search match.
- `VerifiedAt`, `SourceURL`, `Notes`: keep current policy source and review date for these assessments.

Community-level PropertySupport rows apply as defaults. Floorplan-level rows can override those defaults. Values must be documented from the property or screening provider; third-party programs like Jetty do **not** establish credit-issue or eviction acceptance by themselves.

## Deployment order

1. Review the GitHub PR and test the static search markup/scripts in a preview. This branch has **not** been merged or deployed.
2. Ensure the running Apps Script backend is the matching `backend/LocatorBackend-v0.5.gs`, then deploy its new version. The website's `assets/js/config.js` still points to its existing deployment URL.
3. Run `locatorUpgrade()` once in the intended Apps Script project after checking the spreadsheet target. It adds optional PropertySupport headers but does not populate or assume screening criteria.
4. Populate/verify applicable HousingType and second-chance fields in PropertySupport.
5. Preview `/listings/`; test affordable, credit, eviction, housing type, city, rent, and bedroom filters with records with and without verified fields.
6. Verify `/affordable-housing/` and `/approval-help/` redirect to the main search. Test assistance, urgent move-in, and the direct-contact button.
7. Merge the website branch only after the backend version and public smoke tests agree.

## Important limitations

- Missing verification data intentionally produces “Housing type unverified” or excludes records from strict second-chance filters. It does not mean a rental applicant will be denied.
- This branch does not introduce authenticated renter accounts, verification emails, address disclosure, or a new backend guest-card flow.
- The existing public custom-search form sends guest-card/search inquiries through the current Apps Script backend. `assistanceType` gives a priority label to agent notification emails after the backend upgrade, not a guaranteed response time.
- The call button uses the public agent phone already configured on the site.
- Existing direct links to old public pages are preserved with redirects to `/listings/`.

## Anonymous listing titles (additional requirement)

- The public browser title, image link label, tour summary, and floorplan picker now use only bedroom count and general location (e.g. `1-bedroom apartment in South Austin, Austin, TX 78704`). City + ZIP is the safe fallback. No mapped community name or marketing floorplan name is used.
- The reviewed `backend/LocatorBackend-v0.5.gs` now returns placeholder `communityName` and generic `floorplanName`, plus `privacyContract: anonymous-v1`. **Deploy this backend before claiming anonymity**. The older legacy `backend/LocatorBackend-Website-v0.3.gs` still returns mapped community names and raw media URLs and must not be re-deployed as the public endpoint.
- In `PropertySupport`, `PublicAreaLabel` is optional and `PublicAreaLabelApproved` must be `Yes` for a broad neighborhood label like `South Austin` to appear. No location label is inferred from a property name or arbitrary map position. Run `locatorUpgrade()` after confirming the target spreadsheet to add these optional columns.
- Public-generated SEO pages now use generic titles, descriptions, links, and structured-data names. The generator fails closed if the backend doesn't mark each public listing as `anonymous-v1`. Rebuild from a **clean output directory** to avoid publishing stale pages with names from previous builds. The site's static listing paths must be generated and deployed before 'View floorplan' links resolve.
- The live public website and Apps Script deployment have not been changed by this PR. This is not a substitute for the planned verified renter login, server-side address authorization, or guest-card-on-website-navigation workflow. Existing public media and specials still need manual privacy review for identifying content.


## Phase 2: visual public search and verified renter accounts (not yet deployed)

- The revised listing page now displays a sign-in or create-account dialog once per new browser/tab visit. Visitors can dismiss it and browse anonymous apartment cards. A verified Firebase account personalizes the header and apartment search greeting.
- Generic listing titles use bedroom count plus approved broad area, city, state and ZIP; no mapped community name or marketed floorplan name. No arbitrary fallback to Central Texas when city data is missing; unknown areas are labeled pending verification.
- Listings now include a carousel for active publicly approved D1/R2 real_ad photos/videos (video preloaded as metadata, image as poster). No unapproved media or raw scraped URLs should be published. The worker base URL must be configured before the real-media feed can load.
- Each listing includes a non-blurry approximate OSM map centered on a coarse 0.1-degree public coordinate and a visually outlined ~12-mile area; exact coordinates come only from the verified renter API. The border is approximate, not a land-parcel or city-boundary representation.
- Filter question-mark buttons open explanatory dialogs. Load-more pagination limits the initially loaded carousels and map iframes. Shareable public floorplan previews stay on-site at listings/?floorplan-id=... and do not expose external property URLs.
- View website / Tour / Apply all use the separate renter guest-card dialog. It asks whether the visitor is searching for themselves or another person, and requires consent for another renter. The server must confirm successful delivery before releasing external URLs. Sign-in cannot be faked with a browser-only cookie.
- The public Firebase web configuration and the deployed Cloudflare Worker origin belong in assets/js/config.js. These are currently blank/null; until configured the preview is intentionally browse-only and explains that accounts are being configured.
- The Cloudflare implementation lives on the private repository's feature/renter-public-api-v1-20261114 branch. Review its cloud-worker/RENTER_PORTAL_STAGING_CHECKLIST.md before any migration or deployment.
- To test live images/video and account creation, stage an isolated D1/R2 Worker Preview, configure Firebase test domains and preview CORS, and run guest-card testing only against an approved internal test recipient.
- No production Worker, database, Google/Firebase configuration, or live website has been changed. Draft PR #2 must not be merged until staged end-to-end tests pass.


# Phase 3: scraped-community eligibility, city/ZIP normalization and SSD sync

## Confirmed root cause and fix

- The Cloudflare scraper's saveScrapeResults previously updated the community address and name but **not** city/state/ZIP. That explains "Area pending verification" even when a full street address exists in D1.
- The companion Worker branch now parses city/state/ZIP conservatively from a full, comma-delimited U.S. address at read time. New scrape writes also populate blank city/state/ZIP in the existing D1 community columns; createCommunity normalizes fields when the initial address is complete.
- Public results require: active community, nonblank street address, active floorplan, at least one ACTIVE scraper configuration and at least one recorded SUCCESSFUL scrape, and a valid city+state+5-digit ZIP. Missing/incomplete addresses fail closed. This is a deliberate exclusion, not proof a community does not exist.
- No arbitrary ZIP-to-city inference, neighborhood guessing, or city center approximation. Optional "Northwest Austin" and similar broad labels remain explicitly approved metadata; otherwise the title contains real city/state/ZIP from stored address.
- Public media IDs also require those conditions. Internal Desktop Manager and Scraper sources keep their existing community IDs, floorplan IDs, property media and permissions.

## Cross-reference checklist (same D1 source of truth)

| Dependent component | Contract after this change |
| --- | --- |
| Cloud Worker saveScrapeResults + createCommunity | Existing community address/city/state/ZIP columns; safe automatic normalization |
| Cloud Worker public listing-previews + media | Only active, configured, successfully scraped communities; explicit anonymous + eligibility contract |
| Website listings | Uses verified D1 feed only; no Apps Script public listing fallback |
| Website schedule-tour | Searches the verified D1 feed; no arbitrary floorplan ID public picker |
| Worker legacy publicSiteListings/publicSiteFloorplan + /api/public/floorplans | Hardened public responses; full internal/admin details unchanged |
| Static SEO builder | Uses verified D1 public-preview route, not legacy JSONP; refuses missing location/eligibility contract |
| Desktop Manager / Scraper / Ad Maker | Existing internal IDs, D1/R2 records and admin endpoints preserved; no running desktop code overwritten |
| Firebase renter portal | Verified email + full name and phone required before private property details; backend PATCH /api/renters/me saves the profile |
| SSD project | SYNC_TO_SSD.bat fetches/reviews only; APPLY_APPROVED_UPDATES.bat fast-forwards approved commits in the existing operating folder after explicit confirmation |

## One-click SSD review sync

After fetching this website branch into the existing local preview, double-click SYNC_TO_SSD.bat to FETCH AND REVIEW CHANGES ONLY. It does not create extra folders. After both PRs are tested and merged, close the desktop software and use APPLY_APPROVED_UPDATES.bat to fast-forward the two current operating checkouts on D: in place. This requires clean, matching active branches, and saves a local Git tag pointing to the previous commit. Nothing deploys to Cloudflare automatically.

When both PRs have passed staging tests and been merged, update the active checkouts separately with clean-tree, fast-forward-only pulls. Do NOT copy a review tree over operating scripts or redeploy the cloud-worker before its isolated D1/R2 migration/guest-card tests.

## Verification and known blockers

- Syntax and mocked contract checks passed for city/ZIP parsing, configured-scrape query assertions, anonymity, and approved-only image/video routing. This is NOT a live D1 content audit or a successful media load from the real R2 bucket.
- The staging Cloudflare Worker and Firebase config have not yet been deployed. Until configured, the preview deliberately displays the missing verified-feed message rather than anonymously listing unverified communities.
- See cloud-worker/scripts/audit-public-eligibility.sql in the private branch for a read-only location/eligibility/media audit. Run privately, not on the public site.
- No direct filesystem write to the user's external SSD is possible through the GitHub connector. The guarded in-place apply button performs that step on their PC after both PRs pass tests and are merged.

## Updated SSD source-control rule (supersedes earlier review-worktree instructions)

Keep exactly one operating project checkout at D:\ApartmentPlatform-vNext-foundation\ApartmentPlatform-vNext and the nested independent website checkout at ApartmentPlatform-Website. The review button only fetches GitHub commits and prints the changes; it does not clone or create worktrees. The apply button checks branch, remote, tracked cleanliness, and fast-forward ancestry for BOTH repositories before updating either one. It records a lightweight local Git checkpoint tag, then advances source files in place. It does not deploy a Worker, modify D1, write to R2, or update running processes. Git cannot undo database changes or recover untracked/generated files without separate backups. Existing _review worktrees from an earlier version of the script are not removed automatically; inspect them before any cleanup.

## Production D1 audit, November 2026 — block public release

The remote read-only audit found 868 active communities, 39 actively configured and 17 with recorded successful scrapes, but **zero search-eligible floorplans** with the current strict location contract. Only 2 have full stored city/state/ZIP; none of the 17 configured-and-successful ones has a safely derivable complete location. Among those 17, 15 have unparseable address strings and 2 have no stored address, covering 218 active floorplans. **The public website must not fall back to generic “Central Texas”, guess a ZIP or disclose mapped names.** Repair location data from the original property sources, keep the public search fail-closed, and validate live D1/R2, Worker/Firebase auth and guest-card staging before publishing.

The same audit identified 328 active approved real_ad images and 21 videos with R2 keys, but individual object existence was not tested. The Worker is not yet running the proposed API branch. See the private companion PR #1's staging checklist for verification requirements.
