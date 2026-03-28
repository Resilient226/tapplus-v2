'use strict';

// Firebase client (owner auth only)
// Replace apiKey with your real key from Firebase Console → Project Settings → Your Apps
let fbAuth = null;
try {
  firebase.initializeApp({
    apiKey:     "AIzaSyD-placeholder-replace-with-real-key",
    authDomain: "tapplus-a2d09.firebaseapp.com",
    projectId:  "tapplus-a2d09",
  });
  fbAuth = firebase.auth();
} catch(e) {
  console.warn("Firebase init failed — owner login unavailable:", e.message);
}

// ── State ─────────────────────────────────────────────────────────────────────
const State = { session:null, biz:null, staff:[], taps:[], layout:null };

// ── Helpers ───────────────────────────────────────────────────────────────────
const app  = () => document.getElementById('app');
const $    = (id) => document.getElementById(id);
const esc  = (s) => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let _tt;
function showToast(msg,d=2500){const t=$('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(_tt);_tt=setTimeout(()=>t.classList.remove('show'),d);}

function showModal(html){const b=$('modal-box'),o=$('modal-overlay');if(!b||!o)return;b.innerHTML=html;o.classList.add('open');}
function closeModal(){const o=$('modal-overlay');if(o)o.classList.remove('open');}
document.addEventListener('click',e=>{if(e.target.id==='modal-overlay')closeModal();});

function showLoading(msg=''){app().innerHTML=`<div class="page-center"><div class="spinner"></div>${msg?`<div style="margin-top:16px;color:var(--gray);font-size:14px">${esc(msg)}</div>`:''}</div>`;}
function showError(msg){app().innerHTML=`<div class="page-center"><div style="font-size:40px;margin-bottom:16px">⚠️</div><div style="font-weight:700;margin-bottom:8px">Something went wrong</div><div style="font-size:14px;color:var(--gray);margin-bottom:24px">${esc(msg)}</div><button class="btn btn-ghost" onclick="route()">Go Home</button></div>`;}

function staffDisplay(s){return`${s.firstName} ${s.lastInitial}.`;}
function staffIni(s){return(s.firstName[0]+(s.lastInitial||'')[0]||'').toUpperCase();}
function staffAvatar(s,size=40){
  if(s.photo)return`<img src="${esc(s.photo)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0"/>`;
  return`<div style="width:${size}px;height:${size}px;border-radius:50%;background:${esc(s.color||'#00e5a0')}22;border:2px solid ${esc(s.color||'#00e5a0')};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${Math.round(size*.35)}px;color:${esc(s.color||'#00e5a0')};flex-shrink:0">${staffIni(s)}</div>`;
}
function timeAgo(ts){const d=Date.now()-ts;if(d<60000)return'just now';if(d<3600000)return Math.floor(d/60000)+'m ago';if(d<86400000)return Math.floor(d/3600000)+'h ago';return Math.floor(d/86400000)+'d ago';}

// ── AI ────────────────────────────────────────────────────────────────────────
const _aiCache={};
async function askAI(prompt,key=''){
  if(key&&_aiCache[key])return _aiCache[key];
  try{const d=await API.ai.ask(prompt);if(key)_aiCache[key]=d.text;return d.text||'';}
  catch(e){console.error('AI:',e);return null;}
}
function renderAIBlock(id,prompt,key){
  const el=$(id);if(!el)return;
  if(_aiCache[key]){el.innerHTML=`<div class="ai-card"><div class="ai-text">${esc(_aiCache[key])}</div></div>`;return;}
  el.innerHTML=`<div class="ai-card" style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto 10px"></div><div style="font-size:13px;color:var(--gray)">Analyzing…</div></div>`;
  askAI(prompt,key).then(text=>{
    if(!text){el.innerHTML=`<div class="ai-card"><div class="ai-text" style="color:var(--gray)">AI unavailable.</div></div>`;return;}
    el.innerHTML=`<div class="ai-card"><div class="ai-text">${esc(text)}</div></div>`;
  });
}

// ── Router ────────────────────────────────────────────────────────────────────
async function route(){
  // Hide splash screen
  var ld = document.getElementById('loading');
  if (ld) { ld.classList.add('hidden'); setTimeout(function(){ ld.style.display='none'; }, 350); }

  const parts=location.pathname.split('/').filter(Boolean);
  if(parts.length>=3&&parts[1]==='tap')return renderTapPage(parts[0],parts[2]);
  if(parts.length>=2&&parts[1]==='dashboard')return renderDashboardEntry(parts[0]);
  return renderHome();
}
function navigate(path){history.pushState({},''  ,path);route();}
window.addEventListener('popstate',route);
window.addEventListener('DOMContentLoaded',route);

// ── Home ──────────────────────────────────────────────────────────────────────
function renderHome(){
  app().innerHTML=`
    <div class="page-center">
      <div style="font-size:56px;font-weight:900;letter-spacing:-.04em;margin-bottom:4px">Tap<span style="color:var(--green)">+</span></div>
      <div style="font-size:14px;color:var(--gray);margin-bottom:40px">Enter your store code</div>
      <div style="width:100%;max-width:320px">
        <input class="inp" id="code-inp" placeholder="4-digit code" type="number" inputmode="numeric" maxlength="4"
          style="text-align:center;font-size:32px;font-weight:900;letter-spacing:.2em;padding:18px;margin-bottom:12px"
          onkeydown="if(event.key==='Enter')window._go()"/>
        <button class="btn btn-primary btn-full" onclick="window._go()">Continue →</button>
        <button class="btn btn-ghost btn-full" style="margin-top:10px" onclick="window._ownerEntry()">
          Owner / Create Account
        </button>
        <div style="margin-top:24px;text-align:center">
          <button onclick="window._sa()" style="background:none;border:none;color:rgba(238,240,248,.12);font-size:11px;cursor:pointer;font-family:'Nunito',sans-serif">●</button>
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
    showModal(`<div class="modal-head"><div class="modal-title">Super Admin</div><button class="modal-close" onclick="closeModal()">×</button></div>
      <div style="text-align:center;padding:8px 0">
        <div style="font-size:18px;font-weight:800;margin-bottom:16px">Enter PIN</div>
        <div class="pin-display" style="gap:10px">
          <div class="pin-dot" id="pd0"></div><div class="pin-dot" id="pd1"></div>
          <div class="pin-dot" id="pd2"></div><div class="pin-dot" id="pd3"></div>
          <div class="pin-dot" id="pd4"></div><div class="pin-dot" id="pd5"></div>
        </div>
        <div class="pin-grid">${['1','2','3','4','5','6','7','8','9','del','0','go'].map(k=>`<button class="pin-key${k==='del'||k==='go'?' del':''}" onclick="window._pin('${k}')" style="${k==='go'?'background:var(--green);color:var(--black);border-color:var(--green)':''}">${k==='del'?'⌫':k==='go'?'→':k}</button>`).join('')}</div>
      </div>`);
    let pin='';
    window._pin=function(v){
      if(v==='del'){pin=pin.slice(0,-1);}
      else if(v==='go'){
        if(pin.length<4){showToast('Enter at least 4 digits');return;}
        closeModal();showLoading('Authenticating…');
        API.auth.loginSuperAdmin(pin).then(d=>{State.session=d;renderSuperAdminDashboard();}).catch(()=>{showToast('Invalid PIN');renderHome();});
        return;
      }
      else if(pin.length<6){pin+=v;}
      document.querySelectorAll('.pin-dot').forEach((d,i)=>d.classList.toggle('filled',i<pin.length));
    };
  };
}

// ── Role Select ───────────────────────────────────────────────────────────────
function renderRoleSelect(){
  const biz=State.biz;
  app().innerHTML=`
    <div class="page-center">
      ${biz.branding?.logoUrl?`<img src="${esc(biz.branding.logoUrl)}" style="height:60px;object-fit:contain;border-radius:12px;margin-bottom:20px"/>`:`<div style="font-size:24px;font-weight:900;margin-bottom:20px">${esc(biz.name)}</div>`}
      <div style="font-size:14px;color:var(--gray);margin-bottom:28px">Who are you?</div>
      <div style="width:100%;max-width:320px;display:flex;flex-direction:column;gap:10px">
        ${[['staff','👤','Staff Member','View my stats & feedback'],['manager','📊','Manager','Team overview & analytics'],['bizAdmin','⚙️','Business Admin','Full settings & control'],['owner','🔑','Owner','Sign in with email']].map(([r,ic,lbl,sub])=>`
          <button class="btn btn-ghost" onclick="window._role('${r}')" style="justify-content:flex-start;gap:14px;padding:16px">
            <span style="font-size:24px">${ic}</span>
            <div style="text-align:left"><div style="font-weight:800">${lbl}</div><div style="font-size:12px;color:var(--gray)">${sub}</div></div>
          </button>`).join('')}
      </div>
      <button onclick="renderHome()" style="margin-top:20px;background:none;border:none;color:var(--gray);font-size:13px;cursor:pointer;font-family:'Nunito',sans-serif">← Back</button>
    </div>`;
  window._role=function(r){r==='owner'?renderOwnerLogin():renderPinLogin(r);};
}

// ── PIN Login ─────────────────────────────────────────────────────────────────
function renderPinLogin(role){
  const titles={staff:'Staff Passcode',manager:'Manager PIN',bizAdmin:'Admin PIN'};
  const subs={staff:'Enter your personal passcode',manager:'Enter the manager PIN',bizAdmin:'Enter the admin PIN'};
  let pin='';

  app().innerHTML=`
    <div class="page-center">
      <div style="font-size:13px;color:var(--gray);margin-bottom:8px">${esc(State.biz?.name)}</div>
      <div style="font-size:20px;font-weight:800;margin-bottom:4px">${titles[role]}</div>
      <div style="font-size:13px;color:var(--gray);margin-bottom:20px">${subs[role]}</div>
      <div class="pin-display" style="gap:10px">
        <div class="pin-dot" id="pd0"></div><div class="pin-dot" id="pd1"></div>
        <div class="pin-dot" id="pd2"></div><div class="pin-dot" id="pd3"></div>
        <div class="pin-dot" id="pd4"></div><div class="pin-dot" id="pd5"></div>
      </div>
      <div class="pin-grid">${['1','2','3','4','5','6','7','8','9','del','0','go'].map(k=>`<button class="pin-key${k==='del'||k==='go'?' del':''}" onclick="window._pin('${k}')" style="${k==='go'?'background:var(--green);color:var(--black);border-color:var(--green)':''}">${k==='del'?'⌫':k==='go'?'→':k}</button>`).join('')}</div>
      <button onclick="renderRoleSelect()" style="margin-top:24px;background:none;border:none;color:var(--gray);font-size:13px;cursor:pointer;font-family:'Nunito',sans-serif">← Back</button>
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
    document.querySelectorAll('.pin-dot').forEach((d,i)=>d.classList.toggle('filled',i<pin.length));
  };
}

// ── Owner Login ───────────────────────────────────────────────────────────────
function renderOwnerLogin(){
  app().innerHTML=`
    <div class="page-center">
      <div style="font-size:24px;font-weight:900;margin-bottom:8px">Owner Sign In</div>
      <div style="font-size:14px;color:var(--gray);margin-bottom:28px">Sign in with your email</div>
      <div style="width:100%;max-width:320px;display:flex;flex-direction:column;gap:12px">
        <div><div class="field-lbl">Email</div><input class="inp" id="oe" type="email" placeholder="you@business.com"/></div>
        <div><div class="field-lbl">Password</div><input class="inp" id="op" type="password" placeholder="••••••••" onkeydown="if(event.key==='Enter')window._signin()"/></div>
        <button class="btn btn-primary btn-full" onclick="window._signin()">Sign In</button>
        <button class="btn btn-ghost btn-full" onclick="window._register()">Create Account</button>
        <button onclick="renderRoleSelect()" style="background:none;border:none;color:var(--gray);font-size:13px;cursor:pointer;font-family:'Nunito',sans-serif;margin-top:4px">← Back</button>
      </div>
    </div>`;
  window._signin=async function(){
    const email=$('oe')?.value?.trim(),pass=$('op')?.value;
    if(!email||!pass){showToast('Enter email and password');return;}
    showLoading('Signing in…');
    try{const c=await fbAuth.signInWithEmailAndPassword(email,pass);const t=await c.user.getIdToken();const d=await API.auth.loginOwner(t);State.session=d;renderOwnerDashboard();}
    catch(e){showToast(e.message||'Sign in failed');renderOwnerLogin();}
  };
  window._register=async function(){
    const email=$('oe')?.value?.trim(),pass=$('op')?.value;
    if(!email||!pass){showToast('Enter email and password');return;}
    if(pass.length<6){showToast('Password must be at least 6 characters');return;}
    showLoading('Creating account…');
    try{const c=await fbAuth.createUserWithEmailAndPassword(email,pass);const t=await c.user.getIdToken();State._ownerToken=t;renderCreateBusiness(t);}
    catch(e){showToast(e.message||'Registration failed');renderOwnerLogin();}
  };
}

// ── Create Business ───────────────────────────────────────────────────────────
function renderCreateBusiness(idToken){
  app().innerHTML=`
    <div class="page" style="padding-top:60px">
      <h1 style="margin-bottom:6px">Create Business</h1>
      <div style="color:var(--gray);font-size:14px;margin-bottom:24px">Set up your Tap+ location</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div><div class="field-lbl">Business Name</div><input class="inp" id="cb-n" placeholder="The James Room"/></div>
        <div><div class="field-lbl">Admin PIN (4 digits)</div><input class="inp" id="cb-a" type="number" inputmode="numeric" placeholder="1234" maxlength="4"/></div>
        <div><div class="field-lbl">Manager PIN (4 digits)</div><input class="inp" id="cb-m" type="number" inputmode="numeric" placeholder="5678" maxlength="4"/></div>
        <button class="btn btn-primary btn-full" style="margin-top:8px" onclick="window._create()">Create →</button>
      </div>
    </div>`;
  window._create=async function(){
    const name=$('cb-n')?.value?.trim(),adminPin=$('cb-a')?.value?.trim(),mgrPin=$('cb-m')?.value?.trim();
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
    try{const d=await API.business.getById(sess.bizId);State.biz=d.business;await loadDashboardData();renderDashboard();return;}
    catch{API.auth.logout();}
  }
  showLoading();
  try{const d=await API.business.getBySlug(slug);State.biz=d.business;renderRoleSelect();}
  catch{showError('Business not found');}
}

// ── Load Data ─────────────────────────────────────────────────────────────────
async function loadDashboardData(){
  const bizId=State.session?.bizId;if(!bizId)return;
  const [s,t,l]=await Promise.allSettled([API.staff.list(bizId),API.taps.list({bizId}),API.layout.get()]);
  if(s.status==='fulfilled')State.staff=s.value.staff||[];
  if(t.status==='fulfilled')State.taps=t.value.taps||[];
  if(l.status==='fulfilled')State.layout=l.value.layouts;
}

// ── Dashboard Shell ───────────────────────────────────────────────────────────
function renderDashboard(){
  const {session:sess,biz,staff,taps,layout}=State;
  const role=sess?.role;
  const me=role==='staff'?staff.find(s=>s.id===sess?.staffId):null;
  const defaults={staff:['coaching','feedback','goals','stats','branding'],manager:['ai','team','staff','links','goals','estimator'],bizAdmin:['ai','team','staff','links','goals','branding','settings']};
  const sections=layout?.[role]||defaults[role]||defaults.staff;
  const LABELS={coaching:'🤖 Coaching',feedback:'💬 Feedback',goals:'🎯 Goals',stats:'📊 Stats',branding:'✨ Branding',ai:'🤖 AI',team:'🏆 Team',staff:'👥 Staff',links:'🔗 Links',estimator:'📈 Estimator',settings:'⚙️ Settings'};
  let active=sections[0];

  app().innerHTML=`
    <div style="max-width:480px;margin:0 auto;padding:16px 16px 90px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-top:8px">
        <div>
          ${biz.branding?.logoUrl?`<img src="${esc(biz.branding.logoUrl)}" style="height:30px;object-fit:contain;border-radius:6px"/>`:`<div style="font-size:17px;font-weight:900">${esc(biz.name)}</div>`}
          <div style="font-size:10px;color:var(--gray);font-weight:700;margin-top:2px">${role==='staff'&&me?esc(staffDisplay(me)):role.toUpperCase()}</div>
        </div>
        <button onclick="window._logout()" style="background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--gray);font-size:12px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">Sign Out</button>
      </div>
      <div class="tabs">${sections.map(s=>`<button class="tab${s===active?' active':''}" onclick="window._tab('${s}')" id="tab-${s}">${LABELS[s]||s}</button>`).join('')}</div>
      <div id="dash-body"></div>
    </div>
    <div class="nav-bar">
      <div class="nav-item active"><div class="nav-icon">📊</div><div>Dashboard</div></div>
      <div class="nav-item" onclick="navigate('/${esc(biz.slug)}/tap/preview')"><div class="nav-icon">👁</div><div>Preview</div></div>
      <div class="nav-item" onclick="window._logout()"><div class="nav-icon">🚪</div><div>Out</div></div>
    </div>`;

  window._tab=function(s){
    active=s;
    sections.forEach(x=>{const b=$('tab-'+x);if(b)b.className='tab'+(x===s?' active':'');});
    const body=$('dash-body');if(!body)return;
    switch(s){
      case 'coaching':  body.innerHTML=renderCoachingTab(me);break;
      case 'feedback':  body.innerHTML=renderFeedbackTab(me);break;
      case 'goals':     body.innerHTML=renderGoalsTab(me);break;
      case 'stats':     body.innerHTML=renderStatsTab(me);break;
      case 'branding':  renderBrandingTab(body,me);break;
      case 'ai':        body.innerHTML=renderAITab();break;
      case 'team':      body.innerHTML=renderTeamTab();break;
      case 'staff':     renderStaffTab(body);break;
      case 'links':     renderLinksTab(body);break;
      case 'estimator': body.innerHTML=renderEstimatorTab();break;
      case 'settings':  renderSettingsTab(body);break;
      default:          body.innerHTML=`<div style="color:var(--gray);text-align:center;padding:40px">Coming soon</div>`;
    }
  };
  window._logout=function(){API.auth.logout();State.session=null;State.biz=null;State.staff=[];State.taps=[];renderHome();};
  window._tab(sections[0]);
}

// ── Staff Tabs ────────────────────────────────────────────────────────────────
function renderCoachingTab(me){
  if(!me)return`<div class="card" style="text-align:center;color:var(--gray)">No staff profile found</div>`;
  const myT=State.taps.filter(t=>t.staffId===me.id);
  const rated=myT.filter(t=>t.rating);
  const avg=rated.length?(rated.reduce((s,t)=>s+t.rating,0)/rated.length).toFixed(1):'—';
  const five=rated.filter(t=>t.rating===5).length;
  const fb=myT.filter(t=>t.feedback).slice(0,5);
  const prompt=`You are a hospitality coach. ${me.firstName} has ${myT.length} taps, ${avg} avg stars, ${five} five-star reviews. Feedback: ${fb.map(t=>`"${t.feedback}"`).join('; ')||'none'}. Give 3 specific coaching points. Warm, actionable. Under 120 words.`;
  setTimeout(()=>renderAIBlock('ai-coach',prompt,`coach-${me.id}-${myT.length}`),0);
  return`<div class="stat-grid">
    <div class="stat-box"><div class="stat-val">${myT.length}</div><div class="stat-lbl">Taps</div></div>
    <div class="stat-box"><div class="stat-val">${avg}</div><div class="stat-lbl">Avg Rating</div></div>
    <div class="stat-box"><div class="stat-val">${five}</div><div class="stat-lbl">5-Stars</div></div>
    <div class="stat-box"><div class="stat-val">${rated.length?Math.round(five/rated.length*100):0}%</div><div class="stat-lbl">5★ Rate</div></div>
  </div>
  <div class="sec-lbl" style="margin-top:8px">AI Coaching</div>
  <div id="ai-coach"></div>`;
}

function renderFeedbackTab(me){
  const fb=State.taps.filter(t=>(!me||t.staffId===me.id)&&t.feedback).sort((a,b)=>b.ts-a.ts).slice(0,30);
  if(!fb.length)return`<div class="card" style="text-align:center;color:var(--gray);padding:40px">No feedback yet.</div>`;
  return fb.map(t=>`<div class="fb-item"><div class="fb-stars">${'★'.repeat(t.rating||0)}${'☆'.repeat(5-(t.rating||0))}</div><div class="fb-text">${esc(t.feedback)}</div>${t.feedbackPhoto?`<img src="${esc(t.feedbackPhoto)}" style="width:100%;border-radius:8px;margin-top:8px;max-height:200px;object-fit:cover"/>`:''}<div class="fb-meta">${timeAgo(t.ts)}</div></div>`).join('');
}

function renderGoalsTab(me){
  const goals=State.biz?.teamGoals||[];
  if(!goals.length)return`<div class="card" style="text-align:center;color:var(--gray);padding:40px">No goals set yet.</div>`;
  return goals.map(g=>{
    const mine=me?State.taps.filter(t=>t.staffId===me.id):State.taps;
    const val=g.metric==='taps'?mine.length:g.metric==='fivestar'?mine.filter(t=>t.rating===5).length:0;
    const pct=Math.min(100,Math.round(val/g.target*100));
    return`<div class="goal-row"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><div style="font-weight:700">${esc(g.label)}</div><div style="font-size:13px;color:var(--gray)">${val}/${g.target}</div></div><div class="goal-bar-bg"><div class="goal-bar-fill" style="width:${pct}%"></div></div><div style="font-size:11px;color:var(--gray);margin-top:4px;text-align:right">${pct}%</div></div>`;
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
    <div class="stat-box"><div class="stat-val">${myT.length}</div><div class="stat-lbl">All Time</div></div>
    <div class="stat-box"><div class="stat-val">${avg}</div><div class="stat-lbl">Avg Rating</div></div>
    <div class="stat-box"><div class="stat-val">${myT.filter(t=>t.ts>now-604800000).length}</div><div class="stat-lbl">This Week</div></div>
    <div class="stat-box"><div class="stat-val">${myT.filter(t=>t.ts>now-2592000000).length}</div><div class="stat-lbl">This Month</div></div>
  </div>
  <div class="plain-card" style="margin-top:4px">
    <div class="sec-lbl">Rating Distribution</div>
    ${[5,4,3,2,1].map(r=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:16px;font-size:12px;font-weight:700;color:var(--gray)">${r}★</div><div style="flex:1;height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden"><div style="height:100%;width:${Math.round(dist[r-1]/mx*100)}%;background:var(--green);border-radius:4px"></div></div><div style="width:20px;font-size:12px;color:var(--gray);text-align:right">${dist[r-1]}</div></div>`).join('')}
  </div>`;
}

// ── Branding Tab (staff) ──────────────────────────────────────────────────────
function renderBrandingTab(body,me){
  if(!me){body.innerHTML=`<div class="card" style="color:var(--gray);text-align:center">No staff profile</div>`;return;}
  const allowed=State.biz?.branding?.allowedStaffLinks||{};
  const types=Object.entries(allowed).filter(([,v])=>v).map(([k])=>k);
  const LABELS={spotify:'🎵 Spotify',phone:'📞 Phone',email:'✉️ Email',instagram:'📸 Instagram',tiktok:'🎵 TikTok',custom:'🔗 Custom'};
  let photoData=undefined,links=[...(me.links||[])];

  body.innerHTML=`<div class="plain-card">
    <div style="font-weight:700;font-size:15px;margin-bottom:16px">✨ My Tap Page</div>
    <div class="field-lbl">Profile Photo</div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div id="br-av">${staffAvatar(me,64)}</div>
      <button onclick="window._pickPhoto()" class="btn btn-ghost btn-sm">📷 Upload</button>
    </div>
    <div class="field-lbl">My Title</div>
    <input class="inp" id="br-title" value="${esc(me.title||'')}" placeholder="Server, Bartender" style="margin-bottom:14px"/>
    ${types.length?`
      <div class="sec-lbl">My Links</div>
      <div style="font-size:11px;color:var(--gray);margin-bottom:10px">Show when customers tap your photo</div>
      <div id="br-links"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <select class="sel" id="br-ltype">${types.map(t=>`<option value="${t}">${LABELS[t]||t}</option>`).join('')}</select>
        <input class="inp" id="br-llabel" placeholder="Label"/>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <input class="inp" id="br-lurl" placeholder="URL or @username" style="flex:1"/>
        <button onclick="window._addBrLink()" style="background:var(--green);color:var(--black);border:none;border-radius:10px;padding:0 16px;font-size:16px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif">+</button>
      </div>`:`<div style="background:#15171f;border-radius:10px;padding:12px;font-size:12px;color:var(--gray);margin-bottom:14px">No link types enabled by admin.</div>`}
    <button onclick="window._saveBr()" class="btn btn-primary btn-full">Save My Branding</button>
  </div>`;

  function renderLinks(){
    const el=$('br-links');if(!el)return;
    el.innerHTML=links.length?links.map((l,i)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;background:#15171f;border:1px solid var(--border);border-radius:10px;padding:10px 12px"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">${esc(l.label||l.type)}</div><div style="font-size:11px;color:var(--gray);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.url)}</div></div><button onclick="window._rmBrLink(${i})" style="background:rgba(255,68,85,.08);border:1px solid rgba(255,68,85,.2);border-radius:7px;padding:4px 8px;font-size:11px;font-weight:700;color:var(--red);cursor:pointer;font-family:'Nunito',sans-serif">✕</button></div>`).join(''):`<div style="font-size:12px;color:var(--gray);margin-bottom:8px">No links yet.</div>`;
  }
  renderLinks();

  window._pickPhoto=function(){const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{photoData=ev.target.result;const a=$('br-av');if(a)a.innerHTML=`<img src="${ev.target.result}" style="width:64px;height:64px;border-radius:50%;object-fit:cover"/>`;};r.readAsDataURL(f);};i.click();};
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
    showLoading('Saving…');
    try{await API.staff.update(State.session.bizId,me.id,{title,photo,links});const idx=State.staff.findIndex(s=>s.id===me.id);if(idx>=0)State.staff[idx]={...State.staff[idx],title,photo,links};showToast('Saved ✨');renderDashboard();}
    catch(e){showToast(e.message||'Save failed');renderDashboard();}
  };
}

// ── Manager Tabs ──────────────────────────────────────────────────────────────
function renderAITab(){
  const taps=State.taps,rated=taps.filter(t=>t.rating);
  const avg=rated.length?(rated.reduce((s,t)=>s+t.rating,0)/rated.length).toFixed(1):0;
  const fb=taps.filter(t=>t.feedback).slice(0,10).map(t=>`${t.rating}★: "${t.feedback}"`).join('; ');
  const prompt=`Hospitality business analyst. ${taps.length} taps, ${avg} avg stars. Feedback: ${fb||'none'}. Give 3 key insights and 2 action items. Direct and practical. Under 150 words.`;
  setTimeout(()=>renderAIBlock('ai-insights',prompt,`insights-${taps.length}`),0);
  return`<div class="sec-lbl">AI Business Insights</div><div id="ai-insights"></div>
  <div class="stat-grid" style="margin-top:16px">
    <div class="stat-box"><div class="stat-val">${taps.length}</div><div class="stat-lbl">Total Taps</div></div>
    <div class="stat-box"><div class="stat-val">${avg}</div><div class="stat-lbl">Avg Rating</div></div>
    <div class="stat-box"><div class="stat-val">${taps.filter(t=>t.rating===5).length}</div><div class="stat-lbl">5-Stars</div></div>
    <div class="stat-box"><div class="stat-val">${taps.filter(t=>t.feedback).length}</div><div class="stat-lbl">Feedback</div></div>
  </div>`;
}

function renderTeamTab(){
  const staff=State.staff.filter(s=>s.active);
  if(!staff.length)return`<div class="card" style="text-align:center;color:var(--gray);padding:40px">No active staff yet.</div>`;
  const ranked=staff.map(s=>{const st=State.taps.filter(t=>t.staffId===s.id);const rated=st.filter(t=>t.rating);const avg=rated.length?(rated.reduce((a,t)=>a+t.rating,0)/rated.length).toFixed(1):0;const five=rated.filter(t=>t.rating===5).length;return{...s,taps:st.length,avg,five,score:five*2+st.length};}).sort((a,b)=>b.score-a.score);
  const medals=['🥇','🥈','🥉'];
  return`<div class="plain-card"><div class="sec-lbl">Leaderboard</div>${ranked.map((s,i)=>`<div class="lb-row"><div class="lb-rank">${medals[i]||i+1}</div>${staffAvatar(s,40)}<div class="lb-info"><div class="lb-name">${esc(staffDisplay(s))}</div><div class="lb-sub">${s.taps} taps · ${s.avg}★ avg</div></div><div class="lb-score">${s.five}★</div></div>`).join('')}</div>`;
}

function renderStaffTab(body){
  function draw(){
    body.innerHTML=`<button class="btn btn-primary btn-full" style="margin-bottom:14px" onclick="window._addS()">+ Add Staff Member</button>
    ${State.staff.length===0?`<div class="card" style="text-align:center;color:var(--gray);padding:40px">No staff yet.</div>`:State.staff.map(s=>`<div class="plain-card" style="display:flex;align-items:center;gap:12px">${staffAvatar(s,44)}<div style="flex:1;min-width:0"><div style="font-weight:700">${esc(staffDisplay(s))}</div><div style="font-size:12px;color:var(--gray)">${esc(s.title||'Staff')}</div></div><div style="display:flex;gap:6px"><button onclick="window._editS('${s.id}')" class="btn btn-ghost btn-sm">Edit</button><button onclick="window._togS('${s.id}',${s.active})" class="btn btn-sm" style="background:${s.active?'rgba(255,68,85,.1)':'rgba(0,229,160,.1)'};color:${s.active?'var(--red)':'var(--green)'};border:1px solid ${s.active?'rgba(255,68,85,.2)':'rgba(0,229,160,.2)'}">${s.active?'Deactivate':'Activate'}</button></div></div>`).join('')}`;
  }
  window._addS=function(){
    showModal(`<div class="modal-head"><div class="modal-title">Add Staff</div><button class="modal-close" onclick="closeModal()">×</button></div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div><div class="field-lbl">First Name</div><input class="inp" id="ns-fn" placeholder="Alisha"/></div>
        <div><div class="field-lbl">Last Initial</div><input class="inp" id="ns-li" placeholder="S" maxlength="1"/></div>
        <div><div class="field-lbl">Title</div><input class="inp" id="ns-ti" placeholder="Server, Bartender"/></div>
        <div><div class="field-lbl">Passcode (4 digits)</div><input class="inp" id="ns-pa" type="number" inputmode="numeric" placeholder="1234" maxlength="4"/></div>
        <button class="btn btn-primary btn-full" onclick="window._saveS()">Add</button>
      </div>`);
    window._saveS=async function(){
      const fn=$('ns-fn')?.value?.trim(),li=$('ns-li')?.value?.trim().toUpperCase(),ti=$('ns-ti')?.value?.trim(),pa=$('ns-pa')?.value?.trim();
      if(!fn){showToast('Enter first name');return;}if(!li){showToast('Enter last initial');return;}
      if(!pa||pa.length!==4){showToast('Passcode must be 4 digits');return;}
      closeModal();showLoading('Adding…');
      try{const d=await API.staff.create(State.session.bizId,{firstName:fn,lastInitial:li,title:ti,passcode:pa});State.staff.push(d.staff);showToast(fn+' added ✓');draw();}
      catch(e){showToast(e.message||'Failed');draw();}
    };
  };
  window._togS=async function(id,active){
    try{await API.staff.update(State.session.bizId,id,{active:!active});const i=State.staff.findIndex(s=>s.id===id);if(i>=0)State.staff[i].active=!active;draw();}
    catch(e){showToast(e.message||'Failed');}
  };
  window._editS=function(id){
    const s=State.staff.find(x=>x.id===id);if(!s)return;
    showModal(`<div class="modal-head"><div class="modal-title">Edit ${esc(staffDisplay(s))}</div><button class="modal-close" onclick="closeModal()">×</button></div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div><div class="field-lbl">First Name</div><input class="inp" id="es-fn" value="${esc(s.firstName)}"/></div>
        <div><div class="field-lbl">Last Initial</div><input class="inp" id="es-li" value="${esc(s.lastInitial)}" maxlength="1"/></div>
        <div><div class="field-lbl">Title</div><input class="inp" id="es-ti" value="${esc(s.title||'')}"/></div>
        <div><div class="field-lbl">New Passcode (blank to keep)</div><input class="inp" id="es-pa" type="number" inputmode="numeric" placeholder="Leave blank" maxlength="4"/></div>
        <button class="btn btn-primary btn-full" onclick="window._updateS('${id}')">Save</button>
        <button class="btn btn-danger btn-full" onclick="window._delS('${id}')">Delete</button>
      </div>`);
    window._updateS=async function(sid){
      const u={firstName:$('es-fn')?.value?.trim(),lastInitial:$('es-li')?.value?.trim().toUpperCase(),title:$('es-ti')?.value?.trim()};
      const np=$('es-pa')?.value?.trim();if(np){if(np.length!==4){showToast('Passcode must be 4 digits');return;}u.passcode=np;}
      closeModal();
      try{const d=await API.staff.update(State.session.bizId,sid,u);const i=State.staff.findIndex(x=>x.id===sid);if(i>=0)State.staff[i]={...State.staff[i],...d.staff};showToast('Saved ✓');draw();}
      catch(e){showToast(e.message||'Failed');}
    };
    window._delS=async function(sid){
      if(!confirm('Delete this staff member?'))return;closeModal();
      try{await API.staff.delete(State.session.bizId,sid);State.staff=State.staff.filter(x=>x.id!==sid);showToast('Deleted');draw();}
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
    <div style="font-size:12px;color:var(--gray);margin-bottom:12px">4-5★ ratings redirect here</div>
    ${links.map((l,i)=>`<div class="plain-card" style="display:flex;align-items:center;gap:12px"><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px">${esc(l.label||l.platform)}</div><div style="font-size:11px;color:var(--gray);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.url)}</div></div><button onclick="window._rmL(${i})" style="background:rgba(255,68,85,.08);border:1px solid rgba(255,68,85,.2);border-radius:7px;padding:5px 9px;font-size:11px;font-weight:700;color:var(--red);cursor:pointer;font-family:'Nunito',sans-serif">✕</button></div>`).join('')}
    <button class="btn btn-ghost btn-full" onclick="window._addL()" style="margin-top:4px">+ Add Link</button>
    <button class="btn btn-primary btn-full" onclick="window._saveL()" style="margin-top:8px">Save Links</button>`;
  }
  window._rmL=function(i){links.splice(i,1);draw();};
  window._addL=function(){
    showModal(`<div class="modal-head"><div class="modal-title">Add Review Link</div><button class="modal-close" onclick="closeModal()">×</button></div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div><div class="field-lbl">Platform</div><select class="sel" id="al-p"><option>Google</option><option>Yelp</option><option>TripAdvisor</option><option>OpenTable</option><option>Custom</option></select></div>
        <div><div class="field-lbl">Label</div><input class="inp" id="al-l" placeholder="Review us on Google"/></div>
        <div><div class="field-lbl">URL</div><input class="inp" id="al-u" placeholder="https://g.page/…"/></div>
        <button class="btn btn-primary btn-full" onclick="window._doAddL()">Add</button>
      </div>`);
    window._doAddL=function(){const p=$('al-p')?.value||'Google',l=$('al-l')?.value?.trim()||p;let u=$('al-u')?.value?.trim()||'';if(!u){showToast('Enter URL');return;}if(!u.startsWith('http'))u='https://'+u;links.push({platform:p,label:l,url:u});closeModal();draw();};
  };
  window._saveL=async function(){showLoading('Saving…');try{const d=await API.business.update(State.session.bizId,{links});State.biz={...State.biz,links:d.business.links};showToast('Saved ✓');draw();}catch(e){showToast(e.message||'Failed');draw();}};
  draw();
}

function renderEstimatorTab(){
  setTimeout(()=>{
    window._calcEst=function(){
      const c=parseInt($('ec')?.value)||0,cur=parseFloat($('ecur')?.value)||0,tgt=parseFloat($('etgt')?.value)||0;
      const el=$('eres');if(!el)return;
      if(!c||!cur||!tgt){el.innerHTML=`<div style="color:var(--red);font-size:13px">Fill all fields</div>`;return;}
      if(tgt<=cur){el.innerHTML=`<div style="color:var(--green);font-weight:700;text-align:center;padding:12px">✓ Already at target!</div>`;return;}
      if(tgt>5){el.innerHTML=`<div style="color:var(--red);font-size:13px">Target can't exceed 5.0</div>`;return;}
      const n=Math.max(1,Math.ceil((c*(tgt-cur))/(5-tgt)));
      const taps=Math.ceil(n/0.65);
      const wks=Math.ceil(taps/(Math.max(1,State.staff.filter(s=>s.active).length)*3));
      el.innerHTML=`<div class="stat-grid"><div class="stat-box"><div class="stat-val">${n}</div><div class="stat-lbl">5★ Needed</div></div><div class="stat-box"><div class="stat-val">${taps}</div><div class="stat-lbl">Taps Needed</div></div><div class="stat-box"><div class="stat-val">${wks}w</div><div class="stat-lbl">Est. Time</div></div><div class="stat-box"><div class="stat-val">${cur}→${tgt}</div><div class="stat-lbl">Jump</div></div></div>`;
    };
  },0);
  return`<div class="plain-card">
    <div style="font-weight:700;font-size:16px;margin-bottom:14px">📈 Rating Estimator</div>
    <div class="field-lbl">Platform</div><select class="sel" id="ep" style="margin-bottom:10px"><option>Google</option><option>Yelp</option><option>TripAdvisor</option></select>
    <div class="field-lbl">Current Review Count</div><input class="inp" id="ec" type="number" value="71" style="margin-bottom:8px"/>
    <div class="field-lbl">Current Rating</div><input class="inp" id="ecur" type="number" step="0.1" value="4.2" style="margin-bottom:8px"/>
    <div class="field-lbl">Target Rating</div><input class="inp" id="etgt" type="number" step="0.1" value="4.5" style="margin-bottom:14px"/>
    <button class="btn btn-primary btn-full" onclick="window._calcEst()">Calculate</button>
    <div id="eres" style="margin-top:14px"></div>
  </div>`;
}

// ── Settings Tab (bizAdmin) ───────────────────────────────────────────────────
function renderSettingsTab(body){
  const b=State.biz?.branding||{};
  let bulletinLinks=[...(b.bulletinLinks||[])];

  body.innerHTML=`<div class="plain-card">
    <div style="font-weight:700;font-size:15px;margin-bottom:16px">🎨 Branding & Settings</div>
    <div class="field-lbl">Business Name</div><input class="inp" id="s-name" value="${esc(b.name||State.biz?.name)}" style="margin-bottom:10px"/>
    <div class="field-lbl">Tagline</div><input class="inp" id="s-tag" value="${esc(b.tagline||'')}" placeholder="We Create Memories" style="margin-bottom:10px"/>
    <div class="field-lbl">Logo URL or Upload</div>
    <div style="display:flex;gap:8px;margin-bottom:10px"><input class="inp" id="s-logo" value="${esc(b.logoUrl||'')}" placeholder="https://…" style="flex:1"/><button onclick="window._pickLogo()" class="btn btn-ghost btn-sm">📷</button></div>
    ${b.logoUrl?`<img src="${esc(b.logoUrl)}" id="s-logo-prev" style="height:48px;object-fit:contain;border-radius:8px;margin-bottom:10px;display:block"/>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
      <div><div class="field-lbl">Brand</div><input type="color" id="s-bc" value="${esc(b.brandColor||'#00e5a0')}" style="width:100%;height:42px;border:1px solid var(--border);border-radius:8px;background:transparent;cursor:pointer;padding:2px"/></div>
      <div><div class="field-lbl">Background</div><input type="color" id="s-bg" value="${esc(b.bgColor||'#07080c')}" style="width:100%;height:42px;border:1px solid var(--border);border-radius:8px;background:transparent;cursor:pointer;padding:2px"/></div>
      <div><div class="field-lbl">Text</div><input type="color" id="s-tc" value="${esc(b.textColor||'#ffffff')}" style="width:100%;height:42px;border:1px solid var(--border);border-radius:8px;background:transparent;cursor:pointer;padding:2px"/></div>
    </div>
    <div class="field-lbl">Rating Question</div><input class="inp" id="s-q" value="${esc(b.ratingQuestion||'How was your experience today?')}" style="margin-bottom:10px"/>
    <div class="field-lbl">5★ Prompt</div><input class="inp" id="s-rp" value="${esc(b.reviewPrompt||'')}" style="margin-bottom:10px"/>
    <div class="field-lbl">Thank You Message</div><input class="inp" id="s-ty" value="${esc(b.thankYouMsg||'')}" style="margin-bottom:10px"/>
    <div class="field-lbl">Low Rating Message</div><input class="inp" id="s-lr" value="${esc(b.lowRatingMsg||'')}" style="margin-bottom:16px"/>

    <div class="sec-lbl">Bulletin Board</div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:10px;line-height:1.5">Links shown on every staff tap page</div>
    <div id="s-bulletin" style="margin-bottom:8px"></div>
    <button class="btn btn-ghost btn-full" onclick="window._addBull()" style="margin-bottom:16px">+ Add Bulletin Item</button>

    <div class="sec-lbl">Staff Can Add</div>
    <div style="background:#0e0f15;border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px">
      ${['spotify','phone','email','instagram','tiktok','custom'].map(t=>{const TLABELS={spotify:'🎵 Spotify',phone:'📞 Phone',email:'✉️ Email',instagram:'📸 Instagram',tiktok:'🎵 TikTok',custom:'🔗 Custom'};const on=(b.allowedStaffLinks||{})[t];return`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)"><span style="font-size:13px;font-weight:600">${TLABELS[t]}</span><div class="toggle${on?' on':''}" id="tog-${t}" onclick="this.classList.toggle('on')"><div class="toggle-thumb"></div></div></div>`;}).join('')}
    </div>

    <div style="background:#0e0f15;border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px;text-align:center">
      <div class="field-lbl">Store Code</div>
      <div style="font-size:32px;font-weight:900;letter-spacing:.2em;color:var(--green)">${esc(State.biz?.storeCode)}</div>
      <div style="font-size:12px;color:var(--gray);margin-top:4px">Staff use this to log in</div>
    </div>

    <button class="btn btn-primary btn-full" onclick="window._saveSetting()">Save Settings</button>
  </div>`;

  function drawBulletin(){
    const el=$('s-bulletin');if(!el)return;
    el.innerHTML=bulletinLinks.length?bulletinLinks.map((l,i)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;background:#15171f;border:1px solid var(--border);border-radius:10px;padding:10px 12px"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">${esc(l.label)}</div>${l.url?`<div style="font-size:11px;color:var(--gray);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.url)}</div>`:''}</div><button onclick="window._rmBull(${i})" style="background:rgba(255,68,85,.08);border:1px solid rgba(255,68,85,.2);border-radius:7px;padding:4px 8px;font-size:11px;font-weight:700;color:var(--red);cursor:pointer;font-family:'Nunito',sans-serif">✕</button></div>`).join(''):`<div style="font-size:12px;color:var(--gray);margin-bottom:8px">No items yet.</div>`;
  }
  drawBulletin();

  window._rmBull=function(i){bulletinLinks.splice(i,1);drawBulletin();};
  window._addBull=function(){
    showModal(`<div class="modal-head"><div class="modal-title">Add Bulletin Item</div><button class="modal-close" onclick="closeModal()">×</button></div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div><div class="field-lbl">Type</div><select class="sel" id="bl-t" onchange="window._blTog(this.value)"><option value="custom">🔗 Link</option><option value="text">📝 Text Only</option><option value="spotify">🎵 Spotify</option></select></div>
        <div><div class="field-lbl">Title</div><input class="inp" id="bl-l" placeholder="e.g. Happy Hour 4-6pm"/></div>
        <div id="bl-uw"><div class="field-lbl">URL</div><input class="inp" id="bl-u" placeholder="https://…"/></div>
        <div><div class="field-lbl">Description (optional)</div><input class="inp" id="bl-s" placeholder="More details…"/></div>
        <button class="btn btn-primary btn-full" onclick="window._doAddBull()">Add</button>
      </div>`);
    window._blTog=function(t){const w=$('bl-uw');if(w)w.style.display=t==='text'?'none':'block';};
    window._doAddBull=function(){
      const type=$('bl-t')?.value||'custom',label=$('bl-l')?.value?.trim()||'';let url=$('bl-u')?.value?.trim()||'';const sub=$('bl-s')?.value?.trim()||'';
      if(!label){showToast('Title required');return;}if(type!=='text'&&!url){showToast('URL required');return;}
      if(url&&!url.startsWith('http'))url='https://'+url;
      bulletinLinks.push({type,label,url,sublabel:sub});closeModal();drawBulletin();showToast('Added ✓');
    };
  };

  window._pickLogo=function(){const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{window._logoData=ev.target.result;const li=$('s-logo');if(li)li.value='';let p=$('s-logo-prev');if(!p){p=document.createElement('img');p.id='s-logo-prev';p.style='height:48px;object-fit:contain;border-radius:8px;margin-bottom:10px;display:block';$('s-logo').parentNode.insertAdjacentElement('afterend',p);}p.src=ev.target.result;};r.readAsDataURL(f);};i.click();};

  window._saveSetting=async function(){
    const allowed={};['spotify','phone','email','instagram','tiktok','custom'].forEach(t=>{allowed[t]=!!$('tog-'+t)?.classList.contains('on');});
    const logoUrl=window._logoData||$('s-logo')?.value?.trim()||b.logoUrl||'';
    const branding={
      name:$('s-name')?.value?.trim()||b.name,tagline:$('s-tag')?.value?.trim()||'',logoUrl,
      brandColor:$('s-bc')?.value||'#00e5a0',bgColor:$('s-bg')?.value||'#07080c',textColor:$('s-tc')?.value||'#ffffff',
      ratingQuestion:$('s-q')?.value?.trim()||b.ratingQuestion,reviewPrompt:$('s-rp')?.value?.trim()||b.reviewPrompt,
      thankYouMsg:$('s-ty')?.value?.trim()||b.thankYouMsg,lowRatingMsg:$('s-lr')?.value?.trim()||b.lowRatingMsg,
      bulletinLinks,allowedStaffLinks:allowed,
    };
    showLoading('Saving…');
    try{const d=await API.business.update(State.session.bizId,{branding});State.biz={...State.biz,...d.business};window._logoData=undefined;showToast('Settings saved ✓');renderDashboard();}
    catch(e){showToast(e.message||'Failed');renderDashboard();}
  };
}

// ── Owner Dashboard ───────────────────────────────────────────────────────────
function renderOwnerDashboard(){
  const sess=State.session,bizs=sess?.businesses||[];
  app().innerHTML=`
    <div style="max-width:480px;margin:0 auto;padding:20px 16px 80px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-top:8px">
        <div style="font-size:22px;font-weight:900">Tap<span style="color:var(--green)">+</span> Owner</div>
        <button onclick="API.auth.logout();renderHome()" style="background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--gray);font-size:12px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">Sign Out</button>
      </div>
      ${bizs.length===0?`<div class="card" style="text-align:center;padding:40px">
        <div style="font-size:32px;margin-bottom:12px">🏪</div>
        <div style="font-weight:700;margin-bottom:8px">No businesses yet</div>
        <div style="font-size:13px;color:var(--gray);margin-bottom:20px">Create your first location</div>
        <button class="btn btn-primary" onclick="renderCreateBusiness('${esc(sess.token)}')">Create Business</button>
      </div>`:`
        <div class="sec-lbl">Your Locations</div>
        ${bizs.map(b=>`<div class="plain-card" style="display:flex;align-items:center;gap:12px;cursor:pointer" onclick="window._openBiz('${b.id}')"><div style="width:44px;height:44px;border-radius:10px;background:var(--green-dim);display:flex;align-items:center;justify-content:center;font-size:20px">🏪</div><div style="flex:1"><div style="font-weight:700">${esc(b.name)}</div><div style="font-size:12px;color:var(--gray)">${esc(b.slug)}</div></div><div style="color:var(--gray);font-size:18px">›</div></div>`).join('')}
        <button class="btn btn-ghost btn-full" style="margin-top:8px" onclick="renderCreateBusiness('${esc(sess.token)}')">+ Add Location</button>`}
    </div>`;
  window._openBiz=async function(id){
    showLoading();
    try{const d=await API.business.getById(id);State.biz=d.business;State.session={...sess,bizId:id,role:'bizAdmin'};await loadDashboardData();renderDashboard();}
    catch(e){showError(e.message);}
  };
}

// ── Super Admin ───────────────────────────────────────────────────────────────
function renderSuperAdminDashboard(){
  app().innerHTML=`
    <div style="max-width:480px;margin:0 auto;padding:20px 16px 80px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-top:8px">
        <div style="font-size:20px;font-weight:900">⚡ Super Admin</div>
        <button onclick="API.auth.logout();renderHome()" style="background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--gray);font-size:12px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">Sign Out</button>
      </div>
      <div class="tabs">
        <button class="tab active" onclick="window._saT('layout')" id="sa-layout">Layout</button>
        <button class="tab" onclick="window._saT('biz')" id="sa-biz">Businesses</button>
      </div>
      <div id="sa-body"></div>
    </div>`;

  function saLayout(){
    $('sa-body').innerHTML=`<div style="text-align:center;padding:40px"><div class="spinner" style="margin:0 auto"></div></div>`;
    API.layout.get().then(data=>{
      const L=data.layouts;
      const SECTIONS={staff:['coaching','feedback','goals','stats','branding'],manager:['ai','team','staff','links','goals','estimator'],bizAdmin:['ai','team','staff','links','goals','branding','settings']};
      const SLABELS={coaching:'🤖 Coaching',feedback:'💬 Feedback',goals:'🎯 Goals',stats:'📊 Stats',branding:'✨ Branding',ai:'🤖 AI',team:'🏆 Team',staff:'👥 Staff',links:'🔗 Links',estimator:'📈 Estimator',settings:'⚙️ Settings'};
      const layouts={staff:[...(L.staff||SECTIONS.staff)],manager:[...(L.manager||SECTIONS.manager)],bizAdmin:[...(L.bizAdmin||SECTIONS.bizAdmin)]};

      function drawLayouts(){
        $('sa-body').innerHTML=Object.entries(layouts).map(([role,order])=>`
          <div class="plain-card" style="margin-bottom:12px">
            <div style="font-weight:700;font-size:14px;margin-bottom:12px;text-transform:capitalize">${role} Dashboard</div>
            ${order.map((s,i)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;background:#15171f;border:1px solid var(--border);border-radius:8px;padding:8px 12px">
              <span style="font-size:14px;flex:1">${SLABELS[s]||s}</span>
              <button onclick="window._mvUp('${role}',${i})" style="background:none;border:none;color:var(--gray);cursor:pointer;font-size:16px;padding:2px 6px">↑</button>
              <button onclick="window._mvDn('${role}',${i})" style="background:none;border:none;color:var(--gray);cursor:pointer;font-size:16px;padding:2px 6px">↓</button>
            </div>`).join('')}
          </div>`).join('')+`<button class="btn btn-primary btn-full" onclick="window._saveLayout()">Save Layout</button>`;
      }
      drawLayouts();

      window._mvUp=function(role,i){if(i===0)return;const a=layouts[role];[a[i-1],a[i]]=[a[i],a[i-1]];drawLayouts();};
      window._mvDn=function(role,i){const a=layouts[role];if(i>=a.length-1)return;[a[i],a[i+1]]=[a[i+1],a[i]];drawLayouts();};
      window._saveLayout=async function(){showLoading('Saving…');try{await API.layout.update(layouts);showToast('Layout saved ✓');renderSuperAdminDashboard();}catch(e){showToast(e.message||'Failed');renderSuperAdminDashboard();}};
    });
  }

  window._saT=function(t){
    ['layout','biz'].forEach(x=>{const b=$('sa-'+x);if(b)b.className='tab'+(x===t?' active':'');});
    if(t==='layout')saLayout();
    else $('sa-body').innerHTML=`<div class="card" style="text-align:center;color:var(--gray);padding:40px">Use Firestore console to manage businesses.</div>`;
  };
  window._saT('layout');
}

// ── Customer Tap Page ─────────────────────────────────────────────────────────
async function renderTapPage(bizSlug,staffSlug){
  showLoading();
  let biz;
  try{const d=await API.business.getBySlug(bizSlug);biz=d.business;}
  catch{showError('Business not found');return;}

  const b=biz.branding||{};
  document.body.style.background=b.bgColor||'#07080c';

  // Tap cooldown
  const ck='tp_'+biz.id+'_'+staffSlug,last=parseInt(sessionStorage.getItem(ck)||'0'),now=Date.now(),dup=now-last<1800000;
  const tapId=sessionStorage.getItem(ck+'_id')||'tap_'+now;
  if(!dup){sessionStorage.setItem(ck,String(now));sessionStorage.setItem(ck+'_id',tapId);API.taps.log({bizId:biz.id,bizSlug:biz.slug,staffId:staffSlug,staffName:staffSlug,status:'tapped'}).catch(console.error);}

  const bulletinLinks=b.bulletinLinks||[];
  const links=biz.links||[];

  function linkRow(l){
    const ICONS={google:'🔍',yelp:'⭐',tripadvisor:'🦉',custom:'🔗',spotify:'🎵',phone:'📞',email:'✉️',instagram:'📸',tiktok:'🎵',text:'📝'};
    const icon=ICONS[(l.type||l.platform||'').toLowerCase()]||'🔗';
    if(l.type==='text')return`<div style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px 18px;margin-bottom:10px"><div style="font-weight:700;font-size:14px">${esc(l.label)}</div>${l.sublabel?`<div style="font-size:12px;opacity:.5;margin-top:4px">${esc(l.sublabel)}</div>`:''}</div>`;
    if(l.type==='spotify'){const m=(l.url||'').match(/spotify\.com\/(track|playlist|album|episode)\/([a-zA-Z0-9]+)/);if(m)return`<div style="width:100%;border-radius:14px;overflow:hidden;margin-bottom:10px"><iframe src="https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0" width="100%" height="80" frameborder="0" allow="autoplay;clipboard-write;encrypted-media;fullscreen;picture-in-picture" style="border-radius:14px;display:block"></iframe></div>`;}
    const href=l.type==='phone'?'tel:'+l.url:l.type==='email'?'mailto:'+l.url:l.url||l.href||'#';
    return`<a href="${esc(href)}" target="_blank" rel="noreferrer" style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px 16px;text-decoration:none;margin-bottom:10px"><div style="width:42px;height:42px;border-radius:12px;background:${esc(b.brandColor||'#00e5a0')}18;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${icon}</div><div style="flex:1;text-align:left"><div style="font-weight:700;font-size:14px;color:${esc(b.textColor||'#fff')}">${esc(l.label||l.platform||'Link')}</div>${l.sublabel?`<div style="font-size:11px;opacity:.45;margin-top:2px">${esc(l.sublabel)}</div>`:''}</div><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 4l5 5-5 5" stroke="${esc(b.brandColor||'#00e5a0')}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`;
  }

  function updateStars(r){for(let i=1;i<=5;i++){const el=$('cs'+i);if(el)el.className='star'+(i<=r?' lit':'');}}

  function afterRate(r){
    const el=$('after');if(!el)return;
    if(r>=4&&links.length){
      el.innerHTML=`<div style="text-align:center;margin-bottom:20px"><div style="font-size:18px;font-weight:800;margin-bottom:8px">${esc(b.reviewPrompt||'Share your experience!')}</div></div>${links.map(l=>linkRow(l)).join('')}`;
      API.taps.update(tapId,{rating:r,status:'rated'}).catch(console.error);
    }else if(r<=3){
      el.innerHTML=`<div style="text-align:center;margin-bottom:16px"><div style="font-size:18px;font-weight:800;margin-bottom:6px">${esc(b.lowRatingMsg||"We're sorry to hear that.")}</div></div>
        <textarea id="fb-t" style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;color:inherit;font-size:14px;font-family:'Nunito',sans-serif;outline:none;resize:none;min-height:100px;margin-bottom:12px" placeholder="Tell us what happened…"></textarea>
        <button onclick="window._fb(${r})" style="width:100%;background:${esc(b.brandColor||'#00e5a0')};color:#07080c;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif">Submit</button>`;
      window._fb=async function(rating){const text=$('fb-t')?.value?.trim()||'';await API.taps.update(tapId,{rating,feedback:text,status:'rated'}).catch(console.error);el.innerHTML=`<div style="text-align:center;padding:20px"><div style="font-size:40px;margin-bottom:12px">🙏</div><div style="font-size:18px;font-weight:800">${esc(b.thankYouMsg||'Thank you for your feedback!')}</div></div>`;};
    }
  }

  window._cs=function(r){updateStars(r);setTimeout(()=>afterRate(r),200);};

  app().innerHTML=`
    <style>body{background:${esc(b.bgColor||'#07080c')};color:${esc(b.textColor||'#fff')}}.star{cursor:pointer;font-size:42px;transition:transform .15s;filter:grayscale(1);opacity:.3}.star.lit{filter:none;opacity:1}.star:active{transform:scale(1.25)}</style>
    <div class="tap-page">
      <div style="margin-top:16px;margin-bottom:24px;text-align:center">
        ${b.logoUrl?`<img src="${esc(b.logoUrl)}" style="height:80px;max-width:220px;object-fit:contain;border-radius:16px"/>`:`<div style="font-size:28px;font-weight:900">${esc(b.name)}</div>`}
        ${b.tagline?`<div style="font-size:13px;opacity:.4;margin-top:8px">${esc(b.tagline)}</div>`:''}
      </div>
      <div style="text-align:center;margin-bottom:28px;width:100%">
        <div style="font-size:20px;font-weight:900;margin-bottom:20px">${esc(b.ratingQuestion||'How was your experience today?')}</div>
        <div style="display:flex;gap:10px;justify-content:center">
          ${[1,2,3,4,5].map(i=>`<div id="cs${i}" class="star" onclick="window._cs(${i})">★</div>`).join('')}
        </div>
      </div>
      <div id="after" style="width:100%"></div>
      ${bulletinLinks.length?`<div style="width:100%;margin-top:8px"><div style="font-size:10px;font-weight:700;opacity:.3;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px;text-align:center">${esc(b.name)}</div>${bulletinLinks.map(l=>linkRow(l)).join('')}</div>`:''}
    </div>
    <div style="position:fixed;bottom:10px;left:0;right:0;text-align:center;font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;opacity:.08;pointer-events:none">POWERED BY TAP+</div>`;
}