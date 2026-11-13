/** 비회원 식별 쿠키. proxy.ts 가 처음 방문 때 발급한다 (proxy 에서는 server-only 모듈을 못 쓰므로 따로 둔다). */
export const ANON_COOKIE = "fiq_anon";
export const ANON_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
