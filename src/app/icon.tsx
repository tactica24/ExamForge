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
          background: "radial-gradient(circle at top, #f7fbff 0%, #dce7f2 46%, #c5d6e6 100%)"
        }}
      >
        <div
          style={{
            width: 420,
            height: 420,
            borderRadius: "50%",
            border: "14px solid #d4af37",
            background: "linear-gradient(180deg, #ffffff 0%, #eef5fb 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            boxShadow: "0 30px 90px rgba(10, 30, 60, 0.16)"
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 34,
              fontSize: 58,
              color: "#c79a1b",
              lineHeight: 1
            }}
          >
            {"\u265B"}
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: "#123d66"
            }}
          >
            <div style={{ fontSize: 82, fontWeight: 800, letterSpacing: 4, lineHeight: 0.95 }}>ACE</div>
            <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: 6, lineHeight: 1 }}>NAIJA</div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 10
            }}
          >
            <div
              style={{
                width: 96,
                height: 74,
                borderBottomLeftRadius: 90,
                borderTopLeftRadius: 12,
                borderTopRightRadius: 28,
                background: "linear-gradient(180deg, #245c96 0%, #123d66 100%)",
                transform: "skewY(8deg)"
              }}
            />
            <div
              style={{
                width: 36,
                height: 112,
                clipPath: "polygon(50% 0%, 100% 38%, 68% 38%, 68% 100%, 32% 100%, 32% 38%, 0% 38%)",
                background: "linear-gradient(180deg, #3b8f52 0%, #1f6d38 100%)"
              }}
            />
            <div
              style={{
                width: 96,
                height: 74,
                borderBottomRightRadius: 90,
                borderTopRightRadius: 12,
                borderTopLeftRadius: 28,
                background: "linear-gradient(180deg, #3f9b58 0%, #2b7b43 100%)",
                transform: "skewY(-8deg)"
              }}
            />
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 42,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 2,
              color: "#123d66"
            }}
          >
            Academic Excellence
          </div>
        </div>
      </div>
    ),
    size
  );
}
