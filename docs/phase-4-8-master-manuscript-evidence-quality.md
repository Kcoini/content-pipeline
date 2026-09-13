# Phase 4-8: 마스터 원고 생성 품질 개선(evidenceMap 강화 + 자체 검토)

## 문제

기존 마스터 원고(`lib/articles/master-manuscript-builder.ts`)는
sourceSummaries/verifiedFacts/factInterpretationSplit/platformBriefs/
longFormSupport/optimizationSupport를 이미 갖추고 있었지만(Phase
3-27/4-1/4-2), 다음이 부족했다:

- 주장(claim)과 출처를 연결하는 `evidenceMap`이 `longFormSupport`
  안에만 있고, "이 주장이 얼마나 단단히 뒷받침되는지(strength)"와
  "주의할 점(caution)"이 없었다.
- 쟁점(issue)이나 "독자에게 어떤 의미인지"를 구조화해서 담는 자리가
  없었다.
- 확인된 사실이 날짜/수치/기관명 등 어떤 성격인지 구분되지 않아,
  "출처 없는 수치 단정"을 기계적으로 잡아낼 방법이 없었다.
- 마스터 원고 자체의 완성도를 "준비 완료/확인 필요/재생성 권장/출처
  부족"으로 요약해 보여주는 기능이 없었다(코드 주석에는 존재하는
  것처럼 언급돼 있었지만 실제 파일이 없었다).
- 플랫폼별 글 생성 prompt가 `platformBrief`만 전달하고, 실제 근거
  (evidenceMap)는 전혀 전달하지 않아 생성 결과가 일반론으로 흐르기
  쉬웠다.

## 확인 결과: 이미 되어 있던 것 (이번 phase에서 새로 만들지 않음)

- `sourceSummaries`, `verifiedFacts`(sourceIds 포함),
  `factInterpretationSplit`, `verificationNeeded`,
  `prohibitedOrCarefulExpressions`, `platformBriefs`(news_article/
  opinion_column/wordpress_blog/naver_blog/naver_cafe/shortSocial/
  instagram), `longFormSupport`(newsArticleExpansion/
  monetizedBlogExpansion 포함), `optimizationSupport`(eeatNotes/
  seoSupport/aeoSupport/geoSupport/agentReadiness) — Phase 3-27/
  4-1/4-2/4-5에서 이미 구현됨.
- 플랫폼별 글 생성은 이미 마스터 원고 전체가 아니라 `getPlatformBrief()`가
  골라주는 조각만 전달하고 있었다(`lib/social/social-writing-context-builder.ts`) —
  비용 최적화 원칙은 이미 지켜지고 있었다.
- 마스터 원고 생성은 AI를 다시 호출하지 않는 결정적 계산이다
  (`buildMasterManuscript`, article + sources만으로 순수 함수 계산) —
  이번 phase도 이 설계를 그대로 유지했다.

## 1. 최상위 evidenceMap 추가 (강도 + 주의사항)

`lib/articles/master-manuscript-types.ts`에 `MasterManuscriptEvidenceEntry`
{ claim, supportingSourceIds, strength(strong/moderate/weak), caution }를
추가하고, `MasterManuscript.evidenceMap`(최상위)에 채운다.
`longFormSupport.evidenceMap`(claim/sourceIds만 있는 기존 단순 매핑)은
**그대로 유지**한다 — 기존 소비자를 깨뜨리지 않기 위해서다.

`buildEvidenceMap()`(`lib/articles/master-manuscript-builder.ts`)이
`verifiedFacts`의 `confidence`를 그대로 `strength`로 옮기고(high→strong,
medium→moderate, low→weak), `caution`은 `factInterpretationSplit`에서
이미 계산된 값을 재사용한다(새로 지어내지 않는다).

## 2. issues / readerMeaning 추가

`MasterManuscriptIssueEntry`{ issue, positiveView, concern,
readerCheckPoint, sourceIds }를 최상위 `issues`에 담는다. 교차 확인이
안 된(medium confidence) 사실을 우선 사용하고, 없으면 상위 확인된
사실로 대체한다 — 없는 긍정/부정 시각을 지어내지 않고 "확인되면 근거로
쓸 수 있다"/"교차 확인이 필요하다"는 사실관계 자체만 안내한다.

`readerMeaning: string[]`은 `supportingMessages` 각각에 대해 "이 내용이
독자의 실제 상황에 어떤 영향을 주는지 확인해서 반영하세요" 형태의
템플릿 문장으로 채운다 — 구체적인 의미를 지어내지 않는다(이 프로젝트의
마스터 원고 생성은 AI 호출이 아닌 결정적 계산이라는 원칙을 그대로
따른다).

## 3. verifiedFacts에 factType 추가

`MasterManuscriptFactType` = `date | number | organization | policy |
event | claim | other`. `classifyFactType()`이 정규식만으로(AI 판단
아님) 사실 문장을 분류한다. 특히 `number`(수치) 타입에 `sourceIds`가
비어 있으면 "출처 없는 수치 단정"으로 간주해 자동 검토에서 잡는다(아래
4번).

기존에 저장된 마스터 원고(이 필드가 없는 JSON)를 깨뜨리지 않기 위해
`factType`은 선택 필드(`factType?`)로 뒀다 — 오래된 레코드를 읽을 때는
`undefined`이고, UI/검토 로직은 이를 "other"로 취급한다.

## 4. 마스터 원고 자체의 자동 검토 (`lib/articles/master-manuscript-review.ts`, 신규)

`reviewMasterManuscript(master)`가 12개 체크리스트 항목(출처별 요약/
확인된 사실/sourceId 연결/사실-해석 분리/evidenceMap/확인 필요 사항/
금지-주의 표현/플랫폼별 brief/장문 설계도/최적화 재료/출처 없는 수치
단정 없음/확인 필요 사항 혼입 없음)을 계산해 5가지 상태로 요약한다.

| status | 라벨 | 조건 |
|---|---|---|
| `not_created` | 아직 없음 | 마스터 원고가 없음(null) |
| `insufficient_sources` | 출처 부족 | 출처 요약 3건 미만 |
| `regenerate_recommended` | 재생성 권장 | sourceId 누락/확인 필요 사항 혼입/출처 없는 수치 단정 중 하나라도 위반(hard fail) |
| `needs_check` | 확인 필요 | 확인된 사실 또는 evidenceMap이 비어 있음 |
| `ready` | 마스터 원고 준비 완료 · 플랫폼 변환 가능 | 위 문제 없음 |

`app/articles/[id]/page.tsx`의 "마스터 원고 정보" 섹션에 이 상태를
배지로 표시하고, 실패한 항목은 "확인이 필요합니다: ..."로 짧게
안내한다(raw 체크리스트 key는 노출하지 않는다). **이 검토는 플랫폼별
글(social_posts)의 자동 검토를 대체하지 않는다** — 플랫폼 글은 여전히
`lib/social/social-quality-gate.ts`로 각자 검토되고, 최종 승인은
항상 사람이 한다.

## 5. 플랫폼 글 생성 prompt에 근거 하이라이트 전달 (일반론 방지)

`lib/social/social-writing-context-builder.ts`의
`SocialWritingContext`에 두 필드를 추가했다:

- `evidenceHighlights: string[]` — 최상위 `evidenceMap`에서 `weak`를
  제외한 주장을 최대 4건, `"{claim} (근거 N건, 충분/보통 — {caution})"`
  형태로 짧게 요약해 담는다.
- `verificationHighlights: string[]` — `verificationNeeded` 중 최대
  3건.

`lib/social/social-prompt-assembler.ts`가 이 두 필드를 각각 "근거가
확인된 핵심 주장(우선 활용, 근거 없는 새 주장 금지)"과 "확인이 더
필요한 내용(단정 금지)" 블록으로 프롬프트에 추가한다. `evidenceMap`/
`verificationNeeded` 전체나 마스터 원고 전체는 여전히 전달하지
않는다(비용 원칙 유지) — 예시로 든 "SEO는 키워드보다 신뢰와 구조가
먼저다" 같은 글이 구체적 근거 없이 일반론으로 흐르는 문제를, 마스터
원고 단계에서 만들어진 실제 근거를 프롬프트에 짧게 노출하는 것으로
줄인다.

## 안전 원칙 재확인

- 마스터 원고는 여전히 최종 게시글이 아니다 — 그대로 WordPress/네이버에
  게시하지 않는다.
- DB schema를 바꾸지 않았다 — 모든 신규 필드는 기존
  `articles.format_metadata.master_manuscript` JSON 안에 추가된
  필드일 뿐이다.
- 기존 3종류 article mode(general_news/source_based_explainer/
  monetized_blog)는 그대로 유지된다 — 삭제/변경 없음.
- 자동 검토는 최종 승인을 대체하지 않는다 — 마스터 원고 검토가
  "준비 완료"여도 사람이 최종 승인해야 한다.
- 자동 public publish는 이 phase에서도 추가하지 않았다.

## 테스트

- `lib/articles/master-manuscript-builder.test.ts`: factType 분류
  (date/number/organization), 최상위 evidenceMap의 strength/caution,
  issues의 fallback(교차 미확인 사실 없으면 상위 사실로 대체),
  readerMeaning 문장 수 일치, evidenceMap.caution이
  factInterpretationSplit.caution을 재사용하는지 검사.
- `lib/articles/master-manuscript-review.test.ts`(신규): 5가지 상태
  전이, 체크리스트 12개 항목, hard fail(sourceId 누락) 시
  regenerate_recommended, raw enum이 아니라 한국어 라벨 반환.
- `lib/social/social-writing-context-builder.test.ts`: 마스터 원고가
  없으면 하이라이트가 빈 배열, 있으면 weak를 제외한 근거만 담기는지
  검사.
- `lib/social/social-prompt-assembler.test.ts`: 하이라이트가 있으면
  prompt에 포함, 없으면 블록 자체가 생략되는지 검사.
- `app/articles/[id]/page.test.ts`: 마스터 원고 검토 상태 배지 +
  evidenceMap/issues 개수 표시 검사.
- 전체 `npx vitest run`: 228 files / 2918 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 관련 문서

- [`master-manuscript-generation-strategy.md`](./master-manuscript-generation-strategy.md) — 이전 단계(사실/해석 분리, longFormSupport, optimizationSupport)의 설계
- [`phase-4-2-platform-brief-structuring.md`](./phase-4-2-platform-brief-structuring.md) — platformBrief 구조화, `getPlatformBrief()` 진입점
- [`phase-4-5-content-type-review-separation.md`](./phase-4-5-content-type-review-separation.md) — opinion_column 플랫폼과 브리프
- [`phase-3-25-auto-review-editor-workflow.md`](./phase-3-25-auto-review-editor-workflow.md) — 플랫폼별 글(social_posts) 자동 검토와의 관계(서로 대체하지 않는다)
