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

(async () => {
  try {
    for (let i = 0; !window.__tessera && i < 150; i++) await sleep(100);
    T = window.__tessera; if (!T) return;
    await new Promise((ok, no) => { const s = document.createElement('script'); s.src = LIB; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  } catch { return; }   // offline or blocked: Tessera keeps working locally
  sb = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  addButton();
  sb.auth.onAuthStateChange((ev, ses) => setTimeout(() => onSession(ses), 0));
  window.__tessOnSave = schedulePush;
  document.addEventListener('visibilitychange', () => { if (document.hidden && pushT) { clearTimeout(pushT); pushT = 0; push(); } });
})();

/* ---------- session ---------- */
async function onSession(ses) {
  const u = ses?.user || null;
  if (u?.id === user?.id) return paint();
  user = u; profile = null; shares = [];
  if (!user) { status = ''; return paint(); }
  const { data } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle(); profile = data;
  if (confirmedNow) T.toast('Email confirmed. Welcome!');
  await firstSync();
}
async function firstSync() {
  setStatus('Syncing…');
  const { data: r, error } = await sb.from('workspaces').select('updated_at').eq('owner', user.id).maybeSingle();
  if (error) return setStatus('Offline');
  if (!r) return push(true);
  if (r.updated_at === ls('last:' + user.id, null)) { setStatus('Saved'); return schedulePush(); }
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
async function unshare(token) {
  await sb.from('shares').delete().eq('token', token);
  const { data } = await sb.storage.from('shared').list(`${user.id}/${token}`);
  if (data?.length) await sb.storage.from('shared').remove(data.map(f => `${user.id}/${token}/${f.name}`));
  lsSet('simgs:' + token, []);
}
async function refreshShares() {
  try { for (const s of await loadShares()) { const b = T.S().boards[s.board_id]; if (b && (b.editedAt || 0) > new Date(s.updated_at).getTime()) await publish(s.board_id); } } catch {}
}

/* ---------- UI ---------- */
function setStatus(s) { status = s; paint(); }
function paint() { const b = document.getElementById('clBtn'); if (b) b.innerHTML = user ? `<i class="cl-dot"></i>${T.esc(profile?.username || 'Account')}<small>${T.esc(status)}</small>` : 'Sign in'; }
function addButton() {
  const st = document.createElement('style');
  st.textContent = `#clBtn{position:fixed;left:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:60;height:34px;padding:0 14px;border-radius:12px;display:flex;align-items:center;gap:8px;font:600 12.5px/1 inherit;color:var(--text);border:1px solid var(--line-2);cursor:pointer}
#clBtn small{font-weight:500;color:var(--text-3)}.cl-dot{width:8px;height:8px;border-radius:50%;background:var(--accent)}
.cl-f{display:grid;gap:10px;margin-top:6px}.cl-f input{height:40px;padding:0 12px;border-radius:10px;border:1px solid var(--line-2);background:var(--surface-2);color:var(--text);font:inherit;width:100%;box-sizing:border-box}
.cl-err{color:#d6455d;font-size:13px;min-height:18px;margin:6px 0 0}.cl-muted,.cl-sw{color:var(--text-3);font-size:13px}.cl-sw{background:none;border:0;cursor:pointer;color:var(--accent);padding:0;font:inherit;margin-top:8px}
.cl-row{display:flex;gap:6px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}.cl-row>div{flex:1;min-width:0}.cl-row small{display:block;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`;
  document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'clBtn'; b.className = 'glass'; b.onclick = openPanel; document.body.appendChild(b); paint();
}
function openAuth(mode = 'in') {
  const up = mode === 'up', f = (n, t, p) => `<input name="${n}" type="${t}" placeholder="${p}" autocomplete="${n === 'password' || n === 'confirm' ? (up ? 'new-password' : 'current-password') : n === 'email' ? 'email' : 'username'}">`;
  T.modal({ title: up ? 'Create your account' : 'Sign in', eyebrow: 'Tessera cloud', cls: 'cl-modal',
    html: `<div class="cl-f">${up ? f('email', 'email', 'Email') + f('username', 'text', 'Username (3–20 letters, numbers, _)') + f('password', 'password', 'Password (8+ characters)') + f('confirm', 'password', 'Confirm password')
      : f('id', 'text', 'Username or email') + f('password', 'password', 'Password')}</div><p class="cl-err" id="clErr"></p>
      <button class="cl-sw" data-sw>${up ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>`,
    actions: [{ label: 'Cancel', value: null }, { label: up ? 'Create account' : 'Sign in', kind: 'primary', primary: true, fn: ov => { submit(ov, up); return false; } }],
    onOpen: ov => { ov.querySelector('[data-sw]').onclick = () => { ov._close(null); openAuth(up ? 'in' : 'up'); }; setTimeout(() => ov.querySelector('input')?.focus(), 60); } });
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
      ov._close(null);
      T.modal({ title: 'Check your email', html: `<p>We sent a confirmation link to <b>${T.esc(email)}</b>. Open it to activate your account, then sign in.</p>`, actions: [{ label: 'OK', kind: 'primary', primary: true }] });
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
      ov._close(true);
    }
  } catch { err('Couldn’t reach the server. Check your connection.'); }
  finally { btn.disabled = false; }
}
async function openPanel() {
  if (!user) return openAuth('in');
  await loadShares().catch(() => {});
  const cur = T.S().boards[T.cur()], e = T.esc;
  const rows = shares.map(s => `<div class="cl-row"><div><b>${e(s.title)}</b><small>${e(linkOf(s.token))}</small></div><button class="btn" data-copy="${s.token}">Copy</button><button class="btn" data-upd="${e(s.board_id)}">Update</button><button class="btn" data-stop="${s.token}">Stop</button></div>`).join('') || '<p class="cl-muted">No shared links yet.</p>';
  T.modal({ title: 'Your account', eyebrow: '@' + e(profile?.username || ''), cls: 'cl-modal',
    html: `<p class="cl-muted">${e(user.email)} · ${e(status || 'Saved')}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><button class="btn" data-save>Save now</button><button class="btn" data-load>Load from cloud</button></div>
      <h3 style="margin:14px 0 4px;font-size:14px">Share view-only link</h3>
      <button class="btn primary" data-share>Share “${e(cur?.title || 'this board')}”</button>
      <p class="cl-muted">Anyone with the link can view it without logging in. Use Update after editing, or Stop to turn the link off.</p>${rows}`,
    actions: [{ label: 'Sign out', value: 'out' }, { label: 'Done', kind: 'primary', primary: true, value: true }],
    onOpen: ov => ov.addEventListener('click', async ev => {
      const b = ev.target.closest('button[data-save],[data-load],[data-share],[data-copy],[data-upd],[data-stop]'); if (!b) return;
      const d = b.dataset, again = () => { ov._close(true); openPanel(); };
      try {
        if ('save' in d) { clearTimeout(pushT); await push(); ov._close(true); }
        else if ('load' in d) { ov._close(true); await pull(); }
        else if ('share' in d) { b.disabled = true; b.textContent = 'Publishing…'; const t = await publish(T.cur()); await navigator.clipboard?.writeText(linkOf(t)).catch(() => {}); T.toast('Link copied. Anyone with it can view this board.'); again(); }
        else if ('copy' in d) { await navigator.clipboard?.writeText(linkOf(d.copy)).catch(() => {}); T.toast('Link copied'); }
        else if ('upd' in d) { b.textContent = '…'; await publish(d.upd); T.toast('Shared link updated'); again(); }
        else if ('stop' in d) { await unshare(d.stop); T.toast('Link turned off'); again(); }
      } catch (x) { console.warn(x); T.toast('Something went wrong. Try again.'); }
    }) }).then(v => { if (v === 'out') sb.auth.signOut(); });
}
})();
