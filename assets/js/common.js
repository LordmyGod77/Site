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
    return `<header class="site-header"><nav class="nav"><a class="brand" href="${escapeHtml(siteUrl())}">${brand}</a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="siteNavLinks">Menu</button><div id="siteNavLinks" class="nav-links">${navLink("listings/","Listings")}${navLink("services/","Services")}${navLink("approval-help/","Credit / Lease Help")}${navLink("affordable-housing/","Affordable Housing")}${navLink("about/","About")}${navLink("schedule-tour/","Schedule Tour")}</div></nav></header>`;
  }

  function footer(){
    return `<footer class="footer"><div class="footer-inner">Information is subject to change and should be verified with the property. Availability, pricing, specials, screening criteria and program eligibility are controlled by each housing provider.</div></footer>`;
  }

  function renderShell(){
    document.querySelectorAll("[data-site-header]").forEach(x=>x.innerHTML=nav());
    document.querySelectorAll("[data-site-footer]").forEach(x=>x.innerHTML=footer());
    const toggle=document.querySelector(".menu-toggle");
    const links=document.getElementById("siteNavLinks");
    if(toggle&&links){
      toggle.addEventListener("click",()=>{
        const open=links.classList.toggle("open");
        toggle.setAttribute("aria-expanded",String(open));
      });
    }
  }

  document.addEventListener("DOMContentLoaded",renderShell);
  window.SiteUtil={escapeHtml,money,renderShell,siteUrl,scheduleUrl,siteBase:SITE_BASE.href};
})();
