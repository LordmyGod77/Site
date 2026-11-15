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
