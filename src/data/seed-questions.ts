/**
 * 시드 문제 — 문제은행이 비어 있을 때 첫 실행에서 넣는다 (lib/quiz/seed.ts).
 * 모두 시간이 지나도 바뀌지 않는 사실(evergreen)만 골랐다. AI 생성 문제가 쌓이면 자연스럽게 비중이 줄어든다.
 */
import type { QuestionInput } from "@/lib/quiz/schema";

type Seed = {
  sport: QuestionInput["sport"];
  topics: QuestionInput["topics"];
  difficulty: number;
  stem: string;
  choices: [string, string, string, string];
  /** 정답 보기 (0~3) */
  answer: 0 | 1 | 2 | 3;
  explanation: string;
  sources?: string[];
  region?: string[];
};

const W = (title: string) => `https://en.wikipedia.org/wiki/${title}`;

const SEEDS: Seed[] = [
  {
    sport: "mma", topics: ["rules"], difficulty: 2,
    stem: "UFC에서 타이틀전도 메인 이벤트도 아닌 일반 경기의 라운드 구성은?",
    choices: ["5분 3라운드", "3분 3라운드", "5분 5라운드", "3분 5라운드"], answer: 0,
    explanation: "UFC 일반 경기는 5분 3라운드로 치른다. 타이틀전과 메인 이벤트는 5분 5라운드이고, 라운드 사이 휴식은 1분이다.",
    sources: [W("Mixed_martial_arts_rules")],
  },
  {
    sport: "mma", topics: ["rules"], difficulty: 1,
    stem: "UFC 타이틀전은 몇 라운드로 치를까?",
    choices: ["5라운드", "3라운드", "10라운드", "12라운드"], answer: 0,
    explanation: "UFC 타이틀전은 5분 5라운드(최대 25분)다. 10라운드·12라운드는 프로 복싱에서 쓰는 라운드 수다.",
    sources: [W("Mixed_martial_arts_rules")],
  },
  {
    sport: "mma", topics: ["rules"], difficulty: 2,
    stem: "MMA 판정에서 각 라운드 승자에게 주는 점수는? (이른바 '머스트 시스템')",
    choices: ["10점", "5점", "3점", "1점"], answer: 0,
    explanation: "MMA는 복싱처럼 10점 필승제(10-Point Must System)를 쓴다. 라운드 승자는 10점, 진 선수는 보통 9점이고, 압도적이면 10-8까지 준다.",
    sources: [W("Mixed_martial_arts_rules")],
  },
  {
    sport: "mma", topics: ["orgs"], difficulty: 1,
    stem: "UFC 경기장 '옥타곤'은 이름처럼 몇 각형일까?",
    choices: ["8각형", "6각형", "4각형", "원형"], answer: 0,
    explanation: "옥타곤(Octagon)은 '팔각형'이라는 뜻으로, 철망으로 둘러싼 8각형 케이지다. 4각형 링은 복싱·킥복싱, 원형 케이지는 일부 단체가 쓴다.",
    sources: [W("Ultimate_Fighting_Championship")],
  },
  {
    sport: "mma", topics: ["history"], difficulty: 3,
    stem: "UFC의 첫 대회 'UFC 1'이 열린 해는?",
    choices: ["1993년", "1989년", "1997년", "2001년"], answer: 0,
    explanation: "UFC 1은 1993년 11월 미국 덴버에서 열린 8인 토너먼트였다. 체급도, 지금 같은 세부 규칙도 거의 없던 시절이다.",
    sources: [W("UFC_1")],
  },
  {
    sport: "mma", topics: ["history", "people"], difficulty: 3,
    stem: "UFC 1 토너먼트에서 우승해 주짓수를 세상에 알린 선수는?",
    choices: ["호이스 그레이시", "켄 샴록", "제라드 고르도", "댄 스번"], answer: 0,
    explanation: "호이스 그레이시는 체구가 작았지만 주짓수 서브미션으로 세 경기를 모두 이겨 우승했다. 결승 상대가 제라드 고르도였고, 켄 샴록은 준결승에서 졌다. 댄 스번은 UFC 4부터 출전했다.",
    sources: [W("UFC_1")],
  },
  {
    sport: "mma", topics: ["korea", "events"], difficulty: 2,
    stem: "UFC 역사상 처음으로 '트위스터' 서브미션 승리를 거둔 한국 선수는?",
    choices: ["정찬성", "김동현", "최두호", "정다운"], answer: 0,
    explanation: "정찬성은 2011년 UFC 파이트 나이트 24에서 레너드 가르시아에게 트위스터로 승리했다. UFC 최초의 트위스터 승리라 지금도 명장면으로 꼽힌다.",
    sources: [W("Chan_Sung_Jung")],
    region: ["kr"],
  },
  {
    sport: "mma", topics: ["korea", "people"], difficulty: 2,
    stem: "'스턴건'이라는 별명으로 알려진 한국의 UFC 웰터급 선수는?",
    choices: ["김동현", "정찬성", "최두호", "추성훈"], answer: 0,
    explanation: "김동현은 '스턴건'이라는 별명으로 UFC 웰터급에서 오래 활약한 한국 MMA의 개척자다. 정찬성은 '코리안 좀비', 최두호는 '슈퍼보이'로 불린다.",
    sources: [W("Kim_Dong-hyun_(fighter)")],
    region: ["kr"],
  },
  {
    sport: "boxing", topics: ["rules"], difficulty: 1,
    stem: "복싱에서 다운된 선수가 일어나지 못하면 심판은 몇까지 세고 KO를 선언할까?",
    choices: ["10", "8", "5", "3"], answer: 0,
    explanation: "심판이 10을 셀 때까지 일어나지 못하면 KO다. 다운된 선수가 곧바로 일어나도 심판은 보통 8까지는 세며 상태를 확인하는데(의무 8카운트), 그래서 8과 헷갈리기 쉽다.",
    sources: [W("Knockout")],
  },
  {
    sport: "boxing", topics: ["history", "events"], difficulty: 3,
    stem: "1974년 무하마드 알리와 조지 포먼의 '럼블 인 더 정글'이 열린 나라는? (당시 국명)",
    choices: ["자이르", "나이지리아", "필리핀", "남아프리카공화국"], answer: 0,
    explanation: "럼블 인 더 정글은 1974년 자이르(현 콩고민주공화국)의 킨샤사에서 열렸고, 알리가 8라운드 KO로 이겼다. 필리핀은 1975년 알리와 조 프레이저의 '스릴라 인 마닐라'가 열린 곳이다.",
    sources: [W("The_Rumble_in_the_Jungle")],
  },
  {
    sport: "boxing", topics: ["technique"], difficulty: 3,
    stem: "알리가 포먼과의 경기에서 로프에 기대 펀치를 받아내며 상대를 지치게 만든 전략의 이름은?",
    choices: ["로프 어 도프", "필리 쉘", "피카부", "숄더 롤"], answer: 0,
    explanation: "로프 어 도프(rope-a-dope)는 로프에 기대 가드를 굳히고 상대가 지칠 때까지 맞아 주다가 반격하는 전략이다. 피카부는 커스 다마토·마이크 타이슨으로 유명한 가드 스타일이고, 필리 쉘·숄더 롤은 어깨로 막는 수비 자세다.",
    sources: [W("Rope-a-dope")],
  },
  {
    sport: "boxing", topics: ["people"], difficulty: 2,
    stem: "무하마드 알리가 이름을 바꾸기 전의 본명은?",
    choices: ["캐시어스 클레이", "조 루이스", "소니 리스턴", "슈거 레이 로빈슨"], answer: 0,
    explanation: "알리의 본명은 캐시어스 클레이로, 1964년 소니 리스턴을 꺾고 헤비급 챔피언이 된 뒤 무하마드 알리로 이름을 바꿨다. 나머지는 모두 다른 전설적인 복서다.",
    sources: [W("Muhammad_Ali")],
  },
  {
    sport: "boxing", topics: ["orgs"], difficulty: 2,
    stem: "다음 중 프로 복싱 4대 메이저 기구가 아닌 것은?",
    choices: ["UWW", "WBA", "WBC", "IBF"], answer: 0,
    explanation: "프로 복싱 4대 기구는 WBA·WBC·IBF·WBO다. UWW(United World Wrestling)는 세계 레슬링 연맹이다.",
    sources: [W("Professional_boxing")],
  },
  {
    sport: "boxing", topics: ["technique", "culture"], difficulty: 2,
    stem: "복싱에서 '사우스포'는 어떤 자세를 말할까?",
    choices: ["오른손·오른발을 앞에 두는 자세", "왼손·왼발을 앞에 두는 자세", "두 손을 얼굴 앞에 붙이는 자세", "몸을 낮게 숙인 자세"], answer: 0,
    explanation: "사우스포는 오른손·오른발을 앞에 두고 왼손을 주먹으로 쓰는 자세로, 주로 왼손잡이가 쓴다. 왼손·왼발을 앞에 두는 일반적인 자세는 '오소독스'라고 한다.",
    sources: [W("Southpaw_stance")],
  },
  {
    sport: "kickboxing", topics: ["culture"], difficulty: 1,
    stem: "무에타이를 부르는 별명 '○○개 팔다리의 예술'에서 ○○에 들어갈 숫자는?",
    choices: ["8", "4", "6", "10"], answer: 0,
    explanation: "무에타이는 두 주먹, 두 팔꿈치, 두 무릎, 두 정강이(발)까지 8곳을 모두 무기로 써서 '8개 팔다리의 예술'이라 불린다.",
    sources: [W("Muay_Thai")],
  },
  {
    sport: "kickboxing", topics: ["orgs", "history"], difficulty: 2,
    stem: "입식격투 대회 K-1이 처음 시작된 나라는?",
    choices: ["일본", "네덜란드", "태국", "미국"], answer: 0,
    explanation: "K-1은 1993년 일본에서 이시이 가즈요시가 시작했다. 네덜란드는 K-1 강자를 많이 배출한 킥복싱 강국이지만 발상지는 아니다.",
    sources: [W("K-1")],
  },
  {
    sport: "bjj", topics: ["rules"], difficulty: 3,
    stem: "IBJJF 주짓수 규칙에서 '마운트' 자세를 잡으면 얻는 점수는?",
    choices: ["4점", "3점", "2점", "1점"], answer: 0,
    explanation: "IBJJF 규칙에서 마운트와 백 컨트롤은 4점, 가드 패스는 3점, 테이크다운·스윕·니 온 벨리는 2점이다.",
    sources: ["https://ibjjf.com/books-videos"],
  },
  {
    sport: "bjj", topics: ["rules"], difficulty: 3,
    stem: "IBJJF 주짓수 규칙에서 상대의 가드를 지나가는 '가드 패스'의 점수는?",
    choices: ["3점", "4점", "2점", "1점"], answer: 0,
    explanation: "가드 패스는 3점이다. 마운트·백 컨트롤(4점)보다는 낮고 테이크다운·스윕·니 온 벨리(2점)보다는 높다.",
    sources: ["https://ibjjf.com/books-videos"],
  },
  {
    sport: "bjj", topics: ["technique"], difficulty: 1,
    stem: "상대의 등 뒤에서 팔로 목을 감아 조르는 서브미션 기술은?",
    choices: ["리어 네이키드 초크", "트라이앵글 초크", "기요틴 초크", "키무라"], answer: 0,
    explanation: "리어 네이키드 초크는 등 뒤를 잡은 상태에서 팔로 목을 감아 경동맥을 압박하는 조르기로, MMA에서 가장 많이 나오는 서브미션 중 하나다. 키무라는 조르기가 아니라 어깨 관절기다.",
    sources: [W("Rear_naked_choke")],
  },
  {
    sport: "bjj", topics: ["technique"], difficulty: 2,
    stem: "두 다리로 상대의 목과 한쪽 팔을 함께 감아 조르는 기술은?",
    choices: ["트라이앵글 초크", "리어 네이키드 초크", "다스 초크", "에제키엘 초크"], answer: 0,
    explanation: "트라이앵글 초크는 다리로 삼각형을 만들어 상대의 목과 한쪽 팔을 함께 조이는 기술로, 가드 포지션에서 자주 나온다. 다스 초크와 에제키엘 초크는 팔을 쓰는 조르기다.",
    sources: [W("Triangle_choke")],
  },
  {
    sport: "bjj", topics: ["technique"], difficulty: 2,
    stem: "주짓수의 '암바(암 바)'가 주로 꺾는 관절은?",
    choices: ["팔꿈치", "어깨", "손목", "무릎"], answer: 0,
    explanation: "암바는 상대의 팔을 펴서 팔꿈치 관절을 반대 방향으로 꺾는 기술이다. 어깨를 비트는 기술은 키무라·아메리카나, 무릎을 꺾는 기술은 니바다.",
    sources: [W("Armbar")],
  },
  {
    sport: "bjj", topics: ["history", "people"], difficulty: 4,
    stem: "어깨 관절기 '키무라'의 이름은 누구에게서 왔을까?",
    choices: ["기무라 마사히코", "엘리오 그레이시", "사쿠라바 가즈시", "이시이 사토시"], answer: 0,
    explanation: "일본 유도가 기무라 마사히코가 1951년 브라질에서 엘리오 그레이시를 이 기술로 꺾으면서, 주짓수에서 이 기술을 '키무라'라고 부르게 됐다. 유도에서는 우데가라미라고 한다.",
    sources: [W("Masahiko_Kimura")],
  },
  {
    sport: "bjj", topics: ["culture"], difficulty: 2,
    stem: "성인 주짓수 벨트에서 블랙 벨트 바로 아래 단계는?",
    choices: ["브라운 벨트", "퍼플 벨트", "블루 벨트", "그린 벨트"], answer: 0,
    explanation: "성인 주짓수 벨트는 화이트 → 블루 → 퍼플 → 브라운 → 블랙 순서다. 그린 벨트는 어린이(유소년) 벨트 체계에 있다.",
    sources: [W("Brazilian_jiu-jitsu_ranking_system")],
  },
  {
    sport: "wrestling", topics: ["rules"], difficulty: 2,
    stem: "그레코로만 레슬링이 자유형 레슬링과 가장 크게 다른 점은?",
    choices: ["허리 아래를 잡거나 다리로 공격할 수 없다", "메치기 기술을 쓸 수 없다", "누르기(폴)로 이길 수 없다", "상의를 입고 경기한다"], answer: 0,
    explanation: "그레코로만은 허리 아래를 잡거나 다리를 써서 공격할 수 없어 상체 기술과 메치기가 중심이다. 자유형은 다리 태클을 쓸 수 있다. 두 종목 모두 폴로 이길 수 있다.",
    sources: [W("Greco-Roman_wrestling")],
  },
  {
    sport: "wrestling", topics: ["history"], difficulty: 4,
    stem: "근대 올림픽에서 먼저 정식 종목이 된 레슬링 종목은?",
    choices: ["그레코로만", "자유형", "두 종목이 동시에", "벨트 레슬링"], answer: 0,
    explanation: "그레코로만 레슬링은 1896년 제1회 아테네 올림픽부터 열렸고, 자유형은 1904년 세인트루이스 올림픽에서 처음 채택됐다.",
    sources: [W("Wrestling_at_the_Summer_Olympics")],
  },
  {
    sport: "judo_sambo", topics: ["rules"], difficulty: 1,
    stem: "유도에서 경기를 그 자리에서 끝내는 최고의 판정은?",
    choices: ["한판", "절반", "유효", "지도"], answer: 0,
    explanation: "한판(잇폰)은 그 자리에서 승리가 확정되는 최고 판정이다. 절반 두 개도 한판이 된다. 유효는 2017년 규칙 개정으로 없어졌고, 지도는 벌칙이다.",
    sources: [W("Judo")],
  },
];

export const SEED_QUESTIONS: QuestionInput[] = SEEDS.map((s) => {
  const ids = ["a", "b", "c", "d"];
  return {
    type: "single_choice",
    sport: s.sport,
    topics: s.topics,
    difficulty: s.difficulty,
    temporal: { kind: "evergreen" },
    region: s.region ?? ["global"],
    answer: { choice_id: ids[s.answer] },
    content: {
      ko: {
        stem: s.stem,
        choices: s.choices.map((text, i) => ({ id: ids[i], text })),
        explanation: s.explanation,
        translation: { status: "original" },
      },
    },
    sources: (s.sources ?? []).map((url) => ({ url })),
    provenance: { origin: "seed", prompt_version: "hand-written-v1" },
    status: "published",
  };
});
