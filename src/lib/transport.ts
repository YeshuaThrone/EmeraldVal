/**
 * Same-origin HTTP transport for the ATXLiveArtistSDK and map hydration —
 * the real backing the SDK's payload builders were shaped for (PRs #17/#19
 * built the wire shapes; PR 22 puts them on the wire).
 *
 * Contract (deliberate, tested):
 * - `requestJson` NEVER throws. Every failure — network, timeout, non-2xx —
 *   resolves to a typed `TransportFailure` so callers (the SDK's
 *   never-throw result contract, the map's hydrate-with-notice flow) can
 *   render feedback instead of crashing.
 * - Timeouts use an AbortController (REQUEST_TIMEOUT_MS) so a hung server
 *   cannot pin the UI; an aborted request maps to `request_timeout`.
 * - Non-2xx responses are classified by status; when the server returns its
 *   typed `{error, code}` envelope (see src/lib/server/http.ts), the
 *   envelope's message and machine code ride along on the failure.
 *
 * Framework-agnostic: no React imports, no DOM assumptions beyond the
 * standard fetch/AbortController globals (Node 18+ and every browser).
 */

/** Wall-clock cap per request — long enough for cold serverless starts. */
export const REQUEST_TIMEOUT_MS = 10_000;

export type TransportErrorCode =
  | "network_error"
  | "request_timeout"
  | "auth_error"
  | "validation_error"
  | "server_error";

export type TransportSuccess = {
  ok: true;
  /** HTTP status of the response (2xx — non-2xx resolves as a failure). */
  status: number;
  /** Parsed JSON body, or null when the body was not JSON. */
  body: unknown;
};

export type TransportFailure = {
  ok: false;
  code: TransportErrorCode;
  error: string;
  /** HTTP status, when the failure came from a response rather than fetch. */
  httpStatus?: number;
  /** The server envelope's machine code, when one was returned. */
  serverCode?: string;
};

export type TransportResult = TransportSuccess | TransportFailure;

const DEFAULT_MESSAGES: Record<TransportErrorCode, string> = {
  network_error: "Couldn't reach the ATXLive server. Check your connection and try again.",
  request_timeout: "The server took too long to respond. Please try again.",
  auth_error: "You're not authorized to do that.",
  validation_error: "The server rejected this request.",
  server_error: "The ATXLive server hit an error. Please try again.",
};

/** Runtime guard for the server's typed error envelope. */
export function isApiErrorEnvelope(
  body: unknown,
): body is { error: string; code: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    typeof (body as { error?: unknown }).error === "string" &&
    typeof (body as { code?: unknown }).code === "string"
  );
}

/**
 * Pure status classifier: null for 2xx (the caller proceeds), a typed
 * failure for everything else. 401/403 are auth (PR 23's Bearer keys will
 * produce these); other 4xx are validation — the server's `{error, code}`
 * envelope is surfaced verbatim; 5xx are server faults.
 */
export function classifyResponse(
  status: number,
  body: unknown,
): TransportFailure | null {
  if (status >= 200 && status < 300) {
    return null;
  }
  const envelope = isApiErrorEnvelope(body) ? body : null;
  const base = {
    httpStatus: status,
    ...(envelope !== null ? { serverCode: envelope.code } : {}),
  };
  if (status === 401 || status === 403) {
    return {
      ok: false,
      code: "auth_error",
      error: envelope?.error ?? DEFAULT_MESSAGES.auth_error,
      ...base,
    };
  }
  if (status < 500) {
    return {
      ok: false,
      code: "validation_error",
      error: envelope?.error ?? DEFAULT_MESSAGES.validation_error,
      ...base,
    };
  }
  return {
    ok: false,
    code: "server_error",
    error: envelope?.error ?? DEFAULT_MESSAGES.server_error,
    ...base,
  };
}

export type RequestOptions = {
  method?: "GET" | "POST";
  /** JSON-serializable request body (POST only). */
  body?: unknown;
  /**
   * Extra request headers (PR 23) — the SDK sends its Bearer artist key
   * here. Values are merged after the JSON content-type default.
   */
  headers?: Record<string, string>;
};

/**
 * fetch + JSON with a hard timeout. Resolves `{ok: true, status, body}` for
 * any 2xx (body null when non-JSON — callers validate the shape they need)
 * and a typed `TransportFailure` for every other path.
 */
export async function requestJson(
  url: string,
  options: RequestOptions = {},
): Promise<TransportResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      ...(options.body !== undefined || options.headers !== undefined
        ? {
            headers: {
              ...(options.body !== undefined
                ? { "Content-Type": "application/json" }
                : {}),
              ...options.headers,
            },
            ...(options.body !== undefined
              ? { body: JSON.stringify(options.body) }
              : {}),
          }
        : {}),
      signal: controller.signal,
    });
    // A non-JSON body (e.g. an HTML proxy error page) is a legitimate
    // response shape here, not a swallowed error: body becomes null and
    // classification falls back to the status-based default messages.
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const failure = classifyResponse(response.status, body);
    return failure ?? { ok: true, status: response.status, body };
  } catch {
    if (controller.signal.aborted) {
      return {
        ok: false,
        code: "request_timeout",
        error: DEFAULT_MESSAGES.request_timeout,
      };
    }
    return {
      ok: false,
      code: "network_error",
      error: DEFAULT_MESSAGES.network_error,
    };
  } finally {
    clearTimeout(timer);
  }
}
