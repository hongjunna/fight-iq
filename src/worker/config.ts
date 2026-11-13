/** 생성 워커 설정 — 모두 환경 변수로 바꿀 수 있다 (.env.example 참고) */

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

function parseHours(spec: string | undefined): [number, number] {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(spec ?? "");
  return m ? [Number(m[1]), Number(m[2])] : [1, 8];
}

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** desktop-ai 브릿지 (junlab-ai 네트워크 내부 주소) */
  bridgeUrl: (process.env.FIQ_BRIDGE_URL ?? "http://junlab-ai:8000").replace(/\/$/, ""),
  bridgeKey: process.env.FIQ_BRIDGE_KEY ?? "",
  /** 생성하는 시간대 (KST, 시작-끝 시, 끝은 포함 안 함). 코딩 사용이 적은 새벽 */
  hours: parseHours(process.env.WORKER_HOURS),
  /** 이 간격마다 깨어나서 할 일이 있는지 본다 */
  intervalMinutes: num("WORKER_INTERVAL_MINUTES", 10),
  /** 한 번 깰 때 처리할 주제 수 / 동시에 처리할 주제 수 */
  batchSize: num("WORKER_BATCH", 6),
  concurrency: num("WORKER_CONCURRENCY", 2),
  /** 하루 최대 생성 시도 수 (KST 하루) */
  dailyCandidates: num("WORKER_DAILY_CANDIDATES", 120),
  /** 이 워커가 스스로 지키는 분당 최대 호출 수 */
  maxRpm: num("WORKER_MAX_RPM", 15),
  /** 브릿지 전체 NVIDIA 사용률이 이보다 높으면 기다린다 (코딩 작업 우선) */
  maxBridgeShare: Number(process.env.WORKER_MAX_BRIDGE_SHARE ?? 0.5),
  /** 조건을 모두 통과한 안전한 칸의 문제를 바로 게시할지 */
  autoPublish: process.env.WORKER_AUTO_PUBLISH !== "off",
  /** 호출 하나의 제한 시간 */
  callTimeoutMs: num("WORKER_CALL_TIMEOUT_SECONDS", 180) * 1000,
  promptVersion: "pipeline-v4",
};

export function inWorkingHours(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(now)) % 24;
  const [start, end] = config.hours;
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}
