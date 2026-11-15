"use strict";
/*
 * Apartment Pros renter portal. Authentication is verified by the Cloudflare API,
 * never by localStorage, cookies, names supplied in a form, or a client-side flag.
 * Firebase Auth retains sign-in across pages; the API verifies a fresh Firebase ID token
 * for every sensitive request. A missing configuration leaves these actions disabled.
 */
(function(){
  const cfg=()=>window.APARTMENT_SITE_CONFIG||{};
  const state={user:null,profile:null,auth:null,sdk:null,initialized:false,pendingAction:null};
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const enabled=()=>Boolean(cfg().renterApiUrl&&cfg().firebaseAuth?.apiKey&&cfg().firebaseAuth?.projectId&&cfg().firebaseAuth?.authDomain);
  const base=()=>String(cfg().renterApiUrl||"").replace(/\/+$/,"");
  const msg=(text,bad=false)=>{const el=document.getElementById("renterAuthStatus");if(el){el.textContent=text;el.className="portal-status"+(bad?" bad":"");}};
  function shell(){
    if(document.getElementById("renterAuthDialog"))return;
    const outer=document.createElement("dialog");outer.id="renterAuthDialog";outer.className="portal-dialog";
    outer.innerHTML='<div class="portal-dialog-content"><button class="portal-close" type="button" aria-label="Close sign-in panel">×</button>'+
      '<div class="portal-icon" aria-hidden="true">⌂</div>'+
      '<p class="portal-eyebrow">APARTMENT PROS · FREE LOCATING</p>'+
      '<h2>Find your place. Make the search yours.</h2>'+
      '<p>Log in or create an account for refined results, saved contact details, and verified property information. No account is needed to browse general apartment listings.</p>'+
      '<div class="portal-login-actions">'+
      '<button type="button" id="renterGoogle" class="btn portal-google">Continue with Google</button>'+
      '<div class="portal-or">or receive a secure sign-in link</div>'+
      '<label for="renterEmail">Your email address</label><input id="renterEmail" type="email" autocomplete="email" placeholder="you@example.com" maxlength="254">'+
      '<button type="button" id="renterEmailLink" class="btn primary">Email me a sign-in link</button>'+
      '</div><div id="renterAuthStatus" class="portal-status" role="status" aria-live="polite"></div>'+
      '<button type="button" id="renterBrowse" class="portal-guest">Browse without an account</button>'+
      '<p class="portal-fine">Your email must be verified before private property details can be shown. Apartment locating is free to renters.</p></div>';
    document.body.append(outer);
    outer.querySelector(".portal-close").addEventListener("click",()=>outer.close());
    outer.querySelector("#renterBrowse").addEventListener("click",()=>outer.close());
    outer.addEventListener("click",event=>{if(event.target===outer)outer.close();});
    outer.querySelector("#renterGoogle").addEventListener("click",signInGoogle);
    outer.querySelector("#renterEmailLink").addEventListener("click",signInEmail);
  }
  function openWelcome(text=""){
    shell();const d=document.getElementById("renterAuthDialog");
    msg(text||(!enabled()?"Account verification is being configured. You can browse listings or request free assistance in the meantime.":""));
    if(!d.open)d.showModal();
  }
  function refreshHeader(){
    document.getElementById("renterHeaderControls")?.remove();
    const nav=document.querySelector(".site-header .nav");
    if(!nav)return;
    const wrap=document.createElement("div");wrap.id="renterHeaderControls";wrap.className="renter-header-controls";
    const name=state.profile?.firstName||state.user?.displayName?.split(/\s+/)[0]||"";
    const button=document.createElement("button");button.type="button";button.className="btn renter-account-button";
    button.textContent=state.profile&&name?"Hello, "+name:"Log in / Create account";
    button.addEventListener("click",()=>state.user?openAccount():openWelcome());
    wrap.append(button);nav.append(wrap);
  }
  function openAccount(){
    shell();const d=document.getElementById("renterAuthDialog");
    d.querySelector("h2").textContent="Welcome back, "+esc(state.profile?.firstName||state.user?.displayName?.split(/\s+/)[0]||"friend")+"!";
    d.querySelector(".portal-login-actions").classList.add("hidden");
    msg("Your verified account is active. Property addresses can be requested through your account; websites are released only after the guest card has been sent.");
    let out=d.querySelector("#renterSignOut");
    if(!out){out=document.createElement("button");out.type="button";out.id="renterSignOut";out.className="btn secondary";out.textContent="Sign out";d.querySelector(".portal-login-actions").after(out);out.addEventListener("click",async()=>{if(state.auth&&state.sdk){await state.sdk.signOut(state.auth);state.user=null;state.profile=null;d.close();refreshHeader();}});}
    out.classList.remove("hidden");if(!d.open)d.showModal();
  }
  async function backend(path,method="GET",payload=null){
    if(!enabled())throw Error("Verified renter accounts are not activated on this preview.");
    if(!state.auth?.currentUser)throw Error("Please sign in and verify your email first.");
    const token=await state.auth.currentUser.getIdToken();
    const response=await fetch(base()+path,{method,headers:{"authorization":"Bearer "+token,...(payload?{"content-type":"application/json"}:{})},body:payload?JSON.stringify(payload):undefined,cache:"no-store"});
    let body={};try{body=await response.json();}catch(_){}
    if(!response.ok)throw Error(body.error||"Account request could not be completed.");
    return body;
  }
  async function loadProfile(){
    const record=await backend("/api/renters/me");
    state.profile=record.user||null;refreshHeader();
    document.dispatchEvent(new CustomEvent("renter-session-changed",{detail:{authenticated:!!state.profile,firstName:state.profile?.firstName||""}}));
    return record;
  }
  async function loadSdk(){
    if(!enabled())return;
    const [app,sdk]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js")
    ]);
    const firebaseApp=app.initializeApp(cfg().firebaseAuth);
    state.auth=sdk.getAuth(firebaseApp);state.sdk=sdk;
    sdk.onAuthStateChanged(state.auth,async user=>{
      state.user=user?.emailVerified?user:null;state.profile=null;
      if(state.user){try{await loadProfile();}catch(err){msg(err.message,true);}}
      refreshHeader();
      if(state.profile&&state.pendingAction){const action=state.pendingAction;state.pendingAction=null;document.getElementById("renterAuthDialog")?.close();startAction(action.id,action.intent);}
    });
    if(sdk.isSignInWithEmailLink(state.auth,location.href)){
      let email;try{email=localStorage.getItem("apartmentProsSignInEmail")||"";}catch(_){}
      if(!email)email=window.prompt("Enter the same email address that received your sign-in link:")||"";
      if(email){
        try{
          await sdk.signInWithEmailLink(state.auth,email,location.href);
          try{localStorage.removeItem("apartmentProsSignInEmail");}catch(_){}
          history.replaceState(null,"",location.pathname);
        }catch(err){openWelcome("Sign-in link could not be verified: "+err.message);}
      }
    }
  }
  async function signInGoogle(){
    if(!enabled()||!state.auth){msg("Account verification is not configured yet. Browse the listings or request free assistance.",true);return;}
    try{
      msg("Opening Google sign-in…");
      await state.sdk.signInWithPopup(state.auth,new state.sdk.GoogleAuthProvider());
      document.getElementById("renterAuthDialog")?.close();
    }catch(err){msg(err.message||"Google sign-in did not complete.",true);}
  }
  async function signInEmail(){
    if(!enabled()||!state.auth){msg("Email verification is not configured yet. You can still browse or request free matching assistance.",true);return;}
    const email=document.getElementById("renterEmail")?.value.trim()||"";
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){msg("Enter a valid email address.",true);return;}
    try{
      await state.sdk.sendSignInLinkToEmail(state.auth,email,{url:location.origin+location.pathname,handleCodeInApp:true});
      try{localStorage.setItem("apartmentProsSignInEmail",email);}catch(_){}
      msg("Check your email for a secure sign-in link. This verifies that you control the address.");
    }catch(err){msg(err.message||"Could not send a secure sign-in link.",true);}
  }
  function actionDialog(){
    let d=document.getElementById("renterActionDialog");if(d)return d;
    d=document.createElement("dialog");d.id="renterActionDialog";d.className="portal-dialog action-dialog";
    d.innerHTML='<div class="portal-dialog-content"><button type="button" class="portal-close" aria-label="Close">×</button>'+
      '<p class="portal-eyebrow">YOUR PRIVATE APARTMENT REQUEST</p><h2>Who are you looking for?</h2>'+
      '<p>Before a property website, application, or tour link is released, we send a guest card to the leasing team to introduce the renter.</p>'+
      '<form id="renterActionForm"><fieldset class="portal-choice"><legend>This apartment is for</legend>'+
      '<label><input type="radio" name="lookingFor" value="self" checked> Myself</label>'+
      '<label><input type="radio" name="lookingFor" value="other"> Someone else</label></fieldset>'+
      '<div class="portal-form-grid">'+
      '<label>First name<input name="firstName" required autocomplete="given-name"></label>'+
      '<label>Last name<input name="lastName" required autocomplete="family-name"></label>'+
      '<label>Phone number<input name="phone" required autocomplete="tel" inputmode="tel"></label>'+
      '<label class="portal-other-only hidden">Renter email<input name="otherEmail" type="email" autocomplete="off"></label></div>'+
      '<label class="portal-other-only hidden portal-consent"><input type="checkbox" name="personConsent"> I have permission from this person to share their contact information with the leasing team.</label>'+
      '<p class="portal-fine">This sends a single guest card for the selected property when you confirm. It does not submit a lease application or guarantee a tour.</p>'+
      '<p id="renterActionStatus" role="status" aria-live="polite"></p>'+
      '<button type="submit" class="btn primary portal-submit">Send guest card & continue</button></form>'+
      '<div id="renterActionResult" class="hidden"></div></div>';
    document.body.append(d);
    d.querySelector(".portal-close").onclick=()=>d.close();
    d.querySelectorAll('[name="lookingFor"]').forEach(r=>r.addEventListener("change",()=>{
      const other=d.querySelector('[name="lookingFor"]:checked')?.value==="other";
      d.querySelectorAll(".portal-other-only").forEach(el=>el.classList.toggle("hidden",!other));
      d.querySelector('[name="otherEmail"]').required=other;d.querySelector('[name="personConsent"]').required=other;
    }));
    return d;
  }
  async function startAction(floorplanId,intent="website"){
    if(!floorplanId)return;
    if(!state.profile){state.pendingAction={id:floorplanId,intent};openWelcome("Please verify your email to continue. You can still browse general listings.");return;}
    const d=actionDialog();d.dataset.floorplanId=floorplanId;d.dataset.intent=intent;
    d.querySelector("#renterActionForm").classList.remove("hidden");
    d.querySelector("#renterActionResult").classList.add("hidden");
    d.querySelector("#renterActionStatus").textContent="";
    d.querySelector('[name="firstName"]').value=state.profile.firstName||"";
    d.querySelector('[name="lastName"]').value=state.profile.lastName||"";
    d.querySelector('[name="phone"]').value=state.profile.phone||"";
    const radios=d.querySelectorAll('[name="lookingFor"]');radios[0].checked=true;
    d.querySelectorAll(".portal-other-only").forEach(x=>x.classList.add("hidden"));
    d.querySelector('[name="otherEmail"]').required=false;d.querySelector('[name="personConsent"]').required=false;
    const form=d.querySelector("#renterActionForm");
    form.onsubmit=async event=>{
      event.preventDefault();const button=form.querySelector('[type="submit"]'),status=d.querySelector("#renterActionStatus");
      const fd=new FormData(form),other=fd.get("lookingFor")==="other";
      const firstName=String(fd.get("firstName")||"").trim(),lastName=String(fd.get("lastName")||"").trim(),phone=String(fd.get("phone")||"").trim();
      if(!firstName||!lastName||phone.replace(/\D/g,"").length<10){status.textContent="Please provide a name and a 10-digit contact number.";return;}
      if(other&&!fd.get("personConsent")){status.textContent="Permission is required before contacting the property on someone else's behalf.";return;}
      try{
        button.disabled=true;status.textContent="Sending guest card to the leasing team…";
        const result=await backend("/api/renters/open-site","POST",{
          floorplanId:d.dataset.floorplanId,intent:d.dataset.intent,
          actingFor:other?"other":"self",firstName,lastName,phone,
          otherEmail:other?String(fd.get("otherEmail")||"").trim():"",
          personConsent:other?Boolean(fd.get("personConsent")):false
        });
        if(!result.guestCardSent)throw Error("The property has not confirmed guest-card delivery. No private website link was released.");
        const target=d.dataset.intent==="tour"?result.tourUrl||result.website:result.website;
        const box=d.querySelector("#renterActionResult");
        box.replaceChildren();
        const title=document.createElement("h2");title.textContent=result.communityName||"Apartment details";
        const address=document.createElement("p");address.textContent=result.address||"Address available from your agent";
        const note=document.createElement("p");note.textContent="Guest card sent. This is not a confirmed tour or application.";
        box.append(title,address,note);
        if(target){const a=document.createElement("a");a.className="btn primary";a.href=target;a.target="_blank";a.rel="noopener noreferrer";a.referrerPolicy="no-referrer";a.textContent=d.dataset.intent==="tour"?"Open official tour website":"View property website";box.append(a);}
        form.classList.add("hidden");box.classList.remove("hidden");status.textContent="";
      }catch(err){status.textContent=err.message||"Guest-card delivery was not confirmed.";}
      finally{button.disabled=false;}
    };
    if(!d.open)d.showModal();
  }
  async function privateDetail(floorplanId){
    return backend("/api/renters/details/"+encodeURIComponent(floorplanId));
  }
  function greeting(){
    if(!state.profile)return;
    document.querySelectorAll("[data-renter-greeting]").forEach(el=>{el.textContent="Hello, "+(state.profile.firstName||"there")+"!";});
  }
  function init(){
    shell();refreshHeader();
    const already=(()=>{try{if(sessionStorage.getItem("apEntrySeen"))return true;sessionStorage.setItem("apEntrySeen","1");return false;}catch(_){return false;}})();
    if(!already)openWelcome();
    state.initialized=true;
    if(enabled())loadSdk().catch(err=>msg("Sign-in service unavailable: "+err.message,true));
    document.addEventListener("renter-session-changed",greeting);
  }
  window.RenterPortal={openWelcome,startAction,privateDetail,get user(){return state.profile;},get configured(){return enabled();}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();