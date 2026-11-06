window.APARTMENT_SITE_CONFIG = {
  // Paste the deployed Apps Script /exec URL here after deploying backend/LocatorBackend-Website-v0.3.gs.
  apiUrl: "https://script.google.com/macros/s/AKfycbxIUhl0u7qOx2tGijuBlzjNLmhU5MFDvaXFbtxyhXbp1-USlS4caTxwKw9jGfW8znf5iA/exec",
  scheduleBaseUrl: "", // blank = use this deployed site; set a full URL only if you intentionally want an external scheduler
  brandName: "Avrey Anderson Real Estate",
  siteOrigin: "https://www.avreyanderson.com",
  locatorBrand: "Apartment Pros",
  agentName: "Avrey Anderson",
  contactEmail: "Avrey@apartment-pros.com",
  // Optional public phone shown on the site. Leave blank to hide it.
  contactPhone: "737-431-8778",
  // Required before launch: HTTPS URL to YOUR COMPLETED current IABS 1-2 form.
  iabsUrl: "https://www.avreyanderson.com/assets/notices/APROSIABS.pdf",
  // Direct URL to official TREC Consumer Protection Notice CN 1-5 PDF or hosted unchanged copy.
  cn1Url: "https://www.avreyanderson.com/assets/notices/CN%201-5_0.pdf",
  // Public Cloudflare Turnstile site key; its SECRET belongs only in Apps Script.
  turnstileSiteKey: "67902356-S-54219865",
  // After deploying the Apps Script backend, the mobile admin app is the same /exec URL plus ?admin=mobile.
  adminAppUrl: "https://script.google.com/macros/s/AKfycbxIUhl0u7qOx2tGijuBlzjNLmhU5MFDvaXFbtxyhXbp1-USlS4caTxwKw9jGfW8znf5iA/exec?admin=mobile",
  listingsPageSize: 500
};
