import { NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/app-url";

export async function GET(_: Request, props: { params: Promise<{ code: string }> }) {
  const { code } = await props.params;
  const res = NextResponse.redirect(new URL("/signup", getAppOrigin()));
  res.cookies.set("ref_code", String(code).toUpperCase(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
  return res;
}

