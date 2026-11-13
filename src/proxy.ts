import { NextResponse, type NextRequest } from "next/server";
import { ANON_COOKIE, ANON_COOKIE_MAX_AGE } from "@/lib/player-cookie";

// 가입 없이 바로 풀 수 있도록 처음 방문한 사람에게 비회원 쿠키를 준다.
export function proxy(request: NextRequest) {
  if (request.cookies.has(ANON_COOKIE)) return NextResponse.next();

  const anonId = crypto.randomUUID();
  // 이번 요청의 페이지·서버 액션도 바로 이 값을 보도록 요청 쿠키에도 넣는다.
  request.cookies.set(ANON_COOKIE, anonId);
  const response = NextResponse.next({ request: { headers: request.headers } });
  {
    response.cookies.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ANON_COOKIE_MAX_AGE,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|manifest|robots.txt|sitemap.xml).*)"],
};
