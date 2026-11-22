import { cleanPersonal, emailPattern, needsRetention, newEvent, normalizeEmail, performAction, publicStatus, RequestError, workspace } from './event.js';
import { demoRoles, demonstration } from './demo.js';

const hour = 3600000;
const live = 'live';
const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
  } });
}
async function digest(value) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function cookies(request, name) {
  return (request.headers.get('Cookie') || '').split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(name + '='))?.slice(name.length + 1);
}
function cookie(request, token, seconds) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `swap_session=${token}; Path=/; Max-Age=${seconds}; HttpOnly; SameSite=Strict${secure}`;
}
async function auth(db, request) {
  const token = cookies(request, 'swap_session') ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const hash = await digest(token);
  return db.prepare('SELECT space, identity FROM sessions WHERE token_hash=? AND expires_at>?').bind(hash, Date.now()).first();
}
async function createSession(db, request, space, identity) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const hash = await digest(token);
  const lifetime = space === live ? (identity === '@organizer' ? 8 : 24) * hour : 4 * hour;
  const create = db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').bind(hash, space, identity, Date.now() + lifetime);
  const previous = cookies(request, 'swap_session') ?? '';
  if (/^[a-f0-9]{64}$/.test(previous)) {
    await db.batch([create, db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(previous))]);
  } else {
    await create.run();
  }
  return { 'Set-Cookie': cookie(request, token, lifetime / 1000) };
}
async function load(db, id) {
  const row = await db.prepare('SELECT data, version FROM event_state WHERE id=? AND (expires_at IS NULL OR expires_at > ?)').bind(id, Date.now()).first();
  if (row) return { event: JSON.parse(row.data), version: row.version };
  if (id !== live) throw new RequestError('This demo has expired. Start a new walkthrough.', 401);
  const event = newEvent();
  await db.prepare('INSERT OR IGNORE INTO event_state (id, data) VALUES (?, ?)').bind(live, JSON.stringify(event)).run();
  return load(db, id);
}
async function mutate(db, space, callback) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { event, version } = await load(db, space);
    const result = callback(event);
    const serialized = JSON.stringify(event);
    if (encoder.encode(serialized).length > 1750000) throw new RequestError('This event has reached its storage capacity. Contact the organizers.', 409);
    const updated = await db.prepare('UPDATE event_state SET data=?, version=version+1 WHERE id=? AND version=?')
      .bind(serialized, space, version).run();
    if (updated.meta.changes === 1) return result;
  }
  throw new RequestError('Someone else just made a change. Please try again.', 409);
}
async function body(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('Send a JSON object.');
  let count = 0;
  const decoder = new TextDecoder();
  let raw = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    count += value.length;
    if (count > 68000) {
      await reader.cancel();
      throw new RequestError('This request is too large.', 413);
    }
    raw += decoder.decode(value, { stream: true });
  }
  try {
    const data = JSON.parse(raw + decoder.decode());
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  } catch { /* Use the same error for invalid JSON and non-object input. */ }
  throw new RequestError('Send a JSON object.');
}
async function limit(db, request, name, max, duration) {
  const timestamp = Date.now();
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const key = await digest(name + ':' + ip);
  const row = await db.prepare(`INSERT INTO rate_buckets(key,count,expires_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count`)
    .bind(key, timestamp + duration, timestamp, timestamp).first();
  if (row.count > max) throw new RequestError('Too many attempts. Please try again later.', 429);
}
function emailOf(data) {
  const email = normalizeEmail(data.email);
  if (!emailPattern.test(email)) throw new RequestError('Enter a valid email address.');
  return email;
}
function localCodes(env) {
  return env.LOCAL_AUTH_CODES === '1';
}
async function requestCode(db, request, env, data) {
  if (!localCodes(env) && !(env.RESEND_API_KEY && env.MAIL_FROM)) throw new RequestError('Email sign-in has not been configured. Explore the interactive demo in the meantime.', 503);
  await limit(db, request, 'email', 18, hour);
  const email = emailOf(data);
  const timestamp = Date.now();
  const code = String(10000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000000));
  const hash = await digest((env.RESEND_API_KEY || env.ADMIN_KEY || 'local-only') + ':' + email + ':' + code);
  const row = await db.prepare(`INSERT INTO email_codes VALUES (?,?,?,?,0) ON CONFLICT(email) DO UPDATE
    SET code_hash=excluded.code_hash, created_at=excluded.created_at, expires_at=excluded.expires_at, attempts=0
    WHERE email_codes.created_at < ? RETURNING email`).bind(email, hash, timestamp, timestamp + 10 * 60000, timestamp - 60000).first();
  if (!row) throw new RequestError('Wait a minute before requesting another code.', 429);
  if (localCodes(env)) return json({ ok: true, code });
  try {
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [email], subject: 'Your Swap Hack sign-in code',
        text: `Your Swap Hack code is ${code}. It expires in ten minutes and can be used once. If you did not request it, you can ignore this message.` }),
    });
    if (!sent.ok) throw new Error('Mail provider returned ' + sent.status);
  } catch (error) {
    await db.prepare('DELETE FROM email_codes WHERE email=? AND code_hash=?').bind(email, hash).run();
    console.error('Swap Hack sign-in email failed:', error.message);
    throw new RequestError('The code could not be sent. Please try again.', 502);
  }
  return json({ ok: true });
}
async function confirmCode(db, request, env, data) {
  await limit(db, request, 'confirm', 40, hour);
  const email = emailOf(data);
  const code = typeof data.code === 'string' ? data.code.trim() : '';
  if (!/^\d{8}$/.test(code)) throw new RequestError('Enter the eight-digit code.');
  const hash = await digest((env.RESEND_API_KEY || env.ADMIN_KEY || 'local-only') + ':' + email + ':' + code);
  const [deleted] = await db.batch([
    db.prepare('DELETE FROM email_codes WHERE email=? AND code_hash=? AND expires_at>? AND attempts<5 RETURNING email').bind(email, hash, Date.now()),
    db.prepare('UPDATE email_codes SET attempts=attempts+1 WHERE email=? AND attempts<5').bind(email),
  ]);
  if (!deleted.results.length) throw new RequestError('That code is invalid, expired or used. Request a new code.', 401);
  return json({ ok: true }, 200, await createSession(db, request, live, email));
}
async function receipt(env, email, id, event) {
  if (localCodes(env) || !env.RESEND_API_KEY || !env.MAIL_FROM) return;
  const { terms, privacy, contact } = event.settings;
  try {
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [email], subject: 'Swap Hack received your problem',
        text: `Your reference is ${id}. Keep this email for your records. For event questions, contact ${contact}.\n\nTerms accepted\n${terms}\n\nPrivacy notice\n${privacy}` }),
    });
    if (!sent.ok) console.error('Swap Hack receipt could not be sent:', sent.status);
  } catch { console.error('Swap Hack receipt could not be sent.'); }
}

async function api(request, env, ctx, path) {
  const db = env.DB;
  if (request.method === 'GET' && path === '/api/status') return json(publicStatus((await load(db, live)).event));
  if (request.method === 'GET' && path === '/api/results') {
    const showDemo = new URL(request.url).searchParams.has('demo');
    const session = showDemo ? await auth(db, request) : null;
    const space = session?.space ?? live;
    const results = (await load(db, space)).event.published;
    return json(results ? { ...results, demo: space !== live } : null);
  }
  if (request.method === 'GET' && path.startsWith('/api/certificates/')) {
    const id = path.slice('/api/certificates/'.length).toUpperCase();
    if (id === 'DEMO-SWAP-26') return json({ id, kind: 'Builder', name: 'Avni Desai', date: '', demo: true });
    if (!/^SWAP-[A-F0-9]{18}$/.test(id)) throw new RequestError('No certificate matches that ID.', 404);
    const session = await auth(db, request);
    const { event } = await load(db, live);
    const liveCert = event.certificates.find((record) => record.id === id);
    const demoCert = !liveCert && session?.space && session.space !== live ?
      (await load(db, session.space)).event.certificates.find((record) => record.id === id) : null;
    const cert = liveCert ?? demoCert;
    if (!cert) throw new RequestError('No certificate matches that ID.', 404);
    const { kind, name, date } = cert;
    return json({ id, kind, name, date, demo: Boolean(demoCert) });
  }
  if (request.method === 'GET' && path === '/api/workspace') {
    const session = await auth(db, request);
    if (!session) throw new RequestError('Sign in to open your workspace.', 401);
    return json(workspace((await load(db, session.space)).event, session.identity, session.space !== live));
  }
  if (request.method !== 'POST') throw new RequestError('Route not found.', 404);
  const origin = request.headers.get('Origin');
  const host = new URL(request.url).host;
  if (!request.headers.get('Content-Type')?.startsWith('application/json') || (origin && new URL(origin).host !== host)) {
    throw new RequestError('Send this request from the Swap Hack website.', 403);
  }
  const data = await body(request);
  if (path === '/api/sign-in/request') return requestCode(db, request, env, data);
  if (path === '/api/sign-in/confirm') return confirmCode(db, request, env, data);
  if (path === '/api/admin/sign-in') {
    await limit(db, request, 'organizer', 12, hour);
    const key = typeof data.key === 'string' ? data.key : '';
    const expected = env.ADMIN_KEY;
    if (!expected || key.length > 500 || !crypto.subtle.timingSafeEqual(encoder.encode(await digest(key)), encoder.encode(await digest(expected)))) {
      throw new RequestError('The organizer key did not match.', 401);
    }
    return json({ ok: true }, 200, await createSession(db, request, live, '@organizer'));
  }
  if (path === '/api/sign-out') {
    const token = cookies(request, 'swap_session');
    if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) });
  }
  const session = await auth(db, request);
  if (path === '/api/demo') {
    const identity = Object.hasOwn(demoRoles, data.role) ? demoRoles[data.role] : '';
    if (!identity) throw new RequestError('Choose a demo role.');
    await limit(db, request, 'demo', 90, hour);
    let space = session?.space;
    if (!space || space === live) {
      space = 'demo-' + crypto.randomUUID();
      const initial = demonstration();
      if (data.start === 'registration') initial.settings.phase = 'registration';
      await db.prepare('INSERT INTO event_state (id,data,expires_at) VALUES (?,?,?)')
        .bind(space, JSON.stringify(initial), Date.now() + 4 * hour).run();
    }
    if (session?.space === space && data.start === 'registration') {
      await mutate(db, space, (event) => { event.settings.phase = 'registration'; event.published = null; });
    }
    return json({ ok: true }, 200, await createSession(db, request, space, identity));
  }
  if (path === '/api/action') {
    if (!session) throw new RequestError('Sign in before continuing.', 401);
    const demo = session.space !== live;
    if (typeof data.action !== 'string' || !data.payload || typeof data.payload !== 'object') throw new RequestError('Choose a valid workspace action.');
    const { result, event } = await mutate(db, session.space, (current) => {
      if (!demo && data.action === 'settings' && data.payload.phase !== 'draft' && !localCodes(env) && !(env.RESEND_API_KEY && env.MAIL_FROM)) {
        throw new RequestError('Configure the email provider before opening registration.');
      }
      const result = performAction(current, session.identity, data.action, data.payload, demo);
      return { result, event: current };
    });
    if (!demo && data.action === 'register' && result?.id) ctx.waitUntil(receipt(env, session.identity, result.id, event));
    return json({ ok: true, ...result });
  }
  throw new RequestError('Route not found.', 404);
}
export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await api(request, env, ctx, pathname);
    } catch (error) {
      if (error instanceof RequestError) return json({ error: error.message }, error.status);
      console.error('Swap Hack request failed:', error.message);
      return json({ error: 'The event service is temporarily unavailable. Please try again.' }, 500);
    }
  },
  async scheduled(_event, env) {
    const db = env.DB;
    const now = Date.now();
    await db.batch([
      db.prepare('DELETE FROM event_state WHERE expires_at<=?').bind(now),
      db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now),
      db.prepare('DELETE FROM rate_buckets WHERE expires_at<=?').bind(now),
      db.prepare('DELETE FROM email_codes WHERE expires_at<=?').bind(now),
    ]);
    if (needsRetention((await load(db, live)).event)) {
      await mutate(db, live, (event) => {
        if (needsRetention(event)) cleanPersonal(event);
      });
    }
  },
};
