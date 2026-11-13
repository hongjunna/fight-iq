/**
 * 주제 하나 → 문제 하나 (docs/기획서.md §6, docs/샘플문제_평가.md §4-1).
 *
 *  1. 검색 + 위키백과 → 출처 등급 (커뮤니티·SNS 차단)
 *  2. 본문 읽기
 *  3. 사실 추출 — 사실마다 원문 인용 필수, 인용이 문서에 실제로 있는지 코드로 확인
 *  4. 사실 채택 — 주제 위험도별 출처 기준
 *  5. 문제 생성 — 채택된 사실 + 이름 사전만으로
 *  6. 기계 검사 — 앱과 같은 zod 규격, 메타 문장, 이름 표기, 정답 보기 길이 편차
 *  7. 해설 문장 대조 — 생성과 다른 모델이 문장마다 근거 확인, 근거 없는 문장 삭제 (반박되면 재생성 1회)
 *  8. 블라인드 풀이 2명 — 정답 일치 + "현실에서는 맞는 오답" 표시
 */
import { NAME_DICTIONARY, nameDictionaryText } from "@/data/names";
import { questionInputSchema, type QuestionInput, type Source } from "@/lib/quiz/schema";
import type { Sport, Topic } from "@/lib/quiz/taxonomy";
import { config } from "./config";
import { bridgeSearch, chatJson, type CallTrace, type ModelKey } from "./llm";
import { domainOf, fetchText, HEDGE_RE, quoteInDoc, relevantExcerpt, tierOf, wikipediaPages, type Tier } from "./sources";

export type Risk = "low" | "normal" | "high";

export type Subject = {
  sport: Sport;
  topic: Topic;
  difficulty: number;
  /** 영어로 쓴 구체적인 출제 주제 */
  brief: string;
  queries: string[];
  risk: Risk;
  /** 규칙 개정·현재 기록처럼 시점에 따라 바뀌는 주제 */
  versioned: boolean;
};

export type AcceptedFact = {
  id: string;
  statementEn: string;
  timeSensitive: boolean;
  hedged: boolean;
  supports: { url: string; tier: Tier; quote: string }[];
};

export type PipelineResult = {
  verdict: "published" | "review" | "rejected" | "error";
  reason?: string;
  question?: QuestionInput;
  facts: AcceptedFact[];
  trace: Record<string, unknown>;
  calls: CallTrace[];
};

type Doc = { id: string; url: string; tier: Tier; text: string };

const META_RE = /(근거|제시된|검색 결과|출처에 따르면|자료에 따르면|위 문서|주어진 (자료|사실|문서)|사실 목록)/;
const AUTO_PUBLISH_TOPICS: Topic[] = ["rules", "technique", "history", "orgs", "culture"];

// --- 프롬프트 -----------------------------------------------------------------------------

const EXTRACT_SYS = `You extract verifiable facts for a combat-sports quiz.
From the [DOCUMENTS], extract 3-8 atomic facts relevant to the [TOPIC]. Rules:
- Every fact MUST be supported by one or more VERBATIM quotes copied exactly from the documents (one sentence each, max 300 chars). Do not paraphrase quotes.
- List every supporting quote you can find, from as many DIFFERENT documents as possible (Wikipedia included).
- If documents disagree, do not output that fact.
- "time_sensitive": true if the fact could change over time (current champions/rankings, amended rules, records still being extended).
Output JSON only: {"facts":[{"statement_en":"...","time_sensitive":false,"supports":[{"doc":"D1","quote":"..."}]}]}`;

const GEN_SYS = `너는 한국 격투 퀴즈 서비스 'Fight IQ'의 출제위원이다. [검증된 사실]만으로 4지선다 문제 1개를 만든다.

규칙:
- 문항·정답·해설은 [검증된 사실]에 있는 내용만 쓴다. 사실에 없는 숫자·날짜·라운드·별칭·대회명은 절대 쓰지 않는다.
- 주제의 핵심을 묻는다. 지엽적인 운영 정보(회사명, 건물 층수 등)보다 팬이 흥미로워할 사실을 고른다.
- 정답은 정확히 1개. 오답 보기는 정답과 같은 종류의 값(선수는 선수, 연도는 연도, 단체는 단체)으로, 그럴듯하지만 분명히 틀린 것.
- 현실에서 사실인 내용을 오답으로 쓰지 않는다 (예: 그 선수의 다른 실제 기록).
- 정답 보기만 길거나 괄호·설명이 붙어 더 구체적이면 안 된다. 네 보기의 형식과 길이를 맞춘다.
- "모두 맞다/틀리다" 금지.
- [hedged] 표시 사실은 "~로 전해진다/알려져 있다"로 쓴다.
- [time-sensitive] 사실을 쓰면 문항에 기준 연도를 넣고 temporal 을 {"kind":"as_of","as_of":"YYYY-MM-DD"} 로 (날짜 필수).
- 인명·고유명사는 [표기 사전]의 한국어 표기를 그대로 쓴다. 일본 인명은 성-이름 순.
- 해설(explanation)은 2~3문장: 정답 이유 + 알아두면 좋은 배경. 각 문장은 [검증된 사실]로 뒷받침돼야 한다.
- "근거", "제시된", "자료에 따르면" 같은 출제 과정 표현은 쓰지 않는다. 독자는 사실 목록을 보지 못한다.
- 영어(en) 버전도 같은 문제로 작성 (보기 id·정답 동일).
{feedback}
JSON 하나만 출력:
{"fact_ids":["F1"],"difficulty":1-5,"temporal":{"kind":"evergreen"},"answer_choice_id":"a|b|c|d",
 "ko":{"stem":"...","choices":[{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],"explanation":"..."},
 "en":{"stem":"...","choices":[...],"explanation":"..."}}`;

const CHECK_SYS = `You are a strict fact-checker for a combat-sports quiz. You get [FACTS] (each with verbatim source quotes) and a Korean multiple-choice question.
Judge ONLY against the facts and quotes, not your memory.
Output JSON only:
{"answer_supported":true|false,
 "other_correct_choices":["ids of wrong choices that the facts show could ALSO be correct"],
 "stem_ambiguous":true|false,
 "sentences":[{"n":1,"verdict":"supported|unsupported|contradicted","reason":"short"}],
 "issues":"short summary in Korean"}
A sentence is "supported" only if every factual claim in it (numbers, dates, names, rounds, rankings) is in the facts/quotes.`;

const SOLVE_SYS = `너는 격투 스포츠 전문가다. 4지선다 문제를 풀고, 네 지식으로 보기를 점검한다. JSON 하나만:
{"choice_id":"a|b|c|d","confidence":0.0-1.0,"ambiguous":true|false,
 "true_distractors":["네가 고르지 않은 보기 중 현실에서도 사실이라 정답으로 볼 수 있는 보기 id"],"comment":"한 문장"}`;

// --- 단계 --------------------------------------------------------------------------------

async function gatherDocs(subject: Subject, trace: Record<string, unknown>): Promise<Doc[]> {
  const seen = new Set<string>();
  const found: { url: string; tier: Tier }[] = [];
  const add = (url: string) => {
    if (seen.has(url)) return;
    seen.add(url);
    found.push({ url, tier: tierOf(url) });
  };
  for (const url of await wikipediaPages(subject.queries[0] ?? subject.brief)) add(url);
  const searchErrors: string[] = [];
  for (const q of subject.queries.slice(0, 3)) {
    try {
      for (const r of await bridgeSearch(q)) add(r.url);
    } catch (error) {
      searchErrors.push(String(error));
    }
  }
  if (searchErrors.length) trace.searchErrors = searchErrors;
  trace.blocked = found.filter((f) => f.tier === 0).map((f) => f.url);
  const candidates = found.filter((f) => f.tier > 0).sort((a, b) => a.tier - b.tier).slice(0, 8);
  const keywords = subject.brief.match(/[A-Za-z][A-Za-z'-]+|\d+/g) ?? [];

  const docs: Doc[] = [];
  for (const c of candidates) {
    // 1등급(위키백과 등)은 긴 문서가 많아 더 넉넉히 읽는다 — 핵심 문단이 잘려 사실을 놓치지 않도록
    const text = relevantExcerpt(await fetchText(c.url), keywords, c.tier === 1 ? 9000 : 5000);
    if (text.length > 200) docs.push({ id: `D${docs.length + 1}`, url: c.url, tier: c.tier, text });
    if (docs.length >= 5) break;
  }
  trace.docs = docs.map((d) => ({ id: d.id, url: d.url, tier: d.tier, chars: d.text.length }));
  return docs;
}

function acceptFact(supports: AcceptedFact["supports"], subject: Subject, timeSensitive: boolean) {
  const tier1 = supports.some((s) => s.tier === 1);
  const tier2Domains = new Set(supports.filter((s) => s.tier === 2).map((s) => domainOf(s.url)));
  const tier3Domains = new Set(supports.filter((s) => s.tier === 3).map((s) => domainOf(s.url)));
  if (subject.versioned || timeSensitive) return tier1; // 시점에 따라 바뀌는 사실은 공식·백과 출처 필수
  if (tier1 || tier2Domains.size >= 2) return true;
  // 기술·용어처럼 바뀌지 않고 틀려도 피해가 작은 주제는 서로 다른 일반 사이트 3곳 일치도 인정
  return subject.risk === "low" && tier2Domains.size + tier3Domains.size >= 3;
}

async function extractFacts(subject: Subject, docs: Doc[], calls: CallTrace[], trace: Record<string, unknown>) {
  const docBlock = docs.map((d) => `[${d.id}] ${d.url} (tier ${d.tier})\n${d.text}`).join("\n\n");
  const res = await chatJson<{ facts?: { statement_en?: string; time_sensitive?: boolean; supports?: { doc?: string; quote?: string }[] }[] }>(
    ["ultra", "super"],
    [{ role: "system", content: EXTRACT_SYS }, { role: "user", content: `[TOPIC] ${subject.brief}\n\n[DOCUMENTS]\n${docBlock}` }],
    calls,
    { maxTokens: 12000 },
  );
  const byId = new Map(docs.map((d) => [d.id, d]));
  const accepted: AcceptedFact[] = [];
  const rejected: { statement: string; verified: Tier[] }[] = [];
  for (const f of res?.data.facts ?? []) {
    if (!f.statement_en) continue;
    const supports = (f.supports ?? []).flatMap((s) => {
      const d = byId.get(s.doc ?? "");
      return d && s.quote && quoteInDoc(s.quote, d.text) ? [{ url: d.url, tier: d.tier, quote: s.quote }] : [];
    });
    const timeSensitive = !!f.time_sensitive;
    if (acceptFact(supports, subject, timeSensitive)) {
      accepted.push({
        id: `F${accepted.length + 1}`,
        statementEn: f.statement_en,
        timeSensitive,
        hedged: supports.some((s) => HEDGE_RE.test(s.quote)),
        supports,
      });
    } else {
      rejected.push({ statement: f.statement_en, verified: supports.map((s) => s.tier) });
    }
  }
  trace.facts = { accepted: accepted.map((f) => ({ id: f.id, statement: f.statementEn, tiers: f.supports.map((s) => s.tier) })), rejected };
  return accepted;
}

function factBlock(facts: AcceptedFact[]) {
  return facts
    .map(
      (f) =>
        `${f.id}: ${f.statementEn}${f.timeSensitive ? " [time-sensitive]" : ""}${f.hedged ? " [hedged]" : ""}` +
        f.supports
          .slice(0, 2)
          .map((s) => `\n   - "${s.quote}" (${s.url})`)
          .join(""),
    )
    .join("\n");
}

type Generated = {
  fact_ids?: string[];
  difficulty?: number;
  temporal?: { kind: string; as_of?: string };
  answer_choice_id?: string;
  ko?: { stem: string; choices: { id: string; text: string }[]; explanation: string };
  en?: { stem: string; choices: { id: string; text: string }[]; explanation: string };
};

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/** 생성 결과 → 앱 문제 규격. 규격 오류·메타 문장·이름 표기·정답 보기 편차를 함께 검사한다 */
function toQuestionInput(gen: Generated, subject: Subject, facts: AcceptedFact[]): { input?: QuestionInput; errors: string[] } {
  const errors: string[] = [];
  const used = facts.filter((f) => gen.fact_ids?.includes(f.id));
  const usedFacts = used.length ? used : facts;
  const temporal =
    gen.temporal?.kind === "as_of" || usedFacts.some((f) => f.timeSensitive)
      ? { kind: "as_of" as const, as_of: /^\d{4}-\d{2}-\d{2}$/.test(gen.temporal?.as_of ?? "") ? gen.temporal!.as_of! : todayIso() }
      : subject.versioned
        ? { kind: "rule_versioned" as const }
        : { kind: "evergreen" as const };

  const sources: Source[] = [];
  for (const f of usedFacts) for (const s of f.supports) if (!sources.some((x) => x.url === s.url)) sources.push({ url: s.url, accessed_at: todayIso() });

  const parsed = questionInputSchema.safeParse({
    type: "single_choice",
    sport: subject.sport,
    topics: [subject.topic],
    difficulty: Math.min(5, Math.max(1, Math.round(gen.difficulty ?? subject.difficulty))),
    temporal,
    region: subject.topic === "korea" ? ["kr"] : ["global"],
    answer: { choice_id: gen.answer_choice_id },
    content: { ko: gen.ko, ...(gen.en ? { en: { ...gen.en, translation: { status: "original" } } } : {}) },
    sources: sources.slice(0, 6),
    provenance: {},
    status: "review",
  });
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((i) => `규격: ${i.path.join(".")} ${i.message}`) };
  }
  const q = parsed.data;
  const ko = q.content.ko;
  const meta = META_RE.exec(`${ko.stem} ${ko.explanation}`);
  if (meta) errors.push(`출제 과정 표현 금지: "${meta[0]}"`);

  const koAll = [ko.stem, ko.explanation, ...ko.choices.map((c) => c.text)].join(" ");
  const enAll = q.content.en ? [q.content.en.stem, q.content.en.explanation, ...q.content.en.choices.map((c) => c.text)].join(" ") : "";
  for (const [en, kr] of Object.entries(NAME_DICTIONARY)) {
    if (new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(enAll) && !koAll.includes(kr)) {
      errors.push(`이름 표기: ${en} → "${kr}" 로 써야 함`);
    }
  }

  const answer = ko.choices.find((c) => c.id === q.answer.choice_id)!;
  const others = ko.choices.filter((c) => c.id !== q.answer.choice_id);
  const avg = others.reduce((s, c) => s + c.text.length, 0) / others.length;
  if (answer.text.length > avg * 1.8 && answer.text.length - avg > 8) errors.push("정답 보기만 유난히 길다 (힌트가 됨)");
  if (/[()]/.test(answer.text) && !others.some((c) => /[()]/.test(c.text))) errors.push("정답 보기에만 괄호 설명이 있다 (힌트가 됨)");
  return { input: q, errors };
}

const splitSentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

export async function runSubject(subject: Subject): Promise<PipelineResult> {
  const trace: Record<string, unknown> = { subject };
  const calls: CallTrace[] = [];
  const done = (verdict: PipelineResult["verdict"], reason: string, extra: Partial<PipelineResult> = {}): PipelineResult => ({
    verdict, reason, facts: [], trace, calls, ...extra,
  });

  try {
    const docs = await gatherDocs(subject, trace);
    if (docs.length === 0) return done("rejected", "읽을 수 있는 출처 없음");
    const facts = await extractFacts(subject, docs, calls, trace);
    if (facts.length === 0) return done("rejected", "출처 기준을 통과한 사실 없음");

    const block = factBlock(facts);
    let feedback = "";
    const attempts: Record<string, unknown>[] = [];
    trace.attempts = attempts;

    for (let attempt = 0; attempt < 2; attempt++) {
      const att: Record<string, unknown> = {};
      attempts.push(att);
      const gen = await chatJson<Generated>(
        attempt === 0 ? ["ultra", "super"] : ["super", "ultra"],
        [
          { role: "system", content: GEN_SYS.replace("{feedback}", feedback) },
          {
            role: "user",
            content: `[주제] 종목=${subject.sport} 주제=${subject.topic} 목표난이도=${subject.difficulty}\n${subject.brief}\n\n[검증된 사실]\n${block}\n\n[표기 사전]\n${nameDictionaryText()}`,
          },
        ],
        calls,
        { maxTokens: 8000, temperature: 0.5 },
      );
      if (!gen) {
        att.error = "생성 실패";
        continue;
      }
      att.generator = gen.model;
      const { input, errors } = toQuestionInput(gen.data, subject, facts);
      att.mechanical = errors;
      if (!input || errors.length) {
        feedback = `\n[이전 시도의 문제점 — 반드시 고칠 것]\n- ${errors.join("\n- ")}`;
        continue;
      }

      // 해설 문장 대조 (생성과 다른 모델)
      const ko = input.content.ko;
      const sentences = splitSentences(ko.explanation);
      const qText =
        `${ko.stem}\n${ko.choices.map((c) => `${c.id}) ${c.text}`).join("\n")}\n정답: ${input.answer.choice_id}\n해설 문장:\n` +
        sentences.map((s, i) => `${i + 1}. ${s}`).join("\n");
      const checkers: ModelKey[] = gen.model === "ultra" ? ["super", "ultra"] : ["ultra", "super"];
      const chk = await chatJson<{
        answer_supported?: boolean;
        other_correct_choices?: string[];
        stem_ambiguous?: boolean;
        sentences?: { n: number; verdict: string }[];
        issues?: string;
      }>(checkers, [{ role: "system", content: CHECK_SYS }, { role: "user", content: `[FACTS]\n${block}\n\n[QUESTION]\n${qText}` }], calls, {
        maxTokens: 8000,
        temperature: 0.1,
      });
      att.check = chk?.data ?? null;
      if (!chk) continue;
      const verdicts = new Map((chk.data.sentences ?? []).map((s) => [s.n, s.verdict]));
      const contradicted = [...verdicts.values()].includes("contradicted");
      if (!chk.data.answer_supported || chk.data.other_correct_choices?.length || chk.data.stem_ambiguous || contradicted) {
        feedback = `\n[이전 시도의 문제점 — 반드시 고칠 것]\n- ${chk.data.issues ?? "정답 근거 부족 또는 애매함"}`;
        continue;
      }
      const kept = sentences.filter((_, i) => verdicts.get(i + 1) === "supported");
      att.removedSentences = sentences.filter((_, i) => verdicts.get(i + 1) !== "supported");
      if (kept.length === 0) {
        feedback = "\n[이전 시도의 문제점]\n- 해설 문장이 사실로 뒷받침되지 않음. 검증된 사실 안의 내용만 쓸 것";
        continue;
      }
      input.content.ko.explanation = kept.join(" ");

      // 블라인드 풀이 2명 (정답 숨김) + 현실에서 맞는 오답 점검
      const prompt = `${ko.stem}\n${ko.choices.map((c) => `${c.id}) ${c.text}`).join("\n")}`;
      const solves: Record<string, { choice_id?: string; true_distractors?: string[]; comment?: string }> = {};
      for (const pool of [["deepseek", "gemma", "super"], ["lightning", "gemma"]] as ModelKey[][]) {
        const r = await chatJson<{ choice_id?: string; true_distractors?: string[]; comment?: string }>(
          pool.filter((m) => !(m in solves)),
          [{ role: "system", content: SOLVE_SYS }, { role: "user", content: prompt }],
          calls,
          { maxTokens: 1500, temperature: 0.1, timeoutMs: 120_000 },
        );
        if (r) solves[r.model] = r.data;
      }
      att.blind = solves;
      const agree = Object.values(solves).filter((s) => s.choice_id === input.answer.choice_id).length;
      const flaggedDistractors = [
        ...new Set(Object.values(solves).flatMap((s) => (s.true_distractors ?? []).filter((id) => id !== input.answer.choice_id))),
      ];

      const hasTier1 = facts.some((f) => f.supports.some((s) => s.tier === 1));
      input.provenance = {
        origin: "worker",
        prompt_version: config.promptVersion,
        generator: gen.model,
        checker: chk.model,
        solvers: Object.keys(solves),
        blind_agree: `${agree}/${Object.keys(solves).length}`,
        removed_sentences: (att.removedSentences as string[]).length,
        flagged_distractors: flaggedDistractors,
        risk: subject.risk,
      };

      if (agree === 0) return done("rejected", "블라인드 풀이 0명 일치", { facts });
      const safe =
        agree === 2 &&
        flaggedDistractors.length === 0 &&
        hasTier1 &&
        subject.risk !== "high" &&
        !subject.versioned &&
        input.temporal.kind === "evergreen" &&
        AUTO_PUBLISH_TOPICS.includes(subject.topic);
      const reason =
        agree < 2
          ? `블라인드 ${agree}/${Object.keys(solves).length}`
          : flaggedDistractors.length
            ? `현실에서 맞을 수 있는 오답: ${flaggedDistractors.join(",")}`
            : safe
              ? undefined
              : "위험도·주제 기준상 사람 확인 필요";
      if (safe && config.autoPublish) {
        input.status = "published";
        return { verdict: "published", reason, question: input, facts, trace, calls };
      }
      input.status = "review";
      return { verdict: "review", reason, question: input, facts, trace, calls };
    }
    return done("rejected", "2회 시도 후에도 검사 실패", { facts });
  } catch (error) {
    return done("error", String(error).slice(0, 300));
  }
}
