const ADMIN_PATH = '/d9k2m7x';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (!isAdminPath(url.pathname)) {
    return next();
  }

  const expected = env.ADMIN_BASIC_AUTH;
  if (!expected) {
    return new Response('Admin authentication is not configured.', {
      status: 503,
      headers: secureHeaders({
        'Content-Type': 'text/plain; charset=utf-8',
      }),
    });
  }

  const supplied = parseBasicAuth(request.headers.get('Authorization'));
  if (!supplied || !(await safeEqual(supplied, expected))) {
    return new Response('Authentication required.', {
      status: 401,
      headers: secureHeaders({
        'Content-Type': 'text/plain; charset=utf-8',
        'WWW-Authenticate': 'Basic realm="HojoTown Admin", charset="UTF-8"',
      }),
    });
  }

  const response = await next();
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(secureHeaders())) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isAdminPath(pathname) {
  return pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);
}

function parseBasicAuth(authHeader) {
  if (!authHeader?.startsWith('Basic ')) {
    return '';
  }

  try {
    const decoded = atob(authHeader.slice('Basic '.length));
    return decoded.includes(':') ? decoded : '';
  } catch {
    return '';
  }
}

async function safeEqual(a, b) {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const viewA = new Uint8Array(hashA);
  const viewB = new Uint8Array(hashB);

  if (viewA.length !== viewB.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < viewA.length; i += 1) {
    diff |= viewA[i] ^ viewB[i];
  }

  return diff === 0;
}

function secureHeaders(extra = {}) {
  return {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Frame-Options': 'DENY',
    ...extra,
  };
}
