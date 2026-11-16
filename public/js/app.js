// Athenaeum — single-page frontend (vanilla JS, hash routing, no build step).
import { TEST_CASES, SECTIONS, runCase } from './testcases.js';

// ---------------------------------------------------------------- utilities
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hueOf = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const debounce = (fn, ms = 220) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
function timeAgo(iso) {
  const s = Math.max(1, (Date.now() - new Date(iso)) / 1000);
  for (const [u, n] of [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (s >= n) { const v = Math.floor(s / n); return `${v} ${u}${v > 1 ? 's' : ''} ago`; }
  }
  return 'just now';
}
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

const ICONS = {
  catalog: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  shelf: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  requests: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  author: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  librarian: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  qa: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  play: '<path d="M5 3l14 9-14 9z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  read: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  spark: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const NOTIF_ICON = { BORROW: 'catalog', RETURN: 'undo', OVERDUE: 'alert', REQUEST: 'requests', MANUSCRIPT: 'author', WELCOME: 'spark' };

// ---------------------------------------------------------------- state + API
const state = { token: store.get('lib.token'), user: null, unread: 0, refresh: null, qa: {} };

async function api(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token && !path.startsWith('/api/auth/login')) {
    signOut();
    toast('Your session has expired. Please sign in again.', 'error');
  }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (HTTP ${res.status})`);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

function setSession(token, user) {
  state.token = token; state.user = user;
  store.set('lib.token', token);
}
function signOut() {
  setSession(null, null);
  closeModal();
  $('#app').innerHTML = '';
  location.hash = '';
  render();
}

// ---------------------------------------------------------------- toasts + modal
function toast(message, type = 'success', detail = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info')}<div>${esc(message)}${detail ? `<small>${esc(detail)}</small>` : ''}</div>`;
  $('#toasts').append(el);
  setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; }, 3800);
  setTimeout(() => el.remove(), 4200);
}
const errToast = (e) => toast(e.message, 'error', e.status ? `HTTP ${e.status}` : '');

function openModal(html, cls = '') {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal ${cls}" role="dialog" aria-modal="true">
    <button class="icon-btn modal-close" data-close aria-label="Close">${icon('x')}</button>${html}</div></div>`;
  root.firstElementChild.addEventListener('mousedown', (e) => {
    if (e.target === e.currentTarget || e.target.closest('[data-close]')) closeModal();
  });
  return root.querySelector('.modal');
}
function closeModal() { $('#modal-root').innerHTML = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ---------------------------------------------------------------- shared components
function cover(b, cls = '') {
  const h = b.cover_hue ?? hueOf(b.title);
  return `<div class="cover ${cls}" style="--h:${h}"><span class="cover-genre">${esc(b.genre || '')}</span>
    <span class="cover-title">${esc(b.title)}</span><span class="cover-author">${esc(b.author || '')}</span></div>`;
}
function stars(avg) {
  const n = Math.round(avg || 0);
  return `<span class="stars" aria-label="${avg || 0} out of 5">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;
}
const avatar = (name) => `<span class="avatar" style="--h:${hueOf(name)}">${esc(String(name).slice(0, 2).toUpperCase())}</span>`;
const statusPill = (s) => `<span class="pill ${{ APPROVED: 'ok', PENDING: 'warn', REJECTED: 'danger', ACTIVE: 'info', RETURNED: 'plain', LATE: 'warn' }[s] || ''}">${esc(s)}</span>`;
const emptyState = (emoji, title, text = '') => `<div class="empty"><div class="big">${emoji}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
function fieldErrors(form, fields = {}) {
  $$('.field', form).forEach((f) => {
    const name = f.querySelector('[name]')?.name;
    f.classList.toggle('invalid', !!fields[name]);
    const slot = f.querySelector('.field-error');
    if (slot) slot.textContent = fields[name] || '';
  });
}
const formData = (form) => Object.fromEntries(new FormData(form).entries());
async function busy(btn, fn) {
  const html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span>';
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = html; }
}

// ---------------------------------------------------------------- navigation
const ALL = ['STUDENT', 'STAFF', 'AUTHOR', 'LIBRARIAN'];
const NAV = [
  { route: 'catalog', label: 'Catalog', icon: 'catalog', roles: ALL },
  { route: 'shelf', label: 'My Shelf', icon: 'shelf', roles: ['STUDENT', 'STAFF'] },
  { route: 'requests', label: 'Book Requests', icon: 'requests', roles: ['STUDENT', 'STAFF'] },
  { route: 'author', label: 'Author Studio', icon: 'author', roles: ['AUTHOR'] },
  { route: 'librarian', label: 'Librarian Desk', icon: 'librarian', roles: ['LIBRARIAN'] },
  { route: 'notifications', label: 'Notifications', icon: 'bell', roles: ALL },
  { route: 'qa', label: 'QA Lab', icon: 'qa', roles: ALL, tag: '20' },
];
const VIEWS = {
  catalog: viewCatalog, shelf: viewShelf, requests: viewRequests, author: viewAuthor,
  librarian: viewLibrarian, notifications: viewNotifications, qa: viewQA,
};

async function render() {
  if (!state.user && state.token) {
    try { state.user = (await api('GET', '/api/auth/me')).user; } catch { setSession(null, null); }
  }
  if (!state.user) return renderAuth();
  if (!$('.shell')) renderShell();

  const route = location.hash.replace(/^#\/?/, '').split('?')[0] || 'catalog';
  const nav = NAV.find((n) => n.route === route);
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
  $('#page-title').textContent = nav?.label || 'Not found';
  state.refresh = null;
  const view = $('#view');
  view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
  view.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
  if (!nav) { view.innerHTML = emptyState('🧭', 'Page not found', 'That shelf does not exist.'); return; }
  try {
    if (!nav.roles.includes(state.user.role)) await viewDenied(view, nav);
    else await VIEWS[route](view);
  } catch (e) {
    view.innerHTML = emptyState('⚠️', 'Something went wrong', e.message);
  }
  refreshUnread();
}
window.addEventListener('hashchange', render);

function renderShell() {
  const u = state.user;
  const links = NAV.filter((n) => n.roles.includes(u.role) && n.route !== 'qa');
  $('#app').innerHTML = `
  <div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#/catalog">
        <span class="brand-mark">${icon('catalog')}</span>
        <span><span class="brand-name">Athenaeum</span><br><span class="brand-sub">Library System</span></span>
      </a>
      <nav class="nav">
        <div class="nav-label">Library</div>
        ${links.map((n) => `<a href="#/${n.route}" data-route="${n.route}">${icon(n.icon)}<span class="lbl">${n.label}</span>${n.route === 'notifications' ? '<span class="count" id="nav-unread" hidden></span>' : ''}</a>`).join('')}
        <div class="nav-label">Quality</div>
        <a href="#/qa" data-route="qa">${icon('qa')}<span class="lbl">QA Lab</span><span class="tag">20 TCs</span></a>
      </nav>
      <div class="sidebar-foot">
        <div class="user-card">${avatar(u.username)}<div class="who"><b>${esc(u.username)}</b><span>${esc(u.role)}</span></div>
          <button class="icon-btn" id="logout" title="Sign out" aria-label="Sign out">${icon('logout')}</button></div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div><div class="crumb">Athenaeum / ${esc(u.role.toLowerCase())}</div><h1 id="page-title"></h1></div>
        <div class="top-actions">
          <button class="icon-btn" id="theme" title="Toggle theme" aria-label="Toggle theme"></button>
          <a class="icon-btn" href="#/notifications" title="Notifications" aria-label="Notifications">${icon('bell')}<span class="badge-dot" id="bell-dot" hidden></span></a>
        </div>
      </header>
      <main id="view"></main>
    </div>
  </div>`;
  $('#logout').onclick = () => { signOut(); toast('Signed out', 'info'); };
  const paintTheme = () => { $('#theme').innerHTML = icon(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun'); };
  $('#theme').onclick = () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next; store.set('lib.theme', next); paintTheme();
  };
  paintTheme();
}

async function refreshUnread() {
  if (!state.user) return;
  try {
    const { unread } = await api('GET', '/api/notifications');
    state.unread = unread;
    for (const el of [$('#bell-dot'), $('#nav-unread')]) if (el) { el.hidden = !unread; el.textContent = unread > 9 ? '9+' : unread; }
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------- auth screen
function renderAuth() {
  const sample = [
    { title: 'Frankenstein', author: 'Mary Shelley', genre: 'Fiction', cover_hue: 120 },
    { title: 'The Pragmatic Programmer', author: 'Thomas & Hunt', genre: 'Technology', cover_hue: 255 },
    { title: 'A Brief History of Time', author: 'Stephen Hawking', genre: 'Science', cover_hue: 330 },
  ];
  $('#app').innerHTML = `
  <div class="auth">
    <section class="auth-art">
      <div class="brand" style="padding:0"><span class="brand-mark">${icon('catalog')}</span><span class="brand-name">Athenaeum</span></div>
      <div>
        <h1>Every book.<br>One <em>quiet</em> place.</h1>
        <p class="lead">Borrow, read, review and request books — while authors publish and librarians curate. Built with a live STQA test lab.</p>
        <div class="floating">${sample.map((b) => cover(b)).join('')}</div>
      </div>
      <div class="feature-list">
        <span>${icon('shield')} JWT + role-based access</span><span>${icon('catalog')} Live catalog</span><span>${icon('qa')} 20 executable test cases</span>
      </div>
    </section>
    <section class="auth-panel">
      <div class="auth-card">
        <p class="eyebrow">Welcome</p>
        <h2 id="auth-title">Sign in to your library</h2>
        <p class="muted">Use a demo account below or create your own.</p>
        <div class="tabs" role="tablist"><button class="active" data-tab="login">Sign in</button><button data-tab="register">Create account</button></div>
        <div id="auth-alert"></div>
        <form id="login-form" novalidate>
          <div class="field"><label for="l-user">Username</label><input class="input" id="l-user" name="username" autocomplete="username"><span class="field-error"></span></div>
          <div class="field"><label for="l-pass">Password</label><input class="input" id="l-pass" name="password" type="password" autocomplete="current-password"><span class="field-error"></span></div>
          <button class="btn primary block" type="submit">Sign in</button>
        </form>
        <form id="register-form" novalidate hidden>
          <div class="field"><label for="r-user">Username</label><input class="input" id="r-user" name="username" placeholder="3–30 letters, digits or _" autocomplete="username"><span class="field-error"></span></div>
          <div class="field"><label for="r-email">Email</label><input class="input" id="r-email" name="email" type="email" placeholder="you@university.edu"><span class="field-error"></span></div>
          <div class="form-row">
            <div class="field"><label for="r-pass">Password</label><input class="input" id="r-pass" name="password" type="password" placeholder="Min. 6 characters" autocomplete="new-password"><span class="field-error"></span></div>
            <div class="field"><label for="r-role">I am a…</label><select class="input" id="r-role" name="role"><option value="STUDENT">Student</option><option value="STAFF">Staff</option><option value="AUTHOR">Author</option></select><span class="field-error"></span></div>
          </div>
          <button class="btn primary block" type="submit">Create account</button>
        </form>
        <div class="demo">
          <p>Demo accounts — click to fill</p>
          <div class="chips">
            <button class="chip" data-demo="student_demo:Student@123">🎓 Student</button>
            <button class="chip" data-demo="staff_demo:Staff@123">🧑‍🏫 Staff</button>
            <button class="chip" data-demo="author_demo:Author@123">✒️ Author</button>
            <button class="chip" data-demo="librarian:Library@123">🏛️ Librarian</button>
          </div>
        </div>
      </div>
    </section>
  </div>`;

  const showTab = (tab) => {
    $$('.auth-card .tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('#login-form').hidden = tab !== 'login';
    $('#register-form').hidden = tab !== 'register';
    $('#auth-title').textContent = tab === 'login' ? 'Sign in to your library' : 'Create your reader card';
    $('#auth-alert').innerHTML = '';
  };
  $$('.auth-card .tabs button').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
  $$('[data-demo]').forEach((c) => (c.onclick = () => {
    const [u, p] = c.dataset.demo.split(':');
    showTab('login'); $('#l-user').value = u; $('#l-pass').value = p; $('#l-pass').focus();
  }));

  const alertBox = (msg) => { $('#auth-alert').innerHTML = msg ? `<div class="form-alert">${esc(msg)}</div>` : ''; };
  const onAuthed = ({ token, user }, msg) => {
    setSession(token, user);
    $('#app').innerHTML = '';
    if (!location.hash || location.hash === '#/') location.hash = user.role === 'LIBRARIAN' ? '#/librarian' : user.role === 'AUTHOR' ? '#/author' : '#/catalog';
    render();
    toast(msg);
  };

  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, d = formData(f);
    const fields = {};
    if (!d.username.trim()) fields.username = 'Username is required';
    if (!d.password) fields.password = 'Password is required';
    fieldErrors(f, fields); alertBox('');
    if (Object.keys(fields).length) return;
    try {
      await busy(f.querySelector('button[type=submit]'), async () => {
        const res = await api('POST', '/api/auth/login', d);
        onAuthed(res, `Welcome back, ${res.user.username}!`);
      });
    } catch (err) { alertBox(err.message); }
  };
  $('#register-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, d = formData(f);
    fieldErrors(f, {}); alertBox('');
    try {
      await busy(f.querySelector('button[type=submit]'), async () => {
        const res = await api('POST', '/api/auth/register', d);
        onAuthed(res, `Account created — welcome, ${res.user.username}!`);
      });
    } catch (err) { fieldErrors(f, err.data?.fields); if (!err.data?.fields) alertBox(err.message); }
  };
}

// ---------------------------------------------------------------- 403 view (TC016 in the UI)
async function viewDenied(el, nav) {
  let probe = '';
  try {
    await api('GET', '/api/admin/stats');
  } catch (e) { probe = `HTTP ${e.status} ${JSON.stringify(e.data)}`; }
  el.innerHTML = `
  <div class="denied">
    <div class="code">403</div>
    <h2 class="display" style="font-size:28px;margin:10px 0 6px">Access denied</h2>
    <p class="muted">Your role <b>${esc(state.user.role)}</b> cannot open <b>${esc(nav.label)}</b>. The page is hidden in the UI <i>and</i> enforced by the server:</p>
    <div class="terminal">
      <div class="dim">$ curl -H "Authorization: Bearer &lt;${esc(state.user.role.toLowerCase())}-token&gt;" /api/admin/stats</div>
      <div class="red">${esc(probe || 'request blocked')}</div>
      <div class="dim" style="margin-top:8px"># STQA TC016 / TC017 / TC018 — non-librarian opens librarian function → denied</div>
    </div>
    <div class="actions" style="justify-content:center;margin-top:22px"><a class="btn primary" href="#/catalog">Back to catalog</a></div>
  </div>`;
}

// ---------------------------------------------------------------- catalog
async function viewCatalog(el) {
  const u = state.user;
  const { books: all } = await api('GET', '/api/books');
  const genres = [...new Set(all.map((b) => b.genre))].sort();
  const copies = all.reduce((s, b) => s + b.available_copies, 0);
  let genre = '';
  el.innerHTML = `
  <section class="hero-band">
    <div>
      <p class="eyebrow">${greeting()}, ${esc(u.username)}</p>
      <h2 class="display">What will you read next?</h2>
      <p class="muted">Search the approved catalog by title or author. Only librarian-approved books appear here.</p>
    </div>
    <div class="hero-stats">
      <div><b>${all.length}</b><span>titles</span></div>
      <div><b>${copies}</b><span>copies on shelf</span></div>
      <div><b>${genres.length}</b><span>genres</span></div>
    </div>
  </section>
  <div class="toolbar">
    <label class="search">${icon('search')}<input id="q" type="search" placeholder="Search by title or author…  try “prag” or “austen”" autocomplete="off" aria-label="Search catalog"></label>
    <label class="switch"><input type="checkbox" id="avail"><span class="track"></span><span>Available only</span></label>
  </div>
  <div class="chips" id="genres">
    <button class="chip active" data-g="">All</button>${genres.map((g) => `<button class="chip" data-g="${esc(g)}">${esc(g)}</button>`).join('')}
  </div>
  <p class="result-meta" id="meta"></p>
  <div class="book-grid" id="grid"></div>`;

  const load = async () => {
    const p = new URLSearchParams();
    const q = $('#q', el).value.trim();
    if (q) p.set('q', q);
    if ($('#avail', el).checked) p.set('available', 'true');
    if (genre) p.set('genre', genre);
    const { books } = await api('GET', `/api/books?${p}`);
    if (!el.isConnected) return;
    $('#meta', el).innerHTML = q ? `${plural(books.length, 'result')} for “<b>${esc(q)}</b>”` : `Showing ${plural(books.length, 'book')}`;
    $('#grid', el).innerHTML = books.length ? books.map((b) => `
      <article class="book-card" tabindex="0" data-id="${b.id}">
        ${cover(b)}
        <div><h4>${esc(b.title)}</h4><div class="by">${esc(b.author)}</div></div>
        <div class="row">
          <span class="pill ${b.available_copies ? 'ok' : 'danger'}">${b.available_copies ? `${b.available_copies}/${b.total_copies} in` : 'All out'}</span>
          ${b.review_count ? `<span class="rating-num">★ ${b.avg_rating}</span>` : ''}
        </div>
      </article>`).join('') : `<div style="grid-column:1/-1">${emptyState('🔍', 'No books found', 'Try a different title, author or filter — or request it from the library.')}</div>`;
  };
  state.refresh = load;
  $('#q', el).addEventListener('input', debounce(load));
  $('#avail', el).onchange = load;
  $('#genres', el).onclick = (e) => {
    const c = e.target.closest('[data-g]'); if (!c) return;
    genre = c.dataset.g;
    $$('#genres .chip', el).forEach((x) => x.classList.toggle('active', x === c));
    load();
  };
  $('#grid', el).onclick = (e) => { const c = e.target.closest('[data-id]'); if (c) openBook(+c.dataset.id); };
  $('#grid', el).onkeydown = (e) => { if (e.key === 'Enter') { const c = e.target.closest('[data-id]'); if (c) openBook(+c.dataset.id); } };
  await load();
}

async function openBook(id) {
  let res;
  try { res = await api('GET', `/api/books/${id}`); } catch (e) { return errToast(e); }
  const { book, reviews, myLoan, myReview } = res;
  const reader = ['STUDENT', 'STAFF'].includes(state.user.role);
  const pct = book.total_copies ? Math.round((book.available_copies / book.total_copies) * 100) : 0;
  const overdue = myLoan && new Date(myLoan.due_at) < new Date();
  const m = openModal(`
    <div class="book-detail">
      ${cover(book, 'lg')}
      <div class="bd-info">
        <p class="eyebrow">${esc(book.genre)} · ${esc(book.year ?? '—')} · ${book.pages} pages</p>
        <h2 class="display">${esc(book.title)}</h2>
        <p class="muted">by ${esc(book.author)}</p>
        <div>${stars(book.avg_rating)} <span class="rating-num">${book.avg_rating ?? 'No ratings yet'} · ${plural(book.review_count, 'review')}</span></div>
        <p class="desc">${esc(book.description)}</p>
        <div class="avail"><div class="avail-bar"><span style="width:${pct}%"></span></div>${book.available_copies} of ${book.total_copies} copies available</div>
        ${myLoan ? `<div class="loan-note ${overdue ? 'over' : ''}">${overdue ? '⚠️ Overdue — was due' : '📖 On your shelf · due'} <b>${fmtDate(myLoan.due_at)}</b></div>` : ''}
        <div class="actions">
          ${reader && myLoan ? `<button class="btn primary" id="bd-read">${icon('read')} Read now</button><button class="btn" id="bd-return">${icon('undo')} Return</button>` : ''}
          ${reader && !myLoan ? `<button class="btn primary" id="bd-borrow" ${book.available_copies ? '' : 'disabled'}>${icon('plus')} ${book.available_copies ? 'Borrow for 14 days' : 'Currently unavailable'}</button>` : ''}
          ${!reader ? `<span class="muted" style="font-size:12.5px">Borrowing is available to students and staff.</span>` : ''}
        </div>
      </div>
    </div>
    <section class="reviews">
      <h3>Reader reviews</h3>
      ${reader && !myReview ? `
      <form class="review-form" id="rv-form">
        <div class="star-pick" id="rv-stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} star">★</button>`).join('')}</div>
        <textarea class="input" name="text" maxlength="1000" placeholder="What did you think?"></textarea>
        <div class="actions"><button class="btn primary sm" type="submit">Post review</button><span class="muted" style="font-size:12px" id="rv-hint">Pick a rating from 1 to 5</span></div>
      </form>` : ''}
      ${reviews.length ? reviews.map((r) => `
        <div class="review"><div class="head">${avatar(r.username)}<b>${esc(r.username)}</b>${stars(r.rating)}<span class="muted" style="margin-left:auto;font-size:12px">${timeAgo(r.created_at)}</span></div>
        ${r.text ? `<p>${esc(r.text)}</p>` : ''}</div>`).join('') : '<p class="muted">No reviews yet — be the first.</p>'}
    </section>`, 'wide');

  const after = () => { state.refresh?.(); refreshUnread(); };
  $('#bd-borrow', m)?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    try { await api('POST', '/api/loans', { bookId: book.id }); toast(`Borrowed “${book.title}”`, 'success', 'Due in 14 days'); after(); openBook(id); }
    catch (err) { errToast(err); }
  }));
  $('#bd-return', m)?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    try { await api('POST', `/api/loans/${myLoan.id}/return`); toast(`Returned “${book.title}”`); after(); openBook(id); }
    catch (err) { errToast(err); }
  }));
  $('#bd-read', m)?.addEventListener('click', () => openReader(book));

  const form = $('#rv-form', m);
  if (form) {
    let rating = 0;
    const paint = (n) => $$('#rv-stars button', m).forEach((b) => b.classList.toggle('on', +b.dataset.n <= n));
    $('#rv-stars', m).onclick = (e) => { const b = e.target.closest('[data-n]'); if (b) { rating = +b.dataset.n; paint(rating); $('#rv-hint', m).textContent = `${rating} / 5`; } };
    form.onsubmit = async (e) => {
      e.preventDefault();
      try { await api('POST', `/api/books/${book.id}/reviews`, { rating, text: form.text.value }); toast('Review posted'); after(); openBook(id); }
      catch (err) { errToast(err); }
    };
  }
}

// ---------------------------------------------------------------- reader + bookmarks
const WORDS = 'the light of the reading room fell across old pages and every margin held a quiet argument about memory time and the shape of a sentence she turned toward the window where rain wrote its own slow chapter on the glass knowledge is a catalog of doubts patiently arranged he said and the archive answered with dust ink and a smell of cedar shelves'.split(' ');
function pageText(bookId, page) {
  let seed = bookId * 7919 + page * 104729;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const paras = [];
  for (let p = 0; p < 4; p++) {
    const words = [];
    const len = 40 + Math.floor(rand() * 30);
    for (let i = 0; i < len; i++) words.push(WORDS[Math.floor(rand() * WORDS.length)]);
    let s = words.join(' ');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    paras.push(s.replace(/(\w+ \w+ \w+ \w+ \w+ \w+ \w+ \w+ \w+ \w+ \w+) (\w)/g, (_, a, b) => `${a}. ${b.toUpperCase()}`) + '.');
  }
  return paras;
}

async function openReader(book, startPage = 1) {
  let page = startPage;
  let marks = (await api('GET', `/api/bookmarks?bookId=${book.id}`)).bookmarks;
  const m = openModal(`
    <div class="reader-head">${cover(book, 'thumb')}<div><b>${esc(book.title)}</b><span class="muted" style="font-size:12px">${esc(book.author)}</span></div></div>
    <div class="reader-page" id="rp"></div>
    <div class="reader-foot">
      <button class="btn sm" id="prev">${icon('left')}</button>
      <input class="input" id="pg" type="number" min="1" max="${book.pages}" aria-label="Page number">
      <span class="muted" style="font-size:12.5px">of ${book.pages}</span>
      <button class="btn sm" id="next">${icon('right')}</button>
      <button class="btn sm primary" id="mark" style="margin-left:auto">${icon('bookmark')} Bookmark page</button>
    </div>
    <div class="bm-chips" id="bms"></div>`, 'reader');
  const paint = () => {
    const marked = marks.some((b) => b.page === page);
    $('#rp', m).innerHTML = `${marked ? '<span class="ribbon" title="Bookmarked"></span>' : ''}<h3>Chapter ${Math.ceil(page / 12)}</h3>
      ${pageText(book.id, page).map((p) => `<p>${esc(p)}</p>`).join('')}<div class="pg">— ${page} —</div>`;
    $('#pg', m).value = page;
    $('#bms', m).innerHTML = marks.length ? `<span class="muted" style="font-size:12px;align-self:center">Bookmarks:</span>${marks.sort((a, b) => a.page - b.page).map((b) => `<button class="chip ${b.page === page ? 'active' : ''}" data-p="${b.page}">p. ${b.page}</button>`).join('')}` : '';
  };
  const go = (p) => { page = Math.min(book.pages, Math.max(1, p)); paint(); };
  $('#prev', m).onclick = () => go(page - 1);
  $('#next', m).onclick = () => go(page + 1);
  $('#pg', m).onchange = (e) => go(parseInt(e.target.value, 10) || 1);
  $('#bms', m).onclick = (e) => { const c = e.target.closest('[data-p]'); if (c) go(+c.dataset.p); };
  $('#mark', m).onclick = async () => {
    try {
      const { bookmark } = await api('POST', '/api/bookmarks', { bookId: book.id, page });
      marks.push(bookmark); paint(); toast(`Bookmarked page ${page}`);
    } catch (e) { toast(e.message, e.status === 409 ? 'info' : 'error', `HTTP ${e.status} · duplicate handled (TC116)`); }
  };
  paint();
}

// ---------------------------------------------------------------- my shelf
async function viewShelf(el) {
  const [{ loans, limit }, { bookmarks }] = await Promise.all([api('GET', '/api/loans/me'), api('GET', '/api/bookmarks')]);
  const active = loans.filter((l) => l.status === 'ACTIVE');
  const history = loans.filter((l) => l.status !== 'ACTIVE');
  const overdue = active.filter((l) => l.overdue).length;
  el.innerHTML = `
  <div class="stats">
    <div class="stat"><div class="k">Active loans</div><div class="v">${active.length}<span class="muted" style="font-size:16px"> / ${limit}</span></div><div class="s">${limit - active.length} slot(s) free</div></div>
    <div class="stat" style="--tone:var(--danger-soft)"><div class="k">Overdue</div><div class="v" style="color:${overdue ? 'var(--danger)' : 'inherit'}">${overdue}</div><div class="s">${overdue ? 'Please return soon' : 'All on time'}</div></div>
    <div class="stat" style="--tone:var(--ok-soft)"><div class="k">Books finished</div><div class="v">${history.length}</div><div class="s">lifetime returns</div></div>
    <div class="stat" style="--tone:var(--info-soft)"><div class="k">Bookmarks</div><div class="v">${bookmarks.length}</div><div class="s">across all books</div></div>
  </div>
  <section class="panel">
    <div class="panel-head"><h3>Currently borrowed</h3><span class="pill ${active.length >= limit ? 'warn' : 'accent'}">Limit ${active.length}/${limit}</span></div>
    ${active.length ? `<div class="loan-list">${active.map((l) => {
      const total = daysBetween(l.borrowed_at, l.due_at), left = daysBetween(new Date(), l.due_at);
      const used = Math.min(100, Math.max(0, ((total - left) / total) * 100));
      return `<div class="loan ${l.overdue ? 'over' : ''}">${cover(l, 'thumb')}
        <div class="info"><b>${esc(l.title)}</b><span class="muted" style="font-size:12.5px">${esc(l.author)}</span>
          <div class="due-meter"><span style="width:${l.overdue ? 100 : used}%"></span></div>
          <span style="font-size:12px">${l.overdue ? `<span class="pill danger">Overdue ${-left}d</span>` : `<span class="pill ok">Due in ${left}d</span>`} <span class="muted">${fmtDate(l.due_at)}</span></span>
          <div class="actions"><button class="btn sm primary" data-read="${l.book_id}">${icon('read')} Read</button><button class="btn sm" data-return="${l.id}">${icon('undo')} Return</button></div>
        </div></div>`;
    }).join('')}</div>` : emptyState('📚', 'Your shelf is empty', 'Browse the catalog and borrow up to 3 books at a time.')}
  </section>
  <div class="grid-2">
    <section class="panel">
      <div class="panel-head"><h3>Bookmarks</h3></div>
      ${bookmarks.length ? bookmarks.map((b) => `<div class="list-row">${cover(b, 'thumb')}<div class="grow"><b>${esc(b.title)}</b><span>Page ${b.page}${b.note ? ` · ${esc(b.note)}` : ''} · ${timeAgo(b.created_at)}</span></div>
        <button class="icon-btn" data-del-bm="${b.id}" title="Remove bookmark" aria-label="Remove bookmark">${icon('trash')}</button></div>`).join('') : emptyState('🔖', 'No bookmarks yet', 'Open a borrowed book and bookmark a page.')}
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Reading history</h3></div>
      ${history.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Book</th><th>Borrowed</th><th>Returned</th><th>Status</th></tr></thead><tbody>
        ${history.map((l) => `<tr><td><b>${esc(l.title)}</b><div class="muted" style="font-size:12px">${esc(l.author)}</div></td><td>${fmtDate(l.borrowed_at)}</td><td>${fmtDate(l.returned_at)}</td><td>${statusPill(l.returned_at > l.due_at ? 'LATE' : 'RETURNED')}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('🕮', 'No history yet', 'Returned books will appear here.')}
    </section>
  </div>`;
  el.onclick = async (e) => {
    const r = e.target.closest('[data-return]'), rd = e.target.closest('[data-read]'), del = e.target.closest('[data-del-bm]');
    try {
      if (r) await busy(r, async () => { await api('POST', `/api/loans/${r.dataset.return}/return`); toast('Book returned — thank you!'); render(); });
      if (rd) { const { book } = await api('GET', `/api/books/${rd.dataset.read}`); openReader(book); }
      if (del) { await api('DELETE', `/api/bookmarks/${del.dataset.delBm}`); toast('Bookmark removed', 'info'); render(); }
    } catch (err) { errToast(err); }
  };
}

// ---------------------------------------------------------------- book requests
async function viewRequests(el) {
  const { requests } = await api('GET', '/api/requests');
  el.innerHTML = `
  <div class="grid-side">
    <section class="panel">
      <div class="panel-head"><h3>Request a book</h3></div>
      <p class="muted" style="margin-bottom:16px;font-size:13px">Can't find something? Ask the librarians to add it to the collection.</p>
      <form id="rq-form" novalidate>
        <div class="field"><label>Title *</label><input class="input" name="title" maxlength="200" placeholder="e.g. Designing Data-Intensive Applications"><span class="field-error"></span></div>
        <div class="field"><label>Author</label><input class="input" name="author" maxlength="120"><span class="field-error"></span></div>
        <div class="field"><label>Why do you need it?</label><textarea class="input" name="reason" maxlength="500"></textarea><span class="field-error"></span></div>
        <button class="btn primary block" type="submit">${icon('plus')} Submit request</button>
      </form>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>My requests</h3><span class="muted" style="font-size:12.5px">${plural(requests.length, 'request')}</span></div>
      ${requests.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Book</th><th>Requested</th><th>Status</th><th>Librarian note</th></tr></thead><tbody>
      ${requests.map((r) => `<tr><td><b>${esc(r.title)}</b><div class="muted" style="font-size:12px">${esc(r.author || '—')}</div></td><td>${timeAgo(r.created_at)}</td><td>${statusPill(r.status)}</td><td class="muted">${esc(r.librarian_note || '—')}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('📝', 'No requests yet', 'Your requests and their status will appear here.')}
    </section>
  </div>`;
  $('#rq-form', el).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    fieldErrors(f, {});
    try {
      await busy(f.querySelector('[type=submit]'), () => api('POST', '/api/requests', formData(f)));
      toast('Request sent to the librarians'); render();
    } catch (err) { fieldErrors(f, err.data?.fields); errToast(err); }
  };
}

// ---------------------------------------------------------------- notifications
async function viewNotifications(el) {
  const { notifications, unread } = await api('GET', '/api/notifications');
  el.innerHTML = `
  <section class="panel" style="max-width:820px;margin:0 auto">
    <div class="panel-head"><h3>Inbox <span class="muted" style="font-weight:400">· ${unread} unread</span></h3>
      ${unread ? '<button class="btn sm" id="read-all">Mark all as read</button>' : ''}</div>
    ${notifications.length ? notifications.map((n) => `
      <div class="notif ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
        <div class="n-ic ${esc(n.type)}">${icon(NOTIF_ICON[n.type] || 'bell')}</div>
        <div class="body"><div>${esc(n.message)}</div><span>${esc(n.type.toLowerCase())} · ${timeAgo(n.created_at)}</span></div>
      </div>`).join('') : emptyState('🔔', 'All quiet', 'Notifications about loans, requests and manuscripts show up here.')}
  </section>`;
  $('#read-all', el)?.addEventListener('click', async () => { await api('POST', '/api/notifications/read-all'); render(); });
  el.querySelector('.panel').onclick = async (e) => {
    const n = e.target.closest('.notif.unread'); if (!n) return;
    await api('POST', `/api/notifications/${n.dataset.id}/read`).catch(() => {});
    n.classList.remove('unread'); refreshUnread();
  };
}

// ---------------------------------------------------------------- author studio
async function viewAuthor(el) {
  const { manuscripts } = await api('GET', '/api/author/manuscripts');
  const count = (s) => manuscripts.filter((m) => m.status === s).length;
  el.innerHTML = `
  <div class="stats">
    <div class="stat"><div class="k">Submitted</div><div class="v">${manuscripts.length}</div><div class="s">manuscripts</div></div>
    <div class="stat" style="--tone:var(--warn-soft)"><div class="k">In review</div><div class="v">${count('PENDING')}</div><div class="s">awaiting librarian</div></div>
    <div class="stat" style="--tone:var(--ok-soft)"><div class="k">Published</div><div class="v">${count('APPROVED')}</div><div class="s">in the catalog</div></div>
    <div class="stat" style="--tone:var(--danger-soft)"><div class="k">Declined</div><div class="v">${count('REJECTED')}</div><div class="s">can be withdrawn</div></div>
  </div>
  <div class="grid-side">
    <section class="panel">
      <div class="panel-head"><h3>Submit a manuscript</h3></div>
      <form id="ms-form" novalidate>
        <div class="field"><label>Title *</label><input class="input" name="title" maxlength="200" placeholder="Your book's title"><span class="field-error"></span></div>
        <div class="form-row">
          <div class="field"><label>Genre</label><input class="input" name="genre" maxlength="40" placeholder="Fiction"><span class="field-error"></span></div>
          <div class="field"><label>Pages</label><input class="input" name="pages" type="number" min="1" max="5000" placeholder="120"><span class="field-error"></span></div>
        </div>
        <div class="field"><label>Synopsis</label><textarea class="input" name="description" maxlength="2000" placeholder="A short description readers will see"></textarea><span class="field-error"></span></div>
        <button class="btn primary block" type="submit">${icon('author')} Submit for review</button>
      </form>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>My manuscripts</h3></div>
      ${manuscripts.length ? manuscripts.map((m) => `
        <div class="decision-card">${cover({ ...m, author: state.user.username }, 'thumb')}
          <div class="grow"><b>${esc(m.title)}</b><span class="muted" style="font-size:12.5px">${esc(m.genre)} · submitted ${timeAgo(m.created_at)}${m.status === 'APPROVED' ? ` · ${m.total_copies} copies` : ''}</span>
            ${m.review_note ? `<span style="font-size:12.5px">Librarian: <i>${esc(m.review_note)}</i></span>` : ''}
            <div class="controls">${statusPill(m.status)}${m.status === 'APPROVED' && m.review_count ? `<span class="rating-num">★ ${m.avg_rating} (${m.review_count})</span>` : ''}
              ${m.status !== 'APPROVED' ? `<button class="btn sm ghost" data-withdraw="${m.id}">${icon('trash')} Withdraw</button>` : ''}</div>
          </div></div>`).join('') : emptyState('✒️', 'No manuscripts yet', 'Submit your first manuscript for librarian review.')}
    </section>
  </div>`;
  $('#ms-form', el).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, d = formData(f);
    if (d.pages === '') delete d.pages; else d.pages = Number(d.pages);
    fieldErrors(f, {});
    try {
      await busy(f.querySelector('[type=submit]'), () => api('POST', '/api/author/manuscripts', d));
      toast('Manuscript submitted for review'); render();
    } catch (err) { fieldErrors(f, err.data?.fields); errToast(err); }
  };
  el.onclick = async (e) => {
    const w = e.target.closest('[data-withdraw]'); if (!w) return;
    try { await api('DELETE', `/api/author/manuscripts/${w.dataset.withdraw}`); toast('Manuscript withdrawn', 'info'); render(); } catch (err) { errToast(err); }
  };
}

// ---------------------------------------------------------------- librarian desk
let libTab = 'overview';
async function viewLibrarian(el) {
  const [stats, { manuscripts }, { requests }] = await Promise.all([
    api('GET', '/api/admin/stats'), api('GET', '/api/admin/manuscripts'), api('GET', '/api/admin/requests'),
  ]);
  const pendingMs = manuscripts.filter((m) => m.status === 'PENDING');
  const pendingRq = requests.filter((r) => r.status === 'PENDING');
  const tabs = [['overview', 'Overview'], ['manuscripts', 'Manuscripts', pendingMs.length], ['requests', 'Requests', pendingRq.length], ['users', 'Users'], ['catalog', 'Catalog']];
  el.innerHTML = `<div class="tabs">${tabs.map(([k, l, n]) => `<button data-tab="${k}" class="${libTab === k ? 'active' : ''}">${l}${n ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div><div id="lib-body"></div>`;
  $('.tabs', el).onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) { libTab = b.dataset.tab; render(); } };
  const body = $('#lib-body', el);

  if (libTab === 'overview') {
    const max = Math.max(1, ...stats.loansLast7Days.map((d) => d.count));
    const topMax = Math.max(1, ...stats.topBooks.map((b) => b.loans));
    body.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="k">Titles in catalog</div><div class="v">${stats.totalTitles}</div><div class="s">${stats.availableCopies}/${stats.totalCopies} copies on shelf</div></div>
      <div class="stat" style="--tone:var(--info-soft)"><div class="k">Active loans</div><div class="v">${stats.activeLoans}</div><div class="s">${stats.totalLoans} all-time · ${stats.returnedLoans} returned</div></div>
      <div class="stat" style="--tone:var(--danger-soft)"><div class="k">Overdue</div><div class="v" style="color:${stats.overdueLoans ? 'var(--danger)' : 'inherit'}">${stats.overdueLoans}</div><div class="s">past due date</div></div>
      <div class="stat" style="--tone:var(--ok-soft)"><div class="k">Members</div><div class="v">${stats.totalUsers}</div><div class="s">${Object.entries(stats.usersByRole).map(([r, c]) => `${c} ${r.toLowerCase()}`).join(' · ')}</div></div>
      <div class="stat" style="--tone:var(--warn-soft)"><div class="k">Awaiting action</div><div class="v">${stats.pendingManuscripts + stats.pendingRequests}</div><div class="s">${stats.pendingManuscripts} manuscripts · ${stats.pendingRequests} requests</div></div>
    </div>
    <div class="grid-2">
      <section class="panel"><div class="panel-head"><h3>Loans · last 7 days</h3></div>
        <div class="bars">${stats.loansLast7Days.map((d) => `<div class="bar"><div class="col" style="height:${(d.count / max) * 100}%"><b>${d.count}</b></div><span>${new Date(d.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' })}</span></div>`).join('')}</div>
      </section>
      <section class="panel"><div class="panel-head"><h3>Most borrowed</h3></div>
        ${stats.topBooks.length ? stats.topBooks.map((b) => `<div class="hbar"><span>${esc(b.title)}</span><b>${b.loans}</b><div class="track"><span style="width:${(b.loans / topMax) * 100}%"></span></div></div>`).join('') : emptyState('📊', 'No loans yet')}
      </section>
    </div>`;
  }

  if (libTab === 'manuscripts') {
    body.innerHTML = `<section class="panel"><div class="panel-head"><h3>Manuscript submissions</h3></div>
      ${manuscripts.length ? manuscripts.map((m) => `
        <div class="decision-card">${cover({ ...m, author: m.submitted_by_name }, 'thumb')}
          <div class="grow"><b>${esc(m.title)}</b><span class="muted" style="font-size:12.5px">by ${esc(m.submitted_by_name)} · ${esc(m.genre)} · ${m.pages} pages · ${timeAgo(m.created_at)}</span>
            ${m.description ? `<span style="font-size:13px;color:var(--text-2)">${esc(m.description)}</span>` : ''}
            <div class="controls">${statusPill(m.status)}
            ${m.status === 'PENDING' ? `
              <label class="muted" style="font-size:12px">Copies <input class="input" type="number" min="1" max="100" value="3" style="width:64px" data-copies="${m.id}"></label>
              <input class="input" placeholder="Note (optional)" data-note="${m.id}" style="width:180px">
              <button class="btn sm success" data-ms="${m.id}" data-d="APPROVED">${icon('check')} Approve</button>
              <button class="btn sm danger" data-ms="${m.id}" data-d="REJECTED">${icon('x')} Reject</button>` : m.review_note ? `<span class="muted" style="font-size:12px">${esc(m.review_note)}</span>` : ''}
            </div></div></div>`).join('') : emptyState('✒️', 'No submissions')}
    </section>`;
    body.onclick = async (e) => {
      const b = e.target.closest('[data-ms]'); if (!b) return;
      const id = b.dataset.ms;
      try {
        await busy(b, () => api('POST', `/api/admin/manuscripts/${id}/decision`, {
          decision: b.dataset.d, copies: Number($(`[data-copies="${id}"]`, body).value), note: $(`[data-note="${id}"]`, body).value,
        }));
        toast(b.dataset.d === 'APPROVED' ? 'Approved — now visible in the catalog' : 'Manuscript rejected', b.dataset.d === 'APPROVED' ? 'success' : 'info'); render();
      } catch (err) { errToast(err); }
    };
  }

  if (libTab === 'requests') {
    body.innerHTML = `<section class="panel"><div class="panel-head"><h3>Reader requests</h3></div>
      ${requests.length ? requests.map((r) => `
        <div class="decision-card">${avatar(r.username)}
          <div class="grow"><b>${esc(r.title)}</b><span class="muted" style="font-size:12.5px">${esc(r.author || 'Unknown author')} · requested by ${esc(r.username)} · ${timeAgo(r.created_at)}</span>
            ${r.reason ? `<span style="font-size:13px;color:var(--text-2)">“${esc(r.reason)}”</span>` : ''}
            <div class="controls">${statusPill(r.status)}
            ${r.status === 'PENDING' ? `<input class="input" placeholder="Note to reader (optional)" data-rnote="${r.id}" style="width:220px">
              <button class="btn sm success" data-rq="${r.id}" data-d="APPROVED">${icon('check')} Approve</button>
              <button class="btn sm danger" data-rq="${r.id}" data-d="REJECTED">${icon('x')} Reject</button>` : r.librarian_note ? `<span class="muted" style="font-size:12px">${esc(r.librarian_note)}</span>` : ''}
            </div></div></div>`).join('') : emptyState('📝', 'No requests')}
    </section>`;
    body.onclick = async (e) => {
      const b = e.target.closest('[data-rq]'); if (!b) return;
      try {
        await busy(b, () => api('POST', `/api/admin/requests/${b.dataset.rq}/resolve`, { decision: b.dataset.d, note: $(`[data-rnote="${b.dataset.rq}"]`, body).value }));
        toast(`Request ${b.dataset.d.toLowerCase()} — reader notified`); render();
      } catch (err) { errToast(err); }
    };
  }

  if (libTab === 'users') {
    body.innerHTML = `<section class="panel"><div class="panel-head"><h3>Members</h3>
      <label class="search" style="max-width:320px;height:38px">${icon('search')}<input id="uq" placeholder="Search username or email"></label></div><div id="ul"></div></section>`;
    const load = async () => {
      const { users } = await api('GET', `/api/admin/users?q=${encodeURIComponent($('#uq', body).value)}`);
      $('#ul', body).innerHTML = users.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Active loans</th><th>Joined</th></tr></thead><tbody>
        ${users.map((u) => `<tr><td><span style="display:inline-flex;gap:10px;align-items:center">${avatar(u.username)}<b>${esc(u.username)}</b></span></td><td class="muted">${esc(u.email)}</td><td><span class="pill ${u.role === 'LIBRARIAN' ? 'accent' : u.role === 'AUTHOR' ? 'warn' : 'info'}">${u.role}</span></td><td>${u.active_loans}</td><td class="muted">${fmtDate(u.created_at)}</td></tr>`).join('')}
        </tbody></table></div>` : emptyState('👤', 'No matching members');
    };
    $('#uq', body).addEventListener('input', debounce(load));
    await load();
  }

  if (libTab === 'catalog') {
    const { books } = await api('GET', '/api/books');
    body.innerHTML = `<div class="grid-side">
      <section class="panel"><div class="panel-head"><h3>Add a book</h3></div>
        <form id="add-book" novalidate>
          <div class="field"><label>Title *</label><input class="input" name="title" maxlength="200"></div>
          <div class="field"><label>Author *</label><input class="input" name="author" maxlength="120"></div>
          <div class="form-row"><div class="field"><label>Genre</label><input class="input" name="genre" maxlength="40"></div>
          <div class="field"><label>Copies *</label><input class="input" name="copies" type="number" min="1" max="100" value="2"></div></div>
          <div class="field"><label>Year</label><input class="input" name="year" type="number"></div>
          <button class="btn primary block" type="submit">${icon('plus')} Add to catalog</button>
        </form></section>
      <section class="panel"><div class="panel-head"><h3>Catalog · ${books.length} titles</h3></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Book</th><th>Genre</th><th>Copies</th><th></th></tr></thead><tbody>
        ${books.map((b) => `<tr><td><b>${esc(b.title)}</b><div class="muted" style="font-size:12px">${esc(b.author)}</div></td><td>${esc(b.genre)}</td><td>${b.available_copies}/${b.total_copies}</td>
          <td style="text-align:right"><button class="btn sm ghost" data-del-book="${b.id}" title="Remove">${icon('trash')}</button></td></tr>`).join('')}
        </tbody></table></div></section></div>`;
    $('#add-book', body).onsubmit = async (e) => {
      e.preventDefault();
      const d = formData(e.target); d.copies = Number(d.copies);
      try { await api('POST', '/api/admin/books', d); toast(`Added “${d.title}”`); render(); } catch (err) { errToast(err); }
    };
    body.onclick = async (e) => {
      const b = e.target.closest('[data-del-book]'); if (!b) return;
      try { await api('DELETE', `/api/admin/books/${b.dataset.delBook}`); toast('Book removed', 'info'); render(); } catch (err) { errToast(err); }
    };
  }
}

// ---------------------------------------------------------------- QA lab
async function viewQA(el) {
  const R = state.qa;
  const sectionsCovered = [...new Set(TEST_CASES.map((t) => t.section))];
  el.innerHTML = `
  <section class="panel qa-hero">
    <div>
      <p class="eyebrow">STQA · Live test execution</p>
      <h2 class="display">QA Lab</h2>
      <p class="muted">${TEST_CASES.length} test cases selected from all ${sectionsCovered.length} sections of the STQA test document. Each one calls this server's real REST API, creates its own throwaway users and data, and cleans up afterwards. The <b>Actual Result</b> and <b>Status</b> columns are filled in from what the server returns.</p>
      <div class="actions" style="margin-top:16px">
        <button class="btn primary" id="run-all">${icon('play')} Run all ${TEST_CASES.length}</button>
        <button class="btn" id="export">${icon('download')} Export CSV</button>
        <button class="btn ghost" id="reset">Reset</button>
      </div>
      <div class="section-cov">${sectionsCovered.map((s) => `<span class="pill plain" title="${esc(SECTIONS[s])}">§${s} ${esc(SECTIONS[s].split(/[ ,/&]/)[0])}</span>`).join('')}</div>
      <div class="progress"><span id="prog"></span></div>
    </div>
    <div>
      <div class="ring" id="ring"></div>
      <div class="qa-legend"><span><i style="background:var(--ok)"></i><b id="n-pass">0</b> pass</span><span><i style="background:var(--danger)"></i><b id="n-fail">0</b> fail</span></div>
    </div>
  </section>
  <section class="panel" style="padding:6px 6px 0">
    <div class="table-wrap"><table class="table qa-table">
      <thead><tr><th>TC ID</th><th>Test Scenario</th><th>Test Data</th><th>Expected Result</th><th>Actual Result</th><th>Status</th><th></th></tr></thead>
      <tbody>${TEST_CASES.map((t) => `<tr id="row-${t.id}"><td class="id">${t.id}</td>
        <td><b>${esc(t.scenario)}</b><div class="sec">§${t.section} ${esc(SECTIONS[t.section])}</div></td>
        <td class="muted">${esc(t.data)}</td><td>${esc(t.expected)}</td>
        <td class="actual" data-actual></td><td class="status-cell" data-status></td>
        <td><button class="btn sm ghost" data-run="${t.id}" title="Run ${t.id}" aria-label="Run ${t.id}">${icon('play')}</button></td></tr>`).join('')}</tbody>
    </table></div>
  </section>`;

  const paintRow = (id) => {
    const row = $(`#row-${id}`, el); if (!row) return;
    const r = R[id];
    row.className = r?.status || '';
    $('[data-actual]', row).textContent = r?.actual || '—';
    $('[data-status]', row).innerHTML = !r ? '<span class="pill plain">Not run</span>'
      : r.status === 'RUNNING' ? '<span class="pill accent"><span class="spinner sm"></span> Running</span>'
      : `<span class="pill ${r.status === 'PASS' ? 'ok' : 'danger'}">${r.status}</span> <span class="muted" style="font-size:11px">${r.ms}ms</span>`;
  };
  const paintSummary = () => {
    const vals = Object.values(R);
    const pass = vals.filter((r) => r.status === 'PASS').length, fail = vals.filter((r) => r.status === 'FAIL').length;
    const done = pass + fail, total = TEST_CASES.length;
    const C = 2 * Math.PI * 62;
    const pArc = (pass / total) * C, fArc = (fail / total) * C;
    $('#ring', el).innerHTML = `<svg width="150" height="150" viewBox="0 0 150 150">
      <circle cx="75" cy="75" r="62" fill="none" stroke="var(--surface-2)" stroke-width="12"/>
      <circle cx="75" cy="75" r="62" fill="none" stroke="var(--ok)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${pArc} ${C}" style="transition:stroke-dasharray .4s"/>
      <circle cx="75" cy="75" r="62" fill="none" stroke="var(--danger)" stroke-width="12" stroke-dasharray="${fArc} ${C}" stroke-dashoffset="${-pArc}"/>
    </svg><div class="lbl"><div><b>${done ? Math.round((pass / done) * 100) : 0}%</b><span>${done}/${total} run</span></div></div>`;
    $('#n-pass', el).textContent = pass; $('#n-fail', el).textContent = fail;
    $('#prog', el).style.width = `${(done / total) * 100}%`;
  };
  const runOne = async (tc) => {
    R[tc.id] = { status: 'RUNNING' }; paintRow(tc.id);
    R[tc.id] = await runCase(tc, '');
    paintRow(tc.id); paintSummary();
  };
  TEST_CASES.forEach((t) => paintRow(t.id)); paintSummary();

  $('#run-all', el).onclick = (e) => busy(e.currentTarget, async () => {
    for (const k of Object.keys(R)) delete R[k];
    TEST_CASES.forEach((t) => paintRow(t.id)); paintSummary();
    for (const tc of TEST_CASES) { if (!el.isConnected) return; await runOne(tc); }
    const pass = Object.values(R).filter((r) => r.status === 'PASS').length;
    toast(`${pass}/${TEST_CASES.length} test cases passed`, pass === TEST_CASES.length ? 'success' : 'error');
    refreshUnread();
  });
  el.querySelector('.qa-table').onclick = (e) => {
    const b = e.target.closest('[data-run]'); if (!b) return;
    busy(b, () => runOne(TEST_CASES.find((t) => t.id === b.dataset.run)));
  };
  $('#reset', el).onclick = () => { for (const k of Object.keys(R)) delete R[k]; TEST_CASES.forEach((t) => paintRow(t.id)); paintSummary(); };
  $('#export', el).onclick = () => {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['TC ID', 'Section', 'Test Scenario', 'Test Data', 'Expected Result', 'Actual Result', 'Status', 'Duration (ms)'],
      ...TEST_CASES.map((t) => [t.id, `${t.section}. ${SECTIONS[t.section]}`, t.scenario, t.data, t.expected, R[t.id]?.actual || '', R[t.id]?.status || 'NOT RUN', R[t.id]?.ms ?? ''])];
    const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `STQA_Results_${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };
}

render();
