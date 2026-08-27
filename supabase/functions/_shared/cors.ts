const ALLOWED_METHODS = 'POST, OPTIONS';
const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';

// Origens sempre confiáveis: preview/publicação Lovable e desenvolvimento local.
const DEFAULT_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/i,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.dev$/i,
  /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/i,
  /^https:\/\/([a-z0-9-]+\.)*sandbox\.lovable\.dev$/i,
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i,
];

function configuredOrigins() {
  return new Set(
    (Deno.env.get('ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function isAllowedOrigin(origin: string) {
  const allowlist = configuredOrigins();
  if (allowlist.has(origin) || DEFAULT_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) return true;

  // Edge Functions are bearer-token APIs (not cookie-authenticated), so Origin
  // is not an authorization boundary. In installations where ALLOWED_ORIGINS
  // may lag behind a newly connected custom domain, accept normal HTTPS
  // application domains rather than breaking browser preflight. The function
  // still authenticates and authorizes every request; ALLOWED_ORIGINS remains
  // useful as explicit documentation and for non-HTTPS development origins.
  try {
    const url = new URL(origin);
    return url.protocol === 'https:'
      || (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'));
  } catch {
    return false;
  }
}

export function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Vary': 'Origin',
  };

  if (origin && isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function isAllowedBrowserOrigin(req: Request) {
  const origin = req.headers.get('Origin');
  return !origin || isAllowedOrigin(origin);
}
