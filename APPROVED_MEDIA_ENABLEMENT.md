# Apartment Pros public approved media — enable after Worker deploy

## Why this exists
The production database currently contains **349** active real_ad image/video records with public_allowed=1 and R2 keys (328 images, 21 videos), and the R2 API confirmed all 349 underlying objects exist. They map to about 40 active floorplans (directly or via community-level associations). A separate 28 active real_ad records have public_allowed=0 and remain withheld pending rights review. Other reference-only photos must never be assumed approved just because they have an R2 object.

The public site must not show an apartment card with no **approved** media. We do not want an old JSONP catalog to advertise pictures with unknown rights. Pricing and availability remain provisional and are labelled as such.

## Deployment
The standalone read-only Cloudflare Worker is in `LordmyGod77/BusinessDOCS` branch `release/admin-public-media-20261119`:
- `cloud-worker/public-media/worker.mjs`
- `cloud-worker/public-media/wrangler.toml`

It uses your existing `apartment-platform` D1 DB and `apartment-platform-media` R2 bucket. It never modifies either. It is **not** a replacement for your existing `apartment-platform-api` admin Worker.

Cloudflare's current ChatGPT connector returned **403: missing Workers Scripts Write/Editor** when uploading this Worker. Authorize that scope via the Cloudflare connector or deploy once from the SSD using Wrangler (after the two files are available locally):

```powershell
cd 'D:\ApartmentPlatform-vNext-foundation\ApartmentPlatform-vNext\cloud-worker'
npx wrangler login
npx wrangler deploy --config .\public-media\wrangler.toml
```

Confirm the worker was assigned `https://apartment-platform-public-media.avrey-platform.workers.dev`.

## Verify before turning on the public gallery
Check these URLs in your browser:
- `https://apartment-platform-public-media.avrey-platform.workers.dev/health` → `ok:true`
- `https://apartment-platform-public-media.avrey-platform.workers.dev/api/public/listing-previews` → contract `anonymous-v1`, `approved-media-v1`, nonzero results and HTTPS `/api/public/media/MF-...` links
- Open one returned `/api/public/media/MF-...` image and one video, confirm actual bytes load.
- Verify a `public_allowed=0` image ID returns 404 through the public route.
- Confirm no original R2 key, community name, street address, private media, source URL, or rights evidence is returned in public JSON.
- Confirm source pricing fields do not claim stale availability as live inventory.

Then update `assets/js/config.js` on the SITE repo's `main` branch:
```js
approvedMediaApiUrl: "https://apartment-platform-public-media.avrey-platform.workers.dev",
```
The site has a built-in contract check. Once enabled, it displays **only** image/video-backed floorplans. Anonymous city/state/ZIP is displayed only when stored explicitly or literally present in the original address string; no property names/streets are exposed. Community-level *approved real_ad* assets are shared only with floorplans in their own community. Broken media triggers client-side skip-to-next instead of freezing a carousel.

Do not set `renterApiUrl` for this: it is reserved for a separate Firebase/private renter API that is not yet ready.

## Private admin gallery
The companion admin-only release branch includes a searchable gallery of every image/video media record, regardless of active/public/inspiration flags and including rows without an R2 copy. It shows media IDs and rights status, and previews R2 items through the **authenticated** existing `/media/api/preview/{mediaId}`. The user must configure the owner login and deploy the admin-only Worker separately.

## Production limitations
- Website code can be merged independently, but the public gallery **cannot activate** without a deployed Worker and a configured URL.
- A role of `real_ad` and `public_allowed=0` is a conflict, not authorization; review it in the private media gallery.
- Pricing is drawn only from active availability seen in the prior 30 days. It can change and is not a live landlord quote.
- The new public listing contract is approved-media eligibility, not the previously proposed strict configured-successful-scrape eligibility. Do not relabel the contract or claim a successful scrape where one was not verified.
