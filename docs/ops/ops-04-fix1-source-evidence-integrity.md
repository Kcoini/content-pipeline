# OPS-04-FIX1: Source Evidence Integrity

- 작성일: 2026-09-23
- 목적: OPS-04에서 지목된 High("2019년 SBS스페셜" 허위 방송 귀속으로 보였던
  사례)를 계기로, "AI가 생성한 source summary(keyPoints)/verifiedFacts
  자체가 raw source content로 실제 뒷받침되는지"를 검증하는 새로운 신뢰
  경계(trust boundary)를 파이프라인에 추가했다.

## 0. 중요한 사전 정정(투명하게 기록)

이번 Phase를 진행하며 실제로 재확인한 결과, **OPS-04에서 "신규 Miss"로
보고했던 "2019년 SBS스페셜" 사례는 실제로는 허위(fabrication)가
아니었다.** 원인은 OPS-04 당시 사람이 수동으로 진행한 출처 대조가
영문 위키백과("Intermittent fasting") **하나만** 확인하고, 같은
article이 실제로 인용한 3개 출처 중 하나인 **한국어 위키백과
("간헐적_단식")를 확인하지 않은 investigation 실수**였다. 이번 Phase에서
만든 `SourceEvidenceIntegrityValidator`로 3개 출처 전체를 기계적으로
다시 대조한 결과, 한국어 위키백과 원문에 "2019년 2월 4일 SBS스페셜
끼니반란에서 총 41kg 정도를 감량하는데 성공한 라이언 스미스 킴스미스"
라는 문장이 실제로 있었다(`evidenceExcerpt`로 직접 확인).

이 정정이 이번 Phase의 필요성을 없애지는 않는다 — 오히려 반대다:

1. 사람의 수동 검토가 "출처 중 일부만 확인하고 결론 내리는" 실수를
   저지를 수 있음을 실제로 보여줬다 — 자동화된, 전체 출처를 빠짐없이
   대조하는 도구가 왜 필요한지의 근거가 됐다.
2. 이번에 만든 validator를 실제 OPS-01~04 콘텐츠 7건에 read-only로
   재적용한 결과, OPS-03에서 사람이 직접 확인했던 **진짜 True
   Positive("미국수면의학회(AASM)는 2021년 메타분석을 통해...")를
   정확히 재현·재확인**했고, 추가로 새로운 unsupported 사례
   ("인지행동치료(CBT)가 불면증의 가장 근본적인 치료법으로 권고된다" —
   3개 출처 어디에도 "CBT"라는 표현이 없음)를 찾아냈다. 상세는 섹션
   12 참고.

## 1. 최초 오염 지점(코드 추적 결과)

실제 파이프라인을 추적한 결과:

```
raw source fetch → sources.raw_content 저장
  → generateSourceSummaryWithAi() [lib/ai/source-auto-summarizer.ts]
    (AI가 raw_content를 읽고 summary/key_points/entities를 추출)
  → updateSourceSummary() → sources.key_points 저장
  → (여기까지는 그대로 유지 — candidate fact, 이름은 안 바꿈)
  → source-summarizer.ts의 summarizeSourcesWithAi/Mock()
    (source.key_points를 그대로 SourceSummary.keyPoints로 노출
     → article-writer.ts가 마스터 원고 본문 생성 프롬프트에 그대로 사용)
  → master-manuscript-builder.ts의 buildVerifiedFacts()
    (source.key_points를 그대로 MasterManuscriptVerifiedFact로 승격
     → evidenceMap/platformBriefs/longFormSupport/optimizationSupport
       전체로 전파 → 5개 platform post 생성 프롬프트에 "확인된 사실"로 전달)
```

**최초 오염(정확히는 "검증 없이 신뢰"가 시작되는) 지점은
`generateSourceSummaryWithAi()`가 만든 `key_points`가 `sources.key_points`
DB 컬럼에 저장되는 순간이다.** 이 시점부터 `key_points`는 어디서도
`raw_content`와 다시 대조되지 않은 채 "이미 확인된 사실"처럼 취급되어
마스터 원고 본문과 5개 social post 전체로 그대로 흘러갔다.

## 2. Trust boundary 문제

기존 `fact-grounding-validator.ts`(lib/social/)는 "게시용 본문이
`evidenceText`(=`verifiedFacts`)로 뒷받침되는가"만 검사한다.
`evidenceText` 자체가 오염돼 있으면(예: keyPoints에 이미 허위 귀속이
있으면) 이 검사는 "근거가 있다"고 정확히(!) 판정하며 통과시킨다 — 검사
로직 자체는 정상 작동했지만, **검사 대상(evidenceText)이 이미
신뢰할 수 없는 상태**였던 것이 진짜 문제였다.

## 3. 원칙

raw source content가 최종 evidence source of truth다. AI가 만든
summary/keyPoints/verifiedFacts/evidenceMap 설명 자체를 증거로
간주하지 않는다 — 항상 raw source와 다시 대조한다.

```
Generated fact → raw source evidence 확인 → 확인된 경우에만 verified
```

raw source에서 지원 근거를 찾지 못하면 `verifiedFact`로 취급하지
않는다 — `needs_review`/`verificationNeeded`로 이동할 뿐, AI가 내용을
다시 써서 "수정"하거나 다른 출처를 몰래 찾아 보완하지 않는다.

## 4. SourceEvidenceIntegrityValidator 구현

**위치**: `lib/sources/source-evidence-integrity-validator.ts`(신규).

새로운 사실 데이터베이스를 만들지 않았다 — 기존 `sourceId`/`rawContent`/
`verifiedFacts`/`evidenceMap` 구조만 재사용한다. 새 AI 호출/semantic
matcher도 추가하지 않았다 — 전부 결정적(deterministic) 문자열/정규식
대조다(섹션 7의 "새 AI 시스템으로 대체 금지" 원칙 준수).

### 핵심 함수

- `checkFactAgainstSource(fact, rawContent)`: fact 하나가 rawContent
  하나로 뒷받침되는지 판정한다. `{ status, reason, evidenceExcerpt? }`를
  반환한다.
- `evaluateSourceKeyPoints(sources)`: 여러 출처의 keyPoints를 "같은
  문장이 몇 개 출처에 등장하는지"로 그룹핑하고(기존 `buildVerifiedFacts`
  와 동일한 그룹핑 규칙), 각 그룹에 연결된 sourceIds의 rawContent와
  전부 대조해 최선의 판정을 고른다(하나라도 뒷받침하면 supported).
- `filterSupportedKeyPoints(source)`: 출처 1개의 keyPoints 중
  supported만 남긴다(article 생성 프롬프트 입력용).

### 판정 모델(섹션 5)

| status | 의미 |
|---|---|
| `supported` | raw source에서 직접 근거(숫자/귀속 기관명/충분한 단어 일치) 확인 |
| `needs_review` | 관련 내용은 있으나 완전한 지원을 자동으로 확신하기 어려움 |
| `unsupported` | claim의 핵심 요소(숫자 전부, 또는 같은 언어권의 기관/방송 귀속)가 raw source에 없음 |
| `conflicting` | (타입만 정의 — 기존 `detectConflictingVerifiedFacts`가 이미 다루는 영역, 이번 Phase에서 새로 통합하지 않음. "알려진 한계" 참고) |

### rawContent 대조 방식(섹션 6/9/10)

- **숫자/연도/비율**(섹션 9): `\d[\d,]*(\.\d+)?` 패턴으로 추출 후
  콤마만 제거해 정규화(`1,000` ≡ `1000`)하고 rawContent에 포함되는지
  확인한다. 단위(kg, %, 명 등)는 무시한다 — 임의로 단위를 환산하지
  않는다(섹션 9 명시 요구사항).
- **기관/방송/매체 귀속**(섹션 8/10): trigger 문구("~에 따르면" 등)
  직전 단어만 보는 방식은 한국어 어순이 자유로워(주어가 동사에서 멀리
  떨어질 수 있음) 신뢰할 수 없었다 — 대신 문장 전체에서 기관/방송
  접미사 패턴(연구소/연구원/학회/대학교/협회/스페셜/방송/뉴스 등)과
  영문 대문자 약어(SBS, USC, WHO 등)를 스캔해 entity 후보로 뽑고,
  그 entity 문자열이 rawContent에 실제로 있는지 확인한다.
- **evidence span**(섹션 6): supported로 판정되면 `evidenceExcerpt`에
  rawContent에서 실제로 잘라낸 문자열(앞뒤 30자)을 담는다 — AI가 새로
  지어낸 문장이 아니라 실제 원문 일부다.

### 다국어 처리(섹션 7)

raw source가 로마자 위주(영문 출처)이고 fact가 한글을 포함하면
"번역 출처"로 판단해, 기관/방송 귀속이 literal하게 매칭되지 않아도
즉시 `unsupported`로 확정하지 않고 `needs_review`로 완화한다(번역되면
기관명 표기가 달라질 수 있어 과도한 차단을 피하기 위함 — 섹션 24/25).
숫자는 언어와 무관하게 항상 엄격히 대조한다(숫자는 번역돼도 바뀌지
않는다).

## 5. 파이프라인 연결(섹션 11 — 가능한 한 upstream에서 차단)

`generateSourceSummaryWithAi()`(AI 응답 파싱 자체) 코드는 건드리지
않았다 — 기존 단위 테스트(순수 AI 응답 파싱 검증)와 충돌하지 않게,
그리고 **"검증 전 AI 추출 결과는 candidate fact로 취급한다"(섹션 12)**
는 원칙대로 `sources.key_points` DB 컬럼 자체는 그대로 candidate
fact 저장소로 남겨뒀다(이름도 바꾸지 않았다 — 스키마/타입 변경 위험을
피하기 위해). 대신 **candidate fact가 소비되는 두 지점**에 검증을
넣었다:

1. **`lib/ai/source-summarizer.ts`**(`summarizeSourcesWithAi`/`Mock`) —
   article 생성 프롬프트(`article-writer.ts`)의 유일한 입력 경로다.
   여기서 `filterSupportedKeyPoints()`로 걸러 supported만 넘긴다 —
   마스터 원고 본문 자체에 오염된 fact가 들어가는 것을 막는다(실제
   OPS-04 사례처럼 마스터 원고 본문에까지 들어갔던 경로를 정확히
   차단).
2. **`lib/articles/master-manuscript-builder.ts`**(`buildVerifiedFacts`)
   — `evaluateSourceKeyPoints()`로 전부 재판정한 뒤, `supported`만
   `verifiedFacts`로 승격한다. `needs_review`/`unsupported`는
   `verifiedFacts`에 포함하지 않고 `verificationNeeded`(기존 필드,
   사람이 읽는 안내 문장으로만)로만 안내한다. `rejectedFacts`(신규,
   선택 필드)에 감사용으로 기록한다.

`verifiedFacts`가 `evidenceMap`/`platformBriefs`/`longFormSupport`/
`optimizationSupport` 전체의 유일한 원천이므로, 이 한 지점만 고쳐도
5개 platform post 생성 프롬프트 전체에 자동으로 전파된다(섹션 15 —
downstream cascade 방지, 별도 코드 수정 없이 자동으로 해결됨).

## 6. verifiedFacts 의미 변화(섹션 12)

이름은 바꾸지 않았다. 대신 의미가 강화됐다: **`verifiedFacts`에
포함된 항목은 이제 항상 source integrity check를 통과한 것만
남는다**(`MasterManuscriptVerifiedFact.integrityStatus`가 항상
`"supported"`). 통과하지 못한 candidate fact는 `verifiedFacts`가
아니라 `verificationNeeded`/`rejectedFacts`로만 노출된다.

## 7. downstream 기존 validator와 역할 분리(섹션 16)

```
Layer 1 (신규) — lib/sources/source-evidence-integrity-validator.ts
  raw source ↔ source-derived facts(keyPoints/verifiedFacts) integrity
  → upstream hallucination(source summary 단계 오염)을 막는다

Layer 2 (기존, 유지) — lib/social/fact-grounding-validator.ts
  verifiedFacts/evidenceMap ↔ master manuscript/platform post claims
  → downstream hallucination(플랫폼 글 생성 단계에서 새로 지어내는 것)을 막는다
```

기존 `fact-grounding-validator.ts`는 제거하지 않았고 동작도 바꾸지
않았다(단, 섹션 21의 FP-E 문장 분리 버그는 작은 별도 수정으로 함께
고쳤다 — 아래 섹션 11 참고).

## 8. unsupported/needs_review 처리(섹션 13/14)

허용된 조치만 사용했다:

- `verifiedFacts`에서 제외
- `verificationNeeded`로 이동(사람이 읽는 안내 문장 — "사실로
  사용하지 마세요"/"사람이 직접 원문과 대조해 주세요")
- `rejectedFacts`(감사용 기록)

금지된 조치는 사용하지 않았다:

- AI가 다시 써서 "수정"
- 다른 source를 임의 검색해 자동 보완
- 가장 비슷한 사실로 대체
- confidence만 낮추고 verified 상태 유지(섹션 18 — confidence는
  integrity 검증의 대체재가 아니다. 실제로 `checkFactAgainstSource`는
  confidence 계산과 완전히 독립적으로 실행되고, confidence 계산보다
  먼저 실행되어 confidence 값과 무관하게 항상 적용된다)

## 9. 기존 저장 데이터(섹션 19)

이미 DB에 저장된 과거 `verifiedFacts`(articles.format_metadata의 캐시)
를 이번 Phase에서 자동으로 다시 쓰지 않았다 — migration 없음.
`master-manuscript-builder.ts`의 `buildMasterManuscript()`는 원래도
"항상 다시 계산하는 순수 함수"였으므로(파일 최상단 주석 참고), 다음에
이 함수가 다시 호출되는 시점(예: 새 social post 생성, 재검토)부터
자연스럽게 새 검증이 적용된다. OPS-01~04의 기존 DB 데이터는 그대로
회귀 자료로 유지했다.

## 10. 과거 데이터 재검증 helper(섹션 20)

**위치**: `scripts/ops/audit-source-evidence.ts`(신규),
`npm run ops:audit-source-evidence`로 실행.

```
AUDIT_ARTICLE_ID=<article-id> npm run ops:audit-source-evidence
```

읽기 전용(DB mutation 없음). article의 실제 출처를 읽어
`evaluateSourceKeyPoints()`로 재판정하고, **개수와 판정 이유만**
출력한다(full raw source/본문은 출력하지 않는다).

## 11. FP-E(목록 번호) 버그(섹션 21)

OPS-04에서 발견된 naver_cafe "3.", "5." 오탐은 원인이 명확하고
(문장 분리 정규식이 "숫자+마침표" 목록 번호를 문장 끝으로 오인),
수정이 1줄이며, 회귀 fixture 작성이 쉬워 이번 Phase에서 함께
고쳤다(`lib/social/fact-grounding-validator.ts`의 `splitSentences`에
negative lookbehind `(?<![0-9]\.)` 추가). Source Evidence Integrity
수정과는 완전히 별개 파일/버그다 — 범위를 키우지 않고 최소 수정만
했다.

## 12. 실제 OPS-01~04 데이터 재검증 결과(read-only, DB 변경 없음)

`npm run ops:audit-source-evidence`로 실제 article 7건(OPS-01/02A/03/04
전체)을 재검증한 요약:

| article | candidate facts | supported | needs_review | unsupported |
|---|---|---|---|---|
| 실내 공기질(OPS-04 A) | 14 | 14 | 0 | 0 |
| 수면 위생(OPS-03 Piece 1) | 21 | 13 | 7 | **1**(AASM — 실제 TP 재확인) |
| 홈트레이닝(OPS-03 Piece 2) | 5 | 2 | 3 | 0 |
| 카페인(OPS-01) | 21 | 17 | 4 | 0 |
| 기준금리(OPS-01) | 13 | 10 | 3 | 0 |
| 전기차 배터리(OPS-01) | 14 | 13 | 1 | 0 |
| 간헐적 단식(OPS-04 B) | 12 | 10 | 2 | 0 |

**핵심 결과**: OPS-03에서 사람이 직접 읽고 확인했던 진짜 TP
("미국수면의학회(AASM)는 2021년 메타분석을 통해 수면 위생을 만성
불면증의 단독 치료법으로 권장하지 않는다고 결론지었다" — 3개 출처
어디에도 없는 기관+연도+결론)를 validator가 **자동으로 정확히
재확인**했다. 같은 article에서 추가로 "인지행동치료(CBT)가 불면증의
가장 근본적인 치료법으로 권고된다"도 unsupported로 새로 잡혔다(CBT라는
약어가 3개 출처 어디에도 없음 — 일반적으로 잘 알려진 치료법이지만 이
3개 출처 기준으로는 근거 없음, OPS-03의 HEPA 사례와 같은 패턴).

## 13. 알려진 한계

- `conflicting` 상태는 타입만 정의했다 — 기존 `detectConflictingVerifiedFacts`
  (서로 다른 출처 간 수치 충돌 탐지)를 이번 validator에 새로 통합하지
  않았다(범위 확대 방지). 기존 conflicting-source 정책(사람이 판단,
  AI가 임의로 정답을 고르지 않음)은 그대로 유지된다.
- 다국어 entity 매칭은 "로마자 출처+한글 fact"일 때만 완화 규칙을
  적용한다 — 그 외 언어 조합(예: 일본어 출처)은 다루지 않는다.
- entity 추출은 접미사 패턴 기반이라 패턴에 없는 기관 유형(예: 특이한
  신조어 기관명)은 놓칠 수 있다 — 완벽한 개체명 인식(NER)이 아니다.
- `needs_review`가 상당히 많이 발생한다(숫자/귀속 표현이 없는 일반
  서술문은 대부분 이 상태로 간다) — 이는 "과도한 차단 방지"(섹션 24)
  를 우선한 의도적 설계이지만, 결과적으로 `verificationNeeded`
  목록이 길어질 수 있다.
