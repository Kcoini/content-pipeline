# Phase 2-24: 수익형 블로그 구조 강화 (SEO/AEO/GEO/E-E-A-T/체류시간/모바일)

## 문제

Markdown→HTML 변환(Phase 2-21)으로 `#`/`##` 노출 문제는 해결됐지만,
WordPress에 공개된 수익형 블로그 글의 **구조 자체**가 여전히 기사
해설형에 가까워, 아래 문제가 남아 있었다.

1. 도입부가 뉴스 요약처럼 딱딱하다.
2. 독자의 상황별 판단 기준이 부족하다.
3. 요약 박스가 markdown 목록 수준이라 눈에 띄지 않는다.
4. 표/체크리스트/FAQ가 부족하다(FAQ는 1개 정도만 있어도 "있다"로
   취급됐다).
5. 경제·금융 수치의 출처와 기준일 표시가 약하다.
6. 문단이 설명형으로 길어 체류시간 구조가 약하다.
7. 광고 배치 지점이 명확하지 않다(기존에 이미 AD_SLOT marker
   위치는 정의돼 있었으나, 요약 박스가 HTML이 아니었다).
8. 모바일 가독성이 부족할 수 있다(표 셀에 긴 문단이 들어가는 경우).

## 실제 콘텐츠 생성 경로 확인 (중요)

이 프로젝트에는 "수익형 블로그"에 해당하는 두 개의 서로 다른, 완전히
독립된 생성 경로가 있다 — 이번 작업은 **둘 다** 개선했다.

1. **`monetized_blog`(article mode)** — `lib/ai/article-writer.ts`.
   article 개요 페이지의 "원본 article WordPress 전송"(보조 기능)이
   보내는 `article.content`를 생성한다.
2. **`wordpress_blog`(social post platform)** — `lib/social/
   social-prompt-assembler.ts` + `prompts/social/wordpress-blog.md`.
   `/articles/[id]/blog`에서 만드는 wordpress_blog 카드(`post_body`)를
   생성한다. **실제로 WordPress에 공개되는 글은 대부분 이 경로를
   거친다** — `prompts/social/wordpress-blog.md`는 단순 문서가 아니라
   `assembleSocialWritingPrompt()`가 `readFileSync`로 실제 읽어 AI
   system prompt에 그대로 포함시키는 **살아있는 prompt 파일**이다.

두 경로 모두 최종적으로 `lib/wordpress/markdown-to-wordpress-html.ts`의
`convertMarkdownToWordPressHtml()`/`ensureWordPressHtmlContent()`를 거쳐
WordPress로 전송된다(Phase 2-21).

## 조치

### 1) Markdown→HTML 변환기에 "박스" 컨테이너 지원 추가 (`lib/wordpress/markdown-to-wordpress-html.ts`)

요약 박스를 markdown 목록이 아니라 실제 `<div class="...">` HTML로
만들 수 있게, AD_SLOT marker/`<br>`과 동일한 "placeholder 치환" 방식을
확장했다:

- 새 export `WORDPRESS_BOX_CLASSES = ["summary-box", "key-points-box",
  "checklist-box", "warning-box", "source-box"]` — 이 화이트리스트에
  있는 class만 허용한다.
- `<div class="화이트리스트 class">`와 `</div>`을 markdown 렌더링 전에
  고유 placeholder로 치환하고(여는/닫는 태그는 등장 순서로 짝짓는다),
  렌더링+sanitize+표 스타일링이 끝난 뒤 placeholder를 원래 태그로
  되돌린다. 이때 `<p>BOXOPEN0</p>`처럼 markdown 렌더러가 만든 문단
  래퍼를 먼저 벗겨낸 뒤 치환한다 — `<div>`(block 요소)가 `<p>` 안에
  갇혀 깨지는 것을 방지하기 위해서다.
- 화이트리스트에 없는 class나 형식이 다른 `<div>`(예: `onclick` 속성이
  섞인 경우)는 이 패턴에 매치되지 않아 그대로 남고, markdown-it
  (`html:false`)에 의해 escape되어 **실행 가능한 HTML로 남지 않는다**
  (보안 검증 완료 — 테스트 참고).
- `div`/`class` 속성을 sanitize-html의 `allowedTags`/`allowedAttributes`/
  `allowedClasses`에도 추가했다(이미 HTML로 변환된 content를 재
  sanitize하는 경로 — `ensureWordPressHtmlContent`의 "이미 HTML" 분기 —
  에서도 박스가 유지되도록 방어적으로 추가).

### 2) `monetized_blog`(article mode) 프롬프트/mock 생성기 강화 (`lib/ai/article-writer.ts`)

- `MONETIZED_BLOG_SYSTEM_PROMPT`에 "【필수 구조】" 섹션을 추가해 독자
  문제 중심 도입부 → 먼저 결론 → 핵심 요약 박스(`<div class="summary-box">`)
  → 표(최소 1개) → **독자 상황별 영향**(경제/금융/정책 주제면 대출자/
  예금자/투자자/실수요자 예시, 그 외 주제는 관련 있는 독자군으로 대체)
  → 확인 체크리스트 → 주의점/예외 → FAQ(최소 4개) → 최종 요약 →
  참고한 자료 → 기준일 안내를 명시적으로 요구하도록 확장했다.
- `MONETIZED_BLOG_TOOL.content`의 설명에도 이 구조 요건을 반영했다.
- `generateMonetizedBlogMock()`(AI 비활성/실패 시 fallback)도 동일한
  구조를 실제로 생성하도록 다시 작성했다 — summary-box div, 독자
  상황별 영향(3개 상황, 특정 주제에 고정하지 않고 어떤 theme에도
  적용 가능한 일반 문구), checklist-box, warning-box, FAQ 4개, "참고한
  자료"(출처 URL이 있으면 markdown 링크), "기준일 안내" 섹션을 모두
  포함한다.
- `assessMonetizedBlogQuality()`(품질 경고 함수, 차단이 아니라
  `qualityWarnings`만 남김)에 새 검사를 추가했다: 요약 박스 존재,
  "먼저 결론" heading 존재, 표 존재, 체크리스트 존재, FAQ 4개 이상,
  "참고한 자료" 섹션 존재, "기준일" 문구 존재, 문단 과다 길이(400자
  초과 순수 문단), "이번 글에서는" 류 상투적 도입부 문구. 이 함수를
  mock 생성기에서도 호출하도록 연결해, AI/mock 양쪽 다 같은 기준으로
  검토 신호를 남긴다.

### 3) `wordpress_blog`(social post) 프롬프트 강화 (`prompts/social/wordpress-blog.md`)

이 프롬프트는 이미 상당히 정교했다(독자 상황별 판단 섹션, 상투적 표현
금지 목록, 표 작성 규칙 등 기존에 이미 존재). 이번에 추가한 것:

- "핵심 요약 박스 — HTML 사용" 섹션 신설: `<div class="summary-box">`
  형식과 화이트리스트 class 5종을 명시.
- "FAQ 개수 기준" 섹션 신설: 최소 4개, `**Q. 질문**` + `A. 답변` 형식.
- "자료 기준일 안내" 섹션 신설: 경제/금융/정책/제도 주제에 기준일
  안내 문구 요구.
- "생성 후 자체 편집 단계" 체크리스트에 위 세 항목 확인 문항 추가.

### 4) wordpress_blog 품질 게이트 강화 (`lib/social/social-quality-gate.ts`)

기존 `wordpress_blog_faq_present`(FAQ 섹션 "존재 여부"만 확인)를
**개수 기반**으로 바꿨다(`**Q.` 패턴 카운트, 최소 4개 미만이면
`warning`). 그리고 아래 4개 검사를 새로 추가했다(모두 "가산" —
`warning` 수준이며 통과를 막지 않는다):

- `wordpress_blog_summary_box_present`
- `wordpress_blog_table_present`
- `wordpress_blog_checklist_present`
- `wordpress_blog_source_date_notice_present`

이 검사들은 wordpress_blog 카드 화면(`/articles/[id]/blog`)의 quality
gate 결과에 그대로 노출되어, 사용자가 게시 전에 무엇이 부족한지 알 수
있다.

### 5) AD_SLOT marker (변경 없음)

`monetized_blog` article mode는 기존 `AD_SLOT_MARKERS`(`after_summary`,
`after_intro`, `mid_content_1`, `mid_content_2`, `before_faq`,
`before_conclusion`)를 그대로 사용한다 — 요청받은 5개 위치를 이미
포함하는 상위집합이라 변경하지 않았다. wordpress_blog(social post)는
기존 설계대로, article이 이미 `monetized_blog` 모드이고 AD_SLOT marker를
포함하고 있으면 그 마커를 그대로 존중하며, 스스로 새 광고 슬롯 배치
규칙을 만들지 않는다(기존 의도된 설계, 이번에 바꾸지 않았다).

## 영향 범위 확인

- **source_based_explainer**: `generateMonetizedBlogMock`/
  `MONETIZED_BLOG_SYSTEM_PROMPT`만 수정했고, `generateSourceBasedExplainerMock`/
  `ARTICLE_SYSTEM_PROMPT`는 손대지 않았다 — 테스트로 재확인.
- **naver_blog**: 이번 수정 대상 파일(`article-writer.ts`,
  `wordpress-blog.md`, `social-quality-gate.ts`의 wordpress_blog
  분기, `markdown-to-wordpress-html.ts`)을 전혀 참조하지 않으므로
  영향 없음.
- **general_news**: 변경 없음.
- **WordPress HTML 변환**: 기존 `#`/`##`/표/목록/링크/h1→h2 변환 동작은
  그대로 유지되며(Phase 2-21 회귀 없음), `<div>` 박스 지원이
  추가됐을 뿐이다.

## 테스트

- `lib/wordpress/markdown-to-wordpress-html.test.ts`: 박스 태그가
  올바르게 중첩되는지(`<p>` 안에 갇히지 않는지), 5개 class 전부
  지원되는지, 화이트리스트 밖 class/위험한 속성이 escape되어
  무력화되는지, 이미 HTML인 content에서도 박스가 유지되는지.
- `lib/ai/article-writer.test.ts`: monetized_blog mock에 먼저 결론/
  요약 박스/표/독자 상황별 영향/체크리스트/FAQ 4개/참고한 자료/
  기준일 안내가 모두 포함되는지, `qualityWarnings`가 빈 배열인지,
  source_based_explainer는 영향받지 않는지.
- `lib/ai/eval-article.test.ts`: 새 eval 기준(`reader-scenario-relevance`,
  `source-date-disclosure`)이 `monetized-blog.eval.yaml`에 포함되는지.
- `lib/social/social-quality-gate.test.ts`: FAQ 개수 기반 판정, 새
  4개 검사(요약 박스/표/체크리스트/기준일)의 pass/warning 케이스.
- `lib/social/social-prompt-files.test.ts`: `wordpress-blog.md`에 박스
  HTML 지시/FAQ 최소 4개/기준일 안내/표 최소 1개 지시가 실제로
  포함되는지.
- 전체 `npm run lint`(0 errors), `npm run test`(2440/2440 통과),
  `npx tsc --noEmit -p .`(기존 baseline 37건 유지, 신규 0건),
  `npm run build`(성공) 확인.

## 관련 문서

- `docs/article-generation-monetized-blog.md`
- `docs/wordpress-blog-card-ui-rules.md`
- `docs/phase-3-operation-manual.md`
- `docs/phase-2-21-article-wordpress-markdown-to-html.md`
