# OPS-02B: Production Readiness & Operational Safety

- 작성일: 2026-09-23
- 범위: 비용 가시성, 환경 사전점검(preflight), 실패/차단 모니터링
  분리, retry/idempotency 감사, 백업/복구 절차, 배포 체크리스트,
  public publish server-side 안전성 최종 감사. 새 콘텐츠 기능/UI
  재설계/DB 대규모 변경/새 AI provider는 하지 않았다.

## 1. Environment inventory 결과

`docs/ops/environment-inventory.md`에 42개 `process.env.*` 변수를
전수 분류했다(Required 3 — Supabase / Required-for-feature ~6 —
Anthropic·WordPress·검색 provider / Dangerous flag ~7 — WordPress/SEO/
platform-API publish 토글, 전부 `=== "true"` 엄격 비교로 fail-closed
확인 / 나머지 Optional). `PLATFORM_API_PUBLISHING_ENABLED`류 "미래
게시" 플래그 8종은 실제로 어떤 실제 게시도 트리거하지 않음을 확인했다
(기존 `lib/social/feature-flag-safety-auditor.ts`가 이미 감사하고
있었음 — 재사용).

## 2. production preflight 구현 방식

`lib/ops/production-preflight.ts` — 순수 함수
`runProductionPreflight()`가 Supabase/Anthropic/WordPress Draft/검색
provider/Public publish/Mock·dangerous flag 6개 영역을 pass/warning/fail로
분류해 반환한다. 기존 헬퍼(`isWordPressConfigured`,
`shouldUseAnthropic`, `auditPublishingFeatureFlags` 등)를 재사용했다 —
새 검증 로직을 중복 구현하지 않았다. **secret 값은 절대 출력하지
않는다**(`configured: true/false`만) — 실제 secret 형태의 값을 주입한
테스트로 출력 어디에도 나타나지 않음을 확인했다. CLI:
`scripts/ops/preflight.ts`(`npm run ops:preflight`), 실제 `.env.local`로
실행한 결과 6개 영역 전부 `PASS`, `Overall: PASS`.

## 3. production-safe default 감사 결과

- `WORDPRESS_PUBLISH_ENABLED`는 `process.env.WORDPRESS_PUBLISH_ENABLED === "true"`
  엄격 비교 — 누락/오타/false는 전부 안전한 dry-run으로 fallback(fail
  closed 확인).
- **이 프로젝트에는 "public publish enabled" 전용 env 플래그가
  없다** — 공개 게시는 순전히 DB 상태(`checkPublicPublishGuard`)로만
  게이트된다. 이는 의도된 설계이며(환경변수 하나를 끄고 켜는 것으로
  공개 게시를 제어하지 않고, article별 조건으로 제어) preflight에
  "DISABLED by design"으로 문서화했다.
- approval bypass/publish guard bypass 경로 없음을 코드로 확인(아래
  6절 참고).

## 4. token usage 저장 신뢰성

OPS-02A에서 확인한 `social_ai_generation_completed`/
`social_draft_generation_completed`의 `inputTokens`/`outputTokens`
저장을 재확인했고, **모델 식별자가 누락되어 있던 실제 gap을 발견해
수정**했다(`lib/social/social-draft-generation-service.ts`에 `model:
getSocialAiModel()` 추가) — 모델별 가격 매핑이 향후 모델 변경에도
정확히 연결되도록.

**한계(정직하게 기록)**: article 생성(`generateAiArticleDraft`)/eval
(`evaluateArticleWithAi` 등)/source 요약 AI 호출은 아직 token 사용량을
로그에 남기지 않는다 — 현재 비용 리포트는 소셜 플랫폼 생성 호출만
커버한다. OPS-02C 이후 계측 확대 후보로 남긴다.

## 5. pricing 구조

`lib/ops/model-pricing.ts` — `PRICING_TABLE`은 **의도적으로 빈
배열로 출발한다**(근거 없는 가격 추정 금지 원칙을 가장 엄격하게
지킨 선택 — placeholder 숫자조차 넣지 않았다). `ModelPricingEntry`에
`effectiveFrom`을 지원해 시점별 가격 적용이 가능하다. 실제 가격은
운영자가 공식 provider 가격 자료를 확인한 뒤 이 테이블에 직접
채워 넣어야 한다(코드 주석에 방법 명시).

## 6. unknown price 처리

`lookupModelPrice`/`calculateRequestCost`는 가격이 없는 모델에 대해
**항상 `costUnavailable`을 반환하고 절대 0으로 계산하지 않는다**(테스트로
고정).

## 7. 비용 집계 방식

`lib/ops/ai-cost-aggregator.ts` — `aggregateAiUsage`/
`aggregateAiUsageByArticle`이 request/token 합계와 함께
`requestsWithKnownCost`/`requestsWithUnknownCost`를 분리 집계한다 —
unknown-price 요청이 0원으로 섞여 들어가지 않는다.

## 8. 비용 report script 결과

`scripts/ops/report-ai-usage.ts`(`npm run ops:report-usage`)를 실제
DB에 대해 1회 실행(읽기 전용, AI 호출 없음): **81 requests, input
553,938 / output 217,222 tokens, article 15건, known cost 0건 / unknown
81건**(가격 테이블이 비어 있으므로 정직하게 전부 unknown으로
보고됨 — 추측 비용을 만들지 않았다).

## 9. operational health signal

`lib/ops/operational-health-summary.ts`가 기존 `pipeline_logs`를
집계해 job 완료/실패/stalled, 실행 실패(생성/구조화출력/WordPress
Draft), **business-blocked 상태(별도 버킷, failure에 미포함)**를
반환한다. 알려진 계측 공백: article eval 실행 실패는 현재
`pipeline_logs`에 기록되지 않는다(`eval-article.ts`의 실패가 `notes`
문자열에만 남고 `logEvent`를 호출하지 않음) — `evaluationFailuresNotInstrumented: true`
플래그로 명시했다(조용히 0으로 보이지 않게).

## 10. blocked vs failed 운영 분리

QA-01-FIX1과 동일한 패턴(정상 차단은 `status: "success"`, 진짜 실행
실패만 `"failed"`)이 아직 적용되지 않은 지점 6곳을 발견해 수정했다:
`social-post-service.ts`, `publish-quality-gate-service.ts`(1차
`pipeline_logs` 로그),`post-auto-fix-service.ts`,
`rewrite-version-comparison-service.ts`,
`rewrite-version-quality-recheck-service.ts`,
`social-draft-generation-service.ts`.

**추가로 코디네이터가 직접 발견한 잔여 항목(수정하지 않음, backlog)**:
`publish-quality-gate-service.ts`에는 같은 함수 안에 **두 번째**
로그 호출(`savePublishLog`, `publish_logs` 테이블)이 있는데, 이
테이블의 `PublishLogStatus` 타입은 `"success"|"failed"|"dry_run"|"skipped"`
4종뿐이라(`pipeline_logs`의 `LogStatus`처럼 중립적인 "success+상세는
details로" 패턴을 적용할 마땅한 값이 없음) `status === "blocked" ?
"failed" : "success"`가 남아 있다. 이 테이블이 실제로 raw "failed"
배지를 사용자에게 노출하는 소비처가 있는지 확인했으나 발견하지
못했다(`app/articles/[id]/page.tsx`가 읽는 `latestWordPressLog`는 이
테이블이 아니라 `target='wordpress'`의 별도 로그다) — 당장 UI
혼동으로 이어지지는 않지만, 스키마 자체가 QA-01-FIX1과 같은
개념 분리를 지원하지 못하는 구조적 한계로 남겨 **Medium**으로
기록한다(OPS-03 이전 재검토 권고, `publish_logs.status`에 neutral
값을 추가하려면 스키마 변경이 필요해 이번 Phase 범위를 벗어난다고
판단).

## 11. retry/idempotency 감사 결과

| Action | 결과 |
|---|---|
| article generation | 안전 — 기존 확인 게이트(재생성 전 사용자 확인) |
| platform generation | 안전 — 현재 상태 기반 재계산 |
| auto review | 안전 — rule-based, 누적 상태 없음 |
| auto fix | 안전 — 현재 checklist 기준 재계산 |
| WordPress Draft create | **안전(update-in-place)** — 기존 성공 draft 존재 확인 후 재실행 시 새로 만들지 않고 기존 post를 업데이트 |
| WordPress Draft update | 안전 — 위와 동일 경로 |
| manual posting result 기록 | **Medium gap 발견 → 수정 완료** — 아래 참고 |
| bulk approval | 안전 — 이미 승인된 항목은 재검증에서 자연스럽게 제외(OPS-01에서 이미 확인) |

## 12. 발견한 idempotency gap

`lib/social/platform-manual-posting-result-service.ts`의
`checkRecordable`이 `publishStatus`가 blocked/failed인 경우만 막고
**이미 `manualPostStatus === "posted"`인 경우를 막지 않아**, 중복
제출 시 기록된 URL/시각/작성자가 조용히 덮어써질 수 있었다. 한 줄
가드 추가로 수정, 회귀 테스트 추가.

## 13. stalled job 대응 정책

이 코드베이스에는 이미 완전한 `job_runs`/`job_run_steps` 시스템
(`lib/job-progress/`)과 `detectStalledJobRun()`(순수 함수, heartbeat
2분 초과 시 stalled 판정)이 있다 — **자동 무한 retry는 어디에도
없고, 이번 Phase에서도 추가하지 않았다.** 대응 절차는
`docs/ops/operations-runbook.md`의 "G. Job stalled" 절에 5단계로
문서화했다(외부 side effect 확인 → 무조건 재실행 금지 → 마지막
완료 step 확인 → 불확실하면 직접 WordPress 확인 후에만 retry →
자동 무한 retry 없음).

## 14. backup/recovery 조사 결과

Supabase provider의 실제 백업/PITR 가용 범위는 plan에 따라 다르므로
추측하지 않았다 — `docs/ops/recovery-runbook.md`에 "운영자가 직접
Supabase 대시보드에서 확인" 절차로 명시했다. 이 프로젝트 자체가
책임지는 부분(migration 파일 관리, 재생성 가능/보존 중요 데이터
분류)은 실제 `db/schema.sql`(46개 migration) 기준으로 분류했다.

## 15. recovery runbook

`docs/ops/recovery-runbook.md` — 8단계 restore drill(배포 중지 →
장애 범위 판단 → snapshot 확인 → migration 상태 확인 → restore →
preflight → smoke test → side effect 기능 재활성화). 실제 파괴적
테스트는 수행하지 않았다.

## 16. deployment checklist

`docs/ops/deployment-checklist.md` — Before/Deploy/After/Rollback
4단계. **접근 제어 확인을 필수 항목으로 포함**했다(18절 참고).
WordPress Draft 생성은 배포 스모크 테스트 대상에서 명시적으로
제외했다(실제 외부 side effect 방지).

## 17. operations runbook

`docs/ops/operations-runbook.md` — A~I 9개 사례(AI generation
실패/JSON parse 반복 실패/eval 실패/fact-grounding 확인 필요
증가/WordPress Draft 실패/Publish Guard blocked/Job stalled/비용
급증/외부 provider 장애)를 증상/확인 위치/사용자 영향/안전한 조치/
하지 말아야 할 것/복구 확인 형식으로 정리했다.

## 18. public publish server-side safety 감사 결과

코디네이터가 직접 코드를 재검증했다(`docs/ops/platform-capability-matrix.md`
참고, "접혀 있으므로 안전"이라고 가정하지 않았다):

- **server-side guard 존재 확인**: `checkPublicPublishGuard()`가
  article 상태/quality gate/승인/대표 이미지/WordPress draft
  존재/중복 게시 방지를 전부 fail-closed로 검증하고, guard를 통과하지
  못하면 물리적으로 WordPress API 호출 경로에 도달하지 않는다(코드
  흐름상 우회 불가).
- **실제 gap 발견 — High**: 이 프로젝트 전체에 **애플리케이션 레벨
  인증/인가가 없다**(`middleware.ts` 없음, 세션/로그인 검사 코드 전무,
  전수 검색으로 확인). "누가 이 버튼을 눌렀는가"를 앱이 전혀 검증하지
  않는다. 이번 Phase 범위(새 인증 시스템 구축 금지)에 따라 앱 코드로
  고치지 않고, **배포 필수 전제조건**으로 고정했다: 호스팅/인프라
  레벨 접근 제어(Deployment Protection/reverse proxy auth/IP
  allowlist/VPN) 없이는 공개 URL로 배포하지 않는다 —
  `docs/ops/deployment-checklist.md`의 "Before deploy" 필수 항목으로
  포함.

## 19. 최종 platform capability matrix

`docs/ops/platform-capability-matrix.md`에 고정. 8개 플랫폼
어댑터(`lib/social/platform-adapters/*.ts`) 전부 `publish()`가
`disabledPublishResult()`만 반환함을 직접 코드로 확인 — **어떤
플랫폼에도 자동 실제 게시 API 호출이 없다.** 유일한 실제 외부 쓰기는
WordPress Draft 생성(`WORDPRESS_PUBLISH_ENABLED=true`일 때)과 관리자
전용 공개 게시 뿐이며, 후자는 위 18절 guard로 보호된다.

## 20. fact-grounding semantic limitation 처리

OPS-02A에서 남긴 Medium(비교 표현이 문자열 일치 기반이라 의미적으로
유사한 다른 표현은 놓칠 수 있음)에 대해, 이번 Phase에서 **새 semantic
AI matcher는 추가하지 않았다**(spec 명시적 금지). 대신 limitation을
문서로 유지하고(`docs/ops/ops-02a-reliability-hardening.md` 24절),
운영 모니터링 항목으로 `operational-health-summary.ts`의
business-blocked 집계에 fact_grounding 관련 카운트가 포함되어 실제
발생 빈도를 관찰할 수 있게 했다 — 사례가 쌓이면 OPS-03 이후 개선
여부를 판단한다.

## 21. malformed structured output monitoring

Threads+story 10/10 성공(OPS-02A)을 다른 platform/tone 조합까지
일반화하지 않는다 — 이번 Phase에서 대규모 추가 AI 호출 실험은
하지 않았다. 대신 기존 `social_draft_generation_failed` 로그가
`operational-health-summary.ts`의 `structuredOutputFailures` 집계에
포함되어, 다른 조합에서 유사 패턴이 반복되면 운영 중 관찰 가능하다.

## 22. 추가한 npm ops 명령

- `npm run ops:preflight` — 환경 사전점검(secret 미노출).
- `npm run ops:report-usage` — AI 사용량/비용 리포트(읽기 전용).

## 23. 수정 파일

`lib/ops/production-preflight.ts`, `lib/ops/model-pricing.ts`,
`lib/ops/ai-cost-aggregator.ts`, `lib/ops/operational-health-summary.ts`
(신규 4개), `scripts/ops/load-env.ts`, `scripts/ops/preflight.ts`,
`scripts/ops/report-ai-usage.ts`(신규), `vitest.ops.config.ts`(신규),
`lib/repositories/log-repository.ts`(+`getLogsByTypesAndRange`),
`lib/social/social-draft-generation-service.ts`(model 로깅 +
blocked/failed 분리), `lib/social/social-post-service.ts`,
`lib/publish/publish-quality-gate-service.ts`,
`lib/social/post-auto-fix-service.ts`,
`lib/social/rewrite-version-comparison-service.ts`,
`lib/social/rewrite-version-quality-recheck-service.ts`,
`lib/social/platform-manual-posting-result-service.ts`(idempotency
가드), `package.json`(ops:preflight/ops:report-usage 스크립트).

## 24. 추가/수정 테스트

`lib/ops/production-preflight.test.ts`(12),
`lib/ops/model-pricing.test.ts`(8),
`lib/ops/ai-cost-aggregator.test.ts`(6),
`lib/ops/operational-health-summary.test.ts`(6), 그리고
`social-post-service.test.ts`/`publish-quality-gate-service.test.ts`/
`platform-manual-posting-result-service.test.ts`에 각 회귀 테스트
추가.

## 25. lint

`npm run lint` — 오류 없음.

## 26. test

`npx vitest run` — **292 files / 3856 tests 통과**(OPS-02A 종료 시점
288/3821 대비 +4 files/+35 tests).

## 27. build

`npm run build` — 성공(19개 route).

## 28. E2E

`npm run test:e2e` — **Playwright 40/40 통과**, 회귀 없음.

## 29. preflight 실행 결과

`npm run ops:preflight`(실제 `.env.local`) — Supabase/Anthropic/
WordPress Draft/Search providers/Public publish/Mock mode·dangerous
flags **전부 PASS**, `Overall: PASS`.

## 30. 남은 OPS-Blocker

없음.

## 31. 남은 High

- **애플리케이션 레벨 인증 부재**(18절) — 앱 코드로는 고치지 않고,
  배포 전제조건(호스팅 레벨 접근 제어)으로 고정했다. 이 전제조건이
  실제로 지켜지는지는 배포마다 사람이 확인해야 하므로 "코드로
  해결됨"이 아니라 "운영 절차로 관리됨" 상태다 — OPS-03 진입 시
  다시 확인 필요.

## 32. 남은 Medium/운영 backlog

- `publish_logs.status`의 blocked/failed 개념 분리 스키마 한계(10절).
- article 생성/eval/source 요약 AI 호출의 token 계측 공백(4절).
- eval 실행 실패가 `pipeline_logs`에 기록되지 않는 계측 공백(9절).
- fact-grounding semantic matching 한계(20절, OPS-02A에서 이미 기록).
- 가격 테이블이 비어 있어 실제 비용 달러 환산 불가(5-8절) — 운영자가
  직접 채워야 함.

## 33. OPS-03 진입 가능 여부

**가능(조건부)** — 37절의 8개 조건을 모두 충족했다. 단, 31절의 남은
High(앱 레벨 인증 부재)는 **배포 시마다 호스팅 레벨 접근 제어가
실제로 설정됐는지 사람이 직접 확인해야 하는 운영 절차 의존
조건**이다 — 이 확인 없이 공개 배포하면 안 된다.

## 34. OPS-03 제한 운영 계획에서 반드시 지켜야 할 안전 조건

- 배포 전 반드시 `docs/ops/deployment-checklist.md`의 접근 제어 항목
  확인.
- 가격 테이블을 채우기 전에는 비용 수치를 "확정 비용"으로 보고하지
  않는다(`costUnavailable` 그대로 노출).
- WordPress 공개 게시는 계속 관리자 전용 접힘 + server-side guard
  경로로만 실행한다(우회 경로 추가 금지).
- `npm run ops:preflight`가 FAIL이면 배포하지 않는다.
- stalled job 발견 시 자동 재실행 금지(operations-runbook.md G절).

---

OPS-02B에서는 실제 운영을 위한 비용 가시성, 환경 사전점검, 실패
모니터링, 복구 절차, 배포 체크리스트와 외부 side-effect 안전성을
정리했습니다.
