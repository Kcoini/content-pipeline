# Phase 4-5: 글 유형별 생성·검토 기준 분리

## 문제

생성된 글이 어떤 유형(언론 기사/해설 기사/칼럼/블로그 등)인지가
분명하지 않으면, 자동 검토가 맞지 않는 기준을 적용할 위험이 있다 —
기사 본문에 FAQ·체크리스트·비교표가 없다는 이유로 낮게 평가되거나,
반대로 블로그 글이 리드문/육하원칙만 보고 통과되는 식이다.

## 확인 결과: 상당 부분은 이미 분리되어 있었다

이번 phase를 시작하기 전에 기존 구조를 먼저 확인했다. 그 결과, 다음은
**이미 이 원칙대로 동작하고 있었다**(이번 phase에서 새로 만들지 않음):

- **마스터 원고(원고) 레벨**: `general_news`/`source_based_explainer`/
  `monetized_blog` 3개 `ArticleMode`가 이미 있고, 각각 별도 eval 기준
  파일(`evals/general-news.eval.yaml` 등, `lib/ai/eval-article.ts`)로
  평가된다 — "해설 기사" 기준 분리는 이미 되어 있었다.
- **플랫폼별 글(social_posts) 레벨**: `lib/social/social-quality-gate.ts`가
  이미 `switch (platform)`로 완전히 분리되어 있다 — wordpress_blog의
  FAQ/체크리스트/표 검사(`wordpress_blog_faq_present` 등)는
  `case "wordpress_blog":` 안에만 있고 다른 플랫폼에는 실행되지 않는다.
- **news_article**(Phase 4-3)은 이 원칙의 실제 구현 사례다 — 전용 검토
  기준(리드문/출처)만 적용되고, FAQ·체크리스트는 요구하지 않는다.

없던 것은 **opinion_column(칼럼)** — `ArticleMode`에도 `SocialPlatform`
에도 전혀 존재하지 않았다. 이번 phase는 이 공백을 news_article과
동일한 패턴으로 채우고, 그 위에 "글 유형이 자동 검토 리포트에 항상
먼저 보이게" + "글 유형과 실제 본문이 어긋나면 알려주게" 하는 공통
계층을 추가했다.

## 1. opinion_column을 신규 플랫폼으로 추가

Phase 4-3(news_article 추가)과 동일한 절차를 그대로 따랐다 — `SocialPlatform`
유니언에 값을 추가한 뒤, `tsc`가 안내하는 "Property 'opinion_column' is
missing" 에러 목록을 하나씩 채웠다(약 20개 파일, 모두 기존 news_article
패턴을 그대로 복제).

- **DB**: `social_posts_platform_check` CHECK 제약을 다시 확장해야
  했다(`db/migrations/045_phase-4-5-opinion-column-platform.sql`) —
  기존 행은 건드리지 않는다.
- **검토 기준**(`lib/social/social-quality-gate.ts`): 전용 검사 3개.
  - `opinion_column_viewpoint_present`: 관점/주장 마커("필자는",
    "생각한다", "주장한다" 등)가 있는지 — 없으면 `fail`("칼럼형 글임이
    드러나야 한다"는 생성 기준을 검토에서도 강제한다).
  - `opinion_column_fact_opinion_distinction`: 사실과 의견을 구분하는
    표현("사실은", "이는 개인적인 해석" 등)이 있는지 — 없으면 `warning`
    (rule-based 한계상 확정적으로 판단하기 어려워 차단하지 않는다).
  - `opinion_column_counterargument_present`: 반론/한계 마커("반론",
    "다만", "물론" 등)가 있는지 — 없으면 `fail`(칼럼은 한쪽 주장만
    펼치면 안 된다).
  - **FAQ/체크리스트/비교표는 요구하지 않는다** — wordpress_blog 전용
    검사이므로 애초에 opinion_column 분기에는 존재하지 않는다.
- **마스터 원고 연결**(`lib/articles/master-manuscript-types.ts`,
  `master-manuscript-builder.ts`): `OpinionColumnBrief`
  { mainMessage, issues, readerMeaning, factInterpretationSplit,
  limitations }를 추가했다. `factInterpretationSplit`은 마스터 원고의
  기존 필드를 그대로 재사용해, "이 재료는 사실, 이건 해석"이 처음부터
  구분되게 한다. news_article의 `monetizedBlogExpansion`류 장문 재료는
  섞지 않았다(플랫폼 목적에 맞는 brief만 사용).
- **프롬프트/계약**: `prompts/social/opinion-column.md`,
  `contracts/social/opinion-column.schema.json`.
- 기본 추천 플랫폼에는 넣지 않았다(`news_article`과 동일 원칙 — 선택은
  가능하되 자동 추천하지 않는다).
- 자동 게시는 다른 플랫폼과 동일하게 금지(`allowAutoPublish: false`,
  `requiresHumanApproval: true`, API capability는 `manual_export`).

## 2. 자동 검토 리포트에 "글 유형 · 적용 기준" 항상 표시

`lib/social/platform-review-criteria.ts`(신규, `getReviewCriteriaForPlatform`
역할): 플랫폼별 목적(purpose)/검토 기준 요약(criteriaSummary)/"강제하지
않는 기준" 안내(notEnforced)를 반환하는 순수 함수. `/social-posts/[id]`,
`/articles/[id]/social`의 자동 검토 카드 최상단에 다음처럼 보여준다.

```
글 유형: 언론 기사
검토 기준: 리드문, 육하원칙, 출처 근거, 중립성, 사실과 해석 구분을 중심으로 검토했습니다.
주의: FAQ나 체크리스트가 없다는 이유로 감점하지 않았습니다.
```

opinion_column이면:

```
글 유형: 칼럼
검토 기준: 관점(중심 주장), 사실과 의견 구분, 반론/한계, 근거를 중심으로 검토했습니다.
주의: 중립적 사실 전달(리드문/육하원칙)만을 기준으로 감점하지 않았습니다 — 이 글은 의견형 글입니다.
```

raw enum(`opinion_column` 등)은 그대로 노출하지 않고 `PLATFORM_LABELS`의
한국어 라벨만 보여준다.

## 3. 글 유형 자동 추정 + 불일치 감지

`lib/social/content-type-mismatch.ts`(신규):

- `inferContentShape(postBody)`: 완벽한 의미 분석이 아니라, 관점/반론
  마커 존재 여부 + 첫 문단(리드문) 길이만으로 본문이
  `opinion_column_like`/`news_or_explainer_like`/`unclear` 중 어디에
  가까운지 추정한다.
- `detectContentTypeMismatch(platform, postBody)`: 설정된 platform과
  추정된 형태가 **정반대 기준을 요구하는 조합**(news_article ↔
  opinion_column)일 때만 "확인 필요"로 표시한다. 불확실하면(`unclear`)
  일부러 mismatch로 보지 않는다 — false positive로 매번 배너가 뜨는
  것을 피하기 위해서다.

화면(`/social-posts/[id]`)에서는 자동 검토 점수와 별개로 이 배너를
항상 보여준다:

```
글 유형 확인 필요
본문은 칼럼형 해설문(관점 + 반론/한계)에 가깝지만 현재 설정은 언론
기사(news_article)입니다. 기사로 유지하려면 관점 표현을 사실 전달형으로
바꾸고 출처 근거를 보강하세요. 칼럼으로 바꾸려면 의견형 글임을 명확히
표시하세요.

[본문 수정하기]   참고: 칼럼 기준에 더 가까워 보입니다
```

"본문 수정하기"는 기존 `/social-posts/[id]?tab=edit#edit-panel` 편집
탭으로 연결한다(Phase 3-25/3-26에서 이미 있던 편집 흐름을 재사용) —
이번 phase에서 AI가 자동으로 글 유형을 바꾸거나 본문을 고쳐 쓰지
않는다. 클릭 후 무반응 상태는 없다.

## 4. 다른 플랫폼 조합까지 확장하지 않은 이유(범위 제한, 의도적)

`inferContentShape`/`detectContentTypeMismatch`는 news_article ↔
opinion_column 조합만 다룬다. wordpress_blog/naver_blog/naver_cafe 등은
이미 `social-quality-gate.ts`의 구조 검사(FAQ/표/체크리스트/plain
text/질문 개수 등)로 "이 플랫폼다운 구조를 갖췄는지"를 충분히
검증하고 있어, 별도의 "형태 추정" 계층을 추가하면 중복 판정 로직이
두 곳에 생긴다. news_article과 opinion_column은 정반대 문체를
요구하면서도 둘 다 "제목+장문 본문"이라는 같은 구조를 쓰기 때문에
구조 검사만으로는 구분할 수 없는 유일한 조합이라, 이 둘만 별도
계층으로 다뤘다.

## 5. 안전 원칙 재확인

- 자동 검토는 최종 승인을 대체하지 않는다 — `getApprovalGateStatus`/
  `approveSocialPost`는 이번 phase에서 변경하지 않았다. 승인은 항상
  사람이 [최종 승인] 버튼을 눌러야 한다.
- opinion_column도 다른 플랫폼과 마찬가지로 `allowAutoPublish: false`다.
  자동 public publish는 추가하지 않았다.
- 글 유형 불일치가 감지되어도 시스템이 임의로 platform을 바꾸거나
  본문을 재작성하지 않는다 — 안내와 수정 탭 링크만 제공한다.

## 테스트

- `lib/social/social-quality-gate.test.ts`: opinion_column 전용 검사
  3개(관점/사실-의견 구분/반론) pass/fail/warning 케이스 + "FAQ/
  체크리스트가 없어도 그것만으로 실패하지 않는다" 케이스.
- `lib/social/content-type-mismatch.test.ts`: `inferContentShape` 4개
  케이스, `detectContentTypeMismatch` news_article ↔ opinion_column
  양방향 mismatch/일치 케이스, 다른 플랫폼은 대상이 아님을 확인.
- `lib/social/platform-review-criteria.test.ts`: 8개 플랫폼 모두
  purpose/criteriaSummary 존재, news_article의 "FAQ 강제 안 함" 안내,
  opinion_column/wordpress_blog 기준 문구 확인.
- `lib/social/platform-generation-recommendations.test.ts`,
  `multi-platform-generation-service.test.ts`,
  `social-platform-config.test.ts`: opinion_column이 news_article과
  같은 원칙(기본 추천 제외, persuasive 톤 추천, 전체 8개 플랫폼)을
  따르는지 갱신.
- `app/social-posts/[id]/page.test.ts`,
  `app/articles/[id]/social/page.test.ts`: 글 유형/검토 기준 표시,
  "글 유형 확인 필요" 배너 + 수정 탭 링크 정적 검사.
- 전체 `npx vitest run`: 224 files / 2861 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 관련 문서

- [`phase-4-3-news-article-platform.md`](./phase-4-3-news-article-platform.md) — 이번 phase가 그대로 따라간 "신규 플랫폼 추가" 절차의 원형
- [`phase-4-2-platform-brief-structuring.md`](./phase-4-2-platform-brief-structuring.md) — `OpinionColumnBrief`가 따르는 platformBrief 구조
- [`phase-3-25-auto-review-editor-workflow.md`](./phase-3-25-auto-review-editor-workflow.md) — 자동 검토 리포트("통과/확인 필요/수정 필요/차단")의 원래 설계, 이번 phase는 그 위에 글 유형 표시만 얹었다
- [`master-manuscript-generation-strategy.md`](./master-manuscript-generation-strategy.md) — 마스터 원고 레벨의 ArticleMode별 기준 분리(이미 되어 있던 부분)
