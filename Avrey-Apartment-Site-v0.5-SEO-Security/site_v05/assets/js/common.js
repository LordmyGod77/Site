"use strict";
(function(){
  function locateSiteBase(){
    const scripts=[...document.scripts];
    const self=scripts.find(s=>/\/assets\/js\/common\.js(?:\?|$)/.test(s.src));
    if(self?.src){
      return new URL("../../",self.src);
    }
    return new URL("./",location.href);
  }

  const SITE_BASE=locateSiteBase();

  function siteUrl(path=""){
    const clean=String(path||"").replace(/^\/+/,"");
    return new URL(clean,SITE_BASE).href;
  }

  function scheduleUrl(floorplanId=""){
    const cfg=window.APARTMENT_SITE_CONFIG||{};
    const configured=String(cfg.scheduleBaseUrl||"").trim();
    let url;
    if(configured && !configured.includes("PASTE_")){
      url=new URL(configured);
    }else{
      url=new URL("schedule-tour/",SITE_BASE);
    }
    if(floorplanId) url.searchParams.set("floorplan-id",String(floorplanId));
    return url.href;
  }

  function escapeHtml(v){
    return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  }

  function money(v){
    const n=Number(v);
    return Number.isFinite(n)&&n>0
      ? new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n)
      : "Call for pricing";
  }

  function navLink(path,label){
    const href=siteUrl(path);
    const here=new URL(location.href);
    const target=new URL(href);
    const active=here.pathname===target.pathname || (target.pathname!==SITE_BASE.pathname && here.pathname.startsWith(target.pathname));
    return `<a${active?' class="active"':''} href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  }

  function nav(){
    const brand=escapeHtml((window.APARTMENT_SITE_CONFIG||{}).brandName||"Real Estate");
    return `<header class="site-header"><nav class="nav"><a class="brand" href="${escapeHtml(siteUrl())}">${brand}</a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="siteNavLinks">Menu</button><div id="siteNavLinks" class="nav-links">${navLink("listings/","Listings")}${navLink("services/","Services")}${navLink("approval-help/","Credit / Lease Help")}${navLink("affordable-housing/","Affordable Housing")}${navLink("about/","About")}${navLink("custom-search/","Free Custom Search")}${navLink("schedule-tour/","Schedule Tour")}</div></nav></header>`;
  }

  function footer(){
    const config=window.APARTMENT_SITE_CONFIG||{};
    const iabs=String(config.iabsUrl||"").trim();
    const cn1=String(config.cn1Url||"").trim();
    const iabsLink=iabs?`<a href="${escapeHtml(iabs)}" target="_blank" rel="noopener">Texas Real Estate Commission Information About Brokerage Services</a>`:
      '<span class="notice-missing">IABS: completed form link must be configured before launch</span>';
    const cnLink=cn1?`<a href="${escapeHtml(cn1)}" target="_blank" rel="noopener">Texas Real Estate Commission Consumer Protection Notice</a>`:
      '<span class="notice-missing">Consumer Protection Notice link must be configured before launch</span>';
    return `<footer class="footer"><div class="footer-inner"><nav class="footer-links" aria-label="Legal and consumer disclosures">
      <a href="${escapeHtml(siteUrl("privacy/"))}">Privacy Policy</a>
      <a href="${escapeHtml(siteUrl("terms/"))}">Terms & Conditions</a>${iabsLink}${cnLink}</nav>
      <p>Pricing, availability, promotions and screening decisions are controlled by the housing provider. A tour request is not a confirmed booking.</p></div></footer>`;
  }
  function openTourModal(id){
    if(!id)return;
    document.getElementById("siteTourDialog")?.remove();
    const d=document.createElement("dialog");d.id="siteTourDialog";d.className="tour-dialog";
    const url=new URL(scheduleUrl(id));url.searchParams.set("embed","1");
    d.innerHTML=`<div class="tour-dialog-head"><strong>Request apartment information & tour</strong><button type="button" class="modal-close" aria-label="Close request">✕</button></div><iframe title="Apartment information and tour request" src="${escapeHtml(url.href)}"></iframe>`;
    document.body.appendChild(d);
    d.querySelector(".modal-close").addEventListener("click",()=>d.close());
    d.addEventListener("close",()=>d.remove());
    d.addEventListener("click",event=>{if(event.target===d)d.close();});
    d.showModal();
  }
  function mountTurnstile(form){
    const slot=form.querySelector(".turnstile-slot");
    const config=window.APARTMENT_SITE_CONFIG||{};
    if(!slot)return;
    const siteKey=String(config.turnstileSiteKey||"").trim();
    const field=form.querySelector('input[name="turnstileToken"]');
    const btn=form.querySelector('button[type="submit"]');
    if(!siteKey){slot.textContent="Security check not configured. Form submission is disabled.";if(btn)btn.disabled=true;return;}
    const render=()=>{if(!window.turnstile)return;
      window.turnstile.render(slot,{sitekey:siteKey,callback:token=>{if(field)field.value=token;},
        "expired-callback":()=>{if(field)field.value="";},
        "error-callback":()=>{if(field)field.value="";}});
    };
    if(window.turnstile){render();return;}
    const script=document.createElement("script");
    script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.onload=render;
    script.onerror=()=>{slot.textContent="Security check unavailable. Please reload this page.";};
    document.head.appendChild(script);
  }
  function renderShell(){
    document.querySelectorAll("[data-site-header]").forEach(x=>x.innerHTML=nav());
    document.querySelectorAll("[data-site-footer]").forEach(x=>x.innerHTML=footer());
    document.querySelectorAll("[data-iabs-notice]").forEach(x=>{
      const url=String((window.APARTMENT_SITE_CONFIG||{}).iabsUrl||"").trim();
      x.innerHTML=url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener">Texas Real Estate Commission Information About Brokerage Services (completed IABS)</a>`:
        '<strong class="notice-missing">The completed IABS notice must be configured before public launch.</strong>';
    });
    const toggle=document.querySelector(".menu-toggle");
    const links=document.getElementById("siteNavLinks");
    if(toggle&&links){
      toggle.addEventListener("click",()=>{
        const open=links.classList.toggle("open");
        toggle.setAttribute("aria-expanded",String(open));
      });
    }
  }

  function slugify(value){
    return String(value||"")
      .normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/&/g," and ")
      .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80) || "apartment";
  }

  function listingPath(listing){
    const city=slugify(listing?.city||"texas");
    const community=slugify(listing?.communityName||"apartment-community");
    const floorplan=slugify(listing?.floorplanName||"floorplan");
    const id=String(listing?.floorplanId||"").replace(/^FP-/i,"").replace(/[^A-Za-z0-9]/g,"").slice(0,10).toLowerCase() || "listing";
    return `apartments/${city}/${community}/${floorplan}-${id}/`;
  }

  function listingUrl(listing){ return siteUrl(listingPath(listing)); }

  document.addEventListener("DOMContentLoaded",renderShell);
  window.SiteUtil={escapeHtml,money,renderShell,siteUrl,scheduleUrl,listingPath,listingUrl,slugify,openTourModal,mountTurnstile,siteBase:SITE_BASE.href};
})();
