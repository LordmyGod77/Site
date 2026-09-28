# Avrey Apartment / Real Estate Site v0.3

This build fixes the v0.2 GitHub Pages packaging/path problem.

## Main fixes

- All site folders and assets are included in the ZIP.
- CSS/JS paths work on a GitHub project Pages URL before a custom domain exists.
- Navigation derives the repository root dynamically, so it also works after moving to `www.avreyanderson.com`.
- Mobile navigation uses a real Menu toggle instead of collapsing to one Listings link.
- Listing/tour links no longer assume the site is hosted at `/`.
- Live `CNAME` was removed while the domain claim is unresolved; `CNAME.example` is supplied instead.
- The Apps Script website backend remains a complete superset of the prior Locator backend: use it as the active backend, not as a small add-on pasted beside an active older backend.

See `START_HERE.md` and `DOMAIN_SETUP.md`.
