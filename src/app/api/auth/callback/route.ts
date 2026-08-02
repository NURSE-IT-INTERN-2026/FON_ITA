import { NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  fetchCmuBasicInfo,
  getCmuConfig,
  resolveCmuAccount,
} from "@/lib/auth/cmu-oauth";
import { logActivity } from "@/lib/activity/log";
import { LoginError, type LoginErrorCode } from "@/lib/auth/errors";
import { consumeOauthStateCookie, matchesOauthState } from "@/lib/auth/oauth-state";
import { ROLE_HOME } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";
import { withBasePath } from "@/lib/base-path";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/callback  (real path: /fonita/api/auth/callback)
 *
 * Where Microsoft returns after a CMU login. The URL must match `REDIRECT_URI`
 * and the Azure registration byte for byte (decisions.md D8).
 *
 * Order matters: `state` is checked before anything is exchanged, so a forged
 * callback costs nothing and reaches no external service.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);

  // Consumed first, and on every path — one attempt per cookie.
  const cookieState = await consumeOauthStateCookie();
  const queryState = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (!matchesOauthState(queryState, cookieState)) {
    return failed(request, LoginError.StateMismatch);
  }

  // Microsoft sends `error=access_denied` when the user cancels at the consent
  // screen; there is no code to exchange in that case.
  if (!code) return failed(request, LoginError.Generic);

  let cfg;
  try {
    cfg = getCmuConfig();
  } catch (error) {
    console.error("[cmu-oauth] cannot complete flow", error);
    return failed(request, LoginError.Generic);
  }

  const accessToken = await exchangeCodeForToken(cfg, code);
  if (!accessToken) return failed(request, LoginError.TokenFailed);

  const info = await fetchCmuBasicInfo(cfg, accessToken);
  // The access token has done its job and is deliberately never stored.
  if (!info) return failed(request, LoginError.UserInfoFailed);

  const cmuAccount = resolveCmuAccount(info);

  // No auto-provisioning (decisions.md D6) — a CMU account only gets in if a
  // SUPERADMIN created the row first. Otherwise every student and staff member
  // at the university could sign in.
  //
  // Case-insensitive because rows created by hand may not be lowercased, while
  // PostgreSQL compares text exactly.
  const user = await prisma.user.findFirst({
    where: { cmuAccount: { equals: cmuAccount, mode: "insensitive" } },
  });

  if (!user) return failed(request, LoginError.NotRegistered);
  if (!user.status) return failed(request, LoginError.AccountDisabled);

  // `mustResetPassword` is not checked here on purpose: it marks a legacy
  // password hash from the MySQL migration, and this login never touches the
  // password.
  await createSession(user.id, "CMU_OAUTH");
  await logActivity(user, "login", { detail: "บัญชี CMU (OAuth)" });

  return NextResponse.redirect(new URL(withBasePath(ROLE_HOME[user.role]), request.url));
}

/** Back to the login page with a code it knows how to render in Thai. */
function failed(request: Request, code: LoginErrorCode): NextResponse {
  const loginUrl = new URL(withBasePath("/login"), request.url);
  loginUrl.searchParams.set("error", code);
  return NextResponse.redirect(loginUrl);
}
