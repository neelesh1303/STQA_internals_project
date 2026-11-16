// Authentication helpers: HS256 JWT, scrypt password hashing, auth + role middleware.
import crypto from 'node:crypto';

const SECRET = process.env.JWT_SECRET || 'athenaeum-dev-secret-change-in-production';
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

const b64url = (input) => Buffer.from(input).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function signToken(user, ttl = TOKEN_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ sub: user.id, username: user.username, role: user.role, iat: now, exp: now + ttl }));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [header, payload, signature] = parts;
  let head;
  try { head = JSON.parse(Buffer.from(header, 'base64url').toString()); } catch { throw new Error('malformed token'); }
  if (head.alg !== 'HS256') throw new Error('unsupported algorithm');
  const expected = Buffer.from(sign(`${header}.${payload}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw new Error('invalid signature');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (!claims.exp || claims.exp < Date.now() / 1000) throw new Error('token expired');
  return claims;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Verifies the bearer token and loads the CURRENT user from the database (role is never trusted from the token alone). */
export function authenticate(db) {
  const findUser = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?');
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required: missing bearer token' });
    try {
      const claims = verifyToken(header.slice(7).trim());
      const user = findUser.get(claims.sub);
      if (!user) throw new Error('user no longer exists');
      req.user = { ...user };
      next();
    } catch (e) {
      res.status(401).json({ error: `Invalid or expired token (${e.message})` });
    }
  };
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: `Access denied: requires role ${roles.join(' or ')}` });
