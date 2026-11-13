import { ImageResponse } from "next/og";

export const alt = "Fight IQ — 풀수록 쌓이는 격투 지식";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 한글 글꼴 없이도 깨지지 않도록 이미지 안의 글자는 영문으로 둔다.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "radial-gradient(ellipse 80% 70% at 50% 0%, #5a1717 0%, #16110f 70%)",
          color: "#f6f3ef",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 8, color: "#e04a3f" }}>MMA · BOXING · KICKBOXING · BJJ · WRESTLING</div>
        <div style={{ display: "flex", fontSize: 160, fontWeight: 900, marginTop: 20 }}>
          FIGHT <span style={{ color: "#e04a3f", marginLeft: 30 }}>IQ</span>
        </div>
        <div style={{ fontSize: 40, color: "#e9c46a", marginTop: 10 }}>How deep is your fight knowledge?</div>
      </div>
    ),
    size,
  );
}
