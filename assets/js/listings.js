"use strict";
let allListings=[];
const esc=()=>SiteUtil.escapeHtml;
function supportYes(s,key){return Boolean(s&&s[key]===true);}
function housingTypeOf(x){
  const type=String(x.support?.housingType||"").trim();
  if(["Conventional","Affordable","55+","Student"].includes(type))return type;
  if(x.support?.affordableProgram)return "Affordable";
  return "";
}
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
  const type=housingTypeOf(x);
  badges.unshift(type?'<span class="badge housing">'+u(type)+' housing</span>':'<span class="badge unverified">Housing type unverified</span>');
  if(supportYes(x.support,"creditIssuesConsidered"))badges.push('<span class="badge green">Credit issues considered</span>');
  if(supportYes(x.support,"evictionIssuesConsidered"))badges.push('<span class="badge green">Eviction issues considered</span>');
  if(x.support?.affordableProgram)badges.push('<span class="badge green">Income-restricted program</span>');
  const id=u(x.floorplanId||""),schedule=SiteUtil.scheduleUrl(x.floorplanId),detail=SiteUtil.listingUrl(x);
  const title=u(SiteUtil.publicListingTitle(x));
  return `<article class="listing-card"><a class="listing-media" href="${u(detail)}" aria-label="View ${title}">${img}</a><div class="listing-body"><div class="listing-title"><a href="${u(detail)}">${title}</a></div>
   <div class="listing-meta">${u(x.beds??"?")} bd • ${u(x.baths??"?")} ba${x.sqft?" • "+u(x.sqft)+" sq ft":""}</div>
   <div class="rent">${SiteUtil.money(x.netEffectiveRent||x.baseRent)}</div>
   <div class="listing-meta">${u([x.city,x.state,x.zip].filter(Boolean).join(", "))}</div>
   ${x.specialSummary?'<div class="listing-meta"><strong>Special:</strong> '+u(x.specialSummary)+'</div>':""}
   ${areaMap(x)}<div class="badges">${badges.join("")}</div>
   <div class="listing-actions"><a class="btn secondary" href="${u(detail)}">View floorplan</a>
   <button class="btn primary tour-modal-trigger" type="button" data-floorplan-id="${id}">Schedule tour</button>
   <button class="btn secondary share-listing" type="button" data-share-url="${u(schedule)}">Share</button></div></div></article>`;
}
function applyFilters(){
  const q=document.getElementById("q").value.trim().toLowerCase();
  const city=document.getElementById("city").value;
  const beds=document.getElementById("beds").value;
  const max=Number(document.getElementById("maxRent").value||0);
  const housingType=document.getElementById("housingType").value;
  const available=document.getElementById("available").checked;
  const affordable=document.getElementById("affordable").checked;
  const creditIssues=document.getElementById("creditIssues").checked;
  const evictionIssues=document.getElementById("evictionIssues").checked;
  const filtered=allListings.filter(x=>{
    const hay=[x.areaLabel,x.city,x.state,x.zip,SiteUtil.publicListingTitle(x)].filter(Boolean).join(" ").toLowerCase();
    if(q&&!hay.includes(q))return false;
    if(city&&x.city!==city)return false;
    if(beds!==""&&((beds==="4"&&Number(x.beds)<4)||(beds!=="4"&&Number(x.beds)!==Number(beds))))return false;
    const rent=Number(x.netEffectiveRent||x.baseRent||0);
    if(max&&rent&&rent>max)return false;
    if(available&&!x.availableNow)return false;
    if(housingType&&housingTypeOf(x)!==housingType)return false;
    if(affordable&&housingTypeOf(x)!=="Affordable"&&!x.support?.affordableProgram)return false;
    if(creditIssues&&!supportYes(x.support,"creditIssuesConsidered"))return false;
    if(evictionIssues&&!supportYes(x.support,"evictionIssuesConsidered"))return false;
    return true;
  });
  document.getElementById("count").textContent=filtered.length+" listing"+(filtered.length===1?"":"s");
  document.getElementById("listingGrid").innerHTML=filtered.length?filtered.map(listingCard).join(""):'<div class="empty-state">No listings currently match these verified filters. A property may still consider your situation even if it has not been verified. <a href="../custom-search/?help=assistance">Get free help checking options</a>.</div>';
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
  ["q","city","beds","maxRent","housingType","available","creditIssues","evictionIssues","affordable"].forEach(id=>document.getElementById(id).addEventListener(id==="q"||id==="maxRent"?"input":"change",applyFilters));
  const params=new URLSearchParams(location.search);
  if(params.get("affordable")==="1")document.getElementById("affordable").checked=true;
  if(params.get("secondChance")==="1"){
    const disclaimer=document.querySelector(".search-disclaimer");
    if(disclaimer)disclaimer.insertAdjacentText("afterbegin","Need second-chance help? Select credit or eviction issues to see only verified options, or contact your locator to check other properties. ");
  }
  loadListings();
});
