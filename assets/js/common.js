"use strict";
(function(){
  function nav(){
    return `<header class="site-header"><nav class="nav"><a class="brand" href="/">${escapeHtml((window.APARTMENT_SITE_CONFIG||{}).brandName||"Real Estate")}</a><div class="nav-links"><a href="/listings/">Listings</a><a href="/services/">Services</a><a href="/approval-help/">Credit / Lease Help</a><a href="/affordable-housing/">Affordable Housing</a><a href="/about/">About</a><a href="/schedule-tour/">Schedule Tour</a></div><a class="mobile-nav btn secondary" href="/listings/">Listings</a></nav></header>`;
  }
  function footer(){return `<footer class="footer"><div class="footer-inner">Information is subject to change and should be verified with the property. Availability, pricing, specials, screening criteria and program eligibility are controlled by each housing provider.</div></footer>`;}
  function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
  function money(v){const n=Number(v);return Number.isFinite(n)&&n>0?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n):"Call for pricing";}
  function renderShell(){document.querySelectorAll("[data-site-header]").forEach(x=>x.innerHTML=nav());document.querySelectorAll("[data-site-footer]").forEach(x=>x.innerHTML=footer());}
  document.addEventListener("DOMContentLoaded",renderShell);
  window.SiteUtil={escapeHtml,money,renderShell};
})();
