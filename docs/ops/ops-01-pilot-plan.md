# OPS-01: Controlled Operational Pilot — 실행 계획

- 작성일: 2026-09-19
- 목적: 실제 콘텐츠 3건을 Theme → Sources → Generate → Review → Human
  Check → Approval → Publish Preparation까지 처음부터 끝까지 실행해,
  "이 시스템을 실제 운영에 사용할 수 있는가?"를 평가한다. 새 기능은
  만들지 않는다.

## 1. 실행 원칙

- 먼저 파일럿을 실행하고 데이터를 수집한다 — 문제를 발견할 때마다
  바로 UI/코드를 고치는 반복으로 되돌아가지 않는다.
- 발견한 문제는 OPS-Blocker/High/Medium/Low/Content Tuning으로 분류한다.
- **즉시 수정 가능**: journey blocker, 잘못된 state transition, 실제
  safety bug, 데이터 손실, 명백히 잘못된 action, 콘텐츠가 사라지는
  formatting bug.
- **즉시 수정하지 않음(backlog)**: 문구 취향, spacing, 카드 모양, tone
  preference, 한 번만 나타난 콘텐츠 취향 문제 — 이런 항목은 Medium/
  Low/Content Tuning으로 기록만 하고 파일럿 종료 후 판단한다.
- WordPress는 Draft까지만, Naver/SNS는 copy/manual preparation까지만
  진행한다 — 실제 공개 게시/실제 외부 SNS API 게시는 절대 호출하지
  않는다.

## 2. 실행 방식(중요한 방법론 결정)

이 프로젝트의 모든 route는 Supabase를 직접 조회하는 서버 컴포넌트이고,
Server Action(`app/dashboard/actions.ts`, `app/articles/[id]/actions.ts`
등)은 `redirect()`/`revalidatePath()`로 끝나 요청 컨텍스트 밖에서 직접
호출할 수 없다. 따라서 각 파일럿은 **Server Action이 내부적으로
호출하는 것과 완전히 동일한 repository/service 함수를 그대로, 같은
순서로 호출하는 vitest 드라이버 스크립트**(`scripts/ops-01/pilot-*.ts`,
전용 config `vitest.ops-01.config.ts`)로 실행했다 — `redirect`/
`revalidatePath` 호출만 제외했을 뿐 실행되는 비즈니스 로직(계약 검사,
AI 생성, quality gate, 승인, WordPress Draft 생성 등)은 실제 UI에서
버튼을 눌렀을 때와 100% 동일하다.

이 방식은 실제 DB/AI/WordPress를 100% 실제로 사용하지만, "실제 마우스
클릭 수"는 측정하지 않는다 — 각 문서의 "클릭/판단" 절에는 동일한 결과를
만들기 위해 실제 화면에서 필요한 클릭 수를 코드 흐름 기준으로 추정한
값임을 명시했다. QA-01에서 이미 Playwright 기반 UI 컴포넌트 검증(40
tests, dead-end/raw info/primary action 불변식)을 완료했으므로, OPS-01은
"실제 데이터로 파이프라인 전체가 실제로 동작하는가"와 "콘텐츠 품질이
운영 가능한 수준인가"에 집중했다.

`scripts/ops-01/load-env.ts`가 `.env.local`을 로드해 실제 credential로
실행되게 한다 — secret 값은 어떤 로그/문서에도 남기지 않는다(기존
`lib/harness/logger.ts`/`logging-security-auditor.ts` 원칙 유지).

## 3. Pilot 3건 정의

| Pilot | 콘텐츠 유형 | 목표 platform | 핵심 검증 |
|---|---|---|---|
| A | 일반 설명형 | wordpress_blog | source 기반 생성, 자동 검토/수정, 승인, WordPress Draft, QA-01-FIX1 회귀 |
| B | 시의성 정보형 | source_based_explainer + naver_cafe | 다중 source 사실 정리, 사실/해석 분리, plain-text 포맷팅, copy/manual completion |
| C | SNS 다중 플랫폼 | x / threads / instagram | 플랫폼별 tone, X thread, MultiPlatformReviewSummary, bulk approval, copy workflow |

주제는 모두 공개적으로 확인 가능한 실제 정보성 주제를 사용했고(개인정보/
민감정보/위험한 테스트 문구 없음), lorem ipsum이나 의미 없는 mock text는
쓰지 않았다. 세부 주제/출처는 각 파일럿 문서(`docs/ops/pilot-a-wordpress.md`,
`pilot-b-information-cafe.md`, `pilot-c-social.md`) 1절 참고.

## 4. 측정 지표

각 파일럿 문서는 Phase 지시서 섹션 5(A~F: 시간/사용자 행동/AI
자동화/품질 4단계/게시 준비/오류)를 동일한 형식으로 기록했다. 사람
확인(user_confirmation_required) 이슈는 섹션 10 기준(True Positive/
False Positive/Miss)으로, auto_fix는 섹션 11 기준(원래 의미 보존/
새 사실 추가 없음/source-grounding 훼손 없음)으로 평가했다. 최종 post는
섹션 12의 5개 항목(사실 충실성/구조·가독성/플랫폼 적합성/수정 필요
정도/실제 사용 가능성)을 양호/확인 필요/수정 필요 3단계로 평가했다.

## 5. 비용 측정 가능 여부

`pipeline_logs`의 `social_ai_generation_completed` 등 이벤트에
`inputTokens`/`outputTokens`가 실제로 기록되는 것을 확인했다. 다만
모델 단가(원화/달러 환산) 상수나 누적 비용 집계 로직은 이 프로젝트
어디에도 없다. 값을 추측하지 않고, 파일럿 문서에는 "현재 시스템에서
신뢰할 수 있는 비용 집계는 불가능하다"고 명시했다(섹션 6 지시 그대로).
OPS-02에서 모델 단가 상수 + `pipeline_logs` 집계 스크립트 정도의 가벼운
수준으로 추가하는 것을 권장한다(대규모 billing infra는 불필요).

## 6. 실행 순서

세 파일럿은 서로 독립적인 theme/article/social_post를 사용하므로 병렬로
실행했다(각각 별도 에이전트가 동시에 실제 DB/AI에 접근). 실행 후 발견된
문제를 모두 취합해 OPS-Blocker/High만 파일럿 종료 시점에 판단해
수정했다 — 상세 내역은 `docs/ops/ops-01-pilot-summary.md`와 각 파일럿
문서 참고.
