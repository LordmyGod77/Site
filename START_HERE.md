# Install v0.4 without breaking your existing system

1. **Back up your live repository and Apps Script project.** Retain your current `assets/js/config.js` so its real `apiUrl`, custom site URL and other existing values are not lost.
2. On your local machine unzip v0.4 and copy **the contents of its root** into the GitHub Pages publishing folder. Only the website pages and `assets/` need to be publicly hosted; `backend/` and docs may stay in your private working copy. Keep `.nojekyll` in the publishing root. If GitHub tracked old files, remove obsolete site files intentionally; do not wipe unrelated repositories.
3. Update your live `assets/js/config.js` to include the new `iabsUrl`, `cn1Url` and `turnstileSiteKey` settings **while preserving your working deployed Apps Script `apiUrl`**. The ZIP's `config.js` contains an intentional API placeholder—do not overwrite a working value with it.
4. Download and fill out the **current IABS 1-2** using your actual broker and agent details. Upload that completed PDF under `assets/notices/` or another controlled HTTPS location. Upload/link the current, unchanged **CN 1-5** notice. Set the full HTTPS links in `config.js`. Review and replace the draft Privacy and Terms pages before public launch. Verify the links actually open from your homepage, tour popup, and footer.
5. In Apps Script, retain your old backup commented out if you wish. **Replace the entire active LocatorBackendWebsite.gs with `backend/LocatorBackend-v0.4.gs`.** Avoid loading both v0.3 and v0.4 active backend code because the functions overlap. Retain `LocatorAdmin.html` from v0.3; it is unchanged. Do not run `locatorInstall()` again.
6. In the Apps Script editor save, then run `locatorUpgrade()` **once** to append the new Operations columns and `CustomSearchRequests` sheet without replacing existing guest-card/tour logs.
7. From the Apps Script editor, run the operator-only setup functions with your real values:

```javascript
function configureSiteV04() {
  locatorConfigureWebsiteBase(
    "https://script.google.com/macros/s/YOUR_CURRENT_DEPLOYMENT/exec",
    "https://www.avreyanderson.com/",
    "https://www.avreyanderson.com/assets/notices/completed-iabs.pdf"
  );
  locatorConfigureTurnstile(
    "YOUR_CLOUDFLARE_TURNSTILE_SECRET_KEY",
    "www.avreyanderson.com,avreyanderson.com"
  );
}
```

Create a Turnstile widget in Cloudflare for the exact website hostnames above (and your `USERNAME.github.io` hostname if you test on GitHub Pages). Place only its **site key** in public `config.js`. The Turnstile **secret** stays only in Apps Script Script Properties. Delete the temporary setup function afterward so the secret is not left in source code. The helper validates the challenge on the backend; the browser widget alone is insufficient. If the client's consent or Turnstile challenge expires, reload the form.

8. Your original Gmail OAuth connection must still work. Confirm the Apps Script execution identity is allowed to send from the configured mailbox and that the desired community has `GuestCardEmail` and `TourEmail` (or the appropriate fallback). Both outbound requests have to succeed before private details are emailed.
9. Go to **Deploy → Manage deployments → existing web app → Edit → New version → Deploy**. Keep your existing `/exec` URL, execute as Me, and ensure the web app is accessible to your intended public users. Updating code without deploying a new version does not update `/exec`.
10. Check `/exec` and the public listings test (append `?action=publicSiteListings&callback=test&criteria=%7B%22availableOnly%22%3Afalse%7D`). Confirm the returned JSONP contains no `communityName`, `communityId`, `address`, `tourUrl`, `sourceUrl`, `GuestCardEmail`, original property links or exact coordinates. Then test the full website on a **controlled test floorplan/recipient** before allowing real clients to use it.
11. On GitHub, verify the CSS, navigation, listing popup, standalone social link, security challenge, footer notices, custom-search email and private-receipt expiration. If any piece fails, restore the previous GitHub commit and switch the Apps Script deployment back to its prior version.

## Images / safe public media

Do not publicly serve the original property/media URLs if they expose the source property. Only photos with appropriate use permission and neutral filenames should be rehosted, with EXIF removed. Set `PUBLIC_MEDIA_HOSTS` (comma-separated exact hostnames) in Apps Script Script Properties, e.g., `www.avreyanderson.com`. Populate the private Operations spreadsheet's `PropertySupport.PublicMediaURLs` with your new HTTPS media URL(s) and optionally `PublicSpecialText` with a manually reviewed generic promotion. Without those steps a listing deliberately shows **No images available**. Photos recognizable through reverse-image searches still identify properties; omit them if strict nondisclosure matters.

## Custom search matching

The requested area is geocoded server-side. Up to six options are chosen by **distance**, subject to the requested rent and bedroom filters and available private map coordinates, within a 50-mile radius. No property name/address/website is included in the shortlist email; each option links to your public floorplan-aware tour page. Optional credit/criminal/rental-history topics are used for human follow-up, **not** to calculate approval odds or exclude people. If automatic matching cannot run or produces no results, the request is logged for agent follow-up.

## Booking and client disclosure

A tour is **requested**, not confirmed. The private receipt contains an official scheduler URL only if one is recorded. Automatic booking needs the property's authorized API/adapter and a returned booking confirmation; that is not in v0.4. The receipt token is a bearer link (someone you forward it to could also view the details) and expires after 48 hours. A future database/identity layer should provide better grant revocation and auditing.

## Production migration

Implement a managed PostgreSQL database and authenticated server-side API before relying on this for substantial lead volume or storing detailed screening/credit/criminal information. Recommended tables: `communities`, `floorplans`, `units`, `public_media`, `support_verifications`, `leads`, `guest_card_deliveries`, `tour_requests`, `tour_bookings`, `disclosure_grants`, `custom_search_requests`, `matched_results`, `applications`, `message_consents`, `message_logs`, and `audit_events`. Keep scraper output in staging Sheets until the import/sync is verified.
