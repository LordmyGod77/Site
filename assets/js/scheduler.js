"use strict";
document.addEventListener("DOMContentLoaded",async()=>{
  const target=document.getElementById("listingSummary"),actions=document.getElementById("verifiedTourActions");
  const escape=SiteUtil.escapeHtml,params=new URLSearchParams(location.search);
  const id=params.get("floorplan-id")||"";
  if(!id){target.innerHTML='<h2>Find your apartment first</h2><p>Search by city, ZIP, price and bedroom count. No floorplan ID is needed.</p>';return;}
  const base=String(window.APARTMENT_SITE_CONFIG?.renterApiUrl||"").replace(/\/+$/,"");
  if(!base){target.innerHTML='<h2>Verified listings are being connected</h2><p>The new Cloudflare search has not yet been activated. No unverified floorplan is available for a guest-card request.</p>';return;}
  try{
    const res=await fetch(base+"/api/public/listing-previews",{cache:"no-store"});
    if(!res.ok)throw Error("Verified listing service unavailable.");
    const data=await res.json();
    if(data.scrapeEligibility!=="configured-successful-scrape-v1"||data.privacyContract!=="anonymous-v1")throw Error("Verified listing feed not available.");
    const x=(data.results||[]).find(r=>r.floorplanId===id&&r.scrapeEligibility==="configured-successful-scrape-v1");
    if(!x)throw Error("This apartment isn't an active, configured, successfully scraped listing.");
    target.innerHTML='<h2>'+escape(SiteUtil.publicListingTitle(x))+'</h2><p>'+escape([x.city,x.state,x.zip].filter(Boolean).join(", "))+'</p><p><strong>'+SiteUtil.money(x.netEffectiveRent||x.baseRent)+'</strong></p>';
    const add=(label,intent)=>{
      const button=document.createElement("button");button.type="button";button.className="btn primary";
      button.textContent=label;button.addEventListener("click",()=>{
        if(window.RenterPortal)window.RenterPortal.startAction(id,intent);
        else target.insertAdjacentText("beforeend"," Renter login is not ready. Please contact your agent.");
      });actions.append(button);
    };
    add("Request a tour","tour");add("View property website","website");
    actions.classList.remove("hidden");
  }catch(err){target.innerHTML='<h2>Apartment details unavailable</h2><p>'+escape(err.message)+'</p><p><a href="../custom-search/?help=assistance">Ask your locator for free help</a></p>';}
});