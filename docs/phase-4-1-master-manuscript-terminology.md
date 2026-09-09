# Phase 4-1: "마스터 원고 중심" 구조 전환 — 1차 (용어 정리 + 고급 옵션화)

## 배경과 범위

이 작업의 목표는 콘텐츠 생성 구조를 "처음부터 3종류(general_news/
source_based_explainer/monetized_blog) 중 하나를 고르는" 방식에서
"출처 기반 마스터 원고를 먼저 만들고, 그 원고를 바탕으로 플랫폼별
글을 생성하는" 구조로 바꾸는 것이다. 요청 문서 자체가 "19. 작업 범위
조절"에서 4단계(1차 용어 정리 → 2차 platformBrief 구조화 → 3차
news_article 플랫폼 → 4차 비용 최적화/전체 반영)로 나눠 1차부터
안정적으로 구현할 것을 명시했다. 이번 작업은 **1차만** 구현한다.

1차 범위:
- 사용자 UI 용어를 "기사 초안"/"article"에서 "마스터 원고"로 바꾼다.
- 기존 3종류 article mode 선택을 기본 화면에서 숨기고 "고급 옵션" 뒤로
  옮긴다. 기본값은 "자동 추천"이다.
- 기존 article 데이터/기능/DB schema는 그대로 유지한다(재해석만 한다).

2차(platformBrief 구조화 prompt), 3차(news_article 플랫폼), 4차(비용
최적화/전 페이지 반영)는 이번 작업에 포함하지 않았다 — 아래 "다음
단계"에 범위와 이유를 남긴다.

## 핵심 설계 결정: DB schema를 바꾸지 않는다

`articles.article_mode` 컬럼에는 `articles_article_mode_check`
CHECK 제약(`db/migrations/011_phase-2-1-article-modes.sql`)이 있어
`general_news`/`source_based_explainer`/`monetized_blog` 3개 값만
저장할 수 있다. "자동 추천"은 네 번째 DB 값이 아니라 **UI 전용
sentinel**(`"auto"`)이다 — 폼에서 제출되면 서버 action이 DB에 쓰기
전에 실제 3종류 중 하나(기본값 `source_based_explainer`)로 반드시
바꾼다. 이렇게 하면 migration이 전혀 필요 없다.

```
lib/articles/article-modes.ts (기존 파일 확장, 기존 export 그대로 유지)
  AUTO_MASTER_MANUSCRIPT_DIRECTION = "auto"          (신규, UI 전용 sentinel)
  MasterManuscriptDirectionInput = ArticleMode | "auto"
  MASTER_MANUSCRIPT_DIRECTION_LABELS                  (신규, 사용자 표현 맵)
  MASTER_MANUSCRIPT_DIRECTION_LIST                     (신규, "자동 추천" + 기존 3종류)
  getMasterManuscriptDirectionLabel(value)             (신규)
  resolveMasterManuscriptDirection(value)              (신규, auto → DEFAULT_ARTICLE_MODE)

  ArticleMode / ARTICLE_MODE_CONFIGS / ARTICLE_MODE_LIST / DEFAULT_ARTICLE_MODE /
  isArticleMode / resolveArticleMode                   (기존 그대로, 삭제하지 않음)
```

`app/dashboard/actions.ts`의 `generateArticleDraft`는 `formData`에서
읽은 `articleMode`가 `"auto"`면 `resolveMasterManuscriptDirection()`을
거쳐 실제 `ArticleMode`로 바꾼 뒤, 기존 `isArticleMode` 검증을
그대로 통과시킨다 — 검증/재생성 확인 배너/로그 이벤트 등 이후 로직은
전혀 손대지 않았다(항상 실제 ArticleMode만 다루므로).

## 용어 매핑

| 내부 값(변경 없음) | 기존 사용자 표현 | 새 사용자 표현 |
|---|---|---|
| `general_news` | 일반 기사형 | 빠른 기사 중심 |
| `source_based_explainer` | 출처 기반 설명형 | 해설 중심 |
| `monetized_blog` | 수익형 블로그형 | SEO/수익화 중심 |
| (없음) | (없음) | 자동 추천(신규, 기본값) |

`ArticleModeConfig.label`(`"일반 기사형"` 등, eval/prompt 파일명과
짝지어진 내부 표기)은 그대로 둔다 — 이 값은 여전히 다른 곳(예:
`docs/article-generation-monetized-blog.md`)에서 참조될 수 있으므로
바꾸지 않고, `getMasterManuscriptDirectionLabel()`만 새 사용자 표현을
반환하도록 별도로 분리했다.

## UI 변경 — `/dashboard`

기존 "출처 기반 원고" 섹션(`id="generate-draft"`, 앵커는 그대로 유지
— `/themes/[themeId]`의 "글 생성 단계로 진행" 링크(Phase 3-27)가 이
id를 그대로 참조하므로 바꾸지 않았다)을 다음처럼 바꿨다.

- 섹션 제목: "출처 기반 원고" → **"마스터 원고"**
- 안내문 추가: "출처를 바탕으로 모든 플랫폼 글의 기준이 되는 마스터
  원고를 만듭니다. 이 원고는 그대로 게시하지 않고, 이후 각 플랫폼에
  맞게 변환됩니다."
- 원고가 없을 때: 3종류 라디오가 기본으로 펼쳐져 있던 것을
  `<details>` "고급 옵션: 원고 생성 방향 선택 (기본값: 자동 추천)"
  안으로 옮겼다. `<details>`가 닫혀 있어도 그 안의 라디오(기본
  체크: 자동 추천)는 폼 제출값에 그대로 포함된다 — JS 없이도
  동작한다.
- 주요 버튼: "기사 초안 생성" → **"마스터 원고 만들기"**(스타일도
  회색 테두리 버튼에서 검정 배경 primary 버튼으로 승격 — 이 화면의
  유일한 주요 행동임을 강조).
- 원고가 있을 때: "원고 생성 완료 · 유형: {…}" → **"생성 완료 ·
  생성 방향: {…}"**, "원고 보기" → **"마스터 원고 보기"**, "재생성
  옵션" 안의 "기사 초안 재생성" → **"마스터 원고 다시 만들기"**(여기
  라디오 목록에도 "자동 추천"을 추가했다).
- 재생성 확인 배너("이미 이 테마로 생성된 기사초안이 있습니다." 등)와
  생성 성공 메시지("OOO 기사초안이 생성되었습니다.")도 같은 표현으로
  바꿨다.
- "플랫폼별 글 생성" 섹션의 안내문("먼저 기사 초안(출처 기반
  원고)을…")도 "먼저 마스터 원고를 만들어야…"로 바꿨다.
- `lib/dashboard/dashboard-workflow-presentation.ts`의 "현재 상태 /
  다음 작업" 카드 문구(`ready_to_generate`/`needs_platform_posts`
  상태)도 같은 용어로 통일했다.

## 기존 article과의 호환성

- **재사용**: 새 테이블/컬럼을 추가하지 않았다. 기존 `articles` 테이블,
  `article_mode` 컬럼, `getArticleByThemeId`/`saveDraftArticle` 등
  repository 함수를 그대로 쓴다 — "마스터 원고"는 화면에 보이는
  이름일 뿐, 데이터 계층에서는 여전히 `Article`/`article`이다.
- 기존 `general_news`/`source_based_explainer`/`monetized_blog`로
  저장된 article은 각각 "빠른 기사 중심"/"해설 중심"/"SEO/수익화
  중심" 마스터 원고로 자동으로 보인다(같은 `article_mode` 값을
  새 라벨 함수로만 다시 표시하므로 별도 마이그레이션이 필요 없다).
- `social_posts`, quality gate, export/Draft 흐름은 전혀 건드리지
  않았다 — 이 phase는 `/dashboard`의 UI 용어와 폼 구조만 바꿨다.

## 다음 단계 (이번 phase에 포함하지 않음)

원 요청의 "19. 작업 범위 조절"에 따라 다음은 후속 작업으로 미룬다.

- ~~**2차 — platformBrief 구조화**~~ → 완료했다. 마스터 원고를
  `sourceSummaries`/`verifiedFacts`/`platformBriefs` 등을 담은
  구조화된 데이터로 계산하고(AI 재호출 없이, article/source로부터
  결정적으로 계산), `articles.format_metadata.master_manuscript`에
  저장했다. 플랫폼별 글 생성은 이제 해당 플랫폼의 platformBrief만
  추가로 받는다. 자세한 내용은
  [`phase-4-2-platform-brief-structuring.md`](./phase-4-2-platform-brief-structuring.md)
  참고.
- ~~**3차 — `news_article` 플랫폼 추가**~~ → 완료했다. `SocialPlatform`에
  `news_article`을 추가하고(DB CHECK 제약 확장 포함, 최소 migration),
  prompt/계약/quality gate/export/dry-run 등 플랫폼 하나가 필요로
  하는 모든 지점을 채웠다. 자세한 내용은
  [`phase-4-3-news-article-platform.md`](./phase-4-3-news-article-platform.md)
  참고.
- ~~**4차 — 비용 최적화 + 전체 페이지 반영**~~ → 완료했다. 마스터
  원고 계산과 prompt 조립에 방어적 상한선을 추가했고, `/articles/[id]`
  에 마스터 원고 정보를 처음으로 보여주는 섹션을 만들었다. 자세한
  내용은
  [`phase-4-4-master-manuscript-cost-and-rollout.md`](./phase-4-4-master-manuscript-cost-and-rollout.md)
  참고.
- **3차 — `news_article` 플랫폼 추가**: `SocialPlatform` 유니언 타입
  확장, `PLATFORM_WRITING_CONFIGS`/`PLATFORM_LABELS`/quality gate
  규칙/DB CHECK 제약(`social_posts` 관련 마이그레이션이 있다면) 등
  플랫폼 하나를 추가할 때 영향받는 지점이 많아 별도 작업으로
  분리한다.
- **4차 — 비용 최적화 + 전체 페이지 반영**: platformBrief 기반 생성이
  실제로 구현된 뒤에야 "source 원문을 반복해서 넣지 않는다"는 최적화가
  의미가 있다. `/articles/[id]`, `/articles/[id]/blog`,
  `/articles/[id]/social`, `/social-posts/[id]`, `/articles/[id]/rewrite`
  전체에 "마스터 원고" 용어를 반영하는 작업도 2차/3차 데이터 구조가
  먼저 정해진 뒤 진행하는 것이 안전하다(용어만 바꿨다가 2차에서
  데이터 모델이 바뀌면 다시 바꿔야 하는 이중 작업을 피하기 위함).

## 영향받지 않는 것

- `ArticleMode` enum, `ARTICLE_MODE_CONFIGS`, `ARTICLE_MODE_LIST`,
  `DEFAULT_ARTICLE_MODE`, `isArticleMode`, `resolveArticleMode`는
  전혀 삭제/수정하지 않았다 — 새 export만 추가했다.
  `evalFileName`/`promptFileName`(기존 eval/prompt 파일 연결)도
  그대로다.
- `social_posts` 생성, quality gate, 자동 검토, 승인/export/Draft
  흐름은 전혀 건드리지 않았다.
- 자동 public publish는 추가하지 않았다. WordPress는 여전히 Draft
  생성/업데이트까지만 허용한다.
- DB schema는 전혀 바꾸지 않았다(마이그레이션 없음).

## 테스트

- `lib/articles/article-modes.test.ts`: 새 helper 6개
  (`MASTER_MANUSCRIPT_DIRECTION_LIST` 구성, 라벨 매핑, `auto` →
  기본값 resolve, 유효한/알 수 없는 값 처리, 기존 enum이 삭제되지
  않았는지) 케이스 추가.
- `app/dashboard/page.test.ts`: 고급 옵션 접힘 구조, "마스터 원고
  만들기" 기본 버튼, "자동 추천" 기본 선택, 기존 3종류가 방향
  선택지로 남아 있는지, action의 auto→실제 모드 변환, 생성 성공
  메시지 문구를 검증하는 테스트를 추가했다. 기존 문구(원고 생성
  완료/기사 초안 재생성/새 초안으로 생성 등)를 검증하던 테스트는
  새 문구로 갱신했다(테스트 의도는 그대로 유지).
- 전체 `npx vitest run`: 220 files / 2768 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류.
- `npm run build`: 성공.

## 관련 문서

- [`docs/phase-1-23-dashboard-theme-workspace.md`](./phase-1-23-dashboard-theme-workspace.md)
- [`docs/phase-2-1-article-modes.md`](./phase-2-1-article-modes.md)
- [`docs/article-generation-monetized-blog.md`](./article-generation-monetized-blog.md)
- [`docs/phase-3-25-auto-review-editor-workflow.md`](./phase-3-25-auto-review-editor-workflow.md)
- [`docs/ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
