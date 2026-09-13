# Phase 4-21: 내부 작성용 소제목("리드문"/"본문"/"배경 설명"/"쟁점" 등) 노출 방지

## 문제

자동 생성되는 블로그/기사형 글에 "리드문", "본문", "배경 설명",
"쟁점", "향후 확인할 점", "출처" 같은 내부 작성 구조명이 게시용
소제목으로 그대로 노출될 수 있었다. 이 구조는 마스터 원고가 글을
구성할 때 참고하는 내부 항목명으로는 적절하지만, 독자가 보는 최종
글에는 기사 초안/내부 메모처럼 보인다.

## 원인 조사 결과

- **`prompts/social/news-article.md`**: "구조" 절이 "3. 리드문 —
  ...", "5. 배경 설명 — ...", "6. 쟁점 — ..." 처럼 번호 목록의
  항목명 자체를 그대로 소제목처럼 제시하고 있었고, 출력 JSON
  예시도 `"post_body": "리드문 → 본문 → 배경 설명 → 쟁점 → 향후
  확인할 점 → 출처 순서로 구성된 기사 본문"`이라고 되어 있어 AI가
  이 단어들을 실제 소제목으로 오해하기 쉬운 구조였다 — **가장 유력한
  실제 원인.**
- **`prompts/social/wordpress-blog.md`**: `explainer` topicType
  구조 설명이 "도입부 → 먼저 결론 → 배경 → 핵심 쟁점 → ..."처럼
  "배경"/"핵심 쟁점"이라는 짧은 단어를 그대로 노출하고 있었고, 이
  단어를 소제목으로 쓰지 말라는 명시적 규칙이 없었다.
- **`lib/social/platform-writing-templates.ts`**: news_article
  `structureGuidance`에도 같은 문구가 있었으나, 이 배열은 실제
  어디에서도 import되어 쓰이지 않는 죽은 코드였다(문서 목적으로만
  존재) — 그래도 일관성을 위해 함께 정리했다.
- **mock 생성(`social-draft-generation-service.ts`의
  `buildMockWordpressBlogBody` 등)은 이미 문제가 없었다** —
  "## 먼저 결론부터 보면"/"## 핵심 포인트"/"## 확인 필요 사항" 등
  독자 친화적 소제목만 사용하고 있었다.
- **`prompts/social/naver-cafe.md`/`naver-blog.md`는 이미 문제가
  없었다** — naver_cafe는 애초에 plain text·소제목 없음을 명시하고
  있었다.

## 해결

### 1) 프롬프트 수정 (근본 원인)

- `prompts/social/news-article.md`: "구조" 절을 "내용이 채워지는
  순서를 안내하는 것이지 실제 소제목이 아니다"로 명확히 하고,
  스트레이트 기사는 소제목 없이 문단 중심으로 구성 가능함을
  명시했다. 자동 검토 체크리스트와 출력 JSON 예시에서도 내부
  구성 항목 이름을 직접 노출하지 않도록 바꿨다.
- `prompts/social/wordpress-blog.md`: "본문 구조 형식" 절에 "소제목에
  마스터 원고 내부 구성 항목 이름을 그대로 쓰지 않는다" 규칙과,
  스펙이 제시한 변환 예시(본문→"왜 지금 이 문제가 주목받는가" 등)를
  그대로 추가했다. `explainer` topicType 설명도 "왜 이런
  상황인가(배경)"처럼 실제 문장형 표현을 앞에 두는 형태로 다듬었다.
- `lib/social/platform-writing-templates.ts`의 news_article
  `structureGuidance`도 같은 원칙으로 다시 썼다(죽은 코드이지만
  향후 재사용될 경우를 대비).

### 2) 후처리 sanitizer — `sanitizeInternalSectionHeadings`

`lib/social/internal-section-heading-sanitizer.ts`(신규)가 AI가
실수로 남긴 내부 소제목을 저장 직전에 한 번 더 정리한다(defense in
depth — 프롬프트만으로는 100% 보장할 수 없다):

- `## 리드문` / `# 리드문` / `**리드문**` → 소제목 줄 자체를
  제거한다(문단 내용은 그대로 둔다 — "제목 아래 첫 문단"이 된다).
- `본문` → `핵심 내용`, `배경 설명` → `왜 이런 상황인가`, `쟁점` →
  `쟁점: 기회와 우려`, `향후 확인할 점` → `앞으로 확인해야 할 변수`,
  `출처` → `참고한 자료`로 바꾼다(원래의 heading 마커(`#`/`##`/`**`)는
  유지한다).
- markdown heading(`#`/`##`/`###`)이나 bold-as-heading(`**...**`)
  형태로 **줄 전체가 그 단어인 경우만** 처리한다 — "이 글의
  본문에서..."처럼 문장 중간의 일반 단어는 건드리지 않는다.
- 문단 내용(사실/수치/문장) 자체는 전혀 바꾸지 않는다.

`lib/social/social-draft-generation-service.ts`가 AI 생성 결과를
저장하기 직전에 이 함수를 호출한다(naver_cafe의 기존
`sanitizeNaverCafePlainText`보다 먼저 적용). 정리가 실제로
일어났으면 `social_draft_internal_section_headings_sanitized`
이벤트를 `pipeline_logs`에 남긴다(`affectedKeys`만 담고 full body는
남기지 않는다).

### 3) 자동 검토 기준 추가

`lib/social/social-quality-gate.ts`:

- wordpress_blog/naver_blog/news_article/opinion_column 공통으로
  `no_internal_section_headings` 체크리스트 항목을 추가했다.
  `detectInternalSectionHeadings()`(수정하지 않고 감지만 하는 함수)로
  검사하며, 남아 있으면 `fail`(→ `needs_revision`)로 판단한다 —
  저장 시 sanitizer가 이미 정리했어도, 사람이 "본문 수정"으로 직접
  다시 붙여넣는 경우까지 잡아낸다.
- naver_cafe에는 `naver_cafe_no_markdown_heading` 항목을 추가해
  `## `/`### ` 형태의 markdown 소제목이 남아 있으면 `fail`로
  판단한다(네이버 카페는 소제목 없이 자연스러운 문장으로 구성해야
  한다).
- 이 검사들은 `input.postBody`(줄바꿈이 보존된 원본)를 직접
  검사한다 — 기존 `collectTextForPatternCheck()`가 만드는 `text`는
  여러 필드를 공백으로 이어붙여 줄바꿈이 사라지므로 줄 시작 앵커
  (`^`) 기반 정규식과 함께 쓰면 오탐(항상 통과)이 난다는 것을
  이번에 발견해 함께 고쳤다(`naver_cafe_no_markdown_heading`도 같은
  이유로 `text`가 아니라 `input.postBody`를 검사한다).

## 안전 원칙

- 자동 public publish는 어디에도 추가하지 않았다.
- sanitizer는 사실/수치/기관명을 추가하거나 바꾸지 않는다 — 소제목
  줄만 처리한다.
- `pipeline_logs`에는 `affectedKeys`(어떤 항목이었는지)만 남기고
  full body/prompt/AI 응답은 남기지 않는다.

## 이번 작업에서 하지 않은 것 (범위)

- 자동 보완(스펙 8번, "AI에게 다시 물어봐서 소제목만 자연스럽게
  정리")은 만들지 않았다 — `sanitizeInternalSectionHeadings()`가
  이미 결정론적으로 안전하게 처리하고, 남은 소제목 품질 문제는
  자동 검토의 "수정 필요" 표시로 사람이 판단하게 하는 것으로
  충분하다고 판단했다. 새 AI 재호출 로직(비용/실패 처리 포함)을
  추가하는 것은 범위가 커 다음 단계로 남긴다.
- WordPress "게시용 미리보기"/"편집용 원문" 탭 분리(스펙 9번)는
  Phase 4-16에서 이미 완료되어 있다 — 게시용 미리보기는
  `convertMarkdownToWordPressHtml()`로 렌더링된 HTML을 보여주므로,
  이번에 정리된 소제목도 자연스럽게 반영된다. 추가 변경 없음.
- UI에 "[소제목 자동 정리]" 버튼(스펙 11번)은 추가하지 않았다 —
  저장 시점에 이미 자동으로 정리되므로 별도 수동 버튼이 필요한
  경우가 드물다(사람이 "본문 수정"으로 직접 붙여넣은 경우는 자동
  검토의 "문제 확인하기" 흐름을 그대로 타면 된다).

## 테스트

- `lib/social/internal-section-heading-sanitizer.test.ts`(신규, 14개).
- `lib/social/social-draft-generation-service.test.ts`: 새 테스트 3개
  (wordpress_blog AI 출력 정리, 로그 기록 여부, 정리할 게 없으면
  로그 없음). 26 → 29개 통과.
- `lib/social/social-quality-gate.test.ts`: 새 describe 1개(6개 테스트:
  4개 platform 공통 검사, naver_cafe/x 제외 확인, naver_cafe markdown
  heading 검사). 64 → 70개 통과.
- `lib/social/social-prompt-files.test.ts`: news-article.md/
  opinion-column.md를 존재 확인 목록에 추가, 새 describe 2개
  (wordpress-blog.md/news-article.md 프롬프트 문구 검증). 33 → 45개
  통과.
- 전체 `npx vitest run`: 247 files / 3177 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 관련 문서

- [`master-manuscript-generation-strategy.md`](./master-manuscript-generation-strategy.md)
- [`wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md)
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
