/**
 * desktop-ai 브릿지 호출. 저우선순위 작업이므로
 *  1) 이 워커 스스로 분당 호출 수를 제한하고
 *  2) 매 호출 전에 브릿지 전체 NVIDIA 사용률을 보고, 코딩 작업 등으로 바쁘면 기다린다.
 */
import { config } from "./config";

export const MODELS = {
  ultra: "junlab/plan-medium", // Nemotron 3 Ultra 550B — 사실 추출·생성
  super: "junlab/plan-low", // Nemotron 3.5 Super 120B — 근거 대조 심사·2차 생성
  deepseek: "deepseek-ai/deepseek-v4.1-flash", // 블라인드 풀이 1
  lightning: "nvidia/nemotron-3.5-lightning-30b-a3b", // 블라인드 풀이 2
  gemma: "google/gemma-4-31b-it", // 예비
} as const;
export type ModelKey = keyof typeof MODELS;

export type Message = { role: "system" | "user" | "assistant"; content: string };
export type CallTrace = { model: ModelKey; ms: number; ok: boolean; error?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- 자체 속도 제한 ---------------------------------------------------------------------
const sent: number[] = [];
async function acquireSlot() {
  for (;;) {
    const now = Date.now();
    while (sent.length && now - sent[0] > 60_000) sent.shift();
    if (sent.length < config.maxRpm) {
      sent.push(now);
      return;
    }
    await sleep(60_000 - (now - sent[0]) + 50);
  }
}

// --- 브릿지 여유 확인 ----------------------------------------------------------------------
let lastStatus = { at: 0, busy: false };
async function bridgeBusy(): Promise<boolean> {
  if (Date.now() - lastStatus.at < 15_000) return lastStatus.busy;
  let busy = false;
  try {
    const r = await fetch(`${config.bridgeUrl}/status`, {
      headers: { Authorization: `Bearer ${config.bridgeKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    const s = (await r.json()) as { nvidia?: { keys?: { sent_last_minute?: number; rpm_limit?: number }[] } };
    const keys = s.nvidia?.keys ?? [];
    const used = keys.reduce((a, k) => a + (k.sent_last_minute ?? 0), 0);
    const cap = keys.reduce((a, k) => a + (k.rpm_limit ?? 0), 0);
    busy = cap > 0 && used / cap > config.maxBridgeShare;
  } catch {
    busy = false; // 상태를 못 읽으면 자체 제한만으로 진행
  }
  lastStatus = { at: Date.now(), busy };
  return busy;
}

async function waitForHeadroom() {
  for (let i = 0; i < 40 && (await bridgeBusy()); i++) await sleep(20_000);
}

// --- 호출 -------------------------------------------------------------------------------
export async function chat(model: ModelKey, messages: Message[], opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}) {
  await waitForHeadroom();
  await acquireSlot();
  const started = Date.now();
  try {
    const r = await fetch(`${config.bridgeUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.bridgeKey}`,
        "Content-Type": "application/json",
        "X-Session-Id": `fightiq-worker-${model}`,
      },
      body: JSON.stringify({
        model: MODELS[model],
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 8000,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? config.callTimeoutMs),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const data = (await r.json()) as { choices: { message: { content?: string | null } }[] };
    return { ok: true as const, content: data.choices[0]?.message?.content ?? "", ms: Date.now() - started };
  } catch (error) {
    return { ok: false as const, error: String(error).slice(0, 300), ms: Date.now() - started };
  }
}

export function parseJson<T = unknown>(text: string): T | null {
  let t = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fence = /```(?:json)?\s*(\{[\s\S]*\})\s*```/.exec(t);
  if (fence) t = fence[1];
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s < 0 || e < 0) return null;
  try {
    return JSON.parse(t.slice(s, e + 1)) as T;
  } catch {
    return null;
  }
}

/** 모델을 순서대로 시도해 JSON 을 받는다 (앞 모델이 실패하면 예비 모델로) */
export async function chatJson<T>(
  models: ModelKey[],
  messages: Message[],
  trace: CallTrace[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<{ model: ModelKey; data: T } | null> {
  for (const model of models) {
    const r = await chat(model, messages, opts);
    const data = r.ok ? parseJson<T>(r.content) : null;
    trace.push({ model, ms: r.ms, ok: !!data, error: r.ok ? (data ? undefined : "JSON 아님") : r.error });
    if (data) return { model, data };
  }
  return null;
}

export async function bridgeSearch(q: string, limit = 8) {
  const r = await fetch(`${config.bridgeUrl}/search?${new URLSearchParams({ q, limit: String(limit) })}`, {
    headers: { Authorization: `Bearer ${config.bridgeKey}` },
    signal: AbortSignal.timeout(40_000),
  });
  if (!r.ok) throw new Error(`search HTTP ${r.status}`);
  const data = (await r.json()) as { results: { url: string; title?: string; content?: string }[] };
  return data.results;
}
