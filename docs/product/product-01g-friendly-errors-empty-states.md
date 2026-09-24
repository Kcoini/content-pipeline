# PRODUCT-01G: Friendly Errors & Empty States

- 작성일: 2026-09-24
- 관련 문서: `docs/product/product-01d-first-use-settings.md`,
  `docs/product/product-01f-publish-connection-ux.md`,
  `docs/product/product-language-dictionary.md`.

## 1. 조사한 오류 종류

주제/참고자료 생성·삭제, AI 콘텐츠 생성, structured-output(JSON) 파싱,
마스터 원고 생성, 플랫폼 글 생성, review/rewrite, publish preparation,
WordPress Draft, clipboard, manual posting result, readiness, job
failure/stalled, server action 반환 메시지, trend 수집(search
provider)까지 전수 조사했다. 상세 경로는 아래 2절 표 참고.

## 2. 조사한 error 전달 경로 / 기존 helper

이 프로젝트에는 이미 `lib/errors/describe-unexpected-error.ts`
(`describeUnexpectedError`)가 존재했다 — raw JS 런타임 에러 패턴을
감지해 fallback 문구로 바꾸는 presentation-only helper(Phase 4-9).
이미 2곳(`app/articles/[id]/actions.ts`,
`lib/social/social-draft-generation-service.ts`)에서 쓰이고 있었다.
**새 helper를 만들지 않고 이 함수를 확장·재사용했다**(섹션 5).

경로 추적 결과, 사용자에게 `error` query param이 실제로 도달하는
지점은 8개 페이지로 좁혀졌다: `app/dashboard/page.tsx`,
`app/articles/page.tsx`, `app/articles/[id]/page.tsx`,
`app/articles/[id]/blog/page.tsx`, `app/articles/[id]/rewrite/page.tsx`,
`app/articles/[id]/social/page.tsx`, `app/social-posts/[id]/page.tsx`,
`app/trends/page.tsx`. server action의 catch 블록은 90개 이상 흩어져
있지만(주로 `app/articles/[id]/actions.ts`), 최종적으로 전부 이
8개 페이지 중 하나의 query param(`error`)으로 모인다 — 그래서
**server action 하나하나를 고치지 않고, 화면에 보이기 직전인 이
8곳에서 `describeUnexpectedError()`로 한 번 더 감싸는 방식**을
택했다(가장 낮은 위험으로 가장 넓은 범위를 커버).

## 3. 신규/reused error helper

- **재사용**: `describeUnexpectedError(message, fallback)`(기존) — 반환
  shape(`userMessage`/`rawMessage`/`wasRawRuntimeError`)도 그대로.
- **확장**: raw 패턴 목록에 HTTP status/네트워크 예외
  (`fetch failed`, `TypeError:` 접두사 등)/JSON·schema 관련 단어
  (`json`, `zod`, `max_tokens`)/provider 이름
  (anthropic/supabase/vercel)/env var 패턴(`process.env`,
  `ALL_CAPS_WITH_UNDERSCORES`)/stack trace 한 줄 패턴을 추가했다(섹션
  30 정적 회귀 목록 그대로 반영). 판단 로직 자체(정규식 매칭 →
  fallback 치환)는 바꾸지 않았다.
- 지시서 4절이 예시로 든 `presentation-only category`(retryable/
  user_action_required/admin_action_required/blocked_for_safety/
  informational)는 **별도 타입으로 만들지 않았다** — 이미
  `describeUnexpectedError`의 `wasRawRuntimeError` boolean +
  페이지별로 이미 구분되어 있는 안내 문구(승인 필요/확인 필요 등,
  PRODUCT-01F에서 정리)가 사실상 이 분류를 대신하고 있어, 새 타입을
  추가하면 오히려 두 개의 분류 체계가 생겨 모순 위험이 있었다.

## 4. Error taxonomy

새 DB error status를 만들지 않았다(섹션 4 금지 원칙). 기존 반환값/
결과에서만 derive한다:

| 축 | 판단 기준(기존 값) | 사용자 표현 |
|---|---|---|
| raw runtime 여부 | `describeUnexpectedError().wasRawRuntimeError` | true면 fallback, false면 원문(이미 사람이 쓴 한국어) 그대로 |
| job 진행 상태 | `JobStatus`(기존) + `isStalled`(기존, `detectStalledJobRun()`) | "실패"/"멈춤 가능성 있음"을 서로 다른 배지로 구분(기존, Phase 4-17) |
| publish 상태 | `PublishPreparationState`(PRODUCT-01F에서 이미 정리) | "확인 필요"/"승인 필요"/"게시 준비 완료" 등 |
| review 상태 | `describeUnexpectedError` 대상이 아니다 — fact-grounding `needs_review`는 error가 아니라 검토 상태(섹션 11) |

## 5. Generation failure UX

마스터 원고 생성(`app/dashboard/actions.ts`)에서 AI 호출이 실패하면
**이미 조용히 mock 생성으로 전환**하고 있었다(기존 동작, Phase 2-22
이전부터 존재 — generation semantics라 이번 Phase에서 바꾸지 않았다).
그래서 이 경로에는 사용자에게 노출되는 raw AI 에러가 원래 없다.

플랫폼 글 생성(`generateSelectedPlatformPostsAction` 등)은 이미
`describeUnexpectedError`를 쓰고 있었다(재확인). Dashboard의
`generationError`/`deleteError` 표시는 이번 Phase에서
`describeUnexpectedError`로 새로 감쌌다(4/8번 파일 목록 참고).

## 6. Structured-output(JSON) failure UX

`lib/social/social-ai-client.ts`의 JSON 파싱 실패 메시지("AI 응답을
JSON으로 파싱하지 못했습니다.")가 `generateSocialPostWithAI()`를 거쳐
`social-draft-generation-service.ts`의 `generateSocialDraft()`
반환값(`message`)으로 **감싸지지 않은 채 그대로** 나가고 있었다 —
**실제 발견된 오류 전달 bug**(9절 참고, "JSON"이라는 단어와
`SOCIAL_AI_MAX_TOKENS` 같은 env var 이름이 사용자에게 그대로 보일 수
있었다). `describeUnexpectedError()`로 감싸도록 최소 수정했다(21절
Backend 변경 감사 참고).

## 7. Source fetch failure UX

Dashboard 참고자료 목록의 `source.fetchError`/`source.summaryError`
(내부 수집기가 DB에 그대로 저장한 raw 오류 텍스트일 수 있음)를
표시 직전 `describeUnexpectedError()`로 감쌌다(DB 값 자체는 바꾸지
않음). 요약 카운트("본문 수집 완료 N개 · 요약 완료 N개 · 실패
N개")는 이미 성공/실패를 구분해 보여주고 있었다(재확인, 변경 없음) —
"전체 실패"와 "일부 실패"를 섞지 않는다.

## 8. Source Integrity issue와 error 구분(재확인)

`needs_review`/`unsupported` 같은 fact-grounding 상태는 애초에
`describeUnexpectedError`의 입력이 아니다 — 이 값들은 검토 상태를
계산하는 별도 함수(`social-post-auto-review.ts` 등, PRODUCT-01C에서
이미 정리)에서만 나오고, 어디에서도 "오류가 발생했습니다"류 문구로
표시되지 않는다(재확인, 변경 없음).

## 9. WordPress failure UX

`lib/publish/publish-service.ts`의 실패 메시지는 이미 사람이 쓴
한국어 문장이라(PRODUCT-01F에서 확인) `describeUnexpectedError`가
그대로 통과시킨다. 페이지 레벨(`app/articles/[id]/blog/page.tsx`)의
최상단 `error` 배너를 이번 Phase에서 `describeUnexpectedError`로
감쌌다 — action 레벨 catch-all(`error instanceof Error ?
error.message`)이 혹시 raw 예외를 실어 보내도 화면에서 한 번 더
막는다.

## 10. Copy failure UX(재확인)

`CopyPostBodyButton`은 이미 지시서 예시와 정확히 같은 문구("본문을
복사했습니다."/"복사하지 못했습니다. 본문을 직접 선택해 복사해
주세요.")를 쓰고 있었다(PRODUCT-01F에서 확인, 이번 Phase도 재확인만
하고 변경 없음).

## 11. Manual completion failure UX

`recordManualPostingResult()`의 실패 메시지("게시 완료로 기록하려면
게시 URL이 필요합니다." 등, `checkRecordable()`의 여러 분기)는 이미
사람이 쓴 한국어 문장이다 — "외부 게시 자체"와 "앱의 기록 저장"을
구분하는 문구는 성공 메시지("실제 API 게시가 아닌 수동 게시 기록입니다")에
이미 명시되어 있다(재확인, PRODUCT-01F에서 확인). 이 서비스가 던지는
예외가 페이지에 도달하면 `app/articles/[id]/social/page.tsx`의
최상단 `error` 배너(이번 Phase에서 감쌈)가 최종 방어선이 된다.

## 12. Readiness failure UX(재확인)

PRODUCT-01D의 `getContentServiceReadiness()`를 그대로 재사용
(dashboard 배너, PRODUCT-01E에서 이미 추가). "API key를 입력하세요"
같은 사용자가 해결할 수 없는 지시는 전체 코드베이스에서 발견되지
않았다(grep으로 재확인).

## 13. Stalled job UX(재확인)

`JobProgressCard`가 이미 `isStalled`를 `jobRun.status === "failed"`와
완전히 분리해서 처리하고 있었다(Phase 4-17) — "실패로 확정된 것은
아니니 잠시 후 다시 확인해 주세요."라는 문구가 이미 정확히 지시서
섹션 16의 의도와 일치한다. 변경 없음, fixture로 재확인만 했다.

## 14. Retry 정책

이번 Phase에서 **새 "다시 시도" 버튼을 기존 화면에 추가하지
않았다** — 각 페이지의 기존 폼(주제 생성/참고자료 추가/마스터 원고
생성/WordPress Draft 생성 등)이 이미 안전한 재시도 경로 역할을
하고(사용자가 같은 버튼을 다시 누르면 됨), 중복 side effect 위험이
있는 곳(WordPress Draft 생성)은 이미 `publish-service.ts`가 "이미
WordPress에 초안이 생성되어 있어 중복 생성을 건너뜁니다." 멱등성
가드를 갖고 있다(재확인, PRODUCT-01F에서 확인). 새로 만든
`app/error.tsx`의 "다시 시도" 버튼은 `reset()`(Next.js가 제공하는
표준 error boundary 재시도 — 이 boundary 아래 트리만 다시 렌더링,
안전)에만 연결했다.

## 15. Unsafe retry 방지

새 서버 side-effect를 트리거하는 재시도 버튼을 만들지 않았으므로
중복 실행 위험을 새로 만들지 않았다. `app/error.tsx`의 재시도는
클라이언트 렌더링 재시도일 뿐 서버 action을 다시 호출하지 않는다.

## 16. Data safety 안내

`app/error.tsx`(전역 boundary)는 앱 전체 어디서든 발생한 예외를
잡으므로, "지금까지 작성한 콘텐츠는 안전하게 저장되어 있습니다"류
문구를 **추측해서 넣지 않았다**(섹션 3/8 — 확인할 수 없으면 추측
금지). 저장 여부가 실제로 확실한 화면(예: WordPress Draft 생성
실패 — 원본 article은 이미 DB에 저장된 상태에서 실행되므로 "앱에
그대로 저장되어 있습니다"가 사실)에서만 그 문구를 쓴다(fixture
`error-wordpress-draft-failure` 참고).

## 17. 조사한 empty state 수 / 18. 수정한 empty state

주제 없음/참고자료 없음/article 없음/platform posts 없음/review
item 없음/publish preparation 없음/usage 데이터 없음/search 결과
없음/rewrite 대상 없음/job history 없음, 10개 상태를 조사했다.

- **주제 없음**: PRODUCT-01D에서 이미 welcome 상태로 정리됨(재확인,
  변경 없음).
- **참고자료 없음**: PRODUCT-01E에서 이미 행동 중심 문구로 정리됨
  (재확인, 변경 없음).
- **publish preparation 없음**: `app/articles/[id]/social/page.tsx`가
  `publishPreparationSummary.total > 0`일 때만 섹션 자체를 렌더링한다
  — "0건"을 별도로 보여주지 않는 것 자체가 올바른 설계라고 판단했다
  (섹션 21: 0건은 실패가 아니므로, 아직 해당 없는 섹션을 굳이
  노출해서 혼란을 주지 않는다). 새 UI를 추가하지 않았다.
- **search 결과 없음**(`ThemeSearchList`): "검색 결과가 없습니다."
  (기존) — 검색창이 바로 위에 있어 다음 행동이 이미 명확하므로
  변경하지 않았다.
- **rewrite 대상 없음**(`app/articles/[id]/rewrite/page.tsx`): "아직
  생성된 개선 제안이 없습니다."(기존) — 바로 위에 실제 생성 폼이
  있어 행동이 이미 명확하므로 변경하지 않았다.
- 나머지(usage/performance 데이터 없음, job history 없음)는 filter/
  집계 결과 0건으로, 검색 결과 0건과 같은 카테고리로 판단해 변경하지
  않았다.

## 19. empty vs error 구분(재확인)

검색 결과 0건, 게시 준비 콘텐츠 0건, review issue 0건 — 전부 각자의
전용 계산 함수(필터링/집계)에서만 나오고, 어디서도
`describeUnexpectedError`나 에러 배너 스타일(빨간 테두리)로 표시되지
않는다(재확인).

## 20. Not-found UX(신규)

`app/not-found.tsx`, `app/error.tsx`가 이전까지 **존재하지 않았다** —
`notFound()`를 호출하는 5개 페이지가 전부 Next.js 기본 404/에러
화면(raw, 복귀 링크 없음)에 의존하고 있었다. 이번 Phase에서 전역
파일 2개를 신규 추가했다(개별 `notFound()` 호출 자체는 바꾸지
않음). `app/articles/[id]/page.tsx`의 자체 not-found 분기도 "기사를
찾을 수 없습니다 (id: {id})."에서 "콘텐츠를 찾을 수 없습니다." + 복귀
버튼으로 개선했다.

## 21. raw technical term 제거/검사

`describeUnexpectedError` 확장 패턴(3절)으로 ANTHROPIC/SUPABASE/
HTTP 500/JSON/schema validation/stack trace/process.env/ALL_CAPS
env var 이름을 정적으로 검사한다(테스트 7개 추가). Playwright
fixture에서도 동일 패턴을 실제 렌더링 결과에 대해 확인한다(42개
테스트).

## 22. Admin technical detail 보존

`imageGeneration.error`(blog 페이지, 기술 필드명이 이미 나열된
디버그 영역) 등 admin/advanced 영역의 raw 정보는 그대로 뒀다 —
숨기지 않았다(섹션 6 "일반 사용자 기본 화면"에서만 숨긴다는 원칙,
이 영역은 애초에 AdvancedDetails류 접힘 영역 안에 있다).

## 23. error boundary 변경 여부

`app/not-found.tsx`, `app/error.tsx` **신규 추가**(이전에 없었음,
섹션 23 "필요한 최소 boundary 추가를 검토한다"에 따른 결정).
`global-error.tsx`는 추가하지 않았다 — `app/error.tsx`가 route
segment 트리 대부분을 이미 커버하고, root layout 자체의 렌더링
실패까지 잡는 `global-error.tsx`는 이번 Phase 범위에서 필요성이
확인되지 않았다(과설계 금지 원칙, 섹션 34).

## 24. Backend 변경 감사(섹션 36)

**허용 범위를 벗어난 변경 1건 발견 및 최소 수정**:
`lib/social/social-draft-generation-service.ts`의 `generateSocialDraft()`
에서 `aiResult.error`(예: "SOCIAL_AI_MAX_TOKENS를 늘려야 합니다.")가
`describeUnexpectedError`를 거치지 않고 그대로 반환되고 있었다 —
**실제 오류 전달 bug**다. 원인: AI 호출 실패 분기(line 386 부근)가
함수 하단의 catch 블록(이미 `describeUnexpectedError` 적용, line
630)과 별도 경로였다. 수정 범위: 반환 직전 `describeUnexpectedError()`
한 줄만 추가(로직/재시도/판단 조건 변경 없음, 로그에는 원문 유지).
그 외 `publish-service.ts`/`platform-manual-posting-result-service.ts`/
`post-approval-next-actions.ts`/repository/server guard는 전혀
수정하지 않았다.

## 25. 알려진 한계

- server action의 catch 블록(90개 이상)은 개별적으로 수정하지 않고
  페이지 레벨에서 최종 방어선만 세웠다 — 만약 어느 action이 query
  param이 아닌 다른 경로(예: 직접 throw해서 Next.js가 잡는 경우)로
  에러를 전달한다면 `app/error.tsx`가 두 번째 방어선이 된다.
- "publish preparation 없음" 상태에 전용 empty-state UI를 만들지
  않았다(18절) — 실제로 이 상태가 사용자 혼란을 유발하는지는 후속
  관찰이 필요하다.
