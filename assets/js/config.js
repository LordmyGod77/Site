window.APARTMENT_SITE_CONFIG = {
  // Paste the deployed Apps Script /exec URL here after deploying backend/LocatorBackend-Website-v0.3.gs.
  apiUrl: "PASTE_APPS_SCRIPT_EXEC_URL_HERE",
  scheduleBaseUrl: "", // blank = use this deployed site; set a full URL only if you intentionally want an external scheduler
  brandName: "Avrey Anderson Real Estate",
  locatorBrand: "Apartment Pros",
  agentName: "Avrey Anderson",
  contactEmail: "Avrey@apartment-pros.com",
  // Optional public phone shown on the site. Leave blank to hide it.
  contactPhone: "",
  // After deploying the Apps Script backend, the mobile admin app is the same /exec URL plus ?admin=mobile.
  adminAppUrl: "",
  listingsPageSize: 500
};
