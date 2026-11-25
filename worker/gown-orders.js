// Cloudflare Worker: creates an Autobooks invoice for a wedding gown order and returns the pay link.
// Secrets (set in Cloudflare, never in this file): AUTOBOOKS_CLIENT_ID, AUTOBOOKS_API_KEY
const API = 'https://app.autobooks.co/platform/v1';
const UA = 'CustomCleaners-GownOrders/1.0';
const ORIGINS = ['https://customcleanersbaytown.com', 'https://www.customcleanersbaytown.com'];

// Prices in cents. The browser sends only choices; prices are decided here.
const PACKAGES = {
  'Clean Only - $260': ['Wedding Gown Cleaning Only', 26000],
  'Clean Only + Preservation - $360': ['Wedding Gown Clean Only + Preservation Kit', 36000],
  'Traditional Cleaning + Preservation - $360': ['Traditional Wedding Gown Preservation Kit', 36000],
  'Celebrity Cleaning + Preservation - $435': ['Celebrity Wedding Gown Preservation Kit', 43500],
  'Restoration - $460': ['Wedding Gown Restoration Kit', 46000],
  'Flower Girl / Christening - $175': ['Flower Girl / Christening Gown Preservation Kit', 17500],
};
const DECLARED = {
  'Included with package': 0,
  '$1,000 higher (+$50)': 5000,
  '$2,000 higher (+$100)': 10000,
  '$3,000 higher (+$150)': 15000,
};
const ADDONS = ['Silk flowers', 'Shoes', 'Slip', 'Accessories box', 'Gown overlay', 'Detachable skirt', 'Photo documentation'];
const TAX_RATE = 8.25; // percent, applied to taxable lines (kits and add-ons)
const HANDOFF = ['Option 1: Mail me the kit', 'Option 2: I will drop off my gown at the store'];

function cors(req) {
  const o = req.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
function json(req, obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, cors(req)) });
}
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

async function api(env, token, method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: Object.assign({ 'User-Agent': UA, 'Authorization': 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch (e) {}
  if (!r.ok) { console.log('Autobooks error', method, path, r.status, text.slice(0, 500)); throw new Error('autobooks ' + r.status); }
  return data;
}
async function getToken(env) {
  const r = await fetch(API + '/token', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.AUTOBOOKS_CLIENT_ID, client_secret: env.AUTOBOOKS_API_KEY }),
  });
  if (!r.ok) { console.log('token error', r.status); throw new Error('token ' + r.status); }
  return (await r.json()).access_token;
}

export function buildOrder(d) {
  const pkg = PACKAGES[d.package];
  if (!pkg) throw new Error('bad package');
  if (!(d.declared in DECLARED)) throw new Error('bad declared value');
  const items = [{ product: { name: pkg[0], price: pkg[1] }, quantity: 1, taxable: true }];
  if (DECLARED[d.declared]) items.push({ product: { name: 'Higher declared value (' + d.declared.split(' (')[0] + ')', price: DECLARED[d.declared] }, quantity: 1, taxable: false });
  const adds = Array.isArray(d.addons) ? d.addons.filter(a => ADDONS.includes(a)) : [];
  adds.forEach(a => items.push({ product: { name: 'Add-on: ' + a, price: 5000 }, quantity: 1, taxable: true }));
  const subtotal = items.reduce((s, i) => s + i.product.price, 0);
  return { items, subtotal, packageName: pkg[0] };
}

export default {
  async fetch(req, env) {
    if (new URL(req.url).pathname === '/track') {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
      if (req.method !== 'POST' || !ORIGINS.includes(req.headers.get('Origin'))) return json(req, { error: 'bad' }, 403);
      let t;
      try { t = await req.json(); } catch (e) { return json(req, { error: 'json' }, 400); }
      const sn = String(t.serial || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 20);
      if (sn.length < 4) return json(req, { error: 'serial' }, 400);
      try {
        const r = await fetch('https://www.gownpreservation.com/gown-status-2/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA }, body: 'OrderNumber=' + encodeURIComponent(sn) });
        const h = await r.text();
        const i = h.indexOf('<div id="gown-status-results">');
        if (i < 0) return json(req, { error: 'none' }, 502);
        let depth = 0, j = h.length;
        const re = /<\/?div\b[^>]*>/g;
        re.lastIndex = i;
        let x;
        while ((x = re.exec(h))) { depth += x[0][1] === '/' ? -1 : 1; if (depth === 0) { j = re.lastIndex; break; } }
        return json(req, { html: h.slice(i, j).slice(0, 20000) });
      } catch (e) { return json(req, { error: 'track' }, 502); }
    }
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
    if (!ORIGINS.includes(req.headers.get('Origin'))) return json(req, { error: 'origin' }, 403);
    let d;
    try { d = await req.json(); } catch (e) { return json(req, { error: 'json' }, 400); }
    if (d.website) return json(req, { error: 'spam' }, 400); // honeypot
    const first = clean(d.first, 50), last = clean(d.last, 50), email = clean(d.email, 120), phone = clean(d.phone, 30);
    if (!first || !last || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !phone) return json(req, { error: 'missing details' }, 400);
    if (!HANDOFF.includes(d.handoff)) return json(req, { error: 'handoff' }, 400);
    let order;
    try { order = buildOrder(d); } catch (e) { return json(req, { error: e.message }, 400); }
    const orderNumber = 'G' + Date.now().toString(36).toUpperCase().slice(-6);
    const fmt = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const nice = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
    const orderDate = fmt('America/Chicago'), dueDate = fmt('America/New_York');
    const digits = phone.replace(/\D/g, '');
    const phoneFmt = digits.length === 10 ? '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6) : phone;
    const stZip = [clean(d.state, 30), clean(d.zip, 12)].filter(Boolean).join(' ');
    const address = [clean(d.street, 80), clean(d.street2, 40), clean(d.city, 40), stZip].filter(Boolean).join(', ') || 'Not provided';
    const memo = 'Order #: ' + orderNumber + '\n' + (d.handoff === HANDOFF[0] ? 'Option 1 - mail kit to customer' : 'Option 2 - customer drops off gown at our store');
    try {
      const token = await getToken(env);
      const body = { customer: { email, name: first + ' ' + last }, lineItems: order.items, taxRate: TAX_RATE, memo };
      let inv;
      try { inv = await api(env, token, 'POST', '/invoices', Object.assign({ dueAt: dueDate + 'T00:00:00Z' }, body)); }
      catch (e) { inv = await api(env, token, 'POST', '/invoices', body); }
      await api(env, token, 'POST', '/invoices/' + inv.id + '/send', {});
      let paymentUrl = null, total = null;
      for (let i = 0; i < 8 && !paymentUrl; i++) {
        if (i) await new Promise(r => setTimeout(r, 800));
        const cur = await api(env, token, 'GET', '/invoices/' + inv.id);
        paymentUrl = cur.paymentUrl || null;
        if (cur.total != null) total = cur.total;
      }
      return json(req, { ok: true, orderNumber, invoiceId: inv.id, paymentUrl, subtotal: order.subtotal, total });
    } catch (e) {
      console.log('order failed', e.message);
      return json(req, { error: 'invoice' }, 502);
    }
  },
};
