'use strict';

var fbAuth = window._fbAuth || null;

const State = { session:null, biz:null, staff:[], taps:[], layout:null };

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
  var ld=document.getElementById('loading');
  if(ld){ld.classList.add('hidden');setTimeout(function(){ld.style.display='none';},350);}
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
        <button class="btn btn-ghost btn-full" style="margin-top:10px" onclick="window._ownerEntry()">Owner / Create Account</button>
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
    if(!fbAuth){fbAuth=window._fbAuth||null;}
    const email=$('oe')?.value?.trim(),pass=$('op')?.value;
    if(!email||!pass){showToast('Enter email and password');return;}
    if(!fbAuth){showToast('Firebase not configured');return;}
    showLoading('Signing in…');
    try{const c=await fbAuth.signInWithEmailAndPassword(email,pass);const t=await c.user.getIdToken();const d=await API.auth.loginOwner(t);State.session=d;renderOwnerDashboard();}
    catch(e){app().innerHTML='';renderOwnerLogin();showToast(e.message||'Sign in failed');}
  };
  window._register=async function(){
    if(!fbAuth){fbAuth=window._fbAuth||null;}
    const email=$('oe')?.value?.trim(),pass=$('op')?.value;
    if(!email||!pass){showToast('Enter email and password');return;}
    if(pass.length<6){showToast('Password must be 6+ characters');return;}
    if(!fbAuth){showToast('Firebase not configured');return;}
    showLoading('Creating account…');
    try{const c=await fbAuth.createUserWithEmailAndPassword(email,pass);const t=await c.user.getIdToken();State._ownerToken=t;renderCreateBusiness(t);}
    catch(e){
      app().innerHTML='';renderOwnerLogin();
      if(e.code==='auth/email-already-in-use'){showToast('Email already registered — try Sign In',4000);}
      else{showToast(e.message||'Registration failed');}
    }
  };
}

// ── Create Business ───────────────────────────────────────────────────────────
function renderCreateBusiness(idToken){
  app().innerHTML=`
    <div class="page" style="padding-top:60px">
      <button onclick="renderOwnerLogin()" style="background:none;border:none;color:var(--gray);font-size:13px;cursor:pointer;font-family:'Nunito',sans-serif;margin-bottom:20px;padding:0">← Back</button>
      <h1 style="margin-bottom:6px">Create Business</h1>
      <div style="color:var(--gray);font-size:14px;margin-bottom:24px">Set up your Tap+ location</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div><div class="field-lbl">Business Name</div><input class="inp" id="cb-n" placeholder="The James Room"/></div>
        <div><div class="field-lbl">Admin PIN (4-6 digits)</div><input class="inp" id="cb-a" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="e.g. 1234"/></div>
        <div><div class="field-lbl">Manager PIN (4-6 digits)</div><input class="inp" id="cb-m" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="e.g. 5678"/></div>
        <button class="btn btn-primary btn-full" style="margin-top:8px" onclick="window._create()">Create →</button>
      </div>
    </div>`;
  window._create=async function(){
    const name=$('cb-n')?.value?.trim(),adminPin=$('cb-a')?.value?.trim(),mgrPin=$('cb-m')?.value?.trim();
    if(!name){showToast('Enter business name');return;}
    if(!adminPin||adminPin.length<4){showToast('Admin PIN must be at least 4 digits');return;}
    if(!mgrPin||mgrPin.length<4){showToast('Manager PIN must be at least 4 digits');return;}
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

// ── Dashboard Entry ───────────────────────────────────────────────────────────
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
  const defaults={staff:['coaching','feedback','goals','stats','branding'],manager:['ai','team','staff','goals','estimator','settings'],bizAdmin:['ai','team','staff','goals','settings']};
  const sections=layout?.[role]||defaults[role]||defaults.staff;
  const LABELS={coaching:'🤖 Coaching',feedback:'💬 Feedback',goals:'🎯 Goals',stats:'📊 Stats',branding:'✨ Branding',ai:'🤖 AI Insights',team:'🏆 Team',staff:'👥 Staff',links:'🔗 Links',estimator:'📈 Estimator',settings:'⚙️ Settings'};
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
      <div class="nav-item" onclick="window._preview()"><div class="nav-icon">👁</div><div>Preview</div></div>
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
      case 'ai':        renderAITab(body);break;
      case 'team':      renderTeamTab(body);break;
      case 'staff':     renderStaffTab(body);break;
      case 'estimator': body.innerHTML=renderEstimatorTab();break;
      case 'settings':  renderSettingsTab(body);break;
      default:          body.innerHTML=`<div style="color:var(--gray);text-align:center;padding:40px">Coming soon</div>`;
    }
  };
  window._logout=function(){API.auth.logout();State.session=null;State.biz=null;State.staff=[];State.taps=[];renderHome();};
  window._preview=function(){
    var biz=State.biz;if(!biz)return;
    var b=biz.branding||{},links=biz.links||[],bulletinLinks=b.bulletinLinks||[];
    app().innerHTML=`
      <div style="position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(7,8,12,.95);backdrop-filter:blur(10px);border-bottom:1px solid var(--border);padding:12px 16px;display:flex;align-items:center;gap:12px">
        <button onclick="renderDashboard()" style="background:rgba(255,255,255,.08);border:1px solid var(--border);border-radius:8px;padding:7px 14px;color:var(--white);font-size:13px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">← Back</button>
        <div style="font-size:13px;font-weight:700;color:var(--gray)">Preview Mode</div>
      </div>
      <div style="padding-top:56px"><div class="tap-page">
        <div style="margin-top:16px;margin-bottom:24px;text-align:center">
          ${b.logoUrl?`<img src="${esc(b.logoUrl)}" style="height:80px;max-width:220px;object-fit:contain;border-radius:16px"/>`:`<div style="font-size:28px;font-weight:900">${esc(b.name||'Your Business')}</div>`}
          ${b.tagline?`<div style="font-size:13px;opacity:.4;margin-top:8px">${esc(b.tagline)}</div>`:''}
        </div>
        <div style="text-align:center;margin-bottom:28px;width:100%">
          <div style="font-size:20px;font-weight:900;margin-bottom:20px">${esc(b.ratingQuestion||'How was your experience today?')}</div>
          <div style="display:flex;gap:10px;justify-content:center">
            ${[1,2,3,4,5].map(i=>`<div id="pcs${i}" style="font-size:42px;cursor:pointer;transition:transform .15s;filter:grayscale(1);opacity:.3" onclick="window._pStar(${i})">★</div>`).join('')}
          </div>
        </div>
        <div id="p-after" style="width:100%"></div>
        ${bulletinLinks.length?`<div style="width:100%;margin-top:16px"><div style="font-size:10px;font-weight:700;opacity:.3;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px;text-align:center">${esc(b.name)}</div>${bulletinLinks.map(l=>`<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px 18px;margin-bottom:10px"><div style="font-weight:700;font-size:14px">${esc(l.label)}</div>${l.sublabel?`<div style="font-size:12px;opacity:.5;margin-top:4px">${esc(l.sublabel)}</div>`:''}</div>`).join('')}</div>`:''}
        ${links.length?`<div style="width:100%;margin-top:8px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center;color:var(--gray);font-size:13px">${links.length} review link${links.length>1?'s':''} configured</div>`:''}
        <div style="position:fixed;bottom:10px;left:0;right:0;text-align:center;font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;opacity:.08;pointer-events:none">POWERED BY TAP+</div>
      </div></div>`;
    window._pStar=function(r){
      for(var i=1;i<=5;i++){var el=document.getElementById('pcs'+i);if(el){el.style.filter=i<=r?'none':'grayscale(1)';el.style.opacity=i<=r?'1':'.3';}}
      var after=document.getElementById('p-after');if(!after)return;
      if(r>=4){
        var rp=esc(b.reviewPrompt||"Share your experience!");
        var lh=links.length?links.map(function(l){return'<div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px 16px;margin-bottom:10px"><div style="width:42px;height:42px;border-radius:12px;background:rgba(0,229,160,.1);display:flex;align-items:center;justify-content:center;font-size:20px">⭐</div><div style="flex:1;font-weight:700">'+esc(l.label||l.platform)+'</div></div>';}).join(""):"<div style='padding:16px;text-align:center;color:rgba(238,240,248,.5);font-size:14px'>No review links configured yet</div>";
        after.innerHTML='<div style="text-align:center;margin-bottom:16px"><div style="font-size:16px;font-weight:800;margin-bottom:8px">'+rp+'</div></div>'+lh;
      }else if(r<=3){
        var lm=esc(b.lowRatingMsg||"We're sorry to hear that.");
        after.innerHTML='<div style="text-align:center;margin-bottom:12px"><div style="font-size:16px;font-weight:800">'+lm+'</div></div><textarea style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;color:#eef0f8;font-family:Nunito,sans-serif;outline:none;resize:none;min-height:90px;font-size:14px" placeholder="Tell us what happened…"></textarea><div style="margin-top:10px;text-align:center;font-size:13px;color:rgba(238,240,248,.45)">(Preview only)</div>';
      }
    };
  };
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
    try{await API.staff.update(State.session.bizId,me.id,{title,photo,links});const idx=State.staff.findIndex(s=>s.id===me.id);if(idx>=0)State.staff[idx]={...State.staff[idx],title,photo,links};showToast('Saved ✨');renderDashboard();}
    catch(e){showToast(e.message||'Save failed');}
  };
}

// ── TEAM TAB ──────────────────────────────────────────────────────────────────
function _weekTaps(taps){
  const mon=new Date();mon.setDate(mon.getDate()-((mon.getDay()+6)%7));mon.setHours(0,0,0,0);
  return taps.filter(t=>t.ts>=mon.getTime());
}
function _streak(taps){
  const days=new Set(taps.map(t=>{const d=new Date(t.ts);return`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;}));
  let streak=0,d=new Date();
  for(let i=0;i<30;i++){
    const key=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if(days.has(key)){streak++;d.setDate(d.getDate()-1);}else break;
  }
  return streak;
}
function _score(st){
  const rated=st.filter(t=>t.rating);
  const five=rated.filter(t=>t.rating===5).length;
  const reviews=rated.filter(t=>t.rating>=4).length;
  return st.length*10+reviews*15+five*5;
}

function renderTeamTab(body){
  const staff=State.staff.filter(s=>s.active);
  const taps=State.taps;
  let view='leaderboard';
  let chartMode='donut';

  function staffStats(s){
    const st=taps.filter(t=>t.staffId===s.id);
    const rated=st.filter(t=>t.rating);
    const five=rated.filter(t=>t.rating===5).length;
    const reviews=rated.filter(t=>t.rating>=4).length;
    const avg=rated.length?(rated.reduce((a,t)=>a+t.rating,0)/rated.length).toFixed(1):'0';
    const ctr=st.length?Math.round(rated.length/st.length*100):0;
    const score=_score(st);
    const streak=_streak(st);
    const wTaps=_weekTaps(st).length;
    return{...s,st,rated,five,reviews,avg,ctr,score,streak,wTaps};
  }

  const ranked=staff.map(staffStats).sort((a,b)=>b.score-a.score);
  const topScore=ranked[0]?.score||1;
  const weekTotal=_weekTaps(taps).length;
  const medals=['🥇','🥈','🥉'];

  function draw(){
    if(!body)return;
    if(view==='leaderboard'){
      body.innerHTML=`
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <button onclick="window._teamV('leaderboard')" style="flex:1;padding:10px;border-radius:20px;border:1px solid rgba(0,229,160,.4);background:rgba(0,229,160,.12);color:#00e5a0;font-weight:700;font-size:13px;cursor:pointer;font-family:'Nunito',sans-serif">🏆 Leaderboard</button>
          <button onclick="window._teamV('analytics')" style="flex:1;padding:10px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(238,240,248,.5);font-weight:700;font-size:13px;cursor:pointer;font-family:'Nunito',sans-serif">📊 Analytics</button>
          <button onclick="window._teamRefresh()" style="width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(238,240,248,.5);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">↺</button>
        </div>
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 16px;margin-bottom:12px;display:flex;align-items:center;gap:12px">
          <div style="font-size:28px">🏆</div>
          <div><div style="font-weight:700;font-size:14px">This Week:</div><div style="font-size:12px;color:rgba(238,240,248,.45)">${weekTotal} taps · Resets Monday</div></div>
        </div>
        ${ranked.length===0?`<div style="text-align:center;color:rgba(238,240,248,.35);padding:40px">No active staff yet.</div>`:
          ranked.map((s,i)=>{
            const pct=topScore?Math.round(s.score/topScore*100):0;
            const isOnFire=s.streak>=3||s.wTaps>=5;
            const streakDots=Math.min(s.streak,10);
            const barColor=i===0?'linear-gradient(90deg,#00e5a0,#00c48a)':i===1?'linear-gradient(90deg,#ffd166,#f4a261)':'linear-gradient(90deg,#4facfe,#a78bfa)';
            return`<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px 16px;margin-bottom:10px">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                <div style="font-size:22px;width:28px;text-align:center">${medals[i]||i+1}</div>
                ${staffAvatar(s,44)}
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <div style="font-weight:800;font-size:15px">${esc(staffDisplay(s))}</div>
                    ${isOnFire?`<span>🔥</span><span style="background:#ff4455;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">On Fire</span>`:''}
                  </div>
                  <div style="font-size:11px;color:rgba(238,240,248,.4);margin-top:2px">${s.wTaps} taps · ${s.reviews} reviews · ${s.avg}⭐ · CTR ${s.ctr}%</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:22px;font-weight:900;color:#00e5a0">${s.score}</div>
                  <div style="font-size:10px;color:rgba(238,240,248,.35);font-weight:700">PTS</div>
                </div>
              </div>
              ${streakDots>0?`<div style="display:flex;gap:4px;margin-bottom:8px">${Array(streakDots).fill(0).map((_,j)=>`<div style="width:10px;height:10px;border-radius:50%;background:#00e5a0;opacity:${0.4+j*0.06}"></div>`).join('')}</div>`:''}
              <div style="height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width .4s ease"></div>
              </div>
              <div style="font-size:10px;color:rgba(238,240,248,.25);margin-top:4px;text-align:right">${pct}%</div>
            </div>`;
          }).join('')
        }
        <div style="text-align:center;font-size:11px;color:rgba(238,240,248,.2);margin-top:4px">Score = Taps×10 + Reviews×15 + 5★×5</div>`;
    } else {
      // Analytics view
      const rated=taps.filter(t=>t.rating);
      const five=rated.filter(t=>t.rating===5).length;
      const pos=rated.filter(t=>t.rating>=4).length;
      const neg=rated.filter(t=>t.rating<=3).length;
      const avg=rated.length?(rated.reduce((s,t)=>s+t.rating,0)/rated.length).toFixed(1):'0';
      const ctr=taps.length?Math.round(rated.length/taps.length*100):0;

      const bizLinks=State.biz?.links||[];
      const platCounts={};
      bizLinks.forEach(l=>{platCounts[l.label||l.platform]=0;});
      taps.filter(t=>t.linkClicked).forEach(t=>{const k=t.linkClicked;platCounts[k]=(platCounts[k]||0)+1;});
      const platLabels=Object.keys(platCounts);
      const platData=Object.values(platCounts);
      const platColors=['#00e5a0','#ffd166','#4facfe','#a78bfa','#ff8c42'];

      const staffLabels=ranked.map(s=>s.firstName);
      const staffTapData=ranked.map(s=>s.st.length);
      const staffColors=['#00e5a0','#ffd166','#4facfe','#a78bfa','#ff8c42','#ff4455','#02c39a','#f4a261'];

      body.innerHTML=`
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <button onclick="window._teamV('leaderboard')" style="flex:1;padding:10px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(238,240,248,.5);font-weight:700;font-size:13px;cursor:pointer;font-family:'Nunito',sans-serif">🏆 Leaderboard</button>
          <button onclick="window._teamV('analytics')" style="flex:1;padding:10px;border-radius:20px;border:1px solid rgba(0,229,160,.4);background:rgba(0,229,160,.12);color:#00e5a0;font-weight:700;font-size:13px;cursor:pointer;font-family:'Nunito',sans-serif">📊 Analytics</button>
          <button onclick="window._teamRefresh()" style="width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(238,240,248,.5);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">↺</button>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:12px">
          <button onclick="window._teamChart('bar')" style="padding:6px 14px;border-radius:20px;border:1px solid ${chartMode==='bar'?'rgba(0,229,160,.4)':'rgba(255,255,255,.1)'};background:${chartMode==='bar'?'rgba(0,229,160,.12)':'rgba(255,255,255,.04)'};color:${chartMode==='bar'?'#00e5a0':'rgba(238,240,248,.45)'};font-size:12px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">▬ Bar</button>
          <button onclick="window._teamChart('donut')" style="padding:6px 14px;border-radius:20px;border:1px solid ${chartMode==='donut'?'rgba(0,229,160,.4)':'rgba(255,255,255,.1)'};background:${chartMode==='donut'?'rgba(0,229,160,.12)':'rgba(255,255,255,.04)'};color:${chartMode==='donut'?'#00e5a0':'rgba(238,240,248,.45)'};font-size:12px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">● Donut</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          ${[['#00e5a0',taps.length,'Total Taps'],['#ffd166',rated.length,'Reviews'],['#ff8c42',avg+'⭐','Avg Rating'],['#a78bfa',ctr+'%','CTR'],['#4facfe',pos,'Positive'],['#ff4455',neg,'Negative']].map(([col,val,lbl])=>`
            <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 16px">
              <div style="font-size:26px;font-weight:900;color:${col}">${val}</div>
              <div style="font-size:12px;color:rgba(238,240,248,.4);margin-top:2px">${lbl}</div>
            </div>`).join('')}
        </div>
        ${platLabels.length?`
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 16px;margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:rgba(238,240,248,.3);margin-bottom:12px">PLATFORM</div>
          <div style="display:flex;align-items:center;gap:16px">
            <div style="position:relative;width:90px;height:90px;flex-shrink:0"><canvas id="ch-plat"></canvas></div>
            <div style="flex:1">${platLabels.map((l,i)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="width:10px;height:10px;border-radius:50%;background:${platColors[i%platColors.length]}"></div><div style="font-size:13px;font-weight:600">${esc(l)}</div><div style="margin-left:auto;font-size:13px;font-weight:800;color:${platColors[i%platColors.length]}">${platData[i]}</div></div>`).join('')}</div>
          </div>
        </div>`:''}
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 16px;margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:rgba(238,240,248,.3);margin-bottom:12px">TAPS PER STAFF</div>
          ${chartMode==='donut'?`
            <div style="display:flex;align-items:center;gap:16px">
              <div style="position:relative;width:90px;height:90px;flex-shrink:0"><canvas id="ch-staff"></canvas></div>
              <div style="flex:1">${staffLabels.map((l,i)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="width:10px;height:10px;border-radius:50%;background:${staffColors[i%staffColors.length]}"></div><div style="font-size:13px;font-weight:600">${esc(l)}</div><div style="margin-left:auto;font-size:13px;font-weight:800;color:${staffColors[i%staffColors.length]}">${staffTapData[i]}</div></div>`).join('')}</div>
            </div>`
          :`<div style="height:${Math.max(120,staffLabels.length*36)}px"><canvas id="ch-staff"></canvas></div>`}
        </div>`;

      setTimeout(()=>{
        if(!window.Chart)return;
        Chart.defaults.color='rgba(238,240,248,.45)';
        Chart.defaults.borderColor='rgba(255,255,255,.07)';
        Chart.defaults.font.family="'Nunito',sans-serif";
        if(platLabels.length){
          const ctx=document.getElementById('ch-plat')?.getContext('2d');
          if(ctx)new Chart(ctx,{type:'doughnut',data:{labels:platLabels,datasets:[{data:platData,backgroundColor:platColors.map(c=>c+'33'),borderColor:platColors,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'70%',plugins:{legend:{display:false},tooltip:{backgroundColor:'#1a1b26',borderColor:'rgba(255,255,255,.1)',borderWidth:1}}}});
        }
        const sctx=document.getElementById('ch-staff')?.getContext('2d');
        if(sctx){
          if(chartMode==='donut'){
            new Chart(sctx,{type:'doughnut',data:{labels:staffLabels,datasets:[{data:staffTapData,backgroundColor:staffColors.slice(0,staffLabels.length).map(c=>c+'33'),borderColor:staffColors.slice(0,staffLabels.length),borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'70%',plugins:{legend:{display:false},tooltip:{backgroundColor:'#1a1b26',borderColor:'rgba(255,255,255,.1)',borderWidth:1}}}});
          } else {
            new Chart(sctx,{type:'bar',data:{labels:staffLabels,datasets:[{label:'Taps',data:staffTapData,backgroundColor:staffColors.slice(0,staffLabels.length).map(c=>c+'33'),borderColor:staffColors.slice(0,staffLabels.length),borderWidth:1.5,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.05)'},beginAtZero:true,ticks:{precision:0,color:'rgba(238,240,248,.35)'}},y:{grid:{display:false},ticks:{color:'rgba(238,240,248,.35)'}}}}});
          }
        }
      },30);
    }
  }

  window._teamV=function(v){view=v;draw();};
  window._teamChart=function(m){chartMode=m;draw();};
  window._teamRefresh=async function(){
    if(body)body.innerHTML='<div style="text-align:center;padding:40px"><div class="spinner" style="margin:0 auto"></div></div>';
    await loadDashboardData();
    draw();
  };
  draw();
}

// ── AI INSIGHTS TAB ───────────────────────────────────────────────────────────
function renderAITab(body){
  const taps=State.taps;
  const staff=State.staff.filter(s=>s.active);
  const rated=taps.filter(t=>t.rating);
  const avg=rated.length?(rated.reduce((s,t)=>s+t.rating,0)/rated.length).toFixed(1):'0';
  const five=rated.filter(t=>t.rating===5).length;
  const fb=taps.filter(t=>t.feedback).slice(0,15).map(t=>`${t.rating}★: "${t.feedback}"`).join('; ');
  const topPerformer=staff.map(s=>{const st=taps.filter(t=>t.staffId===s.id);return{name:s.firstName,score:_score(st)};}).sort((a,b)=>b.score-a.score)[0]?.name||'N/A';

  const prompts={
    summary:`You are a hospitality analytics assistant. Weekly team summary:
- Total taps: ${taps.length}, Avg rating: ${avg}★, 5-star reviews: ${five}
- Staff count: ${staff.length}, Top performer: ${topPerformer}
- Feedback: ${fb||'none'}
Write a concise Weekly Summary with: Team Performance overview, Key Observations (Top Performer, Support Needed, Feedback Patterns, Priority Action). Use **bold** for headers. Under 200 words.`,
    coaching:`You are a hospitality coach. Team: ${staff.length} staff, ${avg}★ avg across ${taps.length} taps. Feedback: ${fb||'none'}. Give 3-4 specific coaching tips the manager can implement this week. Actionable, warm. Under 150 words.`,
    feedback:`Analyze this customer feedback. Identify patterns, complaints, and what customers love. Feedback: ${fb||'No feedback yet.'}. Give: 1) Sentiment overview 2) Top praise themes 3) Top complaint themes 4) One quick win. Under 150 words.`
  };

  let aiView='summary';

  function _renderAIText(elId,text){
    const el=$(elId);if(!el)return;
    const html=text
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/^[-•›]\s+(.+)$/gm,'<div style="display:flex;gap:8px;margin-bottom:6px"><span style="color:#a78bfa;flex-shrink:0">›</span><span>$1</span></div>')
      .replace(/\n\n/g,'</p><p style="margin-bottom:10px">')
      .replace(/\n/g,'<br/>');
    el.innerHTML=`<div style="font-size:13px;line-height:1.7;color:rgba(238,240,248,.8)">${html}</div>`;
  }

  function _fetchAI(elId,prompt,cacheKey){
    if(_aiCache[cacheKey]){_renderAIText(elId,_aiCache[cacheKey]);return;}
    const el=$(elId);
    if(el)el.innerHTML='<div style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto 10px"></div><div style="font-size:12px;color:rgba(238,240,248,.35)">Analyzing…</div></div>';
    askAI(prompt,cacheKey).then(text=>{
      if(!text){const el2=$(elId);if(el2)el2.innerHTML='<div style="color:rgba(238,240,248,.35);font-size:13px">AI unavailable.</div>';return;}
      _renderAIText(elId,text);
    });
  }

  function drawView(){
    const vb=$('ai-view-body');if(!vb)return;

    if(aiView==='summary'){
      vb.innerHTML=`
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(138,99,255,.15);display:flex;align-items:center;justify-content:center;font-size:18px">🧠</div>
            <div style="font-weight:800;font-size:15px">Weekly Summary</div>
          </div>
          <div id="ai-v-body"></div>
          <div style="margin-top:12px;text-align:center"><button onclick="window._aiRefresh('summary')" style="background:none;border:none;color:rgba(238,240,248,.25);font-size:11px;cursor:pointer;font-family:'Nunito',sans-serif">↺ Refresh</button></div>
        </div>`;
      _fetchAI('ai-v-body',prompts.summary,`summary-${taps.length}-${avg}`);

    } else if(aiView==='coaching'){
      vb.innerHTML=`
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(0,229,160,.1);display:flex;align-items:center;justify-content:center;font-size:18px">💬</div>
            <div style="font-weight:800;font-size:15px">Manager Coaching Tips</div>
          </div>
          <div id="ai-v-body"></div>
          <div style="margin-top:12px;text-align:center"><button onclick="window._aiRefresh('coaching')" style="background:none;border:none;color:rgba(238,240,248,.25);font-size:11px;cursor:pointer;font-family:'Nunito',sans-serif">↺ Refresh</button></div>
        </div>
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px">
          <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:rgba(238,240,248,.3);margin-bottom:10px">STAFF BREAKDOWN</div>
          ${staff.length===0?'<div style="color:rgba(238,240,248,.3);font-size:13px">No active staff.</div>':
            staff.map(s=>{
              const st=taps.filter(t=>t.staffId===s.id);
              const r2=st.filter(t=>t.rating);
              const a2=r2.length?(r2.reduce((a,t)=>a+t.rating,0)/r2.length).toFixed(1):'—';
              const f2=r2.filter(t=>t.rating===5).length;
              return`<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)">
                ${staffAvatar(s,36)}
                <div style="flex:1"><div style="font-weight:700;font-size:13px">${esc(staffDisplay(s))}</div><div style="font-size:11px;color:rgba(238,240,248,.35)">${st.length} taps · ${a2}★ · ${f2} five-stars</div></div>
                <div style="font-size:11px;font-weight:700;color:${parseFloat(a2)>=4?'#00e5a0':parseFloat(a2)>=3?'#ffd166':'#ff4455'}">${a2}★</div>
              </div>`;
            }).join('')}
        </div>`;
      _fetchAI('ai-v-body',prompts.coaching,`coaching-${taps.length}`);

    } else if(aiView==='feedback'){
      const fbList=taps.filter(t=>t.feedback).sort((a,b)=>b.ts-a.ts).slice(0,20);
      vb.innerHTML=`
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,209,102,.1);display:flex;align-items:center;justify-content:center;font-size:18px">🔍</div>
            <div style="font-weight:800;font-size:15px">Feedback Analysis</div>
          </div>
          <div id="ai-v-body"></div>
        </div>
        <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:rgba(238,240,248,.3);margin-bottom:10px">RAW FEEDBACK</div>
        ${fbList.length===0?'<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:24px;text-align:center;color:rgba(238,240,248,.3)">No feedback yet.</div>':
          fbList.map(t=>{
            const s=State.staff.find(x=>x.id===t.staffId);
            return`<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:12px 14px;margin-bottom:8px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <div style="font-size:13px;font-weight:700;color:#ffd166">${'★'.repeat(t.rating||0)}${'☆'.repeat(5-(t.rating||0))}</div>
                <div style="font-size:10px;color:rgba(238,240,248,.3)">${timeAgo(t.ts)}${s?' · '+esc(staffDisplay(s)):''}</div>
              </div>
              <div style="font-size:13px;color:rgba(238,240,248,.7);line-height:1.5">${esc(t.feedback)}</div>
            </div>`;
          }).join('')}`;
      _fetchAI('ai-v-body',prompts.feedback,`feedback-${fbList.length}`);

    } else if(aiView==='export'){
      const weekTaps=_weekTaps(taps);
      const weekRated=weekTaps.filter(t=>t.rating);
      const weekAvg=weekRated.length?(weekRated.reduce((s,t)=>s+t.rating,0)/weekRated.length).toFixed(1):'—';
      const staffRows=staff.map(s=>{const st=taps.filter(t=>t.staffId===s.id);const r2=st.filter(t=>t.rating);const a2=r2.length?(r2.reduce((a,t)=>a+t.rating,0)/r2.length).toFixed(1):'—';const f2=r2.filter(t=>t.rating===5).length;return`${staffDisplay(s)},${st.length},${a2},${f2},${_score(st)}`;}).join('\n');
      const csv=`tap+ Performance Export\nGenerated: ${new Date().toLocaleDateString()}\n\nOVERALL\nTotal Taps,${taps.length}\nAvg Rating,${avg}\n5-Star Reviews,${five}\nFeedback Count,${taps.filter(t=>t.feedback).length}\n\nTHIS WEEK\nWeek Taps,${weekTaps.length}\nWeek Avg Rating,${weekAvg}\n\nSTAFF PERFORMANCE\nName,Taps,Avg Rating,5-Stars,Score\n${staffRows}`;
      vb.innerHTML=`
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(79,172,254,.1);display:flex;align-items:center;justify-content:center;font-size:18px">📄</div>
            <div style="font-weight:800;font-size:15px">Export Report</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
            ${[['#00e5a0',taps.length,'Total Taps'],['#ffd166',avg+'★','Avg Rating'],['#4facfe',five,'5-Stars'],['#a78bfa',taps.filter(t=>t.feedback).length,'Feedback']].map(([col,val,lbl])=>`
              <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px">
                <div style="font-size:22px;font-weight:900;color:${col}">${val}</div>
                <div style="font-size:11px;color:rgba(238,240,248,.35);margin-top:2px">${lbl}</div>
              </div>`).join('')}
          </div>
          <button onclick="window._exportCSV()" style="width:100%;padding:13px;border-radius:12px;border:none;background:#00e5a0;color:#07080c;font-size:14px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;margin-bottom:10px">⬇ Download CSV</button>
          <button onclick="window._copyReport()" style="width:100%;padding:13px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(238,240,248,.7);font-size:14px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">📋 Copy to Clipboard</button>
        </div>`;
      window._exportCSV=function(){const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`tapplus-report-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);showToast('CSV downloaded ✓');};
      window._copyReport=function(){navigator.clipboard?.writeText(csv).then(()=>showToast('Copied ✓'));};
    }
  }

  function draw(){
    if(!body)return;
    const tabDefs=[{id:'summary',label:'📋 Summary'},{id:'coaching',label:'💬 Coaching'},{id:'feedback',label:'🔍 Feedback'},{id:'export',label:'📄 Export'}];
    body.innerHTML=`
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        ${tabDefs.map(t=>`<button onclick="window._aiV('${t.id}')" style="padding:9px 14px;border-radius:20px;border:1px solid ${aiView===t.id?'rgba(138,99,255,.5)':'rgba(255,255,255,.1)'};background:${aiView===t.id?'rgba(138,99,255,.15)':'rgba(255,255,255,.04)'};color:${aiView===t.id?'#a78bfa':'rgba(238,240,248,.45)'};font-weight:700;font-size:12px;cursor:pointer;font-family:'Nunito',sans-serif">${t.label}</button>`).join('')}
      </div>
      <div id="ai-view-body"></div>`;
    window._aiV=function(v){aiView=v;draw();};
    window._aiRefresh=function(type){Object.keys(_aiCache).filter(k=>k.startsWith(type)).forEach(k=>delete _aiCache[k]);drawView();};
    drawView();
  }

  draw();
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────
function renderStaffTab(body){
  function draw(){
    body.innerHTML=`<button class="btn btn-primary btn-full" style="margin-bottom:14px" onclick="window._addS()">+ Add Staff Member</button>
    ${State.staff.length===0?`<div class="card" style="text-align:center;color:var(--gray);padding:40px">No staff yet.</div>`:State.staff.map(s=>{var tapUrl='/'+State.biz.slug+'/tap/'+s.id;return`<div class="plain-card"><div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">${staffAvatar(s,44)}<div style="flex:1;min-width:0"><div style="font-weight:700">${esc(staffDisplay(s))}</div><div style="font-size:12px;color:var(--gray)">${esc(s.title||'Staff')}</div></div><div style="display:flex;gap:6px"><button onclick="window._editS('${s.id}')" class="btn btn-ghost btn-sm">Edit</button><button onclick="window._togS('${s.id}',${s.active})" class="btn btn-sm" style="background:${s.active?'rgba(255,68,85,.1)':'rgba(0,229,160,.1)'};color:${s.active?'var(--red)':'var(--green)'};border:1px solid ${s.active?'rgba(255,68,85,.2)':'rgba(0,229,160,.2)'}">${s.active?'Deactivate':'Activate'}</button></div></div><div style="font-size:11px;color:var(--gray);background:rgba(255,255,255,.03);border-radius:8px;padding:6px 10px;font-family:monospace;display:flex;align-items:center;justify-content:space-between"><span>${esc(tapUrl)}</span><button onclick="navigator.clipboard&&navigator.clipboard.writeText(window.location.origin+'${esc(tapUrl)}').then(()=>showToast('URL copied!'))" style="background:none;border:none;color:var(--green);font-size:11px;cursor:pointer;font-family:inherit;font-weight:700">Copy</button></div></div>`;}).join('')}`;
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
      closeModal();
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


// ── Estimator Tab ─────────────────────────────────────────────────────────────
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
function renderSettingsTab(body) {
  const biz = State.biz;
  const b   = biz?.branding || {};
  const platformLinks = biz?.platformLinks || [];
  let reviewLinks = [...(biz?.reviewLinks || [])];
  let dragIdx = null;

  function availablePlatforms() {
    const added = new Set(reviewLinks.map(l => l.platform));
    return platformLinks.filter(p => p.enabled && !added.has(p.platform));
  }

  function _platformIcon(platform) {
    const icons = { google:'🔍', yelp:'⭐', tripadvisor:'🦉', opentable:'🍽️', facebook:'👍', custom:'🔗' };
    return icons[(platform||'').toLowerCase()] || '🔗';
  }

  function draw() {
    const avail = availablePlatforms();
    body.innerHTML = `
      <div class="plain-card">
        <div style="font-weight:700;font-size:15px;margin-bottom:4px">⚙️ Settings</div>
        <div style="font-size:12px;color:var(--gray);margin-bottom:16px">Store code, rating question, messages</div>
        <div style="background:#0e0f15;border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px;text-align:center">
          <div class="field-lbl">Store Code</div>
          <div style="font-size:32px;font-weight:900;letter-spacing:.2em;color:var(--green)">${esc(biz?.storeCode)}</div>
          <div style="font-size:12px;color:var(--gray);margin-top:4px">Staff use this to log in</div>
        </div>
        <div class="field-lbl">Rating Question</div>
        <input class="inp" id="s-q" value="${esc(b.ratingQuestion||'How was your experience today?')}" style="margin-bottom:10px"/>
        <div class="field-lbl">Low Rating Message</div>
        <input class="inp" id="s-lr" value="${esc(b.lowRatingMsg||"We're sorry to hear that.")}" style="margin-bottom:10px"/>
        <div class="field-lbl">Thank You (shown after 5★ before redirect)</div>
        <input class="inp" id="s-ty" value="${esc(b.thankYouMsg||'Thank you! Redirecting you now\u2026')}" style="margin-bottom:20px"/>
        <div style="font-weight:700;font-size:15px;margin-bottom:4px">⭐ Review Links</div>
        <div style="font-size:12px;color:var(--gray);margin-bottom:14px">
          First link = 5★ auto-redirect · 4★ shows all links · Drag to reorder
        </div>
        <div id="rl-list" style="margin-bottom:12px">
          ${reviewLinks.length === 0
            ? `<div style="background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.1);border-radius:12px;padding:20px;text-align:center;color:var(--gray);font-size:13px">No review links added yet.<br/>Tap + to add platforms.</div>`
            : reviewLinks.map((l, i) => `
              <div draggable="true"
                ondragstart="window._rlDragStart(${i})"
                ondragover="event.preventDefault()"
                ondrop="window._rlDrop(${i})"
                style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.04);border:1px solid ${i===0?'rgba(0,229,160,.3)':'rgba(255,255,255,.07)'};border-radius:12px;padding:12px 14px;margin-bottom:8px;cursor:grab">
                <div style="font-size:18px;color:rgba(238,240,248,.25);user-select:none">⠿</div>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <div style="font-weight:700;font-size:14px">${esc(l.label||l.platform)}</div>
                    ${i===0?`<span style="background:rgba(0,229,160,.15);color:#00e5a0;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;border:1px solid rgba(0,229,160,.3)">5★ REDIRECT</span>`:''}
                  </div>
                  <div style="font-size:11px;color:var(--gray);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.url)}</div>
                </div>
                <button onclick="window._rlRemove(${i})" style="background:rgba(255,68,85,.08);border:1px solid rgba(255,68,85,.2);border-radius:8px;padding:5px 9px;font-size:12px;font-weight:700;color:var(--red);cursor:pointer;font-family:'Nunito',sans-serif;flex-shrink:0">✕</button>
              </div>`).join('')
          }
        </div>
        ${avail.length > 0
          ? `<button onclick="window._rlAdd()" class="btn btn-ghost btn-full" style="margin-bottom:16px">+ Add Review Platform</button>`
          : platformLinks.length === 0
            ? `<div style="background:rgba(255,165,0,.06);border:1px solid rgba(255,165,0,.2);border-radius:10px;padding:12px;font-size:12px;color:rgba(255,165,0,.8);margin-bottom:16px;text-align:center">No platforms configured — contact your administrator.</div>`
            : `<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px;font-size:12px;color:var(--gray);margin-bottom:16px;text-align:center">All available platforms added.</div>`
        }
        <button onclick="window._saveSettings()" class="btn btn-primary btn-full">Save Settings</button>
      </div>`;

    window._rlDragStart = function(i) { dragIdx = i; };
    window._rlDrop = function(toIdx) {
      if (dragIdx === null || dragIdx === toIdx) return;
      const moved = reviewLinks.splice(dragIdx, 1)[0];
      reviewLinks.splice(toIdx, 0, moved);
      dragIdx = null;
      draw();
    };
    window._rlRemove = function(i) { reviewLinks.splice(i, 1); draw(); };
    window._rlAdd = function() {
      const avail2 = availablePlatforms();
      showModal(`
        <div class="modal-head">
          <div class="modal-title">Add Review Platform</div>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${avail2.map((p, i) => `
            <button onclick="window._rlPick(${i})"
              style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px 16px;cursor:pointer;text-align:left;font-family:'Nunito',sans-serif;width:100%">
              <div style="font-size:22px">${_platformIcon(p.platform)}</div>
              <div style="min-width:0">
                <div style="font-weight:700;font-size:14px;color:#eef0f8">${esc(p.label||p.platform)}</div>
                <div style="font-size:11px;color:rgba(238,240,248,.35);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px">${esc(p.url)}</div>
              </div>
            </button>`).join('')}
        </div>`);
      window._rlPick = function(i) {
        const p = avail2[i];
        reviewLinks.push({ platform: p.platform, label: p.label || p.platform, url: p.url });
        closeModal();
        draw();
      };
    };
  }

  window._saveSettings = async function() {
    const updates = {
      reviewLinks,
      branding: {
        ...b,
        ratingQuestion: $('s-q')?.value?.trim() || b.ratingQuestion,
        lowRatingMsg:   $('s-lr')?.value?.trim() || b.lowRatingMsg,
        thankYouMsg:    $('s-ty')?.value?.trim() || b.thankYouMsg,
      }
    };
    try {
      const d = await API.business.update(State.session.bizId, updates);
      State.biz = { ...State.biz, ...d.business };
      showToast('Settings saved ✓');
      draw();
    } catch(e) { showToast(e.message || 'Save failed'); }
  };

  draw();
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
      ${bizs.length===0?`<div class="card" style="text-align:center;padding:40px"><div style="font-size:32px;margin-bottom:12px">🏪</div><div style="font-weight:700;margin-bottom:8px">No businesses yet</div><div style="font-size:13px;color:var(--gray);margin-bottom:20px">Create your first location</div><button class="btn btn-primary" onclick="renderCreateBusiness('${esc(sess.token)}')">Create Business</button></div>`:`
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
      const SLABELS={coaching:'🤖 Coaching',feedback:'💬 Feedback',goals:'🎯 Goals',stats:'📊 Stats',branding:'✨ Branding',ai:'🤖 AI Insights',team:'🏆 Team',staff:'👥 Staff',links:'🔗 Links',estimator:'📈 Estimator',settings:'⚙️ Settings'};
      const layouts={staff:[...(L.staff||SECTIONS.staff)],manager:[...(L.manager||SECTIONS.manager)],bizAdmin:[...(L.bizAdmin||SECTIONS.bizAdmin)]};
      function drawLayouts(){
        $('sa-body').innerHTML=Object.entries(layouts).map(([role,order])=>`
          <div class="plain-card" style="margin-bottom:12px">
            <div style="font-weight:700;font-size:14px;margin-bottom:12px;text-transform:capitalize">${role} Dashboard</div>
            ${order.map((s,i)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;background:#15171f;border:1px solid var(--border);border-radius:8px;padding:8px 12px"><span style="font-size:14px;flex:1">${SLABELS[s]||s}</span><button onclick="window._mvUp('${role}',${i})" style="background:none;border:none;color:var(--gray);cursor:pointer;font-size:16px;padding:2px 6px">↑</button><button onclick="window._mvDn('${role}',${i})" style="background:none;border:none;color:var(--gray);cursor:pointer;font-size:16px;padding:2px 6px">↓</button></div>`).join('')}
          </div>`).join('')+`<button class="btn btn-primary btn-full" onclick="window._saveLayout()">Save Layout</button>`;
      }
      drawLayouts();
      window._mvUp=function(role,i){if(i===0)return;const a=layouts[role];[a[i-1],a[i]]=[a[i],a[i-1]];drawLayouts();};
      window._mvDn=function(role,i){const a=layouts[role];if(i>=a.length-1)return;[a[i],a[i+1]]=[a[i+1],a[i]];drawLayouts();};
      window._saveLayout=async function(){showLoading('Saving…');try{await API.layout.update(layouts);showToast('Layout saved ✓');renderSuperAdminDashboard();}catch(e){showToast(e.message||'Failed');renderSuperAdminDashboard();}};
    }).catch(function(e){
      $('sa-body').innerHTML='<div class="card" style="text-align:center;padding:30px;color:var(--red)"><div style="font-size:14px;font-weight:700;margin-bottom:8px">Failed to load layouts</div><div style="font-size:12px;color:var(--gray)">'+esc(e.message||'Server error')+'</div></div>';
    });
  }
  window._saT=function(t){
    ['layout','biz'].forEach(x=>{const b=$('sa-'+x);if(b)b.className='tab'+(x===t?' active':'');});
    if(t==='layout')saLayout();else saBiz();
  };
  window._saT('layout');
}

async function saBiz() {
  var body = $('sa-body');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner" style="margin:0 auto"></div></div>';

  const PLATFORM_DEFAULTS = [
    { platform: 'google',      label: 'Google',      url: '' },
    { platform: 'yelp',        label: 'Yelp',        url: '' },
    { platform: 'tripadvisor', label: 'TripAdvisor', url: '' },
    { platform: 'opentable',   label: 'OpenTable',   url: '' },
    { platform: 'facebook',    label: 'Facebook',    url: '' },
    { platform: 'custom',      label: 'Custom',      url: '' },
  ];

  var allBiz = [];
  try {
    var saR = await fetch('/api/business?listAll=1', { headers: { 'Authorization': 'Bearer ' + API.auth.getToken() } });
    var saD = await saR.json();
    if (saD.businesses) allBiz = saD.businesses;
  } catch(e) {}

  function draw(businesses) {
    body.innerHTML = `
      <button class="btn btn-primary btn-full" style="margin-bottom:16px" onclick="window._saCreateBiz()">+ Create New Business</button>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input class="inp" id="sa-biz-search" placeholder="Search by slug…" style="flex:1" oninput="window._saSearch(this.value)"/>
      </div>
      <div id="sa-biz-list">
        ${businesses.length === 0
          ? '<div class="card" style="text-align:center;color:var(--gray);padding:30px">No businesses yet.</div>'
          : businesses.map(b => `
            <div class="plain-card">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700">${esc(b.name)}</div>
                  <div style="font-size:12px;color:var(--gray)">Code: <span style="color:var(--green);font-weight:700">${esc(b.storeCode)}</span> · ${esc(b.slug)}</div>
                </div>
                <div style="display:flex;gap:6px">
                  <button onclick="window._saManageLinks('${b.id}','${esc(b.name)}')" class="btn btn-ghost btn-sm">🔗 Links</button>
                  <button onclick="window._saViewBiz('${b.id}')" class="btn btn-ghost btn-sm">View</button>
                  <button onclick="window._saDeleteBiz('${b.id}','${esc(b.name)}')" class="btn btn-sm" style="background:rgba(255,68,85,.1);color:var(--red);border:1px solid rgba(255,68,85,.2)">Del</button>
                </div>
              </div>
            </div>`).join('')
        }
      </div>`;
  }

  draw(allBiz);

  // ── Manage platform links for a business ──────────────────────────────────
  window._saManageLinks = async function(bizId, bizName) {
    showLoading('Loading…');
    var bizData;
    try {
      var r = await API.business.getById(bizId);
      bizData = r.business;
    } catch(e) { showToast('Failed to load business'); renderSuperAdminDashboard(); return; }

    var platformLinks = bizData.platformLinks
      ? [...bizData.platformLinks]
      : PLATFORM_DEFAULTS.map(p => ({...p, enabled: false}));

    // Ensure all defaults are represented
    PLATFORM_DEFAULTS.forEach(def => {
      if (!platformLinks.find(p => p.platform === def.platform)) {
        platformLinks.push({...def, enabled: false});
      }
    });

    body.innerHTML = `
      <button onclick="window._saT('biz')" style="background:none;border:none;color:var(--gray);font-size:13px;cursor:pointer;font-family:'Nunito',sans-serif;margin-bottom:16px;padding:0">← Back to Businesses</button>
      <div style="font-weight:700;font-size:16px;margin-bottom:4px">🔗 Review Links</div>
      <div style="font-size:12px;color:var(--gray);margin-bottom:16px">${esc(bizName)}</div>
      <div id="sa-links-list"></div>
      <button onclick="window._saSaveLinks('${bizId}')" class="btn btn-primary btn-full" style="margin-top:8px">Save Platform Links</button>`;

    function drawLinks() {
      var ll = document.getElementById('sa-links-list');
      if (!ll) return;
      ll.innerHTML = platformLinks.map((p, i) => `
        <div style="background:rgba(255,255,255,.04);border:1px solid ${p.enabled?'rgba(0,229,160,.25)':'rgba(255,255,255,.07)'};border-radius:12px;padding:14px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:${p.enabled?'10px':'0'}">
            <div style="font-size:22px">${_platformIcon(p.platform)}</div>
            <div style="flex:1;font-weight:700;font-size:14px">${esc(p.label||p.platform)}</div>
            <div class="toggle${p.enabled?' on':''}" onclick="window._saTogPlat(${i})" style="flex-shrink:0"><div class="toggle-thumb"></div></div>
          </div>
          ${p.enabled ? `
            <div class="field-lbl">URL for ${esc(p.label||p.platform)}</div>
            <input class="inp" id="sa-pl-url-${i}" value="${esc(p.url||'')}" placeholder="https://…" style="font-size:13px"/>
            <div class="field-lbl" style="margin-top:8px">Display Label</div>
            <input class="inp" id="sa-pl-lbl-${i}" value="${esc(p.label||p.platform)}" placeholder="${esc(p.platform)}" style="font-size:13px"/>
          ` : ''}
        </div>`).join('');
    }

    drawLinks();

    window._saTogPlat = function(i) {
      // Save current field values before redrawing
      platformLinks.forEach((p, j) => {
        if (p.enabled) {
          const urlEl = document.getElementById('sa-pl-url-'+j);
          const lblEl = document.getElementById('sa-pl-lbl-'+j);
          if (urlEl) platformLinks[j].url   = urlEl.value.trim();
          if (lblEl) platformLinks[j].label = lblEl.value.trim() || platformLinks[j].platform;
        }
      });
      platformLinks[i].enabled = !platformLinks[i].enabled;
      drawLinks();
    };

    window._saSaveLinks = async function(bId) {
      // Collect current values
      platformLinks.forEach((p, j) => {
        if (p.enabled) {
          const urlEl = document.getElementById('sa-pl-url-'+j);
          const lblEl = document.getElementById('sa-pl-lbl-'+j);
          if (urlEl) platformLinks[j].url   = urlEl.value.trim();
          if (lblEl) platformLinks[j].label = lblEl.value.trim() || platformLinks[j].platform;
        }
      });
      // Validate enabled ones have URLs
      const missing = platformLinks.filter(p => p.enabled && !p.url);
      if (missing.length) { showToast('Add URLs for all enabled platforms'); return; }
      try {
        await API.business.update(bId, { platformLinks });
        showToast('Platform links saved ✓');
      } catch(e) { showToast(e.message || 'Save failed'); }
    };
  };

  window._saSearch = async function(q) {
    if (!q || q.length < 2) return;
    try {
      var d = await API.business.getBySlug(q.trim().toLowerCase());
      if (d.business) {
        window._saLastFound = d.business;
        var list = $('sa-biz-list');
        if (list) list.innerHTML = `
          <div class="plain-card">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700">${esc(d.business.name)}</div>
                <div style="font-size:12px;color:var(--gray)">Code: <span style="color:var(--green);font-weight:700">${esc(d.business.storeCode)}</span> · ${esc(d.business.slug)}</div>
              </div>
              <div style="display:flex;gap:6px">
                <button onclick="window._saManageLinks('${d.business.id}','${esc(d.business.name)}')" class="btn btn-ghost btn-sm">🔗 Links</button>
                <button onclick="window._saViewBiz('${d.business.id}')" class="btn btn-ghost btn-sm">View</button>
              </div>
            </div>
          </div>`;
      }
    } catch(e2) {}
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
    if (!confirm('Delete ' + name + '? This cannot be undone.')) return;
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
        <div><div class="field-lbl">Owner Email</div><input class="inp" id="sa-cb-email" type="email" placeholder="owner@business.com"/></div>
        <div><div class="field-lbl">Owner Password</div><input class="inp" id="sa-cb-pass" type="password" placeholder="Min 6 characters"/></div>
        <div><div class="field-lbl">Business Name</div><input class="inp" id="sa-cb-name" placeholder="The James Room"/></div>
        <div><div class="field-lbl">Admin PIN (4-6 digits)</div><input class="inp" id="sa-cb-admin" type="number" inputmode="numeric" placeholder="e.g. 1234"/></div>
        <div><div class="field-lbl">Manager PIN (4-6 digits)</div><input class="inp" id="sa-cb-mgr" type="number" inputmode="numeric" placeholder="e.g. 5678"/></div>
        <button class="btn btn-primary btn-full" onclick="window._saDoCreate()">Create Business</button>
      </div>`);
    window._saDoCreate = async function() {
      var email = $('sa-cb-email')?.value?.trim(), pass = $('sa-cb-pass')?.value;
      var name  = $('sa-cb-name')?.value?.trim();
      var adminPin = $('sa-cb-admin')?.value?.trim(), mgrPin = $('sa-cb-mgr')?.value?.trim();
      if (!email)   { showToast('Enter owner email'); return; }
      if (!pass || pass.length < 6) { showToast('Password must be 6+ characters'); return; }
      if (!name)    { showToast('Enter business name'); return; }
      if (!adminPin || adminPin.length < 4) { showToast('Admin PIN must be 4+ digits'); return; }
      if (!mgrPin   || mgrPin.length < 4)   { showToast('Manager PIN must be 4+ digits'); return; }
      if (adminPin === mgrPin) { showToast('PINs must be different'); return; }
      closeModal(); showLoading('Creating…');
      try {
        var cred    = await fbAuth.createUserWithEmailAndPassword(email, pass);
        var idToken = await cred.user.getIdToken();
        sessionStorage.setItem('tp_session', JSON.stringify({ token: idToken }));
        var d = await API.business.create({ name, adminPin, managerPin: mgrPin });
        sessionStorage.setItem('tp_session', JSON.stringify(State.session));
        showToast(name + ' created! Code: ' + d.business.storeCode, 4000);
        renderSuperAdminDashboard();
        setTimeout(() => window._saT('biz'), 500);
      } catch(e) {
        sessionStorage.setItem('tp_session', JSON.stringify(State.session));
        showToast(e.message || 'Failed');
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
  var staffRec=null;
  try{
    var staffResp=await fetch('/api/staff?bizId='+biz.id+'&public=1');
    if(staffResp.ok){var staffData=await staffResp.json();var allStaff=staffData.staff||[];staffRec=allStaff.find(function(s){var slug=(s.firstName+'-'+s.lastInitial).toLowerCase().replace(/[^a-z0-9-]/g,'');return slug===staffSlug||s.id===staffSlug;});}
  }catch(e2){}
  const ck='tp_'+biz.id+'_'+staffSlug,last=parseInt(sessionStorage.getItem(ck)||'0'),now=Date.now(),dup=now-last<1800000;
  let tapId=sessionStorage.getItem(ck+'_id')||null;
  if(!dup){sessionStorage.setItem(ck,String(now));API.taps.log({bizId:biz.id,bizSlug:biz.slug,staffId:staffSlug,staffName:staffSlug,status:'tapped'}).then(function(d){tapId=d.tap.id;sessionStorage.setItem(ck+'_id',tapId);}).catch(console.error);}
  const bulletinLinks=b.bulletinLinks||[],links=biz.links||[];
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
    const links=biz.reviewLinks||biz.links||[];
    if(r===5){
      const primary=links[0];
      const msg=esc(b.thankYouMsg||'Thank you! Redirecting you now\u2026');
      el.innerHTML=`<div style="text-align:center;padding:20px 0">
        <div style="font-size:40px;margin-bottom:12px">🙏</div>
        <div style="font-size:18px;font-weight:800;margin-bottom:8px">${msg}</div>
        ${primary?`<div style="font-size:13px;color:rgba(238,240,248,.4)">Taking you to ${esc(primary.label||primary.platform)}\u2026</div>`:''}
      </div>`;
      if(tapId)API.taps.update(tapId,{rating:r,status:'rated'}).catch(console.error);
      if(primary)setTimeout(()=>{window.location.href=primary.url;},1800);
    }else if(r===4){
      const pm=esc(b.reviewPrompt||'Share your experience!');
      const lh=links.length?links.map(l=>linkRow(l)).join(''):'<div style="padding:16px;text-align:center;color:rgba(238,240,248,.5);font-size:14px">No review links configured</div>';
      el.innerHTML='<div style="text-align:center;margin-bottom:20px"><div style="font-size:18px;font-weight:800;margin-bottom:8px">'+pm+'</div></div>'+lh;
      if(tapId)API.taps.update(tapId,{rating:r,status:'rated'}).catch(console.error);
    }else if(r<=3){
      el.innerHTML=`<div style="text-align:center;margin-bottom:16px"><div style="font-size:18px;font-weight:800;margin-bottom:6px">${esc(b.lowRatingMsg||"We're sorry to hear that.")}</div></div>
        <textarea id="fb-t" style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;color:inherit;font-size:14px;font-family:'Nunito',sans-serif;outline:none;resize:none;min-height:100px;margin-bottom:12px" placeholder="Tell us what happened\u2026"></textarea>
        <button onclick="window._fb(${r})" style="width:100%;background:${esc(b.brandColor||'#00e5a0')};color:#07080c;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif">Submit</button>`;
      window._fb=async function(rating){const text=$('fb-t')?.value?.trim()||'';if(tapId)await API.taps.update(tapId,{rating,feedback:text,status:'rated'}).catch(console.error);el.innerHTML=`<div style="text-align:center;padding:20px"><div style="font-size:40px;margin-bottom:12px">🙏</div><div style="font-size:18px;font-weight:800">${esc(b.thankYouMsg||'Thank you for your feedback!')}</div></div>`;};
    }
  }
  window._cs=function(r){updateStars(r);setTimeout(()=>afterRate(r),200);};
  window._toggleStaffCard=function(){var c=document.getElementById('staff-popup');if(c)c.style.display=c.style.display==='none'?'block':'none';};
  document.addEventListener('click',function(e){var popup=document.getElementById('staff-popup');var bubble=document.getElementById('staff-bubble');if(popup&&bubble&&!bubble.contains(e.target)&&!popup.contains(e.target))popup.style.display='none';});
  var staffBubbleHTML=staffRec?(
    '<div id="staff-bubble" onclick="window._toggleStaffCard()" style="position:absolute;top:16px;right:16px;cursor:pointer;z-index:10">'
    +(staffRec.photo?'<img src="'+esc(staffRec.photo)+'" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid '+(b.brandColor||'#00e5a0')+';display:block"/>':'<div style="width:48px;height:48px;border-radius:50%;background:'+(b.brandColor||'#00e5a0')+'22;border:2px solid '+(b.brandColor||'#00e5a0')+';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:'+(b.brandColor||'#00e5a0')+'">'+(staffRec.firstName[0]+(staffRec.lastInitial||'')[0]).toUpperCase()+'</div>')
    +'</div>'
    +'<div id="staff-popup" style="display:none;position:absolute;top:72px;right:16px;background:#0e0f15;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:16px 18px;min-width:160px;max-width:240px;z-index:20;box-shadow:0 8px 32px rgba(0,0,0,.5)">'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
    +(staffRec.photo?'<img src="'+esc(staffRec.photo)+'" style="width:36px;height:36px;border-radius:50%;object-fit:cover"/>':'<div style="width:36px;height:36px;border-radius:50%;background:'+(b.brandColor||'#00e5a0')+'22;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:'+(b.brandColor||'#00e5a0')+'">'+(staffRec.firstName[0]+(staffRec.lastInitial||'')[0]).toUpperCase()+'</div>')
    +'<div><div style="font-weight:800;font-size:14px">'+esc(staffRec.firstName+' '+staffRec.lastInitial+'.')+'</div>'
    +(staffRec.title?'<div style="font-size:11px;color:'+(b.brandColor||'#00e5a0')+';font-weight:600;margin-top:2px">'+esc(staffRec.title)+'</div>':'')
    +'</div></div>'
    +(staffRec.links||[]).filter(function(l){return(b.allowedStaffLinks||{})[l.type];}).map(function(l){var icons={spotify:'🎵',phone:'📞',email:'✉️',instagram:'📸',tiktok:'🎵',custom:'🔗'};var href=l.type==='phone'?'tel:'+l.url:l.type==='email'?'mailto:'+l.url:l.url;return'<a href="'+esc(href)+'" target="_blank" rel="noreferrer" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,.06);text-decoration:none"><span style="font-size:16px">'+(icons[l.type]||'🔗')+'</span><span style="font-size:12px;font-weight:600;color:'+(b.textColor||'#fff')+'">'+esc(l.label||l.type)+'</span></a>';}).join('')
    +'</div>'
  ):'';
  app().innerHTML=`
    <style>body{background:${esc(b.bgColor||'#07080c')};color:${esc(b.textColor||'#fff')}}.star{cursor:pointer;font-size:42px;transition:transform .15s;filter:grayscale(1);opacity:.3}.star.lit{filter:none;opacity:1}.star:active{transform:scale(1.25)}</style>
    <div class="tap-page" style="position:relative">
      ${staffBubbleHTML}
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