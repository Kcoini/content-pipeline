# `monetized_blog` 모드 — 문제 해결형 수익 블로그

이 문서는 기사 생성 모드 3종 중 `monetized_blog`의 개선된 설계를
설명한다. 구현은 `lib/ai/article-writer.ts`
(`MONETIZED_BLOG_SYSTEM_PROMPT`, `MONETIZED_BLOG_TOOL`,
`generateMonetizedBlogAiDraft`, `ensureAdSlotMarkers`)에 있고, 평가
기준은 `evals/monetized-blog.eval.yaml`에 있다.

## 정의

`monetized_blog`는 "광고 수익만 노리는 글"이 아니라, **독자의 문제를
해결하고, 검색엔진이 이해하기 쉽고, 생성형 AI 검색에서도 요약하기
쉬우며, 광고 정책과 신뢰성 기준을 지키는 문제 해결형 수익 블로그**
콘텐츠 모드다. 최우선 목표는 독자의 문제 해결과 신뢰성이며, SEO는
그 콘텐츠를 더 잘 발견되게 하는 보조 수단일 뿐이다.

## `wordpress_blog`(플랫폼)과의 관계 — 헷갈리지 말 것

`monetized_blog`는 article을 쓰는 **모드**(Phase 1/2, `articles`
테이블)이고, `wordpress_blog`는 소셜 글쓰기의 **플랫폼**(Phase 3,
`social_posts` 테이블, `/articles/[id]/blog`)이다. 이름이 비슷해서
헷갈리기 쉽지만 완전히 다른 스키마다.

**실제로 WordPress에 게시하는 기본(메인) 대상은 article이 아니라
`wordpress_blog` 플랫폼으로 생성한 블로그 글이다.** `monetized_blog`
모드로 article을 만들면 SEO 메타데이터(seoTitle/targetKeyword/
metaDescription)가 항상 채워지므로, 이후 `wordpress_blog` 글을 생성할
때 그 재료가 프롬프트에 함께 딸려간다는 이점이 있지만, `monetized_blog`
article 자체가 WordPress에 올라가는 것은 아니다(article 본문을
직접 WordPress로 보내는 경로는 `/articles/[id]`의 "고급 기능"으로
분리된 보조 기능이다). article 고급 기능과 wordpress_blog 게시
준비는 **같은 UI 컴포넌트**(`WordPressPublishingPanel`)를 쓰지만
`targetType`이 다르다 — article은 "대상: 원본 article" + "보조
기능"/"고급 기능" 배지, wordpress_blog는 "대상: wordpress_blog" +
"기본 게시 흐름" 배지로 명확히 구분된다. 자세한 내용은
[`article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md)
참고.

`answerSummary`/`eeatNotes`/`geoSummary`/`structuredDataSuggestions`는
**`monetized_blog` article 모드에서도 별도 구조화 필드로 저장되지
않는다** — AI 생성 시점에만 존재했다가 article.content 본문 텍스트
안에 자연어로 녹아들 뿐이다(`lib/ai/article-writer.ts`의
`GeneratedArticle` 참고, `app/dashboard/actions.ts`가 article을
저장할 때도 이 필드들은 `modeFields`에 전달하지 않는다). 즉
article_mode와 무관하게 article에는 이 정보가 전혀 남지 않는다.

그래서 **`wordpress_blog` 글 자신이 이 정보를 새로 만든다**
(`lib/social/wordpress-blog-metadata-generator.ts`). `wordpress_blog`
글 생성 시(mock 또는 실제 AI) 자신의 title/body/excerpt로부터
`seoTitle`/`metaDescription`/`targetKeyword`/`secondaryKeywords`/
`searchIntent`/`readerPersona`/`answerSummary`/`eeatNotes`/
`geoSummary`/`structuredDataSuggestions`/`adSlots`/`monetizationScore`/
`policyRiskScore`를 만들어 `social_posts.platformMetadata`(기존 JSON
필드, 새 컬럼 없음)에 저장한다. article에 이미 `seoTitle`/
`metaDescription`/`targetKeyword`/`secondaryKeywords`/`monetizationScore`/
`policyRiskScore` 값이 있으면(주로 monetized_blog 모드) 생성 시점에
참고용으로 재사용하지만, `answerSummary`/`eeatNotes`/`geoSummary`/
`structuredDataSuggestions`는 article에 원천적으로 없으므로 항상
wordpress_blog 자신이 새로 만든다.

**SEO metadata 업데이트 단계에서는 article 값으로 대체하지 않는다.**
wordpress_blog 자신의 `platformMetadata`에 seoTitle/metaDescription/
targetKeyword가 없으면 업데이트를 차단하고 "SEO Metadata 재생성"
사용을 안내한다(`updateWordPressSeoMetadataFromBlogPost`). `policyRiskScore`는
wordpress_blog 자신의 값을 우선 사용하고, 없으면 원본 article의
값으로 대체하며, 임계값(70)을 넘으면 readiness에 warning을 추가한다.

실제 WordPress로 전송되는 title/content도 `wordpress_blog` 글
자체의 `post_title`/`post_body`다 — article 원문(`article.title`/
`article.content`)을 사용하지 않는다.

SEO metadata 업데이트/대표 이미지 준비·연결/WordPress Draft 생성·
업데이트는 모두 `/articles/[id]/blog`의 wordpress_blog 카드 안
("WordPress 게시 준비"/"대표 이미지 준비" 섹션)에서 처리한다 —
article 페이지로 이동할 필요가 없다. 대표 이미지 연결은 WordPress
Draft(post ID)와 WordPress media ID가 모두 준비돼야 가능하며, media
ID는 이 카드 안에서 (A) 직접 입력하거나 (B) 내 컴퓨터의 이미지
파일을 선택해 WordPress Media Library에 업로드해 준비한다(article
원본 기준 featured image 준비 흐름과는 구분된다). media ID를 준비하지
못했다면 사유를 선택해 "대표 이미지 없이 진행"할 수도 있다 — 이
경우 media ID 미준비는 blocker가 아니라 warning으로 취급된다.
naver_blog 카드에는 이 WordPress Media 업로드/waive 기능이 없다.

## `source_based_explainer`와의 차이

| | `monetized_blog` | `source_based_explainer` |
| --- | --- | --- |
| 목적 | 독자의 문제를 해결하는 실용 콘텐츠 (SEO/AEO/GEO로 발견성 보강) | 여러 출처를 종합한 해설 기사 |
| 핵심 산출물 | answerSummary/eeatNotes/geoSummary + AD_SLOT 구조 | thesis 중심 7기능 구조 + sourceUsage |
| 수익 요소 | AD_SLOT marker(실제 코드 아님), monetizationScore | 없음 |
| 신뢰성 프레임 | E-E-A-T(경험/전문성/권위성/신뢰성) 명시적 자가 점검 | 출처 기반 사실/해석 구분 |
| 검색 발견성 | SEO + AEO(직접 답변) + GEO(생성형 AI 검색 이해성) | 해당 없음 |

## E-E-A-T 기준

- 이 글은 수익화 목적이 있더라도 독자의 문제 해결과 신뢰성을
  최우선으로 한다.
- **존재하지 않는 경험, 후기, 전문가 자격, 조사 결과를 만들어내지
  않는다.** "직접 사용해봤다", "전문가가 검증했다", "조사 결과
  밝혀졌다" 같은 표현은 실제 근거가 있을 때만 쓴다.
- 출처에서 확인 가능한 사실과 작성자의 해석을 구분한다.
- 의료/금융/법률/안전/공공정책(YMYL) 주제에서는 단정적 조언을
  피하고, 확인이 필요한 사항과 일반적 판단 기준을 제시한다.
- 독자가 스스로 판단할 수 있도록 비교 기준, 주의점, 한계, 확인
  방법을 제공한다.

`eeatNotes`(`experience`/`expertise`/`authoritativeness`/
`trustworthiness`)는 이 기준에 대한 모델의 자가 점검 메모다. 각
항목은 **실제 근거가 있을 때만 채우고, 없으면 비워둔다** —
`parseEeatNotes()`가 빈 문자열/공백만 있는 값을 걸러내 지어낸
근거처럼 보이지 않도록 한다. DB에는 저장하지 않는다(결과 객체에만
포함).

## SEO 기준 (보조 수단)

- targetKeyword는 seoTitle/도입부/주요 heading 일부에 자연스럽게
  포함하되, secondaryKeywords와 함께 반복(keyword stuffing)하지
  않는다.
- metaDescription은 120~160자 내외.
- heading은 검색엔진보다 독자가 이해하기 쉬운 방향으로 구성한다.
- 제목은 클릭 유도력은 있되 과장·낚시·허위 기대를 만들지 않는다.

코드 레벨 보강: `assessMonetizedBlogQuality()`가 targetKeyword가
본문 1000자당 8회 넘게 등장하면 `keyword_stuffing_suspected` 경고를
남긴다(자동 삭제/수정하지 않음 — 검토 신호일 뿐).

## AEO(Answer Engine Optimization) — answerSummary와 독자 친화성의 하이브리드 구조

- `answerSummary`(2~4문장)로 독자의 핵심 질문에 직접 답한다. 결론을
  먼저 제시하고 조건/예외가 있으면 함께 표시한다.
- `answerSummary`는 title/content와 마찬가지로 **필수 필드**다 —
  없으면 `generateMonetizedBlogAiDraft()`가 즉시 오류를 던진다
  (title/content 누락 시와 동일한 검증 수준). **AEO/GEO 평가와
  내부 검증에는 이 필드를 계속 사용한다.**
- **다만 content(본문)를 answerSummary로 바로 시작하지 않는다.**
  일반 블로그 독자에게 도입부 없이 결론부터 나오는 글은 보고서식·
  AI 답변식으로 느껴질 수 있어, **본문에서는 도입부를 먼저
  배치하고, 그 직후에 answerSummary 내용을 "짧은 핵심 답변"
  섹션으로 자연스럽게 풀어서 제시**한다. 이는 독자 친화성과
  AEO/GEO 이점(직접 답변, 결론 우선 제시)을 동시에 살리는 하이브리드
  구조다.
- 도입부는 독자의 상황/문제의식에서 시작해 왜 이 주제가 중요한지
  설명하고, 이 글이 무엇을 정리할지 안내한다. 과장·클릭베이트·
  광고성 표현은 쓰지 않으며, targetKeyword는 자연스럽게 포함하되
  반복하지 않는다.
- 짧은 핵심 답변 섹션의 heading은 "## 먼저 결론부터 보면", "## 핵심만
  정리하면", "## 이 글의 핵심", "## 짧게 정리하면", "## 결론부터
  말하면"처럼 자연스러운 표현 중에서 고르며, "## 무조건 이것만
  보세요"처럼 클릭베이트가 섞인 heading은 프롬프트에서 명시적으로
  금지한다.
- 코드 레벨 안전망: `ensureCoreAnswerInContent()`가 본문에 이미
  허용된 핵심 답변류 heading(`CORE_ANSWER_HEADING_PATTERN`)이 있으면
  모델이 자연스럽게 반영한 것으로 보고 그대로 둔다. 없으면 도입부
  섹션이 끝나는 지점(도입부 heading을 못 찾으면 본문 초반 대략적인
  위치)에 기본 heading("## 핵심만 정리하면")과 answerSummary 원문으로
  fallback 섹션을 삽입한다 — **본문 전체를 answerSummary로 시작하게
  만들지 않는다.**
- answerSummary가 400자를 넘으면 `answer_summary_too_long` 경고를
  남긴다(직접 답변은 간결해야 한다는 신호).
- FAQ는 본문 내용을 보완하는 실제 질문/답변만 담고, 본문에 없는
  내용을 새로 지어 답하지 않는다.

## GEO(생성형 AI 검색 이해성) — geoSummary

- 각 섹션은 독립적으로 읽어도 의미가 통하도록 작성한다.
- 결론을 먼저 제시하고 근거·예외를 뒤에 설명한다.
- `geoSummary.keyFacts`(3~5개)는 출처에 있는 사실만, `geoSummary.
  caveats`(2~4개)는 주의점/한계/예외를 담는다.
- **"AI Overview에 노출", "검색 1위 보장", "AI가 반드시 인용" 같은
  검색/AI 노출 보장 표현은 절대 사용하지 않는다** — 프롬프트의
  절대 금지 목록에 명시되어 있다.
- `geoSummary`가 응답에 없거나 형식이 어긋나면 `{ directAnswer: "",
  keyFacts: [], caveats: [] }`로 안전하게 처리한다(생성 자체를
  막지 않음). DB에는 저장하지 않는다.

## structuredDataSuggestions — 후보 제안일 뿐

`Article`/`BlogPosting`/`FAQPage`/`HowTo` 중 하나만 허용하며, 그 외
값은 `parseStructuredDataSuggestions()`가 걸러낸다. **실제 schema
markup(JSON-LD)을 생성하지 않는다** — 이후 사람이 검토해 실제
적용 여부를 판단할 수 있는 "제안"일 뿐이다. DB에는 저장하지 않는다.

## AD_SLOT marker 삽입 방식 개선

기존에는 빠진 marker를 항상 본문 끝에 이어붙였다. 이제
`ensureAdSlotMarkers()`가 heading을 단서로 삼아 의미 있는 위치에
삽입한다.

| marker | anchor 키워드(heading) | 삽입 위치 |
| --- | --- | --- |
| `after_summary` | 핵심 요약/요약 박스/summary | 해당 섹션 끝 |
| `after_intro` | 도입부/들어가/서론/intro | 해당 섹션 끝 |
| `mid_content_1` | 핵심 정보/본문 내용/정보 | 해당 섹션 끝 |
| `mid_content_2` | 비교 | 해당 섹션 끝 |
| `before_faq` | FAQ/자주 묻는 | 해당 heading 직전 |
| `before_conclusion` | 결론/마무리/정리하며 | 해당 heading 직전 |

**하이브리드 구조(도입부 → 짧은 핵심 답변 → 핵심 요약 박스) 반영**:
`after_summary`의 anchor는 "핵심 답변"이 아니라 **"핵심 요약/요약
박스"**로 좁혔다 — 짧은 핵심 답변 섹션이 도입부 뒤에 먼저 오고,
핵심 요약 박스는 그 다음에 오므로, `after_summary`가 짧은 핵심 답변
바로 뒤가 아니라 핵심 요약 박스 뒤에 배치되도록 한 것이다.
`after_intro`는 도입부 섹션이 끝나는 지점(= 짧은 핵심 답변 섹션
시작 직전)에 배치되어 "도입부와 짧은 핵심 답변 사이"에 자연스럽게
들어간다.

anchor heading을 찾지 못하면 본문 내 대략적인 위치 비율(marker마다
다름, `after_intro`는 15%로 가장 이르게 잡아 도입부 직후에 가깝게
배치)에서 가장 가까운 문단 경계(빈 줄)에 삽입한다 — 6개 marker를
본문 끝에 몰아넣지 않는다. 이미 marker가 정확히 1회 존재하면 그대로
두고, 2회 이상 중복되어 있으면 첫 번째만 남기고 나머지는
제거한다(`dedupeMarkerOccurrences()`) — **각 marker는 항상 최대
1회만 등장**한다.

## 실제 광고 코드 방지 (2중 방어)

1. **프롬프트**: "실제 AdSense 스크립트나 광고 코드를 절대 작성하지
   마세요", "광고 위치는 반드시 HTML 주석 marker만 사용하세요"를
   명시.
2. **코드**: `stripDisallowedAdCode()`가 `<script>...</script>`,
   `<iframe>...</iframe>`, `adsbygoogle`, `googlesyndication`,
   `data-ad-client`, `data-ad-slot` 패턴을 생성 직후 제거한다 —
   프롬프트만으로 100% 보장되지 않는 부분에 대한 마지막 방어선이다.

## monetizationScore / policyRiskScore

- `monetizationScore`(0~100)는 기존과 동일하게 검색 수요, 문제
  해결성, 비교/구매 의도, 콘텐츠 확장성, 광고 적합성, 장기 검색
  가능성, 경쟁 강도, 정책 위험도를 종합한다. **높은 점수가 과장
  표현이나 허위 수익 약속을 써도 된다는 의미가 아니라는 문구를
  프롬프트에 명시**했다.
- `policyRiskScore`(0~100, 높을수록 위험)에 위험 요소를 추가했다:
  허위 E-E-A-T 표현, YMYL 단정 조언, AI 검색 노출 보장 표현, 본문과
  불일치하는 FAQ, 키워드 반복, 실제 광고 코드.
- 코드가 `policyRiskScore >= 70`이면 `qualityWarnings`에
  `policy_risk_high`를 남긴다. **자동으로 차단/수정하지 않으며,
  최종 게시 여부는 항상 사람이 판단한다.**

## qualityWarnings — 검토 신호(차단 아님)

`assessMonetizedBlogQuality()`가 생성 직후 계산하는 경량 후처리
점검이다. 어떤 항목도 자동으로 콘텐츠를 수정하거나 생성 자체를
막지 않는다.

| code | 의미 |
| --- | --- |
| `answer_summary_too_long` | answerSummary가 400자 초과 |
| `policy_risk_high` | policyRiskScore가 70 이상 |
| `keyword_stuffing_suspected` | targetKeyword가 본문 1000자당 8회 초과 등장 |
| `ad_slot_marker_count_invalid` | 특정 AD_SLOT marker가 1회가 아니게 등장(정상 흐름에서는 발생하지 않아야 함) |

## eval 기준 — `evals/monetized-blog.eval.yaml`

기존 10개 기준(검색 의도 적합성, 클릭 가능성, 과장/허위 여부,
체류시간 구조, 요약 박스, 비교표/체크리스트, FAQ 품질, 내부 링크,
광고 슬롯 위치, AdSense 정책 위험도)은 그대로 유지했다. 아래 5개를
추가했다:

| 기준 | 가중치 | 성격 |
| --- | --- | --- |
| `eeat-trustworthiness` | 0.12 | 가중 평균 + gate (3점 미만이면 `passed=false`) |
| `answer-summary-quality` | 0.06 | 가중 평균만 |
| `geo-clarity` | 0.05 | 가중 평균만 |
| `keyword-naturalness` | 0.05 | 가중 평균만 |
| `ymyl-risk` | 0.10 | 가중 평균 + gate (4점 이상이면 `passed=false`, adsense-policy-risk와 같은 패턴) |

`lib/ai/eval-article.ts`의 `EvalConfig.scoring`에
`eeat_trustworthiness_min_threshold`(미만이면 실패, 기존 risk-gate와
방향이 반대)와 `ymyl_risk_fail_threshold`(이상이면 실패, 기존
`policy_risk_fail_threshold`와 같은 방향)를 추가하고,
`applyGateConditions()`가 이 두 값을 함께 확인한다. 이 evaluator는
`monetized_blog` 전용이 아니라 **모든 모드가 공유하는 generic
evaluator**이므로, `general_news`/`source_based_explainer`의 yaml에는
이 필드가 없어 영향받지 않는다.

## 이번 개선에서 하지 않은 것

- `source_based_explainer`, `general_news` 모드와 그 프롬프트는
  변경하지 않았다.
- social-writing 프롬프트(`prompts/social/*.md`)는 변경하지 않았다.
- DB 스키마는 변경하지 않았다 — `answerSummary`, `eeatNotes`,
  `readerQuestions`, `geoSummary`, `structuredDataSuggestions`,
  `qualityWarnings`는 모두 `GeneratedArticle` 결과 객체에만
  존재하며, 저장 로직(`saveDraftArticle`)은 그대로다.
- 실제 AdSense 코드/스크립트는 생성하지 않으며, 생성돼도 코드가
  제거한다.
- `article.contract.yaml`에 새 규칙을 추가하지 않았다 — sourceUsage/
  structuredDataSuggestions처럼 형식 유효성은 이미 코드 레벨
  파싱에서 보장되고, keyword stuffing/FAQ 일치성처럼 의미적인
  판단이 필요한 항목은 eval 기준(`keyword-naturalness` 등)과
  qualityWarnings로 다뤘다(중복 방지).

## 관련 문서

- 운영 매뉴얼: [`phase-3-operation-manual.md`](./phase-3-operation-manual.md)
- `source_based_explainer` 개선: [`article-generation-source-based-explainer.md`](./article-generation-source-based-explainer.md)
- 프롬프트 요약: [`../prompts/articles/monetized-blog.md`](../prompts/articles/monetized-blog.md)
