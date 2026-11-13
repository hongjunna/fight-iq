/**
 * 출처: 등급 매기기, 본문 읽기, 원문 인용 검증.
 * 등급: 1 = 단체·연맹 공식·백과, 2 = 주요 언론·격투 매체, 3 = 그 밖(참고), 0 = 차단(커뮤니티·SNS·영상)
 */

const TIER1 = [
  "wikipedia.org", "britannica.com", "ufc.com", "ufcstats.com", "ibjjf.com", "uww.org", "olympics.com", "olympedia.org",
  "ijf.org", "kodokan.org", "adcombat.com", "wbaboxing.com", "wbcboxing.com", "ibf-usba-boxing.com", "wboboxing.com",
  "onefc.com", "glorykickboxing.com", "roadfc.com", "abcboxing.com", "sambo.sport", "k-1.co.jp", "pflmma.com",
  "guinnessworldrecords.com", // 기록 공인 기관
];
const TIER2 = [
  "espn.com", "mmafighting.com", "mmajunkie.usatoday.com", "usatoday.com", "sherdog.com", "tapology.com", "bloodyelbow.com",
  "boxingscene.com", "ringtv.com", "ringmagazine.com", "bbc.com", "bbc.co.uk", "theguardian.com", "nytimes.com", "reuters.com",
  "apnews.com", "cbssports.com", "foxsports.com", "si.com", "bjjheroes.com", "bjjee.com", "flograppling.com", "history.com",
  "mmamania.com", "yna.co.kr", "chosun.com", "donga.com", "joongang.co.kr", "hani.co.kr", "khan.co.kr", "nippon.com",
  "japantimes.co.jp", "independent.co.uk", "telegraph.co.uk", "latimes.com", "washingtonpost.com", "cnn.com", "teamusa.org",
  "dazn.com", "npr.org", "nbcnews.com", "nbcsports.com", "cbsnews.com", "abcnews.go.com", "sports.yahoo.com", "time.com",
  "theathletic.com", "skysports.com", "boxingnews24.com", "fightsports.tv",
];
const BLOCKED = [
  "reddit.com", "facebook.com", "youtube.com", "youtu.be", "instagram.com", "x.com", "twitter.com", "tiktok.com", "quora.com",
  "pinterest.com", "fandom.com", "namu.wiki", "blog.naver.com", "tistory.com", "medium.com", "boxrec.com", "threads.net",
  "dcinside.com", "fmkorea.com", "kiddle.co",
];

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
};
const matches = (host: string, list: string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));

export type Tier = 0 | 1 | 2 | 3;
export function tierOf(url: string): Tier {
  const host = hostOf(url);
  if (!host || matches(host, BLOCKED)) return 0;
  if (matches(host, TIER1)) return 1;
  if (matches(host, TIER2)) return 2;
  return 3;
}
export const domainOf = (url: string) => hostOf(url).replace(/^www\./, "");

const UA = "Mozilla/5.0 (compatible; FightIQ/1.0; +https://fightiq.runvia.app)";

/** 위키백과는 API 로 본문 텍스트를, 그 밖은 HTML 을 텍스트로 바꿔 읽는다 */
export async function fetchText(url: string): Promise<string> {
  try {
    const wiki = /^https?:\/\/([a-z-]+\.wikipedia\.org)\/wiki\/([^#?]+)/.exec(url);
    if (wiki) {
      const api = `https://${wiki[1]}/w/api.php?${new URLSearchParams({
        action: "query", prop: "extracts", explaintext: "1", redirects: "1", format: "json", titles: decodeURIComponent(wiki[2]),
      })}`;
      const r = await fetch(api, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000) });
      const data = (await r.json()) as { query?: { pages?: Record<string, { extract?: string }> } };
      return Object.values(data.query?.pages ?? {})[0]?.extract ?? "";
    }
    if (/\.pdf($|\?)/i.test(url)) return "";
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000), redirect: "follow" });
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("html")) return "";
    let raw = (await r.text()).slice(0, 3_000_000);
    raw = raw.replace(/<(script|style|noscript|svg|nav|footer|header|form)[^>]*>[\s\S]*?<\/\1>/gi, " ");
    raw = raw.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h\d>/gi, "\n").replace(/<[^>]+>/g, " ");
    return decodeEntities(raw).replace(/[ \t\r\f\v]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  } catch {
    return "";
  }
}

function decodeEntities(s: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: "-", mdash: "-" };
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return named[e.toLowerCase()] ?? m;
  });
}

/** 주제와 관련된 영어 위키백과 문서 (검색 결과와 별개로 늘 1~2개 읽는다) */
export async function wikipediaPages(query: string, limit = 2): Promise<string[]> {
  try {
    const api = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: "query", list: "search", srsearch: query, srlimit: String(limit), format: "json" })}`;
    const r = await fetch(api, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    const data = (await r.json()) as { query?: { search?: { title: string }[] } };
    return (data.query?.search ?? []).map((s) => `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, "_"))}`);
  } catch {
    return [];
  }
}

/** 키워드가 나오는 문단 위주로 잘라 모델 컨텍스트를 아낀다 */
export function relevantExcerpt(text: string, keywords: string[], limit = 5000) {
  const kws = keywords.map((k) => k.toLowerCase()).filter((k) => k.length > 2);
  const paras = text.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 40);
  const scored = paras
    .map((p, i) => ({ i, p, score: kws.reduce((s, k) => s + p.toLowerCase().split(k).length - 1, 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(12, Math.ceil(limit / 400)))
    .sort((a, b) => a.i - b.i);
  return scored.map((x) => x.p).join("\n").slice(0, limit);
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");

/**
 * 모델이 인용했다는 문장이 실제 문서에 있는지 코드로 확인한다.
 * 띄어쓰기·따옴표 차이는 무시하고, 인용을 세 조각으로 나눠 모두 문서에 있으면 통과 (사소한 생략 허용).
 */
export function quoteInDoc(quote: string, doc: string) {
  const q = norm(quote);
  const d = norm(doc);
  if (q.length < 15) return false;
  if (d.includes(q)) return true;
  const size = Math.ceil(q.length / 3);
  const parts = [q.slice(0, size), q.slice(size, size * 2), q.slice(size * 2)].map((p) => p.trim()).filter((p) => p.length >= 12);
  return parts.length === 3 && parts.every((p) => d.includes(p));
}

/** "~라고 전해진다" 류 표현 — 이런 인용으로 뒷받침된 사실은 단정형으로 출제하지 않는다 */
export const HEDGE_RE = /\b(allegedly|reportedly|according to (legend|lore)|is said to|it is claimed|purportedly|supposedly|rumou?red)\b/i;
