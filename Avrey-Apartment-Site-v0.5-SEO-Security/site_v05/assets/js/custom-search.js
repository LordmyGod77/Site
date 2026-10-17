"use strict";
document.addEventListener("DOMContentLoaded",()=>{
 const form=document.getElementById("customSearchForm"),status=document.getElementById("customStatus");form.submittedAt.value=Date.now();SiteUtil.mountTurnstile(form);
 form.addEventListener("submit",async e=>{
  e.preventDefault();const button=form.querySelector('button[type="submit"]');
  if(!form.turnstileToken.value){status.textContent="Complete the security check first.";status.className="status bad";return;}
  const submissionId="SEARCH-"+(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2));
  const req={action:"publicSubmitCustomSearch",submissionId,turnstileToken:form.turnstileToken.value,submittedAt:Number(form.submittedAt.value),website:form.website.value,
   lead:{firstName:form.firstName.value.trim(),lastName:form.lastName.value.trim(),email:form.email.value.trim(),phone:form.phone.value.trim()},
   preferredArea:form.preferredArea.value.trim(),maxRent:Number(form.maxRent.value),beds:form.beds.value===""?null:Number(form.beds.value),moveInDate:form.moveInDate.value,
   incomeRange:form.incomeRange.value,screeningFlags:[...form.querySelectorAll('input[name="screeningFlag"]:checked')].map(x=>x.value)};
  try{button.disabled=true;status.textContent="Submitting your request…";status.className="status";
   await ApartmentApi.postForm(req);const result=await ApartmentApi.pollSubmission(submissionId,{timeoutMs:45000});
   if(result.status==="Completed"){status.textContent="Your shortlist has been emailed. Check your inbox; reply to discuss any screening questions.";status.className="status good";}
   else if(result.status==="Processing"){status.textContent="Your request is processing. Please do not resubmit.";}
   else if(result.status==="NeedsFollowUp"){status.textContent="Your search request was recorded. We will follow up with nearby options.";status.className="status";}
   else{status.textContent="We could not confirm this request. Contact us before submitting again.";status.className="status bad";}
   form.querySelectorAll("input,select,button").forEach(x=>x.disabled=true);
  }catch(err){status.textContent=err.message;status.className="status bad";button.disabled=false;}
 });
});
