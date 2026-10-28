import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import nodemailer from 'nodemailer';
import { databaseConfigured, pool } from './db.js';
import { addressPartsFromRow, formatColombianAddress, normalizeAddressParts } from '../shared/colombianAddress.js';

const scrypt = promisify(scryptCallback);
const appOrigin = (process.env.APP_ORIGIN || 'http://127.0.0.1:5173').replace(/\/$/, '');
const redirectBase = (process.env.OAUTH_REDIRECT_BASE || `${appOrigin}/api/auth`).replace(/\/$/, '');
const oauthStates = new Map();
const oauthTickets = new Map();
const loginAttempts = new Map();
const resetAttempts = new Map();
const sessionCookieName = 'hf_portal_session_v2';
const legacySessionCookieName = 'hf_portal_session';
const sessionDurationMs = 12 * 60 * 60 * 1000;
const resetWindowMs = 15 * 60 * 1000;
const resetLimit = 5;
const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && (process.env.SMTP_FROM || process.env.SMTP_USER));
const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || '';
const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || '';
const turnstileConfigured = Boolean(turnstileSiteKey && turnstileSecret);
const passwordResetConfigured = databaseConfigured && smtpConfigured && turnstileConfigured;
const mailer = smtpConfigured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
}) : null;
const providers = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    jwks: createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')),
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    jwks: createRemoteJWKSet(new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys')),
  },
};

const sendJson = (response, status, body, headers = {}) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(JSON.stringify(body));
};

const readJson = (request) => new Promise((resolve, reject) => {
  let raw = '';
  request.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 12000) {
      reject(new Error('Request body too large'));
      request.destroy();
    }
  });
  request.on('end', () => {
    try {
      resolve(JSON.parse(raw));
    } catch {
      reject(new Error('Invalid JSON'));
    }
  });
  request.on('error', reject);
});

const configured = (provider) => Boolean(providers[provider]?.clientId && providers[provider]?.clientSecret);
const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
const callbackUri = (provider) => `${redirectBase}/${provider}/callback`;
const cookieName = (provider) => `hf_oauth_${provider}`;
const cookieValue = (request, name) => {
  const items = (request.headers.cookie || '').split(';').map((entry) => entry.trim()).filter((entry) => entry.startsWith(`${name}=`));
  const item = items.at(-1);
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
};
const cookieHeader = (provider, value, maxAge) => `${cookieName(provider)}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
const secureCookie = process.env.NODE_ENV === 'production' ? '; Secure' : '';
const expiredSessionCookie = (name, path = '/api/auth') => `${name}=; HttpOnly; SameSite=Lax; Path=${path}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureCookie}`;
const sessionCookies = (value) => [
  `${sessionCookieName}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/${secureCookie}`,
  expiredSessionCookie(sessionCookieName, '/api/auth'),
];
const issueSession = async (userId) => {
  const token = randomToken(32);
  const tokenHash = resetTokenHash(token);
  await pool.execute(
    'INSERT INTO app_session (ID_USUARIO, TOKEN_HASH, EXPIRES_AT) VALUES (?, ?, DATE_ADD(NOW(3), INTERVAL 12 HOUR))',
    [Number(userId), tokenHash],
  );
  return token;
};
const activeSession = async (request) => {
  const token = cookieValue(request, sessionCookieName);
  if (!token) return null;
  const tokenHash = resetTokenHash(token);
  const [rows] = await pool.execute(
    'SELECT ID_SESSION, ID_USUARIO FROM app_session WHERE TOKEN_HASH = ? AND EXPIRES_AT > NOW(3) LIMIT 1',
    [tokenHash],
  );
  return rows[0] ? { token, tokenHash, sessionId: Number(rows[0].ID_SESSION), userId: Number(rows[0].ID_USUARIO) } : null;
};
const frontendRedirect = (query) => `${appOrigin}/login?${new URLSearchParams(query)}`;
const roleName = (value) => ({ paciente: 'patient', medico: 'doctor', secretaria: 'secretary', administrador: 'admin' })[String(value || '').toLowerCase()] || 'patient';
const displayName = (row) => [row.NOMBRE_1, row.NOMBRE_2, row.APELLIDO_1, row.APELLIDO_2].filter(Boolean).join(' ').trim();
const dateOnly = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
const publicUser = (row) => ({
  id: `PAT-DB-${row.ID_USUARIO}`,
  databaseId: Number(row.ID_USUARIO),
  role: roleName(row.ROL),
  username: row.USUARIO_LOGIN,
  document: row.NUMERO_DOCUMENTO,
  typeId: row.TIPO_DOCUMENTO,
  firstName: row.NOMBRE_1 || '',
  middleName: row.NOMBRE_2 || '',
  lastName: row.APELLIDO_1 || '',
  secondLastName: row.APELLIDO_2 || '',
  name: displayName(row),
  email: row.EMAIL,
  phone: row.TELEFONO || '',
  address: row.DIRECCION || '',
  addressParts: addressPartsFromRow(row),
  birthDate: dateOnly(row.FECHA_NACIMIENTO),
  eps: row.EPS || '',
  status: row.ESTADO,
});

export async function getAuthenticatedUser(request) {
  if (!databaseConfigured) return null;
  const session = await activeSession(request);
  if (!session) return null;
  const [rows] = await pool.execute(
    `SELECT u.ID_USUARIO, u.TIPO_DOCUMENTO, u.NUMERO_DOCUMENTO, u.NOMBRE_1, u.NOMBRE_2,
      u.APELLIDO_1, u.APELLIDO_2, u.EMAIL, u.USUARIO_LOGIN, u.TELEFONO, u.DIRECCION,
      u.DIRECCION_TIPO_VIA, u.DIRECCION_NUMERO_VIA, u.DIRECCION_LETRA_VIA, u.DIRECCION_BIS,
      u.DIRECCION_CUADRANTE_VIA, u.DIRECCION_NUMERO_CRUCE, u.DIRECCION_LETRA_CRUCE,
      u.DIRECCION_CUADRANTE_CRUCE, u.DIRECCION_NUMERO_PLACA, u.DIRECCION_COMPLEMENTO,
      u.BARRIO, u.MUNICIPIO, u.DEPARTAMENTO, u.FECHA_NACIMIENTO, p.EPS, u.ESTADO, r.NOMBRE AS ROL
     FROM usuario u JOIN rol r ON r.ID_ROL = u.ID_ROL
     LEFT JOIN paciente p ON p.ID_USUARIO = u.ID_USUARIO
     WHERE u.ID_USUARIO = ? AND u.ESTADO = 'activo' LIMIT 1`,
    [session.userId],
  );
  return rows[0] ? publicUser(rows[0]) : null;
}

const passwordHash = async (password) => {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${Buffer.from(hash).toString('base64url')}`;
};

const resetTokenHash = (token) => createHash('sha256').update(token).digest('hex');
const resetLimited = (request, email) => {
  const now = Date.now();
  for (const [key, attempt] of resetAttempts) if (now - attempt.startedAt >= resetWindowMs) resetAttempts.delete(key);
  const ip = request.socket.remoteAddress || 'unknown';
  const keys = [`ip:${ip}`, `email:${resetTokenHash(email)}`];
  let blocked = false;
  for (const key of keys) {
    const attempt = resetAttempts.get(key) || { startedAt: now, count: 0 };
    if (now - attempt.startedAt >= resetWindowMs) {
      attempt.startedAt = now;
      attempt.count = 0;
    }
    attempt.count += 1;
    resetAttempts.set(key, attempt);
    if (attempt.count > resetLimit) blocked = true;
  }
  return blocked;
};

const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${appOrigin}/login?reset_token=${encodeURIComponent(token)}`;
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Restablece tu contraseña | Hospital Francisco de Asís',
    text: `Recibimos una solicitud para cambiar la contraseña de tu cuenta. Abre este enlace dentro de los próximos 15 minutos: ${resetUrl}\n\nSi no solicitaste este cambio, ignora este mensaje.`,
    html: `<div style="font-family:Arial,sans-serif;color:#17304b;max-width:560px;margin:auto;padding:28px"><h1 style="font-size:22px">Restablece tu contraseña</h1><p>Recibimos una solicitud para cambiar la contraseña de tu cuenta del Hospital Francisco de Asís.</p><p>Este enlace vence en 15 minutos y solo puede usarse una vez.</p><p style="margin:28px 0"><a href="${resetUrl}" style="background:#123b67;color:#fff;padding:13px 20px;text-decoration:none;border-radius:6px">Crear nueva contraseña</a></p><p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p></div>`,
  });
};

const passwordMatches = async (password, encoded) => {
  const [scheme, saltText, hashText] = String(encoded || '').split('$');
  if (scheme !== 'scrypt' || !saltText || !hashText) return false;
  try {
    const expected = Buffer.from(hashText, 'base64url');
    const actual = Buffer.from(await scrypt(password, Buffer.from(saltText, 'base64url'), expected.length));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
};

const cleanExpired = () => {
  const now = Date.now();
  for (const [key, item] of oauthStates) if (item.expiresAt <= now) oauthStates.delete(key);
  for (const [key, item] of oauthTickets) if (item.expiresAt <= now) oauthTickets.delete(key);
  for (const [key, item] of loginAttempts) {
    if (now - item.startedAt > 10 * 60 * 1000) loginAttempts.delete(key);
  }
  void now;
};

const limited = (request) => {
  cleanExpired();
  const key = request.socket.remoteAddress || 'unknown';
  const current = loginAttempts.get(key) || { startedAt: Date.now(), count: 0 };
  if (Date.now() - current.startedAt > 10 * 60 * 1000) {
    current.startedAt = Date.now();
    current.count = 0;
  }
  current.count += 1;
  loginAttempts.set(key, current);
  return current.count > 20;
};

const fetchWithTimeout = (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) });

const verifyTurnstile = async (token, request) => {
  if (!turnstileConfigured || !token) return false;
  const body = new URLSearchParams({ secret: turnstileSecret, response: token });
  if (request.socket.remoteAddress) body.set('remoteip', request.socket.remoteAddress);
  const response = await fetchWithTimeout('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return false;
  const result = await response.json();
  const expectedHostname = new URL(appOrigin).hostname;
  return result.success === true && result.action === 'password_reset' && result.hostname === expectedHostname;
};

async function verifyIdentity(provider, token, expectedNonce) {
  const clientId = providers[provider].clientId;
  const { payload } = await jwtVerify(token, providers[provider].jwks, {
    audience: clientId,
    ...(provider === 'google' ? { issuer: ['https://accounts.google.com', 'accounts.google.com'] } : {}),
  });

  if (payload.nonce !== expectedNonce || !payload.sub) throw new Error('Invalid identity assertion');
  if (provider === 'microsoft') {
    const tenant = String(payload.tid || '');
    if (!/^[0-9a-f-]{36}$/i.test(tenant) || payload.iss !== `https://login.microsoftonline.com/${tenant}/v2.0`) {
      throw new Error('Invalid identity issuer');
    }
  }
  if (provider === 'google' && payload.email_verified !== true) throw new Error('Unverified provider email');

  const email = String(payload.email || payload.preferred_username || '').trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Provider did not return an email');
  const parts = String(payload.name || email.split('@')[0]).trim().split(/\s+/);
  return {
    subject: String(payload.sub),
    email,
    firstName: String(payload.given_name || parts.shift() || 'Usuario').slice(0, 60),
    lastName: String(payload.family_name || parts.join(' ') || 'Paciente').slice(0, 60),
    fullName: String(payload.name || `${payload.given_name || ''} ${payload.family_name || ''}`.trim() || email).slice(0, 240),
  };
}

const getLinkedUser = async (provider, subject) => {
  const [rows] = await pool.execute(
    `SELECT u.ID_USUARIO, u.TIPO_DOCUMENTO, u.NUMERO_DOCUMENTO, u.NOMBRE_1, u.NOMBRE_2,
      u.APELLIDO_1, u.APELLIDO_2, u.EMAIL, u.USUARIO_LOGIN, u.TELEFONO, u.DIRECCION,
      u.DIRECCION_TIPO_VIA, u.DIRECCION_NUMERO_VIA, u.DIRECCION_LETRA_VIA, u.DIRECCION_BIS,
      u.DIRECCION_CUADRANTE_VIA, u.DIRECCION_NUMERO_CRUCE, u.DIRECCION_LETRA_CRUCE,
      u.DIRECCION_CUADRANTE_CRUCE, u.DIRECCION_NUMERO_PLACA, u.DIRECCION_COMPLEMENTO,
      u.BARRIO, u.MUNICIPIO, u.DEPARTAMENTO, u.FECHA_NACIMIENTO, p.EPS, u.ESTADO, r.NOMBRE AS ROL
     FROM identidad_proveedor i
     JOIN usuario u ON u.ID_USUARIO = i.ID_USUARIO
     LEFT JOIN paciente p ON p.ID_USUARIO = u.ID_USUARIO
     JOIN rol r ON r.ID_ROL = u.ID_ROL
     WHERE i.PROVEEDOR = ? AND i.ID_SUBJECT = ? LIMIT 1`,
    [provider, subject],
  );
  return rows[0] || null;
};

const lookupLogin = async (identifier) => {
  const [rows] = await pool.execute(
    `SELECT u.ID_USUARIO, u.TIPO_DOCUMENTO, u.NUMERO_DOCUMENTO, u.NOMBRE_1, u.NOMBRE_2,
      u.APELLIDO_1, u.APELLIDO_2, u.EMAIL, u.USUARIO_LOGIN, u.TELEFONO, u.DIRECCION,
      u.DIRECCION_TIPO_VIA, u.DIRECCION_NUMERO_VIA, u.DIRECCION_LETRA_VIA, u.DIRECCION_BIS,
      u.DIRECCION_CUADRANTE_VIA, u.DIRECCION_NUMERO_CRUCE, u.DIRECCION_LETRA_CRUCE,
      u.DIRECCION_CUADRANTE_CRUCE, u.DIRECCION_NUMERO_PLACA, u.DIRECCION_COMPLEMENTO,
      u.BARRIO, u.MUNICIPIO, u.DEPARTAMENTO, u.FECHA_NACIMIENTO, p.EPS, u.ESTADO,
      u.PASSWORD_HASH, r.NOMBRE AS ROL
     FROM usuario u LEFT JOIN paciente p ON p.ID_USUARIO = u.ID_USUARIO
     JOIN rol r ON r.ID_ROL = u.ID_ROL
     WHERE (LOWER(u.USUARIO_LOGIN) = ? OR LOWER(u.NUMERO_DOCUMENTO) = ? OR LOWER(u.EMAIL) = ?)
     LIMIT 1`,
    [identifier, identifier, identifier],
  );
  return rows[0] || null;
};

const normalizeText = (value, maxLength) => String(value || '').trim().slice(0, maxLength);
const validDocument = (value) => /^[\p{L}\p{N}.-]{5,30}$/u.test(value);
const validPhone = (value) => /^\+?[0-9\s().-]{7,24}$/.test(value) && value.replace(/\D/g, '').length >= 7;
const validUsername = (value) => /^[a-zA-Z0-9._-]{3,32}$/.test(value);
const googleUsernameBase = (email) => {
  const localPart = String(email || '').split('@')[0] || '';
  const normalized = localPart.toLowerCase().replace(/[^a-z0-9._-]/g, '_').replace(/^[._-]+|[._-]+$/g, '').slice(0, 32);
  return (normalized || 'usuario').padEnd(3, '_').slice(0, 32);
};
const availableGoogleUsername = async (email, executor = pool) => {
  const base = googleUsernameBase(email);
  for (let suffix = 0; suffix < 10000; suffix += 1) {
    const ending = suffix === 0 ? '' : String(suffix + 1);
    const candidate = `${base.slice(0, 32 - ending.length)}${ending}`;
    const [rows] = await executor.execute('SELECT ID_USUARIO FROM usuario WHERE LOWER(USUARIO_LOGIN) = ? LIMIT 1', [candidate]);
    if (!rows.length) return candidate;
  }
  throw new Error('No se pudo asignar un usuario único.');
};

export async function handleAuthRequest(request, response, url) {
  const path = url.pathname.replace(/\/$/, '');
  if (!path.startsWith('/api/auth')) return false;

  if (path === '/api/auth/providers' && request.method === 'GET') {
    sendJson(response, 200, {
      google: configured('google'),
      microsoft: configured('microsoft'),
      credentials: databaseConfigured,
      databaseConfigured,
      passwordReset: passwordResetConfigured,
      smtpConfigured,
      captchaConfigured: turnstileConfigured,
      turnstileSiteKey: turnstileConfigured ? turnstileSiteKey : '',
    });
    return true;
  }

  if (path === '/api/auth/session' && request.method === 'GET') {
    try {
      const legacyToken = cookieValue(request, legacySessionCookieName);
      if (databaseConfigured && legacyToken) {
        await pool.execute('DELETE FROM app_session WHERE TOKEN_HASH = ?', [resetTokenHash(legacyToken)]);
      }
      const session = databaseConfigured ? await activeSession(request) : null;
      const user = await getAuthenticatedUser(request);
      const cookies = [expiredSessionCookie(legacySessionCookieName), expiredSessionCookie(sessionCookieName)];
      if (session && user) {
        const replacementToken = await issueSession(session.userId);
        await pool.execute('DELETE FROM app_session WHERE ID_SESSION = ?', [session.sessionId]);
        cookies.push(...sessionCookies(replacementToken));
      }
      sendJson(response, 200, { user }, { 'Set-Cookie': cookies });
    } catch (error) {
      console.error('Session lookup failed:', error.code || error.name || 'SessionError');
      sendJson(response, 503, { error: 'No se pudo validar la sesión en MySQL.' });
    }
    return true;
  }

  if (path === '/api/auth/logout' && request.method === 'POST') {
    const session = databaseConfigured ? await activeSession(request) : null;
    if (session) await pool.execute('DELETE FROM app_session WHERE ID_SESSION = ?', [session.sessionId]);
    const legacyToken = cookieValue(request, legacySessionCookieName);
    if (databaseConfigured && legacyToken) {
      await pool.execute('DELETE FROM app_session WHERE TOKEN_HASH = ?', [resetTokenHash(legacyToken)]);
    }
    sendJson(response, 200, { ok: true }, {
      'Set-Cookie': [expiredSessionCookie(sessionCookieName, '/'), expiredSessionCookie(sessionCookieName, '/api/auth'), expiredSessionCookie(legacySessionCookieName)],
    });
    return true;
  }

  if (!databaseConfigured) {
    sendJson(response, 503, { error: 'La autenticación de cuentas requiere una conexión MySQL configurada.' });
    return true;
  }

  if (path === '/api/auth/profile' && request.method === 'PATCH') {
    const session = await activeSession(request);
    if (!session) {
      sendJson(response, 401, { error: 'La sesión venció. Inicia sesión nuevamente.' });
      return true;
    }
    let connection;
    try {
      const body = await readJson(request);
      const firstName = normalizeText(body.firstName, 60);
      const middleName = normalizeText(body.middleName, 60);
      const lastName = normalizeText(body.lastName, 60);
      const secondLastName = normalizeText(body.secondLastName, 60);
      const email = normalizeText(body.email, 254).toLowerCase();
      const phone = normalizeText(body.phone, 30);
      const birthDate = normalizeText(body.birthDate, 10);
      const eps = normalizeText(body.eps, 120);
      const validName = (value) => /^[\p{L}][\p{L}\p{M} .'-]{0,59}$/u.test(value);
      const validDate = !birthDate || (/^\d{4}-\d{2}-\d{2}$/.test(birthDate)
        && !Number.isNaN(Date.parse(`${birthDate}T00:00:00Z`))
        && new Date(`${birthDate}T00:00:00Z`).toISOString().slice(0, 10) === birthDate
        && birthDate <= new Date().toISOString().slice(0, 10));
      if (!validName(firstName) || !validName(lastName)
        || (middleName && !validName(middleName)) || (secondLastName && !validName(secondLastName))
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validDate || (phone && !validPhone(phone))) {
        sendJson(response, 400, { error: 'Revisa nombres, correo, teléfono y fecha de nacimiento.' });
        return true;
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [[account]] = await connection.execute(
        `SELECT u.ID_USUARIO, r.NOMBRE AS ROL FROM usuario u
         JOIN rol r ON r.ID_ROL=u.ID_ROL WHERE u.ID_USUARIO=? AND u.ESTADO='activo' FOR UPDATE`,
        [session.userId],
      );
      if (!account) throw Object.assign(new Error('La cuenta ya no está disponible.'), { statusCode: 404 });
      await connection.execute(
        `UPDATE usuario SET NOMBRE_1=?, NOMBRE_2=?, APELLIDO_1=?, APELLIDO_2=?,
          EMAIL=?, TELEFONO=?, FECHA_NACIMIENTO=? WHERE ID_USUARIO=?`,
        [firstName, middleName || null, lastName, secondLastName || null, email, phone || null, birthDate || null, session.userId],
      );
      if (String(account.ROL).toLowerCase() === 'paciente') {
        await connection.execute('UPDATE paciente SET EPS=? WHERE ID_USUARIO=?', [eps || null, session.userId]);
      }
      await connection.execute('INSERT INTO sync_event (EVENT_TYPE) VALUES (?)', ['profile.personal.updated']);
      await connection.commit();
      sendJson(response, 200, { user: await getAuthenticatedUser(request) });
    } catch (error) {
      await connection?.rollback().catch(() => {});
      if (error.code === 'ER_DUP_ENTRY') sendJson(response, 409, { error: 'Ese correo ya está vinculado a otra cuenta.' });
      else if (error.statusCode) sendJson(response, error.statusCode, { error: error.message });
      else {
        console.error('Profile update failed:', error.code || error.name || 'ProfileError');
        sendJson(response, 500, { error: 'No se pudieron guardar los datos del perfil.' });
      }
    } finally {
      connection?.release();
    }
    return true;
  }

  if (path === '/api/auth/profile/address' && request.method === 'PATCH') {
    const session = await activeSession(request);
    if (!session) {
      sendJson(response, 401, { error: 'La sesión venció. Inicia sesión nuevamente.' });
      return true;
    }
    try {
      const body = await readJson(request);
      const parts = normalizeAddressParts(body.addressParts);
      const numberPattern = /^\d{1,5}$/;
      const letterPattern = /^[A-Z]{0,4}$/;
      const quadrantPattern = /^(|N|S|E|O)$/;
      const streetTypes = new Set(['CL', 'CR', 'AV', 'AC', 'AK', 'DG', 'TV', 'AUT', 'CIRC', 'VIA']);
      if (!streetTypes.has(parts.streetType)
        || !numberPattern.test(parts.streetNumber)
        || !numberPattern.test(parts.crossNumber)
        || !numberPattern.test(parts.plateNumber)
        || !letterPattern.test(parts.streetLetter)
        || !letterPattern.test(parts.crossLetter)
        || !quadrantPattern.test(parts.streetQuadrant)
        || !quadrantPattern.test(parts.crossQuadrant)
        || !parts.municipality
        || !parts.department) {
        sendJson(response, 400, { error: 'Completa el tipo de vía, la numeración, la placa, el municipio y el departamento con valores válidos.' });
        return true;
      }

      const address = formatColombianAddress(parts);
      if (!address || address.length > 255) {
        sendJson(response, 400, { error: 'La dirección completa supera el máximo permitido.' });
        return true;
      }

      await pool.execute(
        `UPDATE usuario SET DIRECCION = ?, DIRECCION_TIPO_VIA = ?, DIRECCION_NUMERO_VIA = ?,
          DIRECCION_LETRA_VIA = ?, DIRECCION_BIS = ?, DIRECCION_CUADRANTE_VIA = ?,
          DIRECCION_NUMERO_CRUCE = ?, DIRECCION_LETRA_CRUCE = ?, DIRECCION_CUADRANTE_CRUCE = ?,
          DIRECCION_NUMERO_PLACA = ?, DIRECCION_COMPLEMENTO = ?, BARRIO = ?, MUNICIPIO = ?, DEPARTAMENTO = ?
         WHERE ID_USUARIO = ?`,
        [address, parts.streetType, parts.streetNumber, parts.streetLetter || null, parts.streetBis ? 1 : 0,
          parts.streetQuadrant || null, parts.crossNumber, parts.crossLetter || null,
          parts.crossQuadrant || null, parts.plateNumber, parts.complement || null,
          parts.neighborhood || null, parts.municipality, parts.department, session.userId],
      );
      await pool.execute('INSERT INTO sync_event (EVENT_TYPE) VALUES (?)', ['profile.address.updated']);
      sendJson(response, 200, { address, addressParts: parts });
    } catch (error) {
      console.error('Profile address update failed:', error.code || error.name || 'ProfileError');
      sendJson(response, 500, { error: 'No se pudo guardar la dirección. Intenta nuevamente.' });
    }
    return true;
  }

  if (path === '/api/auth/password/forgot' && request.method === 'POST') {
    try {
      const body = await readJson(request);
      const email = normalizeText(body.email, 254).toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendJson(response, 400, { error: 'Ingresa un correo válido.' });
        return true;
      }
      if (resetLimited(request, email)) {
        sendJson(response, 429, { error: 'Se alcanzó el límite de solicitudes. Espera 15 minutos e inténtalo de nuevo.' });
        return true;
      }
      if (!passwordResetConfigured) {
        sendJson(response, 503, { error: 'La recuperación aún no está habilitada. El administrador debe configurar el correo y el CAPTCHA.' });
        return true;
      }

      const captchaToken = typeof body.captchaToken === 'string' ? body.captchaToken.slice(0, 2048) : '';
      if (!(await verifyTurnstile(captchaToken, request))) {
        sendJson(response, 400, { error: 'Completa nuevamente la verificación de seguridad.' });
        return true;
      }

      const [users] = await pool.execute(
        "SELECT ID_USUARIO, EMAIL FROM usuario WHERE LOWER(EMAIL) = ? AND ESTADO = 'activo' LIMIT 1",
        [email],
      );
      if (users[0]) {
        const token = randomToken(32);
        const tokenHash = resetTokenHash(token);
        await pool.execute('DELETE FROM password_reset_token WHERE ID_USUARIO = ? AND USADO_EN IS NULL', [users[0].ID_USUARIO]);
        await pool.execute(
          'INSERT INTO password_reset_token (ID_USUARIO, TOKEN_HASH, EXPIRA_EN) VALUES (?, ?, DATE_ADD(NOW(3), INTERVAL 15 MINUTE))',
          [users[0].ID_USUARIO, tokenHash],
        );
        try {
          await sendPasswordResetEmail(users[0].EMAIL, token);
        } catch (error) {
          await pool.execute('DELETE FROM password_reset_token WHERE TOKEN_HASH = ?', [tokenHash]).catch(() => {});
          console.error('Password reset email failed:', error.code || error.name || 'MailError');
        }
      }
      sendJson(response, 200, { message: 'Si existe una cuenta activa con ese correo, recibirás instrucciones para restablecer la contraseña.' });
    } catch (error) {
      console.error('Password reset request failed:', error.code || error.name || 'ResetError');
      sendJson(response, 500, { error: 'No se pudo procesar la solicitud. Intenta nuevamente.' });
    }
    return true;
  }

  if (path === '/api/auth/password/reset' && request.method === 'POST') {
    let connection;
    try {
      const body = await readJson(request);
      const token = typeof body.token === 'string' ? body.token : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!token || token.length > 100 || password.length < 10 || password.length > 128) {
        sendJson(response, 400, { error: 'El enlace no es válido o la contraseña no cumple los requisitos.' });
        return true;
      }
      if (resetLimited(request, token)) {
        sendJson(response, 429, { error: 'Se alcanzó el límite de intentos. Espera 15 minutos e inténtalo de nuevo.' });
        return true;
      }

      const encodedPassword = await passwordHash(password);
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [tokens] = await connection.execute(
        `SELECT ID_REINICIO, ID_USUARIO FROM password_reset_token
         WHERE TOKEN_HASH = ? AND USADO_EN IS NULL AND EXPIRA_EN > NOW(3) LIMIT 1 FOR UPDATE`,
        [resetTokenHash(token)],
      );
      if (!tokens[0]) {
        await connection.rollback();
        sendJson(response, 400, { error: 'El enlace venció o ya fue utilizado. Solicita uno nuevo.' });
        return true;
      }
      await connection.execute('UPDATE usuario SET PASSWORD_HASH = ? WHERE ID_USUARIO = ?', [encodedPassword, tokens[0].ID_USUARIO]);
      await connection.execute('UPDATE password_reset_token SET USADO_EN = NOW(3) WHERE ID_REINICIO = ?', [tokens[0].ID_REINICIO]);
      await connection.execute('DELETE FROM password_reset_token WHERE ID_USUARIO = ? AND ID_REINICIO <> ?', [tokens[0].ID_USUARIO, tokens[0].ID_REINICIO]);
      await connection.commit();
      sendJson(response, 200, { message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
    } catch (error) {
      if (connection) await connection.rollback().catch(() => {});
      console.error('Password reset completion failed:', error.code || error.name || 'ResetError');
      sendJson(response, 500, { error: 'No se pudo actualizar la contraseña. Solicita un enlace nuevo.' });
    } finally {
      connection?.release();
    }
    return true;
  }

  if (path === '/api/auth/credentials' && request.method === 'POST') {
    if (limited(request)) {
      sendJson(response, 429, { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' });
      return true;
    }
    try {
      const body = await readJson(request);
      const identifier = normalizeText(body.identifier, 254).toLowerCase();
      const password = typeof body.password === 'string' ? body.password : '';
      if (!identifier || !password || password.length > 128) {
        sendJson(response, 400, { error: 'Ingresa tu usuario y contraseña.' });
        return true;
      }
      const row = await lookupLogin(identifier);
      if (!row || row.ESTADO !== 'activo' || !(await passwordMatches(password, row.PASSWORD_HASH))) {
        sendJson(response, 401, { error: 'Credenciales incorrectas.' });
        return true;
      }
      sendJson(response, 200, { user: publicUser(row) }, { 'Set-Cookie': sessionCookies(await issueSession(row.ID_USUARIO)) });
    } catch (error) {
      console.error('Credential login failed:', error.code || error.name || 'AuthError');
      sendJson(response, 500, { error: 'No se pudo validar la cuenta en este momento.' });
    }
    return true;
  }

  if (path === '/api/auth/register' && request.method === 'POST') {
    let connection;
    try {
      const body = await readJson(request);
      const names = normalizeText(body.names, 80).trim().split(/\s+/);
      const surnames = normalizeText(body.lastNames, 80).trim().split(/\s+/);
      const typeId = normalizeText(body.typeId, 20).toUpperCase();
      const document = normalizeText(body.document, 30).toUpperCase();
      const email = normalizeText(body.email, 254).toLowerCase();
      const phone = normalizeText(body.phone, 30);
      const password = typeof body.password === 'string' ? body.password : '';
      if (!names[0] || !surnames[0] || !['CC', 'TI', 'CE', 'PA', 'PEP'].includes(typeId) || !validDocument(document) || !/^\S+@\S+\.\S+$/.test(email) || !validPhone(phone) || password.length < 7 || password.length > 128) {
        sendJson(response, 400, { error: 'Revisa nombres, documento, correo, teléfono y contraseña.' });
        return true;
      }
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const username = await availableGoogleUsername(email, connection);
      const [created] = await connection.execute(
        `INSERT INTO usuario (TIPO_DOCUMENTO,NUMERO_DOCUMENTO,NOMBRE_1,NOMBRE_2,APELLIDO_1,APELLIDO_2,EMAIL,USUARIO_LOGIN,PASSWORD_HASH,TELEFONO,FECHA_NACIMIENTO,ID_ROL)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,101)`,
        [typeId, document, names[0], names.slice(1).join(' ') || null, surnames[0], surnames.slice(1).join(' ') || null, email, username, await passwordHash(password), phone, body.birthDate || null],
      );
      await connection.execute('INSERT INTO paciente (ID_USUARIO,EPS) VALUES (?,?)', [created.insertId, normalizeText(body.eps, 120) || null]);
      await connection.execute('INSERT INTO sync_event (EVENT_TYPE) VALUES (?)', ['user.registered']);
      await connection.commit();
      const [rows] = await pool.execute(
        `SELECT u.*,p.EPS,r.NOMBRE AS ROL FROM usuario u JOIN paciente p ON p.ID_USUARIO=u.ID_USUARIO JOIN rol r ON r.ID_ROL=u.ID_ROL WHERE u.ID_USUARIO=?`,
        [created.insertId],
      );
      sendJson(response, 201, { user: publicUser(rows[0]) }, { 'Set-Cookie': sessionCookies(await issueSession(created.insertId)) });
    } catch (error) {
      await connection?.rollback().catch(() => {});
      if (error.code === 'ER_DUP_ENTRY') sendJson(response, 409, { error: 'El documento o correo ya está registrado.' });
      else {
        console.error('Patient registration failed:', error.code || error.name || 'RegistrationError');
        sendJson(response, 500, { error: 'No se pudo crear la cuenta en MySQL.' });
      }
    } finally {
      connection?.release();
    }
    return true;
  }

  const startMatch = path.match(/^\/api\/auth\/(google|microsoft)\/start$/);
  if (startMatch && request.method === 'GET') {
    const provider = startMatch[1];
    if (!configured(provider)) {
      sendJson(response, 503, { error: `${provider === 'google' ? 'Google' : 'Microsoft'} todavía no está configurado en el servidor.` });
      return true;
    }
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken(48);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    oauthStates.set(state, { provider, nonce, verifier, expiresAt: Date.now() + 10 * 60 * 1000 });
    const authorize = new URL(providers[provider].authorizationEndpoint);
    authorize.search = new URLSearchParams({
      client_id: providers[provider].clientId,
      redirect_uri: callbackUri(provider),
      response_type: 'code',
      response_mode: 'query',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();
    response.writeHead(302, { Location: authorize.toString(), 'Set-Cookie': cookieHeader(provider, state, 600), 'Cache-Control': 'no-store' });
    response.end();
    return true;
  }

  const callbackMatch = path.match(/^\/api\/auth\/(google|microsoft)\/callback$/);
  if (callbackMatch && request.method === 'GET') {
    const provider = callbackMatch[1];
    const state = url.searchParams.get('state') || '';
    const flow = oauthStates.get(state);
    const clearCookie = cookieHeader(provider, '', 0);
    if (!flow || flow.provider !== provider || cookieValue(request, cookieName(provider)) !== state || !url.searchParams.get('code')) {
      oauthStates.delete(state);
      response.writeHead(302, { Location: frontendRedirect({ oauth_error: 'state' }), 'Set-Cookie': clearCookie, 'Cache-Control': 'no-store' });
      response.end();
      return true;
    }
    oauthStates.delete(state);
    try {
      const tokenResponse = await fetchWithTimeout(providers[provider].tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: providers[provider].clientId,
          client_secret: providers[provider].clientSecret,
          grant_type: 'authorization_code',
          code: url.searchParams.get('code'),
          redirect_uri: callbackUri(provider),
          code_verifier: flow.verifier,
        }),
      });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok || !tokens.id_token) throw new Error('Provider token exchange failed');
      const profile = await verifyIdentity(provider, tokens.id_token, flow.nonce);
      const ticket = randomToken();
      oauthTickets.set(ticket, { provider, profile, expiresAt: Date.now() + 10 * 60 * 1000 });
      response.writeHead(302, { Location: frontendRedirect({ oauth_ticket: ticket }), 'Set-Cookie': clearCookie, 'Cache-Control': 'no-store' });
      response.end();
    } catch (error) {
      console.error(`${provider} sign-in failed:`, error.code || error.name || 'OAuthError');
      response.writeHead(302, { Location: frontendRedirect({ oauth_error: 'provider' }), 'Set-Cookie': clearCookie, 'Cache-Control': 'no-store' });
      response.end();
    }
    return true;
  }

  if (path === '/api/auth/oauth/inspect' && request.method === 'POST') {
    try {
      const body = await readJson(request);
      const ticket = typeof body.ticket === 'string' ? body.ticket : '';
      const pending = oauthTickets.get(ticket);
      if (!pending || pending.expiresAt <= Date.now()) {
        oauthTickets.delete(ticket);
        sendJson(response, 401, { error: 'La verificación venció. Inicia el proceso nuevamente.' });
        return true;
      }
      const linked = await getLinkedUser(pending.provider, pending.profile.subject);
      if (linked && linked.ESTADO === 'activo') {
        sendJson(response, 200, { needsRegistration: false });
      } else if (linked) {
        sendJson(response, 403, { error: 'Esta cuenta está inactiva. Contacta al hospital.' });
      } else {
        const username = pending.provider === 'google' ? await availableGoogleUsername(pending.profile.email) : undefined;
        sendJson(response, 200, {
          needsRegistration: true,
          profile: { provider: pending.provider, name: pending.profile.fullName, email: pending.profile.email, ...(username ? { username } : {}) },
        });
      }
    } catch {
      sendJson(response, 400, { error: 'No se pudo validar el acceso externo.' });
    }
    return true;
  }

  if (path === '/api/auth/oauth/complete' && request.method === 'POST') {
    try {
      const body = await readJson(request);
      const ticket = typeof body.ticket === 'string' ? body.ticket : '';
      const pending = oauthTickets.get(ticket);
      if (!pending || pending.expiresAt <= Date.now()) {
        oauthTickets.delete(ticket);
        sendJson(response, 401, { error: 'La verificación venció. Inicia el proceso nuevamente.' });
        return true;
      }
      const linked = await getLinkedUser(pending.provider, pending.profile.subject);
      if (!linked || linked.ESTADO !== 'activo') {
        sendJson(response, 404, { error: 'Esta identidad todavía no está vinculada a una cuenta.' });
        return true;
      }
      oauthTickets.delete(ticket);
      sendJson(response, 200, { user: publicUser(linked) }, { 'Set-Cookie': sessionCookies(await issueSession(linked.ID_USUARIO)) });
    } catch (error) {
      console.error('OAuth account lookup failed:', error.code || error.name || 'AuthError');
      sendJson(response, 500, { error: 'No se pudo completar el inicio de sesión.' });
    }
    return true;
  }

  if (path === '/api/auth/oauth/register' && request.method === 'POST') {
    let connection;
    try {
      const body = await readJson(request);
      const ticket = typeof body.ticket === 'string' ? body.ticket : '';
      const pending = oauthTickets.get(ticket);
      if (!pending || pending.expiresAt <= Date.now()) {
        oauthTickets.delete(ticket);
        sendJson(response, 401, { error: 'La verificación venció. Inicia el proceso nuevamente.' });
        return true;
      }
      const requestedUsername = normalizeText(body.username, 32).toLowerCase();
      const typeId = normalizeText(body.typeId, 20).toUpperCase();
      const document = normalizeText(body.document, 30).toUpperCase();
      const phone = normalizeText(body.phone, 30);
      const password = typeof body.password === 'string' ? body.password : '';
      if ((pending.provider !== 'google' && !validUsername(requestedUsername)) || !['CC', 'TI', 'CE', 'PA', 'PEP'].includes(typeId) || !validDocument(document) || !validPhone(phone) || password.length < 10 || password.length > 128) {
        sendJson(response, 400, { error: 'Revisa usuario, documento, teléfono y contraseña. La clave debe tener al menos 10 caracteres.' });
        return true;
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();
      const username = pending.provider === 'google'
        ? await availableGoogleUsername(pending.profile.email, connection)
        : requestedUsername;
      const [existingIdentity] = await connection.execute(
        'SELECT ID_USUARIO FROM identidad_proveedor WHERE PROVEEDOR = ? AND ID_SUBJECT = ? LIMIT 1',
        [pending.provider, pending.profile.subject],
      );
      if (existingIdentity.length) {
        await connection.rollback();
        sendJson(response, 409, { error: 'Esta cuenta ya está registrada. Inicia sesión con el proveedor vinculado.' });
        return true;
      }

      const profile = pending.profile;
      const [created] = await connection.execute(
        `INSERT INTO usuario
          (TIPO_DOCUMENTO, NUMERO_DOCUMENTO, NOMBRE_1, APELLIDO_1, EMAIL, USUARIO_LOGIN, PASSWORD_HASH, TELEFONO, ID_ROL)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 101)`,
        [typeId, document, profile.firstName, profile.lastName, profile.email, username, await passwordHash(password), phone],
      );
      const userId = created.insertId;
      await connection.execute('INSERT INTO paciente (ID_USUARIO) VALUES (?)', [userId]);
      await connection.execute(
        'INSERT INTO identidad_proveedor (ID_USUARIO, PROVEEDOR, ID_SUBJECT, EMAIL_PROVEEDOR) VALUES (?, ?, ?, ?)',
        [userId, pending.provider, pending.profile.subject, pending.profile.email],
      );
      await connection.execute('INSERT INTO sync_event (EVENT_TYPE) VALUES (?)', ['user.registered']);
      await connection.commit();
      oauthTickets.delete(ticket);
      const [rows] = await pool.execute(
        `SELECT u.ID_USUARIO, u.TIPO_DOCUMENTO, u.NUMERO_DOCUMENTO, u.NOMBRE_1, u.NOMBRE_2,
          u.APELLIDO_1, u.APELLIDO_2, u.EMAIL, u.USUARIO_LOGIN, u.TELEFONO, u.DIRECCION,
          u.DIRECCION_TIPO_VIA, u.DIRECCION_NUMERO_VIA, u.DIRECCION_LETRA_VIA, u.DIRECCION_BIS,
          u.DIRECCION_CUADRANTE_VIA, u.DIRECCION_NUMERO_CRUCE, u.DIRECCION_LETRA_CRUCE,
          u.DIRECCION_CUADRANTE_CRUCE, u.DIRECCION_NUMERO_PLACA, u.DIRECCION_COMPLEMENTO,
          u.BARRIO, u.MUNICIPIO, u.DEPARTAMENTO, u.FECHA_NACIMIENTO, p.EPS, u.ESTADO, r.NOMBRE AS ROL
         FROM usuario u LEFT JOIN paciente p ON p.ID_USUARIO = u.ID_USUARIO
         JOIN rol r ON r.ID_ROL = u.ID_ROL WHERE u.ID_USUARIO = ?`,
        [userId],
      );
      sendJson(response, 201, { user: publicUser(rows[0]) }, { 'Set-Cookie': sessionCookies(await issueSession(userId)) });
    } catch (error) {
      if (connection) await connection.rollback().catch(() => {});
      if (error.code === 'ER_DUP_ENTRY') {
        sendJson(response, 409, { error: 'El usuario, correo o documento ya está registrado. Revisa los datos o inicia sesión.' });
      } else {
        console.error('Social account registration failed:', error.code || error.name || 'AuthError');
        sendJson(response, 500, { error: 'No se pudo crear la cuenta. Intenta nuevamente.' });
      }
    } finally {
      connection?.release();
    }
    return true;
  }

  sendJson(response, 404, { error: 'Ruta de autenticación no encontrada.' });
  return true;
}
