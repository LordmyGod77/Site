"use strict";
let allListings=[];
const esc=()=>SiteUtil.escapeHtml;
function supportYes(s,key){return Boolean(s&&s[key]===true);}
function areaMap(x){
  const m=x.areaMap;
  if(!m||!Number.isFinite(Number(m.latitude))||!Number.isFinite(Number(m.longitude)))return '<div class="map-fallback">General area: '+esc()(x.city||"Location available on request")+'</div>';
  const lat=Number(m.latitude),lon=Number(m.longitude),a=0.12,b=0.17;
  // Approximate grid only: no marker and no property coordinates or address.
  const bbox=[lon-b,lat-a,lon+b,lat+a].map(n=>n.toFixed(3)).join(",");
  const url="https://www.openstreetmap.org/export/embed.html?bbox="+encodeURIComponent(bbox)+"&layer=mapnik";
  return `<div class="approx-map"><iframe src="${esc()(url)}" title="Approximate area map; exact property location not shown" loading="lazy" tabindex="-1" referrerpolicy="no-referrer" aria-hidden="true"></iframe><div class="map-overlay">Approximate area • ${esc()(x.city||"Nearby")}${x.zip?" / "+esc()(x.zip):""}<br><small>Exact location shared after your request</small></div></div>`;
}
function listingCard(x){
  const u=esc(),images=Array.isArray(x.images)?x.images:[];
  const img=images.length?`<img src="${u(images[0])}" alt="Apartment interior" loading="lazy" onerror="this.parentElement.textContent='No images available'">`:"No images available";
  const badges=[];if(x.availableNow)badges.push('<span class="badge green">Available now</span>');
  if(x.specialSummary)badges.push('<span class="badge orange">Special</span>');
  for(const [key,label] of [["oneApp","OneApp"],["theGuarantors","TheGuarantors"],["jetty","Jetty"],["libertyRent","Liberty Rent"],["rhino","Rhino"],["leap","Leap"],["insurent","Insurent"],["cosign","Cosign"]])if(supportYes(x.support,key))badges.push(`<span class="badge">${label}</span>`);
  if(x.support?.affordableProgram)badges.push('<span class="badge green">Income-restricted program</span>');
  const id=u(x.floorplanId||""),schedule=SiteUtil.scheduleUrl(x.floorplanId),detail=SiteUtil.listingUrl(x);
  return `<article class="listing-card"><a class="listing-media" href="${u(detail)}" aria-label="View ${u(x.communityName||x.floorplanName||"apartment")}">${img}</a><div class="listing-body"><div class="listing-title"><a href="${u(detail)}">${u(x.communityName||"Apartment community")}</a></div>
   <div class="listing-meta">${u(x.floorplanName||"Apartment")} • ${u(x.beds??"?")} bd • ${u(x.baths??"?")} ba${x.sqft?" • "+u(x.sqft)+" sq ft":""}</div>
   <div class="rent">${SiteUtil.money(x.netEffectiveRent||x.baseRent)}</div>
   <div class="listing-meta">${u([x.city,x.state,x.zip].filter(Boolean).join(", "))}</div>
   ${x.specialSummary?'<div class="listing-meta"><strong>Special:</strong> '+u(x.specialSummary)+'</div>':""}
   ${areaMap(x)}<div class="badges">${badges.join("")}</div>
   <div class="listing-actions"><a class="btn secondary" href="${u(detail)}">View floorplan</a>
   <button class="btn primary tour-modal-trigger" type="button" data-floorplan-id="${id}">Schedule tour</button>
   <button class="btn secondary share-listing" type="button" data-share-url="${u(schedule)}">Share</button></div></div></article>`;
}
function applyFilters(){
  const q=document.getElementById("q").value.trim().toLowerCase(),city=document.getElementById("city").value,beds=document.getElementById("beds").value,
   max=Number(document.getElementById("maxRent").value||0),available=document.getElementById("available").checked,
   approval=document.getElementById("approval").checked,affordable=document.getElementById("affordable").checked;
  const filtered=allListings.filter(x=>{
    const hay=[x.communityName,x.floorplanName,x.city,x.zip].join(" ").toLowerCase();if(q&&!hay.includes(q))return false;
    if(city&&x.city!==city)return false;
    if(beds!==""&&((beds==="4"&&Number(x.beds)<4)||(beds!=="4"&&Number(x.beds)!==Number(beds))))return false;
    const rent=Number(x.netEffectiveRent||x.baseRent||0);if(max&&rent&&rent>max)return false;
    if(available&&!x.availableNow)return false;
    if(approval&&!(x.support?.oneApp||x.support?.theGuarantors||x.support?.jetty||x.support?.libertyRent||x.support?.rhino||x.support?.leap||x.support?.insurent||x.support?.cosign))return false;
    if(affordable&&!x.support?.affordableProgram)return false;return true;
  });
  document.getElementById("count").textContent=`${filtered.length} listing${filtered.length===1?"":"s"}`;
  document.getElementById("listingGrid").innerHTML=filtered.length?filtered.map(listingCard).join(""):'<div class="empty-state">No listings match these filters.</div>';
}
async function loadListings(){
  const status=document.getElementById("loadStatus");
  try{status.textContent="Loading listings…";const data=await ApartmentApi.jsonp("publicSiteListings",{criteria:{availableOnly:false}});
    allListings=Array.isArray(data.results)?data.results:[];
    const cities=[...new Set(allListings.map(x=>x.city).filter(Boolean))].sort();
    document.getElementById("city").innerHTML='<option value="">All cities</option>'+cities.map(c=>`<option>${esc()(c)}</option>`).join("");
    status.classList.add("hidden");applyFilters();
  }catch(err){status.textContent=err.message;status.className="status bad";}
}
document.addEventListener("click",async e=>{
  const tour=e.target.closest(".tour-modal-trigger");if(tour){SiteUtil.openTourModal(tour.dataset.floorplanId);return;}
  const share=e.target.closest(".share-listing");if(!share)return;
  const url=share.dataset.shareUrl;try{if(navigator.share)await navigator.share({title:"Apartment option",url});else await navigator.clipboard.writeText(url);}catch(_){}
});
document.addEventListener("DOMContentLoaded",()=>{
  ["q","city","beds","maxRent","available","approval","affordable"].forEach(id=>document.getElementById(id).addEventListener(id==="q"||id==="maxRent"?"input":"change",applyFilters));
  loadListings();
});
