import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

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
          flexDirection: "column",
          background: "linear-gradient(145deg, #07090c 0%, #15191f 100%)",
          color: "#ffffff",
          border: "26px solid #b91c1c",
          borderRadius: 112,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 150, fontWeight: 900, letterSpacing: -10 }}>
          VDC
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 4,
            fontSize: 42,
            fontWeight: 800,
            letterSpacing: 8,
            color: "#f3f4f6",
          }}
        >
          TRAINING
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            width: 94,
            height: 94,
            borderRadius: 999,
            border: "13px solid #ffffff",
            boxShadow: "0 0 0 13px #b91c1c",
          }}
        />
      </div>
    ),
    size,
  );
}
