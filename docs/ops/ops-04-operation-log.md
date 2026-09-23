# OPS-04 운영 로그

- 작성일: 2026-09-23
- **상태: 실제 운영 2건(article) 완료, social post 6건 처리.** OPS-03에서
  검증된 접근 제어(Vercel Authentication, Protection Scope = All
  Deployments)가 여전히 유지됨을 재확인한 뒤 시작했다. 본문/prompt
  원문은 기록하지 않는다 — event/metric과 fact-grounding claim 원문
  일부만 판단 근거로 기록한다.
- 목적: OPS-03의 초기 운영 기준선이 더 다양한 실제 콘텐츠에서도
  유지되는지 확인 — 새 기능 개발 아님.

## HARD GATE(섹션 1) 재확인

| 확인 항목 | 결과 | 방법 |
|---|---|---|
| 배포 anonymous 접근 | **BLOCKED 유지** | `curl` credential/bypass token 미사용 — production alias에 302 + `vercel.com/sso-api` redirect, body는 "Redirecting..."만 노출. OPS-03-GATE와 동일 패턴. |
| 인증된 운영자 접근 | 가능(기존 확인 유지, 재검증 불필요 — 새 배포 없었음) | 사용자 직접 확인(OPS-03-GATE에서 이미 확립) |
| `npm run ops:preflight` | **PASS**(Supabase/Anthropic/WordPress Draft/Search providers/Public publish/Mock mode 6개 전부) | 실행 |

## 콘텐츠별 기록

### Article A — WordPress 블로그(설명형, 실내 공기질)

| 항목 | 값 |
|---|---|
| theme id | `3f8ced36-524a-4dc2-942c-4c4757988bdb` |
| article id | `30f14581-dc1b-4064-a002-bef94cbbe92d` |
| 주제 | 실내 공기질 관리와 미세먼지 대응 방법 |
| content type | monetized_blog |
| platform / tone | wordpress_blog / explanatory(자동 추천) |
| source 수 | 3(전부 fetch 성공) |
| generation | 성공(1회, retry 없음) |
| first-pass quality | ready(score 96, 1차 통과, auto-fix 불필요) |
| fact-grounding issue 수 | **8건**(rendered) / 주제 단위로는 약 4개 claim(습도 40~60%, HEPA 0.3μm/99.97%, 냉방기 1.5배 크기, 24시간 가동 — 뒤 2개는 각 2회씩 반복 언급되어 rendered count가 늘어남) |
| user-confirmation | 1건(fact_grounding warning) |
| blocking | 0건 |
| manual edit | 아니오 |
| approval | 성공(운영자 검토 후 승인, `ops-04-article-a`) |
| publish preparation | 성공(8단계 전부 성공/스킵, featured_image만 warning — 대표 이미지 미구현 범위) |
| WordPress Draft | **성공** — `https://foodkim.com/?p=73`(externalPostId=73) |
| publish guard | ready(score 96, 우회 없음) |
| input tokens(social 생성) | 21,323 |
| output tokens(social 생성) | 10,758 |
| 처리 시간 | theme+source 61.9초, article AI 생성+평가 175.4초, article 승인 0.6초, social 생성 167.5초, quality gate 1.0초, 승인+게시준비 11.1초 — **총 약 419초(7분)** |

### Article B — naver_blog/naver_cafe/x/threads/instagram(간헐적 단식, 5개 플랫폼)

| 항목 | 값 |
|---|---|
| theme id | `2e779490-1189-4782-851b-0124893ad18b` |
| article id | `01939c44-6d3a-46e3-a9eb-94d728ad1b3d` |
| 주제 | 간헐적 단식의 원리와 시작 전 고려할 점 |
| content type | source_based_explainer |
| platforms | naver_blog(신규 노출)/naver_cafe/x/threads/instagram |
| source 수 | 3(전부 fetch 성공, 영문 위키 Intermittent fasting 포함) |
| generation | 5/5 성공(1회씩, retry 없음) |
| first-pass quality | 5/5 ready(score 93/97/93/100/100 — naver_blog/naver_cafe/x/threads/instagram 순) |
| fact-grounding issue 수 | naver_blog 4건 / naver_cafe 2건 / x 1건 / threads 0건 / instagram 0건(합계 7건) |
| user-confirmation | naver_blog 1건(warning) / naver_cafe 1건(warning) / x 1건(warning) / threads 0건(pass) / instagram 0건(pass) |
| blocking | 0건(5개 전부) |
| approval | 5/5 성공 — threads/instagram은 `needsConfirmation=0`으로 bulk approval 자동 승인, naver_blog/naver_cafe/x는 **운영자가 실제 출처 원문(rawContent)과 직접 대조한 뒤** 개별 승인 |
| publish preparation | naver_blog는 manual capability(별도 "게시 준비" 단계 없음, approval이 최종 상태) — naver_cafe/x/threads/instagram과 동일 |
| WordPress Draft | 해당 없음 |
| manual posting 기록 | **의도적으로 호출하지 않음** — 5개 전부 `manualPostStatus=not_recorded` 유지 |
| input tokens(social 생성) | naver_blog 8,717 / naver_cafe 9,773 / x 7,177 / threads 6,941 / instagram 7,094 (합계 39,702) |
| output tokens(social 생성) | naver_blog 2,209 / naver_cafe 1,251 / x 1,337 / threads 491 / instagram 1,361 (합계 6,649) |
| 처리 시간 | theme 0.2초, source 3건 수집+요약 55.9초, article AI 생성+평가 49.7초, 5개 플랫폼 생성(전체) 129.4초, 품질검사(5개) 5.4초, bulk approval 1.5초, 개별 승인 3건 2.5초 — **총 약 245초(약 4분)** |

## fact-grounding 상세(운영자 직접 확인, TP/FP/Miss 판단 — FP 세부 분류 포함)

방법: 각 flagged claim 문장을 실제 3개 출처의 **원문(rawContent, AI 요약이
아닌 fetch된 원본 텍스트)**과 직접 대조했다(claim에 포함된 숫자/키워드가
`rawContent`에 실제로 등장하는지 문자열 검색으로 1차 확인 후, 등장하는
경우 문맥까지 읽어 실제로 같은 내용인지 확인).

### Article A(wordpress_blog) — 8건

| claim(요지) | 발생 횟수 | 판단 | 근거 |
|---|---|---|---|
| 실내 습도 40~60% 유지 | 2회 | **FP-A** | 출처(미세먼지/실내공기질/Indoor air quality 위키) 원문에 "40", "60" 모두 실제 등장 — validator가 대조하는 `evidenceText`가 `verifiedFacts`(source keyPoints 요약)로 좁혀져 있어서 놓쳤을 뿐, 원문 자체에는 근거가 있다. |
| HEPA 필터 0.3μm/99.97% | 3회 | **FP-B** | "0.3"은 출처 원문에 있으나 "99.97"은 3개 출처 어디에도 없음. 다만 이 수치는 HEPA 필터의 국제 표준 스펙(EN 1822 등)으로 널리 알려진 사실이라 위험한 조작은 아니라고 판단 — 다만 "이 3개 출처 기준"으로는 근거 없음을 인지해야 한다. |
| 공기청정기는 방 크기 1.5배 이상 제품 선택 | 1회 | **FP-A** | "1.5"가 미세먼지 위키 원문에 등장(문맥 상 관련 여부는 완전히 확인 못함, 다만 숫자 자체는 존재). |
| 24시간 가동 관련(질문+답변) | 2회 | **FP-A** | "24"가 3개 출처 모두에 등장. |

**Article A Miss**: 없음(직접 본문 전체를 읽고, 숫자 없는 기관명/최상급
표현도 별도로 스캔했으나 새로운 미확인 주장은 발견되지 않음).

### Article B — naver_blog 4건, naver_cafe 2건, x 1건

| claim(요지) | 플랫폼 | 판단 | 근거 |
|---|---|---|---|
| 의학적 단식 연구 1915년 시작, 1960년대 재조명 | naver_blog | **FP-A** | 영문 위키 Intermittent fasting 원문에 "1915", "1960" 모두 실제 등장. |
| 5:2 다이어트(5일 정상식사/2일 제한) | naver_blog | **FP-A** | "5:2" 원문에 실제 등장. |
| 체중 2.5~9.9% 감소 | naver_blog | **FP-A** | "2.5", "9.9" 모두 원문에 실제 등장. |
| 2025년 리뷰 — 12시간 단식, 인지기능 영향 없음 | naver_blog, x | **FP-A** | "2025" 원문에 실제 등장 — 최근 리뷰 인용이 의심스러워 보였지만 실제 출처에 존재하는 진짜 인용이었다. |
| "3.", "5." (번호만 있는 문장) | naver_cafe | **FP-E(신규 분류)** | 실제로는 댓글 유도 질문 목록("3. 실패하신 분은...", "5. 전문가 상담...")인데, `findUngroundedClaims`의 문장 분리 정규식이 "3." 뒤에서 잘못 끊어 번호만 별도 "문장"으로 추출 — 진짜 claim이 아니라 문장 분리 로직의 부산물. |

**Article B에서 발견된 명백한 신규 Miss(가장 중요한 발견)**:

naver_cafe/x/instagram 세 플랫폼과 **마스터 원고 본문 자체**에 모두
동일하게 "**2019년 SBS스페셜에서 소개된 라이언 스미스·킴스미스 부부가
TRF 방식으로 총 41kg을 감량한 사례**"라는 문장이 등장한다. 영문 위키
Intermittent fasting 원문을 직접 대조한 결과 "Smith"(다른 맥락의 논문
저자 인용)와 "41"은 등장하지만 **"SBS"라는 문자열은 원문 어디에도
없다** — 즉 미국 학술 문헌에 언급된 사례를 한국 시청자에게 익숙하게
만들려고 "2019년 SBS스페셜"이라는 존재하지 않는 방송 출처를 만들어
붙인 것으로 판단된다.

- **발생 단계**: 이 문장은 `social_posts`뿐 아니라 마스터 원고
  본문(`articles.content`)과 `verifiedFacts`(→`evidenceText`)에도
  동일하게 들어 있다. `verifiedFacts`는 `source.keyPoints`에서
  그대로 오므로(`lib/articles/master-manuscript-builder.ts`), **출처
  요약 단계(`generateSourceSummaryWithAi`)에서 이미 만들어진 뒤
  article 생성과 5개 social post 생성 전체에 전파**된 것으로 보인다.
- **왜 fact-grounding validator가 못 잡았나**: validator는 게시용
  본문이 `evidenceText`(=verifiedFacts)로 뒷받침되는지만 검사한다.
  이번 케이스는 `evidenceText` 자체에 이미 같은 허위 귀속이 들어있어
  "근거가 있다"고 잘못 판정된, **구조적으로 원천 차단이 불가능한
  사각지대**다(섹션 15가 언급한 계측 공백과는 다른, 새로운 유형의
  공백).
- **위험도 판단**: 체중 감량 수치(41kg) 자체는 실제 출처에 있는
  숫자로 보이며, 위험한 건강/금전 정보 조작은 아니다. 다만
  존재하지 않는 방송사·연도를 구체적으로 지어낸 것은 "출처
  기반"이라는 신뢰를 훼손하는 명백한 fact-grounding 실패다.
- **분류**: **High**(Blocker 아님 — 공개 게시나 위험한 외부 side
  effect로 이어지지 않았고, 이미 Draft/manual copy 이전 단계에서
  발견함). 즉시 외부 노출은 없었다.

## structured output 결과

| platform | tone | parse | retry | 최종 결과 |
|---|---|---|---|---|
| wordpress_blog | explanatory(자동) | 성공(1회) | 없음 | 성공 |
| naver_blog | explanatory(자동) | 성공(1회) | 없음 | 성공 |
| naver_cafe | story(자동) | 성공(1회) | 없음 | 성공 |
| x | curiosity(자동) | 성공(1회) | 없음 | 성공 |
| threads | story(자동) | 성공(1회) | 없음 | 성공 |
| instagram | comparison(자동) | 성공(1회) | 없음 | 성공 |

OPS-02A의 threads+story malformed-escape 완화가 이번에도(threads는
story tone) 정상 작동했다(1회 성공, retry 없음).

## auto-fix

6개 social post 전부 1차 quality gate에서 바로 `ready` 상태에 도달해
**auto-fix가 발동하지 않았다**(OPS-03과 동일 패턴).

## stalled job / operational failure

없음. job 기반 비동기 실행이 아니라 직접 서비스 함수를 호출하는 스크립트
실행 방식이라 stalled 개념이 적용되지 않는다. 6개 social post 생성 전부
1회 시도로 성공했고, 예외/실행 실패는 0건이었다.

## Access control 확인 기록

| 확인 시점 | Access control verified | Method |
|---|---|---|
| 2026-09-23 (OPS-04 HARD GATE) | **yes** | 실제 anonymous curl 요청(production alias) — Vercel SSO(`vercel.com/sso-api`)로 302 redirect, 앱 콘텐츠 미노출. bypass token/secret 미사용. `npm run ops:preflight` 6개 항목 전부 PASS. |

> OPS-03의 상세 근거는 `docs/ops/ops-03-limited-operation-plan.md`의
> "0-B. OPS-03-GATE Verification" 절 참고(새 배포가 없어 동일 결과
> 재사용).
