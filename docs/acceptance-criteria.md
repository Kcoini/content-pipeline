# 성공 기준 (Acceptance Criteria)

> REG Engineering: docs/requirements.md에 정의된 각 기능 요구사항(FR)에 대한
> 성공 기준을 정의한다. 구현 완료 여부는 이 문서의 체크리스트 충족 여부로 판단한다.

## AC-1. 주제 입력 (FR-1)
- [ ] 사용자는 제목(필수)과 설명(선택)을 입력해 주제를 생성할 수 있다.
- [ ] 제목이 비어있으면 생성이 거부되고 오류 메시지가 표시된다.
- [ ] 생성된 주제는 `status = 'draft'`로 `topics` 테이블에 저장된다.

## AC-2. 출처 등록 및 저장 (FR-2, FR-3)
- [ ] 사용자는 주제 상세 화면에서 출처 URL과 메타데이터(제목, 작성자, 게시일, 요약)를
      입력할 수 있다.
- [ ] `url`과 `title`은 필수 입력값이다.
- [ ] `url` 형식이 `http(s)`가 아니면 등록이 거부된다.
- [ ] 동일 주제 내에서 동일한 `url`은 중복 등록할 수 없다.
- [ ] 등록된 출처는 `sources` 테이블에 `topic_id`와 함께 저장된다.

## AC-3. 최소 출처 수 검사 (FR-6, FR-7)
- [ ] 주제에 등록된 출처가 3개 미만인 상태에서 "기사 생성"을 실행하면,
      `source.contract.yaml`의 `min-source-count` 규칙에 의해 파이프라인이 중단된다.
- [ ] 중단 사유가 `pipeline_logs`에 `stage='source_validation'`,
      `status='failed'`로 기록된다.
- [ ] 사용자에게 "출처가 3개 이상 필요합니다" 형태의 안내가 표시된다.

## AC-4. 기사 초안 생성 및 Draft 저장 (FR-4, FR-5)
- [ ] 출처가 3개 이상이고 `source.contract.yaml`을 통과하면 기사 생성이 실행된다.
- [ ] 생성된 기사는 `title`, `content`, 인용된 source id 목록(최소 3개)을 포함한다.
- [ ] 생성된 기사는 `status = 'draft'`로 `articles` 테이블에 저장되며,
      `article_sources` 테이블에 인용 관계가 저장된다.
- [ ] `article.contract.yaml`의 `initial-status-draft` 규칙을 위반하는 방식으로는
      기사를 생성할 수 없다 (코드 레벨에서 강제, draft 외 상태로 직접 insert 불가).

## AC-5. 기사 계약 검사 (FR-7)
- [ ] 생성된 기사가 `article.contract.yaml`의 모든 규칙(필수 필드, 최소 본문 길이,
      최소 인용 출처 수, 초기 status=draft)을 만족하지 못하면 해당 기사는
      저장되지 않고 파이프라인이 중단된다.
- [ ] 위반 사유(`ruleId`, `message`)가 `pipeline_logs.details`에 기록된다.

## AC-6. AI Evals (FR-8)
- [ ] `article.contract.yaml`을 통과한 기사는 `evals/article-quality.eval.yaml`에
      정의된 기준별로 평가되어 `eval_runs`에 저장된다.
- [ ] 평가 결과는 기준별 점수, 가중 평균 점수(`aggregate_score`), `passed` 여부를
      포함한다.
- [ ] 평가 결과는 통과/미통과와 무관하게 항상 사용자에게 표시된다.
- [ ] 평가를 통과하지 못해도 기사는 `draft` 상태로 유지되며, 사용자가 직접
      검토할 수 있다.

## AC-7. 사용자 승인 (FR-9)
- [ ] 기사 상세 화면에서 사용자는 "승인" 액션을 통해 `status`를 `'reviewed'`로
      전환할 수 있다.
- [ ] "승인" 액션 없이는 어떤 자동화 로직도 `status`를 `'reviewed'` 또는
      `'published'`로 변경하지 않는다 (`lib/harness/approval-gate.ts`에서 강제).
- [ ] 승인 시 `reviewed_at`, `reviewed_by`가 기록된다.
- [ ] 승인 이벤트는 `pipeline_logs`에 `stage='human_review'`, `status='succeeded'`로
      기록된다.

## AC-8. 실행 로그 (FR-10)
- [ ] 다음 각 단계는 시작/성공/실패 시점에 `pipeline_logs`에 기록된다:
      `source_validation`, `article_generation`, `article_contract_check`,
      `article_eval`, `human_review`
- [ ] 각 로그 항목은 `stage`, `status`, `message`, `details(jsonb)`, `created_at`,
      `topic_id`를 포함한다.
- [ ] 한 단계가 실패하면 이후 단계는 실행되지 않는다 (파이프라인 중단).

## AC-10. 글쓰기 모드 선택 (FR-11, Phase 2-1)
- [ ] 기사 생성 화면에서 사용자는 일반 기사형/출처 기반 설명형/수익형 블로그형 중
      하나를 선택할 수 있으며, 기본 선택은 출처 기반 설명형이다.
- [ ] `article_mode`를 지정하지 않고 생성 API를 호출하면 `source_based_explainer`로
      동작하며 기존 생성 결과와 동일하다 (회귀 없음).
- [ ] `monetized_blog`로 생성한 기사는 `seo_title`, `meta_description`,
      `target_keyword`, `ad_slots`, `monetization_score`, `policy_risk_score`가
      함께 저장된다.
- [ ] `monetized_blog` 본문에는 `<!-- AD_SLOT: ... -->` marker만 삽입되며,
      실제 AdSense 광고 코드는 어떤 모드에서도 삽입되지 않는다.
- [ ] 어떤 `article_mode`로 생성되었더라도 `status`는 `draft`로 저장되고,
      FR-9(사용자 승인) 없이는 `reviewed`로 전환되지 않는다.

## AC-11. WordPress Draft Publish (FR-12, Phase 2-2)
- [ ] `status='draft'`인 기사는 WordPress 초안 생성 버튼이 비활성화/숨김 처리된다.
- [ ] `status='reviewed'`이고 `approval_logs`에 승인 기록이 있는 기사만 WordPress에
      `status="draft"`인 post로 생성된다.
- [ ] `WORDPRESS_PUBLISH_ENABLED=false`(기본값)이면 실제 WordPress API를 호출하지
      않고 `publish_logs.status='dry_run'`으로 저장된다.
- [ ] 이미 `publish_logs.status='success'`인 기록이 있으면 동일 기사에 대해
      WordPress post를 중복 생성하지 않는다.
- [ ] WordPress API 실패 시 `publish_logs.status='failed'`와 `error_message`가
      저장되며, 화면에 실패 메시지가 표시된다.
- [ ] WordPress API 성공 시 `publish_logs.status='success'`, `external_post_id`,
      `post_url`이 저장되며, 화면에 post_url이 표시된다.
- [ ] `WORDPRESS_APP_PASSWORD`는 client bundle에 포함되지 않으며, 로그에도
      남지 않는다.

## AC-12. WordPress Category, Tag, SEO Metadata (FR-13, Phase 2-3)
- [ ] article이 존재하면 승인(reviewed) 여부와 무관하게 WordPress metadata를
      생성할 수 있다.
- [ ] `monetized_blog`는 `seo_title`, `meta_description`, `target_keyword`,
      카테고리, 태그가 생성된다.
- [ ] `general_news`는 간단한 카테고리(1~2개)/태그(3~5개)가 생성된다.
- [ ] `source_based_explainer`는 설명형 metadata(태그 5~8개)가 생성된다.
- [ ] slug는 안전하게 생성되며(특수문자 제거, 최대 길이 제한), 비어있으면
      article id 기반 fallback을 사용한다.
- [ ] `WORDPRESS_PUBLISH_ENABLED=false`이면 metadata 생성 시 WordPress
      category/tag API를 호출하지 않는다.
- [ ] dry-run publish의 `publish_logs.details`에 카테고리/태그 이름이
      포함된다.
- [ ] 실제 WordPress API key가 없어도 `npm run test`/`npm run build`가
      실패하지 않는다.
- [ ] 기존 WordPress draft publish(Phase 2-2), article generation,
      review/approval 흐름이 깨지지 않는다.

## AC-13. SEO Plugin Metadata Mapping (FR-14, Phase 2-4)
- [ ] `SEO_PLUGIN_PROVIDER` 기본값은 `none`이다.
- [ ] 잘못된 provider 값이면 `none`으로 fallback한다.
- [ ] `none` mapper는 plugin 전용 write 대상(`rawPluginMeta`)을 만들지 않는다.
- [ ] `yoast`/`rank_math`/`aioseo` mapper는 각각 해당 plugin용 `rawPluginMeta`
      후보를 만든다.
- [ ] `generateSeoPluginPayload`는 결과를 `articles.seo_plugin_payload`/
      `seo_plugin_provider`/`seo_plugin_metadata_status`에 저장한다.
- [ ] `SEO_PLUGIN_WRITE_ENABLED=false`이면 실제 plugin write를 시도하지 않는다.
- [ ] WordPress dry-run의 `publish_logs.details`에 SEO plugin payload 요약
      (provider/seoTitle/focusKeyword)이 포함된다.
- [ ] 실제 WordPress/plugin 연결 정보가 없어도 `npm run lint`/`test`/`build`가
      통과한다.
- [ ] 기존 WordPress draft publish(Phase 2-2), WordPress metadata(Phase 2-3),
      article generation, review/approval 흐름이 깨지지 않는다.

## AC-14. Featured Image Preparation (FR-15, Phase 2-5)
- [ ] article이 존재하면 승인(reviewed) 여부와 무관하게 featured image 정보를
      준비할 수 있다.
- [ ] `general_news`/`source_based_explainer`/`monetized_blog` 각각 모드에
      맞는 이미지 prompt/style이 생성된다.
- [ ] alt text와 caption이 생성된다.
- [ ] 생성된 prompt에는 이미지 안에 텍스트를 넣으라는 지시가 포함되지 않으며,
      오히려 "no text in image" 지시가 포함된다.
- [ ] 실제 이미지 생성 API나 WordPress media upload를 호출하지 않는다.
- [ ] WordPress dry-run의 `publish_logs.details`에 featured image 요약
      (status/altText/caption/style/aspectRatio)이 포함된다.
- [ ] `featured_image_wordpress_media_id`가 없으면 실제 게시 시에도
      `featured_media`를 전송하지 않는다.
- [ ] 실제 API key가 없어도 `npm run lint`/`test`/`build`가 통과한다.
- [ ] 기존 WordPress draft publish, SEO metadata, SEO plugin metadata,
      article generation, review/approval 흐름이 깨지지 않는다.

## AC-15. WordPress Media Upload Preparation (FR-16, Phase 2-6)
- [ ] article에서 WordPress media upload payload를 준비할 수 있다.
- [ ] featured_image_alt_text와 caption이 payload에 포함된다.
- [ ] filename이 slug 기반으로 생성된다.
- [ ] slug가 없으면 article id 기반 fallback filename이 생성된다.
- [ ] `WORDPRESS_MEDIA_UPLOAD_ENABLED=false`(기본값)이면 dry-run 확인 시
      실제 upload를 호출하지 않는다.
- [ ] `WORDPRESS_PUBLISH_ENABLED=false`이면 실제 upload를 호출하지 않는다.
- [ ] WordPress dry-run publish의 `publish_logs.details`에
      `featuredImageUpload` 요약이 포함된다.
- [ ] `featured_image_wordpress_media_id`가 없으면 실제 게시 시에도
      `featured_media`를 전송하지 않는다.
- [ ] `featured_image_wordpress_media_id`가 있으면 `featured_media`로 보낼
      수 있는 payload 구조가 만들어진다.
- [ ] 실제 API key가 없어도 `npm run lint`/`test`/`build`가 통과한다.
- [ ] 기존 WordPress draft publish 흐름이 깨지지 않는다.

## AC-16. Image Generation Integration (FR-17, Phase 2-7)
- [ ] article에서 image generation request를 만들 수 있다.
- [ ] mock provider가 `generated` 상태와 mock URL을 반환한다.
- [ ] `IMAGE_GENERATION_ENABLED=false`이면 mock 또는 disabled-safe path가
      동작하며 실제 API를 호출하지 않는다.
- [ ] `featured_image_prompt`가 request로 반영된다.
- [ ] negative prompt(text overlay, watermark, logo 등)가 포함된다.
- [ ] 생성 성공 시 `articles.generated_image_*` 필드가 저장된다.
- [ ] 생성 실패 시 `generated_image_status='failed'`가 저장되며, provider가
      예외를 던져도 Runtime Error로 시스템이 터지지 않는다.
- [ ] article 상세 UI에 generated image 상태와 미리보기가 표시된다.
- [ ] generated image가 있으면 WordPress media upload preparation과 연결
      가능한 payload(`featured_image_source_type='generated_url'` 등)가
      만들어진다.
- [ ] 기존 WordPress draft publish, featured image preparation 흐름이
      깨지지 않는다.
- [ ] 실제 API key가 없어도 `npm run lint`/`test`/`build`가 통과한다.

## AC-17. Actual WordPress Connection Test (FR-18, Phase 2-8)
- [ ] `WORDPRESS_BASE_URL`/`WORDPRESS_USERNAME`/`WORDPRESS_APP_PASSWORD`가
      설정되어 있으면 `GET /wp-json/wp/v2/users/me`로 실제 연결을 테스트할 수
      있다.
- [ ] 연결 테스트 결과에 Authorization header, 비밀번호가 절대 포함되지 않는다.
- [ ] 연결 실패 시 401/403/404/5xx에 대한 안전한 오류 메시지와 원인 후보가
      표시된다.
- [ ] Application Password가 없으면 실제 API를 호출하지 않고 안전하게
      실패를 반환한다.
- [ ] `WORDPRESS_PUBLISH_ENABLED=false`(기본값)이면 기존과 동일하게 dry-run
      으로 동작하고 실제 fetch가 호출되지 않는다.
- [ ] `WORDPRESS_PUBLISH_ENABLED=true`이면 승인(reviewed)된 기사만 실제
      WordPress draft post를 생성하며, 생성된 post의 status는 항상 `draft`다
      (입력값과 무관하게 강제된다).
- [ ] category/tag 동기화가 실패해도 draft 생성 자체는 계속 진행되며 warning
      으로 기록된다.
- [ ] 동기화에 성공한 category/tag id는 `articles.wp_category_ids`/
      `wp_tag_ids`에 저장된다.
- [ ] `WORDPRESS_MEDIA_UPLOAD_ENABLED=false`(기본값)이면 실제 media upload를
      시도하지 않는다.
- [ ] `WORDPRESS_MEDIA_UPLOAD_ENABLED=true`이고 생성된 이미지가 있으면 업로드를
      시도하며, 업로드 실패는 draft 생성 자체를 막지 않는다.
- [ ] 게시 성공/실패 결과가 `publish_logs`에 저장되며 `details_json`에 기사
      본문 전체가 저장되지 않는다.
- [ ] `pipeline_logs`에 `wordpress_connection_test_*`,
      `wordpress_actual_publish_*`, `wordpress_category_sync_*`,
      `wordpress_tag_sync_*`, `wordpress_media_upload_*` 이벤트가 기록된다.
- [ ] article 상세 페이지에 WordPress Connection Test 섹션(base URL,
      publish/media upload enabled 여부, 연결 상태, safe error message)과
      "WordPress 연결 테스트" 버튼이 표시된다. "공개 게시" 버튼은 존재하지 않는다.
- [ ] 기존 dry-run 흐름과 테스트가 계속 통과한다.
- [ ] 실제 WordPress 값이 없어도 `npm run lint`/`test`/`build`가 통과한다.

## AC-18. WordPress Draft Publish Stabilization (FR-19, Phase 2-9)
- [ ] 이미 success + external_post_id가 있는 publish_logs 기록이 있으면 새 draft를
      생성하지 않고(`createDraftPost` 미호출) 기존 결과를 반환한다.
- [ ] duplicate skip 시 `wordpress_actual_publish_skipped_duplicate`가 기록된다.
- [ ] article.status가 reviewed가 아니면 actual publish가 차단되고
      `wordpress_actual_publish_skipped_not_reviewed`가 기록된다.
- [ ] `WORDPRESS_PUBLISH_ENABLED=false`이면 dry_run으로 저장되고 실제 API가
      호출되지 않는다.
- [ ] `WORDPRESS_PUBLISH_ENABLED=true`이고 필수 env가 없으면 failed로 저장된다.
- [ ] actual publish 성공 시 status=success, external_post_id, post_url이
      저장된다.
- [ ] WordPress에 전송되는 post status는 입력값과 무관하게 항상 draft다.
- [ ] category/tag 동기화 실패는 warning으로 처리되고 draft 생성은 계속된다.
- [ ] media upload는 `WORDPRESS_MEDIA_UPLOAD_ENABLED` 값과 무관하게 이번 단계에서
      `skipped_deferred`로 처리된다.
- [ ] SEO plugin write는 `SEO_PLUGIN_WRITE_ENABLED` 값과 무관하게 이번 단계에서
      `skipped_deferred`로 처리된다.
- [ ] `publish_logs.details_json`에 기사 본문 전체나 인증 정보가 저장되지 않는다.
- [ ] `pipeline_logs`는 `event_name` 컬럼 기준으로 기록된다.
- [ ] article 상세 페이지에 publish enabled 상태, 현재 모드, media upload/SEO
      plugin write deferred 표시, duplicate 안내, post_url 링크가 표시된다.
      "공개 게시" 버튼은 존재하지 않는다.
- [ ] `npm run lint`/`test`/`build`가 모두 통과한다.

## AC-19. WordPress Media Upload Actual Test (FR-20, Phase 2-10)
- [ ] `WORDPRESS_MEDIA_UPLOAD_ENABLED=false`이면 실제 업로드를 호출하지 않고
      skipped로 처리한다.
- [ ] 업로드할 이미지 source가 없으면(sourceType=none) skipped_no_source로
      처리한다.
- [ ] mock URL 또는 상대경로 이미지는 실제 업로드하지 않고 안전하게
      차단한다(fetch 미호출).
- [ ] `featured_image_source_url`이 http/https이면 external_url로 다운로드
      대상으로 처리한다.
- [ ] 허용되지 않는 MIME type(jpeg/png/webp 외)은 실제 fetch 없이 failed로
      처리한다.
- [ ] 업로드 성공 시 `articles.featured_image_wordpress_media_id`/
      `featured_image_wordpress_url`/`featured_image_source_type='uploaded'`가
      저장된다.
- [ ] `publish_logs`에 target=`wordpress_media`, status=`success`로 저장된다.
- [ ] media metadata(alt text/caption) 업데이트 실패는 업로드 success를
      failed로 바꾸지 않는다(warning 처리).
- [ ] Authorization header/Application Password/API key가 로그에 저장되지
      않는다.
- [ ] 이미지 binary가 로그에 저장되지 않는다.
- [ ] `pipeline_logs`는 `event_name` 컬럼 기준으로 저장된다.
- [ ] 기존 WordPress draft publish 흐름(Phase 2-9)이 깨지지 않는다.
- [ ] `npm run lint`/`test`/`build`가 모두 통과한다.

## AC-20. WordPress Featured Media Draft Publish Test (FR-21, Phase 2-11)
- [ ] media id가 없으면 새 draft/기존 draft 어느 쪽에도 `featured_media`를
      보내지 않는다.
- [ ] media id가 없으면 `articles.wordpress_featured_media_attach_status=
      'skipped_no_media_id'`로 저장되고 실제 API가 호출되지 않는다.
- [ ] media id가 있으면 새 draft 생성 시 post payload에 `featured_media`가
      포함된다.
- [ ] 이미 성공한 draft(external_post_id 존재)가 있으면 새 post를 만들지 않고
      `updateDraftFeaturedMedia`를 호출한다.
- [ ] `updateDraftFeaturedMedia`는 `status`를 항상 `"draft"`로 고정해 전송한다.
- [ ] featured_media 업데이트 성공 시 `articles.wordpress_featured_media_
      attach_status='attached'`가 저장된다.
- [ ] 실패 시 safe error message가 저장되고(`statusCode`/`reasonCandidate`),
      원본 응답 본문 전체나 인증 정보는 저장되지 않는다.
- [ ] Authorization header/Application Password/API key가 로그에 저장되지
      않는다.
- [ ] 기사 본문 전체가 `publish_logs.details_json`에 저장되지 않는다.
- [ ] `pipeline_logs`는 `event_name` 컬럼 기준으로 저장된다.
- [ ] 기존 WordPress draft publish 흐름(Phase 2-9/2-10)이 깨지지 않는다.
- [ ] article 상세 페이지에 media id/media url/attach status/attempted at/
      기존 post id/post_url이 표시되고, "대표 이미지 초안 글에 연결"/"상태
      다시 확인" 버튼이 제공된다. "공개 게시" 버튼은 존재하지 않는다.
- [ ] `npm run lint`/`test`/`build`가 모두 통과한다.

## AC-21. SEO Plugin Actual Metadata Test (FR-22, Phase 2-12)
- [ ] `SEO_PLUGIN_WRITE_ENABLED=false`이면 실제 write를 호출하지 않고
      `skipped_disabled`로 저장된다.
- [ ] `SEO_PLUGIN_PROVIDER=none`이면 실제 write를 호출하지 않고
      `skipped_provider_none`으로 저장된다.
- [ ] WordPress draft post id가 없으면 `skipped_no_wordpress_post`로
      저장된다.
- [ ] rank_math/yoast/aioseo provider는 각각 올바른 post meta key로 payload를
      만든다.
- [ ] update payload는 `status`를 항상 `"draft"`로 고정한다.
- [ ] 성공 시 `articles.seo_plugin_actual_write_status='success'`가
      저장된다.
- [ ] REST response에서 meta 확인이 안 되면 `needs_custom_endpoint`로
      처리되고 warning이 저장된다.
- [ ] 실패 시 safe error message(`statusCode`/`reasonCandidate`)가 저장되고
      원본 응답 본문 전체나 인증 정보는 저장되지 않는다.
- [ ] Authorization header/Application Password/API key가 로그에 저장되지
      않는다.
- [ ] 기사 본문 전체가 `publish_logs.details_json`에 저장되지 않는다.
- [ ] `pipeline_logs`는 `event_name` 컬럼 기준으로 저장된다.
- [ ] 기존 WordPress draft publish 흐름(Phase 2-9~2-11)이 깨지지 않는다.
- [ ] article 상세 페이지에 provider/write enabled 상태, write status,
      verified, warning, WordPress post id, 마지막 시도 시간이 표시되고
      "SEO plugin metadata 실제 반영 테스트"/"반영 상태 확인" 버튼이
      제공된다. provider=none이면 버튼이 비활성화된다. "공개 게시" 버튼은
      존재하지 않는다.
- [ ] `npm run lint`/`test`/`build`가 모두 통과한다.

## AC-22. Custom WordPress SEO Metadata Endpoint (FR-23, Phase 2-13)
- [ ] custom endpoint가 비활성화되어 있으면(`WORDPRESS_SEO_CUSTOM_ENDPOINT_
      ENABLED=false`) 실제 호출 없이 `skipped_disabled`로 저장된다.
- [ ] provider가 rank_math가 아니면 실제 호출 없이
      `skipped_provider_not_supported`로 저장된다.
- [ ] WordPress draft post id가 없으면 `skipped_no_wordpress_post`로
      저장된다.
- [ ] rank_math custom endpoint payload(`postId`/`provider`/`seoTitle`/
      `metaDescription`/`focusKeyword`/`secondaryKeywords`)가 올바르게
      생성된다.
- [ ] custom endpoint 성공 시 `articles.seo_plugin_custom_endpoint_status
      ='success'`가 저장된다.
- [ ] custom endpoint 성공 시 `seo_plugin_actual_write_verified=true`가
      저장된다.
- [ ] custom endpoint 실패 시 safe error(`statusCode`/`reasonCandidate`)가
      저장되고 표준 REST 방식으로 fallback하지 않는다.
- [ ] `publish_logs`에 `target='wordpress_seo_custom_endpoint'`로 저장된다.
- [ ] `pipeline_logs`는 `event_name` 컬럼 기준으로 저장된다.
- [ ] Authorization header/Application Password/API key가 로그에 저장되지
      않는다.
- [ ] 기사 본문 전체가 `publish_logs.details_json`에 저장되지 않는다.
- [ ] 기존 WordPress draft publish 흐름(Phase 2-9~2-12)이 깨지지 않는다.
- [ ] WordPress plugin의 `permission_callback`이 `current_user_can(
      'edit_post', $post_id)`로 권한을 확인하며 `'__return_true'`를
      사용하지 않는다.
- [ ] article 상세 페이지에 provider/custom endpoint enabled/path, custom
      endpoint status/verified/error, WordPress post id가 표시되고
      "Rank Math custom endpoint로 SEO 반영"/"반영 상태 확인" 버튼이
      제공된다. provider가 rank_math가 아니면 버튼이 비활성화된다.
      "공개 게시" 버튼은 존재하지 않는다.
- [ ] `npm run lint`/`test`/`build`가 모두 통과한다.

## AC-23. WordPress Final Draft Payload Review (FR-24, Phase 2-14)
- [ ] WordPress draft post가 없으면 `missing_wordpress_draft`로 저장되고
      실제 점검을 시도하지 않는다.
- [ ] 모든 checklist 항목을 통과하면 score=100으로 저장된다.
- [ ] category/tag가 없으면 `category_tag` 항목이 failed로 기록된다.
- [ ] 출처 인용이 3개 미만이면 `source_citation` 항목이 failed로 기록된다.
- [ ] monetized_blog에서 AD_SLOT marker가 누락되면 `ad_slot_marker` 항목이
      failed로 기록된다.
- [ ] SEO metadata 반영이 확인되지 않으면 `seo_metadata` 항목이 failed로
      기록된다.
- [ ] `publish_logs`에 `target='wordpress_final_draft_review'`로 저장된다.
- [ ] `pipeline_logs`는 `event_name` 컬럼 기준으로 저장된다.
- [ ] Authorization header/Application Password/API key가 로그에 저장되지
      않는다.
- [ ] 기사 본문 전체가 `publish_logs.details_json`/`articles.wordpress_
      final_draft_review_summary`에 저장되지 않는다.
- [ ] 실행 중 예외가 발생해도 Runtime Error로 터지지 않고 안전한 실패를
      반환한다.
- [ ] article 상세 페이지에 score/마지막 검토 시간/항목별 결과가 표시되고
      "Final draft payload 검토 실행"/"검토 상태 확인" 버튼이 제공된다.
      "공개 게시" 버튼은 존재하지 않는다.
- [ ] `npm run lint`/`test`/`build`가 모두 통과한다.

## AC-24. Publish Quality Gate (FR-25, Phase 2-15)
- [ ] target_keyword가 없으면 `target_keyword_present` 항목이 blocked로
      기록되고 전체 상태가 blocked가 된다.
- [ ] 인용 출처가 없으면 `source_citation_exists` 항목이 blocked로 기록된다.
- [ ] WordPress draft post id가 없으면 `wordpress_draft_exists` 항목이
      blocked로 기록된다.
- [ ] article.status가 reviewed/published가 아니면 `status_reviewed` 항목이
      blocked로 기록된다.
- [ ] monetized_blog에서 SEO title/meta description이 없으면 blocked 또는
      fail로 기록된다.
- [ ] Rank Math custom endpoint가 success/verified면 `seo_metadata_custom_
      endpoint` 항목이 pass로 기록된다.
- [ ] monetized_blog에서 featured image가 없으면 `featured_image_present`
      항목이 fail로 기록된다.
- [ ] monetized_blog에서 AD_SLOT marker가 누락되면 warning으로 기록된다.
- [ ] 광고 클릭 유도/수익 보장성 문구가 있으면 blocked로 처리된다.
- [ ] score가 85 이상이고 fail 항목이 없으면 ready_to_publish가 된다.
- [ ] `publish_ready`는 ready_to_publish 상태일 때만 true다.
- [ ] 기사 본문 전체가 `publish_logs.details_json`/`articles.publish_
      quality_gate_summary`에 저장되지 않는다.
- [ ] Authorization header/Application Password/Basic Auth 문자열/API key가
      로그에 저장되지 않는다.
- [ ] `pipeline_logs`는 `event_name` 컬럼 기준(`publish_quality_gate_*`)으로
      저장된다.
- [ ] `publish_logs`에 `target='publish_quality_gate'`로 저장된다.
- [ ] 실행 중 예외가 발생해도 Runtime Error로 터지지 않고 안전한 실패를
      반환한다.
- [ ] article 상세 페이지에 게이트 상태/score/publish_ready/차단 사유/
      checklist 전체가 표시되고 "Publish Quality Gate 실행"/"결과 새로고침"
      버튼이 제공된다. 공개 게시 버튼은 존재하지 않으며, publish_ready=true
      여도 실제 공개는 수행되지 않고 안내 문구만 표시된다.
- [ ] `npm run lint`/`test`/`build`가 모두 통과한다.

## AC-25. Human Approval Before Public Publish (FR-26, Phase 2-16)
- [ ] `publish_ready=false`이면 승인이 불가하다.
- [ ] `publish_quality_gate_status`가 `ready_to_publish`가 아니면 승인이
      불가하다.
- [ ] WordPress draft post id가 없으면 승인이 불가하다.
- [ ] 조건 충족 시 `public_publish_approval_status='approved'`로 저장된다.
- [ ] 승인 성공 시 `public_publish_approved=true`가 된다.
- [ ] 승인 성공 시 `approval_logs`에 `action='public_publish_approved'`로
      기록된다.
- [ ] 승인 성공 시 `publish_logs`에 `target='public_publish_approval'`로
      저장된다.
- [ ] 이미 승인된 상태에서 재승인을 시도하면 duplicate로 처리되고
      `articles`는 갱신되지 않는다.
- [ ] 승인 취소 시 `public_publish_approval_status='revoked'`,
      `public_publish_approved=false`로 저장된다.
- [ ] `assertCanPublicPublish()`는 승인 전에는 실패한다.
- [ ] `assertCanPublicPublish()`는 승인 후(모든 조건 충족 시)에는 통과한다.
- [ ] 이번 단계는 어떤 경로로도 실제 공개 publish를 실행하지 않는다.
- [ ] Authorization header/Application Password/Basic Auth 문자열/API key가
      로그에 저장되지 않는다.
- [ ] 기사 본문 전체가 `publish_logs.details_json`/
      `articles.public_publish_approval_notes`에 저장되지 않는다.
- [ ] `pipeline_logs`는 `event_name` 컬럼 기준(`public_publish_approval_*`)으로
      저장된다.
- [ ] 실행 중 예외가 발생해도 Runtime Error로 터지지 않고 안전한 실패를
      반환한다.
- [ ] article 상세 페이지에 Quality Gate 상태/publish_ready/승인 상태/
      승인 시각/승인자/메모/오류/WordPress draft post id·URL이 표시되고
      "공개 게시 승인"/"공개 게시 승인 취소"/"승인 상태 새로고침" 버튼이
      제공된다. 실제 "공개 게시" 버튼은 존재하지 않는다.
- [ ] `npm run lint`/`test`/`build`가 모두 통과한다.

## AC-26. WordPress Public Publish Test (FR-27, Phase 2-17)
- [ ] `publish_ready=false`이면 WordPress API를 호출하지 않고 blocked
      처리한다.
- [ ] `publish_quality_gate_status`가 `ready_to_publish`가 아니면 blocked
      처리한다.
- [ ] `public_publish_approval_status`가 `approved`가 아니면 blocked
      처리한다.
- [ ] `public_publish_approved=false`이면 blocked 처리한다.
- [ ] WordPress draft post id가 없으면 blocked 처리한다.
- [ ] guard를 통과한 경우에만 `publishWordPressPost`가 호출된다.
- [ ] `publishWordPressPost`의 payload는 `status='publish'`만 포함한다.
- [ ] 성공 시 `articles.public_publish_status='published'`로 저장된다.
- [ ] 성공 시 `public_published=true`가 된다.
- [ ] 성공 시 `public_publish_url`이 저장된다.
- [ ] 이미 published된 기사는 `skipped_already_published`로 처리되고
      WordPress API를 다시 호출하지 않는다.
- [ ] 실패 시 안전한 오류 메시지가 저장된다.
- [ ] `publish_logs`에 `target='wordpress_public_publish'`로 저장된다.
- [ ] `pipeline_logs`는 `event_name` 컬럼 기준으로 저장된다.
- [ ] Authorization header/Application Password/Basic Auth 문자열/API key가
      로그에 저장되지 않는다.
- [ ] 기사 본문 전체가 `publish_logs.details_json`에 저장되지 않는다.
- [ ] 공개 게시는 단일 article에 대해서만 실행되며 일괄 publish 기능은
      존재하지 않는다.
- [ ] `npm run lint`/`test`/`build`가 모두 통과한다.

## AC-27. Manual Featured Image Source Setup (FR-28, Phase 2-19)
- [ ] external_url이 http/https가 아니면 거부한다.
- [ ] `/mock/...` 상대경로 URL은 external_url로 저장하지 않는다.
- [ ] jpg/png/webp MIME type은 허용한다.
- [ ] local_upload 저장 시 `featured_image_upload_status='prepared'`가 된다.
- [ ] external_url 저장 시 `featured_image_upload_status='prepared'`가 된다.
- [ ] wordpress_media_existing 저장 시 `featured_image_upload_status='uploaded'`가 된다.
- [ ] wordpress_media_existing 저장 시 media id가 필수다 (없으면 거부).
- [ ] monetized_blog에서 이미지 source가 없으면 Publish Quality Gate가
      `featured_image_present`를 fail로 기록한다.
- [ ] 이미지 source가 prepared 상태(업로드 전)이면 Publish Quality Gate가
      `featured_image_present`를 warning으로 기록한다.
- [ ] `featured_image_wordpress_media_id`가 있으면 Publish Quality Gate가
      `featured_image_present`를 pass로 기록한다.
- [ ] auth 정보(Authorization header/Application Password/API key)가
      로그에 저장되지 않는다.
- [ ] image binary가 로그(`publish_logs.details_json`/`pipeline_logs.details_json`)에
      저장되지 않는다.
- [ ] `pipeline_logs`는 `event_name` 컬럼 기준으로 저장된다.
- [ ] article 상세 페이지에 로컬 업로드/외부 URL/기존 media id 지정 UI와
      저작권 안내 문구가 표시된다.
- [ ] `npm run lint`/`test`/`build`가 모두 통과한다.

## AC-9. CI/CD
- [ ] `main` 브랜치로의 PR 생성 시 GitHub Actions가 lint, typecheck, test를
      자동 실행한다.
- [ ] 위 검사 중 하나라도 실패하면 PR을 머지할 수 없다 (브랜치 보호 규칙 권장).
