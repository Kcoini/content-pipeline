# Phase 4-2: "마스터 원고 중심" 구조 전환 — 2차 (platformBrief 구조화)

## 배경과 범위

[Phase 4-1](./phase-4-1-master-manuscript-terminology.md)이 UI 용어와
폼 구조("마스터 원고 만들기", 3종류를 고급 옵션으로)를 정리했다면,
이번 2차는 그 마스터 원고를 실제로 **구조화된 편집 자료**로 만들고,
플랫폼별 글 생성이 마스터 원고 전체가 아니라 그중 필요한
`platformBrief` 부분만 쓰도록 연결하는 작업이다.

2차 범위:
- 마스터 원고를 요청 문서의 JSON 스키마(sourceSummaries/verifiedFacts/
  platformBriefs 등)에 맞춘 구조화된 데이터로 계산한다.
- 플랫폼별 글 생성(`buildSocialWritingContext`/`assembleSocialWritingPrompt`)이
  이 platformBrief를 prompt에 추가로 포함하도록 연결한다.

3차(`news_article` 플랫폼 추가), 4차(비용 최적화 전면 검토 + 전체
페이지 반영)는 포함하지 않는다.

## 핵심 설계 결정: 마스터 원고를 만들기 위해 AI를 다시 호출하지 않는다

가장 중요한 결정이다. 원 스펙은 "master-manuscript.md" prompt로 AI를
한 번 더 호출해 구조화된 원고를 만드는 그림을 제시했지만, 이 프로젝트는
이미 `articles`가 Phase 1-3~2-24를 거쳐 만든 결과물이고(Phase 4-1에서
"이 article이 곧 마스터 원고"라고 재해석했다), 그 article과 이미 저장된
출처(`Source.summary`/`Source.keyPoints`)만으로 구조화된 편집 자료를
**결정적으로(순수 함수로)** 계산할 수 있다. 그래서 이렇게 했다.

- 새 AI 호출 비용이 전혀 추가되지 않는다 — "16. 비용 최적화 원칙"을
  4차를 기다리지 않고 이번에 이미 지킨 셈이다.
- `lib/ai/article-writer.ts`(1737줄)의 기존 생성 로직을 전혀 건드리지
  않는다 — 회귀 위험이 없다.
- article/source가 수정되면(향후 편집 기능이 생기면) 항상 최신 데이터로
  다시 계산되는 파생 데이터라서 별도 동기화 문제가 없다.

```
lib/articles/master-manuscript-types.ts     (신규) — MasterManuscript 등 타입 정의만
lib/articles/master-manuscript-builder.ts   (신규) — 순수 함수
  buildMasterManuscript(article, sources): MasterManuscript
  getPlatformBrief(master, platform): 그 플랫폼 전용 brief만 추출
```

## 저장 위치: 새 테이블/컬럼 없음

`articles.format_metadata`(jsonb, 이미 `format_metadata.wordpress`
등으로 namespace를 나눠 쓰고 있던 필드)에 `master_manuscript` 키로
저장한다 — `saveWordPressMetadata`가 쓰는 것과 완전히 같은 패턴이다.

```
lib/repositories/article-repository.ts (기존 파일 확장)
  saveArticleMasterManuscript(articleId, masterManuscript)  (신규)
  readArticleMasterManuscript(article)                      (신규, 순수 함수)
```

`app/dashboard/actions.ts`의 `generateArticleDraft`는 `article_draft_created`
로그를 남긴 직후(article이 이미 저장된 뒤) `buildMasterManuscript(article,
citedSources)`를 계산해 저장한다. **citedSources**(실제로 인용된
출처만, 등록된 전체 출처가 아님)를 넘긴다 — 마스터 원고가 article이
실제로 근거로 삼은 출처만 반영하게 하기 위해서다. 이 단계는 `try/catch`로
감싸 실패해도 이미 만들어진 article 저장 자체를 막지 않는다(부가
데이터이기 때문 — "버튼 클릭 후 무반응"과는 다른 문제라 별도로
안내만 로그에 남긴다).

## 마스터 원고 구조

요청 문서의 JSON 스키마를 그대로 타입으로 옮겼다(`MasterManuscript`,
`lib/articles/master-manuscript-types.ts`). 핵심 필드와 계산 방식은
다음과 같다.

| 필드 | 계산 방식 |
|---|---|
| `sourceSummaries` | summary 또는 keyPoints가 있는 출처만, 원문 그대로(요약이지 원문 아님) |
| `verifiedFacts` | 여러 출처에 **같은 keyPoint 문장**이 등장하면 그 출처들을 묶어 confidence="high", 한 출처에서만 나오면 "medium" — AI의 주관 판단이 아니라 출처 개수로 기계적으로 정한다 |
| `verificationNeeded` | confidence="medium"인 사실(교차 확인 안 됨) + 출처가 3건 미만이면 그 사실도 추가 |
| `prohibitedOrCarefulExpressions.prohibited` | `BASE_PROHIBITED_PATTERNS`(`lib/social/platform-writing-config.ts`) 재사용 — 새로 정의하지 않는다 |
| `titleCandidates` | article.title/seoTitle 기반 간단한 변형(당장은 AI 재작성이 아니라 템플릿 기반 — 필요하면 후속 작업에서 AI 다듬기 추가 가능) |
| `platformBriefs` | 6개 그룹(newsArticle/wordpressBlog/naverBlog/naverCafe/shortSocial/instagram)으로 나눠 mainMessage/verifiedFacts/keywords 등을 재배치 |
| `autoReviewCriteria` | 요청 문서 "11. 마스터 원고 자동 검토" 8개 항목을 그대로 문자열로 |

`getPlatformBrief(master, platform)`은 `SocialPlatform` → `platformBriefs`의
해당 그룹만 골라 반환한다(x/threads는 둘 다 `shortSocial`을 공유).
`newsArticle` 그룹은 타입과 데이터 모두 이미 채워지지만, 아직 어떤
플랫폼 생성기도 이 값을 쓰지 않는다(3차에서 `news_article` 플랫폼이
추가되면 그때 연결한다) — 미리 정의해 둔 것뿐이다.

## 플랫폼별 글 생성 연결

`lib/social/social-writing-context-builder.ts`의 `SocialWritingContext`에
`platformBrief` 필드를 추가했다. `buildSocialWritingContext()`가
`readArticleMasterManuscript(article)`로 마스터 원고를 읽고, 있으면
`getPlatformBrief()`로 그 플랫폼 몫만 넣는다 — **마스터 원고 전체나
다른 플랫폼의 brief는 절대 넣지 않는다.**

```
buildSocialWritingContext(articleId, { platform, toneStyle })
        │
        ├─ article, sources 조회 (기존 그대로)
        ├─ excerpt/keyPoints/sourceSummaries 계산 (기존 그대로, 삭제하지 않음)
        └─ readArticleMasterManuscript(article) → 있으면 getPlatformBrief(master, platform)
                │
                ▼
        SocialWritingContext.platformBrief (신규 필드, 없으면 null)
```

`lib/social/social-prompt-assembler.ts`의 `buildUserPrompt()`는
`context.platformBrief`가 있으면 `platform_brief` 블록으로 user
prompt에 추가한다(JSON 그대로, 이미 압축된 자료라 그대로 넣어도
비용 부담이 크지 않다). 없으면 그 줄 자체가 생략된다 — **하위 호환**:
Phase 4-2 이전에 생성된 article(마스터 원고가 없음)도 기존
excerpt/keyPoints/sourceSummaries만으로 생성이 그대로 동작한다.

`contextSummary`(로그용 안전 요약)에는 `platformBrief` 원문 대신
`hasPlatformBrief: boolean`만 남긴다 — 기존 "article 원문/전체 brief를
로그에 남기지 않는다" 원칙과 일치시켰다.

## 영향받지 않는 것 / 하위 호환

- 기존 `excerpt`/`keyPoints`/`sourceSummaries` 계산과 그 이후의
  generation/quality-gate 파이프라인은 전혀 바뀌지 않았다 —
  `platformBrief`는 **추가된** 보조 정보다.
- Phase 4-2 이전에 만들어진 article(마스터 원고 없음)은
  `platformBrief: null`로 정상 동작한다 — 새 마이그레이션이나 백필이
  필요 없다.
- DB schema는 전혀 바꾸지 않았다(`format_metadata`는 기존 jsonb 컬럼).
- 자동 검토/승인/export/Draft 흐름, quality gate, social_posts 생성
  로직은 전혀 건드리지 않았다.
- 자동 public publish는 추가하지 않았다.

## 테스트

- `lib/articles/master-manuscript-builder.test.ts`(신규, 12개):
  sourceSummaries 필터링, verifiedFacts confidence 계산(교차 확인
  high/medium), verificationNeeded 생성, 금지 표현 재사용, 6개
  platformBriefs 존재, wordpressBlog seoKeywords 조합, 결정성(같은
  입력 → 같은 결과), `getPlatformBrief`의 플랫폼별 매핑(x/threads
  공유 포함).
- `lib/repositories/article-repository.test.ts`: `readArticleMasterManuscript`
  (null/값 있는 경우), `saveArticleMasterManuscript`(namespace 저장,
  존재하지 않는 기사 에러) 테스트 추가.
- `lib/social/social-writing-context-builder.test.ts`: 기존 mock을
  `importOriginal`로 바꿔 `readArticleMasterManuscript`(순수 함수)가
  실제 구현으로 동작하도록 했다(기존 5개 테스트 그대로 통과).
- `lib/social/social-prompt-assembler.test.ts`: `platformBrief`가 있을
  때 userPrompt에 포함되고 contextSummary에는 원문 대신
  `hasPlatformBrief`만 남는지, 없을 때(하위 호환) `platform_brief`
  블록 자체가 생략되는지 검증하는 테스트 2개 추가.
- `lib/social/social-draft-generation-service.test.ts`,
  `lib/social/social-post-service.test.ts`: `SocialWritingContext` 목
  객체에 `platformBrief: null` 필드를 추가해 타입 오류 없이 기존
  테스트가 그대로 통과하게 했다(테스트 내용은 바꾸지 않았다).
- `app/dashboard/page.test.ts`: `generateArticleDraft`가
  `buildMasterManuscript`/`saveArticleMasterManuscript`를 호출하는지,
  실패해도 무시되도록 try/catch로 감쌌는지, 이 계산이 AI를 다시
  호출하지 않는지 검증하는 테스트 3개 추가.
- 전체 `npx vitest run`: 221 files / 2789 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류.
- `npm run build`: 성공.

## 알려진 제한 (다음 단계로 미룸)

- `titleCandidates`/`platformBriefs`의 문구는 템플릿 기반 조합이다 —
  AI가 다듬은 것보다 표현이 단조로울 수 있다. 실제 플랫폼 생성
  단계(기존 AI 생성 로직)는 여전히 AI가 최종 문장을 쓰므로 게시물
  품질에는 영향이 없지만, brief 자체의 표현력을 높이고 싶다면 후속
  작업에서 (비용을 고려해) AI 다듬기를 추가할 수 있다.
- `newsArticle` brief는 데이터가 이미 채워지지만 3차(`news_article`
  플랫폼 추가) 전까지는 어떤 생성기도 참조하지 않는다.
- `SocialWritingContext.platformBrief`가 실제 생성 품질에 미치는
  영향은 아직 정량 평가하지 않았다 — AI가 이 필드를 참고 자료로만
  쓰는지, 실제로 더 나은 글을 쓰는지는 4차(비용 최적화 + 전체 반영)
  단계에서 evals로 확인하는 것을 권장한다.

## 관련 문서

- [`phase-4-1-master-manuscript-terminology.md`](./phase-4-1-master-manuscript-terminology.md) — 1차(용어 정리)
- [`phase-3-1-multi-platform-writing-foundation.md`](./phase-3-1-multi-platform-writing-foundation.md) — `SocialWritingContext`/prompt 조립 구조의 원래 설계
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
