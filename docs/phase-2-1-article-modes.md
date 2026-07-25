# Phase 2-1: 수익형 콘텐츠 글쓰기 모드 3종

## 목적

기존 콘텐츠 파이프라인(테마 → 출처 → 계약 검사 → 기사 초안 생성 → AI Evals →
사용자 승인)에 `article_mode`를 추가해, 글의 목적에 맞는 3가지 형식으로 초안을
생성할 수 있게 한다. 기존 흐름(출처 기반 설명형)은 그대로 유지되며,
`article_mode`를 지정하지 않으면 이전과 동일하게 동작한다.

## 3가지 article_mode

### 1. general_news — 일반 기사형
빠른 이슈 전달용 기사 형식. 리드문 → 핵심 내용 → 배경 → 관련 자료/반응 →
향후 전망 → 참고 출처 구조를 따르며, 출처 기반 설명형보다 짧고 간결하다.
객관적 서술을 유지하고 과장된 표현이나 클릭베이트성 제목을 금지한다.

### 2. source_based_explainer — 출처 기반 설명형 (기본값)
자료와 출처를 바탕으로 정확하게 설명하는 글. Phase 1-11까지의 기존 기사 생성
로직(`ARTICLE_SYSTEM_PROMPT`/`ARTICLE_TOOL`, `evals/article-quality.v1.eval.yaml`)을
그대로 사용한다. 신뢰성과 전문성을 우선하며, 수익화보다 정확성을 우선한다.

### 3. monetized_blog — 수익형 블로그형
검색 유입, 체류시간, 광고 배치, 내부 링크 전환을 고려한 SEO 블로그 형식.
SEO 제목 → 메타 설명 → 도입부 → 핵심 요약 박스 → 목차 → 문제 설명 → 핵심 정보 →
비교표 → 체크리스트 → 주의점 → FAQ → 결론 → 관련 글 추천 → 광고 슬롯 marker →
참고자료 구조를 따른다.

## 각 모드별 글 구조 요약

| 모드 | 구조 | 길이 | SEO 메타데이터 | 광고 슬롯 |
|---|---|---|---|---|
| general_news | 7개 섹션 (리드문~참고 출처) | short_to_medium | 불필요 | 불필요 |
| source_based_explainer | 8개 섹션 (제목~참고자료) | medium | 선택 | 불필요 |
| monetized_blog | 15개 섹션 (SEO 제목~참고자료) | medium_to_long | 필수 | 필수 |

상세 프롬프트는 `prompts/articles/{general-news,source-based-explainer,monetized-blog}.md`에
정의되어 있다.

## 구현 위치

- `lib/articles/article-modes.ts` — `ArticleMode` 타입, 모드별 config, `AD_SLOT_MARKERS`
- `db/migrations/011_phase-2-1-article-modes.sql` — `articles` 테이블에 `article_mode` 등
  12개 컬럼 추가 (`alter table ... add column if not exists`, 기존 데이터 보존)
- `lib/ai/article-writer.ts` — mode별 mock/AI 생성기 (`generateMockArticleDraft`,
  `generateAiArticleDraft`에 `mode` 인자 추가, 생략 시 `source_based_explainer`)
- `lib/ai/eval-article.ts` — mode별 평가 디스패처 (`evaluateArticleForMode`).
  `source_based_explainer`는 기존 `evaluateArticleMock`/`evaluateArticleWithAi`를
  그대로 사용하고, 나머지 두 모드는 `evals/{general-news,monetized-blog}.eval.yaml`의
  `criteria`로부터 동적으로 구성한 evaluator(`evaluateArticleModeMock`/
  `evaluateArticleModeWithAi`)를 사용한다.
- `evals/general-news.eval.yaml`, `evals/monetized-blog.eval.yaml` — 신규 평가 기준
- `app/dashboard/actions.ts` — `generateArticleDraft`가 `formData`의 `articleMode`를
  읽어 생성/평가/저장 전체에 전달
- `app/dashboard/page.tsx` — 기사 생성 폼에 글쓰기 모드 라디오 선택 UI 추가
  (기본 선택: 출처 기반 설명형)
- `app/articles/[id]/page.tsx` — SEO/수익화 메타데이터 섹션 추가 (해당 필드가
  모두 없으면 섹션 자체를 숨긴다)

## 광고 슬롯 marker를 사용하는 이유

`monetized_blog` 모드는 본문에 광고 위치를 표시해야 하지만, 이번 단계에서는
실제 AdSense 연동을 구현하지 않는다. 대신 `<!-- AD_SLOT: after_summary -->`
형태의 HTML 주석 marker만 삽입한다 (`AD_SLOT_MARKERS`: `after_summary`,
`after_intro`, `mid_content_1`, `mid_content_2`, `before_faq`, `before_conclusion`).

`lib/ai/article-writer.ts`의 `ensureAdSlotMarkers()`가 AI/mock 생성 결과에
모든 marker가 실제로 포함되어 있는지 확인하고, 누락된 marker는 본문 끝에
추가해 보장한다.

## AdSense 실제 코드를 직접 삽입하지 않는 이유

- 실제 광고 스크립트/클라이언트 ID를 코드에 하드코딩하면 계정별 설정이 코드에
  결합되고, 잘못된 배치는 AdSense 정책 위반으로 이어질 수 있다.
- marker만 삽입해 두면 실제 광고 렌더링은 이후 단계(퍼블리싱 파이프라인)에서
  운영 환경별로 안전하게 주입할 수 있다.
- `article-writer.test.ts`에서 `adsbygoogle`/`googlesyndication`/`data-ad-client`/
  `data-ad-slot` 등 실제 광고 코드 패턴이 본문에 포함되지 않는지 검증한다.

## monetization_score / policy_risk_score

`monetized_blog` 생성 시 모델이 tool_use 응답에 직접 산출해 반환한다
(`monetizationScore`, `policyRiskScore`, 0~100). mock 생성기는 고정값
(50/10)을 사용한다. 두 점수 모두 `articles` 테이블에 저장되고, `/articles/[id]`
상세 화면에 표시된다.

- `monetization_score`: 검색 수요, 문제 해결성, 비교/구매 의도, 콘텐츠 확장성,
  광고 적합성, 장기 검색 가능성, 경쟁 강도, 정책 위험도를 종합한 점수.
- `policy_risk_score`: 허위/과장 수익 약속, 광고 클릭 유도 문구, 선정적 제목,
  고위험 단정, 출처 없는 주장, 복사/저작권 위험을 종합한 점수 (높을수록 위험).
  `evals/monetized-blog.eval.yaml`의 `adsense-policy-risk` 기준(gate, `policy_risk_fail_threshold: 4`)과는
  별개로, 생성 단계에서 모델이 직접 산출하는 값이다.

## review/approval을 유지하는 이유

어떤 `article_mode`로 생성되었더라도 `articles.status`는 항상 `draft`로 저장되고,
`lib/harness/approval-gate.ts`의 `assertApproved`를 통과한 사용자의 명시적 승인
없이는 `reviewed`로 전환되지 않는다. AI Evals 결과(`eval_runs`)는 항상 참고
자료로 표시될 뿐, 자동으로 기사를 차단하거나 승인하지 않는다. 이는 모드와
무관하게 Human Approval 원칙(`CLAUDE.md` 핵심 원칙 5)을 그대로 유지하기
위함이다.

## 이번 단계에서 구현하지 않은 것

- WordPress/네이버/티스토리 게시(publish) 기능
- 실제 AdSense 광고 코드 삽입
- 이미지/영상 생성, Hermes Agent
- 자동 공개 게시 기능

## 다음 단계

WordPress draft publish 구현 (`articles.status = 'published'` 흐름의 첫 단계).
`publish_logs` 테이블은 이미 스키마가 준비되어 있으며, 실제 게시 로직은
Phase 2-2 이후 구현한다.
