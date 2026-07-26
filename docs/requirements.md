# 요구사항 정의 (Requirements)

> REG Engineering: 이 문서는 content-pipeline MVP의 기능 요구사항과 범위를 정의한다.
> 새 기능을 추가하거나 변경할 때는 이 문서와 docs/acceptance-criteria.md를 먼저 갱신한 뒤 구현한다.

## 1. 개요
content-pipeline은 사용자가 입력한 주제와 출처(source)를 근거로 블로그/홈페이지용
기사 초안을 자동 생성하고, 계약 검사(Reins)와 AI 평가(Evals)를 거쳐 사용자가
최종 승인하는 콘텐츠 파이프라인이다.

## 2. 범위

### 2.1 포함 (In Scope - MVP)
- 주제 입력
- 출처 URL/메타데이터 등록 및 DB 저장
- 출처 기반 기사 초안 생성 (draft)
- 계약 검사 (`contracts/source.contract.yaml`, `contracts/article.contract.yaml`)
- AI Evals를 통한 기사 품질 평가
- 사용자 승인을 통한 reviewed 상태 전환
- 파이프라인 실행 로그 기록

### 2.2 제외 (Out of Scope - 이번 MVP)
- 이미지 생성
- 영상 생성
- Hermes Agent 연동
- 복잡한 자동화 (예약 발행, 자동 게시, 다단계 멀티 에이전트 등)
- published 상태로의 게시 흐름 (DB/타입 구조만 마련하고 동작은 구현하지 않음)

## 3. 용어 정의

| 용어 | 정의 |
|---|---|
| Topic(주제) | 사용자가 입력한 기사 주제. 출처와 기사 초안의 상위 단위 |
| Source(출처) | 기사 작성의 근거가 되는 외부 자료 (URL + 메타데이터) |
| Article(기사) | 출처를 근거로 생성된 기사 본문. draft → reviewed 상태를 가짐 |
| Contract(계약) | 각 파이프라인 단계가 만족해야 하는 조건 집합 (YAML로 정의) |
| Eval(평가) | AI를 이용한 기사 품질 평가 |
| Approval Gate(승인 게이트) | 사람의 명시적 승인 없이는 상태 전환을 막는 장치 |
| Pipeline Log | 파이프라인 각 단계의 실행 결과를 기록한 로그 (`pipeline_logs`) |
| Agent Run(에이전트 실행) | AI/에이전트(LLM) 호출 자체의 입력/출력 실행 기록 (`agent_runs`) |

## 4. 기능 요구사항 (Functional Requirements)

### FR-1. 주제 입력
사용자는 기사 주제(제목, 설명)를 입력할 수 있다.

### FR-2. 출처 등록
사용자는 주제에 대해 하나 이상의 출처(URL, 제목, 작성자, 게시일, 요약 등 메타데이터)를
등록할 수 있다.

### FR-3. 출처 저장
등록된 출처는 `sources` 테이블에 주제(topic)와 연결되어 저장된다.

### FR-4. 기사 초안 생성
시스템은 등록된 출처를 근거로 기사 초안(제목, 본문, 인용 출처 목록)을 생성한다.

### FR-5. Draft 저장
생성된 기사 초안은 반드시 `status = 'draft'`로 저장된다. 다른 상태로 직접
생성하는 것은 허용되지 않는다.

### FR-6. 최소 출처 수 검사
주제에 등록된 출처가 3개 미만이면 기사 생성을 시작하지 않고 파이프라인을 중단한다.

### FR-7. 계약 검사
- 출처 등록 이후, 기사 생성을 시작하기 전에 `source.contract.yaml`을 통과해야 한다.
- 기사 초안 생성 직후, 저장 및 AI 평가로 진행하기 전에 `article.contract.yaml`을
  통과해야 한다.
- 계약 검사를 통과하지 못하면 파이프라인은 즉시 중단되고, 위반 사유가 로그로 남는다.

### FR-8. AI Evals
`article.contract.yaml`을 통과한 기사 초안은 `evals/article-quality.eval.yaml`에
정의된 기준에 따라 AI로 품질 평가를 받는다. 평가 결과(기준별 점수, 종합 점수,
통과 여부, 코멘트)는 저장되고 사용자에게 표시된다.

### FR-9. 사용자 승인 (Human Approval)
AI 평가 결과와 무관하게, 기사 초안의 `status`를 `reviewed`(또는 향후 `published`)로
전환하는 작업은 사용자의 명시적 승인이 있어야만 수행된다. 어떤 자동화 로직도
승인 없이 상태를 전환할 수 없다.

### FR-10. 실행 로그
주제 생성, 출처 등록, 계약 검사, 기사 생성, AI 평가, 사용자 승인 등 주요
파이프라인 단계의 실행 결과는 `pipeline_logs`에 기록된다 (단계, 상태, 메시지,
상세 정보, 시각). 각 로그/실행 기록 테이블의 역할 구분은 7장을 참고한다.

### FR-11. 글쓰기 모드 선택 (Phase 2-1)
사용자는 기사 초안을 생성할 때 `article_mode`(`general_news` / `source_based_explainer` /
`monetized_blog`)를 선택할 수 있다. 선택하지 않으면 기본값 `source_based_explainer`로
동작해 기존 흐름을 그대로 유지한다. `monetized_blog`는 SEO 메타데이터
(`seo_title`, `meta_description`, `target_keyword` 등)와 광고 슬롯 marker
(`AD_SLOT_MARKERS`, 실제 광고 코드 아님), `monetization_score`, `policy_risk_score`를
함께 생성/저장한다. 모드와 무관하게 FR-5(Draft 저장), FR-9(사용자 승인)는
그대로 적용된다. 자세한 내용은 `docs/phase-2-1-article-modes.md` 참고.

### FR-12. WordPress Draft Publish (Phase 2-2)
사용자는 `status = 'reviewed'`인 기사를 WordPress에 `status="draft"`인 post로
생성할 수 있다. `approval_logs`에 승인 기록이 없거나 기사가 `reviewed` 상태가
아니면 게시하지 않는다. `WORDPRESS_PUBLISH_ENABLED=false`(기본값)이면 실제
WordPress API를 호출하지 않고 dry-run으로 처리한다. 이미 성공적으로 게시된
기사는 중복 생성하지 않는다. 자동 공개(publish)는 구현하지 않으며, WordPress
쪽 최종 공개 여부는 사람이 WordPress 관리자 화면에서 결정한다. 자세한 내용은
`docs/phase-2-2-wordpress-draft-publish.md` 참고.

### FR-13. WordPress Category, Tag, SEO Metadata (Phase 2-3)
사용자는 기사(article)에 대해 언제든지(승인 여부와 무관하게) WordPress 게시
준비용 metadata(카테고리, 태그, SEO 제목, 메타 설명, slug)를 생성할 수 있다.
metadata 생성은 실제 WordPress API를 호출하지 않는 이름 기반 규칙으로
수행되며, `WORDPRESS_PUBLISH_ENABLED` 값과 무관하게 항상 동작한다. 생성된
metadata는 사람이 검토 완료로 표시할 수 있다(`wp_metadata_status='reviewed'`).
`WORDPRESS_PUBLISH_ENABLED=true`로 실제 게시 시, 카테고리/태그 이름에
대응하는 ID가 없으면 WordPress API로 이름을 찾거나 생성한 뒤 게시 payload에
포함한다. 자세한 내용은 `docs/phase-2-3-wordpress-metadata.md` 참고.

### FR-14. SEO Plugin Metadata Mapping (Phase 2-4)
사용자는 기사에 대해 WordPress SEO plugin(`none`/`yoast`/`rank_math`/`aioseo`)별
metadata payload를 생성할 수 있다. provider는 인자 > `SEO_PLUGIN_PROVIDER`
환경변수 > `none` 순으로 결정되며, 잘못된 값은 `none`으로 대체된다. metadata
생성은 실제 plugin API를 호출하지 않으며, `WORDPRESS_PUBLISH_ENABLED`/
`SEO_PLUGIN_WRITE_ENABLED` 값과 무관하게 항상 동작한다. 생성된 payload는
사람이 검토 완료로 표시할 수 있다(`seo_plugin_metadata_status='reviewed'`).
`SEO_PLUGIN_WRITE_ENABLED=true`이고 `WORDPRESS_PUBLISH_ENABLED=true`인 경우에도
실제 plugin write는 safe stub으로 남아 있으며 항상 실패를 반환한다(커스텀
endpoint 확인 후 구현 예정). 자세한 내용은
`docs/phase-2-4-seo-plugin-metadata-mapping.md` 참고.

### FR-15. Featured Image Preparation (Phase 2-5)
사용자는 기사에 대해 승인 여부와 무관하게 대표 이미지(featured image) 준비
정보(prompt, alt text, caption, style, aspect ratio)를 생성할 수 있다.
article_mode(`general_news`/`source_based_explainer`/`monetized_blog`)별로
서로 다른 이미지 전략과 기본 스타일이 적용되며, 이미지 안에는 텍스트를
넣지 않는다는 정책이 항상 prompt에 포함된다. 실제 이미지 생성 API나
WordPress media upload는 호출하지 않는다. 생성된 정보는 사람이 검토 완료로
표시할 수 있다(`featured_image_status='reviewed'`). WordPress 게시(Phase 2-2)
dry-run details에는 featured image 요약(상태/alt text/caption/style/비율)이
포함되며, `featured_image_wordpress_media_id`가 없으면 실제 게시 시
`featured_media`를 전송하지 않는다. 자세한 내용은
`docs/phase-2-5-featured-image-preparation.md` 참고.

### FR-16. WordPress Media Upload Preparation (Phase 2-6)
사용자는 Phase 2-5에서 준비한 featured image metadata를 바탕으로 WordPress
media upload 준비 정보(payload)를 생성할 수 있다. 실제 이미지 생성이나
실제 WordPress media upload는 이번 단계에서 구현하지 않는다.
`WORDPRESS_MEDIA_UPLOAD_ENABLED`(기본값 false)가 false이면 dry-run 확인 시
실제 API를 호출하지 않고 `skipped`를 반환하며, `WORDPRESS_PUBLISH_ENABLED`가
true가 아니면 `dry_run`을 반환한다. 두 조건이 모두 충족되어도 실제 파일
업로드는 아직 구현되지 않은 safe stub이다. WordPress 게시(Phase 2-2)
dry-run details에는 featured image upload 요약(상태/소스타입/파일명/MIME
타입/featured_media 연결 여부)이 포함되며, `featured_image_wordpress_
media_id`가 없으면 실제 게시 시에도 `featured_media`를 전송하지 않는다.
자세한 내용은 `docs/phase-2-6-wordpress-media-upload-preparation.md` 참고.

### FR-17. Image Generation Integration (Phase 2-7)
사용자는 Phase 2-5에서 준비한 featured image prompt/alt text/caption/style을
바탕으로 실제 또는 mock 이미지를 생성할 수 있다. 기본 provider는 `mock`이며
(`IMAGE_GENERATION_PROVIDER=mock`), `IMAGE_GENERATION_ENABLED=false`(기본값)이면
`openai`/`custom` provider도 mock으로 안전하게 대체된다. provider가 실패하거나
예외를 던져도 시스템 전체가 Runtime Error로 터지지 않으며, 실패 시
`generated_image_status='failed'`와 오류 메시지가 저장된다. 생성 결과는
사람이 검토 완료로 표시할 수 있다(`generated_image_status='reviewed'`).
`generated_image_url`/`local_path`가 있으면 Phase 2-6의 `featured_image_
source_type`이 자동으로 `generated_url`/`local_file`로 갱신되어 WordPress
media upload 준비와 연결된다. 실제 WordPress media upload와 `featured_media`
설정은 이번 단계에서도 하지 않는다. 자세한 내용은
`docs/phase-2-7-image-generation-integration.md` 참고.

### FR-18. Actual WordPress Connection Test (Phase 2-8)
사용자는 실제 WordPress 사이트에 안전하게 연결되는지 테스트할 수 있다
(`GET /wp-json/wp/v2/users/me`, Application Password 기반 Basic Auth). 연결
테스트는 `connected` 여부, `username`/`displayName`, 실패 시 `statusCode`와
안전한(safe) 오류 메시지 및 401/403/404/5xx별 원인 후보(likely causes)를
반환하며, Authorization header나 비밀번호는 절대 반환/저장/로그하지 않는다.
`WORDPRESS_PUBLISH_ENABLED=false`(기본값)이면 기존과 동일하게 dry-run으로
동작하고, `true`이면 승인(reviewed)된 기사에 한해 실제 WordPress draft post를
생성한다 — post status는 항상 `draft`로 강제되며 공개(publish)는 절대
수행하지 않는다. 카테고리/태그는 이름 기반으로 실제 동기화를 시도하되 실패해도
draft 생성 자체를 막지 않고 경고(warning)로만 처리한다. Media upload는
`WORDPRESS_MEDIA_UPLOAD_ENABLED=true`일 때만 시도하며 기본값은 `false`다
(업로드 실패도 draft 생성을 막지 않는다). 게시 결과는 `publish_logs`에
저장되며, 상세 정보는 `details_json`에 저장하되 기사 본문 전체나 인증 정보는
절대 포함하지 않는다. 자세한 내용은
`docs/phase-2-8-actual-wordpress-connection-test.md` 참고.

### FR-19. WordPress Draft Publish Stabilization (Phase 2-9)
같은 기사에 대해 이미 성공적으로 생성된 WordPress draft 기록(`publish_logs.target
='wordpress'`, `status='success'`, `external_post_id`가 있는 기록)이 있으면
`publishArticleToWordPressDraft`는 새 draft를 생성하지 않고 기존 `external_post_id`/
`post_url`을 그대로 반환한다(`wordpress_actual_publish_skipped_duplicate` 기록).
`publish_logs.details_json`은 성공/dry-run/실패 각각 안정된 구조(`actual`/`dryRun`
플래그, 성공 시 `wordpressPostId`/`wordpressStatus`/`categoryCount`/`tagCount`/
`mediaUpload`/`seoPluginWrite` 요약, 실패 시 `statusCode`/`endpointType`/
`reasonCandidate`)로 저장되며, 기사 본문 전체나 인증 정보, WordPress 원본 오류
응답 본문은 절대 포함하지 않는다. `pipeline_logs`는 `event_name` 컬럼 기준으로
`wordpress_actual_publish_*` 이벤트를 기록한다. 이미지 업로드와 SEO plugin 실제
write는 `WORDPRESS_MEDIA_UPLOAD_ENABLED`/`SEO_PLUGIN_WRITE_ENABLED` 값과
무관하게 이번 단계에서 시도하지 않고 `skipped_deferred`로 기록한다. 자세한 내용은
`docs/phase-2-9-wordpress-draft-publish-stabilization.md` 참고.

### FR-20. WordPress Media Upload Actual Test (Phase 2-10)
`WORDPRESS_MEDIA_UPLOAD_ENABLED=true`이면 article의 featured image를 실제
WordPress Media Library(`POST /wp-json/wp/v2/media`)에 업로드할 수 있다. 이미지
source는 `generated_image_url`(생성 완료 상태) → `featured_image_source_url` →
`featured_image_local_path` 순으로 결정되며, http/https 절대 URL이 아닌
mock/상대경로 이미지는 실제 업로드 대상에서 제외되고 안전하게 skip/invalid로
처리된다. `image/jpeg`/`image/png`/`image/webp`만 허용하며, 그 외 형식은
업로드를 시도하지 않고 실패로 처리한다. 업로드 성공 후 alt text/caption을
갱신하되 이 갱신이 실패해도 업로드 성공 자체는 무효화되지 않는다(warning).
업로드 결과는 `articles.featured_image_upload_status`/
`featured_image_wordpress_media_id`/`featured_image_wordpress_url`과
`publish_logs`(target=`wordpress_media`)에 저장되며, 기사 본문·이미지
binary·인증 정보는 절대 저장하지 않는다. `pipeline_logs`는 `event_name`
컬럼 기준으로 `wordpress_media_upload_*` 이벤트를 기록한다. 자세한 내용은
`docs/phase-2-10-wordpress-media-upload-actual-test.md` 참고.

### FR-21. WordPress Featured Media Draft Publish Test (Phase 2-11)
Phase 2-10에서 업로드된 `articles.featured_image_wordpress_media_id`를
WordPress draft post의 `featured_media` 필드에 연결할 수 있다. 새 draft
생성 시에는 media id가 있으면 자동으로 포함되고(`create_draft` 모드), 이미
성공적으로 생성된 draft(`publish_logs.target='wordpress'`, `status='success'`,
`external_post_id`가 있는 기록)가 있으면 새 글을 만들지 않고 `POST /wp-json/
wp/v2/posts/{id}`로 `{status:"draft", featured_media}`만 갱신한다(`update_
existing_draft` 모드) — status는 입력값과 무관하게 항상 `draft`로 고정된다.
media id가 없으면 실제 API를 호출하지 않고 `skipped_no_media_id`로 처리하며,
기존 draft가 없으면 연결을 시도하지 않고 안내 메시지만 반환한다(중복 draft
생성 방지). 연결 결과는 `articles.wordpress_featured_media_attach_status`/
`_attached_at`/`_attach_error`와 `publish_logs`(target=`wordpress_featured_
media`)에 저장되며, 기사 본문·인증 정보·WordPress 원본 오류 응답 전체는
저장하지 않는다. `pipeline_logs`는 `event_name` 컬럼 기준으로
`wordpress_featured_media_*`/`wordpress_media_item_validation_*` 이벤트를
기록한다. 자세한 내용은
`docs/phase-2-11-wordpress-featured-media-draft-publish-test.md` 참고.

### FR-22. SEO Plugin Actual Metadata Test (Phase 2-12)
`SEO_PLUGIN_PROVIDER`(none/yoast/rank_math/aioseo 중 하나)와
`SEO_PLUGIN_WRITE_ENABLED=true`일 때, Phase 2-4에서 준비한 SEO metadata
(seo_title/meta_description/target_keyword)를 실제 WordPress draft post에
`POST /wp-json/wp/v2/posts/{id}`의 `meta` 필드로 반영을 시도할 수 있다 —
provider 하나만 선택해서 테스트하며 여러 plugin 동시 write는 하지 않는다.
status는 입력값과 무관하게 항상 `draft`로 고정된다. write 요청이 성공해도
WordPress REST API가 protected meta key를 노출하지 않으면 실제 반영 여부가
불확실할 수 있으므로, 반영 직후 `GET .../posts/{id}?context=edit`로 다시
조회해 확인하고(`verifySeoPluginMetadata`), 확인되지 않으면
`seo_plugin_actual_write_status='needs_custom_endpoint'`로 기록한다.
provider=none이거나 write가 비활성화되어 있거나 WordPress draft post가 없으면
실제 API를 호출하지 않고 각각 `skipped_provider_none`/`skipped_disabled`/
`skipped_no_wordpress_post`로 처리한다. 결과는
`articles.seo_plugin_actual_write_*` 컬럼과 `publish_logs`(target=
`wordpress_seo_plugin`)에 저장되며, 기사 본문 전체·인증 정보·WordPress
원본 오류 응답 전체는 저장하지 않는다. `pipeline_logs`는 `event_name` 컬럼
기준으로 `seo_plugin_actual_write_*` 이벤트를 기록한다. 자세한 내용은
`docs/phase-2-12-seo-plugin-actual-metadata-test.md` 참고.

### FR-23. Custom WordPress SEO Metadata Endpoint (Phase 2-13)
표준 WordPress posts REST API로 Rank Math SEO metadata 반영 여부가
확인되지 않는 문제(Phase 2-12)를 해결하기 위해, WordPress 쪽에 custom REST
endpoint(`wordpress-plugin/ai-pipeline-seo-endpoint`, `POST /wp-json/
ai-pipeline/v1/seo-meta`)를 배포하고 `update_post_meta`로 직접 저장하는
경로를 추가한다. 이 경로는 Rank Math 전용이며 Yoast/AIOSEO는 지원하지
않는다. `permission_callback`은 `'__return_true'`를 사용하지 않고
`current_user_can('edit_post', $post_id)`로 대상 글에 대한 편집 권한을
확인한다. `SEO_PLUGIN_PROVIDER=rank_math`이고 `WORDPRESS_SEO_CUSTOM_
ENDPOINT_ENABLED=true`이면 표준 REST 방식 대신 custom endpoint를 우선
사용하며, custom endpoint가 비활성화되어 있으면 표준 REST 방식을 사용하고,
custom endpoint 호출이 실패하면 표준 REST 방식으로 fallback하지 않고
실패를 그대로 저장한다. 결과는 `articles.seo_plugin_custom_endpoint_*`
컬럼과 `publish_logs`(target=`wordpress_seo_custom_endpoint`)에 저장되며,
Application Password/Authorization header/API key와 기사 본문 전체,
WordPress 원본 응답 본문 전체는 저장하지 않는다. `pipeline_logs`는
`event_name` 컬럼 기준으로 `seo_plugin_custom_endpoint_*` 이벤트를
기록한다. 자세한 내용은
`docs/phase-2-13-custom-wordpress-seo-metadata-endpoint.md`와
`docs/phase-2-13-wordpress-plugin-install.md` 참고.

### FR-24. WordPress Final Draft Payload Review (Phase 2-14)
WordPress draft post/featured media/Rank Math SEO metadata/category·tag/
출처 인용/AD_SLOT marker가 하나의 draft에 정상 반영되었는지 review
checklist(6개 항목: wordpress_draft/featured_media/seo_metadata/
category_tag/source_citation/ad_slot_marker)로 점검할 수 있다. 실제
WordPress API를 다시 호출하지 않고 이전 단계에서 이미 저장된 상태를
재집계하며, 공개(publish)는 어떤 경우에도 수행하지 않는다. WordPress draft
post가 없으면(`publish_logs.target='wordpress'`, `status='success'`,
`external_post_id`가 있는 기록이 없으면) `missing_wordpress_draft`로
처리하고 실제 점검을 시도하지 않는다. 결과는
`articles.wordpress_final_draft_review_*` 컬럼과 `publish_logs`(target=
`wordpress_final_draft_review`)에 저장되며, 기사 본문 전체·인증 정보는
저장하지 않는다. `pipeline_logs`는 `event_name` 컬럼 기준으로
`wordpress_final_draft_review_*` 이벤트를 기록한다. 자세한 내용은
`docs/phase-2-14-wordpress-final-draft-payload-review.md` 참고.

## 5. 비기능 요구사항 (Non-Functional Requirements)

### NFR-1. 타입 안정성
모든 TypeScript 코드는 strict 모드를 사용하며 `any` 타입을 사용하지 않는다.

### NFR-2. 계약 우회 금지
계약 검사를 통과하지 못한 데이터는 다음 단계로 전달되지 않는다
(DB 저장, 상태 전환이 코드 레벨에서 차단되어야 한다).

### NFR-3. 일관된 API 응답 형식
API 응답은 `{ success: true, data }` 또는 `{ success: false, error }` 형식을 따른다.

### NFR-4. 추적 가능성
모든 파이프라인 실행은 `pipeline_logs`를 통해 사후 추적이 가능해야 한다.

### NFR-5. CI 검증
모든 PR은 GitHub Actions에서 lint, typecheck, test를 통과해야 한다.

## 6. 상태 모델

### Topic 상태
```
draft → sources_ready → generating → drafted → reviewed
                                          ↘ failed (계약/평가 실패 시)
```

### Article 상태
```
draft → reviewed → published (published은 MVP 이후, 구조만 정의)
```

## 7. DB 테이블 역할 정리

`db/schema.sql`에 정의된 실제 테이블과 역할은 다음과 같다. 코드(`lib/repositories/*`)가
사용하는 테이블명/컬럼명을 기준으로 작성되었으며, 스키마 변경 시 이 표도 함께
갱신한다.

### 7.1 핵심 도메인 테이블

| 테이블 | 역할 | 사용 코드 |
|---|---|---|
| `themes` | 사용자가 입력한 기사 주제 (제목, 설명, 키워드, 언어, 상태) | `lib/repositories/theme-repository.ts` |
| `sources` | 주제별 출처 (URL, 제목, 작성자, 게시일, 요약) | `lib/repositories/source-repository.ts` |
| `articles` | 출처를 근거로 생성된 기사 초안/본문 | `lib/repositories/article-repository.ts` |
| `article_sources` | 기사가 인용한 출처의 다대다 연결 | `lib/repositories/article-repository.ts` |

### 7.2 로그/실행 기록 테이블

파이프라인 실행과 관련된 기록은 역할에 따라 다음 테이블로 분리하여 저장한다.

| 테이블 | 역할 | 사용 코드 |
|---|---|---|
| `pipeline_logs` | 대시보드 및 파이프라인 이벤트 로그 (FR-10). 상세 정보는 `details_json`(jsonb) 컬럼에 저장한다. `event`/`status`는 `LogEventType`/`LogStatus` 값을 저장하는 현재 사용 컬럼이고, `stage`/`target_type`/`target_id`는 Phase 2 오케스트레이터(`lib/harness/pipeline.ts`)를 위한 자리만 마련해 둔 컬럼이다 (현재 값 없음). `details`(jsonb)는 과거 데이터 보존을 위해 남겨둔 컬럼으로 더 이상 사용하지 않는다 | `lib/repositories/log-repository.ts` (`logEvent`/`getLogs`) |
| `contract_runs` | 계약 검사(Reins Engineering) 실행 결과 이력. `theme_id`, `target_type`, `target_id`, `contract_name`, `passed`, `violations`은 기존 사용 컬럼이고, `status`(passed로부터 산출), `source_count`(검사 시점 출처 개수), `failed_conditions`(실패한 규칙 ID 목록)는 새로 추가되어 `recordContractCheck`가 채운다. `article_id`/`stage`/`details_json`/`details`는 Phase 2를 위한 자리만 마련해 둔 컬럼이다 | `lib/repositories/log-repository.ts` (`recordContractCheck`/`getLatestContractCheck`) |
| `agent_runs` | AI/에이전트(LLM) 호출 자체의 실행 기록 (입력/출력, 성공·실패) | 스키마/타입만 정의 (Phase 2: `lib/ai/generate-article.ts`, `lib/ai/eval-article.ts`) |
| `eval_runs` | AI Evals 평가 결과 기록 (FR-8) | 스키마/타입만 정의 (Phase 2: `lib/ai/eval-article.ts`, `evals/article-quality.eval.yaml` 기준) |
| `approval_logs` | 사용자 승인(Human Approval) 이벤트 기록 (FR-9) | 스키마/타입만 정의 (MVP 이후 `lib/harness/approval-gate.ts`와 연결 예정) |
| `publish_logs` | 기사 게시(publish) 이벤트 기록 | 스키마/타입만 정의 (MVP 이후, `article.status = 'published'` 흐름과 함께 구현) |

### 7.3 DB 스키마 적용

- 신규 프로젝트: `db/schema.sql` 전체를 Supabase SQL Editor에서 실행한다.
- 기존 DB와 코드 간 schema 불일치가 발생한 경우: `db/migrations/001_align_dashboard_schema.sql`을
  실행한다. `create table if not exists` / `alter table ... add column if not exists` 형식만
  사용하므로 기존 데이터를 삭제하지 않고 여러 번 실행해도 안전하다 (idempotent).
  `sources.publisher`/`reliability_score`/`collected_at`은 Phase 2 placeholder 컬럼이며
  현재 코드는 값을 쓰지 않는다.

## 8. 관련 문서
- `docs/acceptance-criteria.md` - 기능별 성공 기준
- `docs/phase-1-plan.md` - Phase 1 구현 계획
- `contracts/*.yaml` - 단계별 계약 정의
- `evals/*.yaml` - AI 평가 기준
