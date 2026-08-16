'use strict';

const $ = (id) => document.getElementById(id);
const state = { api: sessionStorage.getItem('lymixApi') || '', access: '', refresh: sessionStorage.getItem('lymixRefresh') || '', selectedUser: null };

function base() { return state.api.replace(/\/$/, ''); }
function setText(el, value) { el.textContent = value == null ? '' : String(value); }
function formatDate(v) { return v ? new Date(v).toLocaleString('tr-TR') : '-'; }
function badge(text, kind='') { const s=document.createElement('span'); s.className=`badge ${kind}`; setText(s,text); return s; }

async function refreshAccess() {
  if (!state.refresh) throw new Error('Oturum yok');
  const r = await fetch(`${base()}/api/v1/auth/refresh`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({refreshToken:state.refresh}) });
  if (!r.ok) throw new Error('Oturum yenilenemedi');
  const data = await r.json();
  state.access = data.accessToken;
  state.refresh = data.refreshToken;
  sessionStorage.setItem('lymixRefresh', state.refresh);
}

async function api(path, options={}, retry=true) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept','application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
  if (state.access) headers.set('Authorization',`Bearer ${state.access}`);
  const r = await fetch(`${base()}${path}`, {...options, headers});
  if (r.status === 401 && retry && state.refresh) { await refreshAccess(); return api(path, options, false); }
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.message || data.code || `HTTP ${r.status}`);
  return data;
}

async function login() {
  $('loginError').textContent='';
  state.api=$('apiBase').value.trim();
  try {
    const data=await fetch(`${base()}/api/v1/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:$('login').value.trim(),password:$('password').value,deviceKey:$('deviceKey').value.trim(),platform:'web-admin',deviceName:navigator.platform,appVersion:'admin-web-1'})}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message||d.code||'Giriş başarısız');return d;});
    if (data.user?.role!=='SUPER_ADMIN') throw new Error('Baş Admin yetkisi gerekli');
    state.access=data.accessToken; state.refresh=data.refreshToken;
    sessionStorage.setItem('lymixApi',state.api); sessionStorage.setItem('lymixRefresh',state.refresh);
    showApp();
  } catch(e){$('loginError').textContent=e.message;}
}

function logout(){state.access='';state.refresh='';sessionStorage.removeItem('lymixRefresh');$('appView').classList.add('hidden');$('loginView').classList.remove('hidden');}
function showApp(){$('loginView').classList.add('hidden');$('appView').classList.remove('hidden');loadOverview().catch(showStatus);}
function showStatus(e){$('statusLine').textContent=e?.message||String(e);}

function metric(label,value){const d=document.createElement('div');d.className='metric';const a=document.createElement('span');setText(a,label);const b=document.createElement('strong');setText(b,value);d.append(a,b);return d;}
async function loadOverview(){const [m,h]=await Promise.all([api('/api/v1/admin/metrics'),api('/health')]);$('metrics').replaceChildren(metric('Toplam kullanıcı',m.users),metric('Aktif kullanıcı',m.activeUsers),metric('Aktif oturum',m.activeSessions),metric('Banlı kullanıcı',m.bannedUsers),metric('Aktif oyun oturumu',m.activeGameSessions),metric('Ledger işlemi',m.ledgerPosted));$('healthBox').textContent=JSON.stringify(h,null,2);$('statusLine').textContent=`Son güncelleme ${formatDate(m.at)}`;}

async function loadUsers(){const q=encodeURIComponent($('userSearch').value.trim());const rows=await api(`/api/v1/admin/users?take=100&q=${q}`);const body=$('usersBody');body.replaceChildren();for(const u of rows){const tr=document.createElement('tr');const who=document.createElement('td');const strong=document.createElement('strong');setText(strong,u.profile?.displayName||u.username||u.id);const sub=document.createElement('div');sub.className='sub';setText(sub,`${u.username||'-'} · ${u.phoneE164}`);who.append(strong,sub);const role=document.createElement('td');role.append(badge(u.role));const status=document.createElement('td');status.append(badge(u.status,u.status==='ACTIVE'?'good':u.status==='BANNED'?'bad':'warn'));const coin=document.createElement('td');setText(coin,u.wallet?.balance||'0');const last=document.createElement('td');setText(last,formatDate(u.lastLoginAt));const action=document.createElement('td');const btn=document.createElement('button');btn.className='ghost small';btn.textContent='Yönet';btn.onclick=()=>openUser(u);action.append(btn);tr.append(who,role,status,coin,last,action);body.append(tr);}}
function openUser(u){state.selectedUser=u;$('selectedUser').textContent=`${u.profile?.displayName||u.username} (${u.id})`;$('userStatus').value=u.status;$('userRole').value=u.role;$('coinAmount').value='';$('adminReason').value='';$('dialogError').textContent='';$('userDialog').showModal();}
async function saveUser(){const u=state.selectedUser;if(!u)return;$('dialogError').textContent='';try{if($('userStatus').value!==u.status)await api(`/api/v1/admin/users/${encodeURIComponent(u.id)}/status`,{method:'PATCH',body:JSON.stringify({status:$('userStatus').value,reason:$('adminReason').value})});if($('userRole').value!==u.role)await api(`/api/v1/admin/users/${encodeURIComponent(u.id)}/role`,{method:'PATCH',body:JSON.stringify({role:$('userRole').value})});const amount=$('coinAmount').value;if(amount){await api('/api/v1/admin/wallet/adjust',{method:'POST',body:JSON.stringify({userId:u.id,idempotencyKey:`admin_${crypto.randomUUID()}`,direction:$('coinDirection').value,amount,reason:$('adminReason').value})});}$('userDialog').close();await loadUsers();}catch(e){$('dialogError').textContent=e.message;}}

async function loadOrders(){const status=encodeURIComponent($('orderStatus').value);const rows=await api(`/api/v1/admin/sud/orders?take=100&status=${status}`);const body=$('ordersBody');body.replaceChildren();for(const o of rows){const tr=document.createElement('tr');for(const value of [o.outOrderId,o.sudOrderId||'-',o.mgId,o.roomId,String(o.value)]){const td=document.createElement('td');setText(td,value);tr.append(td);}const st=document.createElement('td');st.append(badge(o.status,o.status==='EXECUTE_SUCCESS'?'good':o.status==='EXECUTE_FAIL'?'bad':'warn'));tr.append(st);const action=document.createElement('td');const btn=document.createElement('button');btn.className='ghost small';btn.textContent='Uzlaştır';btn.onclick=async()=>{try{await api(`/api/v1/admin/sud/orders/${encodeURIComponent(o.id)}/reconcile`,{method:'POST'});await loadOrders();}catch(e){showStatus(e);}};action.append(btn);tr.append(action);body.append(tr);}}
async function reconcileAll(){try{const result=await api('/api/v1/admin/sud/orders/reconcile-pending',{method:'POST',body:JSON.stringify({limit:100})});$('statusLine').textContent=`Order kontrol: ${result.checked}, güncel: ${result.updated}, hata: ${result.errors?.length||0}`;await loadOrders();}catch(e){showStatus(e);}}

async function loadAudit(){const rows=await api('/api/v1/admin/audit?take=200');const body=$('auditBody');body.replaceChildren();for(const a of rows){const tr=document.createElement('tr');for(const value of [formatDate(a.createdAt),a.action,a.actorId||'-',a.target||'-',JSON.stringify(a.metadata||{})]){const td=document.createElement('td');setText(td,value);tr.append(td);}body.append(tr);}}

const tabs={overview:loadOverview,users:loadUsers,orders:loadOrders,audit:loadAudit};
function switchTab(name){document.querySelectorAll('.tab').forEach(x=>x.classList.add('hidden'));$(`${name}Tab`).classList.remove('hidden');document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));$('pageTitle').textContent={overview:'Genel Bakış',users:'Kullanıcılar',orders:'SUD Orders',audit:'Audit Log'}[name];tabs[name]().catch(showStatus);}

$('apiBase').value=state.api;$('deviceKey').value=localStorage.getItem('lymixAdminDevice')||crypto.randomUUID();localStorage.setItem('lymixAdminDevice',$('deviceKey').value);
$('loginButton').onclick=login;$('logoutButton').onclick=logout;$('refreshButton').onclick=()=>{const active=document.querySelector('.nav.active')?.dataset.tab||'overview';switchTab(active);};$('userSearchButton').onclick=()=>loadUsers().catch(showStatus);$('userSearch').onkeydown=e=>{if(e.key==='Enter')loadUsers().catch(showStatus);};$('saveUserButton').onclick=saveUser;$('reconcileAllButton').onclick=reconcileAll;$('orderStatus').onchange=()=>loadOrders().catch(showStatus);document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
if(state.api&&state.refresh){refreshAccess().then(showApp).catch(logout);}
