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
