# Fight IQ

풀수록 쌓이는 격투 지식 — MMA·복싱·킥복싱·주짓수·레슬링 퀴즈 서비스. https://fightiq.runvia.app

- **스택**: Next.js 16 (App Router) · shadcn/ui (Base UI) · Tailwind CSS 4 · PostgreSQL 17 + Drizzle ORM
- **로그인**: Firebase 구글 로그인 → 서버가 ID 토큰을 구글 공개키로 검증하고 자체 세션 쿠키를 DB에 저장 (서비스 계정 불필요). 비회원도 쿠키(`fiq_anon`)로 바로 플레이하고, 로그인하면 기록이 계정으로 옮겨진다.
- **배포**: Docker Compose (app blue/green + gateway + db) → 호스트 nginx → Cloudflare
- 기획: [docs/기획서.md](docs/기획서.md) · 경기 데이터 수집: [docs/경기데이터_수집방안.md](docs/경기데이터_수집방안.md)

## 기능

| 경로 | 내용 |
|---|---|
| `/` | 홈 — 오늘의 5라운드, 모드, 종목별 문제 수 |
| `/daily` | 오늘의 5라운드 — 날짜(KST)마다 전원 같은 5문제, 난이도 1→4, 하루 1회 |
| `/sparring` | 스파링 — 종목·난이도 골라 10문제, 안 푼 문제 우선 |
| `/test` | Fight IQ 테스트 — 20문제(난이도 고르게), IQ 70~160·유형·벨트 |
| `/play/[id]` | 풀이 화면 — 답을 서버에서 판정하고 해설·출처를 보여 준다. 정답은 미리 내려가지 않는다 |
| `/result/[id]` | 결과 — 공유용 공개 페이지 (본인에게만 문제 다시 보기·레이팅 표시) |
| `/me` | 내 기록 — 레이팅·벨트, 최근 경기, 코너(틀린 문제 복습) |
| `/admin` | 관리자 (`ADMIN_EMAILS`) — 신고 처리, 정답률 이상 문제, 검수 대기 게시/폐기, 문제 JSON 가져오기 |

- **레이팅**: 사용자와 문제를 Elo 로 맞붙인다 ([src/lib/quiz/rating.ts](src/lib/quiz/rating.ts)). 사용자 레이팅 → 벨트, 문제 레이팅 → 실측 난이도.
- **문제 규격**: [src/lib/quiz/schema.ts](src/lib/quiz/schema.ts) (zod). 관리자 가져오기와 AI 생성 워커가 같은 규격을 쓴다. 정답은 보기 id 로 저장하고, 화면에서는 시도마다 보기 순서를 섞는다.
- **시드**: 문제은행이 비어 있으면 첫 실행 때 [src/data/seed-questions.ts](src/data/seed-questions.ts) 26문제를 넣는다 (`SEED_QUESTIONS=off` 로 끔).
- **마이그레이션**: 앱이 뜰 때 `drizzle/` 를 자동 적용한다. 스키마를 바꾸면 `npm run db:generate`.

## AI 문제 생성 워커

[src/worker/](src/worker/) — desktop-ai 브릿지(NVIDIA·검색)로 문제를 만들어 문제은행에 넣는다. 설계와 실험 근거는 [docs/샘플문제_평가.md](docs/샘플문제_평가.md).

1. **계획** ([planner.ts](src/worker/planner.ts)) — 종목×주제 칸 중 문제가 적은 칸을 골라, 이미 있는 문제·최근 시도와 겹치지 않는 구체적 주제를 받는다
2. **출처** ([sources.ts](src/worker/sources.ts)) — 위키백과 + 검색, 1등급(공식·백과)/2등급(주요 매체)/차단(커뮤니티·SNS·영상), 본문 읽기
3. **사실** — 사실마다 원문 인용 필수, 인용이 실제 문서에 있는지 코드로 확인. 주제 위험도별 출처 기준 (기술·용어는 일반 사이트 3곳 일치도 인정, 시점 의존 사실은 1등급 필수)
4. **생성·검사** ([pipeline.ts](src/worker/pipeline.ts)) — 채택된 사실 + 이름 사전([src/data/names.ts](src/data/names.ts))만으로 생성 → 앱과 같은 zod 규격·메타 문장·이름 표기·정답 보기 편차 검사 → 다른 모델이 해설을 문장마다 근거 대조(근거 없는 문장 삭제) → 블라인드 풀이 2명 + "현실에서 맞는 오답" 점검
5. **판정** — 규칙·기술·역사·단체·용어 칸이고, 1등급 출처가 있고, 블라인드 2/2·오답 이상 없음이면 **자동 게시**. 그 밖(인물·기록·시점 의존 등)은 **검수 대기** → `/admin`

| 역할 | 모델 (예비) |
|---|---|
| 사실 추출·생성 | Nemotron 3 Ultra (Super) |
| 해설 근거 대조 | Nemotron 3.5 Super (Ultra) — 생성과 엇갈리게 |
| 블라인드 풀이 | DeepSeek V4.1 Flash, Nemotron 3.5 Lightning (Gemma 4 31B) |

**저우선순위 동작**: 새벽(`WORKER_HOURS`, 기본 1~8시 KST)에만, 분당 `WORKER_MAX_RPM`(15)회 이하로, 그리고 매 호출 전에 브릿지 `/status` 를 봐서 NVIDIA 키 전체 사용률이 `WORKER_MAX_BRIDGE_SHARE`(50%)를 넘으면 기다린다. 하루 최대 `WORKER_DAILY_CANDIDATES`(120)개 시도.

**켜기**: desktop-ai `.env` 의 `API_KEYS` 에 `fightiq:<키>`, `NVIDIA_CLIENTS` 에 `fightiq` 를 추가하고 브릿지를 재시작 → 이 서비스 `.env` 에 `FIQ_BRIDGE_KEY=<키>` → `./deploy.sh`. 지금 바로 몇 개 만들어 보려면:
```bash
docker compose --profile worker run --rm worker node_modules/.bin/tsx src/worker/main.ts --once --count 3
```

## 처음 배포

1. **Firebase**: 프로젝트를 만들고 Authentication → 로그인 방법에서 Google 사용, 승인된 도메인에 `fightiq.runvia.app` 추가. 웹 앱을 등록해 설정값을 받는다.
2. **Cloudflare DNS**: `fightiq` 레코드(프록시 켬)를 다른 `*.runvia.app` 과 같은 서버로.
3. **서버**:
   ```bash
   cd ~/dockers/fight-iq
   cp .env.example .env     # Firebase 값, POSTGRES_PASSWORD, ADMIN_EMAILS 채우기
   ./deploy.sh --nginx      # 처음 한 번은 호스트 nginx vhost 까지
   ```
   이후 배포는 `./deploy.sh`. 새 슬롯이 `/api/health` 를 통과해야 트래픽을 넘기고, 실패하면 기존 릴리스가 그대로 남는다.

**nginx**: `*.runvia.app` HTTPS 는 서버의 `/etc/nginx/conf.d/runvia-wildcard-ssl.conf` 가 받아 :80 으로 넘기므로, 이 저장소는 HTTP vhost([nginx/fightiq.runvia.app.conf](nginx/fightiq.runvia.app.conf)) 하나만 설치한다 (sdrift 등과 같은 방식). `--nginx` / `--nginx-only` 는 일회용 nginx 컨테이너로 문법을 검사한 뒤 `sites-available`·`sites-enabled` 에 넣고(nginx-admin 그룹 권한, sudo 불필요), 다시 읽기는 sudo 가 비밀번호 없이 되면 바로 하고 아니면 `sudo nginx -t && sudo systemctl reload nginx` 를 안내한다. 앱 배포 전에 도메인부터 연결하려면 `./deploy.sh --nginx-only`.

> 코드는 git 원격 저장소가 있으면 `deploy.sh` 가 `git pull` 로 받는다. 원격이 없으면 지금 폴더 파일 그대로 배포한다 (`SKIP_PULL=1` 로 강제 가능).

## 로컬 개발

```bash
npm install
# .env.local 에 DATABASE_URL 과 NEXT_PUBLIC_FIREBASE_* 를 넣고
npm run dev
```
