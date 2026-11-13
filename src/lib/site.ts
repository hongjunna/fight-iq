export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://fightiq.runvia.app").replace(/\/$/, "");
export const SITE_NAME = "Fight IQ";
export const SITE_TITLE = "Fight IQ — 풀수록 쌓이는 격투 지식";
export const SITE_DESCRIPTION =
  "MMA·복싱·킥복싱·주짓수·레슬링까지. 매일 5문제 '오늘의 5라운드'와 Fight IQ 테스트로 격투 지식을 겨뤄 보세요.";

/** 페이지별 OG/Twitter 태그 */
export function socialMetadata(title: string, description: string, path: string, image = "/opengraph-image") {
  const img = { url: image, width: 1200, height: 630, alt: title };
  return {
    openGraph: { type: "website" as const, siteName: SITE_NAME, locale: "ko_KR", title, description, url: path, images: [img] },
    twitter: { card: "summary_large_image" as const, title, description, images: [img] },
  };
}
