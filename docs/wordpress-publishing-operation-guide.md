# WordPress 발행 운영 가이드

운영자가 실제로 글 하나를 처음부터 끝까지 발행할 때 따라야 할 순서다.
각 단계는 article 상세 페이지(`/articles/[id]`) 또는 관련 페이지의
버튼을 순서대로 실행하면 된다. 단계를 건너뛰면 다음 단계 버튼이
비활성화되거나 안전하게 차단(blocked)된다.

## 1. theme 생성

- **실행**: 대시보드에서 새 theme(주제) 생성 또는 트렌드 기반 자동 추출.
- **성공 기준**: `themes` 테이블에 새 행이 생성되고 `status='draft'`.
- **Supabase 확인**: `docs/phase-2-verification-sql.md`의 "articles 상태 확인" 절 참고.
- **실패 시 로그**: `pipeline_logs`에서 theme 생성 관련 이벤트 확인.

## 2. source 등록 또는 자동 수집

- **실행**: theme 상세 페이지에서 출처 URL 등록, 또는 자동 URL 후보 수집.
- **성공 기준**: 출처가 최소 3개 이상 등록됨 (`contracts/source.contract.yaml`).
- **Supabase 확인**: `select * from sources where theme_id = '<theme_id>';`
- **실패 시 로그**: `pipeline_logs`에서 `source_validation` 관련 이벤트.

## 3. article generation

- **실행**: "기사 생성" 버튼.
- **성공 기준**: `articles.status='draft'`, 본문이 비어있지 않음.
- **Supabase 확인**: `select id, status, article_mode from articles where theme_id = '<theme_id>';`
- **실패 시 로그**: `pipeline_logs`에서 `article_generation_*` 이벤트.

## 4. SEO metadata generation

- **실행**: article 상세 페이지 "WordPress metadata 생성" / "SEO plugin metadata 생성" 버튼.
- **성공 기준**: `seo_title`/`meta_description`/`slug`/`target_keyword`가 채워짐.
- **Supabase 확인**: `select seo_title, meta_description, slug, target_keyword from articles where id = '<article_id>';`
- **실패 시 로그**: `pipeline_logs`에서 `wordpress_metadata_*`/`seo_plugin_metadata_*` 이벤트.

## 5. article review/edit

- **실행**: article 상세 페이지에서 본문/메타데이터 직접 수정.
- **성공 기준**: 검토자가 내용에 만족.
- **Supabase 확인**: 해당 없음 (수동 검토).
- **실패 시 로그**: 해당 없음.

## 6. article approval

- **실행**: "승인" 버튼 → `article.status`를 `reviewed`로 전환.
- **성공 기준**: `articles.status='reviewed'`.
- **Supabase 확인**: `select status, reviewed_at, reviewed_by from articles where id = '<article_id>';`
- **실패 시 로그**: `pipeline_logs`에서 `article_approved` 이벤트.

## 7. WordPress draft 생성

- **실행**: "WordPress 초안 생성" 버튼.
- **성공 기준**: `publish_logs.target='wordpress'`, `status='success'`, `external_post_id` 존재.
- **Supabase 확인**: `docs/phase-2-verification-sql.md`의 "publish_logs 확인" 절.
- **실패 시 로그**: `pipeline_logs`에서 `wordpress_publish_*` 이벤트, `publish_logs.error_message`.

## 8. category/tag 확인

- **실행**: article 상세 페이지에서 category/tag 목록 확인 (자동 매핑됨).
- **성공 기준**: `wp_category_names`/`wp_tag_names`가 비어 있지 않음.
- **Supabase 확인**: `select wp_category_names, wp_tag_names, wp_category_ids, wp_tag_ids from articles where id = '<article_id>';`
- **실패 시 로그**: `pipeline_logs`에서 `wordpress_metadata_*` 이벤트.

## 9. featured image preparation

- **실행**: "Featured image 준비" 버튼.
- **성공 기준**: `featured_image_status='prepared'`.
- **Supabase 확인**: `select featured_image_status, featured_image_prompt from articles where id = '<article_id>';`
- **실패 시 로그**: `pipeline_logs`에서 `featured_image_*` 이벤트.

## 10. image generation 또는 external image 설정

- **실행**: "이미지 생성" 버튼(mock/실제 provider) 또는 외부 이미지 URL 직접 지정.
- **성공 기준**: `generated_image_status='generated'` 또는 외부 이미지 URL 저장됨.
- **Supabase 확인**: `select generated_image_status, generated_image_url from articles where id = '<article_id>';`
- **실패 시 로그**: `pipeline_logs`에서 `image_generation_*` 이벤트.

## 11. WordPress media upload

- **실행**: "WordPress media 업로드" 버튼.
- **성공 기준**: `featured_image_upload_status='uploaded'`, `featured_image_wordpress_media_id` 존재. 비활성 설정 시 skipped 사유 확인.
- **Supabase 확인**: `select featured_image_upload_status, featured_image_wordpress_media_id from articles where id = '<article_id>';`
- **실패 시 로그**: `pipeline_logs`에서 `wordpress_media_upload_*` 이벤트.

## 12. featured media attach

- **실행**: "Featured media 연결" 버튼.
- **성공 기준**: `wordpress_featured_media_attach_status='attached'`.
- **Supabase 확인**: `select wordpress_featured_media_attach_status from articles where id = '<article_id>';`
- **실패 시 로그**: `pipeline_logs`에서 `wordpress_featured_media_attach_*` 이벤트.

## 13. Rank Math custom endpoint로 SEO 반영

- **실행**: "Rank Math custom endpoint로 SEO 반영" 버튼 (`SEO_PLUGIN_PROVIDER=rank_math`, `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED=true` 필요).
- **성공 기준**: `seo_plugin_custom_endpoint_status='success'`, `seo_plugin_custom_endpoint_verified=true`.
- **Supabase 확인**: `docs/phase-2-verification-sql.md`의 "SEO custom endpoint 확인" 절.
- **실패 시 로그**: `pipeline_logs`에서 `seo_plugin_custom_endpoint_*` 이벤트. `docs/wordpress-custom-plugin-guide.md`의 "오류 대응" 절도 참고.

## 14. final draft payload review

- **실행**: "Final draft payload 검토 실행" 버튼.
- **성공 기준**: `wordpress_final_draft_review_status='reviewed'`, score가 높고 실패 항목이 없음(경고는 허용).
- **Supabase 확인**: `select wordpress_final_draft_review_status, wordpress_final_draft_review_score from articles where id = '<article_id>';`
- **실패 시 로그**: `pipeline_logs`에서 `wordpress_final_draft_review_*` 이벤트.

## 15. publish quality gate

- **실행**: "Publish Quality Gate 실행" 버튼.
- **성공 기준**: `publish_quality_gate_status='ready_to_publish'`, `publish_ready=true`.
- **Supabase 확인**: `docs/phase-2-verification-sql.md`의 "publish quality gate 확인" 절.
- **실패 시 로그**: `pipeline_logs`에서 `publish_quality_gate_*` 이벤트. blocked/needs_revision 사유는 `articles.publish_blocked_reason` 및 checklist 요약 확인.

## 16. human approval

- **실행**: "공개 게시 승인" 버튼 (`publish_ready=true` & `publish_quality_gate_status='ready_to_publish'` & WordPress draft post 존재 시에만 활성화).
- **성공 기준**: `public_publish_approval_status='approved'`, `public_publish_approved=true`.
- **Supabase 확인**: `docs/phase-2-verification-sql.md`의 "approval_logs 확인" 절.
- **실패 시 로그**: `pipeline_logs`에서 `public_publish_approval_*` 이벤트.

## 17. WordPress public publish test

- **실행**: "WordPress 공개 게시 테스트 실행 (실제 공개 게시)" 버튼 → confirm 대화상자 승인.
- **성공 기준**: `public_publish_status='published'`, `public_published=true`, `public_publish_url` 존재.
- **Supabase 확인**: `docs/phase-2-verification-sql.md`의 "WordPress public publish 확인" 절.
- **실패 시 로그**: `pipeline_logs`에서 `wordpress_public_publish_*` 이벤트.

## 18. WordPress 관리자에서 최종 확인

- **실행**: WordPress 관리자(`/wp-admin/edit.php`)에서 해당 글을 열어 상태가 "게시됨(Published)"인지, `public_publish_url` 링크로 실제 접속되는지 확인.
- **성공 기준**: 글이 실제로 공개되어 있고 내용/카테고리/태그/대표이미지/SEO metadata가 모두 반영되어 있음.
- **Supabase 확인**: 해당 없음 (WordPress 관리자 화면에서 직접 확인).
- **실패 시**: `docs/phase-2-17-wordpress-public-publish-test.md`의 "롤백 방법 안내" 절 참고.
