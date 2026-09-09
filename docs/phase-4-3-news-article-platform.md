# Phase 4-3: "마스터 원고 중심" 구조 전환 3차 — news_article 플랫폼 추가

## 배경과 범위

[Phase 4-1](./phase-4-1-master-manuscript-terminology.md)(용어 정리)과
[Phase 4-2](./phase-4-2-platform-brief-structuring.md)(platformBrief
구조화)에 이어, 이번 3차는 언론 기사형(스트레이트 기사·보도 기사)
플랫폼 `news_article`을 실제 플랫폼 목록에 추가한다.

3차 범위:
- `SocialPlatform`에 `news_article`을 추가하고, 이 플랫폼을 참조하는
  모든 곳(약 20개 파일)에 실제 동작을 채운다.
- `news_article` 전용 prompt(`prompts/social/news-article.md`)와 출력
  계약(`contracts/social/news-article.schema.json`)을 추가한다.
- quality gate에 news_article 전용 자동 검토 항목 2개(리드문 존재,
  출처 없는 단정적 전망 없음)를 추가한다.
- Phase 4-2에서 만든 `platformBriefs.newsArticle`을 실제로 사용하는
  첫 플랫폼이 된다(`SocialWritingContext.platformBrief`가 이제
  news_article 생성에도 채워진다).

4차(비용 최적화 + 전체 페이지 반영)는 포함하지 않는다.

## 핵심 설계 결정: DB CHECK 제약 확장이 불가피했다

이번 phase는 "DB schema 변경은 가능하면 피한다" 원칙과 정면으로
부딪히는 유일한 지점이었다 — `social_posts.platform`에 이미
`social_posts_platform_check` CHECK 제약(migration 028)이 걸려 있어
새 플랫폼 값을 저장하려면 반드시 제약을 확장해야 한다. "가능하면
피한다"이지 "절대 하지 않는다"가 아니므로, 최소 범위(제약 재정의
하나)만 담은 마이그레이션을 작성했다.

```sql
-- db/migrations/044_phase-4-3-news-article-platform.sql
alter table social_posts drop constraint social_posts_platform_check;
alter table social_posts
  add constraint social_posts_platform_check
  check (platform in (
    'news_article', 'wordpress_blog', 'naver_blog', 'naver_cafe', 'x', 'threads', 'instagram'
  ));
```

기존 행은 전혀 건드리지 않는다(제약 재정의뿐이다) — 기존 6개
플랫폼의 데이터/동작에는 영향이 없다. 애플리케이션 레벨에서도
`lib/supabase/database.types.ts`의 `SocialPlatform`(Supabase 타입,
`lib/social/social-platform-types.ts`의 `SocialPlatform`과는 별도
정의라 둘 다 갱신했다)에 `news_article`을 추가했다.

## TypeScript 컴파일러가 안내한 20여 개 파일

`SocialPlatform` 유니언에 값을 하나 추가하자, 이 프로젝트 전반에
퍼져 있는 `Record<SocialPlatform, X>`(exhaustive map)와
`switch (platform) { ...; default: { const exhaustiveCheck: never = platform; ... } }`
(exhaustive switch) 패턴이 `tsc`에서 일제히 "Property 'news_article'
is missing"/"Type '\"news_article\"' is not assignable to type
'never'" 에러로 나타났다. **이 에러 목록이 곧 "news_article을
지원하려면 채워야 할 실제 동작 목록"이었다** — 임의로 빠뜨릴 수 없게
컴파일러가 강제한 셈이다. 채운 파일은 다음과 같다(모두 기존 6개
플랫폼과 같은 패턴을 그대로 따랐다 — 새 추상화를 만들지 않았다).

| 파일 | 추가한 내용 |
|---|---|
| `lib/social/social-platform-types.ts`, `lib/supabase/database.types.ts` | `SocialPlatform`에 `news_article` 추가 |
| `lib/social/platform-writing-config.ts` | `PLATFORM_WRITING_CONFIGS.news_article`(제목+본문, manual export, 500~3000자), 출력 계약/prompt 파일명 매핑 |
| `lib/social/platform-generation-recommendations.ts` | `PLATFORM_LABELS`("언론 기사"), `PLATFORM_SHORT_DESCRIPTIONS`, `PLATFORM_COST_LEVELS`("medium"), 추천 문체("informational") |
| `lib/social/content-type-classifier.ts` | `getPlatformGroup`("blog" 그룹), `ContentType`에 `news_article` 추가, 라벨("언론 기사") |
| `lib/social/social-export-builder.ts` | manual export(제목+본문 필수) + `buildExportPayload`(markdown) |
| `lib/social/social-post-preview-formatters.ts` | 상세 미리보기 + export 미리보기 포맷 |
| `lib/social/social-post-platform-preview.ts` | 게시용 미리보기 모드(`mobile_blog` 재사용 — naver_blog와 같은 문단형 렌더링, HTML 변환 대상 아님) |
| `lib/social/platform-publishing-rules.ts`, `platform-publishing-guard-service.ts` | 승인 게이트 규칙(title/body 필수, 리드문 존재, mock 흔적 없음) |
| `lib/social/platform-publish-dry-run-builder.ts` | dry-run/handoff payload |
| `lib/social/platform-manual-posting-checklist-builder.ts` | 수동 게시 체크리스트(리드문/사실-해석 구분/중립적 톤 확인) |
| `lib/social/platform-rewrite-strategies.ts`, `platform-writing-templates.ts` | rewrite 개선 가이드, mock 생성 구조 가이드 |
| `lib/social/rewrite-performance-comparison-rules.ts`, `platform-metrics-config.ts` | 성과 비교 지표(조회수 중심), metrics 설정 |
| `lib/social/platform-api-capabilities.ts`, `platform-api-readiness-checker.ts`, `platform-adapters/` | API 게시 capability(`manual_export`, 실제 API 없음), 신규 adapter(`news-article-api-publish-adapter.ts`, naver_cafe adapter와 동일하게 "manual export 안내만" 반환) |
| `lib/social/social-output-contract-validator.ts` | 필수 필드 검증(post_title/post_body) |
| `lib/articles/master-manuscript-builder.ts` | `getPlatformBrief`의 `news_article → newsArticle` 매핑(Phase 4-2에서 만든 `platformBriefs.newsArticle`을 처음 실제로 연결) |
| `lib/social/social-quality-gate.ts` | 전용 자동 검토 항목 2개(아래) |
| `lib/social/social-post-auto-review.ts` | 새 checklist key의 축(axis) 분류 |

## news_article 자동 검토 항목

`PLATFORM_WRITING_CONFIGS.news_article.qualityChecklistKeys`는
`BASE_CHECKLIST_KEYS`(공통) + `length_check`(공통 길이 검사, 500~3000자)
+ 다음 2개 전용 검사로 구성된다.

- **`news_article_lead_present`**(구조 축): 첫 문단(빈 줄로 구분되는
  첫 블록)이 30자 이상이면 리드문으로 인정한다. 너무 짧으면 `fail`
  — 육하원칙을 담을 만한 최소 형식조차 없다는 뜻이다. (실제 육하원칙
  요소 검출은 rule-based로는 한계가 있어, 이번 단계는 최소한의 형식
  신호만 확인한다 — 4차 이후 더 정교화할 수 있다.)
- **`news_article_no_unsourced_claim`**(출처 축): "반드시 ~할 것이다",
  "틀림없이", "무조건 오른다/내린다", "확실시된다" 같은 단정적 전망
  표현이 있으면 `warning`(승인 전 확인 권장 — 차단은 아니다, 뉴스
  기사에서도 전문가 인용 등 정당한 맥락에서 쓰일 수 있기 때문이다).

이 두 항목은 기존 `lib/social/social-post-auto-review.ts`의 "통과/
확인 필요/수정 필요/차단" 리포트에 자동으로 편입된다 — 새 리포트
로직을 만들지 않았다(Phase 3-25에서 만든 `summarizeAutoReview`가
checklist key만 보고 축을 분류하므로, 축 매핑 두 줄만 추가하면 된다).

## platformBrief 연결

Phase 4-2에서 `MasterManuscriptPlatformBriefs.newsArticle` 타입과
데이터는 이미 만들어져 있었지만, 그 값을 실제로 쓰는 플랫폼
생성기가 없었다. 이번 phase에서 `getPlatformBrief(master, "news_article")`
가 `newsArticle` 그룹을 반환하도록 매핑을 추가하면서, news_article
글 생성이 처음으로 `angle`/`leadPoints`/`factsToUse`/`avoid`를 담은
brief를 prompt에서 참고할 수 있게 됐다(`SocialWritingContext.platformBrief`
→ `assembleSocialWritingPrompt`의 `platform_brief` 블록, Phase 4-2에서
이미 만든 배관을 그대로 통과한다 — 이 phase에서 prompt assembler를
다시 건드리지 않았다).

## 대시보드 반영

`/dashboard`의 플랫폼 카드 목록은 `SOCIAL_PLATFORMS`를 그대로
순회하므로(`app/dashboard/page.tsx`), `news_article`을 추가하자 새
코드 변경 없이 카드가 자동으로 나타난다. **기본 추천 플랫폼
목록(`DEFAULT_RECOMMENDED_PLATFORMS`, `getRecommendedPlatforms()`의
모든 topicType 분기)에는 news_article을 넣지 않았다** — "언론사 모드
설정이 없으면 news_article은 선택 가능하되 기본 선택은 하지 않는다"
는 요구를 그대로 반영한 것이다. 반면 "전체 플랫폼 글 생성"(고급
옵션, 사용자가 비용 경고를 확인한 뒤 명시적으로 실행하는 기능)은
이제 7개 플랫폼 전부를 대상으로 한다 — 이 기능은 "지금 지원하는
모든 플랫폼"이라는 의미이지 "추천 플랫폼"이 아니므로, news_article도
포함하는 것이 맞다고 판단했다.

## 영향받지 않는 것

- 기존 6개 플랫폼(wordpress_blog/naver_blog/naver_cafe/x/threads/
  instagram)의 프롬프트, 계약, quality gate 규칙, export/dry-run
  로직은 전혀 건드리지 않았다 — 모든 변경은 `case "news_article":`
  분기 추가이거나 `Record`에 새 key를 추가하는 것뿐이었다.
- 자동 public publish는 추가하지 않았다 — `news_article`도 다른
  플랫폼과 마찬가지로 `allowAutoPublish: false`,
  `requiresHumanApproval: true`이고, API 게시 capability는
  `manual_export`(실제 API 연동 없음)다.
- 마스터 원고(Phase 4-1/4-2)의 나머지 구조는 그대로다.

## 테스트

- `lib/social/social-quality-gate.test.ts`: news_article 전용 검사
  4개(리드문 pass/fail, 단정적 전망 warning/pass) 추가.
- `lib/social/social-export-builder.test.ts`: `buildExportPayload`/
  `buildManualExportPayload`의 news_article 케이스(정상/필수 필드
  누락) 추가.
- `lib/social/platform-generation-recommendations.test.ts`: 모든
  topicType 추천에서 news_article이 기본 제외되는지, 추천 문체가
  informational인지 검증하는 테스트 추가.
- `lib/social/social-platform-config.test.ts`: "6개 플랫폼" 문구를
  "7개 플랫폼"으로 갱신(기존 generic 검증 로직은 `SOCIAL_PLATFORMS`를
  그대로 순회하므로 코드 변경 없이 통과했다).
- `lib/social/multi-platform-generation-service.test.ts`: "전체
  플랫폼 생성"이 이제 7개 플랫폼(news_article 포함)을 대상으로
  하는지 검증하도록 갱신.
- 전체 `npx vitest run`: 221 files / 2798 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류.
- `npm run build`: 성공.

## 관련 문서

- [`phase-4-1-master-manuscript-terminology.md`](./phase-4-1-master-manuscript-terminology.md) — 1차(용어 정리)
- [`phase-4-2-platform-brief-structuring.md`](./phase-4-2-platform-brief-structuring.md) — 2차(platformBrief 구조화, `newsArticle` brief가 이번 phase에서 처음 쓰인다)
- [`phase-3-1-multi-platform-writing-foundation.md`](./phase-3-1-multi-platform-writing-foundation.md) — 플랫폼 추가 시 건드려야 하는 파일 구조의 원래 설계
- `db/migrations/044_phase-4-3-news-article-platform.sql`
