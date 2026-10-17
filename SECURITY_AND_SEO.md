# v0.5 security + SEO deployment notes

## SEO build
1. Deploy `backend/LocatorBackend-v0.5.gs` as the website Apps Script backend.
2. Confirm `publicSiteListings` now returns `communityName` and the real `floorplanName` but still does not return street address/source URL/private contacts.
3. Generate crawlable pages:

```powershell
node tools/build-seo-pages.mjs --root=. --origin=https://www.avreyanderson.com --api=YOUR_APPS_SCRIPT_EXEC_URL
```

This creates one static HTML URL per floorplan, one city hub per city, `sitemap.xml`, and `robots.txt`. Re-run after data changes (nightly is reasonable).

## Google Search
- Add `https://www.avreyanderson.com/` to Google Search Console.
- Submit `/sitemap.xml`.
- Inspect several generated floorplan URLs.
- The site uses schema.org Apartment/Offer markup for semantics, but Google does not currently promise a special long-term apartment-rental rich result from that markup. Do not describe this as guaranteed placement in a Google rental tab.

## Ads readiness
Every paid-ad destination should be the relevant generated floorplan or city page, not a generic home page. Keep the page crawlable, functional, useful, mobile-friendly and on the same domain as the ad destination.

## Security
The HTML includes a conservative CSP/referrer policy compatible with the current Apps Script JSONP + OpenStreetMap + Cloudflare Turnstile architecture. For real HTTP security headers (HSTS, X-Content-Type-Options, Permissions-Policy, frame restrictions), serve the site through Cloudflare Pages or a Cloudflare Worker/Proxy where response headers can be set. GitHub Pages alone does not give full response-header control.

Never place API keys, social client secrets, access tokens, CRM credentials, or Worker admin tokens in `assets/js/config.js`; browser JavaScript is public.
