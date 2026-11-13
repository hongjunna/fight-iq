/** 종목·주제·난이도 분류 (docs/기획서.md §4). 코드 값은 DB·AI 생성 규격과 공유한다. */

export const SPORTS = ["mma", "boxing", "kickboxing", "bjj", "wrestling", "judo_sambo", "general"] as const;
export type Sport = (typeof SPORTS)[number];

export const SPORT_LABELS: Record<Sport, string> = {
  mma: "MMA",
  boxing: "복싱",
  kickboxing: "킥복싱·무에타이",
  bjj: "주짓수·그래플링",
  wrestling: "레슬링",
  judo_sambo: "유도·삼보",
  general: "격투 일반",
};

export const TOPICS = ["rules", "technique", "history", "people", "events", "orgs", "records", "culture", "korea"] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABELS: Record<Topic, string> = {
  rules: "규칙·판정",
  technique: "기술",
  history: "역사",
  people: "인물",
  events: "대회·명경기",
  orgs: "단체·체급",
  records: "기록·통계",
  culture: "용어·문화",
  korea: "국내 격투",
};

export const DIFFICULTIES = [1, 2, 3, 4, 5] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "입문",
  2: "라이트 팬",
  3: "꾸준한 팬",
  4: "코어 팬",
  5: "매니아",
};

/** Fight IQ 테스트 결과 유형 — 가장 잘한 종목으로 정한다 */
export const SPORT_ARCHETYPES: Record<Sport, string> = {
  mma: "옥타곤 분석가",
  boxing: "복싱 스카우터",
  kickboxing: "스트라이커 아이",
  bjj: "그래플링 브레인",
  wrestling: "레슬링 엔진",
  judo_sambo: "던지기 장인",
  general: "격투 백과사전",
};
