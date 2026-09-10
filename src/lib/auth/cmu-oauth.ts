// CMU Account (Microsoft Entra ID) OAuth 2.0 — authorization-code flow, no PKCE.
// Endpoints and credentials all come from env; see .env.example.
//
// Everything here runs server-side only: the client secret must never reach the
// browser, and the CMU access token is used once to read the profile and then
// dropped (docs/chapters/03-auth-rbac.md §4.3.2).

type CmuConfig = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  basicInfoUrl: string;
  scope: string;
  redirectUri: string;
};

/**
 * Read and check the OAuth env. Throws when something is missing so the caller
 * can fail with a login error instead of half-building an authorize URL that
 * Microsoft would reject with an opaque message.
 */
export function getCmuConfig(): CmuConfig {
  const entries = {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    authorizeUrl: process.env.AUTH_URL,
    tokenUrl: process.env.TOKEN_URL,
    basicInfoUrl: process.env.BASICINFO_URL,
    scope: process.env.SCOPE,
    redirectUri: process.env.REDIRECT_URI,
  };

  const missing = Object.entries(entries)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(`Missing CMU OAuth env vars: ${missing.join(", ")}`);
  }

  return entries as CmuConfig;
}

/** Step 1 — where to send the browser. `state` ties the callback to this request. */
export function buildAuthorizeUrl(cfg: CmuConfig, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    // Must match the Azure registration byte for byte, including /fonita.
    redirect_uri: cfg.redirectUri,
    scope: cfg.scope,
    state,
  });
  return `${cfg.authorizeUrl}?${params}`;
}

/**
 * Step 2 — trade the authorization code for an access token.
 *
 * Returns null on failure rather than throwing: the caller turns that into a
 * Thai error on the login page, and the response body may contain details that
 * should not be shown to the user.
 */
export async function exchangeCodeForToken(
  cfg: CmuConfig,
  code: string,
): Promise<string | null> {
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
    // A hung CMU endpoint would otherwise hold the callback open indefinitely.
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    // Status only — the body can echo request parameters, and nothing here may
    // leak the client secret into the logs.
    console.error("[cmu-oauth] token exchange failed", res.status, res.statusText);
    return null;
  }

  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

/** The `basicinfo` fields this app reads. CMU returns more; the rest is ignored. */
export type CmuBasicInfo = {
  /** the CMU IT account — an email address, e.g. "someone@cmu.ac.th" */
  cmuitaccount: string;
  /** the same account without the domain, e.g. "someone" */
  cmuitaccount_name?: string;
  firstname_TH?: string;
  lastname_TH?: string;
  firstname_EN?: string;
  lastname_EN?: string;
  organization_code?: string;
};

/** Step 3 — who signed in. The token is used here and then discarded. */
export async function fetchCmuBasicInfo(
  cfg: CmuConfig,
  accessToken: string,
): Promise<CmuBasicInfo | null> {
  const res = await fetch(cfg.basicInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error("[cmu-oauth] basicinfo failed", res.status, res.statusText);
    return null;
  }

  const data = (await res.json()) as CmuBasicInfo;
  return data?.cmuitaccount ? data : null;
}

/**
 * The value to match against `User.cmuAccount`, which holds the local part only
 * (the legacy Laravel column stored "ส่วนหน้า @").
 *
 * Both fields are tried, and the domain is stripped either way: CMU documents
 * `cmuitaccount` as the full address and `cmuitaccount_name` as the bare name,
 * but a mismatch here fails as "ไม่มีสิทธิ์ใช้งานระบบ" for a user whose account
 * is perfectly valid — a bug that looks like a permission problem. Lowercased
 * because PostgreSQL compares text case-sensitively.
 */
export function resolveCmuAccount(info: CmuBasicInfo): string {
  const raw = info.cmuitaccount_name?.trim() || info.cmuitaccount.trim();
  return raw.split("@")[0].toLowerCase();
}
