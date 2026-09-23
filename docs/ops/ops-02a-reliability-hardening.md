# OPS-02A: Pre-Production Reliability Hardening

- 작성일: 2026-09-23
- 범위: OPS-01 파일럿에서 발견된 High 3건(monetized_blog
  aggregateScore=0 / Threads+story JSON 파싱 실패 / Instagram
  fact-grounding Miss)을 근본 원인까지 추적해 해결하고, auto_fix와
  상충 source 처리를 통제된 조건에서 검증했다. UI 재설계·새 AI
  provider·DB migration·게시/승인 흐름 변경은 하지 않았다.
- 먼저 읽은 자료: `docs/ops/ops-01-pilot-plan.md`,
  `docs/ops/pilot-a-wordpress.md`, `docs/ops/pilot-b-information-cafe.md`,
  `docs/ops/pilot-c-social.md`, `docs/ops/ops-01-pilot-summary.md`.

---

## 1. Instagram Miss — root cause

OPS-01 Pilot C(instagram 게시글, article id
`7481495e-b8d9-4c1c-bbe4-5a439189287d`)의 "수소 연료전지차 비교 수치"를
실제 저장된 master manuscript의 `verifiedFacts`에서 직접 조회해
추적했다. **결과: 그 수치는 실제로 `sourceIds`가 붙은 verifiedFact로
존재했다**(confidence: medium, 전기자동차 위키백과 문서에서 실제로
추출됨). OPS-01 당시 "출처에 없는 수치"라는 판단은 소스의 raw fetch
결과가 아니라 소스 "주제"만 보고 내린 조사 오류였다 — **AI는 근거 없는
사실을 만들어내지 않았다.** 이 정정은 `docs/ops/pilot-c-social.md`
15절에 기록했다(코디네이터가 독립적으로 재검증 완료 — 실제 DB 조회
결과 hydrogen-related fact 1건 확인).

다만 이 재조사 과정에서 **더 근본적인 진짜 문제**가 드러났다:
**quality gate에는 "본문/캡션 주장이 verifiedFacts로 뒷받침되는지"
확인하는 검사가 애초에 전혀 없었다** — `news_article`에만 있던
"출처 없는 단정적 전망 표현" 키워드 목록이 유일했고, 그마저 evidence
대조가 아니라 고정 문자열 목록이었다(섹션 3의 원인 분류 기준으로는
**D. quality gate가 아예 이런 종류의 검사를 하지 않음**). 이 공백은
실제 문제이므로 그대로 해결했다.

## 2. Grounding 검토 개선 방식

새 fact DB나 키워드 차단기를 만들지 않고, 이미 있는 master manuscript의
`verifiedFacts`/`evidenceMap`(`lib/articles/master-manuscript-builder.ts`)을
"근거 텍스트"로 재사용했다.

- **신규**: `lib/social/fact-grounding-validator.ts` — 순수 함수.
  - `buildEvidenceText(verifiedFacts)`: verifiedFacts를 근거 텍스트
    하나로 합친다.
  - `findUngroundedClaims(postText, evidenceText)`: 본문 문장 중
    (a) 숫자가 있는데 그 숫자가 근거 텍스트에 없으면
    `unsupported_number`, (b) 비교/최상급 표현(섹션 4 예시: 가장
    많이/더 오래/두 배/절반/세계 최대/업계 1위/평균보다/수명이 더/효율이
    N% 향상/약 N배 등)이 있는데 같은 비교가 근거에 없으면
    `unsupported_comparison`으로 분류한다. 숫자는 단위를 무시하고
    비교하므로("300km" vs "약 300킬로미터") 표현 차이를 오탐하지
    않는다. 트리거 단어는 "검증이 필요한 문장인지"를 판단하는 신호일
    뿐 금지어가 아니다 — 같은 표현이 근거에 실제로 있으면 통과한다.
  - `detectConflictingVerifiedFacts(verifiedFacts)`: 주제어가 많이
    겹치는데(Jaccard 0.6 이상) 숫자가 다른 verifiedFact 쌍을 찾는다
    (섹션 20-21).
- **연결**: `lib/social/social-quality-gate.ts`에 `fact_grounding`
  checklist 항목 신설(`input.evidenceText`가 전달됐을 때만 실행 —
  기존 호출부와 하위 호환), `status: "warning"`으로 처리해
  `lib/social/social-post-auto-review.ts`에서 `"source"` axis의
  "확인 필요"로 노출된다. **`review-issue-fixability.ts`의
  auto-fixable 목록에 포함되지 않는다** — 즉 근거 없는 주장은 항상
  사람 확인 대상이고, auto-fix가 새 사실을 지어내 대체할 수 없다
  (섹션 6, 19의 "새 사실 생성 금지" 원칙 그대로 유지).

## 3. OPS-01 Miss 재현 결과

정정(1절) 때문에 원래 사례 자체는 "재현하면 안 되는" 사례다(실제로
근거가 있었으므로). 대신:
- **회귀 방지 확인**: 수정된 검증기를 실제 Pilot C instagram 게시글의
  실제 저장된 본문/verifiedFacts에 그대로 실행한 결과 **0건**(정확히
  기대한 대로 — 실제로 근거가 있으므로 flag되지 않아야 한다).
- **새 fixture로 실제 Miss 유형 검증**: 근거 없는 숫자/비교를 담은
  합성 fixture로 `findUngroundedClaims`가 실제로 잡아내는지 테스트로
  확인(4절 테스트 목록 참고).

## 4. 새로운 FP 발생 여부

없음. 신규 테스트에서 "evidence가 있는 숫자/비교는 오탐하지 않는다"를
명시적으로 검증했고(단위 표현 차이 포함), 실제 Pilot A/B/C의 저장된
콘텐츠에도 새로운 flag가 발생하지 않았다(3절의 회귀 재실행 결과).

## 5. monetized_blog aggregateScore=0 — root cause

실제 Pilot A의 `eval_runs` row를 직접 조회한 결과, `criteriaScores`가
17개 항목 전부 `{score:0, reason:""}`로 채워져 있었고 `notes`는 빈
문자열이었다 — 이는 예외 처리 경로(catch 블록, `notes`에 에러 메시지가
남는다)가 아니라 **정상 응답 경로를 그대로 통과해 빈 값을 파싱한
흔적**이었다. 실제 기사로 controlled 재현(1회 real Anthropic 호출,
같은 tool schema)한 결과 **`stop_reason: "max_tokens"`, tool_use
input이 완전히 비어 있음**을 직접 확인했다 — `evaluateArticleModeWithAi`가
`max_tokens: 2048` 고정값을 쓰고 있었는데, monetized_blog는 criteria가
17개(source_based_explainer는 11개)라 한국어 reason까지 포함한 JSON을
2048 토큰 안에 다 쓰지 못하고 잘렸다. 예외가 아니라 "응답이 끊긴 채로
파싱을 시도"한 것이 원인이었다(섹션 8의 categories 중 "평가 실행
실패를 0점으로 표시").

## 6. aggregate score 수정 방식

`lib/ai/eval-article.ts`:
- `estimateEvalMaxTokens(criteriaCount)`: `Math.max(2048, criteriaCount * 220)` —
  criteria가 많은 mode일수록 여유 있게 늘어난다(monetized_blog 17개 →
  3740 tokens).
- `evaluateArticleWithAi`/`evaluateArticleModeWithAi`를 공통 헬퍼
  `runToolUseEval`로 통합(중복 제거) — 이 헬퍼가 `response.stop_reason
  === "max_tokens"`이거나 `criteria_scores`가 비어 있으면(기대한
  criteria 수 0) **"평가 실행 실패"로 처리해 catch 블록과 동일한
  경로**(criteriaScores={}, aggregateScore=0, passed=false, **notes에
  "평가 실행 실패(evaluation_error): ..." 명시**)로 보낸다. DB 스키마
  변경 없음(`eval_runs.notes`는 이미 있는 컬럼) — 섹션 9의 요구사항을
  새 컬럼 없이 만족시켰다: "실제 0점"은 notes가 비어 있고, "실행
  실패"는 notes에 `evaluation_error`가 명시된다.
- **실제 프로덕션 데이터로 재검증**: 같은 Pilot A 기사로 수정 후
  재실행한 결과 `aggregateScore ≈ 3.9999...(≈4.0), passed=true,
  criteriaScores 17개 전부 정상 채워짐, notes 비어있지 않음`을 확인.

## 7. quality score와 eval score 혼동 금지 확인(섹션 10)

두 값은 이미 서로 다른 시스템이었다 — `quality gate score`(
`lib/social/social-quality-gate.ts`의 `runSocialPostQualityGate`,
게시 가능 여부를 가르는 gate)와 `eval aggregateScore`(
`lib/ai/eval-article.ts`, harness 품질 평가)는 별도 테이블(`social_posts`
vs `eval_runs`)에 저장되고, UI에도 별도로 표시된다(`Publish Quality
Gate` 카드 vs eval 결과) — 코드 상 합쳐지는 지점이 없음을 확인했다.
새 문서화만 이 절과 `docs/ops/ops-02a-reliability-hardening.md`(이 문서)에
남긴다: **quality score = 게시 품질 gate, eval score = 평가 harness
결과, 서로 다른 목적의 별개 지표**.

## 8. Threads+story JSON 실패 — root cause

Pilot C와 동일한 실제 기사(`7481495e-...`)로 threads+story를 반복
재현한 결과, **malformed escape**가 원인이었다(섹션 11의 카테고리
중). `stop_reason`은 `end_turn`(잘림 아님), markdown fence도 정상이라
truncation/fence 문제가 아니었다 — 모델이 `post_body` 안에서 대화/인용을
표현할 때 큰따옴표(`"`)를 이스케이프 없이 그대로 써서(`"...물었던 건
"배터리 얼마나 가냐"는 거였어요..."`) JSON 문자열이 중간에 끊겼다.
`story` tone의 "장면/대화로 시작" 지침이 이 패턴을 유도하는 것으로
보인다. 실측 재현율: 수정 전 5회 중 2~3회 실패(약 40~60%, 두 배치에서
반복 확인).

## 9. JSON parser/prompt 수정 내용

섹션 12의 우선순위대로 확인한 결과:
1. 파서가 정상 응답을 과도하게 거부하는 문제 아님(fence/leading-prose
   제거 로직은 정상 동작).
2. **prompt가 원인**이었다 — story tone의 대화체 유도 지침과 JSON
   출력 지침이 함께 있는데, 인용부호 처리에 대한 명시적 안내가
   없었다.
3. → **prompt 수정으로 해결**(파서를 느슨하게 만들지 않음, 섹션
   12의 "무조건 parser를 느슨하게 만들어 잘못된 데이터까지 받아들이지
   않는다" 원칙 준수): `lib/social/social-prompt-assembler.ts`의
   **공통** system prompt(story/threads 전용이 아니라 모든 platform/
   tone 공통 — 같은 문제가 다른 플랫폼/tone에서도 생길 수 있으므로)에
   "문장 안에서 대화나 인용을 표현할 때는 큰따옴표(") 대신
   작은따옴표(')나 낫표(「」)를 쓰세요 — JSON 문자열 값 안에서
   큰따옴표를 이스케이프 없이 쓰면 파싱이 실패합니다. 큰따옴표를 꼭
   써야 한다면 반드시 \"로 이스케이프하세요." 한 줄을 추가했다.
4. 내부적으로 이스케이프 누락 자체를 안전하게 복구하는 repair는
   추가하지 않았다 — 문자열 내부의 어느 위치가 "실수로 안 닫힌
   따옴표"인지 일반적으로 안전하게 추론할 수 없어(섹션 13의 허용
   범위를 벗어남), 예방(prompt)이 옳은 방향이라고 판단했다. 복구
   불가능한 응답은 기존처럼 안전하게 실패로 반환된다(성공으로 처리하지
   않음).

## 10. Threads story controlled rerun 결과

같은 조건(threads + story tone, 같은 실제 기사)으로:
- **수정 전**: 5회 중 2~3회 실패(두 배치, 재현율 확인용).
- **수정 후**: **5회 × 2배치 = 10/10 성공.**
- 잔여 위험을 0이라고 단정하지 않는다(LLM 출력은 확률적) — 다만 실제로
  재현된 실패 유형(이스케이프 누락)을 prompt 단계에서 직접 예방했고,
  실측 성공률이 뚜렷하게 개선됐다.
- retry 정책은 손대지 않았다: 현재 `generateSocialDraft`/
  `social-ai-client.ts`에는 retry 자체가 없음을 코드로 확인했고(섹션
  16 — "없으면 무조건 추가하지 말고 확인"), 이번 Phase에서 새로
  추가하지 않았다. tone을 코드가 임의로 바꾸는 로직도 어디에도
  추가하지 않았다(Pilot C에서 사람이 수동으로 tone을 바꾼 것은
  파일럿 스크립트의 판단이었지, production 코드의 자동 동작이 아니다 —
  이 원칙을 그대로 유지).

## 11. auto_fix fixture 3종 결과

기존 결정적 sanitizer만 재사용했다(새 AI 기반 auto-fixer를 만들지
않음):

| Fixture | 대상 | 결과 |
|---|---|---|
| A. Markdown residue | threads `**bold**` 잔여 | 마커 제거, 나머지 본문 그대로, re-review → 승인 가능 |
| B. 내부 drafting heading | wordpress_blog "리드문" 소제목 잔여 | heading 라벨만 제거, 사실/수치 문장 전부 보존, re-review → 승인 가능 |
| C. 반복/완화 가능 표현 | naver_cafe markdown escape(`\##`, `\*\*`) + HTML entity | 세 잔여물 모두 제거, 문장 내용 보존, re-review → 승인 가능 |

## 12. auto_fix 전/후 의미 보존 결과

세 fixture 전부 before/after assertion으로 확인: 문제(마커/heading/
escape)만 제거되고 나머지 문장은 그대로 유지되며(핵심 문장 substring
비교), 새로운 사실/숫자는 추가되지 않았다. `fact_grounding` 이슈는
애초에 auto-fixable 목록에 없으므로(2절) 이 경로에서 새 사실이
지어내질 위험 자체가 구조적으로 차단된다.

## 13. conflicting source fixture 결과

`detectConflictingVerifiedFacts`에 대해 3개 테스트로 확인:
- 같은 주제, 다른 숫자(예: 발표 시점이 다른 두 수치) → 충돌로 탐지.
- 같은 숫자, 다른 표현("300km" vs "약 300킬로미터") → 충돌 아님(오탐
  방지, 섹션 21).
- 서로 무관한 사실(주제어 겹침 낮음) → 충돌 아님.
AI가 임의로 "정답"을 고르지 않는다 — 이 함수는 판정하지 않고
목록만 반환하며, 호출부가 이를 사람 확인 항목으로 올리는 구조다(자동
채택 로직 없음).

## 14. TP/FP/Miss 재평가

OPS-01 대비 변화: Pilot C의 "Miss 1건"은 재조사 결과 실제로는 Miss가
아니었다(1절 정정). 표본이 작아(6개 콘텐츠) 통계적 성능 지표로
과장하지 않는다 — 목적은 명백한 회귀 여부 확인이었고, 이번
controlled fixture 테스트(4절 요약: 신규 fact-grounding
unsupported_number/unsupported_comparison 탐지 테스트, 오탐 방지
테스트)로 검증기가 실제로 동작함을 확인했다. **OPS-01 Instagram
Miss 재현 케이스는 이번에 Miss가 아니다** — 목표(섹션 22)를 조건부로
충족한다(원래 사례는 애초에 Miss가 아니었지만, 같은 유형의 진짜
ungrounded claim을 담은 새 fixture는 정확히 탐지된다).

## 15. token metadata 신뢰성 확인

OPS-01에서 이미 확인한 대로 `pipeline_logs`의
`social_ai_generation_completed` 등 이벤트에 실제 `inputTokens`/
`outputTokens`가 기록됨을 재확인했다. 모델 식별자(`ANTHROPIC_MODEL`)도
로그에 함께 남는다. 가격 계산 로직은 이번 Phase에서 추가하지
않았다(OPS-02B로 명시적으로 넘김) — 섹션 23의 지시대로 본격 비용 UI는
만들지 않았다.

## 16. 수정 파일

- `lib/ai/eval-article.ts` — `estimateEvalMaxTokens`, `runToolUseEval`
  공통화, 실행 실패/진짜 0점 구분.
- `lib/social/fact-grounding-validator.ts`(신규) — grounding/conflict
  검증 순수 함수.
- `lib/social/social-quality-gate.ts` — `fact_grounding` checklist
  항목 추가(하위 호환 유지).
- `lib/social/social-post-auto-review.ts` — `fact_grounding` →
  `"source"` axis 매핑.
- `lib/social/social-writing-context-builder.ts`,
  `social-draft-generation-service.ts`, `social-post-service.ts`,
  `rewrite-version-quality-recheck-service.ts` — `evidenceText`를
  quality gate 호출 3곳(최초 생성/inline 재검토/rewrite 재검토)에
  일관되게 전달(플랫폼 공통 적용, 섹션 7).
- `lib/social/social-prompt-assembler.ts` — 공통 system prompt에
  인용부호 이스케이프 안내 추가.
- `lib/social/social-quality-gate.ts` — (OPS-01에서 이미 수정된)
  X thread length_check 수정은 그대로 유지, 이번 Phase에서 되돌리지
  않음.

## 17. 테스트 추가/수정

- `lib/social/fact-grounding-validator.test.ts`(신규, 10 tests).
- `lib/social/social-quality-gate.test.ts` — `fact_grounding` 관련
  4 tests 추가.
- `lib/social/review-issue-fixability.test.ts` — auto-fixable 목록에
  없음을 확인하는 1 test 추가.
- `lib/ai/eval-article.test.ts` — max_tokens 잘림 감지/`estimateEvalMaxTokens`
  회귀 3 tests 추가.
- `lib/social/social-prompt-assembler.test.ts` — 인용부호 안내 문구
  존재 확인 1 test 추가.
- `lib/social/social-ai-client.test.ts` — malformed-escape 실패
  재현/안전한 실패 반환 회귀 1 test 추가.
- `lib/social/post-auto-fix-service.test.ts` — auto_fix fixture A/B/C
  3 tests 추가(새 describe block).
- 기존 테스트 fixture 일부(`evidenceText` 필드 추가 등)를 새 옵셔널
  필드에 맞춰 업데이트.

## 18. lint

`npm run lint` — 오류 없음.

## 19. test

`npx vitest run` — **288 files / 3821 tests 통과**(OPS-01 종료 시점
287/3798 대비 +1 file, +23 tests).

## 20. build

`npm run build` — 성공(19개 route 정상 생성).

## 21. E2E

`npm run test:e2e`(build + fixture 생성 + Playwright) — **Playwright
40/40 통과**, 회귀 없음.

## 22. 남은 OPS-Blocker

없음.

## 23. 남은 High

없음(3건 모두 이번 Phase에서 근본 원인 해결 또는 재조사로 정정 완료 —
"High 상태 — Resolved/Remaining" 표는 `docs/ops/ops-01-pilot-summary.md` 참고).

## 24. 남은 Medium/Content Tuning

- (기존, 변경 없음) Pilot A: article/post 간 카페인 400mg 확신도
  불일치(Medium), excerpt 미입력(Low).
- (기존, 변경 없음) Pilot B: 시의성 수치 재확인 안내 문구 제안(Content
  Tuning), TP/FP/Miss 표본 확보를 위한 상충 source 파일럿(방법론).
- (기존, 변경 없음) Pilot C: X thread 9개 개수(Content Tuning),
  Instagram 해시태그 개수(Content Tuning).
- (신규) `fact-grounding-validator.ts`의 비교 표현 매칭은 현재
  문자열(리터럴) 일치 기준이다 — 의미적으로 같은 비교를 다른 단어로
  표현한 경우(예: "훨씬 크다" vs "더 큽니다")는 근거에 정확히 같은
  문구가 없으면 놓칠 수 있다. 이는 의도적으로 보수적인 설계다(과탐지
  방지 우선) — OPS-02B 이후 표본이 쌓이면 재검토 권장(Content Tuning).

## 25. OPS-02A 통과 여부

**통과.**

- Instagram OPS-01 Miss 재현 → 원 사례는 오판정이었음을 확인(정정),
  같은 유형의 진짜 unsupported claim은 새 fixture에서 정확히 탐지됨 ✅
- 새로운 명백한 grounding Miss 없음(회귀 재실행 결과 0건) ✅
- aggregateScore=0 버그 해결(root cause 확정, 실제 데이터로 재검증) ✅
- Threads story failure 원인 규명(malformed escape) ✅
- 운영 가능한 수준의 JSON 처리 경로 확보(10/10 재현 성공, 확률적
  위험은 0이라 과장하지 않음) ✅
- auto_fix 실제 before/after 검증(3종 fixture, 의미 보존 확인) ✅
- source conflict 확인 흐름 검증(오탐 방지 포함) ✅
- 기존 safety 회귀 없음(lint/vitest 3821/build/Playwright 40 전부
  통과) ✅

## 26. OPS-02B에서 처리할 운영 준비 항목

- 모델 단가 상수 + `pipeline_logs` 토큰 집계 스크립트(비용 산출,
  섹션 23에서 명시적으로 넘김).
- fact-grounding 비교 표현 매칭을 문자열 일치에서 더 유연한 방식으로
  개선할지 여부(24절, 표본 확대 후 판단).
- `docs/ops/pilot-b-information-cafe.md`가 제안한 "의도적으로 상충하는
  source를 섞은 파일럿"으로 TP/FP/Miss 방법론 재보강.
- Threads+story 외 다른 platform/tone 조합에서도 malformed-escape
  패턴이 남아있는지 소규모 controlled 표본으로 재확인.
- 실제 브라우저(narrow viewport 포함) E2E 확대(QA-01에서 이미 시작,
  계속 누적).

---

OPS-02A에서는 실제 운영 파일럿에서 발견된 fact-grounding, 평가 집계,
구조화 출력 안정성 문제를 보강하고, auto-fix와 상충 source 처리까지
통제된 조건에서 검증했습니다.
