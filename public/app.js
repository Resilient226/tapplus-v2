'use strict';
// Firebase Auth is initialized in index.html to preserve the API key across app.js updates
// Access it via window._fbAuth set by index.html
var fbAuth = window._fbAuth || null;
// ── State ─────────────────────────────────────────────────────────────────────
const State = { session:null, biz:null, staff:[], taps:[], layout:null };
// ── Helpers ───────────────────────────────────────────────────────────────────
const app = () => document.getElementById('app');
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','
let _tt;
function showToast(msg,d=2500){const t=$('toast');if(!t)return;t.textContent=msg;t.classList.
function showModal(html){const b=$('modal-box'),o=$('modal-overlay');if(!b||!o)return;b.inner
function closeModal(){const o=$('modal-overlay');if(o)o.classList.remove('open');}
document.addEventListener('click',e=>{if(e.target.id==='modal-overlay')closeModal();});
function showLoading(msg=''){app().innerHTML=`<div class="page-center"><div class="spinner"><
function showError(msg){app().innerHTML=`<div class="page-center"><div style="font-size:40px;
function staffDisplay(s){return`${s.firstName} ${s.lastInitial}.`;}
function staffIni(s){return(s.firstName[0]+(s.lastInitial||'')[0]||'').toUpperCase();}
function staffAvatar(s,size=40){
if(s.photo)return`<img src="${esc(s.photo)}" style="width:${size}px;height:${size}px;border
return`<div style="width:${size}px;height:${size}px;border-radius:50%;background:${esc(s.co
}
function timeAgo(ts){const d=Date.now()-ts;if(d<60000)return'just now';if(d<3600000)return Ma
// ── AI ────────────────────────────────────────────────────────────────────────
const _aiCache={};
async function askAI(prompt,key=''){
if(key&&_aiCache[key])return _aiCache[key];
try{const d=await API.ai.ask(prompt);if(key)_aiCache[key]=d.text;return d.text||'';}
catch(e){console.error('AI:',e);return null;}
}
function renderAIBlock(id,prompt,key){
const el=$(id);if(!el)return;
if(_aiCache[key]){el.innerHTML=`<div class="ai-card"><div class="ai-text">${esc(_aiCache[ke
el.innerHTML=`<div class="ai-card" style="text-align:center;padding:20px"><div class="spinn
askAI(prompt,key).then(text=>{
if(!text){el.innerHTML=`<div class="ai-card"><div class="ai-text" style="color:var(--gray
el.innerHTML=`<div class="ai-card"><div class="ai-text">${esc(text)}</div></div>`;
});
}
// ── Router ────────────────────────────────────────────────────────────────────
async function route(){
// Hide splash screen
var ld = document.getElementById('loading');
if (ld) { ld.classList.add('hidden'); setTimeout(function(){ ld.style.display='none'; }, 35
const parts=location.pathname.split('/').filter(Boolean);
if(parts.length>=3&&parts[1]==='tap')return renderTapPage(parts[0],parts[2]);
if(parts.length>=2&&parts[1]==='dashboard')return renderDashboardEntry(parts[0]);
return renderHome();
}
function navigate(path){history.pushState({},'' ,path);route();}
window.addEventListener('popstate',route);
window.addEventListener('DOMContentLoaded',route);
// ── Home ──────────────────────────────────────────────────────────────────────
function renderHome(){
app().innerHTML=`
<div class="page-center">
<div style="font-size:56px;font-weight:900;letter-spacing:-.04em;margin-bottom:4px">Tap
<div style="font-size:14px;color:var(--gray);margin-bottom:40px">Enter your store code<
<div style="width:100%;max-width:320px">
<input class="inp" id="code-inp" placeholder="4-digit code" type="number" inputmode="
style="text-align:center;font-size:32px;font-weight:900;letter-spacing:.2em;padding
onkeydown="if(event.key==='Enter')window._go()"/>
<button class="btn btn-primary btn-full" onclick="window._go()">Continue →</button>
<button class="btn btn-ghost btn-full" style="margin-top:10px" onclick="window._owner
Owner / Create Account
</button>
<div style="margin-top:24px;text-align:center">
<button onclick="window._sa()" style="background:none;border:none;color:rgba(238,24
</div>
</div>
</div>`;
window._go=async function(){
const code=($('code-inp')?.value||'').trim();
if(code.length!==4){showToast('Enter a 4-digit code');return;}
showLoading('Looking up…');
try{const d=await API.business.getByCode(code);State.biz=d.business;renderRoleSelect();}
catch{showToast('Invalid store code');renderHome();}
};
window._ownerEntry=function(){State.biz=null;renderOwnerLogin();};
window._sa=function(){
showModal(`<div class="modal-head"><div class="modal-title">Super Admin</div><button clas
<div style="text-align:center;padding:8px 0">
<div style="font-size:18px;font-weight:800;margin-bottom:16px">Enter PIN</div>
<div class="pin-display" style="gap:10px">
<div class="pin-dot" id="pd0"></div><div class="pin-dot" id="pd1"></div>
<div class="pin-dot" id="pd2"></div><div class="pin-dot" id="pd3"></div>
<div class="pin-dot" id="pd4"></div><div class="pin-dot" id="pd5"></div>
</div>
<div class="pin-grid">${['1','2','3','4','5','6','7','8','9','del','0','go'].map(k=>`
</div>`);
let pin='';
window._pin=function(v){
if(v==='del'){pin=pin.slice(0,-1);}
else if(v==='go'){
if(pin.length<4){showToast('Enter at least 4 digits');return;}
closeModal();showLoading('Authenticating…');
API.auth.loginSuperAdmin(pin).then(d=>{State.session=d;renderSuperAdminDashboard();})
return;
}
else if(pin.length<6){pin+=v;}
document.querySelectorAll('.pin-dot').forEach((d,i)=>d.classList.toggle('filled',i<pin.
};
};
}
// ── Role Select ───────────────────────────────────────────────────────────────
function renderRoleSelect(){
const biz=State.biz;
app().innerHTML=`
<div class="page-center">
${biz.branding?.logoUrl?`<img src="${esc(biz.branding.logoUrl)}" style="height:60px;obj
<div style="font-size:14px;color:var(--gray);margin-bottom:28px">Who are you?</div>
<div style="width:100%;max-width:320px;display:flex;flex-direction:column;gap:10px">
${[['staff',' ','Staff Member','View my stats & feedback'],['manager',' ','Manager
<button class="btn btn-ghost" onclick="window._role('${r}')" style="justify-content
<span style="font-size:24px">${ic}</span>
<div style="text-align:left"><div style="font-weight:800">${lbl}</div><div </button>`).join('')}
</div>
<button onclick="renderHome()" style="margin-top:20px;background:none;border:none;color
</div>`;
window._role=function(r){r==='owner'?renderOwnerLogin():renderPinLogin(r);};
style=
}
// ── PIN Login ─────────────────────────────────────────────────────────────────
function renderPinLogin(role){
const titles={staff:'Staff Passcode',manager:'Manager PIN',bizAdmin:'Admin PIN'};
const subs={staff:'Enter your personal passcode',manager:'Enter the manager PIN',bizAdmin:'
let pin='';
app().innerHTML=`
<div class="page-center">
<div style="font-size:13px;color:var(--gray);margin-bottom:8px">${esc(State.biz?.name)}
<div style="font-size:20px;font-weight:800;margin-bottom:4px">${titles[role]}</div>
<div style="font-size:13px;color:var(--gray);margin-bottom:20px">${subs[role]}</div>
<div class="pin-display" style="gap:10px">
<div class="pin-dot" id="pd0"></div><div class="pin-dot" id="pd1"></div>
<div class="pin-dot" id="pd2"></div><div class="pin-dot" id="pd3"></div>
<div class="pin-dot" id="pd4"></div><div class="pin-dot" id="pd5"></div>
</div>
<div class="pin-grid">${['1','2','3','4','5','6','7','8','9','del','0','go'].map(k=>`<b
<button onclick="renderRoleSelect()" style="margin-top:24px;background:none;border:none
</div>`;
window._pin=async function(v){
if(v==='del'){pin=pin.slice(0,-1);}
else if(v==='go'){
if(pin.length<4){showToast('Enter at least 4 digits');return;}
showLoading('Verifying…');
try{
let d;
if(role==='staff')d=await API.auth.loginStaff(State.biz.id,pin);
else if(role==='manager')d=await API.auth.loginManager(State.biz.id,pin);
else d=await API.auth.loginBizAdmin(State.biz.id,pin);
State.session=d;
await loadDashboardData();
renderDashboard();
}catch{showToast('Invalid PIN — try again');renderPinLogin(role);}
return;
}
else if(pin.length<6){pin+=v;}
document.querySelectorAll('.pin-dot').forEach((d,i)=>d.classList.toggle('filled',i<pin.le
};
}
// ── Owner Login ───────────────────────────────────────────────────────────────
function renderOwnerLogin(){
app().innerHTML=`
<div class="page-center">
<div style="font-size:24px;font-weight:900;margin-bottom:8px">Owner Sign In</div>
<div style="font-size:14px;color:var(--gray);margin-bottom:28px">Sign in with your emai
<div style="width:100%;max-width:320px;display:flex;flex-direction:column;gap:12px">
<div><div class="field-lbl">Email</div><input class="inp" id="oe" type="email" placeh
<div><div class="field-lbl">Password</div><input class="inp" id="op" type="password"
<button class="btn btn-primary btn-full" onclick="window._signin()">Sign In</button>
<button class="btn btn-ghost btn-full" onclick="window._register()">Create Account</b
<button onclick="renderRoleSelect()" style="background:none;border:none;color:var(--g
</div>
</div>`;
window._signin=async function(){
const email=$('oe')?.value?.trim(),pass=$('op')?.value;
if(!email||!pass){showToast('Enter email and password');return;}
if(!fbAuth){showToast('Firebase not configured — update API key in app.js');return;}
showLoading('Signing in…');
try{const c=await fbAuth.signInWithEmailAndPassword(email,pass);const t=await c.user.getI
catch(e){app().innerHTML='';renderOwnerLogin();showToast(e.message||'Sign in failed');}
};
window._register=async function(){
const email=$('oe')?.value?.trim(),pass=$('op')?.value;
if(!email||!pass){showToast('Enter email and password');return;}
if(pass.length<6){showToast('Password must be 6+ characters');return;}
if(!fbAuth){showToast('Firebase not configured — update API key in app.js');return;}
showLoading('Creating account…');
try{const c=await fbAuth.createUserWithEmailAndPassword(email,pass);const t=await c.user.
catch(e){
app().innerHTML='';
renderOwnerLogin();
if(e.code==='auth/email-already-in-use'){
showToast('Email already registered — try Sign In',4000);
} else {
showToast(e.message||'Registration failed');
}
}
};
}
// ── Create Business ───────────────────────────────────────────────────────────
function renderCreateBusiness(idToken){
app().innerHTML=`
<div class="page" style="padding-top:60px">
<button onclick="renderOwnerLogin()" style="background:none;border:none;color:var(--gra
<h1 style="margin-bottom:6px">Create Business</h1>
<div style="color:var(--gray);font-size:14px;margin-bottom:24px">Set up your Tap+ locat
<div style="display:flex;flex-direction:column;gap:12px">
<div><div class="field-lbl">Business Name</div><input class="inp" id="cb-n" placehold
<div><div class="field-lbl">Admin PIN (4-6 digits)</div><input class="inp" id="cb-a"
<div><div class="field-lbl">Manager PIN (4-6 digits)</div><input class="inp" id="cb-m
<button class="btn btn-primary btn-full" style="margin-top:8px" onclick="window._crea
</div>
</div>`;
window._create=async function(){
const name=$('cb-n')?.value?.trim(),adminPin=$('cb-a')?.value?.trim(),mgrPin=$('cb-m')?.v
if(!name){showToast('Enter business name');return;}
if(adminPin?.length!==4){showToast('Admin PIN must be 4 digits');return;}
if(mgrPin?.length!==4){showToast('Manager PIN must be 4 digits');return;}
if(adminPin===mgrPin){showToast('PINs must be different');return;}
showLoading('Creating…');
try{
sessionStorage.setItem('tp_session',JSON.stringify({token:idToken}));
const d=await API.business.create({name,adminPin,managerPin:mgrPin});
State.biz=d.business;
const ld=await API.auth.loginBizAdmin(d.business.id,adminPin);
State.session=ld;
showToast('Business created! Code: '+d.business.storeCode);
await loadDashboardData();
renderDashboard();
}catch(e){showToast(e.message||'Failed');renderCreateBusiness(idToken);}
};
}
// ── Dashboard Entry (from URL) ────────────────────────────────────────────────
async function renderDashboardEntry(slug){
const sess=API.auth.getSession();
if(sess?.token&&sess?.bizId){
State.session=sess;showLoading();
try{const d=await API.business.getById(sess.bizId);State.biz=d.business;await loadDashboa
catch{API.auth.logout();}
}
showLoading();
try{const d=await API.business.getBySlug(slug);State.biz=d.business;renderRoleSelect();}
catch{showError('Business not found');}
}
// ── Load Data ─────────────────────────────────────────────────────────────────
async function loadDashboardData(){
const bizId=State.session?.bizId;if(!bizId)return;
const [s,t,l]=await Promise.allSettled([API.staff.list(bizId),API.taps.list({bizId}),API.la
if(s.status==='fulfilled')State.staff=s.value.staff||[];
if(t.status==='fulfilled')State.taps=t.value.taps||[];
if(l.status==='fulfilled')State.layout=l.value.layouts;
}
// ── Dashboard Shell ───────────────────────────────────────────────────────────
function renderDashboard(){
const {session:sess,biz,staff,taps,layout}=State;
const role=sess?.role;
const me=role==='staff'?staff.find(s=>s.id===sess?.staffId):null;
const defaults={staff:['coaching','feedback','goals','stats','branding'],manager:['ai','tea
const sections=layout?.[role]||defaults[role]||defaults.staff;
const LABELS={coaching:' Coaching',feedback:' Feedback',goals:' Goals',stats:' Sta
let active=sections[0];
app().innerHTML=`
<div style="max-width:480px;margin:0 auto;padding:16px 16px 90px">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom
<div>
${biz.branding?.logoUrl?`<img src="${esc(biz.branding.logoUrl)}" style="height:30px
<div style="font-size:10px;color:var(--gray);font-weight:700;margin-top:2px">${role
</div>
<button onclick="window._logout()" style="background:rgba(255,255,255,.06);border:1px
</div>
<div class="tabs">${sections.map(s=>`<button class="tab${s===active?' active':''}" oncl
<div id="dash-body"></div>
</div>
<div class="nav-bar">
<div class="nav-item active"><div class="nav-icon"> </div><div>Dashboard</div></div>
<div class="nav-item" onclick="window._preview()"><div class="nav-icon"> </div><div>Pr
<div class="nav-item" onclick="window._logout()"><div class="nav-icon"> </div><div>Out
</div>`;
window._tab=function(s){
active=s;
sections.forEach(x=>{const b=$('tab-'+x);if(b)b.className='tab'+(x===s?' active':'');});
const body=$('dash-body');if(!body)return;
switch(s){
case 'coaching': body.innerHTML=renderCoachingTab(me);break;
case 'feedback': body.innerHTML=renderFeedbackTab(me);break;
case 'goals': body.innerHTML=renderGoalsTab(me);break;
case 'stats': body.innerHTML=renderStatsTab(me);break;
case 'branding': renderBrandingTab(body,me);break;
case 'ai': body.innerHTML=renderAITab();break;
case 'team': body.innerHTML=renderTeamTab();break;
case 'staff': renderStaffTab(body);break;
case 'links': renderLinksTab(body);break;
case 'estimator': body.innerHTML=renderEstimatorTab();break;
case 'settings': renderSettingsTab(body);break;
default: body.innerHTML=`<div style="color:var(--gray);text-align:center;paddi
}
};
window._logout=function(){API.auth.logout();State.session=null;State.biz=null;State.staff=[
window._preview=function(){
var biz=State.biz;if(!biz)return;
var b=biz.branding||{};
var links=biz.links||[];
var bulletinLinks=b.bulletinLinks||[];
app().innerHTML=`
<div style="position:fixed;top:0;left:0;right:0;z-index:100;
background:rgba(7,8,12,.95);backdrop-filter:blur(10px);
border-bottom:1px solid var(--border);padding:12px 16px;
display:flex;align-items:center;gap:12px">
<button onclick="renderDashboard()" style="background:rgba(255,255,255,.08);
border:1px solid var(--border);border-radius:8px;padding:7px 14px;
color:var(--white);font-size:13px;font-weight:700;cursor:pointer;
font-family:'Nunito',sans-serif">← Back</button>
<div style="font-size:13px;font-weight:700;color:var(--gray)">Preview Mode</div>
</div>
<div style="padding-top:56px">
<div class="tap-page">
<div style="margin-top:16px;margin-bottom:24px;text-align:center">
${b.logoUrl?`<img src="${esc(b.logoUrl)}" style="height:80px;max-width:220px;obje
${b.tagline?`<div style="font-size:13px;opacity:.4;margin-top:8px">${esc(b.taglin
</div>
<div style="text-align:center;margin-bottom:28px;width:100%">
<div style="font-size:20px;font-weight:900;margin-bottom:20px">${esc(b.ratingQues
<div style="display:flex;gap:10px;justify-content:center">
${[1,2,3,4,5].map(i=>`<div id="pcs${i}" style="font-size:42px;cursor:pointer;tr
</div>
</div>
<div id="p-after" style="width:100%"></div>
${bulletinLinks.length?`<div style="width:100%;margin-top:16px"><div style="font-si
${bulletinLinks.map(l=>`<div style="background:rgba(255,255,255,.05);border:1px s
<div style="font-weight:700;font-size:14px">${esc(l.label)}</div>
${l.sublabel?`<div style="font-size:12px;opacity:.5;margin-top:4px">${esc(l.sub
</div>`:''}
${links.length?`<div style="width:100%;margin-top:8px;background:rgba(255,255,255,.
${links.length} review link${links.length>1?'s':''} configured — shown after 4-5★
</div>`:''}
<div style="position:fixed;bottom:10px;left:0;right:0;text-align:center;font-size:9
</div>
</div>`;
window._pStar=function(r){
for(var i=1;i<=5;i++){var el=document.getElementById('pcs'+i);if(el){el.style.filter=i<
var after=document.getElementById('p-after');if(!after)return;
if(r>=4&&links.length){
if(r>=4){
var rp=esc(b.reviewPrompt||"Share your experience!");
var linkHtml=links.length?links.map(function(l){return '<div style="display:flex;alig
after.innerHTML='<div style="text-align:center;margin-bottom:16px"><div style="font-s
} else if(r<=3){
var lm=esc(b.lowRatingMsg||"We're sorry to hear that.");
after.innerHTML='<div style="text-align:center;margin-bottom:12px"><div style="font-s
+'<textarea style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgb
+'<div style="margin-top:10px;text-align:center;font-size:13px;color:rgba(238,240,2
}
};
};
window._tab(sections[0]);
}
profil
// ── Staff Tabs ────────────────────────────────────────────────────────────────
function renderCoachingTab(me){
if(!me)return`<div class="card" style="text-align:center;color:var(--gray)">No staff const myT=State.taps.filter(t=>t.staffId===me.id);
const rated=myT.filter(t=>t.rating);
const avg=rated.length?(rated.reduce((s,t)=>s+t.rating,0)/rated.length).toFixed(1):'—';
const five=rated.filter(t=>t.rating===5).length;
const fb=myT.filter(t=>t.feedback).slice(0,5);
const prompt=`You are a hospitality coach. ${me.firstName} has ${myT.length} taps, ${avg} a
setTimeout(()=>renderAIBlock('ai-coach',prompt,`coach-${me.id}-${myT.length}`),0);
return`<div class="stat-grid">
<div class="stat-box"><div class="stat-val">${myT.length}</div><div class="stat-lbl">Taps
<div class="stat-box"><div class="stat-val">${avg}</div><div class="stat-lbl">Avg Rating<
<div class="stat-box"><div class="stat-val">${five}</div><div class="stat-lbl">5-Stars</d
<div class="stat-box"><div class="stat-val">${rated.length?Math.round(five/rated.length*1
</div>
<div class="sec-lbl" style="margin-top:8px">AI Coaching</div>
<div id="ai-coach"></div>`;
}
function renderFeedbackTab(me){
const fb=State.taps.filter(t=>(!me||t.staffId===me.id)&&t.feedback).sort((a,b)=>b.ts-a.ts).
if(!fb.length)return`<div class="card" style="text-align:center;color:var(--gray);padding:4
return fb.map(t=>`<div class="fb-item"><div class="fb-stars">${'★'.repeat(t.rating||0)}${'☆
}
function renderGoalsTab(me){
const goals=State.biz?.teamGoals||[];
if(!goals.length)return`<div class="card" style="text-align:center;color:var(--gray);paddin
return goals.map(g=>{
const mine=me?State.taps.filter(t=>t.staffId===me.id):State.taps;
const val=g.metric==='taps'?mine.length:g.metric==='fivestar'?mine.filter(t=>t.rating===5
const pct=Math.min(100,Math.round(val/g.target*100));
return`<div class="goal-row"><div style="display:flex;justify-content:space-between;margi
}).join('');
}
function renderStatsTab(me){
const myT=me?State.taps.filter(t=>t.staffId===me.id):State.taps;
const rated=myT.filter(t=>t.rating);
const avg=rated.length?(rated.reduce((s,t)=>s+t.rating,0)/rated.length).toFixed(1):'—';
const now=Date.now();
const dist=[1,2,3,4,5].map(r=>rated.filter(t=>t.rating===r).length);
const mx=Math.max(...dist,1);
return`<div class="stat-grid">
<div class="stat-box"><div class="stat-val">${myT.length}</div><div class="stat-lbl">All
<div class="stat-box"><div class="stat-val">${avg}</div><div class="stat-lbl">Avg Rating<
<div class="stat-box"><div class="stat-val">${myT.filter(t=>t.ts>now-604800000).length}</
<div class="stat-box"><div class="stat-val">${myT.filter(t=>t.ts>now-2592000000).length}<
</div>
<div class="plain-card" style="margin-top:4px">
<div class="sec-lbl">Rating Distribution</div>
${[5,4,3,2,1].map(r=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:
</div>`;
}
// ── Branding Tab (staff) ──────────────────────────────────────────────────────
function renderBrandingTab(body,me){
if(!me){body.innerHTML=`<div class="card" style="color:var(--gray);text-align:center">No st
const allowed=State.biz?.branding?.allowedStaffLinks||{};
const types=Object.entries(allowed).filter(([,v])=>v).map(([k])=>k);
const LABELS={spotify:' Spotify',phone:' Phone',email:' Email',instagram:' Instagr
let photoData=undefined,links=[...(me.links||[])];
Barten
body.innerHTML=`<div class="plain-card">
<div style="font-weight:700;font-size:15px;margin-bottom:16px"> My Tap Page</div>
<div class="field-lbl">Profile Photo</div>
<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
<div id="br-av">${staffAvatar(me,64)}</div>
<button onclick="window._pickPhoto()" class="btn btn-ghost btn-sm"> Upload</button>
</div>
<div class="field-lbl">My Title</div>
<input class="inp" id="br-title" value="${esc(me.title||'')}" placeholder="Server, ${types.length?`
<div class="sec-lbl">My Links</div>
<div style="font-size:11px;color:var(--gray);margin-bottom:10px">Show when customers ta
<div id="br-links"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
<select class="sel" id="br-ltype">${types.map(t=>`<option value="${t}">${LABELS[t]||t
<input class="inp" id="br-llabel" placeholder="Label"/>
</div>
<div style="display:flex;gap:8px;margin-bottom:14px">
<input class="inp" id="br-lurl" placeholder="URL or @username" style="flex:1"/>
<button onclick="window._addBrLink()" style="background:var(--green);color:var(--blac
</div>`:`<div style="background:#15171f;border-radius:10px;padding:12px;font-size:12px;
<button onclick="window._saveBr()" class="btn btn-primary btn-full">Save My Branding</but
</div>`;
function renderLinks(){
const el=$('br-links');if(!el)return;
el.innerHTML=links.length?links.map((l,i)=>`<div style="display:flex;align-items:center;g
}
renderLinks();
window._pickPhoto=function(){const i=document.createElement('input');i.type='file';i.accept
window._rmBrLink=function(i){links.splice(i,1);renderLinks();};
window._addBrLink=function(){
const type=($('br-ltype')||{}).value||'custom';
const label=($('br-llabel')||{}).value?.trim()||LABELS[type]||type;
let url=($('br-lurl')||{}).value?.trim()||'';
if(!url){showToast('Enter a URL');return;}
if(type!=='phone'&&type!=='email'&&!url.startsWith('http')){
if(type==='instagram')url='https://instagram.com/'+url.replace(/^@/,'');
else if(type==='tiktok')url='https://tiktok.com/@'+url.replace(/^@/,'');
else url='https://'+url.replace(/^@/,'').replace(/^\/+/,'');
}
links.push({type,label,url});
const u=$('br-lurl');if(u)u.value='';
const ll=$('br-llabel');if(ll)ll.value='';
renderLinks();showToast('Link added ✓');
};
window._saveBr=async function(){
const title=($('br-title')||{}).value?.trim()||'';
const photo=photoData!==undefined?photoData:me.photo;
try{await API.staff.update(State.session.bizId,me.id,{title,photo,links});const idx=State
catch(e){showToast(e.message||'Save failed — '+e.message);}
};
}
// ── Manager Tabs ──────────────────────────────────────────────────────────────
function renderAITab(){
const taps=State.taps,rated=taps.filter(t=>t.rating);
const avg=rated.length?(rated.reduce((s,t)=>s+t.rating,0)/rated.length).toFixed(1):0;
const fb=taps.filter(t=>t.feedback).slice(0,10).map(t=>`${t.rating}★: "${t.feedback}"`).joi
const prompt=`Hospitality business analyst. ${taps.length} taps, ${avg} avg stars. Feedback
setTimeout(()=>renderAIBlock('ai-insights',prompt,`insights-${taps.length}`),0);
return`<div class="sec-lbl">AI Business Insights</div><div id="ai-insights"></div>
<div class="stat-grid" style="margin-top:16px">
<div class="stat-box"><div class="stat-val">${taps.length}</div><div class="stat-lbl">Tot
<div class="stat-box"><div class="stat-val">${avg}</div><div class="stat-lbl">Avg Rating<
<div class="stat-box"><div class="stat-val">${taps.filter(t=>t.rating===5).length}</div><
<div class="stat-box"><div class="stat-val">${taps.filter(t=>t.feedback).length}</div><di
</div>`;
}
function renderTeamTab(){
const staff=State.staff.filter(s=>s.active);
if(!staff.length)return`<div class="card" style="text-align:center;color:var(--gray);paddin
const ranked=staff.map(s=>{const st=State.taps.filter(t=>t.staffId===s.id);const rated=st.f
const medals=[' ',' ',' '];
return`<div class="plain-card"><div class="sec-lbl">Leaderboard</div>${ranked.map((s,i)=>`<
}
function renderStaffTab(body){
function draw(){
body.innerHTML=`<button class="btn btn-primary btn-full" style="margin-bottom:14px" oncli
${State.staff.length===0?`<div class="card" style="text-align:center;color:var(--gray);pa
}
class=
window._addS=function(){
showModal(`<div class="modal-head"><div class="modal-title">Add Staff</div><button <div style="display:flex;flex-direction:column;gap:12px">
<div><div class="field-lbl">First Name</div><input class="inp" id="ns-fn" placeholder
<div><div class="field-lbl">Last Initial</div><input class="inp" id="ns-li" placehold
<div><div class="field-lbl">Title</div><input class="inp" id="ns-ti" placeholder="Ser
<div><div class="field-lbl">Passcode (4 digits)</div><input class="inp" id="ns-pa" ty
<button class="btn btn-primary btn-full" onclick="window._saveS()">Add</button>
</div>`);
window._saveS=async function(){
const fn=$('ns-fn')?.value?.trim(),li=$('ns-li')?.value?.trim().toUpperCase(),ti=$('ns-
if(!fn){showToast('Enter first name');return;}if(!li){showToast('Enter last initial');r
if(!pa||pa.length!==4){showToast('Passcode must be 4 digits');return;}
closeModal();
try{const d=await API.staff.create(State.session.bizId,{firstName:fn,lastInitial:li,tit
catch(e){showToast(e.message||'Failed');draw();}
};
};
window._togS=async function(id,active){
try{await API.staff.update(State.session.bizId,id,{active:!active});const i=State.staff.f
catch(e){showToast(e.message||'Failed');}
};
window._editS=function(id){
const s=State.staff.find(x=>x.id===id);if(!s)return;
showModal(`<div class="modal-head"><div class="modal-title">Edit ${esc(staffDisplay(s))}<
<div style="display:flex;flex-direction:column;gap:12px">
<div><div class="field-lbl">First Name</div><input class="inp" id="es-fn" value="${es
<div><div class="field-lbl">Last Initial</div><input class="inp" id="es-li" value="${
<div><div class="field-lbl">Title</div><input class="inp" id="es-ti" value="${esc(s.t
<div><div class="field-lbl">New Passcode (blank to keep)</div><input class="inp" id="
<button class="btn btn-primary btn-full" onclick="window._updateS('${id}')">Save</but
<button class="btn btn-danger btn-full" onclick="window._delS('${id}')">Delete</butto
</div>`);
window._updateS=async function(sid){
const u={firstName:$('es-fn')?.value?.trim(),lastInitial:$('es-li')?.value?.trim().toUp
const np=$('es-pa')?.value?.trim();if(np){if(np.length!==4){showToast('Passcode must be
closeModal();
try{const d=await API.staff.update(State.session.bizId,sid,u);const i=State.staff.findI
catch(e){showToast(e.message||'Failed');}
};
window._delS=async function(sid){
if(!confirm('Delete this staff member?'))return;closeModal();
try{await API.staff.delete(State.session.bizId,sid);State.staff=State.staff.filter(x=>x
catch(e){showToast(e.message||'Failed');}
};
};
draw();
}
function renderLinksTab(body){
const biz=State.biz;
let links=[...(biz?.links||[])];
function draw(){
body.innerHTML=`<div class="sec-lbl">Review Links</div>
<div style="font-size:12px;color:var(--gray);margin-bottom:12px">4-5★ ratings redirect he
${links.map((l,i)=>`<div class="plain-card" style="display:flex;align-items:center;gap:12
<button class="btn btn-ghost btn-full" onclick="window._addL()" style="margin-top:4px">+
<button class="btn btn-primary btn-full" onclick="window._saveL()" style="margin-top:8px"
}
window._rmL=function(i){links.splice(i,1);draw();};
window._addL=function(){
showModal(`<div class="modal-head"><div class="modal-title">Add Review Link</div><button
<div style="display:flex;flex-direction:column;gap:12px">
<div><div class="field-lbl">Platform</div><select class="sel" id="al-p"><option>Googl
<div><div class="field-lbl">Label</div><input class="inp" id="al-l" placeholder="Revi
<div><div class="field-lbl">URL</div><input class="inp" id="al-u" placeholder="https:
<button class="btn btn-primary btn-full" onclick="window._doAddL()">Add</button>
</div>`);
window._doAddL=function(){const p=$('al-p')?.value||'Google',l=$('al-l')?.value?.trim()||
window._saveL=async function(){try{const d=await API.business.update(State.session.bizId,{l
};
draw();
}
function renderEstimatorTab(){
setTimeout(()=>{
window._calcEst=function(){
const c=parseInt($('ec')?.value)||0,cur=parseFloat($('ecur')?.value)||0,tgt=parseFloat(
const el=$('eres');if(!el)return;
if(!c||!cur||!tgt){el.innerHTML=`<div style="color:var(--red);font-size:13px">Fill all
if(tgt<=cur){el.innerHTML=`<div style="color:var(--green);font-weight:700;text-align:ce
if(tgt>5){el.innerHTML=`<div style="color:var(--red);font-size:13px">Target can't excee
const n=Math.max(1,Math.ceil((c*(tgt-cur))/(5-tgt)));
const taps=Math.ceil(n/0.65);
const wks=Math.ceil(taps/(Math.max(1,State.staff.filter(s=>s.active).length)*3));
el.innerHTML=`<div class="stat-grid"><div class="stat-box"><div class="stat-val">${n}</
};
},0);
return`<div class="plain-card">
<div style="font-weight:700;font-size:16px;margin-bottom:14px"> Rating Estimator</div>
<div class="field-lbl">Platform</div><select class="sel" id="ep" style="margin-bottom:10p
<div class="field-lbl">Current Review Count</div><input class="inp" id="ec" type="number"
<div class="field-lbl">Current Rating</div><input class="inp" id="ecur" type="number" ste
<div class="field-lbl">Target Rating</div><input class="inp" id="etgt" type="number" step
<button class="btn btn-primary btn-full" onclick="window._calcEst()">Calculate</button>
<div id="eres" style="margin-top:14px"></div>
</div>`;
}
// ── Settings Tab (bizAdmin) ───────────────────────────────────────────────────
function renderSettingsTab(body){
const b=State.biz?.branding||{};
let bulletinLinks=[...(b.bulletinLinks||[])];
body.innerHTML=`<div class="plain-card">
<div style="font-weight:700;font-size:15px;margin-bottom:16px"> Branding & Settings</di
<div class="field-lbl">Business Name</div><input class="inp" id="s-name" value="${esc(b.n
<div class="field-lbl">Tagline</div><input class="inp" id="s-tag" value="${esc(b.tagline|
<div class="field-lbl">Logo URL or Upload</div>
<div style="display:flex;gap:8px;margin-bottom:10px"><input class="inp" id="s-logo" value
${b.logoUrl?`<img src="${esc(b.logoUrl)}" id="s-logo-prev" style="height:48px;object-fit:
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
<div><div class="field-lbl">Brand</div><input type="color" id="s-bc" value="${esc(b.bra
<div><div class="field-lbl">Background</div><input type="color" id="s-bg" value="${esc(
<div><div class="field-lbl">Text</div><input type="color" id="s-tc" value="${esc(b.text
</div>
<div class="field-lbl">Rating Question</div><input class="inp" id="s-q" value="${esc(b.ra
<div class="field-lbl">5★ Prompt</div><input class="inp" id="s-rp" value="${esc(b.reviewP
<div class="field-lbl">Thank You Message</div><input class="inp" id="s-ty" value="${esc(b
<div class="field-lbl">Low Rating Message</div><input class="inp" id="s-lr" value="${esc(
<div class="sec-lbl">Bulletin Board</div>
<div style="font-size:12px;color:var(--gray);margin-bottom:10px;line-height:1.5">Links sh
<div id="s-bulletin" style="margin-bottom:8px"></div>
<button class="btn btn-ghost btn-full" onclick="window._addBull()" style="margin-bottom:1
<div class="sec-lbl">Staff Can Add</div>
<div style="background:#0e0f15;border:1px solid var(--border);border-radius:12px;padding:
${['spotify','phone','email','instagram','tiktok','custom'].map(t=>{const TLABELS={spot
</div>
<div style="background:#0e0f15;border:1px solid var(--border);border-radius:12px;padding:
<div class="field-lbl">Store Code</div>
<div style="font-size:32px;font-weight:900;letter-spacing:.2em;color:var(--green)">${es
<div style="font-size:12px;color:var(--gray);margin-top:4px">Staff use this to log in</
</div>
<button class="btn btn-primary btn-full" onclick="window._saveSetting()">Save Settings</b
</div>`;
function drawBulletin(){
const el=$('s-bulletin');if(!el)return;
el.innerHTML=bulletinLinks.length?bulletinLinks.map((l,i)=>`<div style="display:flex;alig
}
drawBulletin();
window._rmBull=function(i){bulletinLinks.splice(i,1);drawBulletin();};
window._addBull=function(){
showModal(`<div class="modal-head"><div class="modal-title">Add Bulletin Item</div><butto
<div style="display:flex;flex-direction:column;gap:12px">
<div><div class="field-lbl">Type</div><select class="sel" id="bl-t" onchange="window.
<div><div class="field-lbl">Title</div><input class="inp" id="bl-l" placeholder="e.g.
<div id="bl-uw"><div class="field-lbl">URL</div><input class="inp" id="bl-u" placehol
<div><div class="field-lbl">Description (optional)</div><input class="inp" id="bl-s"
<button class="btn btn-primary btn-full" onclick="window._doAddBull()">Add</button>
</div>`);
window._blTog=function(t){const w=$('bl-uw');if(w)w.style.display=t==='text'?'none':'bloc
window._doAddBull=function(){
const type=$('bl-t')?.value||'custom',label=$('bl-l')?.value?.trim()||'';let url=$('bl-
if(!label){showToast('Title required');return;}if(type!=='text'&&!url){showToast('URL r
if(url&&!url.startsWith('http'))url='https://'+url;
bulletinLinks.push({type,label,url,sublabel:sub});closeModal();drawBulletin();showToast
};
};
window._pickLogo=function(){const i=document.createElement('input');i.type='file';i.accept=
window._saveSetting=async function(){
const allowed={};['spotify','phone','email','instagram','tiktok','custom'].forEach(t=>{al
const logoUrl=window._logoData||$('s-logo')?.value?.trim()||b.logoUrl||'';
const branding={
name:$('s-name')?.value?.trim()||b.name,tagline:$('s-tag')?.value?.trim()||'',logoUrl,
brandColor:$('s-bc')?.value||'#00e5a0',bgColor:$('s-bg')?.value||'#07080c',textColor:$(
ratingQuestion:$('s-q')?.value?.trim()||b.ratingQuestion,reviewPrompt:$('s-rp')?.value?
thankYouMsg:$('s-ty')?.value?.trim()||b.thankYouMsg,lowRatingMsg:$('s-lr')?.value?.trim
bulletinLinks,allowedStaffLinks:allowed,
};
try{const d=await API.business.update(State.session.bizId,{branding});State.biz={...State
catch(e){showToast(e.message||'Failed — '+e.message);renderSettingsTab($('dash-body'));}
};
}
// ── Owner Dashboard ───────────────────────────────────────────────────────────
window.renderOwnerDashboard = function renderOwnerDashboard(){
const sess=State.session,bizs=sess?.businesses||[];
app().innerHTML=`
<div style="max-width:480px;margin:0 auto;padding:20px 16px 80px">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom
<div style="font-size:22px;font-weight:900">Tap<span style="color:var(--green)">+</sp
<button onclick="API.auth.logout();renderHome()" style="background:rgba(255,255,255,.
</div>
${bizs.length===0?`<div class="card" style="text-align:center;padding:40px">
<div style="font-size:32px;margin-bottom:12px"> </div>
<div style="font-weight:700;margin-bottom:8px">No businesses yet</div>
<div style="font-size:13px;color:var(--gray);margin-bottom:20px">Create your first lo
<button class="btn btn-primary" onclick="renderCreateBusiness('${esc(sess.token)}')">
</div>`:`
<div class="sec-lbl">Your Locations</div>
${bizs.map(b=>`<div class="plain-card" style="display:flex;align-items:center;gap:12p
<button class="btn btn-ghost btn-full" style="margin-top:8px" onclick="renderCreateBu
</div>`;
window._openBiz=async function(id){
showLoading();
try{const d=await API.business.getById(id);State.biz=d.business;State.session={...sess,bi
catch(e){showError(e.message);}
};
}
// ── Super Admin ───────────────────────────────────────────────────────────────
window.renderSuperAdminDashboard = function renderSuperAdminDashboard(){
app().innerHTML=`
<div style="max-width:480px;margin:0 auto;padding:20px 16px 80px">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom
<div style="font-size:20px;font-weight:900"> Super Admin</div>
<button onclick="API.auth.logout();renderHome()" style="background:rgba(255,255,255,.
</div>
<div class="tabs">
<button class="tab active" onclick="window._saT('layout')" id="sa-layout">Layout</but
<button class="tab" onclick="window._saT('biz')" id="sa-biz">Businesses</button>
</div>
<div id="sa-body"></div>
</div>`;
function saLayout(){
$('sa-body').innerHTML=`<div style="text-align:center;padding:40px"><div class="spinner"
API.layout.get().then(data=>{
const L=data.layouts;
const SECTIONS={staff:['coaching','feedback','goals','stats','branding'],manager:['ai',
const SLABELS={coaching:' Coaching',feedback:' Feedback',goals:' Goals',stats:'
const layouts={staff:[...(L.staff||SECTIONS.staff)],manager:[...(L.manager||SECTIONS.ma
function drawLayouts(){
$('sa-body').innerHTML=Object.entries(layouts).map(([role,order])=>`
<div class="plain-card" style="margin-bottom:12px">
<div style="font-weight:700;font-size:14px;margin-bottom:12px;text-transform:capi
${order.map((s,i)=>`<div style="display:flex;align-items:center;gap:8px;margin-bo
<span style="font-size:14px;flex:1">${SLABELS[s]||s}</span>
<button onclick="window._mvUp('${role}',${i})" style="background:none;border:no
<button onclick="window._mvDn('${role}',${i})" style="background:none;border:no
</div>`).join('')}
</div>`).join('')+`<button class="btn btn-primary btn-full" onclick="window._saveLa
}
drawLayouts();
window._mvUp=function(role,i){if(i===0)return;const a=layouts[role];[a[i-1],a[i]]=[a[i]
window._mvDn=function(role,i){const a=layouts[role];if(i>=a.length-1)return;[a[i],a[i+1
window._saveLayout=async function(){showLoading('Saving…');try{await API.layout.update(
});
}
window._saT=function(t){
['layout','biz'].forEach(x=>{const b=$('sa-'+x);if(b)b.className='tab'+(x===t?' active':'
if(t==='layout')saLayout();
else saBiz();
};
window._saT('layout');
}
window.saBiz = async function saBiz() {
var body = $('sa-body');
if (!body) return;
body.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner" style="m
// Fetch all businesses — super admin can search by slug
// We'll show a search + create interface
function draw(businesses) {
body.innerHTML = `
<button class="btn btn-primary btn-full" style="margin-bottom:16px" onclick="window._sa
+ Create New Business
</button>
<div style="display:flex;gap:8px;margin-bottom:16px">
<input class="inp" id="sa-biz-search" placeholder="Search by slug…" style="flex:1"
oninput="window._saSearch(this.value)"/>
</div>
<div id="sa-biz-list">
${businesses.length === 0
? '<div class="card" style="text-align:center;color:var(--gray);padding:30px">No bu
: businesses.map(b => `
<div class="plain-card" style="display:flex;align-items:center;gap:12px">
<div style="flex:1;min-width:0">
<div style="font-weight:700">${esc(b.name)}</div>
<div style="font-size:12px;color:var(--gray)">
Code: <span style="color:var(--green);font-weight:700">${esc(b.storeCode)}<
· ${esc(b.slug)}
</div>
</div>
<div style="display:flex;gap:6px">
<button onclick="window._saViewBiz('${b.id}')" class="btn btn-ghost btn-sm">V
<button onclick="window._saDeleteBiz('${b.id}','${esc(b.name)}')" class="btn
style="background:rgba(255,68,85,.1);color:var(--red);border:1px solid rgba
Delete
</button>
</div>
</div>`).join('')
}
</div>`;
}
// Load businesses — we'll use the super admin token to list them
// Since we don't have a list-all endpoint, search Firestore via a slug query
// For now load a few known businesses by querying with empty slug search
var allBiz = [];
try {
var saR = await fetch('/api/business?listAll=1', {
headers: { 'Authorization': 'Bearer ' + API.auth.getToken() }
});
var saD = await saR.json();
if (saD.businesses) allBiz = saD.businesses;
} catch(saErr) { /* show empty list */ }
draw(allBiz);
window._saSearch = async function(q) {
if (!q || q.length < 2) return;
try {
var d = await API.business.getBySlug(q.trim().toLowerCase());
if (d.business) {
window._saLastFound = d.business;
var list = $('sa-biz-list');
if (list) {
list.innerHTML = '<div class="plain-card" style="display:flex;align-items:center;ga
+ '<div style="flex:1;min-width:0"><div style="font-weight:700">'+esc(d.business.
+ '<div style="font-size:12px;color:var(--gray)">Code: <span style="color:var(--g
+ '<div style="display:flex;gap:6px">'
+ '<button class="btn btn-ghost btn-sm" onclick="window._saViewBiz(window._saLast
+ '<button class="btn btn-sm" style="background:rgba(255,68,85,.1);color:var(--re
+ '</div></div>';
}
}
} catch(e2) { /* not found */ }
};
window._saViewBiz = async function(id) {
showLoading('Loading…');
try {
var d = await API.business.getById(id);
State.biz = d.business;
State.session = { ...State.session, bizId: id, role: 'bizAdmin' };
await loadDashboardData();
renderDashboard();
} catch(e) { showToast(e.message || 'Failed'); renderSuperAdminDashboard(); }
};
window._saDeleteBiz = async function(id, name) {
if (!confirm('Delete ' + name + '? This cannot be undone. All staff and data will be lost
showLoading('Deleting…');
try {
await API.business.delete(id);
showToast(name + ' deleted');
renderSuperAdminDashboard();
} catch(e) { showToast(e.message || 'Delete failed'); renderSuperAdminDashboard(); }
};
window._saCreateBiz = function() {
showModal(`
<div class="modal-head">
<div class="modal-title">Create Business</div>
<button class="modal-close" onclick="closeModal()">×</button>
</div>
<div style="display:flex;flex-direction:column;gap:12px">
<div><div class="field-lbl">Owner Email</div>
<input class="inp" id="sa-cb-email" type="email" placeholder="owner@business.com"/>
<div><div class="field-lbl">Owner Password</div>
<input class="inp" id="sa-cb-pass" type="password" placeholder="Min 6 characters"/>
<div><div class="field-lbl">Business Name</div>
<input class="inp" id="sa-cb-name" placeholder="The James Room"/></div>
<div><div class="field-lbl">Admin PIN (4-6 digits)</div>
<input class="inp" id="sa-cb-admin" type="number" inputmode="numeric" placeholder="
<div><div class="field-lbl">Manager PIN (4-6 digits)</div>
<input class="inp" id="sa-cb-mgr" type="number" inputmode="numeric" placeholder="e.
<button class="btn btn-primary btn-full" onclick="window._saDoCreate()">Create Busine
</div>`);
window._saDoCreate = async function() {
var email = $('sa-cb-email')?.value?.trim();
var pass = $('sa-cb-pass')?.value;
var name = $('sa-cb-name')?.value?.trim();
var adminPin = $('sa-cb-admin')?.value?.trim();
var mgrPin = $('sa-cb-mgr')?.value?.trim();
if (!email) { showToast('Enter owner email'); return; }
if (!pass || pass.length < 6) { showToast('Password must be 6+ characters'); return; }
if (!name) { showToast('Enter business name'); return; }
if (!adminPin || adminPin.length < 4) { showToast('Admin PIN must be 4+ digits'); retur
if (!mgrPin || mgrPin.length < 4) { showToast('Manager PIN must be 4+ digits'); ret
if (adminPin === mgrPin) { showToast('PINs must be different'); return; }
closeModal();
showLoading('Creating…');
try {
// Create Firebase Auth account for owner
var cred = await fbAuth.createUserWithEmailAndPassword(email, pass);
var idToken = await cred.user.getIdToken();
// Temporarily set as bearer token
sessionStorage.setItem('tp_session', JSON.stringify({ token: idToken }));
// Create business
var d = await API.business.create({ name, adminPin, managerPin: mgrPin });
// Restore super admin session
sessionStorage.setItem('tp_session', JSON.stringify(State.session));
showToast(name + ' created! Code: ' + d.business.storeCode, 4000);
renderSuperAdminDashboard();
// Switch to businesses tab
setTimeout(() => window._saT('biz'), 500);
} catch(e) {
// Restore super admin session on error
sessionStorage.setItem('tp_session', JSON.stringify(State.session));
showToast(e.message || 'Failed to create business');
renderSuperAdminDashboard();
}
};
};
}
// ── Customer Tap Page ─────────────────────────────────────────────────────────
async function renderTapPage(bizSlug,staffSlug){
showLoading();
let biz;
try{const d=await API.business.getBySlug(bizSlug);biz=d.business;}
catch{showError('Business not found');return;}
const b=biz.branding||{};
document.body.style.background=b.bgColor||'#07080c';
// Load staff to find this staff member's profile
var staffRec = null;
try {
// We need a temp session to fetch staff — use a public-friendly approach
// Staff list requires auth, so we'll try with no auth and fall back gracefully
var staffResp = await fetch('/api/staff?bizId='+biz.id+'&public=1');
if (staffResp.ok) {
var staffData = await staffResp.json();
var allStaff = staffData.staff || [];
// Match by slug: "firstname-l" format
staffRec = allStaff.find(function(s) {
var slug = (s.firstName+'-'+s.lastInitial).toLowerCase().replace(/[^a-z0-9-]/g,'');
return slug === staffSlug || s.id === staffSlug;
});
}
} catch(e2) { /* staff popup optional */ }
// Tap cooldown
const ck='tp_'+biz.id+'_'+staffSlug,last=parseInt(sessionStorage.getItem(ck)||'0'),now=Date
const tapId=sessionStorage.getItem(ck+'_id')||'tap_'+now;
if(!dup){sessionStorage.setItem(ck,String(now));sessionStorage.setItem(ck+'_id',tapId);API.
const bulletinLinks=b.bulletinLinks||[];
const links=biz.links||[];
function linkRow(l){
const ICONS={google:' ',yelp:' ',tripadvisor:' ',custom:' ',spotify:' ',phone:' ',
const icon=ICONS[(l.type||l.platform||'').toLowerCase()]||' ';
if(l.type==='text')return`<div style="width:100%;background:rgba(255,255,255,.05);border:
if(l.type==='spotify'){const m=(l.url||'').match(/spotify\.com\/(track|playlist|album|epi
const href=l.type==='phone'?'tel:'+l.url:l.type==='email'?'mailto:'+l.url:l.url||l.href||
return`<a href="${esc(href)}" target="_blank" rel="noreferrer" style="display:flex;align-
}
function updateStars(r){for(let i=1;i<=5;i++){const el=$('cs'+i);if(el)el.className='star'+
function afterRate(r){
const el=$('after');if(!el)return;
if(r>=4){
var promptMsg=esc(b.reviewPrompt||'Share your experience!');
var linksHtml=links.length?links.map(l=>linkRow(l)).join(''):'<div style="background:rg
el.innerHTML='<div style="text-align:center;margin-bottom:20px"><div style="font-size:1
API.taps.update(tapId,{rating:r,status:'rated'}).catch(console.error);
}else if(r<=3){
el.innerHTML=`<div style="text-align:center;margin-bottom:16px"><div style="font-size:1
<textarea id="fb-t" style="width:100%;background:rgba(255,255,255,.06);border:1px sol
<button onclick="window._fb(${r})" style="width:100%;background:${esc(b.brandColor||'
window._fb=async function(rating){const text=$('fb-t')?.value?.trim()||'';await API.tap
}
}
window._cs=function(r){updateStars(r);setTimeout(()=>afterRate(r),200);};
window._toggleStaffCard=function(){
var c=document.getElementById('staff-popup');
if(c)c.style.display=c.style.display==='none'?'block':'none';
};
document.addEventListener('click',function(e){
var popup=document.getElementById('staff-popup');
var bubble=document.getElementById('staff-bubble');
if(popup&&bubble&&!bubble.contains(e.target)&&!popup.contains(e.target))popup.style.displ
});
var staffBubbleHTML = staffRec ? (
'<div id="staff-bubble" onclick="window._toggleStaffCard()" style="position:absolute;top:
+ (staffRec.photo
? '<img src="'+esc(staffRec.photo)+'" style="width:48px;height:48px;border-radius:50%;o
: '<div style="width:48px;height:48px;border-radius:50%;background:'+(b.brandColor||'#0
+ '</div>'
+ '<div id="staff-popup" style="display:none;position:absolute;top:72px;right:16px;backgr
+ '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
+ (staffRec.photo ? '<img src="'+esc(staffRec.photo)+'" style="width:36px;height:36px;bor
+ '<div><div style="font-weight:800;font-size:14px">' + esc(staffRec.firstName+' '+staffR
+ (staffRec.title ? '<div style="font-size:11px;color:'+(b.brandColor||'#00e5a0')+';font-
+ '</div></div>'
+ (staffRec.links||[]).filter(function(l){return (b.allowedStaffLinks||{})[l.type];}).map
var icons={spotify:' ',phone:' ',email:' ',instagram:' ',tiktok:' ',custom:' '
var href=l.type==='phone'?'tel:'+l.url:l.type==='email'?'mailto:'+l.url:l.url;
return '<a href="'+esc(href)+'" target="_blank" rel="noreferrer" style="display:flex;
+'<span style="font-size:16px">'+(icons[l.type]||' ')+'</span>'
+'<span style="font-size:12px;font-weight:600;color:'+(b.textColor||'#fff')+'">'+es
}).join('')
+ '</div>'
) : '';
app().innerHTML=`
<style>body{background:${esc(b.bgColor||'#07080c')};color:${esc(b.textColor||'#fff')}}.st
<div class="tap-page" style="position:relative">
${staffBubbleHTML}
<div style="margin-top:16px;margin-bottom:24px;text-align:center">
${b.logoUrl?`<img src="${esc(b.logoUrl)}" style="height:80px;max-width:220px;object-f
${b.tagline?`<div style="font-size:13px;opacity:.4;margin-top:8px">${esc(b.tagline)}<
</div>
<div style="text-align:center;margin-bottom:28px;width:100%">
<div style="font-size:20px;font-weight:900;margin-bottom:20px">${esc(b.ratingQuestion
<div style="display:flex;gap:10px;justify-content:center">
${[1,2,3,4,5].map(i=>`<div id="cs${i}" class="star" onclick="window._cs(${i})">★</d
</div>
</div>
<div id="after" style="width:100%"></div>
${bulletinLinks.length?`<div style="width:100%;margin-top:8px"><div style="font-size:10
</div>
<div style="position:fixed;bottom:10px;left:0;right:0;text-align:center;font-size:9px;fon
}
}
