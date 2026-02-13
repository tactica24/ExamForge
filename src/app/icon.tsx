import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b1220 0%, #1f2a44 55%, #0b1220 100%)"
        }}
      >
        <div
          style={{
            width: 400,
            height: 400,
            borderRadius: 96,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 30px 80px rgba(0,0,0,0.35)"
          }}
        >
          <div
            style={{
              fontSize: 120,
              fontWeight: 800,
              letterSpacing: -4,
              color: "white"
            }}
          >
            EF
          </div>
        </div>
      </div>
    ),
    size
  );
}
