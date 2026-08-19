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
  if (configuredOrigins().has(origin)) return true;
  return DEFAULT_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
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
