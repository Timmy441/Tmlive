// Minimal admin UI JS with separate deploy support
let apiBase = localStorage.getItem('tm_admin_api_base') || '';
function el(id){return document.getElementById(id)}
let adminToken = localStorage.getItem('tm_admin_token') || '';
let adminSocket = null;
let adminEventCount = 0;
let usersPage = 1;
let usersLimit = 20;
let usersTotal = 0;
let currentUserQuery = '';
let auditPage = 1;
let auditLimit = 20;
let auditTotal = 0;

function setStatus(msg, color){
  el('adminStatus').textContent = msg;
  el('adminStatus').style.color = color || '#9fb1ff';
}

function normalizeApiBase(url){
  return url.trim().replace(/\/+$/,'');
}

function setApiBase(url){
  apiBase = normalizeApiBase(url);
  localStorage.setItem('tm_admin_api_base', apiBase);
  if (el('adminApiUrl')) el('adminApiUrl').value = apiBase;
  setStatus(apiBase ? `Backend API set: ${apiBase}` : 'Backend API cleared', '#9fb1ff');
}

function fullUrl(path){
  if (!apiBase) return path;
  return apiBase + path;
}

function getSocketUrl(){
  if (!apiBase) return '/admin';
  return apiBase + '/admin';
}

function logoutAdmin(){
  localStorage.removeItem('tm_admin_token');
  adminToken = '';
  if(adminSocket){
    adminSocket.disconnect();
    adminSocket = null;
  }
  document.getElementById('loginPanel').style.display='block';
  document.getElementById('adminMain').style.display='none';
  document.getElementById('logoutBtn').style.display='none';
  setStatus('Logged out', '#9fb1ff');
}

function handleAuthError(message){
  logoutAdmin();
  setStatus(message || 'Authentication failed', '#f5a6a6');
  throw new Error(message || 'Authentication failed');
}

function saveToken(token){
  adminToken = token;
  localStorage.setItem('tm_admin_token', token);
  setStatus('Authenticated', '#7ef5a4');
  document.getElementById('loginPanel').style.display='none';
  document.getElementById('adminMain').style.display='block';
  document.getElementById('logoutBtn').style.display='inline-flex';
  loadUsers('', 1);
  connectAdminSocket();
}

async function loginAdmin(){
  const email = el('adminEmail').value.trim();
  const password = el('adminPassword').value;
  const apiUrl = el('adminApiUrl').value.trim();
  if(apiUrl) setApiBase(apiUrl);
  if(!email || !password) return alert('Email and password required');
  try{
    const res = await fetch(fullUrl('/api/auth/login'),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email,password})
    });
    const data = await res.json();
    if(res.ok && data.token){ saveToken(data.token); } else { alert(data.message || 'Login failed'); }
  }catch(e){ alert('Network error'); }
}

function useTokenFromInput(){
  const t = el('adminTokenInput').value.trim();
  if(!t) return alert('Enter token');
  saveToken(t.startsWith('Bearer ')? t.split(' ')[1] : t);
}

async function api(path, opts={}){
  opts.headers = opts.headers || {};
  if(adminToken) opts.headers['Authorization'] = `Bearer ${adminToken}`;
  const res = await fetch(fullUrl(path), opts);
  const data = await res.json().catch(()=>({}));
  if(!res.ok){
    if(res.status === 401 || res.status === 403){
      handleAuthError(data.message || 'Admin authorization required');
    }
    throw new Error(data.message || 'API error');
  }
  return data;
}

async function loadUsers(q='', page=1){
  try{
    currentUserQuery = q;
    usersPage = page;
    el('usersList').innerHTML = 'Loading...';
    const url = `/api/admin/users?limit=${usersLimit}&page=${usersPage}${q? '&q='+encodeURIComponent(q):''}`;
    const data = await api(url);
    usersTotal = data.total || 0;
    renderUsers(data.users || []);
    renderUserPagination();
    updateKnownUsers(usersTotal);
  }catch(err){ el('usersList').innerHTML = 'Error: '+err.message }
}

function renderUsers(users){
  if(!users || users.length===0) {
    el('usersList').innerHTML = '<div style="color:#9fb1ff">No users found</div>';
    renderUserDetail(null);
    return;
  }
  const rows = users.map(u=>{
    return `
      <div style="padding:10px;border:1px solid rgba(255,255,255,0.04);margin-bottom:8px;border-radius:8px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700">${escapeHtml(u.username)} <small style="color:#9fb1ff">${u.email||''}</small></div>
          <div style="color:#9fb1ff">Followers: ${u.followers?.length||0} • Following: ${u.following?.length||0}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button data-id="${u._id}" data-banned="${u.banned||false}" class="banBtn" style="background:${u.banned? '#ff6b6b':'#667eea'};color:white;padding:8px;border-radius:6px;border:none;cursor:pointer">${u.banned? 'Unban':'Ban'}</button>
          <button data-id="${u._id}" data-admin="${u.isAdmin||false}" class="adminBtn" style="background:${u.isAdmin? '#e53e3e':'#0ea5a4'};color:white;padding:8px;border-radius:6px;border:none;cursor:pointer">${u.isAdmin? 'Revoke Admin' : 'Make Admin'}</button>
          <button data-id="${u._id}" class="viewBtn" style="background:#1f2937;color:white;padding:8px;border-radius:6px;border:none;cursor:pointer">View</button>
        </div>
      </div>
    `;
  }).join('');
  el('usersList').innerHTML = rows;
  document.querySelectorAll('.banBtn').forEach(b=>b.addEventListener('click', onBanToggle));
  document.querySelectorAll('.adminBtn').forEach(b=>b.addEventListener('click', onAdminToggle));
  document.querySelectorAll('.viewBtn').forEach(b=>b.addEventListener('click', onViewUser));
}

function renderUserPagination() {
  const label = el('usersPageLabel');
  if (label) {
    const totalPages = Math.max(1, Math.ceil(usersTotal / usersLimit));
    label.textContent = `Page ${usersPage} of ${totalPages} • ${usersTotal} users`;
  }
  const prev = el('prevUsersPage');
  const next = el('nextUsersPage');
  if (prev) prev.disabled = usersPage <= 1;
  if (next) next.disabled = usersPage >= Math.ceil(usersTotal / usersLimit);
}

function updateKnownUsers(count) {
  const elCount = el('totalUsersCount');
  if (elCount) elCount.textContent = String(count || 0);
}

function renderUserDetail(user) {
  const panel = el('userDetailPanel');
  if (!panel) return;
  if (!user) {
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }
  panel.style.display = 'block';
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
      <div>
        <h3 style="margin:0 0 6px 0">${escapeHtml(user.username)}</h3>
        <div style="color:#9fb1ff;margin-bottom:6px">${escapeHtml(user.email || 'No email')}</div>
        <div style="color:#cfe0ff;font-size:14px;line-height:1.6">
          <div>Bio: ${escapeHtml(user.bio || 'No bio set')}</div>
          <div>Diamonds: ${user.diamonds ?? 0}</div>
          <div>Total earned: ${user.totalEarned ?? 0}</div>
          <div>Followers: ${user.followers?.length || 0} • Following: ${user.following?.length || 0}</div>
          <div>Status: ${user.banned ? 'Banned' : 'Active'}${user.isAdmin ? ' • Admin' : ''}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="tabBtn" data-detail-action="ban" data-id="${user._id}" data-banned="${user.banned||false}">${user.banned ? 'Unban' : 'Ban'}</button>
        <button class="tabBtn" data-detail-action="admin" data-id="${user._id}" data-admin="${user.isAdmin||false}">${user.isAdmin ? 'Revoke Admin' : 'Make Admin'}</button>
      </div>
    </div>
  `;
  panel.querySelectorAll('[data-detail-action="ban"]').forEach(btn => btn.addEventListener('click', onBanToggle));
  panel.querySelectorAll('[data-detail-action="admin"]').forEach(btn => btn.addEventListener('click', onAdminToggle));
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

async function onBanToggle(e){
  const id = e.target.dataset.id; const cur = e.target.dataset.banned === 'true';
  try{
    const data = await api(`/api/admin/user/${id}/ban`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ banned: !cur }) });
    alert('Updated'); loadUsers(currentUserQuery, usersPage);
  }catch(err){ alert(err.message) }
}

async function onAdminToggle(e){
  const id = e.target.dataset.id; const cur = e.target.dataset.admin === 'true';
  try{
    const data = await api(`/api/admin/user/${id}/make-admin`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ isAdmin: !cur }) });
    alert('Updated'); loadUsers(currentUserQuery, usersPage);
  }catch(err){ alert(err.message) }
}

async function onViewUser(e){
  const id = e.target.dataset.id;
  try{
    const u = await api(`/api/admin/user/${id}`);
    renderUserDetail(u);
  }catch(err){ alert(err.message) }
}

function connectAdminSocket(){
  if(!adminToken) return;
  if(window.io == null){ console.warn('Socket.io client unavailable'); return; }
  if(adminSocket && adminSocket.connected) return;
  const socketUrl = getSocketUrl();
  adminSocket = io(socketUrl, {
    auth: { token: adminToken }
  });

  adminSocket.on('connect', () => {
    setStatus('Admin connected', '#7ef5a4');
  });

  adminSocket.on('connect_error', (err) => {
    setStatus(`Socket auth failed: ${err.message}`, '#f5a6a6');
  });

  adminSocket.on('admin_init', (stats) => {
    updateLiveStats(stats.activeUsers);
    updateStreamStats(stats.liveStreams);
    updateKnownUsers(stats.activeUsers);
    appendAdminEvent('Admin socket connected. Live dashboard ready.');
  });

  adminSocket.on('admin_user_count', (data) => {
    updateLiveStats(data.count);
    appendAdminEvent(`Active users: ${data.count}`);
  });

  adminSocket.on('admin_streams', (data) => {
    updateStreamStats(data.streams);
  });

  adminSocket.on('admin_event', (event) => {
    appendAdminEvent(`${event.time} — ${event.event}: ${JSON.stringify(event.payload)}`);
  });
}

function updateLiveStats(count){
  el('liveUserCount').textContent = count;
}

function updateStreamStats(streams){
  el('liveStreamsCount').textContent = streams?.length || 0;
}

function appendAdminEvent(text){
  adminEventCount += 1;
  el('adminEventSummary').textContent = `${adminEventCount} events`;
  const feed = el('liveEventFeed');
  const entry = document.createElement('div');
  entry.style.padding = '8px';
  entry.style.marginBottom = '6px';
  entry.style.background = 'rgba(255,255,255,0.04)';
  entry.textContent = text;
  feed.prepend(entry);
  while(feed.childElementCount > 30) feed.removeChild(feed.lastChild);
}

// Audit
async function loadAudit(){
  try{
    auditPage = auditPage || 1;
    el('auditList').innerHTML = 'Loading...';
    const data = await api(`/api/admin/audit?limit=${auditLimit}&page=${auditPage}`);
    auditTotal = data.total || 0;
    renderAuditPagination();
    if(!data.logs || data.logs.length===0) return el('auditList').innerHTML = '<div style="color:#9fb1ff">No logs</div>';
    el('auditList').innerHTML = data.logs.map(l=>`<div style="padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.04);margin-bottom:6px"><div style="font-weight:700">${escapeHtml(l.type)} — ${escapeHtml(l.actor)} → ${escapeHtml(l.target)}</div><div style="color:#9fb1ff">${new Date(l.createdAt).toLocaleString()}</div><pre style="white-space:pre-wrap;color:#cfe0ff;background:transparent;border:none;padding:6px">${escapeHtml(JSON.stringify(l.meta||{},null,2))}</pre></div>`).join('');
  }catch(err){ el('auditList').innerHTML = 'Error: '+err.message }
}

function renderAuditPagination() {
  const label = el('auditPageLabel');
  if (label) {
    const totalPages = Math.max(1, Math.ceil(auditTotal / auditLimit));
    label.textContent = `Page ${auditPage} of ${totalPages} • ${auditTotal} logs`;
  }
  const prev = el('prevAuditPage');
  const next = el('nextAuditPage');
  if (prev) prev.disabled = auditPage <= 1;
  if (next) next.disabled = auditPage >= Math.ceil(auditTotal / auditLimit);
}

// Tabs
el('usersTab').addEventListener('click', ()=>{ el('usersView').style.display='block'; el('auditView').style.display='none'; el('usersTab').classList.add('active'); el('auditTab').classList.remove('active'); });
el('auditTab').addEventListener('click', ()=>{ el('usersView').style.display='none'; el('auditView').style.display='block'; el('auditTab').classList.add('active'); el('usersTab').classList.remove('active'); loadAudit(); });

el('loginBtn').addEventListener('click', loginAdmin);
el('useTokenBtn').addEventListener('click', useTokenFromInput);
el('saveApiUrlBtn').addEventListener('click', ()=> {
  const url = el('adminApiUrl').value.trim();
  if(!url) return alert('Enter backend API URL');
  setApiBase(url);
});
el('logoutBtn').addEventListener('click', logoutAdmin);
el('searchBtn').addEventListener('click', ()=> loadUsers(el('userSearch').value.trim(), 1));
el('refreshUsers').addEventListener('click', ()=> loadUsers(currentUserQuery, 1));
el('refreshAudit').addEventListener('click', ()=> loadAudit());
el('prevUsersPage').addEventListener('click', ()=> { if (usersPage > 1) loadUsers(currentUserQuery, usersPage - 1); });
el('nextUsersPage').addEventListener('click', ()=> { if (usersPage * usersLimit < usersTotal) loadUsers(currentUserQuery, usersPage + 1); });
el('prevAuditPage').addEventListener('click', ()=> { if (auditPage > 1) { auditPage -= 1; loadAudit(); } });
el('nextAuditPage').addEventListener('click', ()=> { if (auditPage * auditLimit < auditTotal) { auditPage += 1; loadAudit(); } });

if (el('adminApiUrl')) el('adminApiUrl').value = apiBase;

// Auto restore token
if(adminToken){ setStatus('Restoring token...'); saveToken(adminToken); } else { setStatus('Not authenticated', '#f5d6d6') }
