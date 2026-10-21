require('dotenv').config();
const express = require('express'), mongoose = require('mongoose'), bcrypt = require('bcryptjs'),
  jwt = require('jsonwebtoken'), helmet = require('helmet'), cors = require('cors'),
  rateLimit = require('express-rate-limit'), crypto = require('crypto'), path = require('path');
const compression = require('compression');
const { OAuth2Client } = require('google-auth-library');
const { MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, PORT = 3000 } = process.env;
if (!MONGODB_URI || !JWT_SECRET) { console.error('Missing MONGODB_URI or JWT_SECRET'); process.exit(1); }

// ---------- Models ----------
// All collections use the ai_ prefix so other projects sharing this MongoDB database are never read, listed or edited.
const User = mongoose.model('User', new mongoose.Schema({
  email: { type: String, unique: true, lowercase: true, trim: true }, name: String, hash: String, googleId: String,
  role: { type: String, default: 'user' }, plan: { type: String, default: 'free' }, planUntil: Date,
  banned: { type: Boolean, default: false }, saveHistory: { type: Boolean, default: false }, day: String, count: { type: Number, default: 0 },
  total: { type: Number, default: 0 }, lastAt: { type: Date, default: 0 },
}, { timestamps: true, collection: 'ai_users' }));
User.schema.index({ plan: 1, planUntil: 1 });
const Setting = mongoose.model('Setting', new mongoose.Schema({ _id: String, v: mongoose.Schema.Types.Mixed }, { collection: 'ai_settings' }));
const Code = mongoose.model('Code', new mongoose.Schema({
  code: { type: String, unique: true }, days: Number, plan: { type: String, default: 'pro' },
  maxUses: { type: Number, default: 1 }, uses: { type: Number, default: 0 },
}, { timestamps: true, collection: 'ai_codes' }));

const Order = mongoose.model('Order', new mongoose.Schema({
  orderId: { type: String, unique: true }, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, email: String,
  planId: String, planName: String, amount: Number, days: Number, status: { type: String, default: 'pending' }, paidAt: Date,
}, { timestamps: true, collection: 'ai_orders' }));

const Chat = mongoose.model('Chat', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, role: String, content: String, createdAt: { type: Date, default: Date.now },
}, { collection: 'ai_chats' }));
Chat.schema.index({ user: 1, createdAt: -1 });
Chat.schema.index({ createdAt: 1 });

// ---------- Settings (all editable from the admin portal) ----------
const DEF = {
  app: { name: 'TAKNA Assist', maintenance: false, announcement: '', googleClientId: '', selfPing: true, pingMin: 10 },
  ai: { provider: 'anthropic', model: 'claude-sonnet-5-5', apiKey: '', baseUrl: '', system: 'You are a friendly voice assistant. Keep replies short, 1 to 3 sentences, no markdown.' },
  limits: { free: { daily: 20, cooldown: 5 }, pro: { daily: 500, cooldown: 1 } },
  ads: { enabled: true, items: [] },
  history: { enabled: true, retentionDays: 7, maxPerUser: 100, maxChars: 2000 },
  update: { latestVersion: '1.0.0', minVersion: '1.0.0', url: '', changelog: '', force: false, releasedAt: '' },
  pay: { enabled: false, baseUrl: 'https://www.taknapay.in', createPath: '', statusPath: '', apiKey: '', secret: '', authHeader: 'Authorization', authScheme: 'Bearer',
    sigHeader: 'x-signature', payUrlField: 'payment_url', orderField: 'order_id', statusField: 'status', currency: 'INR',
    plans: [{ id: 'pro30', name: 'Pro 30 days', price: 99, days: 30 }, { id: 'pro365', name: 'Pro 1 year', price: 799, days: 365 }] },
};
const SECRETS = { ai: ['apiKey'], pay: ['apiKey', 'secret'] };
const cache = new Map(); // settings cache (30s) to cut database reads
const getS = async k => {
  const c = cache.get(k); if (c && c.t > Date.now()) return c.v;
  const v = { ...DEF[k], ...((await Setting.findById(k).lean())?.v || {}) };
  cache.set(k, { v, t: Date.now() + 30000 }); return v;
};

// ---------- Helpers ----------
const A = f => (q, r, n) => Promise.resolve(f(q, r, n)).catch(e => r.status(500).json({ error: e.message }));
const today = () => new Date().toISOString().slice(0, 10);
const planOf = u => (u.plan !== 'free' && u.planUntil && u.planUntil > new Date() ? u.plan : 'free');
const pub = u => ({ id: u._id, email: u.email, name: u.name, role: u.role, plan: planOf(u), planUntil: u.planUntil, banned: u.banned, saveHistory: u.saveHistory, count: u.count, total: u.total, createdAt: u.createdAt });
const sign = u => jwt.sign({ id: u._id }, JWT_SECRET, { expiresIn: '30d' });
const auth = role => async (q, r, n) => {
  try {
    const p = jwt.verify((q.headers.authorization || '').slice(7), JWT_SECRET);
    const u = await User.findById(p.id);
    if (!u || u.banned) return r.status(403).json({ error: 'Account unavailable' });
    if (role && u.role !== role) return r.status(403).json({ error: 'Admin only' });
    q.user = u; n();
  } catch (e) { r.status(401).json({ error: 'Login required' }); }
};

// ---------- Self-ping (keeps the Render free instance awake) ----------
const ping = { at: null, ok: null, ms: null, note: '' };
async function doPing() {
  const url = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL;
  if (!url) { ping.note = 'Set PUBLIC_URL (Render sets RENDER_EXTERNAL_URL automatically)'; return ping; }
  const t = Date.now();
  try { ping.ok = (await fetch(url.replace(/\/$/, '') + '/healthz', { signal: AbortSignal.timeout(20000) })).ok; } catch (e) { ping.ok = false; }
  ping.at = new Date(); ping.ms = Date.now() - t; ping.note = '';
  return ping;
}
async function pingLoop() {
  let min = 10;
  try { const a = await getS('app'); min = Math.min(14, Math.max(1, +a.pingMin || 10)); if (a.selfPing !== false) await doPing(); } catch (e) {}
  setTimeout(pingLoop, min * 60000);
}

// ---------- AI providers (key comes from admin portal) ----------
async function callAI(ai, msgs) {
  const key = ai.apiKey || process.env.AI_API_KEY;
  if (!key) throw new Error('AI key not set. Admin: add it in "AI & Keys".');
  let r, j;
  if (ai.provider === 'anthropic') {
    r = await fetch((ai.baseUrl || 'https://api.anthropic.com') + '/v1/messages', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: ai.model, max_tokens: 500, system: ai.system, messages: msgs }) });
    j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'AI error');
    return j.content.map(c => c.text || '').join('');
  }
  if (ai.provider === 'gemini') {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ai.model}:generateContent?key=${key}`, { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: ai.system }] },
        contents: msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) }) });
    j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'AI error');
    return (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  }
  r = await fetch((ai.baseUrl || 'https://api.openai.com/v1') + '/chat/completions', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
    body: JSON.stringify({ model: ai.model, messages: [{ role: 'system', content: ai.system }, ...msgs] }) });
  j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'AI error');
  return j.choices?.[0]?.message?.content || '';
}

// ---------- Payments (TAKNAPAY, fully configurable from admin) ----------
const PAID = /^(success|succeeded|paid|completed|captured)$/i;
const pubUrl = () => (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
const gwHeaders = p => { const h = { 'content-type': 'application/json' }; if (p.apiKey) h[p.authHeader || 'Authorization'] = (p.authScheme ? p.authScheme + ' ' : '') + p.apiKey; return h; };
async function gwStatus(p, id) {
  if (!p.statusPath) return null;
  const r = await fetch(p.baseUrl.replace(/\/$/, '') + p.statusPath.replace('{id}', encodeURIComponent(id)), { headers: gwHeaders(p), signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  return PAID.test(String(j[p.statusField] ?? j.data?.[p.statusField] ?? ''));
}
async function activate(o) { // atomic, safe against duplicate webhooks
  if (!(await Order.findOneAndUpdate({ _id: o._id, status: { $ne: 'paid' } }, { status: 'paid', paidAt: new Date() }))) return;
  const u = await User.findById(o.user); if (!u) return;
  const base = planOf(u) !== 'free' && u.planUntil > new Date() ? u.planUntil : new Date();
  u.plan = 'pro'; u.planUntil = new Date(base.getTime() + o.days * 864e5); await u.save();
}
const vcmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; } return 0; };

// ---------- Chat history (opt-in, capped, auto-expiring) ----------
async function saveChat(u, ask, answer) {
  const h = await getS('history'); if (!h.enabled) return;
  const cut = x => String(x).slice(0, h.maxChars);
  await Chat.insertMany([{ user: u._id, role: 'user', content: cut(ask) }, { user: u._id, role: 'assistant', content: cut(answer), createdAt: new Date(Date.now() + 1) }]);
  const extra = await Chat.find({ user: u._id }).sort('-createdAt').skip(h.maxPerUser).select('_id').lean();
  if (extra.length) await Chat.deleteMany({ _id: { $in: extra.map(x => x._id) } });
}
async function purgeHistory() {
  const h = await getS('history');
  return (await Chat.deleteMany({ createdAt: { $lt: new Date(Date.now() - Math.min(7, h.retentionDays) * 864e5) } })).deletedCount;
}

// ---------- App ----------
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }), cors(), compression(), express.json({ limit: '100kb', verify: (q, r, b) => { q.rawBody = b; } }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600 }));
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', setHeaders: (res, f) => { if (f.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.get('/healthz', (q, r) => r.send('ok'));
app.get('/admin', (q, r) => r.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Public config: name, announcement, maintenance flag, Google client id, active ads
app.get('/api/config', A(async (q, r) => {
  const [a, ads] = await Promise.all([getS('app'), getS('ads')]);
  r.json({ name: a.name, maintenance: a.maintenance, announcement: a.announcement,
    googleClientId: a.googleClientId || process.env.GOOGLE_CLIENT_ID || '',
    ads: ads.enabled ? ads.items.filter(x => x.active) : [] }); // client shows ads only when user.plan === 'free'
}));

// Auth: email + password, and Google
app.post('/api/auth/register', authLimit, A(async (q, r) => {
  const { email, password, name } = q.body || {};
  if (!/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 6) return r.status(400).json({ error: 'Valid email and password (6+ characters) required' });
  if (await User.findOne({ email: email.toLowerCase() })) return r.status(409).json({ error: 'Email already registered' });
  const u = await User.create({ email, name: name || email.split('@')[0], hash: await bcrypt.hash(password, 10) });
  r.json({ token: sign(u), user: pub(u) });
}));
app.post('/api/auth/login', authLimit, A(async (q, r) => {
  const { email, password } = q.body || {};
  const u = await User.findOne({ email: String(email || '').toLowerCase() });
  if (!u || !u.hash || !(await bcrypt.compare(String(password || ''), u.hash))) return r.status(401).json({ error: 'Wrong email or password' });
  if (u.banned) return r.status(403).json({ error: 'Account banned' });
  r.json({ token: sign(u), user: pub(u) });
}));
app.post('/api/auth/google', authLimit, A(async (q, r) => {
  const cid = (await getS('app')).googleClientId || process.env.GOOGLE_CLIENT_ID;
  if (!cid) return r.status(400).json({ error: 'Google login not configured' });
  const t = await new OAuth2Client(cid).verifyIdToken({ idToken: q.body.credential, audience: cid });
  const p = t.getPayload();
  if (!p.email_verified) return r.status(400).json({ error: 'Google email not verified' });
  let u = await User.findOne({ email: p.email.toLowerCase() });
  if (!u) u = await User.create({ email: p.email, name: p.name, googleId: p.sub });
  else if (!u.googleId) { u.googleId = p.sub; await u.save(); }
  if (u.banned) return r.status(403).json({ error: 'Account banned' });
  r.json({ token: sign(u), user: pub(u) });
}));

// App update check: GET /api/update?v=1.0.0
app.get('/api/update', A(async (q, r) => {
  const u = await getS('update'), v = String(q.query.v || '0.0.0');
  r.json({ updateAvailable: vcmp(u.latestVersion, v) > 0, force: !!u.force || vcmp(u.minVersion, v) > 0, latest: u.latestVersion, url: u.url, changelog: u.changelog, releasedAt: u.releasedAt });
}));

// Payments
app.get('/api/plans', A(async (q, r) => { const p = await getS('pay'); r.json({ enabled: p.enabled, currency: p.currency, plans: p.plans }); }));
app.post('/api/pay/create', auth(), A(async (q, r) => {
  const p = await getS('pay');
  if (!p.enabled) return r.status(400).json({ error: 'Payments are turned off' });
  if (!p.createPath || !p.apiKey) return r.status(400).json({ error: 'Gateway not configured by admin' });
  const plan = p.plans.find(x => x.id === q.body.planId); if (!plan) return r.status(400).json({ error: 'Unknown plan' });
  const o = await Order.create({ orderId: 'TK' + Date.now() + crypto.randomBytes(3).toString('hex').toUpperCase(), user: q.user._id, email: q.user.email, planId: plan.id, planName: plan.name, amount: plan.price, days: plan.days });
  const body = { [p.orderField]: o.orderId, amount: plan.price, currency: p.currency, customer_email: q.user.email, customer_name: q.user.name, description: plan.name,
    webhook_url: pubUrl() + '/api/pay/webhook', return_url: /^https?:\/\//.test(q.body.returnUrl || '') ? q.body.returnUrl : pubUrl() };
  const gr = await fetch(p.baseUrl.replace(/\/$/, '') + p.createPath, { method: 'POST', headers: gwHeaders(p), body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const j = await gr.json().catch(() => ({})), url = j[p.payUrlField] || j.data?.[p.payUrlField];
  if (!gr.ok || !url) { o.status = 'failed'; await o.save(); return r.status(502).json({ error: j.message || j.error || 'Gateway error' }); }
  r.json({ orderId: o.orderId, payUrl: url });
}));
app.post('/api/pay/webhook', A(async (q, r) => {
  const p = await getS('pay');
  if (p.secret) {
    const sig = String(q.headers[(p.sigHeader || 'x-signature').toLowerCase()] || '').replace(/^sha256=/, '');
    const exp = crypto.createHmac('sha256', p.secret).update(q.rawBody || '').digest('hex');
    if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return r.status(401).json({ error: 'Bad signature' });
  } else if (!p.statusPath) return r.status(400).json({ error: 'Set a webhook secret or status path first' });
  const b = q.body || {}, id = b[p.orderField] ?? b.data?.[p.orderField], st = String(b[p.statusField] ?? b.data?.[p.statusField] ?? '');
  const o = await Order.findOne({ orderId: String(id) }); if (!o) return r.status(404).json({ error: 'Order not found' });
  if (PAID.test(st)) { if (p.statusPath && !(await gwStatus(p, o.orderId))) return r.status(400).json({ error: 'Not confirmed by gateway' }); await activate(o); }
  else if (/^(failed|cancelled|canceled|expired)$/i.test(st) && o.status === 'pending') { o.status = 'failed'; await o.save(); }
  r.json({ ok: true });
}));
app.get('/api/pay/status/:id', auth(), A(async (q, r) => {
  const o = await Order.findOne({ orderId: q.params.id, user: q.user._id }); if (!o) return r.status(404).json({ error: 'Not found' });
  if (o.status === 'pending') { const p = await getS('pay'); if (await gwStatus(p, o.orderId).catch(() => false)) await activate(o); }
  r.json({ status: (await Order.findById(o._id)).status });
}));

// Chat history (user opt-in)
app.get('/api/history', auth(), A(async (q, r) => {
  const l = Math.min(200, +q.query.limit || 50);
  const m = (await Chat.find({ user: q.user._id }).sort('-createdAt').limit(l).lean()).reverse();
  r.json({ enabled: (await getS('history')).enabled, saveHistory: q.user.saveHistory, messages: m.map(x => ({ role: x.role, content: x.content, at: x.createdAt })) });
}));
app.put('/api/history/consent', auth(), A(async (q, r) => { q.user.saveHistory = !!q.body.on; await q.user.save(); r.json({ saveHistory: q.user.saveHistory }); }));
app.delete('/api/history', auth(), A(async (q, r) => r.json({ deleted: (await Chat.deleteMany({ user: q.user._id })).deletedCount })));

app.get('/api/me', auth(), A(async (q, r) => {
  const lim = await getS('limits'), plan = planOf(q.user);
  r.json({ user: pub(q.user), limits: lim[plan] || lim.free, usedToday: q.user.day === today() ? q.user.count : 0 });
}));

// Chat with cool-down + daily limit, per plan
app.post('/api/chat', auth(), A(async (q, r) => {
  const [a, ai, lim] = await Promise.all([getS('app'), getS('ai'), getS('limits')]);
  const u = q.user;
  if (a.maintenance && u.role !== 'admin') return r.status(503).json({ error: 'Down for maintenance. Please try later.' });
  const L = lim[planOf(u)] || lim.free, now = Date.now();
  if (u.day !== today()) { u.day = today(); u.count = 0; }
  const wait = Math.ceil((L.cooldown * 1000 - (now - u.lastAt)) / 1000);
  if (wait > 0) return r.status(429).json({ error: `Cool down: wait ${wait}s`, wait });
  if (u.count >= L.daily) return r.status(429).json({ error: `Daily limit (${L.daily}) reached. Upgrade to Pro for more.`, upgrade: true });
  const msgs = (q.body.messages || []).slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 4000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return r.status(400).json({ error: 'messages must end with a user message' });
  let text;
  try { text = await callAI(ai, msgs); } catch (e) { return r.status(502).json({ error: e.message }); }
  u.count++; u.total++; u.lastAt = new Date(now); await u.save();
  if (u.saveHistory) saveChat(u, msgs[msgs.length - 1].content, text).catch(() => {});
  r.json({ text, remaining: L.daily - u.count });
}));

// Subscription via redeem code (admin creates codes)
app.post('/api/redeem', auth(), A(async (q, r) => {
  const c = await Code.findOne({ code: String(q.body.code || '').trim().toUpperCase() });
  if (!c || c.uses >= c.maxUses) return r.status(400).json({ error: 'Invalid or used code' });
  const u = q.user, base = planOf(u) !== 'free' && u.planUntil > new Date() ? u.planUntil : new Date();
  u.plan = c.plan; u.planUntil = new Date(base.getTime() + c.days * 864e5); c.uses++;
  await Promise.all([u.save(), c.save()]);
  r.json({ user: pub(u) });
}));

// ---------- Admin API ----------
const adm = express.Router(); adm.use(auth('admin'));
adm.get('/stats', A(async (q, r) => {
  const [users, pro, banned, tot, td] = await Promise.all([
    User.countDocuments(), User.countDocuments({ plan: { $ne: 'free' }, planUntil: { $gt: new Date() } }), User.countDocuments({ banned: true }),
    User.aggregate([{ $group: { _id: null, n: { $sum: '$total' } } }]),
    User.aggregate([{ $match: { day: today() } }, { $group: { _id: null, n: { $sum: '$count' } } }])]);
  r.json({ users, pro, banned, messagesTotal: tot[0]?.n || 0, messagesToday: td[0]?.n || 0, ping,
    revenue: (await Order.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, n: { $sum: '$amount' } } }]))[0]?.n || 0 });
}));
adm.post('/ping', A(async (q, r) => r.json(await doPing())));
adm.get('/orders', A(async (q, r) => r.json(await Order.find().sort('-createdAt').limit(100))));
adm.post('/orders/:id/paid', A(async (q, r) => { const o = await Order.findById(q.params.id); if (!o) return r.status(404).json({ error: 'Not found' }); await activate(o); r.json({ ok: true }); }));
adm.get('/system', A(async (q, r) => {
  const t = Date.now(); await mongoose.connection.db.admin().ping(); const m = process.memoryUsage();
  let st = null; try { const d = await mongoose.connection.db.stats(); st = Math.round((d.storageSize + d.indexSize) / 1048576); } catch (e) {}
  r.json({ uptimeMin: Math.round(process.uptime() / 60), rssMB: Math.round(m.rss / 1048576), heapMB: Math.round(m.heapUsed / 1048576), node: process.version, dbMs: Date.now() - t, cacheKeys: cache.size, chats: await Chat.estimatedDocumentCount(), storageMB: st });
}));
adm.post('/optimize/:task', A(async (q, r) => {
  const t = q.params.task, ago = d => new Date(Date.now() - d * 864e5); let n = 0;
  if (t === 'cache') { n = cache.size; cache.clear(); }
  else if (t === 'expired') n = (await User.updateMany({ plan: { $ne: 'free' }, planUntil: { $lt: new Date() } }, { plan: 'free', planUntil: null })).modifiedCount;
  else if (t === 'codes') n = (await Code.deleteMany({ $expr: { $gte: ['$uses', '$maxUses'] } })).deletedCount;
  else if (t === 'orders') n = (await Order.deleteMany({ status: { $ne: 'paid' }, createdAt: { $lt: ago(7) } })).deletedCount;
  else if (t === 'inactive') n = (await User.deleteMany({ role: 'user', plan: 'free', total: 0, createdAt: { $lt: ago(Math.max(30, +q.body.days || 180)) } })).deletedCount;
  else if (t === 'history') n = await purgeHistory();
  else return r.status(404).json({ error: 'Unknown task' });
  r.json({ done: n });
}));
adm.get('/users', A(async (q, r) => {
  const s = String(q.query.q || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  r.json((await User.find(s ? { email: new RegExp(s, 'i') } : {}).sort('-createdAt').limit(100)).map(pub));
}));
adm.patch('/users/:id', A(async (q, r) => {
  const u = await User.findById(q.params.id), b = q.body || {};
  if (!u) return r.status(404).json({ error: 'Not found' });
  if (u.id === q.user.id && (b.banned || b.role === 'user')) return r.status(400).json({ error: 'You cannot lock yourself out' });
  for (const k of ['name', 'role', 'plan', 'banned']) if (k in b) u[k] = b[k];
  if ('planUntil' in b) u.planUntil = b.planUntil ? new Date(b.planUntil) : null;
  if (b.resetUsage) u.count = 0;
  if (b.newPassword) u.hash = await bcrypt.hash(String(b.newPassword), 10);
  await u.save(); r.json(pub(u));
}));
adm.delete('/users/:id', A(async (q, r) => {
  if (q.params.id === q.user.id) return r.status(400).json({ error: 'Cannot delete yourself' });
  await Promise.all([User.findByIdAndDelete(q.params.id), Chat.deleteMany({ user: q.params.id })]); r.json({ ok: true });
}));
adm.get('/settings', A(async (q, r) => {
  const o = {}; for (const k of Object.keys(DEF)) o[k] = structuredClone(await getS(k));
  for (const k in SECRETS) for (const f of SECRETS[k]) if (o[k][f]) o[k][f] = '••••' + o[k][f].slice(-4);
  r.json(o);
}));
adm.put('/settings/:k', A(async (q, r) => {
  const k = q.params.k; if (!DEF[k]) return r.status(404).json({ error: 'Unknown setting' });
  const v = q.body || {};
  if (SECRETS[k]) { const old = await getS(k); for (const f of SECRETS[k]) if (!v[f] || String(v[f]).startsWith('••')) v[f] = old[f]; }
  if (k === 'history') { v.enabled = !!v.enabled; v.retentionDays = Math.min(7, Math.max(1, +v.retentionDays || 7)); v.maxPerUser = Math.max(10, +v.maxPerUser || 100); v.maxChars = Math.max(200, +v.maxChars || 2000); }
  if (k === 'pay') v.plans = (v.plans || []).map(x => ({ id: x.id || 'p' + Math.random().toString(36).slice(2, 8), name: String(x.name || 'Plan'), price: +x.price || 0, days: Math.max(1, +x.days || 30) }));
  if (k === 'limits') for (const p of ['free', 'pro']) v[p] = { daily: Math.max(0, +v[p]?.daily || 0), cooldown: Math.max(0, +v[p]?.cooldown || 0) };
  await Setting.findByIdAndUpdate(k, { v }, { upsert: true }); cache.delete(k); r.json({ ok: true });
}));
adm.get('/codes', A(async (q, r) => r.json(await Code.find().sort('-createdAt').limit(200))));
adm.post('/codes', A(async (q, r) => {
  const b = q.body || {};
  r.json(await Code.create({ code: (b.code || crypto.randomBytes(4).toString('hex')).toUpperCase(), days: Math.max(1, +b.days || 30), maxUses: Math.max(1, +b.maxUses || 1) }));
}));
adm.delete('/codes/:id', A(async (q, r) => { await Code.findByIdAndDelete(q.params.id); r.json({ ok: true }); }));
app.use('/api/admin', adm);

// ---------- Start ----------
mongoose.connect(MONGODB_URI, process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {}).then(async () => {
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const u = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (!u) await User.create({ email: ADMIN_EMAIL, name: 'Admin', role: 'admin', hash: await bcrypt.hash(ADMIN_PASSWORD, 10) });
    else if (u.role !== 'admin') { u.role = 'admin'; await u.save(); }
  }
  app.listen(PORT, () => console.log('TAKNA backend on ' + PORT));
  setTimeout(pingLoop, 30000);
  setTimeout(() => purgeHistory().catch(() => {}), 60000);
  setInterval(() => purgeHistory().catch(() => {}), 6 * 3600 * 1000);
}).catch(e => { console.error('DB error:', e.message); process.exit(1); });
