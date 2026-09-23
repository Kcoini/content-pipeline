# OPS-01 Pilot B: 정보형 콘텐츠(source_based_explainer) + Naver Cafe

- 실행일: 2026-09-19
- 실행 방식: 실제 Supabase DB / 실제 Anthropic API(claude, `AI_PROVIDER=anthropic`) 사용. UI를 클릭하는 대신 Server Action이 내부적으로 호출하는 것과 동일한 repository/service 함수를 `scripts/ops-01/pilot-b-information-cafe.ts`(Vitest 드라이버)에서 순서대로 호출했다 — Next.js `redirect()`/`revalidatePath()`만 제외하고 실제 비즈니스 로직은 100% 동일하게 실행했다.
- 실제 외부 게시(Naver API 호출)는 전혀 하지 않았다 — 이 프로젝트에는 애초에 그런 기능이 구현되어 있지 않다(copy 전용).

## 1. 입력 (실행 전 snapshot)

| 항목 | 값 |
|---|---|
| 주제 | 한국은행 기준금리 정책 이해하기 |
| theme id | `efcb7e5f-8ebd-4023-b00c-a4201fe7fd4b` |
| article id | `f566ab75-f479-454d-92bd-75a867540765` |
| social post id | `19db4258-eeab-4b20-a7d2-6561a1d112ad` |
| 대상 article mode | `source_based_explainer`(출처 기반 설명형) |
| 대상 platform | `naver_cafe` |
| tone | `story`(자동 추천) |
| source 수 | 3건(전부 실제 공개 URL, fetch 성공) |
| source URL | `https://ko.wikipedia.org/wiki/한국은행`, `https://en.wikipedia.org/wiki/Bank_of_Korea`, `https://ko.wikipedia.org/wiki/기준금리` |
| 시작 시각 | 2026-09-19 10:53 KST |

주제 선정 이유: 날짜·수치·기관명이 명확하고 공개적으로 검증 가능한 정보성 주제(한국은행/기준금리)를 선택했다. 개인정보·민감정보·위험한 테스트 문구는 사용하지 않았다.

## 2. 생성 결과

- 기사 제목: "한국은행 기준금리, 어떻게 결정되고 왜 중요한가"
- 본문 길이: 1,817자, 인용 출처 3개 전부 사용(citedSourceIds.length === 3)
- 구조: 소제목 5개(도입/역사/작동 방식/의미/전망)로 구성된 설명형 기사 — 내부 drafting heading(예: "서론", "결론" 같은 원고 작성용 표현) 없음, 콘텐츠 자체의 의미를 담은 소제목 사용.
- article.contract.yaml, source.contract.yaml 전부 통과(위반 0건).
- AI 품질 평가(evaluateArticleForMode): **passed=true**, aggregateScore=3.65.
- naver_cafe social post: 제목 "한은 기준금리 뉴스 나올 때마다 궁금했던 것들, 다들 어떠세요?", 본문 1,232자, 질문형 마무리(질문 5개) — naver_cafe 톤(경험담+질문 유도)에 맞게 변환됨(기사 원문의 formal한 설명형 어조와 명확히 다름 — 플랫폼 적합성 양호).

## 3. Review 결과 (자동 검토)

Quality gate: **status=ready, score=100/100**. 17개 checklist 항목 전부 `pass`(`needsCheck=0`, `needsFix=0`, `blocked=0`) — naver_cafe 전용 검사(`naver_cafe_no_markdown_escape`, `naver_cafe_no_markdown_heading`, `naver_cafe_promotional_language`, `naver_cafe_discussion_cue` 등) 포함 전부 통과.

## 4. 사람 확인 (user_confirmation_required) — TP/FP/Miss 평가

**이번 파일럿에서 auto review가 사람 확인이 필요하다고 표시한 항목은 0건이었다.** 이 결과가 정말 맞는지 확인하기 위해, 생성된 기사 본문을 실제 소스 원문(raw fetch 결과, 요약이 아니라 원문)과 대조하는 별도 검증 스크립트(`scripts/ops-01/pilot-b-verify.ts`)를 돌렸다.

- 기사 본문의 "2026년 2월 기준 연 2.50%", "외환보유액 약 3,740억 달러"라는 시의성 수치 2건은 실제로 위험해 보이는 미확인 주장이라고 의심했으나, 검증 결과 **`https://en.wikipedia.org/wiki/Bank_of_Korea` 원문에 "2.50"과 "3,740" 문자열이 실제로 포함되어 있음을 확인**했다 — 즉 AI가 출처에 없는 수치를 지어낸 것이 아니라 영문 위키백과 infobox의 실제 최신 값을 정확히 인용한 것이다.
- "1962년 박정희 정부의 한국은행법 개정" 서술도 원문에 "1962"가 실제로 포함되어 있어 근거가 있다.
- 사실과 해석의 구분: "기준금리를 단순히 '경기가 나쁘면 내리고...' 공식으로만 이해하면 복잡성을 놓치기 쉽다", "여전히 열린 과제로 남는다" 같은 문장은 기사 스스로 해석/논평으로 표시된 문단(전망 섹션)에 위치해 있어 사실 서술과 뒤섞이지 않았다.
- unsupported overclaim: 발견되지 않았다.

**결론(TP/FP/Miss)**: True Positive 0건, False Positive 0건, **Miss 0건**(독립 검증 결과 실제로 근거 없는 주장을 찾지 못했다). 이번 파일럿은 "사람 확인 0건이 정확한 결과였다"는 드문 깨끗한 케이스였다.

**중요한 한계(솔직히 기록)**: 이번 파일럿의 출처가 우연히 매우 정갈한 위키백과 요약이었기 때문에, TP/FP/Miss 지표가 실제로 풍부하게 관찰되지 못했다. 사실 확인 로직 자체(User-confirmation 판단 기준)를 더 엄격히 검증하려면, 서로 상충하는 수치/날짜를 가진 source 여러 개를 의도적으로 섞은 후속 파일럿이 필요하다 — **OPS-02 후보로 기록**(Content Tuning 아님, 검증 방법론 개선 항목).

## 5. 수정

사람이 직접 수정한 횟수: **0회**(품질 게이트가 첫 실행에서 이미 ready/100점이라 수정 사유가 없었음).
auto_fix 실행 여부: **미실행**(quality_status가 처음부터 `ready`였고 `needs_revision`이 아니어서 `runAutoFixAndRecheck`가 트리거될 필요가 없었음 — 자동 수정이 필요하지 않은 것도 유효한 결과이므로 "실행 안 함"을 그대로 기록한다).

## 6. 승인

- 기사 승인: 성공 (status: draft → reviewed)
- social post 승인: 성공 (`social_approval_completed`)

## 7. Publish Preparation

- naver_cafe는 copy capability다 — 실제 게시는 사용자가 본문을 복사해 네이버 카페에 직접 붙여넣어야 한다.
- `prepareManualPostingRecord`(수동 게시 준비 상태 확인)를 실행한 결과: `success=false`, "게시용 내보내기 준비가 아직 끝나지 않아 게시 완료를 기록할 수 없습니다." — 이는 **정상 동작**이다(manual export/handoff를 아직 실행하지 않았으므로 "게시 완료로 기록"을 막는 것이 맞다 — QA-01-FIX1에서 wordpress_blog는 이 전제조건에서 제외했지만 naver_cafe(manual/copy capability)는 여전히 이 전제조건이 적용되어야 하고, 실제로 정확히 그렇게 동작했다. 회귀 없음 확인).
- 이 파일럿은 실제 URL을 조작해 "게시 완료"를 기록하지 않았다(데이터 정합성 보호) — 실제 운영에서는 사용자가 네이버 카페에 직접 게시한 뒤 URL과 함께 `recordManualPostingResult`를 호출해야 완료로 기록된다.

## 8. 시간

| 단계 | 소요 시간 |
|---|---|
| 테마 생성 | 181ms |
| 출처 3건 등록+수집+AI 요약 | 57,185ms(약 57초) |
| AI 기사초안 생성(+계약검사+저장) | 50,814ms(약 51초) |
| AI 품질 평가 | 36,850ms(약 37초) |
| 기사 승인 | 444ms |
| naver_cafe 글 생성(AI) | 39,114ms(약 39초) |
| 자동 검토(quality gate) | 704ms |
| 자동 수정 검토(미실행) | 100ms |
| social post 승인 | 609ms |
| **총 소요시간(파이프라인 실행)** | **약 186초(3분 7초)** |

이 시간은 순수 파이프라인 실행 시간이며, 실제 사용자가 화면을 읽고 판단하는 시간(주제 선정/URL 조사/결과 검토)은 포함하지 않는다.

## 9. 클릭/판단 (실제 UI 흐름 기준 추정)

주의: 이번 실행은 UI를 직접 클릭하지 않고 동일한 service 함수를 호출했으므로, 아래는 **동일한 결과를 만들기 위해 실제 화면에서 필요한 클릭/판단 수를 코드 흐름 기준으로 추정**한 값이다(실측 브라우저 클릭이 아님을 명시).

- Primary action click: 8회 (테마 생성 1 + 출처 등록 3 + 기사초안 생성 1 + 기사 승인 1 + naver_cafe 글 생성 1 + social 승인 1)
- 사람 판단 시점: 2회(생성된 기사 본문 검토 1 + naver_cafe 글 검토 1) — 두 시점 모두 "확인 필요" 항목이 없어 판단이 빠르게 끝났을 것으로 예상됨
- 본문 수정 횟수: 0
- retry 횟수: 0(모든 단계가 1회 실행으로 성공)

## 10. 오류

- system error: 0건
- retry: 0건
- wrong state / dead-end / confusing action: 발견되지 않음
- formatting issue: 발견되지 않음(마크다운/HTML 잔여물 없음 — 아래 11절)

## 11. Naver Cafe 세부 체크 (Phase 스펙 섹션 8)

- Markdown heading(`#`) 잔여: 없음
- `**bold**` 잔여: 없음
- raw HTML 태그: 없음
- `sanitizeNaverCafePlainText()` 적용 결과와 원본이 동일(`sanitizeNoChange=true`) — 애초에 AI가 plain text 형식을 정확히 지켰다는 뜻.
- 가독성: 문단이 짧고(2~4문장), 질문형 문장 다수 포함(discussion cue 검사 pass와 일치), 실제 카페 게시판 글처럼 자연스러움.
- 본문 복사(quality gate `content_present`/`required_fields_present`): pass.

## 12. 생성 품질 평가표

| 항목 | 평가 |
|---|---|
| 1. 사실 충실성 | 양호 — 모든 핵심 수치/연도가 실제 출처 원문에서 확인됨(4절 참고) |
| 2. 구조/가독성 | 양호 — 기사: 5개 소제목 구조 명확, naver_cafe: 경험담+질문형으로 톤 전환 성공 |
| 3. 플랫폼 적합성 | 양호 — naver_cafe 버전이 기사 원문을 그대로 복붙한 것이 아니라 실제로 카페 게시판 어조로 재작성됨 |
| 4. 수정 필요 정도 | 양호(수정 불필요) — quality gate 100점, 0건 checklist 실패 |
| 5. 실제 사용 가능성 | 양호 — 그대로 사용 가능 수준(4단계 중 "생성 직후 그대로 사용 가능") |

콘텐츠 운영 관점 4단계 분류: **"생성 직후 그대로 사용 가능"**(작은 수정도 필요하지 않음). AI 내부 eval score(aggregateScore 3.65/5)와는 별도 판단이며, 운영 관점에서는 더 높게 평가된다 — eval score는 엄격한 채점 기준(예: 특정 형식 요구사항 미충족 등 기술적 채점)을 반영할 수 있어 운영 적합성과 항상 일치하지 않는다는 점을 기록해 둔다.

## 13. 최종 판정

**Pilot B 통과.** 실제 다중 출처 사실 정리, 사실/해석 분리, naver_cafe plain-text 포맷팅, 자동 검토가 모두 기대대로 동작했다. 유일한 아쉬운 점은 user_confirmation_required 이슈가 전혀 발생하지 않아 TP/FP/Miss 검증 표본이 부족했다는 것(4절 참고, OPS-02 후보).

## 14. 발견한 문제 (OPS-Blocker/High/Medium/Low/Content Tuning)

**OPS-Blocker**: 없음
**High**: 없음
**Medium**: 없음
**Low**: 없음
**Content Tuning**:
- 시의성 수치(기준금리 %, 외환보유액 등)를 인용할 때, 소스가 "최신 값"을 담고 있어도 그 값이 게시 시점 기준으로 여전히 유효한지 재확인하라는 안내가 없다 — 향후 "시의성 데이터 재확인 안내" 문구를 게시 준비 단계에 추가하는 것을 OPS-02 tuning backlog로 제안한다(버그 아님, 콘텐츠 운영 개선 제안).
- TP/FP/Miss 검증 표본 확보를 위해 의도적으로 상충하는 source를 섞은 후속 파일럿 필요(4절, 검증 방법론 개선 — Content Tuning이 아니라 향후 QA 방법론 항목으로 별도 기록 권장).

이번 파일럿 중 코드 수정 없음(Blocker/High가 없었으므로 "즉시 수정" 규칙이 적용될 대상이 없었다).
