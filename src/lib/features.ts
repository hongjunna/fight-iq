/**
 * 선택 기능 스위치.
 * Firebase 값이 없으면 로그인 기능을 숨기고 비회원(브라우저 쿠키)으로만 동작한다.
 * NEXT_PUBLIC_* 는 빌드 때 박히므로, 값을 넣은 뒤에는 다시 배포해야 켜진다.
 */
export const FIREBASE_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
);
