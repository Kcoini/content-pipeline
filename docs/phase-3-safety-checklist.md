# Phase 3 Safety Checklist

Phase 3 전체(글쓰기~게시 준비~안전 점검)를 통틀어 지켜야 하는 안전
원칙을 한 곳에 모은 문서다. 각 항목은 `/dashboard/automation-safety`
(Phase 3-22)가 실제로 점검한다.

## 승인/게이트

- [ ] **human approval 필수** — `approval_status`가 `approved`가
      아닌 social post는 export/guard 이후 단계로 진행할 수 없다.
- [ ] **quality_status ready 필요** — 품질 검사를 통과(`ready`)하지
      못한 항목은 게시 준비 완료로 표시되지 않아야 한다.
- [ ] **approval_status approved 필요** — 위와 동일한 원칙을
      승인 단계에도 적용한다.
- [ ] **publish guard ready 필요** — `platform_publish_guard_status`가
      `ready`가 아니면 `platform_publish_ready`가 true가 될 수 없다.
- [ ] **dry-run ready 필요** — `platform_publish_dry_run_status`가
      `ready`가 아니면 handoff를 완료할 수 없다.
- [ ] **handoff 확인** — handoff가 완료됐다고 해서 실제 게시가
      일어난 것은 아니다 — 사람이 수동으로 게시해야 한다.

## API 게시 안전

- [ ] **actual API publish disabled** — 어떤 platform adapter도
      실제 외부 API를 호출하지 않는다. `api_publish_eligible_for_
      actual_publish`는 항상 false여야 한다.
- [ ] **feature flags default false** — `PLATFORM_API_PUBLISHING_
      ENABLED`, 플랫폼별 `*_API_PUBLISH_ENABLED`, `SOCIAL_PUBLISH_
      ENABLED`는 모두 기본값 false를 유지해야 한다.
      `PLATFORM_API_DRY_RUN_ONLY`는 기본값 true를 유지해야 한다.

## 로깅/콘텐츠 보안

- [ ] **logs secret 금지** — API key, access token, refresh token,
      Authorization header, Application Password를 `pipeline_logs`에
      저장하지 않는다.
- [ ] **full content logging 금지** — full post_body, full caption,
      full export_payload, full dry-run payload, full API payload를
      로그에 통째로 저장하지 않는다.
- [ ] **금지 표현 검사** — 협박, 공포조장, 허위단정, 광고클릭유도,
      과장수익 주장, 개인정보 노출, 명예훼손성 표현이 없어야 한다
      (`checkForbiddenPatterns`).

## 데이터 무결성

- [ ] **rewrite overwrite 금지** — rewrite 적용은 항상 새
      `social_post_versions` row를 만들고, 원본 social_post를
      덮어쓰지 않는다.
- [ ] **manual metrics 기반 한계 인지** — 모든 성과 수치는 사람이
      입력한 값이다. 자동 수집이 아니므로 입력 누락/오차 가능성을
      항상 감안한다.
- [ ] **A/B test 자동 실행 아님** — A/B 테스트는 draft 구조와 비교
      계산만 제공한다. 자동으로 트래픽을 분배하거나 자동으로
      승자를 게시하지 않는다.

## Rollback 기준

| 상황 | 기준 |
| --- | --- |
| 잘못된 draft 생성 | `publish_status = 'not_published'`이면 삭제/archive 가능 |
| 잘못된 수동 게시 결과 기록 | `manual_post_status` 수정은 반드시 수동 확인 후 |
| 잘못된 published 상태 | 실제 외부 플랫폼 상태를 먼저 확인한 뒤 DB 값 수정 |
| API 실제 게시 flag가 실수로 true가 됨 | 즉시 flag를 false로 되돌리고, Vercel 환경변수 확인, 토큰 회전 검토, 로그 점검 |
| 로그에서 민감정보 발견 | 로그 삭제/마스킹 정책 적용, 토큰 회전, 회귀 테스트 추가 |

## Release 전 점검 항목

- [ ] `npm run lint` 통과
- [ ] `npm run test` 통과
- [ ] `npm run build` 통과
- [ ] `.env.local`이 git status에 없는지 확인
- [ ] `/dashboard/automation-safety`에서 Safety Review 실행 →
      `status`가 `blocked`/`failed`가 아닌지 확인
- [ ] `select * from social_posts where api_publish_eligible_for_
      actual_publish = true` 결과가 비어 있는지 확인
- [ ] 실제 게시 버튼이 어떤 화면에도 없는지 확인

## 관련 문서

- automation safety review 상세: [`phase-3-22-automation-safety-review.md`](./phase-3-22-automation-safety-review.md)
- 환경변수 목록: [`phase-3-environment-variables.md`](./phase-3-environment-variables.md)
- 릴리즈 체크리스트: [`phase-3-release-checklist.md`](./phase-3-release-checklist.md)
