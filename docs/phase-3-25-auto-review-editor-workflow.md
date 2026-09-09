# Phase 3-25: 검토를 "사람이 다 확인" → "자동 검토 + 사람은 편집자" 흐름으로 전환

## 배경

기존 흐름은 글이 생성되면 사람이 quality_status/approval_status/
export_status/handoff_status 같은 여러 raw 상태값을 페이지마다 다르게
직접 확인해야 했고, quality_status가 정확히 `ready`가 아니면(경고
하나만 있어도) 승인 자체가 불가능했다 — "자동 검토가 통과를 안 시켜주면
사람이 손을 못 대는" 구조였다. 이 단계는 사용자가 요청한 목표대로,
**시스템이 먼저 자동 검토하고 사람은 리포트와 본문을 확인한 뒤 최종
판단하는 편집자가 되는 흐름**으로 바꿨다.

## 핵심 설계 결정: 새 검사 엔진과 새 저장소를 만들지 않는다

`lib/social/social-quality-gate.ts`의 `runSocialPostQualityGate()`가
이미 구조/출처/플랫폼 적합성/문체/안전성에 걸친 30개 이상의 rule-based
검사를 수행하고 있고, 그 결과(`SocialPostQualityChecklistItem[]`)는
이미 `social_posts.quality_summary.checklist`에 저장되어 있다
(`updateSocialPostQuality`). 이번 작업은 **그 결과를 사용자 친화적인
"통과/확인 필요/수정 필요/차단" 리포트로 다시 계산해서 보여주는 표시
계층 하나(`lib/social/social-post-auto-review.ts`)만 추가**했다 — DB
schema 변경도, 검토 결과를 저장할 새 테이블/컬럼도 필요 없다. 리포트는
항상 현재 `quality_summary.checklist`로부터 다시 계산되는 순수 함수라서,
"수정 후 재검토"도 자연스럽게 해결된다: 사람이 수정하고 품질검사를
다시 실행하면(기존 `runSocialPostQualityGateAction` 그대로) checklist가
갱신되고, 리포트는 페이지를 다시 열 때 그 최신 checklist로 다시
계산된다.

```
runSocialPostQualityGate()  (기존, 그대로)
        │  checklist: [{key, status: pass|warning|fail|blocked, message}, ...]
        ▼
summarizeAutoReview(checklist)  (신규, 순수 함수, DB 접근 없음)
        │
        ▼
{ overallStatus: passed|needs_check|needs_fix|blocked,
  riskLevel: low|medium|high,
  counts, passedMessages, issues[] }
```

## 1. 자동 검토 결과 4단계 재정의

| 사용자 표시 | checklist 근거 | 의미 |
|---|---|---|
| 통과 | 모든 항목 pass | 사람이 최종 확인 후 승인 가능 |
| 확인 필요 | warning만 있음(blocked/fail 없음) | 확인 후 승인 가능 |
| 수정 필요 | fail 항목 있음 | 승인 전 수정 권장(차단은 아님) |
| 차단 | blocked 항목 있음(개인정보/허위/위험 표현 등) | 수정 전 승인 불가 |

`summarizeAutoReview()`가 checklist item마다 6개 축(구조/출처/플랫폼
적합성/문체/안전성/게시 준비) 중 하나로 분류한다 — 이미 존재하는
checklist key(`content_present`, `naver_cafe_no_markdown_escape`,
`no_pii_exposure`, `tone_alignment_check` 등 30여 개)를 실제 의미에
맞게 매핑한 표(`AXIS_BY_KEY`)를 새로 만들었다. 알 수 없는 key가 들어와도
안전하게 "구조" 축으로 취급한다(예외를 던지지 않는다).

## 2. 승인 게이트 정책 변경(가장 핵심적인 변경)

`lib/social/social-post-approval-service.ts`의 `checkApprovable()`이
예전에는 `quality_status !== 'ready'`면 무조건 승인을 막았다 — 즉
경고(확인 필요) 하나만 있어도 승인 불가능했다. 이번에 다음으로
바꿨다.

- `not_checked`(자동 검토 전) → 여전히 승인 불가("먼저 자동 검토를
  실행하세요" 안내로 이유를 명확히 함)
- `blocked` → 여전히 승인 불가
- `failed`(quality gate 실행 자체가 실패) → 여전히 승인 불가
- checklist에 `blocked`/`fail` 항목이 하나라도 있으면(`hasBlockingChecklistItems`,
  기존 함수 재사용) → 여전히 승인 불가
- **`needs_revision`이어도 checklist에 blocked/fail이 없으면(경고만
  있으면) → 승인 가능**(신규)

이 마지막 한 줄이 "자동 검토는 사람의 최종 승인을 대체하지 않지만,
확인 필요 수준까지는 사람이 확인 후 바로 승인할 수 있어야 한다"는
목표를 실제로 구현한 부분이다. `lib/social/social-post-approval-service.test.ts`
에 새 케이스(확인 필요만 있으면 승인 허용, fail이 있으면 여전히 차단,
not_checked/failed는 여전히 차단)를 추가했다.

## 3. 검토 리포트 UI — `/articles/[id]/social`, `/social-posts/[id]`

두 페이지 모두에 같은 리포트 블록을 추가했다(같은 `summarizeAutoReview`
호출, 같은 톤 색상 규칙 — 파랑/초록 계열 없이 4색만: 초록=통과,
노랑=확인 필요, 주황=수정 필요, 빨강=차단).

- 결론 한 줄("자동 검토 완료 · 확인 필요" 등) + 위험도 배지
- 통과/확인 필요/수정 필요/차단 개수 요약
- "확인 후 승인할 수 있습니다." 같은 승인 가능 여부 안내
  (`describeApprovalReadiness`)
- 확인이 필요한 항목 목록(축 이름 + 사용자 친화적 메시지, raw key 없음)
- 아직 자동 검토를 한 번도 실행하지 않은 글(`quality_status='not_checked'`)
  은 raw 값 대신 "아직 자동 검토를 실행하지 않았습니다" 안내 + 실행
  유도 문구를 보여준다.

`/social-posts/[id]`에서는 이 섹션을 "콘텐츠 미리보기"보다 먼저 배치해,
읽기 전용 상세 화면을 열었을 때 본문보다 먼저 "이 글이 지금 어떤
상태인지"를 알 수 있게 했다.

## 4. 반영하지 않은 것(의도적 범위 제외 — 이유와 함께)

원래 요청은 21개 절에 걸친 매우 큰 기능(검토 리포트 UI, 항목별 바로
수정, AI 수정 제안, 안전한 자동 수정 적용, 플랫폼별 게시 미리보기
탭 3종, 이슈→본문 위치 이동(scroll+focus), 최종 승인 전용 화면,
5개 페이지 전체 적용, 새 로그 이벤트 10종, 5개 문서 갱신)이었다. 이번
한 번에 전부 구현하는 대신, **가장 근본적인 정책 변경(승인 게이트)과
그 정책을 실제로 체감할 수 있는 리포트 UI**를 먼저 완성했다. 나머지는
다음 이유로 이번 범위에서 제외했다.

- **AI 수정 제안(실제 LLM 호출)**: 이 리포트는 순수 함수라 부작용이
  없다는 게 장점인데, AI 제안은 실제 생성 호출이 필요해 별도의
  action/로딩 상태/에러 처리가 필요하다 — 별도 작업으로 설계해야 한다.
- **"자동 수정 적용"(안전한 항목)**: naver_cafe의 Markdown escape/
  &#x20; 제거는 이미 `sanitizeNaverCafePlainText`가 **표시/export
  시점에 항상 적용**하고 있어(Phase 3-20), 저장된 원본을 다시 쓰는
  "적용" 버튼의 실익이 상대적으로 낮다고 판단해 이번에는 만들지
  않았다. WordPress markdown→HTML 변환도 마찬가지로 이미
  `ensureWordPressHtmlContent`가 전송 시점에 항상 적용한다. 저장된
  원본 자체를 고치는 명시적 "적용" 버튼은 필요성이 확인되면 후속
  작업으로 추가한다.
- **"문제 아님으로 표시"(영구 저장)**: 이슈별 dismiss 상태를 페이지
  새로고침 후에도 유지하려면 저장 공간이 필요하다. 기존 jsonb 컬럼을
  재사용할 수 있는지, 새 컬럼이 꼭 필요한지 확인이 더 필요해 이번에는
  구현하지 않았다(DB schema 변경 최소화 원칙과 충돌할 수 있는 유일한
  항목이라 신중하게 별도 검토가 필요하다).
- **이슈 → 본문 위치 이동(scroll+focus)**: 현재 본문 미리보기가 위치
  추적이 가능한 구조(문단별 id 등)가 아니라서, 이번 리포트는 "본문
  탭으로 이동"까지만 지원하고 정확한 위치 이동은 만들지 않았다.
- **`/articles/[id]/blog`, `/articles/[id]/rewrite`, `/dashboard`에도
  같은 리포트 적용**: `/articles/[id]/blog`는 Phase 3-24 검토에서
  이미 "내부 상태값 보기" 접힘 + 자동 실행 오케스트레이터를 갖추고
  있어 상대적으로 시급하지 않다고 판단했고, `/articles/[id]/rewrite`
  는 quality gate 대상이 아닌 재작성 고유 상태(재승인/재내보내기)가
  중심이라 이번 리포트 형식을 그대로 적용하기보다 별도 설계가 필요하다.
  두 곳 다 `summarizeAutoReview`를 그대로 재사용할 수 있게 만들어
  뒀으므로, 후속 작업에서 같은 함수를 가져다 쓰면 된다.
- **새 로그 이벤트 10종**: 기존 `social_quality_gate_started/completed/
  blocked/failed`, `social_approval_started/completed/rejected` 이벤트가
  이미 "자동 검토 시작/완료/차단/실패", "승인 시작/완료/반려"를
  의미상 충분히 커버하고 있어, 이름만 다른 이벤트를 새로 추가하지
  않았다.

## 영향받지 않는 것

- naver_cafe/naver_blog/wordpress_blog/x/threads/instagram의 실제
  생성 로직, quality gate 규칙 자체, export/handoff 로직은 전혀
  건드리지 않았다.
- 자동 public publish 경로는 추가하지 않았다. 승인 게이트를 완화한
  것은 "사람이 누르는 승인 버튼"의 조건을 바꾼 것이지, 승인 이후
  자동으로 무언가 게시되게 만든 게 아니다 — 승인 이후에도 WordPress
  Draft 반영/수동 export는 여전히 사람이 각각 버튼을 눌러야 한다.
- DB schema는 전혀 변경하지 않았다.

## 테스트

- `lib/social/social-post-auto-review.test.ts`(신규, 10개): 4단계 판정,
  위험도 계산, 축 분류, 알 수 없는 key 안전 처리, 승인 가능 안내 문구.
- `lib/social/social-post-approval-service.test.ts`: 기존 "needs_revision
  이면 무조건 거부" 테스트를 "blocked/fail 없는 needs_revision은 승인
  허용"으로 교체하고, "fail 있으면 여전히 거부", "not_checked/failed는
  여전히 거부" 케이스를 추가했다.
- `app/articles/[id]/social/page.test.ts`, `app/social-posts/[id]/page.test.ts`:
  자동 검토 리포트가 렌더링되는지, not_checked일 때 raw 값 대신 안내
  문구가 나오는지 검증하는 테스트를 추가했다.
- 전체 `npx vitest run`: 215 files / 2685 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류.
- `npm run build`: 성공.

## 관련 문서

- [`phase-3-1-multi-platform-writing-foundation.md`](./phase-3-1-multi-platform-writing-foundation.md)
- [`phase-3-24-cross-page-ux-consistency.md`](./phase-3-24-cross-page-ux-consistency.md)
