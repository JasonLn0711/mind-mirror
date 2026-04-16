export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export function withCors(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });
}

export function json(data: unknown, status = 200) {
  return withCors(JSON.stringify(data), {
    status,
  });
}

export function handleOptions(request: Request) {
  if (request.method === "OPTIONS") {
    return withCors("ok");
  }

  return null;
}
