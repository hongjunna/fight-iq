/**
 * 인명·고유명사 한국어 표기 사전 (국내 중계·커뮤니티 통용 표기).
 * 생성 프롬프트에 넣고, 영어판에 이름이 나오면 한국어판에 이 표기가 있는지 기계 검사한다.
 * 일본 인명은 성-이름 순서로 쓴다. 나중에 Wikidata 한국어 레이블로 자동 보강한다.
 */
export const NAME_DICTIONARY: Record<string, string> = {
  // MMA
  "Chan Sung Jung": "정찬성",
  "Jung Chan-sung": "정찬성",
  "Kim Dong-hyun": "김동현",
  "Dong Hyun Kim": "김동현",
  "Choi Doo-ho": "최두호",
  "Doo Ho Choi": "최두호",
  "Jung Da-un": "정다운",
  "Park Jun-yong": "박준용",
  "Yoshihiro Akiyama": "추성훈",
  "Choo Sung-hoon": "추성훈",
  "Leonard Garcia": "레너드 가르시아",
  "Jason Tan": "제이슨 탄",
  "Fedor Emelianenko": "표도르 에밀리아넨코",
  "Anderson Silva": "앤더슨 실바",
  "Vitor Belfort": "비토 벨포트",
  "Conor McGregor": "코너 맥그리거",
  "Jon Jones": "존 존스",
  "Khabib Nurmagomedov": "하빕 누르마고메도프",
  "Georges St-Pierre": "조르주 생피에르",
  "Royce Gracie": "호이스 그레이시",
  "Rickson Gracie": "힉슨 그레이시",
  "Nobuhiko Takada": "다카다 노부히코",
  "Kazushi Sakuraba": "사쿠라바 가즈시",
  "Mark Coleman": "마크 콜먼",
  "Ken Shamrock": "켄 샴록",
  "Dan Severn": "댄 스번",
  "Israel Adesanya": "이스라엘 아데산야",
  "Alex Pereira": "알렉스 페레이라",
  "Pride Fighting Championships": "프라이드 FC",
  "Octagon": "옥타곤",
  // 복싱
  "Muhammad Ali": "무하마드 알리",
  "Cassius Clay": "캐시어스 클레이",
  "George Foreman": "조지 포먼",
  "Joe Frazier": "조 프레이저",
  "Mike Tyson": "마이크 타이슨",
  "Trevor Berbick": "트레버 버빅",
  "Floyd Patterson": "플로이드 패터슨",
  "Floyd Mayweather": "플로이드 메이웨더",
  "Manny Pacquiao": "매니 파퀴아오",
  "Rocky Marciano": "로키 마르시아노",
  "Sugar Ray Robinson": "슈거 레이 로빈슨",
  "Kim Duk-koo": "김득구",
  "Ray Mancini": "레이 맨시니",
  "Hong Soo-hwan": "홍수환",
  "Rumble in the Jungle": "럼블 인 더 정글",
  "Thrilla in Manila": "스릴라 인 마닐라",
  // 입식
  "Semmy Schilt": "세미 슐트",
  "Ernesto Hoost": "에르네스토 후스트",
  "Peter Aerts": "피터 아츠",
  "Remy Bonjasky": "레미 본야스키",
  "Buakaw": "부아카우",
  "Lumpinee": "룸피니",
  "Rajadamnern": "라차담넌",
  // 그래플링·레슬링·유도
  "Mitsuyo Maeda": "마에다 미쓰요",
  "Carlos Gracie": "카를로스 그레이시",
  "Helio Gracie": "엘리오 그레이시",
  "Hélio Gracie": "엘리오 그레이시",
  "Masahiko Kimura": "기무라 마사히코",
  "Marcelo Garcia": "마르셀로 가르시아",
  "Gordon Ryan": "고든 라이언",
  "Tahnoon": "타눈",
  "Aleksandr Karelin": "알렉산드르 카렐린",
  "Alexander Karelin": "알렉산드르 카렐린",
  "Rulon Gardner": "룰론 가드너",
  "Jigoro Kano": "가노 지고로",
  "Kano Jigoro": "가노 지고로",
  "Kodokan": "고도칸",
};

export function nameDictionaryText() {
  return Object.entries(NAME_DICTIONARY)
    .map(([en, ko]) => `${en} → ${ko}`)
    .join("\n");
}
