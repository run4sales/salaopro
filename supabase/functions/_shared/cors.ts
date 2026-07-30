const ALLOWED_METHODS = 'POST, OPTIONS';
const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';

function configuredOrigins() {
  return new Set(
    (Deno.env.get('ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Vary': 'Origin',
  };

  if (origin && configuredOrigins().has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function isAllowedBrowserOrigin(req: Request) {
  const origin = req.headers.get('Origin');
  return !origin || configuredOrigins().has(origin);
}
