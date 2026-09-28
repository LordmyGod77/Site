# START HERE

1. Back up your current Locator Apps Script project.
2. Replace the `.gs` code with `backend/LocatorBackend-Website-v0.2.gs`.
3. In Apps Script add an HTML file named **LocatorAdmin** and paste `backend/LocatorAdmin.html`.
4. Deploy a **new version** of the same Web App deployment; keep the same `/exec` URL.
5. Run `locatorUpgrade()` once.
6. Put that `/exec` URL into `assets/js/config.js`. Do **not** put your Locator API key, Gmail tokens, HUD token, Twilio secret, or any private key into GitHub.
7. Upload the public site files to the GitHub Pages repository and set the custom domain.
8. Open `/listings/` and confirm data. Open a listing's Schedule Tour link and submit one controlled test.
9. On your phone open `YOUR_EXEC_URL?admin=mobile`, enter the Locator API key, then add the page to your home screen.
10. Populate `PropertySupport` gradually with verified approval-support / affordable-housing / tour-provider data.

Do not use the tour adapter framework to bypass CAPTCHAs or provider restrictions.
