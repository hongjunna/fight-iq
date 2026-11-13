/** 오늘 날짜 (KST, YYYY-MM-DD). 오늘의 5라운드는 한국 시간 0시에 바뀐다. */
export function todayKst(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function formatKoreanDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
