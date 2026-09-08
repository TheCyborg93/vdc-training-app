import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          background: "#090b0f",
          color: "#ffffff",
          border: "10px solid #b91c1c",
          borderRadius: 38,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 54, fontWeight: 900 }}>VDC</div>
        <div style={{ display: "flex", marginTop: 3, fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>
          TRAINING
        </div>
      </div>
    ),
    size,
  );
}
