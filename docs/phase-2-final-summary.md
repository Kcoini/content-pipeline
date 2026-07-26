# Phase 2 최종 요약: WordPress 기반 수익형 블로그 자동화 파이프라인 MVP

이 문서는 Phase 2(2-1 ~ 2-17)에서 구현한 WordPress 발행 파이프라인의
전체 그림을 정리한 최종 문서다. 새 기능을 추가하지 않으며, 이미 구현된
내용을 문서화한다.

## 1. Phase 2의 목적

Phase 1에서 만든 "주제 → 출처 → 기사 초안 → 승인" 파이프라인에, WordPress
기반 수익형 블로그 발행에 필요한 다음 요소를 추가하는 것이 Phase 2의
목적이다.

- 글쓰기 모드(일반 기사형 / 출처 기반 설명형 / 수익형 블로그형)
- WordPress draft post 생성과 media(대표 이미지) 업로드
- SEO plugin(Rank Math) metadata 반영
- 발행 전 다단계 품질 검증(payload review → quality gate)
- 사람의 최종 승인 없이는 공개되지 않는 안전한 공개 게시 절차

Phase 2 전체에 걸쳐 일관되게 지켜진 원칙: **자동 공개 게시 금지**,
**사람의 명시적 승인 없이는 WordPress post status를 publish로 바꾸지
않음**, **Authorization header/Application Password/API key를 로그나
화면에 저장하지 않음**, **기사 본문 전체를 details_json에 저장하지 않음**.

## 2. 전체 파이프라인 구조

```
주제 입력 → 출처 등록 → article 생성(draft)
  → article_mode 선택(general_news / source_based_explainer / monetized_blog)
  → SEO metadata 생성(제목/설명/키워드) → article 승인(status=reviewed)
  → WordPress draft post 생성 (Phase 2-2, 2-9)
  → category/tag 매핑 (Phase 2-3)
  → featured image 준비 → 이미지 생성 또는 외부 이미지 지정 (Phase 2-5, 2-7)
  → WordPress media upload (Phase 2-6, 2-10)
  → featured media를 draft post에 연결 (Phase 2-11)
  → SEO plugin metadata 매핑 → 실제 WordPress에 반영 (Phase 2-4, 2-12)
  → Rank Math custom endpoint로 SEO metadata 직접 반영 (Phase 2-13)
  → Final Draft Payload Review (Phase 2-14)
  → Publish Quality Gate (Phase 2-15)
  → Human Approval Before Public Publish (Phase 2-16)
  → WordPress Public Publish Test (Phase 2-17)
  → WordPress 관리자에서 최종 확인
```

각 단계는 `pipeline_logs`(event_name 기준)와 `publish_logs`(target 기준)에
기록되며, 실패해도 Runtime Error 없이 안전하게 처리된다.

## 3. Phase별 완료 내용 요약

| Phase | 내용 | 문서 |
|---|---|---|
| 2-1 | Article modes (general_news/source_based_explainer/monetized_blog) | `phase-2-1-article-modes.md` |
| 2-2 | WordPress draft publish (기본 흐름, dry-run 기본값) | `phase-2-2-wordpress-draft-publish.md` |
| 2-3 | Category/Tag/SEO metadata 매핑 | `phase-2-3-wordpress-metadata.md` |
| 2-4 | SEO plugin metadata mapping(REST posts meta) | `phase-2-4-seo-plugin-metadata-mapping.md` |
| 2-5 | Featured image 준비(prompt/alt/caption/style) | `phase-2-5-featured-image-preparation.md` |
| 2-6 | WordPress media upload 준비 | `phase-2-6-wordpress-media-upload-preparation.md` |
| 2-7 | 이미지 생성 연동(mock/openai/custom) | `phase-2-7-image-generation-integration.md` |
| 2-8 | WordPress 실제 연결 테스트 | `phase-2-8-actual-wordpress-connection-test.md` |
| 2-9 | WordPress draft publish 안정화(중복 방지) | `phase-2-9-wordpress-draft-publish-stabilization.md` |
| 2-10 | WordPress media upload 실제 테스트 | `phase-2-10-wordpress-media-upload-actual-test.md` |
| 2-11 | Featured media를 draft post에 연결 | `phase-2-11-wordpress-featured-media-draft-publish-test.md` |
| 2-12 | SEO plugin 실제 metadata write 테스트 | `phase-2-12-seo-plugin-actual-metadata-test.md` |
| 2-13 | Rank Math 전용 custom endpoint | `phase-2-13-custom-wordpress-seo-metadata-endpoint.md`, `phase-2-13-wordpress-plugin-install.md` |
| 2-14 | WordPress Final Draft Payload Review | `phase-2-14-wordpress-final-draft-payload-review.md` |
| 2-15 | Publish Quality Gate | `phase-2-15-publish-quality-gate.md` |
| 2-16 | Human Approval Before Public Publish | `phase-2-16-human-approval-before-public-publish.md` |
| 2-17 | WordPress Public Publish Test | `phase-2-17-wordpress-public-publish-test.md` |

## 4. WordPress draft publish 흐름

`lib/publish/publish-service.ts` → `lib/publish/wordpress-client.ts`의
`createDraftPost()`가 `POST /wp-json/wp/v2/posts`에 항상
`status: "draft"`로 요청한다. `WORDPRESS_PUBLISH_ENABLED=false`(기본값)이면
dry-run으로 처리되어 실제 API를 호출하지 않는다. 이미 성공한 draft가
있으면(`publish_logs.target='wordpress'`, `status='success'`,
`external_post_id` 존재) 중복 생성하지 않는다(Phase 2-9).

## 5. media upload 흐름

Phase 2-5에서 featured image의 prompt/alt text/caption/style을 준비하고,
Phase 2-6/2-10에서 `lib/publish/wordpress-media-upload-service.ts`가
`POST /wp-json/wp/v2/media`로 실제 업로드를 시도한다.
`WORDPRESS_MEDIA_UPLOAD_ENABLED=false`(기본값)이면 dry-run으로 처리된다.
Phase 2-7에서 이미지 자체를 mock/실제 provider로 생성할 수 있다.

## 6. featured media 연결 흐름

Phase 2-11의 `lib/publish/wordpress-featured-media-service.ts`가
업로드된 media id를 기존 WordPress draft post에
`POST /wp-json/wp/v2/posts/{id}`(`{ status: "draft", featured_media }`)로
연결한다. status는 항상 `draft`로 고정되어 이 단계에서 공개되지 않는다.

## 7. Rank Math SEO custom endpoint 흐름

Phase 2-4/2-12에서 표준 REST posts meta로 SEO plugin metadata write를
시도했으나, protected meta key(`rank_math_title` 등)가 REST에 노출되지
않아 반영되지 않는 경우가 있었다. Phase 2-13에서
`wordpress-plugin/ai-pipeline-seo-endpoint`(custom mu-plugin)를 추가로
설치해 `POST /wp-json/ai-pipeline/v1/seo-meta`로 `update_post_meta`를
직접 호출한다. `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED=true`이고
`SEO_PLUGIN_PROVIDER=rank_math`일 때만 사용된다.

## 8. final draft review 흐름

Phase 2-14의 `lib/publish/wordpress-final-draft-review-service.ts`가
WordPress draft post/featured media/SEO metadata/category·tag/출처
인용/AD_SLOT marker가 하나의 draft에 정상 반영되었는지 6개 항목
checklist로 재점검한다(실제 API를 다시 호출하지 않고 이미 저장된 상태를
재집계). 결과는 `articles.wordpress_final_draft_review_*`에 저장된다.

## 9. publish quality gate 흐름

Phase 2-15의 `lib/publish/publish-quality-gate-service.ts`가 28개
checklist 항목(A~J 카테고리: 기본 항목, WordPress draft, SEO, Rank Math
custom endpoint, category/tag, featured image, source/citation, AD_SLOT,
콘텐츠 안전성, 로깅 안전성)을 종합 점검해 점수(0~100)와 `publish_ready`
여부를 산출한다. critical severity의 `blocked` 항목이 있으면 즉시
`blocked`로 확정된다.

## 10. human approval 흐름

Phase 2-16의 `lib/publish/public-publish-approval-service.ts`가
`publish_ready=true`이고 `publish_quality_gate_status='ready_to_publish'`인
article에 대해서만 사람이 승인 버튼을 눌렀을 때 승인 상태를 저장한다.
승인 취소도 가능하다. 이 단계는 승인 상태만 저장하며 실제 공개는
수행하지 않는다.

## 11. public publish test 흐름

Phase 2-17의 `lib/publish/wordpress-public-publish-service.ts`가 승인된
article 1개에 한해 `publishWordPressPost()`로 WordPress draft post의
status를 실제 `publish`로 변경한다. guard(`checkPublicPublishGuard`)를
통과하지 못하면 WordPress API를 절대 호출하지 않으며, 이미 공개된
article은 `skipped_already_published`로 처리한다. 여러 article을 한
번에 처리하는 기능은 없다.

## 12. 현재 가능한 것

- 글쓰기 모드별 기사 생성과 SEO metadata 생성
- WordPress draft post 생성, category/tag/featured media 연결
- Rank Math SEO metadata의 실제 반영(custom endpoint 경유)
- 발행 전 다단계 검증(final draft review → quality gate)
- 사람의 명시적 승인을 거친 **개별 article 1개**의 실제 공개 게시

## 13. 아직 자동화하지 않은 것

- 자동/일괄 공개 게시 (여러 article을 한 번에 publish하는 기능 없음)
- Unpublish(공개 취소) 기능 — WordPress 관리자에서 수동으로 되돌려야 함
- Yoast/AIOSEO custom endpoint (Rank Math만 지원)
- 이미지 생성 provider 중 mock 이외의 실제 provider는 옵션으로만 존재 (기본은 mock)
- 발행 후 트래픽/성과 모니터링

## 14. 운영 전 주의사항

- `docs/environment-variables.md`, `docs/security-checklist.md`,
  `docs/phase-2-release-checklist.md`를 먼저 확인한다.
- `.env.local`은 절대 git에 커밋하지 않는다.
- 처음 공개 게시를 테스트할 때는 반드시 테스트용/비공개 WordPress
  사이트에서 먼저 검증한다.
- Publish Quality Gate가 `ready_to_publish`이고 사람이 실제로 승인
  버튼을 눌렀는지 다시 한번 확인한 뒤에만 Phase 2-17 버튼을 사용한다.

## 15. Phase 3 후보 작업

- Unpublish(공개 취소) 기능 구현
- 발행 후 성과 모니터링(조회수, 검색 유입 등) 연동
- Yoast/AIOSEO 등 다른 SEO plugin custom endpoint 지원
- 복수 WordPress 사이트/멀티 테넌트 지원
- 발행 스케줄링(예약 발행) — 여전히 사람의 승인을 전제로 설계 필요
