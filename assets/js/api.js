"use strict";
(function(){
  const cfg=()=>window.APARTMENT_SITE_CONFIG||{};
  function apiUrl(){
    const url=String(cfg().apiUrl||"").trim();
    if(!url || url.includes("PASTE_APPS_SCRIPT")) throw new Error("Set apiUrl in assets/js/config.js first.");
    return url;
  }
  function jsonp(action, params={}){
    return new Promise((resolve,reject)=>{
      const callback="apCb_"+Date.now()+"_"+Math.random().toString(36).slice(2);
      const script=document.createElement("script");
      const timer=setTimeout(()=>finish(new Error("Backend request timed out.")),20000);
      function finish(err,value){clearTimeout(timer);delete window[callback];script.remove();err?reject(err):resolve(value);}
      window[callback]=payload=>{ if(payload&&payload.success===false) finish(new Error(payload.error||"Request failed.")); else finish(null,payload?.data??payload); };
      const q=new URLSearchParams({action,callback,...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,typeof v==="string"?v:JSON.stringify(v)]))});
      script.src=apiUrl()+"?"+q.toString();
      script.onerror=()=>finish(new Error("Could not reach the website backend."));
      document.head.appendChild(script);
    });
  }
  function postForm(request){
    return new Promise((resolve,reject)=>{
      const iframe=document.createElement("iframe");
      const target="apPost_"+Date.now()+"_"+Math.random().toString(36).slice(2);
      iframe.name=target; iframe.style.display="none"; document.body.appendChild(iframe);
      const form=document.createElement("form"); form.method="POST"; form.action=apiUrl(); form.target=target; form.style.display="none";
      const input=document.createElement("input"); input.type="hidden"; input.name="request"; input.value=JSON.stringify(request); form.appendChild(input); document.body.appendChild(form);
      let submitted=false;
      iframe.onload=()=>{ if(!submitted) return; setTimeout(()=>{form.remove();iframe.remove();resolve({submitted:true,submissionId:request.submissionId||""});},80); };
      iframe.onerror=()=>{form.remove();iframe.remove();reject(new Error("Could not submit the request."));};
      submitted=true; form.submit();
      setTimeout(()=>{ if(document.body.contains(form)){form.remove();iframe.remove();resolve({submitted:true,submissionId:request.submissionId||""});}},5000);
    });
  }
  async function pollSubmission(submissionId,{timeoutMs=45000,intervalMs=1500}={}){
    const started=Date.now();
    while(Date.now()-started<timeoutMs){
      const status=await jsonp("publicSubmissionStatus",{submissionId});
      if(status?.found && !["Received","Processing"].includes(status.status)) return status;
      await new Promise(r=>setTimeout(r,intervalMs));
    }
    return {found:true,status:"Processing",submissionId};
  }
  window.ApartmentApi={jsonp,postForm,pollSubmission};
})();
