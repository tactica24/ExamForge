import { NextResponse, type NextRequest } from "next/server";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/constants";
import { hasTrustedOrigin } from "@/lib/security/request";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/plan",
  "/quiz",
  "/groups",
  "/progress",
  "/tutor",
  "/settings",
  "/profile",
  "/leaderboard",
  "/mock-exam",
  "/admin",
  "/superadmin",
  "/billing"
];

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXTERNAL_POST_ALLOWED_PATHS = new Set(["/api/billing/paystack/webhook"]);

function isProtectedPath(pathname: string) {
  if (pathname === "/billing/callback") return false;
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function methodRequiresOriginCheck(method: string) {
  return STATE_CHANGING_METHODS.has(method.toUpperCase());
}

function skipOriginCheck(pathname: string) {
  return EXTERNAL_POST_ALLOWED_PATHS.has(pathname);
}

function makeOriginErrorResponse(request: NextRequest) {
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json({ ok: false, message: "Blocked by origin policy." }, { status: 403 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname;

  if (methodRequiresOriginCheck(request.method) && !skipOriginCheck(pathname) && !hasTrustedOrigin(request.headers)) {
    return makeOriginErrorResponse(request);
  }

  const protectedPath = isProtectedPath(pathname);
  if (!protectedPath) return NextResponse.next();

  const session = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${nextUrl.pathname}${nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);

  return NextResponse.next({
    request: {
      headers
    }
  });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/plan/:path*",
    "/quiz/:path*",
    "/groups/:path*",
    "/progress/:path*",
    "/tutor/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/leaderboard/:path*",
    "/mock-exam/:path*",
    "/admin/:path*",
    "/superadmin/:path*",
    "/billing/:path*",
    "/api/:path*",
    "/logout"
  ]
};
