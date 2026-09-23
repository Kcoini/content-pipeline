# OPS-04 기준선 검증 Summary

- 작성일: 2026-09-23
- **표본: 실제 콘텐츠 2건(article), 플랫폼 6개(social post) 처리**
  (wordpress_blog, naver_blog, naver_cafe, x, threads, instagram —
  OPS-03이 다루지 않았던 naver_blog를 새로 포함해 플랫폼 다양성을
  넓혔다). 최대 8건 한도 내에서 "패턴이 명확해지면 조기 종료 가능"
  (Phase 지시서 섹션 2)에 따라 2건에서 종료했다 — 아래 상세히 설명할
  **중요한 신규 Miss를 발견**했고, 이는 표본을 더 늘리기보다 원인
  규명이 우선인 신호로 판단했다.
- 상세 event/metric: `docs/ops/ops-04-operation-log.md`.

## OPS-03 대비 비교

| 지표 | OPS-03 | OPS-04 | 비고 |
|---|---|---|---|
| 콘텐츠 처리 건수 | article 2건, social post 5건 | article 2건, social post 6건 | OPS-04는 naver_blog 신규 포함 |
| Generation success rate | 100%(5/5) | **100%(6/6)** | 유지 |
| First-pass quality-ready rate | 100%(5/5) | **100%(6/6)** | 유지 |
| Human-confirmation rate | 80%(4/5) | **66.7%(4/6)** | threads/instagram이 완전 clean, 유사 수준 유지 |
| Manual-edit rate | 0%(0/5) | **0%(0/6)** | 유지 |
| Retry rate | 0%(0/5) | **0%(0/6)** | 유지 |
| Structured-output failure rate | 0%(0/5) | **0%(0/6)** | 유지 |
| WordPress Draft success rate | 100%(1/1) | **100%(1/1)** | `?p=73` 신규 생성, 유지 |
| Fact-grounding issue count(rendered) | 19건 | **15건**(8+4+2+1) | 표본 상이해 단순 비교는 제한적 |
| Fact-grounding TP | 2건 | **0건** | 이번 표본에는 없음(아래 Miss 참고 — TP와 별개 문제 발견) |
| Fact-grounding **신규 Miss** | 0건 | **1건(신규 발견, 중요)** | "2019년 SBS스페셜" 허위 방송 귀속 — 아래 상세 |
| Input tokens(social 생성) | 50,484 | **61,025** | |
| Output tokens(social 생성) | 13,761 | **17,407** | |
| 가격 계산 | 불가(costUnavailable) | 불가(costUnavailable) | `PRICING_TABLE` 여전히 비어 있음(의도적) — 0원으로 대체 안 함 |
| Stalled job / operational failure | 0건 | 0건 | 유지 |

> Input/output tokens는 `npm run ops:report-usage`로 article별 집계를
> 교차 검증했다(article `30f14581-...`: input 21,323/output 10,758,
> article `01939c44-...`: input 39,702/output 6,649 — pipeline_logs
> 실시간 로그 합산과 정확히 일치). 이 집계는 social 생성 이벤트만
> 포함하며, article 생성/평가/출처 요약 토큰은 섹션 15에서 설명하는
> 기존 계측 공백으로 여전히 빠져 있다(교체하지 않고 그대로 유지).

## Fact-grounding FP 세부 분류(섹션 4 요구사항)

| 분류 | 건수(claim 단위) | 설명 |
|---|---|---|
| FP-A(출처에 실제 근거 있음) | 6개 claim | 습도, 1.5배, 24시간(A) + 1915/1960, 5:2, 2.5~9.9%, 2025년 리뷰(B) — evidenceText가 verifiedFacts 요약으로 좁혀져 있어 놓쳤을 뿐, 실제 rawContent에는 숫자가 존재 |
| FP-B(일반 상식/널리 알려진 표준) | 1개 claim | HEPA 0.3μm/99.97% — 출처엔 없지만 국제 표준으로 널리 알려진 값 |
| FP-C(같은 claim 반복 카운트) | 해당 없음(이번 표본은 서로 다른 표현이라 정확한 문자열 중복은 없었음) | — |
| FP-D(표현 차이로 인한 매칭 실패) | 미확인 | 이번 표본에서 명확한 사례 없음 |
| FP-E(신규 — 문장 분리 아티팩트) | 1개 claim | naver_cafe의 번호 목록("3.", "5.")이 문장 분리 정규식에 의해 별도 "문장"으로 잘못 추출됨 |
| TP | 0건 | 이번 표본 없음 |

## [OPS-04-FIX1 업데이트, 2026-09-23] High 상태: Open → Resolved(정정 포함)

OPS-04-FIX1에서 `SourceEvidenceIntegrityValidator`(실제 rawContent
대조)로 이 사례를 다시 검증한 결과, **아래 "2019년 SBS스페셜" 사례는
실제로는 허위(fabrication)가 아니었다** — OPS-04 당시 사람이 3개 출처
중 영문 위키백과 1개만 확인하고 한국어 위키백과("간헐적_단식")를
확인하지 않은 investigation 실수였다. 한국어 위키백과 원문에 해당
내용이 실제로 있었다. 상세 정정 내용과 근거는
`docs/ops/ops-04-fix1-source-evidence-integrity.md` 섹션 0 참고.

이 정정에도 불구하고 근본 문제(evidenceText/verifiedFacts 자체가
raw source와 대조되지 않는 trust boundary 공백)는 실재했고, 실제
OPS-03 데이터 재검증에서 **진짜 TP(AASM)와 새로운 unsupported
사례(CBT)를 자동으로 확인**했다 — 상세는 위 문서 섹션 12 참고.

**결론: High → Resolved.** `SourceEvidenceIntegrityValidator`를
source-summarizer.ts(article 생성 입력)와 master-manuscript-builder.ts
(verifiedFacts)에 연결해, raw source로 뒷받침되지 않는 candidate
fact가 더 이상 `verifiedFacts`로 승격되지 않도록 막았다(회귀 테스트
포함, 전체 lint/test/build/e2e/preflight green).

## 신규 Miss(가장 중요한 발견) — 요약(OPS-04 당시 원문, 위 정정 참고)

**"2019년 SBS스페셜에서 소개된 라이언 스미스·킴스미스 부부가 TRF
방식으로 총 41kg을 감량한 사례"** 문장이 마스터 원고 본문 +
naver_cafe/x/instagram 3개 social post에 동일하게 등장했으나, 실제
영문 위키백과 Intermittent fasting 원문에는 "SBS"라는 문자열이 전혀
없다(체중 숫자 "41"과 인명 "Smith"는 다른 맥락으로 원문에 존재).

- **발생 단계**: `verifiedFacts`(=`source.keyPoints`)에 이미 포함 —
  출처 요약 단계(`generateSourceSummaryWithAi`)에서 생성된 것으로
  보이며, article 생성과 5개 social 생성 전체에 전파됨.
- **왜 기존 validator가 못 잡았나**: `findUngroundedClaims`은
  게시용 본문을 `evidenceText`와 대조하는데, 이번 건은 오염된
  `evidenceText` 자체에 이미 같은 허위 사실이 들어 있어 "근거
  있음"으로 오판됨 — **evidenceText 생성 단계(출처 요약) 자체를
  검증하는 장치가 없다**는 구조적 공백을 드러낸다.
- **위험도**: 체중 감량 수치 자체는 실제 출처 기반으로 보이며,
  건강/금전적으로 위험한 조작은 아니다. 다만 존재하지 않는 방송
  프로그램·연도를 구체적으로 지어낸 것은 "출처 기반 콘텐츠"라는
  신뢰를 훼손하는 명백한 Miss다.
- **분류**: High(Blocker 아님 — 공개 게시/위험한 외부 side effect로
  이어지지 않음, Draft/manual copy 이전 단계에서 발견).
- **조치**: 코드 수정은 이번 Phase 범위에서 수행하지 않았다(섹션 7 —
  1회 발견이며, 정확한 수정 방법(출처 요약 자체를 rawContent와
  대조하는 새 검증 단계 추가)이 이번 Phase에서 설계/검증되지
  않았으므로). **백로그로 등록**하고 아래 섹션 22에서 권고안만
  제시한다.

## Fact-grounding 개선 방향 결정(섹션 22 — 4개 중 하나 선택)

**선택: D — 검증기 강화**(신규 Miss가 발생했으므로)

- A(현행 유지)를 선택하지 않은 이유: Miss가 0건이 아니게 되었다(신규
  발견).
- B(중복 제거만)를 선택하지 않은 이유: 이번 문제는 판단이 맞는데
  중복 표시되는 문제가 아니라, 애초에 근거 자체가 오염된 문제다.
- C(evidence 매칭 개선)를 선택하지 않은 이유: 매칭 로직(문자열 대조)
  자체는 정상 작동했다 — 문제는 대조 대상(`evidenceText`)이 이미
  틀렸다는 것.
- **D를 선택한 이유**: 근본 원인이 "게시용 본문이 evidenceText와
  다르다"가 아니라 "evidenceText 자체가 출처 원문과 다르다"이므로,
  검증 지점을 하나 더 추가해야 한다 — **출처 요약(keyPoints) 생성
  직후, keyPoints의 각 fact가 실제 `source.rawContent`에 있는지
  대조하는 새로운 검증 단계**가 필요하다. 이번 Phase에서는 설계만
  제안하고 구현하지 않는다(섹션 7 — 1회 발견, 안전한 수정 여부와
  회귀 픽스처 작성 가능 여부를 다음 Phase에서 판단 필요).

## Formal 확장 후보 여부 평가(섹션 23)

| 기준 | 상태 |
|---|---|
| Blocker 0 | ✅ 0건 |
| High 0 | ❌ **1건**(신규 Miss — 위 상세 참고) |
| 위험한 side effect 0 | ✅ 0건(공개 게시 없음, WordPress Draft만) |
| 데이터 손실 0 | ✅ 0건 |
| 심각한 fact-grounding Miss 0 | ⚠️ 판단 보류 — 이번 Miss는 "심각"보다는 "신뢰 훼손형"으로 분류했으나, 0건은 아님 |
| generation/structured-output/WordPress Draft 안정 | ✅ 전부 100%, retry 0 |
| retry/manual-edit 부담 낮음 | ✅ 둘 다 0% |
| 사람 확인 부담이 운영 가능한 수준 | ✅ 66.7%(4/6), OPS-03과 유사 |

**결론: 현재는 정식 확장 후보로 판단하지 않는다.** 운영 안정성
지표(생성/구조화 출력/WordPress Draft/재시도)는 OPS-03 수준을
그대로 유지했지만, 이번에 발견한 신규 Miss(High)는 아직 원인
규명·백로그 등록 단계에 머물러 있다. **다음 단계는 표본을 더
늘리는 것이 아니라, 위 D안(출처 요약 검증 단계 추가)을 설계하고
회귀 픽스처로 재현한 뒤 다시 검증하는 것**을 권고한다.

## 해석 주의

표본이 article 2건/social post 6건 수준이므로, 위 비율을 통계적
보장으로 해석하지 않는다. 이번 결과가 보여주는 것은:

1. 생성/구조화 출력/WordPress Draft 파이프라인은 OPS-03과 동일하게
   안정적이었다(재시도 0, 실행 실패 0).
2. fact-grounding validator는 **게시용 본문과 evidenceText 간
   불일치**는 잘 잡아내지만(OPS-03에서 실증), **evidenceText
   자체가 오염된 경우**는 원천적으로 잡을 수 없다는 구조적
   한계를 이번에 실제 데이터로 처음 확인했다 — OPS-02A/OPS-03이
   다루지 않았던 새로운 유형의 위험이다.
3. 새로운 Blocker는 발견되지 않았고, 위험한 외부 side effect도
   없었다(전부 Draft/manual copy 이전 단계에서 발견·검토됨).
