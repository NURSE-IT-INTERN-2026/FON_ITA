import { NextResponse } from "next/server";
import { buildAuthorizeUrl, getCmuConfig } from "@/lib/auth/cmu-oauth";
import { LoginError } from "@/lib/auth/errors";
import { generateOauthState, setOauthStateCookie } from "@/lib/auth/oauth-state";
import { withBasePath } from "@/lib/base-path";

/**
 * GET /api/auth/cmu  (real path: /fonita/api/auth/cmu)
 *
 * Starts the CMU OAuth flow: mint a `state`, remember it in a short-lived
 * cookie, then hand the browser to Microsoft (decisions.md D8).
 *
 * The login page links here with a plain <a> so Next never prefetches it and
 * starts an OAuth round trip on hover.
 */
export async function GET(request: Request): Promise<NextResponse> {
  let authorizeUrl: string;

  try {
    const cfg = getCmuConfig();
    const state = generateOauthState();
    await setOauthStateCookie(state);
    authorizeUrl = buildAuthorizeUrl(cfg, state);
  } catch (error) {
    // Missing or malformed env. Show the login page with a Thai message rather
    // than a 500 — the user can still sign in with email + password.
    console.error("[cmu-oauth] cannot start flow", error);
    const loginUrl = new URL(withBasePath("/login"), request.url);
    loginUrl.searchParams.set("error", LoginError.Generic);
    return NextResponse.redirect(loginUrl);
  }

  // Absolute external URL — basePath does not apply.
  return NextResponse.redirect(authorizeUrl);
}
