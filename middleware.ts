import { NextResponse, type NextRequest } from "next/server";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/constants";

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

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const isProtected = PROTECTED_PREFIXES.some((p) => nextUrl.pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

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
    "/billing/:path*"
  ]
};