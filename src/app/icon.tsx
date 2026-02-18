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
          background: "linear-gradient(145deg, #08314a 0%, #0f5570 45%, #16a4a4 100%)"
        }}
      >
        <div
          style={{
            width: 364,
            height: 364,
            borderRadius: 110,
            background: "rgba(255,255,255,0.16)",
            border: "1px solid rgba(255,255,255,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 36px 95px rgba(2, 18, 32, 0.38)"
          }}
        >
          <svg width="232" height="232" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="52" height="52" rx="16" fill="#0B4B69" />
            <rect x="14.5" y="17" width="35" height="30" rx="6" fill="#F7FBFF" fillOpacity="0.97" />
            <path d="M22 24H42" stroke="#0E3A50" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M22 31H36" stroke="#0E3A50" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M22 38H42" stroke="#0E3A50" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M40 26L45.5 31.5L40 37" stroke="#14B8A6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    ),
    size
  );
}
