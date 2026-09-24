# 글 생성 파이프라인 루트(Content Generation Route)

- 목적: "주제 등록 → 기사초안 생성 → 마스터 원고 → 플랫폼별 글 생성 →
  검토/승인 → 게시 준비"까지, 실제 코드에서 어떤 UI 경로/Server
  Action/lib 함수를 거쳐 진행되는지 한 문서로 정리한다. 새 기능
  개발이 아니라 **기존 코드를 그대로 추적**한 문서다 — 코드는
  변경하지 않았다.
- 각 단계별 상세 설계는 개별 문서(`docs/article-generation-*.md`,
  `docs/master-manuscript-generation-strategy.md`,
  `docs/article-blog-wordpress-workflow.md` 등)를 참고 — 이 문서는
  그 문서들을 대체하지 않고, 전체 흐름에서 "어디에 있는지"를
  연결한다.
- 관련 신뢰 구조(fact-grounding 2-layer)는
  `docs/ops/production-operation-policy.md` 섹션 7에 고정되어 있다 —
  이 문서에서는 그 구조가 파이프라인의 어느 지점에 끼워지는지만
  표시한다.

## 전체 흐름 한눈에 보기

```
[1] 테마 생성           app/dashboard/page.tsx (폼) → createTheme
[2] 출처 등록/수집       app/dashboard/page.tsx (폼) → addSource
                        (URL 후보 수집 경로는 app/themes/[themeId]/actions.ts도 있음)
[3] 출처 AI 요약         addSource 내부에서 자동 실행(source 등록 시 1회)
        ↓               (Layer 1 소비 지점 ①: source-summarizer.ts)
[4] 기사초안 생성 버튼    app/dashboard/page.tsx (폼) → generateArticleDraft
[5] 마스터 원고 계산      generateArticleDraft 내부(AI 재호출 없음)
        ↓               (Layer 1 소비 지점 ②: master-manuscript-builder.ts)
[6] 기사 평가(Eval)       generateArticleDraft 내부
[7] 기사 승인            app/articles/[id]/page.tsx → approveArticleAction
[8] 플랫폼별 글 생성      app/dashboard/page.tsx 또는 app/articles/[id]/social/page.tsx
                        → generateSelectedPlatformPostsAction / generateAllPlatformPostsAction
[9] 품질 검사(Layer 2)   글 생성 직후 자동 실행 + 재검토 버튼
[10] social post 승인    app/articles/[id]/social/page.tsx → approveSocialPostAction / bulkApproveSocialPostsAction
[11] 게시 준비           플랫폼별 분기(아래 "게시 준비" 절 참고)
```

## [1]-[2] 테마 생성 / 출처 등록

- **UI**: `app/dashboard/page.tsx` — `<form action={createTheme}>`,
  `<form action={addSource}>`(각각 line 936, 395 부근).
- **Server Action**: `app/dashboard/actions.ts`
  - `createTheme(formData)` → `lib/repositories/theme-repository.ts`의
    `createTheme`(DB insert) → `redirect("/dashboard?themeId=...")`.
  - `addSource(formData)` → URL fetch(`lib/services/url-fetcher.ts`의
    `fetchUrlContent`) → `updateSourceFetchResult` → **AI 자동 요약**
    (`lib/ai/source-auto-summarizer.ts`의 `generateSourceSummaryWithAi`,
    실패 시 mock) → `updateSourceSummary`(→ `sources.key_points` 저장).
- URL 후보 일괄 수집(대안 경로): `app/themes/[themeId]/actions.ts`의
  `collectCandidates`/`importCandidatesToSources` — 여러 URL을 후보로
  모았다가 선택적으로 source로 가져오는 별도 흐름.

## [3] 출처 AI 요약 — Layer 1 소비 지점 ①

- `sources.key_points`(candidate fact, AI가 raw_content에서 추출)는
  **그대로 저장된다**(이름/스키마 변경 없음 — OPS-04-FIX1 원칙).
- 이 candidate fact가 실제로 **기사 생성 프롬프트에 쓰이기 직전**,
  `lib/ai/source-summarizer.ts`의 `summarizeSourcesWithAi`/
  `summarizeSourcesMock`이 `filterSupportedKeyPoints()`
  (`lib/sources/source-evidence-integrity-validator.ts`)로 걸러
  **raw source content로 뒷받침되는 것만** `SourceSummary.keyPoints`
  로 넘긴다.

## [4]-[6] 기사초안 생성 + 마스터 원고 + 평가

- **UI**: `app/dashboard/page.tsx`의 `<form action={generateArticleDraft}>`
  (line 618/631/717 — 화면 상태에 따라 여러 위치에 동일 action).
- **Server Action**: `app/dashboard/actions.ts`의
  `generateArticleDraft(formData)`(`app/dashboard/actions.ts:220`).
  순서(같은 함수 안에서 순차 실행):
  1. article mode 검증(선택 안 했으면 명확한 에러로 중단).
  2. 기존 초안이 있으면 사용자 확인(`confirmed=true`) 전에는 재생성
     막음(조용한 덮어쓰기 금지).
  3. **출처 계약 검사**(`contracts/source.contract.yaml`,
     `lib/harness/contract-runner.ts`) — 출처 3개 미만이면 여기서
     중단.
  4. AI 모드면 `summarizeSourcesWithAi` → `generateAiArticleDraft`
     (`lib/ai/article-writer.ts`) 호출, 실패하면 mock으로 폴백.
  5. **기사 계약 검사**(`contracts/article.contract.yaml`) — 인용
     출처 부족 등으로 실패하면 저장하지 않고 중단(citedSourceIds를
     억지로 채우지 않는다).
  6. `saveDraftArticle` → `articles` 테이블에 `status: "draft"`로
     저장.
  7. **마스터 원고 계산**(`buildMasterManuscript`,
     `lib/articles/master-manuscript-builder.ts`) → **Layer 1 소비
     지점 ②**(`buildVerifiedFacts`가 `evaluateSourceKeyPoints()`로
     supported만 `verifiedFacts`로 승격) → `saveArticleMasterManuscript`
     (`articles.format_metadata.master_manuscript`에 저장, AI 재호출
     없는 순수 계산이라 실패해도 article 저장은 막지 않음).
  8. **AI Eval**(`evaluateArticleForMode`, `lib/ai/eval-article.ts`,
     `evals/*.yaml` 기준) → `saveEvalRun`.
  9. `redirect("/dashboard?themeId=...")`.

## [7] 기사 승인

- **UI**: `app/articles/[id]/page.tsx`의 승인 버튼.
- **Server Action**: `app/articles/[id]/actions.ts`의
  `approveArticleAction`(line 1727) →
  `lib/harness/approval-gate.ts`의 `assertApproved` 경유 →
  `articles.status: "draft" → "reviewed"`. 사용자 명시 승인 없이는
  이 전환이 발생하지 않는다.

## [8] 플랫폼별 글(social post) 생성

- **UI**: `app/dashboard/page.tsx`(line 243/827/857) 또는
  `app/articles/[id]/social/page.tsx` — 플랫폼 선택 후 생성.
- **Server Action**: `app/articles/[id]/actions.ts`의
  `generateSelectedPlatformPostsAction`(line 1895) /
  `generateAllPlatformPostsAction`(line 1942).
- **lib**: `lib/social/multi-platform-generation-service.ts`의
  `generateSelectedPlatformPosts`/`generateAllPlatformPosts`(공통으로
  `generatePlatformPosts` 사용, line 103) — 플랫폼마다 기존 개별
  생성 로직인 `lib/social/social-draft-generation-service.ts`의
  `generateSocialDraft`를 그대로 재사용한다(이 오케스트레이션 파일은
  새 AI 호출 로직을 추가하지 않는다). `generateSocialDraft` 내부
  순서:
  1. `buildSocialWritingContext`(`lib/social/social-writing-context-builder.ts`)
     로 프롬프트용 context 조립 — 내부에서
     `getPlatformBrief(masterManuscript, platform)`으로 마스터 원고의
     해당 플랫폼 brief만 뽑는다(다른 플랫폼 brief/전체
     sourceSummaries는 프롬프트에 넣지 않음), evidenceText도 함께
     구성.
  2. AI 호출(플랫폼별 tone/schema) →
     `lib/social/social-output-contract-validator.ts`의
     `validateSocialOutput`으로 구조화 출력 계약 검증
     (`contracts/*.schema.json`).
  3. `social_posts` 테이블에 저장 →
     `lib/social/social-quality-gate.ts`의 `runSocialPostQualityGate`
     **자동 실행(품질 검사, Layer 2)**.

## [9] 품질 검사 — Layer 2(downstream fact-grounding)

- **자동 실행**: 글 생성 직후(위 [8]의 일부) + 수동 재검토 버튼
  (`runSocialPostQualityGateAction`, `app/articles/[id]/actions.ts:2035`).
- **lib**: `lib/social/social-post-service.ts`의
  `runSocialPostQualityGateAndSave` →
  `lib/social/social-quality-gate.ts` → `fact_grounding` 체크리스트
  항목은 `lib/social/fact-grounding-validator.ts`의
  `findUngroundedClaims(postText, evidenceText)` 호출(evidenceText는
  마스터 원고 `verifiedFacts`에서 옴 — 이미 Layer 1을 통과한 것만).
  자동 수정 가능한 항목은 `lib/social/post-auto-fix-service.ts`의
  `runAutoFixAndRecheck`(`runPostAutoFixAndRecheckAction`)가 처리하되,
  `fact_grounding`은 AUTO_FIXABLE_KEYS에 없어 **AI가 임의로 고치지
  않는다** — 항상 사람 확인.

## [10] social post 승인

- **UI**: `app/articles/[id]/social/page.tsx`.
- **Server Action**: `approveSocialPostAction`(line 2319, 개별) /
  `bulkApproveSocialPostsAction`(line 2351, `needsConfirmation=0`인
  것만 일괄).
- **lib**: `lib/social/social-post-approval-service.ts`의
  `approveSocialPost`/`bulkApproveSocialPosts`.

## [11] 게시 준비 — 플랫폼 capability별 분기

| capability | 플랫폼 | Server Action | 실제로 하는 일 |
|---|---|---|---|
| `draft` | wordpress_blog | `approveAndPrepareWordPressBlogPostForPublishingAction`(line 941) 또는 개별 단계(`prepareWordPressBlogPostForPublishingAction` 등) | `lib/social/wordpress-blog-publish-preparation-orchestrator.ts` → 실제 WordPress REST API로 **Draft** 생성/업데이트 |
| `manual` | naver_blog/news_article/opinion_column | `generateManualExportAction`(line 2471), `prepareManualPostingRecordAction` 등 | 수동 게시용 export 자료 생성(실제 게시 API 없음) |
| `copy` | naver_cafe/x/threads/instagram | `recordSocialPostCopiedAction`(line 2498) | 클립보드 복사 UX만(실제 게시 API 없음) |

WordPress **공개 게시**(관리자 전용, `publishApprovedArticleToWordPressAction`,
line 1640)는 이 "글 생성 루트"의 마지막 단계가 아니라 완전히 별도의
관리자 승인 경로이며, `checkPublicPublishGuard()`를 통과해야만
가능하다 — 자세한 안전장치는
`docs/ops/production-operation-policy.md` 섹션 6 참고.

## 신뢰 구조가 끼워지는 두 지점(요약)

```
Layer 1: source-evidence-integrity-validator.ts
  → [3]에서(article-writer 프롬프트 입력) 1회
  → [4]-6단계(buildVerifiedFacts)에서 1회
  두 지점 모두 filterSupportedKeyPoints()/evaluateSourceKeyPoints()로
  같은 로직 재사용(중복 구현 아님).

Layer 2: fact-grounding-validator.ts
  → [9] 품질 검사 단계에서(플랫폼 글 vs verifiedFacts 대조)
```

상세 설계/판정 모델/알려진 한계는
`docs/ops/ops-04-fix1-source-evidence-integrity.md` 참고.
