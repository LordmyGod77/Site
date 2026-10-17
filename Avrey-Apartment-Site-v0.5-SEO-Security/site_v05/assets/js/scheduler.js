"use strict";
let currentFloorplan=null;
let currentTourOptions=null;
const floorplanId=()=>new URLSearchParams(location.search).get("floorplan-id")||"";
function summary(x){
  const u=SiteUtil.escapeHtml;
  return `<div class="panel"><span class="pill">Selected apartment</span><h2>Apartment option</h2>
   <p class="muted">${u(x.floorplanName||"Apartment")} • ${u(x.beds??"?")} bed • ${u(x.baths??"?")} bath${x.sqft?" • "+u(x.sqft)+" sq ft":""}</p>
   <p><strong>${SiteUtil.money(x.netEffectiveRent||x.baseRent)}</strong></p>
   <p class="muted">${u([x.city,x.state,x.zip].filter(Boolean).join(", "))}. The property name, address and website are sent privately after your guest card and tour request are successfully submitted.</p></div>`;
}

async function init(){
  const id=floorplanId(); document.getElementById("floorplanId").value=id;
  if(!id){
    const picker=document.getElementById("floorplanPicker"); const form=document.getElementById("tourForm"); picker.classList.remove("hidden"); form.classList.add("hidden");
    try{const data=await ApartmentApi.jsonp("publicSiteListings",{criteria:{availableOnly:false}});const rows=Array.isArray(data.results)?data.results:[];const sel=document.getElementById("floorplanSelect");sel.innerHTML='<option value="">Choose a floorplan</option>'+rows.map(x=>`<option value="${SiteUtil.escapeHtml(x.floorplanId)}">${SiteUtil.escapeHtml((x.floorplanName||"Apartment")+" — "+SiteUtil.money(x.netEffectiveRent||x.baseRent))}</option>`).join("");document.getElementById("chooseFloorplan").onclick=()=>{if(sel.value)location.href=SiteUtil.scheduleUrl(sel.value);};document.getElementById("listingSummary").innerHTML='<div class="status">Choose a listing above to load its details and request a tour.</div>';}catch(e){document.getElementById("listingSummary").innerHTML=`<div class="status bad">${SiteUtil.escapeHtml(e.message)}</div>`;}
    return;
  }
  try{ currentFloorplan=await ApartmentApi.jsonp("publicSiteFloorplan",{floorplanId:id}); document.getElementById("listingSummary").innerHTML=summary(currentFloorplan); const options=await ApartmentApi.jsonp("publicTourOptions",{floorplanId:id}); currentTourOptions=options; const slot=document.getElementById("tourSlot"); if(Array.isArray(options.slots)&&options.slots.length){slot.innerHTML='<option value="">Choose a live/cached slot</option>'+options.slots.map(s=>`<option value="${SiteUtil.escapeHtml(typeof s==="string"?s:(s.value||s.label||""))}">${SiteUtil.escapeHtml(typeof s==="string"?s:(s.label||s.value||""))}</option>`).join(""); document.getElementById("slotWrap").classList.remove("hidden");} }
  catch(e){document.getElementById("listingSummary").innerHTML=`<div class="status bad">${SiteUtil.escapeHtml(e.message)}</div>`;}
}
function splitName(name){const p=String(name||"").trim().split(/\s+/);return {firstName:p.shift()||"",lastName:p.join(" ")||""};}
async function submit(e){
  e.preventDefault(); const f=e.currentTarget; const btn=document.getElementById("submitTour"); const status=document.getElementById("submitStatus");
  if(!floorplanId()){status.textContent="Missing floorplan ID.";status.className="status bad";return;}
  if(!f.turnstileToken.value){status.textContent="Complete the security check first.";status.className="status bad";return;}
  const submissionId="WEB-"+(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2));
  const request={action:"publicSubmitLeadTour",submissionId,turnstileToken:f.turnstileToken.value,floorplanId:floorplanId(),website:String(f.website.value||""),submittedAt:Number(f.submittedAt.value||0),source:"website",lead:{firstName:f.firstName.value.trim(),lastName:f.lastName.value.trim(),email:f.email.value.trim(),phone:f.phone.value.trim(),moveIn:f.moveIn.value,area:[currentFloorplan?.city,currentFloorplan?.state].filter(Boolean).join(", "),budget:Number(f.budget.value||0),beds:currentFloorplan?.beds??"",baths:currentFloorplan?.baths??"",creditStatus:f.creditStatus.value,backgroundIssues:[],pets:f.notes.value.trim(),smsConsent:Boolean(f.smsConsent.checked)},tour:{tourDate:f.tourDate.value,tourTime:f.tourTime.value,tourSlot:f.tourSlot.value,note:f.notes.value.trim()}};
  let completed=false;
  try{btn.disabled=true;status.textContent="Registering your guest card and tour request…";status.className="status";await ApartmentApi.postForm(request);const result=await ApartmentApi.pollSubmission(submissionId); if(result.status==="Completed"){completed=true;status.textContent="Your guest card and tour request have been sent. Check your email for a private, time-limited link to the property's name, address and official website. The property must still confirm your tour.";status.className="status good";f.querySelectorAll("input,select,textarea,button").forEach(x=>x.disabled=true);} else if(result.status==="Processing"){status.textContent="Your request was received and is still processing. Please do not submit it again.";status.className="status";} else if(result.status==="NeedsFollowUp"){status.textContent="Your request was recorded, but a step needs follow-up. Please do not submit a duplicate request; we will contact you.";status.className="status bad";}
  else{status.textContent="We could not confirm your request. Please contact us before trying again to avoid duplicate requests.";status.className="status bad";}}
  catch(err){status.textContent=err.message;status.className="status bad";} finally{btn.disabled=completed;}
}
document.addEventListener("DOMContentLoaded",()=>{if(new URLSearchParams(location.search).get("embed")==="1")document.documentElement.classList.add("embed-tour");document.getElementById("submittedAt").value=Date.now();SiteUtil.mountTurnstile(document.getElementById("tourForm"));document.getElementById("tourForm").addEventListener("submit",submit);init();});
