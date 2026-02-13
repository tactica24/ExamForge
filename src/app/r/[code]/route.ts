import { NextResponse } from "next/server";

export async function GET(_: Request, props: { params: Promise<{ code: string }> }) {
  const { code } = await props.params;
  const res = NextResponse.redirect(new URL("/signup", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  res.cookies.set("ref_code", String(code).toUpperCase(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
  return res;
}

