"use strict";
// Public listings are anonymous. Media and broad map centers originate in the
// reviewed Cloudflare public preview API, never raw website scrape URLs.
let allListings=[];
let visibleLimit=24;
const mediaSlideIndex=new Map();
const failedMedia=new Map();
const esc=()=>SiteUtil.escapeHtml;
const supportYes=(s,key)=>Boolean(s&&s[key]===true);
const imageUrl=url=>{try{const p=new URL(url,location.href);return p.protocol==="https:"||p.origin===location.origin?p.href:"";}catch(_){return "";}};
function housingTypeOf(x){
  const type=String(x.support?.housingType||"").trim();
  if(["Conventional","Affordable","55+","Student"].includes(type))return type;
  if(x.support?.affordableProgram)return "Affordable";
  return "";
}
function areaMap(x,{exact=false}={}){
  const m=exact?x.exactMap:x.areaMap;
  const latitude=Number(m?.latitude),longitude=Number(m?.longitude);
  if(!m||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){
    return '<div class="ap-map-empty">Area map available after location verification. '+esc()(SiteUtil.publicLocation(x))+'</div>';
  }
  const radiusMiles=exact?1.5:12;
  const dlat=radiusMiles/69.0;
  const dlon=radiusMiles/(69*Math.max(0.2,Math.cos(latitude*Math.PI/180)));
  const bbox=[longitude-dlon,latitude-dlat,longitude+dlon,latitude+dlat].map(n=>n.toFixed(5)).join(",");
  const source="https://www.openstreetmap.org/export/embed.html?bbox="+encodeURIComponent(bbox)+"&layer=mapnik";
  const circle=exact?'<div class="ap-map-pin" aria-label="Exact verified location">📍</div>':'<div class="ap-map-circle" aria-hidden="true"></div>';
  const caption=exact?"Exact property location · Visible to verified account":"Approximate 12-mile search area · No exact property pin";
  return '<div class="ap-map"><iframe loading="lazy" tabindex="-1" aria-hidden="true" referrerpolicy="no-referrer" title="Area map" src="'+esc()(source)+'"></iframe>'+circle+'<div class="ap-map-caption">'+caption+'</div></div>';
}
function approvedMedia(x){
  if(x.privacyContract!=='anonymous-v1')return []; // Legacy media has no explicit rights proof.
  // Never fall back to source URLs, 3D reference images, or unapproved recordings.
  const list=Array.isArray(x.media)?x.media:(
    x.privacyContract==="anonymous-v1"&&Array.isArray(x.images)
      ?x.images.map(url=>({type:"image",url}))
      :[]);
  const failed=failedMedia.get(x.floorplanId)||new Set();
  return list.filter(m=>m&&["image","video"].includes(m.type)&&imageUrl(m.url)&&!failed.has(imageUrl(m.url)))
    .slice(0,100).map(m=>({type:m.type,url:imageUrl(m.url)}));
}
function mediaPanel(x){
  const m=approvedMedia(x),fid=esc()(x.floorplanId||"");
  if(!m.length)return '<div class="ap-media-empty"><div><strong>Photos coming soon</strong><br><span>Only images and videos approved for public display appear here.</span></div></div>';
  const active=mediaSlideIndex.get(x.floorplanId)||0;
  const index=Math.min(active,m.length-1);
  const current=m[index];
  const poster=m.find(item=>item.type==="image")?.url||"";
  const view=current.type==="video"
    ?'<video controls preload="metadata" playsinline '+(poster?'poster="'+esc()(poster)+'" ':'')+'src="'+esc()(current.url)+'" aria-label="Apartment video preview">Your browser does not support video.</video>'
    :'<img loading="lazy" decoding="async" src="'+esc()(current.url)+'" alt="Approved apartment photo '+(index+1)+'">';
  return '<div class="ap-media" data-media-id="'+fid+'">'+view+
    (m.length>1?'<button class="ap-arrow ap-prev" type="button" data-media-step="-1" aria-label="Previous media">‹</button><button class="ap-arrow ap-next" type="button" data-media-step="1" aria-label="Next media">›</button>':'')+
    '<span class="ap-counter">'+(index+1)+' / '+m.length+(current.type==="video"?" · Video":" · Photo")+'</span></div>';
}
function listingCard(x){
  const u=esc(),badges=[];
  if(x.availableNow)badges.push('<span class="badge green">Available now</span>');
  if(x.specialSummary)badges.push('<span class="badge orange">Special</span>');
  const type=housingTypeOf(x);
  badges.unshift(type?'<span class="badge housing">'+u(type)+' housing</span>':'<span class="badge unverified">Housing type not verified</span>');
  if(supportYes(x.support,"creditIssuesConsidered"))badges.push('<span class="badge green">Credit concerns considered</span>');
  if(supportYes(x.support,"evictionIssuesConsidered"))badges.push('<span class="badge green">Eviction history considered</span>');
  if(x.support?.affordableProgram)badges.push('<span class="badge green">Affordable program</span>');
  const detail=SiteUtil.listingUrl(x),title=u(SiteUtil.publicListingTitle(x)),fid=u(x.floorplanId||"");
  const label=u(SiteUtil.publicLocation(x));
  return '<article class="listing-card">'+mediaPanel(x)+'<div class="listing-body">'+
    '<div class="listing-title"><a href="'+u(detail)+'">'+title+'</a></div>'+
    '<div class="listing-meta">'+label+'</div>'+
    '<div class="listing-meta">'+u(x.beds??"?")+' beds · '+u(x.baths??"?")+' baths'+(x.sqft?' · '+u(x.sqft)+' sq ft':'')+'</div>'+
    '<div class="rent">'+SiteUtil.money(x.netEffectiveRent||x.baseRent)+'</div>'+
    (x.specialSummary?'<div class="listing-meta"><strong>Special:</strong> '+u(x.specialSummary)+'</div>':'')+
    '<div class="badges">'+badges.join("")+'</div>'+
    areaMap(x)+'<button class="ap-media-map-trigger" type="button" data-area-map="'+fid+'">Enlarge map / View exact location when signed in</button>'+
    '<div class="listing-actions"><a class="btn secondary" href="'+u(detail)+'">View floorplan</a>'+
    '<button class="btn primary tour-modal-trigger" type="button" data-floorplan-id="'+fid+'">Schedule tour</button>'+
    '<a class="btn secondary" href="../custom-search/?help=assistance">Ask agent</a>'+
    '<button class="btn secondary share-listing" type="button" data-share-url="'+u(detail)+'">Share</button></div></div></article>';
}
function applyFilters(){
  const q=document.getElementById("q").value.trim().toLowerCase(),city=document.getElementById("city").value,beds=document.getElementById("beds").value;
  const max=Number(document.getElementById("maxRent").value||0),type=document.getElementById("housingType").value;
  const available=document.getElementById("available").checked,affordable=document.getElementById("affordable").checked;
  const credit=document.getElementById("creditIssues").checked,eviction=document.getElementById("evictionIssues").checked;
  const requestedFloorplan=new URLSearchParams(location.search).get("floorplan-id")||"";
  const rows=allListings.filter(x=>{
    if(requestedFloorplan&&x.floorplanId!==requestedFloorplan)return false;
    const hay=[x.areaLabel,x.city,x.state,x.zip,SiteUtil.publicListingTitle(x)].filter(Boolean).join(" ").toLowerCase();
    if(q&&!hay.includes(q))return false;
    if(city&&x.city!==city)return false;
    if(beds!==""&&((beds==="4"&&Number(x.beds)<4)||(beds!=="4"&&Number(x.beds)!==Number(beds))))return false;
    const rent=Number(x.netEffectiveRent||x.baseRent||0);
    if(max&&rent&&rent>max)return false;
    if(available&&!x.availableNow)return false;
    if(type&&housingTypeOf(x)!==type)return false;
    if(affordable&&housingTypeOf(x)!=="Affordable"&&!x.support?.affordableProgram)return false;
    if(credit&&!supportYes(x.support,"creditIssuesConsidered"))return false;
    if(eviction&&!supportYes(x.support,"evictionIssuesConsidered"))return false;
    return true;
  });
  document.getElementById("count").textContent=rows.length+" apartment option"+(rows.length===1?"":"s")+" found";
  const shown=rows.slice(0,visibleLimit);
  document.getElementById("listingGrid").innerHTML=rows.length?shown.map(listingCard).join(""):
    '<div class="empty-state">No matches for this combination. A property with unknown policies may still consider you. <a href="../custom-search/?help=assistance">Ask for free assistance.</a></div>';
  const more=document.getElementById("loadMoreListings");
  if(more){more.classList.toggle("hidden",shown.length>=rows.length);more.textContent="Show more apartments · "+shown.length+" of "+rows.length;}
}
async function loadListings(){
  const status=document.getElementById("loadStatus");
  const cfg=window.APARTMENT_SITE_CONFIG||{};
  const mediaApi=String(cfg.approvedMediaApiUrl||"").replace(/\/+$/,"");
  const api=String(cfg.renterApiUrl||"").replace(/\/+$/,"");
  try{
    status.textContent="Loading apartment options…";
    if(mediaApi){
      // Use only the D1/R2 approved-ad catalog. Do not show floorplans with zero approved media.
      const response=await fetch(mediaApi+"/api/public/listing-previews",{mode:"cors",cache:"no-store"});
      if(!response.ok)throw Error("Approved media catalog is unavailable (HTTP "+response.status+").");
      const raw=await response.json(),data=raw.data||raw;
      if(data.privacyContract!=="anonymous-v1"||data.scrapeEligibility!=="approved-media-v1")
        throw Error("Public media approval contract mismatch.");
      allListings=(Array.isArray(data.results)?data.results:[]).filter(x=>
        x.privacyContract==="anonymous-v1"&&x.scrapeEligibility==="approved-media-v1"&&
        approvedMedia(x).length>0);
    }else if(api){
      const response=await fetch(api+"/api/public/listing-previews",{mode:"cors",cache:"no-store"});
      if(!response.ok)throw Error("Verified listing feed unavailable (HTTP "+response.status+").");
      const raw=await response.json(),data=raw.data||raw;
      if(data.privacyContract!=="anonymous-v1"||data.scrapeEligibility!=="configured-successful-scrape-v1")
        throw Error("The verified public listing/privacy contract is not active.");
      allListings=Array.isArray(data.results)?data.results.filter(x=>
        x.privacyContract==="anonymous-v1"&&x.scrapeEligibility==="configured-successful-scrape-v1"&&
        /^\d{5}$/.test(String(x.zip||""))&&String(x.city||"").trim()&&String(x.state||"").trim()):[];
    }else{
      const data=await ApartmentApi.jsonp("publicSiteListings",{criteria:{availableOnly:false}});
      allListings=(Array.isArray(data.results)?data.results:[]).map(x=>({...x,media:[],images:[],areaLabel:"",__legacyCatalog:true}));
    }
    const cities=[...new Set(allListings.map(x=>x.city).filter(Boolean))].sort();
    document.getElementById("city").innerHTML='<option value="">All cities</option>'+cities.map(c=>
      '<option value="'+esc()(c)+'">'+esc()(c)+'</option>').join("");
    status.classList.add("hidden");
    const notice=document.getElementById("mediaSourceNotice");
    if(notice){
      notice.textContent=api
        ?"Only configured, successfully scraped, verified-location listings and approved media appear here. Full details require authorization."
        :"Using the existing listing catalog while the verified Cloudflare feed is prepared. Photos await confirmed public-use rights; screening details should be reconfirmed with each property.";
      notice.classList.remove("hidden");
    }
    applyFilters();
  }catch(err){status.textContent="Listings could not be loaded: "+err.message;status.className="status bad";}
}
async function areaDialog(floorplanId){
  const x=allListings.find(item=>item.floorplanId===floorplanId);if(!x)return;
  let d=document.getElementById("apAreaDialog");
  if(!d){d=document.createElement("dialog");d.id="apAreaDialog";d.className="ap-map-dialog";document.body.append(d);}
  const heading=SiteUtil.publicListingTitle(x);
  const exactAvailable=false; // Private location disclosure awaits verified renter sign-in.
  d.innerHTML='<button class="modal-close" type="button" aria-label="Close map">×</button><h2>'+esc()(heading)+'</h2>'+
    '<p class="ap-entry-notice" id="apMapInfo">Map shows a broad search area, not the exact apartment location.</p>'+areaMap(x);
  d.querySelector(".modal-close").onclick=()=>d.close();
  if(!d.open)d.showModal();
  if(exactAvailable){
    try{
      const data=await window.RenterPortal.privateDetail(floorplanId);
      if(!d.open)return;
      if(data?.coordinates&&Number.isFinite(Number(data.coordinates.latitude))&&Number.isFinite(Number(data.coordinates.longitude))){
        d.querySelector(".ap-map").outerHTML=areaMap({...x,exactMap:data.coordinates},{exact:true});
        d.querySelector("#apMapInfo").textContent=data.address||"Verified location";
      }
    }catch(_){d.querySelector("#apMapInfo").textContent="Exact location is unavailable right now. Showing the approximate area.";}
  }
}
const helpCopy={
  q:["Area search","Search a city, ZIP code, or broad part of town. Property names and exact addresses are intentionally hidden from anonymous listings."],
  city:["City","Limit the search to the municipality you want to live in. This helps separate nearby markets with different availability and commute patterns."],
  beds:["Bedrooms","Set the number of bedrooms you need. Studio means no separate bedroom; 4+ includes units with at least four bedrooms."],
  maxRent:["Maximum monthly rent","Show published options within your stated monthly limit. Fees, utilities, specials and screening requirements may change the total."],
  housingType:["Housing type","Conventional means standard market-rate housing; Affordable means a verified restricted or assisted program; 55+ and Student indicate specialized housing. Unknown categories are not guessed."],
  creditIssues:["Credit issues","Only shows properties whose willingness to consider credit concerns has been explicitly documented. Consideration never guarantees approval; qualifying criteria and fees still apply."],
  evictionIssues:["Eviction issues","Only shows properties with documented willingness to consider eviction history. Screening varies by circumstances and property. If none appear, ask your locator to verify alternatives."],
  affordable:["Affordable housing","Filter to units with a verified affordable/income-restricted designation. Specific household-size and income rules must still be confirmed."],
  available:["Available now","Show properties reporting current availability. Listings may change before the leasing office confirms a specific unit."]
};
function mountHelp(){
  for(const [id,[title,body]] of Object.entries(helpCopy)){
    const field=document.getElementById(id);if(!field)continue;
    const holder=field.closest("label")||field.parentElement;
    const btn=document.createElement("button");
    btn.type="button";btn.className="ap-help";btn.textContent="?";btn.setAttribute("aria-label","Explain "+title);btn.dataset.help=id;
    if(field.tagName==="INPUT"&&field.type==="checkbox")holder.append(btn);
    else holder.insertBefore(btn,field);
  }
}
// A missing/broken R2 object should never strand the entire carousel.
document.addEventListener("error",e=>{
  const element=e.target;
  if(!(element instanceof HTMLImageElement||element instanceof HTMLVideoElement))return;
  const root=element.closest(".ap-media");if(!root)return;
  const fid=root.dataset.mediaId,x=allListings.find(item=>item.floorplanId===fid);
  if(!x)return;
  const url=element.currentSrc||element.src;
  if(!failedMedia.has(fid))failedMedia.set(fid,new Set());
  failedMedia.get(fid).add(url);
  mediaSlideIndex.set(fid,0);
  const replacement=document.createElement("div");replacement.innerHTML=mediaPanel(x);
  root.replaceWith(replacement.firstElementChild);
},true);
document.addEventListener("click",async e=>{
  const tour=e.target.closest(".tour-modal-trigger");
  if(tour){SiteUtil.openTourModal(tour.dataset.floorplanId);return;}
  const share=e.target.closest(".share-listing");
  if(share){const url=share.dataset.shareUrl;try{if(navigator.share)await navigator.share({title:"Apartment option",url});else await navigator.clipboard.writeText(url);}catch(_){}return;}
  const slide=e.target.closest("[data-media-step]");
  if(slide){
    const root=slide.closest("[data-media-id]");const x=allListings.find(item=>item.floorplanId===root?.dataset.mediaId);
    if(!x)return;
    const media=approvedMedia(x);if(media.length<2)return;
    const n=((mediaSlideIndex.get(x.floorplanId)||0)+Number(slide.dataset.mediaStep)+media.length)%media.length;
    mediaSlideIndex.set(x.floorplanId,n);
    const el=document.createElement("div");el.innerHTML=mediaPanel(x);
    root.replaceWith(el.firstElementChild);
    return;
  }
  if(e.target.closest("#loadMoreListings")){visibleLimit+=24;applyFilters();return;}
  const help=e.target.closest("[data-help]");
  if(help){
    const item=helpCopy[help.dataset.help];if(!item)return;
    let dialog=document.getElementById("apHelpDialog");
    if(!dialog){dialog=document.createElement("dialog");dialog.id="apHelpDialog";dialog.className="ap-help-dialog";document.body.append(dialog);}
    dialog.innerHTML='<button class="modal-close" type="button" aria-label="Close explanation">×</button><h2>'+esc()(item[0])+'</h2><p>'+esc()(item[1])+'</p>';
    dialog.querySelector(".modal-close").onclick=()=>dialog.close();
    dialog.showModal();return;
  }
  const map=e.target.closest("[data-area-map]");
  if(map){areaDialog(map.dataset.areaMap);return;}
});
document.addEventListener("DOMContentLoaded",()=>{
  ["q","city","beds","maxRent","housingType","available","creditIssues","evictionIssues","affordable"].forEach(id=>{
    const field=document.getElementById(id);
    field?.addEventListener(id==="q"||id==="maxRent"?"input":"change",()=>{visibleLimit=24;applyFilters();});
  });
  mountHelp();
  const params=new URLSearchParams(location.search);
  if(params.get("affordable")==="1")document.getElementById("affordable").checked=true;
  if(params.get("secondChance")==="1"){
    const disclaimer=document.querySelector(".search-disclaimer");
    if(disclaimer)disclaimer.prepend("Looking for second-chance options? Use the credit or eviction filters below. ");
  }
  loadListings();
});