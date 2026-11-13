import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fight IQ",
    short_name: "Fight IQ",
    description: "풀수록 쌓이는 격투 지식 — MMA·복싱·주짓수 퀴즈",
    start_url: "/",
    display: "standalone",
    background_color: "#16110F",
    theme_color: "#16110F",
    lang: "ko",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
