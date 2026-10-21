// Tessera cloud: accounts, cloud save and view-only share links (Supabase). Does nothing until cloud-config.js is filled in.
(() => {
'use strict';
const C = window.TESSERA_CLOUD;
if (!C || !C.url || !C.anonKey || /YOUR-/.test(C.url) || window.__SHARE || /^#(view|s)=/.test(location.hash)) return;
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
const confirmedNow = /type=(signup|email)/.test(location.hash);
let sb, T, user = null, profile = null, status = '', pulling = false, busy = false, pushT = 0, shares = [];
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem('tessera-cloud-' + k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('tessera-cloud-' + k, JSON.stringify(v)); } catch {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const toDataURL = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
const linkOf = t => location.href.split(/[#?]/)[0] + '#s=' + t;

const root = document.documentElement;
let gate = null;
const unlock = () => { gate?.remove(); gate = null; root.classList.remove('cl-pending'); };
function card(inner) {
  if (!gate) { gate = document.createElement('div'); gate.id = 'clGate'; document.body.appendChild(gate); }
  root.classList.add('cl-pending'); delete gate.dataset.loading;
  gate.innerHTML = '<div class="cl-card"><img class="cl-logo" src="icon-192.png" alt="">' + inner + '</div>'; return gate;
}
(() => { const st = document.createElement('style');
  st.textContent = `#clGate{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:20px;background:var(--bg);color:var(--text);overflow:auto;font-family:inherit}
.cl-card{width:100%;max-width:380px;display:grid;gap:12px;text-align:center}.cl-card h1{margin:0;font-size:26px}.cl-card p{margin:0}
.cl-logo{width:64px;height:64px;margin:0 auto;border-radius:16px}.cl-card .btn{height:42px;justify-content:center}`;
  document.head.appendChild(st); card('<p class="cl-muted">Loading…</p>').dataset.loading = 1; })();

(async () => {
  try {
    for (let i = 0; !window.__tessera && i < 150; i++) await sleep(100);
    T = window.__tessera; if (!T) throw 0;
    await new Promise((ok, no) => { const s = document.createElement('script'); s.src = LIB; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  } catch {   // offline or blocked: let returning users in, otherwise ask them to reconnect
    let had = false; try { had = Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k)); } catch {}
    if (had) return unlock();
    card('<h1>Can’t connect</h1><p class="cl-muted">Check your internet connection and try again.</p><button class="btn primary" id="clRetry">Retry</button>').querySelector('#clRetry').onclick = () => location.reload();
    return;
  }
  sb = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  addButton();
  sb.auth.onAuthStateChange((ev, ses) => setTimeout(() => onSession(ses), 0));
  window.__tessOnSave = schedulePush;
  document.addEventListener('visibilitychange', () => { if (document.hidden && pushT) { clearTimeout(pushT); pushT = 0; push(); } });
})();

/* ---------- session ---------- */
async function onSession(ses) {
  const u = ses?.user || null;
  if (!u) { user = null; profile = null; shares = []; status = ''; paint(); if (!gate || gate.dataset.loading) showGate('in'); return; }
  unlock();
  if (u.id === user?.id) return paint();
  user = u; profile = null; shares = [];
  const { data } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle(); profile = data;
  if (confirmedNow) T.toast('Email confirmed. Welcome!');
  await firstSync();
}
async function firstSync() {
  setStatus('Syncing…');
  const { data: r, error } = await sb.from('workspaces').select('updated_at').eq('owner', user.id).maybeSingle();
  const pristine = !T.S().meta.welcomed;   // brand-new device: nothing of theirs here yet
  if (error) { setStatus('Offline'); if (pristine) T.welcome(); return; }
  if (!r) { await push(true); if (pristine) T.welcome(); return; }
  if (r.updated_at === ls('last:' + user.id, null)) { setStatus('Saved'); return schedulePush(); }
  if (pristine) return pull();
  const useCloud = await T.modal({ title: 'Use your cloud boards?', eyebrow: 'Signed in',
    html: '<p>Your account already has saved boards. Load them here, or replace them with what’s on this device?</p><p>Export a backup first if you want to keep both.</p>',
    actions: [{ label: 'Keep this device', value: false }, { label: 'Load cloud copy', kind: 'primary', primary: true, value: true }] });
  if (useCloud === true) await pull(); else if (useCloud === false) await push(true); else setStatus('Not synced');
}

/* ---------- save / load ---------- */
function schedulePush() { if (!user || pulling) return; setStatus('Unsaved changes'); clearTimeout(pushT); pushT = setTimeout(() => { pushT = 0; push(); }, 15000); }
async function push(force = false) {
  if (!user || pulling || busy) return; busy = true; setStatus('Saving…');
  try {
    const bk = await T.buildBackup(), have = new Set(ls('imgs:' + user.id, []));
    for (const [id, url] of Object.entries(bk.images)) {
      if (have.has(id)) continue;
      const { error } = await sb.storage.from('assets').upload(`${user.id}/${id}`, await (await fetch(url)).blob(), { upsert: true });
      if (error) throw error; have.add(id);
    }
    lsSet('imgs:' + user.id, [...have]);
    const row = { owner: user.id, state: bk.state, device: bk.device }, last = ls('last:' + user.id, null);
    const q = force ? sb.from('workspaces').upsert(row)
      : last ? sb.from('workspaces').update(row).eq('owner', user.id).eq('updated_at', last) : sb.from('workspaces').insert(row);
    const { data, error } = await q.select('updated_at');
    if (error && error.code === '23505') return conflict();
    if (error) throw error;
    if (!data?.length) return conflict();
    lsSet('last:' + user.id, data[0].updated_at); setStatus('Saved'); refreshShares();
  } catch (e) { console.warn('Tessera cloud save failed', e); setStatus('Couldn’t save'); }
  finally { busy = false; }
}
async function conflict() {
  busy = false;
  const useCloud = await T.modal({ title: 'Changed on another device', html: '<p>Your cloud boards were saved somewhere else since this device last synced.</p>',
    actions: [{ label: 'Overwrite cloud', value: false }, { label: 'Load cloud copy', kind: 'primary', primary: true, value: true }] });
  if (useCloud === true) await pull(); else if (useCloud === false) await push(true); else setStatus('Not synced');
}
async function pull() {
  pulling = true; setStatus('Loading…');
  try {
    const { data, error } = await sb.from('workspaces').select('state,updated_at').eq('owner', user.id).single(); if (error) throw error;
    const have = new Set(ls('imgs:' + user.id, []));
    for (const id of T.stateIds(data.state)) {
      if (await T.getImg(id)) continue;
      const { data: blob, error: e } = await sb.storage.from('assets').download(`${user.id}/${id}`);
      if (!e) { await T.putImg(id, await toDataURL(blob)); have.add(id); }
    }
    lsSet('imgs:' + user.id, [...have]);
    await T.adopt(data.state); lsSet('last:' + user.id, data.updated_at); setStatus('Saved'); T.toast('Loaded your boards from the cloud');
  } catch (e) { console.warn(e); setStatus('Couldn’t load'); T.toast('Couldn’t load from the cloud'); }
  finally { pulling = false; }
}

/* ---------- view-only share links ---------- */
async function loadShares() {
  const { data } = await sb.from('shares').select('token,board_id,title,updated_at').eq('owner', user.id).order('updated_at', { ascending: false });
  return (shares = data || []);
}
async function publish(bid) {
  const { boards } = T.bundle(bid), ids = T.idsOf(boards), title = T.S().boards[bid].title;
  const payload = { app: 'tessera', kind: 'share', v: 1, root: bid, title, boards };
  const { data, error } = await sb.from('shares').upsert({ owner: user.id, board_id: bid, title, data: payload, image_ids: ids }, { onConflict: 'owner,board_id' }).select('token').single();
  if (error) throw error;
  const have = new Set(ls('simgs:' + data.token, []));
  for (const id of ids) {
    if (have.has(id)) continue;
    const u = await T.getImg(id); if (!u) continue;
    const { error: e } = await sb.storage.from('shared').upload(`${user.id}/${data.token}/${id}`, await (await fetch(u)).blob(), { upsert: true });
    if (!e) have.add(id);
  }
  lsSet('simgs:' + data.token, [...have]);
  return data.token;
}
async function refreshShares() {
  try { for (const s of await loadShares()) { const b = T.S().boards[s.board_id]; if (b && (b.editedAt || 0) > new Date(s.updated_at).getTime()) await publish(s.board_id); } } catch {}
}

/* ---------- UI ---------- */
function setStatus(s) { status = s; paint(); }
function paint() { const b = document.getElementById('clBtn'); if (b) b.innerHTML = user ? `<i class="cl-dot"></i>${T.esc(profile?.username || 'Account')}<small>${T.esc(status)}</small>` : 'Sign in'; }
function addButton() {
  const st = document.createElement('style');
  st.textContent = `#clDock{position:fixed;left:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:60;display:flex;gap:8px}#clBtn,#clProj{height:34px;padding:0 14px;border-radius:12px;display:flex;align-items:center;gap:8px;font:600 12.5px/1 inherit;color:var(--text);border:1px solid var(--line-2);cursor:pointer}
#clBtn small{font-weight:500;color:var(--text-3)}.cl-dot{width:8px;height:8px;border-radius:50%;background:var(--accent)}
.cl-f{display:grid;gap:10px;margin-top:6px}.cl-f input{height:40px;padding:0 12px;border-radius:10px;border:1px solid var(--line-2);background:var(--surface-2);color:var(--text);font:inherit;width:100%;box-sizing:border-box}
.cl-err{color:#d6455d;font-size:13px;min-height:18px;margin:6px 0 0}.cl-muted,.cl-sw{color:var(--text-3);font-size:13px}.cl-sw{background:none;border:0;cursor:pointer;color:var(--accent);padding:0;font:inherit;margin-top:8px}
.cl-row{display:flex;gap:6px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}.cl-row>div{flex:1;min-width:0}.cl-row small{display:block;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cl-sub{margin:16px 0 4px;font-size:13px;font-weight:600;color:var(--text-2)}.cl-acts{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 4px}
.cl-proj{display:block;width:100%;text-align:left;padding:10px 12px;margin-top:6px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);font:inherit;cursor:pointer}
.cl-proj:hover{border-color:var(--accent)}.cl-proj small{display:block;color:var(--text-3);margin-top:2px}.cl-list{max-height:45vh;overflow:auto}`;
  document.head.appendChild(st);
  const d = document.createElement('div'); d.id = 'clDock';
  d.innerHTML = '<button id="clBtn" class="glass"></button><button id="clProj" class="glass">Projects</button>';
  document.body.appendChild(d); d.querySelector('#clBtn').onclick = openPanel; d.querySelector('#clProj').onclick = openProjects; paint();
}
function showGate(mode = 'in') {
  const up = mode === 'up', f = (n, t, p) => `<input name="${n}" type="${t}" placeholder="${p}" autocomplete="${n === 'password' || n === 'confirm' ? (up ? 'new-password' : 'current-password') : n === 'email' ? 'email' : 'username'}">`;
  const g = card(`<h1>${up ? 'Create your account' : 'Welcome to Tessera'}</h1>
    <p class="cl-muted">${up ? 'Your boards are saved to your account and follow you to any device.' : 'Sign in to open your boards.'}</p>
    <div class="cl-f">${up ? f('email', 'email', 'Email') + f('username', 'text', 'Username (3–20 letters, numbers, _)') + f('password', 'password', 'Password (8+ characters)') + f('confirm', 'password', 'Confirm password')
      : f('id', 'text', 'Username or email') + f('password', 'password', 'Password')}</div><p class="cl-err" id="clErr"></p>
    <button class="btn primary" id="clGo">${up ? 'Create account' : 'Sign in'}</button>
    <button class="cl-sw" data-sw>${up ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>`);
  g._close = unlock;
  g.querySelector('#clGo').onclick = () => submit(g, up);
  g.querySelector('[data-sw]').onclick = () => showGate(up ? 'in' : 'up');
  g.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') g.querySelector('#clGo').click(); }));
  setTimeout(() => g.querySelector('input')?.focus(), 60);
}
function gateNotice(email) {
  const g = card(`<h1>Check your email</h1><p class="cl-muted">We sent a confirmation link to <b>${T.esc(email)}</b>. Open it to activate your account, then sign in.</p><button class="btn primary" id="clBack">Back to sign in</button>`);
  g.querySelector('#clBack').onclick = () => showGate('in');
}
async function signOutFlow() {
  clearTimeout(pushT); pushT = 0;
  if (status !== 'Saved') await push();
  if (status !== 'Saved' && !(await T.modal({ title: 'Sign out without saving?', html: '<p>Your latest changes couldn’t be saved to the cloud. Signing out erases them from this device.</p>',
    actions: [{ label: 'Stay signed in', value: false }, { label: 'Sign out', kind: 'danger', primary: true, value: true }] }))) return;
  await sb.auth.signOut(); await T.wipe(); location.reload();   // the next person on this browser starts clean
}
async function submit(ov, up) {
  const v = (n, trim = true) => { const x = ov.querySelector(`[name=${n}]`)?.value ?? ''; return trim ? x.trim() : x; };
  const err = m => { ov.querySelector('#clErr').textContent = m; }, btn = ov.querySelector('.btn.primary');
  err(''); btn.disabled = true;
  try {
    const password = v('password', false);
    if (up) {
      const email = v('email'), username = v('username');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('Enter a valid email address.');
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return err('Username: 3–20 letters, numbers or underscores.');
      if (password.length < 8) return err('Password must be at least 8 characters.');
      if (password !== v('confirm', false)) return err('Passwords don’t match.');
      const { data: free } = await sb.rpc('username_available', { p: username }); if (!free) return err('That username is taken.');
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: location.href.split(/[#?]/)[0] } });
      if (error) return err(error.message);
      if (data.user && data.user.identities?.length === 0) return err('That email is already registered. Try signing in.');
      gateNotice(email);
    } else {
      const id = v('id'); if (!id || !password) return err('Enter your username and password.');
      let r;
      if (id.includes('@')) r = await sb.auth.signInWithPassword({ email: id, password });
      else {
        const res = await fetch(C.url + '/functions/v1/username-login', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.anonKey, Authorization: 'Bearer ' + C.anonKey }, body: JSON.stringify({ username: id, password }) });
        const j = await res.json().catch(() => ({})); if (!res.ok) return err(j.error || 'Sign-in failed.');
        r = await sb.auth.setSession(j.session);
      }
      if (r.error) return err(/confirm/i.test(r.error.message) ? 'Please confirm your email first.' : 'Invalid username or password.');
      unlock();
    }
  } catch { err('Couldn’t reach the server. Check your connection.'); }
  finally { btn.disabled = false; }
}
async function openPanel() {
  if (!user) return showGate('in');
  const e = T.esc;
  T.modal({ title: 'Your account', eyebrow: '@' + e(profile?.username || ''),
    html: `<p class="cl-muted">${e(user.email)}</p><p class="cl-muted">Your boards sync to this account · ${e(status || 'Saved')}</p>`,
    actions: [{ label: 'Sign out', value: 'out' }, { label: 'Done', kind: 'primary', primary: true, value: true }] })
    .then(v => { if (v === 'out') signOutFlow(); });
}
// A project is any board on Home that has something on it (blank boards are left out); it is saved with the account automatically.
function projectList() {
  const S = T.S(), boards = S.boards, root = boards[S.rootId], out = [];
  const count = ids => ids.reduce((n, id) => n + Object.keys(boards[id]?.cards || {}).length, 0);
  const edited = ids => Math.max(0, ...ids.map(i => boards[i]?.editedAt || 0));
  const own = Object.values(root?.cards || {}).filter(c => c.type !== 'board').length;
  if (own) out.push({ id: S.rootId, title: root.title || 'Home', n: own, at: edited([S.rootId]) });
  for (const c of Object.values(root?.cards || {})) {
    if (c.type !== 'board' || !boards[c.target]) continue;
    const ids = T.kids(c.target), n = count(ids);
    if (n) out.push({ id: c.target, title: boards[c.target].title || 'Untitled board', n, at: edited(ids) });
  }
  return out.sort((a, b) => b.at - a.at);
}
async function shareCurrent() {
  const id = T.cur(), n = T.kids(id).reduce((k, i) => k + Object.keys(T.S().boards[i]?.cards || {}).length, 0);
  if (!n) return T.toast('Add something to this board before sharing it');
  const t = await publish(id);
  await navigator.clipboard?.writeText(linkOf(t)).catch(() => {});
  T.toast('Link copied. Anyone with it can view this board.');
}
function openProjects() {
  if (!user) return showGate('in');
  const e = T.esc, list = projectList(), cur = T.S().boards[T.cur()];
  const rows = list.map(p => `<button class="cl-proj" data-open="${e(p.id)}"><b>${e(p.title)}</b><small>${p.n} item${p.n > 1 ? 's' : ''}${p.at ? ' · edited ' + new Date(p.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</small></button>`).join('')
    || '<p class="cl-muted">Nothing here yet. Boards you build, or start from a template, appear here automatically once they have something on them.</p>';
  T.modal({ title: 'Projects', eyebrow: e(status || 'Saved'),
    html: `<div class="cl-acts"><button class="btn" data-save>Save now</button><button class="btn primary" data-share>Share link</button></div>
      <p class="cl-muted">Share link copies a view-only link for “${e(cur?.title || 'this board')}”. Anyone with it can view it without logging in.</p>
      <div class="cl-sub">Your projects</div><div class="cl-list">${rows}</div>`,
    actions: [{ label: 'Done', kind: 'primary', primary: true, value: true }],
    onOpen: ov => ov.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-save],[data-share],[data-open]'); if (!b) return;
      try {
        if ('save' in b.dataset) { ov._close(true); clearTimeout(pushT); pushT = 0; await push(); T.toast(status === 'Saved' ? 'Saved to your account' : 'Couldn’t save. Check your connection.'); }
        else if ('share' in b.dataset) { b.disabled = true; b.textContent = 'Publishing…'; await shareCurrent(); ov._close(true); }
        else { ov._close(true); T.open(b.dataset.open); }
      } catch (x) { console.warn(x); T.toast('Something went wrong. Try again.'); }
    }) });
}
})();
