"use strict";
function row(x){
 const u=SiteUtil.escapeHtml,s=x.support||{},flags=[s.oneApp&&"OneApp",s.theGuarantors&&"TheGuarantors",s.jetty&&"Jetty",s.libertyRent&&"Liberty Rent",s.rhino&&"Rhino",s.leap&&"Leap",s.insurent&&"Insurent",s.cosign&&"Cosign"].filter(Boolean);
 return `<tr><td>Apartment option</td><td>${u(x.floorplanName||"Apartment")}</td><td>${u([x.city,x.state].filter(Boolean).join(", "))}</td><td>${u(flags.join(", "))}</td><td>${u(s.verifiedAt||"")}</td><td><button class="btn secondary tour-modal-trigger" type="button" data-floorplan-id="${u(x.floorplanId)}">Ask / tour</button></td></tr>`;
}
async function load(){const box=document.getElementById("approvalRows");try{
  const r=await ApartmentApi.jsonp("publicSiteListings",{criteria:{availableOnly:false}});
  const data=(r.results||[]).filter(x=>x.support&&(x.support.oneApp||x.support.theGuarantors||x.support.jetty||x.support.libertyRent||x.support.rhino||x.support.leap||x.support.insurent||x.support.cosign));
  box.innerHTML=data.length?data.map(row).join(""):'<tr><td colspan="6">No participating properties have been verified yet.</td></tr>';
 }catch(e){box.innerHTML=`<tr><td colspan="6">${SiteUtil.escapeHtml(e.message)}</td></tr>`;}
}
document.addEventListener("click",e=>{const b=e.target.closest(".tour-modal-trigger");if(b)SiteUtil.openTourModal(b.dataset.floorplanId);});
document.addEventListener("DOMContentLoaded",load);
