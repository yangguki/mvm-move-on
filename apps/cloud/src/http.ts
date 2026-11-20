const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" } as const;

export function json(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(JSON_HEADERS);
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function nestError(message: string, status: number): Response {
  return json({ statusCode: status, message }, status);
}

export function nestConflict(body: { message: string } & Record<string, unknown>): Response {
  return json({ statusCode: 409, ...body }, 409);
}

export function noContent(extraHeaders?: HeadersInit): Response {
  return new Response(null, { status: 204, headers: extraHeaders });
}