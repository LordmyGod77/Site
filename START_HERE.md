# START HERE — v0.3

## Website

Upload the **contents of this whole folder**, including the `assets`, `listings`, `schedule-tour`, `services`, `about`, `approval-help`, `affordable-housing`, `privacy`, `messages`, and `backend` folders.

Do not upload only the three root text/HTML files.

The v0.3 paths work both on a GitHub project URL such as `https://USERNAME.github.io/repository/` and on your future custom domain.

Before the backend is deployed, edit `assets/js/config.js` only to set the Apps Script `/exec` URL after deployment.

Do not add a live `CNAME` file yet if GitHub is still reporting the domain as taken. Follow `DOMAIN_SETUP.md` first.

## Apps Script

Your old backend may remain commented out temporarily. Comments execute nothing.

The cleanest setup is:

1. Keep the old code commented as a backup, or move it into a separate `.gs` file that remains fully commented.
2. Add a new Apps Script file named `LocatorBackendWebsite.gs`.
3. Paste the complete contents of `backend/LocatorBackend-Website-v0.3.gs` into that new file **without commenting it**.
4. Add an Apps Script HTML file named exactly `LocatorAdmin` and paste `backend/LocatorAdmin.html` into it.
5. Do **not** run `locatorInstall()` again. Existing Script Properties and the existing Operations spreadsheet remain in use.
6. Run `locatorUpgrade()` once.
7. Deploy → Manage deployments → Edit → New version → Deploy. Keep the same `/exec` URL if possible.
8. Put that `/exec` URL in `assets/js/config.js`.

Do not uncomment the old backend while the new backend is active because duplicate functions/constants will collide.
