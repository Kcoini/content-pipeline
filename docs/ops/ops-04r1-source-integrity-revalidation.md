# OPS-04R1: Source Evidence Integrity Operational Revalidation

- 작성일: 2026-09-23
- 목적: OPS-04-FIX1에서 추가한 upstream `SourceEvidenceIntegrityValidator`
  (Layer 1)가 실제 소규모 운영에서도 (1) hallucinated/unsupported source
  fact를 막는지, (2) 정상 fact를 지나치게 제거하지 않는지, (3)
  needs_review를 과도하게 발생시키지 않는지 확인한다. 기능 개발이
  아니다 — 코드 수정 없이 관찰 결과만 취합했다(단, "관찰 먼저" 원칙에
  따라 즉시 수정 사유는 0건이었다 — 상세는 아래 섹션 참고).

## 0. 배포 상태 확인(섹션 1)

- OPS-04-FIX1 커밋(`4e8a735 Add upstream source evidence integrity
  validation`)은 `git log`/`git branch -vv` 확인 결과 로컬 `main`이
  `origin/main`과 완전히 동기화된 상태였다(`[origin/main] 4e8a735`) —
  즉 GitHub 원격 저장소에는 이미 반영되어 있었다.
- **단, Vercel 대시보드에 직접 접근할 방법이 없어 "새 deployment가
  실제로 발생했는지"는 독립적으로 확인하지 못했다** — 이 사실을
  명확히 기록한다. Vercel의 GitHub 연동이 `main` push마다 자동
  재배포하는 일반적인 설정이라면 재배포됐을 가능성이 높지만, 이번
  Phase에서는 배포 여부를 확정하지 않았다.
- anonymous production access 재확인: credential/bypass token 없이
  `curl`로 production alias에 요청 → `HTTP 302` +
  `Location: https://vercel.com/sso-api?...` (Vercel SSO redirect),
  본문은 `"Redirecting..."`만 노출 — **BLOCKED 유지 확인**.
- `npm run ops:preflight` 재실행 → 6개 항목(Supabase/Anthropic/
  WordPress Draft/Search providers/Public publish/Mock mode) 전부
  **PASS**.
- **이번 Phase의 실제 콘텐츠 생성/검증은 배포된 웹앱을 경유하지 않고,
  기존 OPS-01~04와 동일하게 로컬 controlled driver 스크립트
  (`scripts/ops-01/pilot-ops04r1-*.ts`)로 실제 Supabase/Anthropic API를
  직접 호출해 수행했다.** 배포되지 않았을 수도 있는 코드를 "production에서
  검증했다"고 기록하지 않는다 — 검증한 것은 로컬(=main HEAD) 코드
  자체의 실제 동작이다.

## 1. 사용 article/source 구성(섹션 2/3)

| article | Case | source 언어 | platform |
|---|---|---|---|
| C(국민연금) | A — 한국어 source → 한국어 content | 한국어 3건(국민연금/국민연금공단/연금 위키) | wordpress_blog(장문) |
| D(리히터 규모) | B+C — 영어 2 + 한국어 1 혼합 | 영어 2건(Richter/Moment magnitude scale 위키) + 한국어 1건(리히터_규모 위키) | naver_cafe, x |

article 2건, social post 3건 — 대량 생성 없음(계획대로 2~3건).

## 2. Upstream(Layer 1) 결과(섹션 4)

| article | candidate facts | supported | needs_review | unsupported | conflicting | rejectedFacts | verificationNeeded | 최종 verifiedFacts |
|---|---|---|---|---|---|---|---|---|
| C(국민연금) | 13 | 11 | 1 | 1 | 0 | 2 | 7 | 11 |
| D(리히터 규모) | 12 | 10 | 2 | 0 | 0 | 2 | 7 | 10 |

(verificationNeeded 7건 중 일부는 "출처 1건에서만 확인" 안내와
rejectedFacts 안내가 섞여 있다 — article당 출처가 정확히 3건이라
"출처 3건 미만" 안내 문구는 포함되지 않는다.)

## 3. 사람의 raw source 직접 대조(섹션 5) — TP/FP/Miss

### Article C(국민연금) — 한국어 source only

| 판정 | fact 요지 | 사람 확인 결과 |
|---|---|---|
| supported(표본 5건 확인) | 국민연금공단 1987년 설립, 2013년 기금 400조 돌파, 2016년 자산 포트폴리오 비율, 2013년 운용수익률 4.16%, 2025년 위탁운용사 4곳 | **전부 TP(진짜 지원됨)** — 5건 모두 국민연금공단 위키 원문에 동일 숫자가 실제로 있음을 직접 대조로 확인 |
| needs_review(1건 전부) | "연금은 정규 소득이 없을 때 개인에게 연간 소득을 제공하는 돈으로..." | 숫자/기관명이 없는 일반 정의문 — 출처(연금 위키)에 유사한 취지 내용은 있으나 문자열 일치율이 낮아 자동 확신 불가. **판정 자체는 안전(FN 아님)** — 사람이 봐도 "완전히 틀렸다"고 하기 애매한 경계 사례 |
| unsupported(1건 전부) | "연금 제도는 대한민국, 미국, 일본, 영국 등 **14개국** 이상에서 시행 중이며..." | 연금 위키 원문 대조 결과 "14"라는 숫자가 원문에 없음 — **TP**(실제로 원문에서 뒷받침되지 않는 구체적 숫자를 정확히 잡아냄) |

**Article C 핵심 관찰(downstream, 별도)**: WordPress 블로그 본문
(플랫폼 생성 단계, Layer 2 대상) 자체에 **국민연금 3개 출처에는
전혀 없는 독일/영국/프랑스/미국 4개국 연금제도 국제비교 섹션**
(각국 지급개시연령·연도·보험료율 등 구체적 수치 포함, 1873년 독일
공무원연금 도입 등)이 생성됐다. 이는 Layer 1(upstream)이 아니라
플랫폼 글 생성 프롬프트 단계에서 새로 추가된 내용이라 Layer 1
범위 밖이지만, **Layer 2(`fact-grounding-validator`)가 9건 전부를
`unsupported_number`로 정확히 flag**했다(quality gate에서
"needsCheck" 상태로 노출, blocked 아님 — Draft 자체는 공개 게시가
아니므로 안전). 사람이 직접 읽어본 결과, 각국 수치(독일 67세, 영국
68세, 프랑스 2010년 60→62세 등)는 일반적으로 알려진 실제 정책과
대체로 일치하는 것으로 보이나(예: 프랑스 2010년 연금개혁은 실제
역사적 사실) "독일 1873년 공무원연금 최초 도입"은 일반적으로
알려진 비스마르크 연금제도 시행연도(1889년)와 다르게 보여
**부정확할 가능성이 있는 Miss 후보**로 기록한다(3개 출처 어디에도
없어 검증 불가 — 그래서 Layer 2가 정확히 확인 필요로 잡았다는 점이
중요하다). **분류: Medium** — 공개 게시로 이어지지 않았고 Layer 2가
정상적으로 확인 필요 표시했으나, "출처에 없는 국제비교 섹션을
플랫폼 생성 단계에서 새로 만들어내는" 경향 자체는 프롬프트 설계
관점에서 백로그로 남긴다(이번 Phase 범위 아님 — 섹션 18 "즉시 수정
아님" 항목에 해당).

### Article D(리히터 규모) — 영어 2 + 한국어 1 혼합 source

| 판정 | fact 요지 | 사람 확인 결과 |
|---|---|---|
| supported(표본 5건 확인) | 모멘트 규모 1979년 정의, USGS 규모4 이상 표준척도, 1960 칠레/1964 알래스카 과소평가 수치, 릭터 규모 1935년 개발, 1960 칠레 대지진 Mw9.5 | **전부 TP** — 영어 위키 2건 + 한국어 위키 1건 원문에 모두 실제로 있는 숫자/사실. 특히 **영어 source → 한국어 fact**(예: "1979년 Thomas C. Hanks와 Hiroo Kanamori" — 영문 인명이 한글 fact에 그대로 병기된 경우)도 숫자(1979)와 영문 고유명사(Hanks/Kanamori)가 원문에 그대로 있어 정확히 supported로 판정됨 |
| needs_review(2건 전부) | "모멘트 규모는 지진 에너지와 직접적으로 연관되며... 포화 문제가 없다", "단일 커플 vs 이중 커플 논쟁..." | 둘 다 숫자/귀속 표현이 없는 서술문이며 원문과 단어 일치율이 낮음(8%, 0%) — 실제로 원문(모멘트 규모 영문 위키)에 유사 내용이 있는지 확인한 결과 두 번째("커플 모델" 논쟁)는 원문에 실제로 존재하는 내용이었다 — **FN 가능성(놓친 supported)**, 다만 needs_review로 안전하게 분류됐으므로 verifiedFacts로 잘못 승격되지는 않았다(결과적으로 안전, 재현율만 아쉬움) |
| unsupported | 0건 | 해당 없음 |

## 4. Supported 오판정 검사(섹션 6) — 가장 중요한 실패 유형

**article C/D 총 25개 candidate fact 중, 사람이 직접 대조한 표본
(supported 10건 + needs_review 3건 + unsupported 2건 = 15건) 어디서도
"실제 source에 없는 fact가 supported로 통과"한 사례는 발견되지
않았다.** High 후보 0건.

## 5. needs_review 발생률(섹션 7) 측정

| article | candidate | needs_review | 비율 |
|---|---|---|---|
| C | 13 | 1 | 7.7% |
| D | 12 | 2 | 16.7% |
| 합계 | 25 | 3 | 12.0% |

지시서 예시("candidate 20, needs_review 11" = 55%)에서 우려한 수준의
과다 발생은 관찰되지 않았다. unsupported도 각 article당 최대 1건으로
낮다.

## 6. verifiedFacts starvation 검사(섹션 8)

| article | candidate | 최종 verifiedFacts | 생존율 |
|---|---|---|---|
| C | 13 | 11 | 84.6% |
| D | 12 | 10 | 83.3% |

생존율이 80% 이상으로 충분히 높다 — master manuscript가 빈약해지는
징후는 관찰되지 않았다. article C의 WordPress 본문(5,753자)과 article
D의 naver_cafe 본문(1,225자, story tone 특성상 원래 짧음) 모두 구체적
수치(연도/퍼센트/기관명)를 다수 포함한 실질적인 글이었고, 추상적인
일반론으로 흐르지 않았다(섹션 16 — 상세는 아래).

## 7. downstream Layer 2 회귀(섹션 9)

두 article 모두 quality gate가 blocked 없이 ready로 통과했고,
fact_grounding checklist 항목이 정상 작동했다:

- article C(wordpress_blog): 9건 `unsupported_number` flag(위 섹션 3
  "핵심 관찰" 참고 — 플랫폼 생성 단계에서 새로 추가된 국제비교 수치를
  정확히 잡음).
- article D(naver_cafe): 3건 `unsupported_number` flag(예시로 든
  "규모 5.2", 로그 스케일 계산에서 파생된 "약 1,000배" 표현 등 —
  본문을 직접 읽어본 결과 위험한 조작이 아니라 예시/근사 계산 성격,
  FP에 가까움).
- article D(x): 0건(clean pass).

**Layer 1 통과 → Master → Platform post → Layer 2** 구조 전체가
실제로 동작함을 확인했다 — Layer 1이 upstream(source summary 단계)
오염을 막고, Layer 2가 downstream(플랫폼 생성 단계에서 새로 만들어진
주장)을 별도로 잡아내는 역할 분리가 실제 데이터에서도 유지됐다.

## 8. 실제 fixture 재확인(섹션 10/11/12)

`npm run ops:audit-source-evidence`(read-only)로 재확인:

- **CBT 사례**(article `38406eb3-...`): "인지행동치료(CBT)가 불면증의
  가장 근본적인 치료법으로 권고된다" — 여전히 **unsupported로 정확히
  차단됨**(2개 sourceId 그룹 모두).
- **AASM 사례**(같은 article): "미국수면의학회(AASM)는 2021년
  메타분석을 통해..." — 여전히 **unsupported/needs_review로 정확히
  차단됨**(supported로 통과하지 않음).
- **SBS 사례**(article `01939c44-...`): "2019년 SBS스페셜..." —
  OPS-04-FIX1의 정정대로 **여전히 supported로 정상 처리됨**(정정
  상태 유지 — 이 사례를 false hallucination fixture로 다시 쓰지
  않았다).

## 9. FP-E 목록 번호 회귀(섹션 13)

article D의 naver_cafe 본문에 실제로 번호 목록("1. 뉴스 볼 때...", "2.
지진 관련 정보를...", "3. 과학 용어가...", "4. 혹시 지진 관련해서...",
"5. 저처럼 뉴스 보다가...")이 5개 등장했으나, downstream Layer 2가
flag한 3건 중 **번호 목록이 fact claim으로 오인된 경우는 0건**이었다
— OPS-04-FIX1의 `splitSentences` 수정이 실제 생성 결과에서도 유효함을
확인했다.

## 10. 다국어 핵심 관찰(섹션 14)

article D(영어 2 source + 한국어 1 source)에서:

- **숫자/날짜/영문 고유명사**(예: "1979년 Thomas C. Hanks와 Hiroo
  Kanamori", "1960년 칠레 대지진... 실제 M_w 9.6") → deterministic
  하게 정확히 supported 판정됨. 영문 인명이 한글 fact에 그대로 남아
  있는 경우 문자열 대조가 그대로 작동했다.
- **needs_review 2건**은 모두 숫자/귀속 표현이 아예 없는 서술형
  문장이었다(다국어 entity 매칭 완화 규칙이 직접 작동한 사례는
  이번 표본에서는 없었음 — 두 needs_review 모두 "entity 불일치"가
  아니라 "숫자/귀속 자체가 없는 문장" 경로였다).
- 이 구분은 실제 운영 가능한 수준으로 보인다 — 다만 표본이 작아
  "영문 기관명이 한글로 번역되어 완화되는" 케이스는 이번 재검증에서
  직접 관찰되지 않았다(OPS-04-FIX1의 합성 fixture로만 확인된 상태).
- 이번 Phase에서 semantic AI matcher는 추가하지 않았다.

## 11. 사람 확인 부담(섹션 15)

| article | verificationNeeded 항목 수 | 실제로 사람이 판단한 항목 수 |
|---|---|---|
| C | 7 | 2(unsupported 1 + needs_review 1, 전수 확인) + supported 5건 표본 = 7 |
| D | 7 | 2(needs_review 전수) + supported 5건 표본 = 7 |

OPS-04-FIX1 이후 사람 확인 부담이 급증한 징후는 없다 — article당
확인이 필요한 절대 개수(1~2건)는 OPS-03/04의 fact_grounding 확인
건수(1~4건)와 비슷한 수준이며, "운영 가능한 수준"을 유지하고 있다.

## 12. Master manuscript 품질(섹션 16)

- article C: verifiedFacts 11건 중 7건이 구체적 수치(기금 규모/자산
  비율/운용수익률 등)를 포함 — 핵심 사실이 충분히 남았다.
- article D: verifiedFacts 10건 중 8건이 연도/규모/배수 등 정량적
  수치 포함.
- 두 article 모두 verificationNeeded가 본문 전체를 대체하는 수준이
  아니라(7건, 전체 candidate의 절반 이하) 여전히 소수 항목만 안내
  하는 수준을 유지했다 — starvation/과도한 일반화 징후 없음.

## 13. 플랫폼 생성(섹션 17)

wordpress_blog(장문) 1건 + naver_cafe(copy platform) 1건 + x(copy
platform) 1건 = 3개 platform post. 모든 플랫폼을 강제로 만들지
않았다(지시서 권장 최소 구성 그대로).

## 14. 코드 수정 여부(섹션 18)

**코드 수정 없음.** 관찰 결과 즉시 수정이 필요한 사유(명백한
supported/unsupported 오판정 버그, 데이터 유실, downstream
contamination, runtime exception)는 0건이었다. 다음은 "즉시 수정하지
않음" 대상으로 분류해 백로그에만 남긴다:

- Article C의 국제비교 섹션(플랫폼 생성 프롬프트가 출처 범위를
  벗어나 새 내용을 만들어내는 경향) — Layer 2가 정상적으로 확인
  필요 표시했으므로 안전하지만, 생성 프롬프트 설계 관점의 개선
  여지가 있다(단순 FP/문구 수준이 아니라 원인 분석에 별도 조사가
  필요해 이번 Phase 범위를 넘는다고 판단).
- needs_review 중 일부(예: article D의 "이중 커플 모델" 서술문)가
  실제로는 원문에 있었던 재현율 아쉬움 — 안전 방향의 오차(FN이
  아니라 과소 확신)라 즉시 수정 대상이 아니다.

## 15. 최종 결정(섹션 19)

**A. 그대로 유지.**

근거:
- unsupported→supported 명백한 오판정: 0건
- Miss(진짜 위험한 미확인 주장이 그대로 통과): 0건
- needs_review 부담: 운영 가능한 수준(12%, article당 1~2건)
- verifiedFacts: 충분(생존율 83~85%)

B/C/D를 선택하지 않은 이유: B(반복 FP 원인이 명확한 개선 대상)는
이번 표본에서 반복 패턴이 확인되지 않았고, C(다국어 개선 Phase)는
needs_review 과다/starvation이 발생하지 않아 조건 미충족, D(설계
재검토)는 실제 unsupported fact가 계속 supported로 통과하는 사례가
없어 조건 미충족.
