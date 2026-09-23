# 운영 Runbook

- 작성일: 2026-09-23 (OPS-02B)
- 목적: 운영 중 실제로 발생할 수 있는 상황별 대응 절차. 대규모
  monitoring SaaS 연동 없이 기존 `pipeline_logs`/`job_runs`와
  `lib/ops/operational-health-summary.ts`, `npm run ops:preflight`/
  `npm run ops:report-usage`만으로 대응한다.

## 사례별 대응

### A. AI generation 실패

- **증상**: 기사/소셜 글 생성이 완료되지 않고 오류로 끝남.
- **확인 위치**: `pipeline_logs`의 `ai_generation_failed`/
  `social_draft_generation_failed` 이벤트, `lib/ops/operational-health-summary.ts`의
  generation failure 집계.
- **사용자 영향**: 해당 콘텐츠 생성이 mock으로 자동 전환되거나(article
  생성 경로는 mock fallback 있음) 실패 메시지가 표시됨 — 기존 데이터는
  훼손되지 않는다.
- **안전한 조치**: Anthropic API 상태/키 유효성 확인(`npm run
  ops:preflight`), 반복되면 재시도(사용자가 버튼을 다시 누름).
- **하지 말아야 할 것**: 실패를 감추기 위해 mock 결과를 실제 결과처럼
  표시하지 않는다(기존 설계가 이미 구분해서 로그에 남긴다).
- **복구 확인**: 재시도 성공 시 정상 콘텐츠가 저장됐는지 DB로 확인.

### B. JSON parse 반복 실패

- **증상**: 플랫폼별 글 생성이 구조화 출력 파싱 실패로 반복 실패
  (OPS-02A에서 Threads+story tone 사례로 확인).
- **확인 위치**: `social_draft_generation_failed` 이벤트 빈도,
  `lib/social/social-ai-client.ts`의 파싱 실패 카테고리.
- **사용자 영향**: 해당 플랫폼 글만 생성 실패, 다른 플랫폼/재시도에는
  영향 없음.
- **안전한 조치**: tone을 바꿔서 재시도(**사람이 직접** 선택 — 시스템이
  자동으로 tone을 바꾸지 않는다, OPS-02A 섹션 16 원칙). 특정 platform/
  tone 조합에서 반복되면 OPS-02A의 malformed-escape 완화 prompt가
  실제로 적용됐는지 확인.
- **하지 말아야 할 것**: 파서를 관대하게 만들어 불완전한 JSON을 성공
  처리하지 않는다(사실 왜곡 위험).
- **복구 확인**: 재생성된 글이 quality gate를 통과하는지 확인.

### C. eval 실패

- **증상**: `eval_runs.aggregateScore`가 낮거나 `passed=false`.
- **확인 위치**: `eval_runs.notes` — OPS-02A 수정 이후 "실행 실패
  (evaluation_error)"가 명시되면 실제 실행 실패(예: 응답 잘림), 비어
  있으면 진짜 낮은 점수.
- **사용자 영향**: eval은 `saveDraftArticle`을 막지 않는다(경고성
  신호) — journey 자체는 막히지 않는다.
- **안전한 조치**: notes에 "실행 실패"가 있으면 재실행(`npm run
  ops:preflight`로 Anthropic 설정 확인 후). 진짜 낮은 점수면 사람이
  본문을 검토한다.
- **하지 말아야 할 것**: eval score와 quality gate score를 혼동하지
  않는다(서로 다른 시스템, OPS-02A 문서 참고).
- **복구 확인**: 재실행 후 `criteriaScores`가 실제로 채워지는지 확인.

### D. fact-grounding 확인 필요 증가

- **증상**: `fact_grounding` checklist 항목의 "확인 필요" 빈도가
  늘어남.
- **확인 위치**: `social_posts.quality_summary`의 checklist,
  `summarizeAutoReview`의 `"source"` axis.
- **사용자 영향**: **없음(장애 아님)** — 이는 business state(확인
  필요)이지 시스템 오류가 아니다(섹션 14 원칙). 사람이 확인 후
  승인/수정하면 된다.
- **안전한 조치**: 빈도가 급증하면(예: 특정 article mode/platform에서
  집중) 원인이 되는 source 품질을 먼저 살펴본다.
- **하지 말아야 할 것**: 이 항목을 auto-fix 대상으로 옮기지 않는다
  (새 사실 생성 위험, OPS-02A 원칙 유지).
- **복구 확인**: 해당 없음(정상 흐름).

### E. WordPress Draft 실패

- **증상**: Draft 생성/업데이트가 실패로 반환됨.
- **확인 위치**: `publish_logs`(target='wordpress')의 최근 항목,
  `article.wordpress_publish_error`류 필드.
- **사용자 영향**: Draft가 생성/갱신되지 않음 — 기존 Draft가 있었다면
  그대로 유지(덮어쓰지 않음, idempotency 감사 결과 확인됨).
- **안전한 조치**: `npm run ops:preflight`로 WordPress 설정 확인,
  WordPress 사이트 자체의 상태(로그인 가능 여부/REST API 활성화 여부)
  확인 후 재시도.
- **하지 말아야 할 것**: 실패를 무시하고 다른 경로로 우회 게시하지
  않는다.
- **복구 확인**: WordPress 관리자 화면에서 Draft 상태 직접 확인 후
  재시도.

### F. Publish Guard blocked

- **증상**: `platform_publish_guard_status="blocked"`.
- **확인 위치**: `social_posts.platform_publish_guard_summary`(blocked
  사유), `lib/social/publish-guard-issue-view.ts`가 자연어로 변환한
  이유.
- **사용자 영향**: **없음(장애 아님)** — 정상적인 차단(business
  state). QA-01-FIX1에서 이미 "정상 차단"과 "실행 실패"를 분리해
  UI/로그 양쪽에서 구분하도록 고정했다.
- **안전한 조치**: 화면에 표시된 자연어 이유를 확인하고 해당 조건을
  해소한다(승인/체크리스트/대표 이미지 등).
- **하지 말아야 할 것**: guard를 우회하는 코드 경로를 만들지 않는다.
- **복구 확인**: 조건 해소 후 guard 재실행 시 ready로 전환되는지 확인.

### G. Job stalled

- **증상**: `job_runs`의 heartbeat가 오래 갱신되지 않음
  (`detectStalledJobRun`, `lib/job-progress/`).
- **확인 위치**: `job_runs`/`job_run_steps`, `markJobRunStalled`가
  호출된 이력.
- **대응 절차**(OPS-02B에서 확정):
  1. `job_run.targetType`/`targetId`로 **실제 외부 side effect**(WordPress
     Draft 생성, AI 호출)가 이미 완료됐는지 먼저 확인한다 — DB 상태만
     보고 판단하지 않는다.
  2. **같은 job을 무조건 재실행하지 않는다.**
  3. `job_run_steps`에서 마지막으로 완료된 step을 확인해 안전하게
     재개 가능한 지점을 판단한다.
  4. 외부 API가 실제로 호출됐는지 불확실하면(특히 WordPress Draft)
     WordPress 관리자 화면에서 직접 확인한 뒤에만 retry한다.
  5. **자동 무한 retry 로직은 이 코드베이스에 없고, 추가하지 않는다.**
- **하지 말아야 할 것**: stalled를 발견하자마자 같은 job을 자동으로
  다시 큐에 넣지 않는다(중복 side effect 위험).

### H. 비용 급증

- **증상**: `npm run ops:report-usage`의 request/token count가 평소보다
  크게 증가.
- **확인 위치**: `pipeline_logs`의 `social_ai_generation_completed`/
  `social_draft_generation_completed` 이벤트(현재 이 두 이벤트에만
  token 정보가 기록됨 — article 생성/eval/source 요약 AI 호출은 아직
  미계측, OPS-02A/B 문서에 명시된 한계).
- **사용자 영향**: 없음(비용 이슈, 기능 이슈 아님).
- **안전한 조치**: `report-ai-usage`로 어느 article/기간에 집중됐는지
  확인, 반복 생성/재시도 루프가 있었는지 점검.
- **하지 말아야 할 것**: 가격 정보가 없다고 0원으로 간주하지 않는다
  (`costUnavailable`을 그대로 보고한다).
- **복구 확인**: 원인(예: 무한 재시도 스크립트) 제거 후 재측정.

### I. 외부 provider 장애(Anthropic/WordPress/Naver 등)

- **증상**: 특정 provider 호출이 전부 실패.
- **확인 위치**: `npm run ops:preflight`(설정 자체는 정상인지 먼저
  구분), 해당 provider의 공식 status page(프로젝트 밖 정보).
- **사용자 영향**: 해당 provider를 쓰는 기능만 영향(예: Anthropic
  장애 → 생성/평가만 실패, WordPress Draft/기존 조회는 정상).
- **안전한 조치**: 설정 문제가 아님을 preflight로 먼저 확인한 뒤,
  provider 복구를 기다린다. 급하지 않으면 재시도 간격을 두고 기다린다.
- **하지 말아야 할 것**: provider 장애를 우회하기 위해 mock 데이터를
  실제 데이터인 것처럼 저장하지 않는다.
- **복구 확인**: `ops:preflight` 재실행으로 정상화 확인.
