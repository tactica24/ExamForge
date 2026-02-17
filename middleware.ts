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
  "/billing"
];

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function methodRequiresOriginCheck(method: string) {
  return STATE_CHANGING_METHODS.has(method.toUpperCase());
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

  if (methodRequiresOriginCheck(request.method) && !hasTrustedOrigin(request.headers)) {
    return makeOriginErrorResponse(request);
  }

  const protectedPath = isProtectedPath(pathname);
  if (!protectedPath) return NextResponse.next();

  const session = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request });
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
    "/billing/:path*",
    "/api/:path*",
    "/logout"
  ]
};
