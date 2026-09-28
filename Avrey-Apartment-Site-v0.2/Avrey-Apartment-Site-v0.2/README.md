# Avrey Apartment / Real Estate Site v0.2

This package is designed for GitHub Pages + your existing Apartment Pros Locator Apps Script backend.

## What is included

- Public GitHub Pages website with Home, Listings, Services, About, Approval Help, Affordable Housing and Schedule Tour pages.
- `schedule-tour/index.html` preserves the URL shape `https://www.avreyanderson.com/schedule-tour/?floorplan-id=FP-...`.
- Every listing links to the same scheduler and carries the FloorplanID in the query string.
- Public listing cards show a real image when a usable HTTPS image URL exists in an image/photo/media column; otherwise they say **No images available**.
- Website submissions create a WebsiteLeadLog row, try the existing Guest Card workflow, and try the existing Tour Request workflow.
- PropertySupport sheet for OneApp / TheGuarantors / Jetty / Liberty Rent / Rhino / affordable-housing metadata / tour provider metadata.
- ApplicationFollowUp sheet for application and outcome follow-up.
- MessageContacts + MessageLog plus a phone-friendly **Apps Script mobile admin** for SMS and application follow-up; the public `/messages/` route only launches it.
- Optional server-side HUD MTSP income-limit pre-screen.
- Optional server-side Twilio SMS sending; Twilio credentials never belong in GitHub.

## GitHub Pages setup

1. Create a GitHub repository.
2. Upload the contents of this folder to the repository root.
3. In GitHub: Settings -> Pages -> Deploy from branch -> `main` / root (or use GitHub Actions).
4. Configure your custom domain. The included `CNAME` currently says `www.avreyanderson.com`; change it if your desired canonical hostname is different.
5. DNS must be configured according to GitHub Pages custom-domain instructions.
6. Edit `assets/js/config.js` and paste the Apps Script **/exec** URL. Do not put any API key or secret there.

## Backend upgrade

Use `backend/LocatorBackend-Website-v0.2.gs` as a full replacement for your current Locator backend. It is based on the v0.7 mobile-ui backend and keeps the existing guest card / tour / Gmail OAuth functions.

After pasting it into the Apps Script project:

1. Save.
2. Deploy -> Manage deployments -> Edit -> New version -> Deploy.
3. Keep the same `/exec` URL.
4. Run `locatorUpgrade()` once from the editor. It adds these Operations sheets if missing:
   - WebsiteLeadLog
   - ApplicationFollowUp
   - PropertySupport
   - MessageContacts
   - MessageLog
5. Existing GuestCardLog, TourLog and EmailSentLog remain.

## PropertySupport sheet

Populate one row per community (or a specific floorplan override):

- CommunityID
- FloorplanID (optional; wins over CommunityID)
- OneApp
- TheGuarantors
- Jetty
- LibertyRent
- Rhino
- Leap
- Insurent
- Cosign
- AffordableProgram
- AffordableAMIPercent (20, 30, 40, 50, 60, 70, 80)
- HudEntityID (HUD county or metro entity ID used by MTSP IL API)
- HudYear (optional; blank asks HUD for its default/latest response)
- TourProvider
- TourURL
- TourAvailabilityJSON
- SourceURL
- VerifiedAt
- Notes

Use `TRUE`, `Yes`, or `Verified` for verified support flags.

### Why this is separate from the apartment scrape database

The apartment database remains the source of scraped rent / availability / floorplans. Property-support claims and follow-up state change for different reasons, so they live in Operations and are joined by CommunityID/FloorplanID at read time.

## Tour scheduling behavior

Current v0.2 behavior is deliberately safe:

1. Website collects the client + selected FloorplanID.
2. Website creates a guest-card request.
3. Website sends the existing tour-request email to the property's stored TourEmail / GuestCardEmail.
4. If PropertySupport contains `TourAvailabilityJSON`, the site can show those cached/verified slots as reference.
5. If PropertySupport contains `TourURL`, the backend exposes that as the provider scheduler URL.

A requested time is **not labeled confirmed** until the property confirms it.

Do not make a generic scraper submit third-party scheduling portals from a masked IP. Provider-specific automation should be adapter-by-adapter, using an authorized API when available or a user-confirmed browser handoff when not. Apps Script can act as a server-side relay, but it should not be used to evade anti-bot or access controls.

## HUD setup (optional)

HUD's MTSP/Income Limits API requires a HUD User API token.

From Apps Script, run once:

```js
locatorConfigureHudApiToken("YOUR_HUD_USER_API_TOKEN");
```

Then set `HudEntityID` + `AffordableAMIPercent` in PropertySupport. The Affordable Housing page performs a preliminary household-size/income comparison. It is not a final property eligibility decision.

## Phone messaging + application follow-up admin

The private admin interface is served by Apps Script, not GitHub Pages. This avoids putting the Locator API key into a public repository and avoids cross-origin browser problems.

After deployment, open:

```
YOUR_APPS_SCRIPT_EXEC_URL?admin=mobile
```

On your phone, add that page to the home screen. Enter your Locator API key once; it stays in that browser's local storage. The admin has two tabs:
- Messages: client contacts, lease-end windows, templates, bulk send to consented contacts
- Applications: applied/not applied, outcome, follow-up date/status/notes

Configure Twilio from the Apps Script editor:

```js
locatorConfigureTwilio(
  "YOUR_TWILIO_ACCOUNT_SID",
  "YOUR_TWILIO_AUTH_TOKEN",
  "+1YOUR_TWILIO_NUMBER"
);
```

The scheduler includes a separate optional SMS-marketing checkbox. Tour submission does not require SMS consent. The backend records consent source/time and skips contacts without consent or marked opted out. U.S. A2P messaging still requires the applicable Twilio/carrier registration and opt-out handling.

Add a new Apps Script HTML file named exactly `LocatorAdmin` and paste `backend/LocatorAdmin.html` into it.

## Application follow-up

The backend adds private API actions:

- `locatorListApplicationFollowUps`
- `locatorUpsertApplicationFollowUp`

These require the existing Locator API key. They do not alter scraped apartment rows.

## Images

The website scans columns whose header contains `image`, `photo`, or `media`, extracts HTTPS URLs, and uses the first one. If your actual media is stored as Google Drive file IDs rather than public image URLs, the next step is to add a controlled image-serving route or publish direct image URLs. Until then the card correctly shows `No images available`.

## What is not magically automated in v0.2

- It does not bypass CAPTCHAs or property portal restrictions.
- It does not claim a tour is confirmed merely because an email was sent.
- It does not auto-submit Zillow or Craigslist from a consumer account.
- It does not auto-discover every OneApp/Jetty/TheGuarantors property nationwide.
- It does not determine final affordable-housing eligibility.

Those are provider-specific integrations layered on top of this foundation.


## Public-launch hardening

Before sending large public traffic to the scheduler, add a bot-control layer such as Cloudflare Turnstile or reCAPTCHA and verify it server-side. The starter already uses a honeypot, minimum-fill time and duplicate suppression, but those are not a complete abuse defense.

## Server-side tour adapters and IP/privacy

A provider-authorized server-side scheduler adapter can make the property see the backend request rather than the visitor's browser connection. That is a normal server integration, not an anti-bot bypass. Do not use Apps Script or another proxy to evade CAPTCHAs, rate limits, origin rules or provider access controls. `TourAvailabilityJSON` is the current safe cache/interface for real slot data until a specific provider's authorized integration is implemented.
