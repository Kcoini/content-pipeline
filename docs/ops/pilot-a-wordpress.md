# OPS-01 Pilot A: WordPress 블로그 — 실제 파일럿 결과

- 실행일: 2026-09-19
- 실행 방식: 실제 Supabase DB / 실제 Anthropic API(`AI_GENERATION_ENABLED=true`) / 실제 WordPress 사이트(`WORDPRESS_PUBLISH_ENABLED=true`, Draft만)를 사용해 `scripts/ops-01/pilot-a-wordpress.ts`(vitest 드라이버, `npm run` 스크립트가 아니라 `app/dashboard/actions.ts`/`app/articles/[id]/actions.ts`의 Server Action이 실제로 호출하는 것과 동일한 repository/lib 함수를 그대로 호출)로 실행했다. UI를 클릭하지 않고 서비스 레이어를 직접 호출했으므로, "클릭/판단 수"는 실제 UI에서 동일 상태 전이에 필요한 클릭을 추정한 값이며 본문에 그 사실을 명시한다.
- 실제 public publish 함수는 어디서도 호출하지 않았다(코드 검색으로 확인 — `publishApprovedArticleToWordPressAction`/`wordpress-public-publish-service.ts` 미사용).

## 입력

| 항목 | 값 |
|---|---|
| 주제 | 카페인이 우리 몸에 미치는 영향과 하루 적정 섭취량 |
| theme id | (실행 로그에 기록, 이 문서에는 비민감 식별자만 남김) |
| article id | `3b94f78b-680b-46e0-b9c7-a0033a287f2d` |
| social post id (wordpress_blog) | `0aad3f10-7dbc-4e02-add6-3c2825cad983` |
| 대상 platform | wordpress_blog |
| article mode | monetized_blog(수익형 블로그형 — SEO/광고 슬롯/FAQ/체크리스트 요구) |
| source 수 | 3건(전부 URL 기반, 전부 fetch 성공) |
| source URL | `ko.wikipedia.org/wiki/카페인`, `ko.wikipedia.org/wiki/커피`, `en.wikipedia.org/wiki/Caffeine` |
| tone | explanatory(자동 추천) |
| 언어 | ko |
| 시작 시각 | 2026-09-19 10:52 KST(첫 실행), 10:59 KST(5단계부터 재개 — 아래 "오류" 참고) |

## 생성 결과

- 기사(article) 제목: "카페인이 우리 몸에 미치는 영향과 하루 적정 섭취량 — 작용 원리부터 주의점까지"
- 본문 길이: article 약 3,900자(한글 기준) / wordpress_blog post 5,703자
- 인용 출처: 3건 전부 인용됨(citedSourceIds.length === 3)
- article 계약 검사(article.contract.yaml): **통과**
- source 계약 검사(source.contract.yaml): **통과**
- article eval(monetized-blog.eval.yaml, AI 평가): **실패(aggregateScore=0)** — 아래 "오류/발견 문제" 참고. 이 실패는 `saveDraftArticle`을 막지 않는다(기존 설계상 경고일 뿐 차단 아님 — 실제 앱 동작과 동일하게 재현).
- wordpress_blog social post 생성: **성공**(AI 호출 1회, input 20,736 tokens / output 9,128 tokens)
- wordpress_blog 출력 계약(wordpress-blog.schema.json): **통과**(valid: true)

## review 결과 (quality gate)

- 1회차 quality gate: **status=ready, score=98/100** (첫 시도에 바로 ready — auto_fix 불필요)
- checklist 27개 항목 중 26개 pass, **1개 warning**(`wordpress_excerpt_present` — excerpt 없음, 가산 요소일 뿐 차단 아님)
- `summarizeAutoReview` 집계: passed=25, needsCheck=1, needsFix=0, blocked=0, riskLevel=low

## 사람 확인(user_confirmation_required류) 이슈 품질 평가

자동 검토가 표면화한 사람 확인 항목은 1건(excerpt 없음)뿐이었다. 이는:

- **True Positive**: 실제로 excerpt가 비어 있었고, WordPress 목록/SNS 공유 시 필요한 필드이므로 사람이 확인할 가치가 있다. 다만 severity가 낮아(가산 요소, 차단 아님) 반드시 즉시 조치할 필요는 없다.

체크리스트에는 없지만, **본문을 직접 읽고 발견한 사실-정합성 이슈 1건**을 추가로 기록한다(이는 quality gate의 Miss가 아니라,애초에 quality gate가 "출처 대비 사실 일치"까지는 검증하지 않는 설계이기 때문 — 아래 "발견한 Medium/Low" 참고).

## auto_fix 품질 평가

- 1회차에서 `qualityStatus="ready"`였으므로 **auto_fix가 실행되지 않았다**(설계대로 — needs_revision일 때만 실행). 이번 파일럿에서는 auto_fix 전/후 비교 데이터가 없다(자동 수정이 발동할 조건 자체가 발생하지 않음 — 좋은 신호로 해석할 수 있으나, auto_fix 자체의 품질은 이번 파일럿으로 검증되지 않았다).

## 승인

- article(원본 기사) 승인: 성공, `status: draft → reviewed`
- social post(wordpress_blog) 승인: 성공, `approveAndPrepareWordPressBlogPostForPublishing` 안에서 승인 + 게시 준비를 한 번에 처리

## Publish Preparation (실제 WordPress Draft 생성 결과)

`prepareWordPressBlogPostForPublishing` 8단계 결과:

| Step | 결과 | 메시지 |
|---|---|---|
| quality | success | quality_status=ready 확인됨 |
| approval | success | approval_status=approved 확인됨 |
| draft | **success** | **실제 WordPress Draft 생성됨 — `https://foodkim.com/?p=69` (externalPostId=69, wordpress status=draft)** |
| seo_auto_generate | skipped | seoTitle/metaDescription/targetKeyword가 이미 있어 건너뜀 |
| seo_metadata | success | wordpress_blog 글 기준 SEO metadata 업데이트 |
| seo_plugin | success | Rank Math SEO metadata를 custom endpoint로 실제 반영(postId=69) |
| featured_image | **warning** | 대표 이미지 미준비(media id 없음, "이미지 없이 진행" 미선택) — 이번 파일럿에서 이미지 생성/업로드 단계는 의도적으로 실행하지 않음(비용/스코프 제한) |
| publish_guard | success | **status=ready, score=96, ready=true** |

- **QA-01-FIX1 회귀 확인**: `runPlatformPublishingGuard` 실행 결과 `exportStatus="not_exported"`(manual export 미실행 상태)임에도 **`status="ready"`, `blockedCount=0`** — export_status/export_payload 전제조건이 wordpress_blog에 더 이상 적용되지 않음을 실제 프로덕션 코드 경로에서 확인했다. **회귀 없음.**
- 실제 공개 게시(public publish)는 호출하지 않았다 — WordPress 쪽 post status는 `draft`로 남아 있다.

## 시간

| 단계 | 소요 시간 |
|---|---|
| 테마 생성 + 출처 3건 등록(fetch+AI 요약) | 약 57.4초 |
| AI 기사초안 생성(source 요약 + 본문 생성) | 약 124.4초 |
| AI 평가(eval) | 약 44.0초 |
| article 승인 | <1초 |
| wordpress_blog social post 생성(AI 호출 1회) | 약 134.0초 |
| quality gate 1회차 | <1초 |
| 승인 + WordPress 게시 준비 전체(Draft+SEO+guard) | 약 11.0초 |
| **총 소요(순수 실행 시간 합)** | **약 6분 11초** |

(참고: 첫 실행에서 5단계가 스크립트 타임아웃 설정 실수로 실패해 재실행했다 — 이는 드라이버 스크립트의 타임아웃 값 문제이지 실제 앱 성능 문제가 아니다. 실제 AI 응답 자체는 위 표의 시간 안에 왔다.)

## 클릭/판단 (실제 UI 기준 추정)

서비스 레이어를 직접 호출했으므로 실제 클릭 수는 측정하지 않았다. 동일한 상태 전이를 실제 `/dashboard`, `/articles/[id]/blog` UI에서 수행한다면:

- primary action 클릭: 테마 생성(1) → 출처 등록×3(3) → 마스터 원고 생성(1) → article 승인(1) → 플랫폼별 글 생성에서 wordpress_blog 선택(1) → "승인하고 WordPress Draft 만들기" 통합 버튼(1) = **약 8회**
- 사람 판단(확인/검토) 지점: article mode 선택(1) → 생성된 본문 검수(1) → excerpt 경고 확인(1) = **약 3회**
- 본문 수정 횟수: **0회**(1회차 quality gate에서 바로 ready)
- retry: **0회**(비즈니스 로직 재시도 없음 — 위 시간 섹션의 스크립트 타임아웃 재실행은 제외)

## 오류

- **AI eval 실패(aggregateScore=0)**: `evaluateArticleForMode("monetized_blog", ...)` 호출이 `passed=false, aggregateScore=0`을 반환했다. 실제 생성된 콘텐츠 품질(아래 참고)은 양호했음에도 eval 점수가 0인 것은 비정상이다 — eval 채점 로직 또는 monetized-blog eval 기준 파일 쪽 문제일 가능성이 있다. **이번 Pilot에서는 코드를 수정하지 않았다**(문제 재현 확인만 하고, 이 파일럿의 즉시-수정 범위를 벗어나는 원인 조사가 필요해 backlog로 남김 — 아래 "발견한 OPS-Blocker/High" 참고, High로 분류).
- 드라이버 스크립트 자체의 timeout 설정(120초)이 실제 AI 응답 시간(134초)보다 짧아 5단계가 1회 실패했다 — 스크립트를 280초로 조정해 재실행, DB에 이미 생성된 theme/article은 재사용(재생성으로 인한 추가 AI 비용 없음). 이는 파일럿 드라이버의 문제이며 프로덕션 코드 문제가 아니다.

## 품질 평가 (섹션 7 체크리스트)

- 제목: 자연스러움 — **양호**(질문형 후킹 + 명확한 주제, 클릭베이트 아님)
- 도입부: **양호**(통계 인용으로 시작, 상투적이지 않음 — quality gate도 `non_generic_opening` pass)
- 문단 구조: **양호**(핵심 요약 박스 → 목차 → 본론 → 상황별 안내 → 체크리스트 → 주의사항 → FAQ → 요약 → 참고자료)
- 플랫폼 전용 소제목: **양호**(h2/h3 마크다운 구조 확인됨)
- 내부 drafting heading 잔존: **없음**(quality gate 확인)
- source와 맞지 않는 사실: **확인 필요** — 아래 Medium 항목 참고(article과 post 간 "하루 400mg" 수치 표현 불일치)
- 반복 표현: **양호**(눈에 띄는 반복 없음)
- 과도한 AI 문체: **양호**(quality gate의 `no_unsupported_authority`/`no_fearmongering` pass, 수동 검토로도 과장 문구 없음 확인)
- SEO title/description: **양호**(둘 다 자동 생성되어 채워짐)
- 대표 이미지 상태: **미준비**(이번 파일럿에서 의도적으로 스킵)
- WordPress Draft: **성공**(`https://foodkim.com/?p=69`)

### 5개 항목 평가표 (섹션 12)

| 항목 | 평가 |
|---|---|
| 1. 사실 충실성 | 확인 필요 — article/post 간 "하루 권장량 400mg" 수치 표현이 불일치(아래 참고), 그 외는 커피/카페인 관련 널리 알려진 사실과 부합 |
| 2. 구조/가독성 | 양호 |
| 3. 플랫폼 적합성 | 양호(WordPress HTML box/AD_SLOT/표/FAQ 형식 준수) |
| 4. 수정 필요 정도 | 확인 필요(경미) — 수치 불일치 1건, excerpt 미입력 1건 |
| 5. 실제 사용 가능성 | 양호(위 2건 확인 후 그대로 사용 가능한 수준) |

## 발견한 OPS-Blocker

없음.

## 발견한 High

- **AI eval(품질 평가) aggregateScore=0 이상 동작**: monetized_blog 모드에서 eval이 항상/자주 0점을 반환하는 것으로 보인다(실제 콘텐츠 품질은 양호했음에도). eval 결과가 신뢰할 수 없으면 "생성 직후 품질 신호"로 쓸 수 없다는 점에서 운영상 High로 분류한다. **이번 Pilot에서는 수정하지 않았다** — 원인이 eval 프롬프트/채점 기준/모델 응답 파싱 중 무엇인지 추가 조사가 필요해 OPS-02 조사 대상으로 넘긴다(성급하게 채점 로직을 고치면 오히려 다른 mode의 eval을 깨뜨릴 위험이 있어, 이번 파일럿의 "Blocker/High만 즉시 수정" 원칙에 따라 조사 없이 코드를 바꾸지 않기로 판단).

## 발견한 Medium/Low

- **Medium**: article 본문은 "하루 400mg 이하(FDA 등 여러 기관 기준)"를 단정적으로 서술하는 반면, wordpress_blog post 본문은 같은 수치를 "출처에서는 구체적인 하루 권장량을 명시하지 않았다"며 명시적으로 보류했다. 두 버전이 동일 소스를 두고 서로 다른 확신도로 서술한 것 — 사람이 최종 검수 시 두 버전의 사실 주장이 일치하는지 반드시 대조해야 한다. 사용된 3개 소스(카페인/커피 위키백과 한/영)가 실제로 400mg 수치를 포함하는지도 재확인 필요.
- **Low**: `wordpress_excerpt_present` 경고(excerpt 필드 비어 있음) — 가산 요소일 뿐 차단 아님.
- **Content Tuning**: 대표 이미지 생성/업로드는 이번 파일럿에서 스킵했다(비용/스코프 제한, 코드 문제 아님) — 운영 시 실제 이미지 파이프라인 확인 필요.

## 파일럿 중 코드 수정 내용

없음(이번 Pilot A 범위에서는 어떤 프로덕션 코드도 수정하지 않았다 — 발견한 문제는 모두 OPS backlog로 기록).

## 최종 판정

- 핵심 workflow(테마 → 출처 → 생성 → 검토 → 승인 → WordPress Draft) **완료**
- 데이터 손실 없음, 위험한 자동 게시 없음(Draft만), QA-01-FIX1 회귀 없음
- 사람이 반드시 수정해야 하는 항목은 없었고(0회 본문 수정), 확인이 권장되는 항목만 2건(수치 불일치, excerpt)
- **Pilot A는 운영 가능 수준으로 판단한다.** 단, eval 채점 이상(High)은 OPS-02에서 반드시 조사해야 한다.
