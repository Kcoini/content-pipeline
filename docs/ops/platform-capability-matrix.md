# 외부 게시 Capability Matrix (운영 고정본)

- 작성일: 2026-09-23 (OPS-02B)
- 목적: 이 프로젝트가 각 플랫폼에 실제로 무엇을 할 수 있는지 코드
  기준으로 재검증하고, 문서/UI가 실제 기능보다 앞서 나가지 않도록
  고정한다.
- 검증 방법: `lib/ui/publish-preparation-view-model.ts`의
  `PLATFORM_CAPABILITY`(draft/manual/copy 3종) + `lib/social/platform-adapters/*.ts`
  8개 파일의 `publish()` 구현을 전부 직접 읽어 확인했다(추측 없음).

## 결론

**이 프로젝트는 어떤 플랫폼에도 실제 외부 게시(공개 게시) API를
자동/버튼 한 번으로 호출하지 않는다.** `lib/social/platform-adapters/*.ts`
8개 어댑터(wordpress_blog/naver_blog/naver_cafe/news_article/
opinion_column/threads/x/instagram) 전부 `publish()`가
`disabledPublishResult(platform)`를 반환하도록 구현되어 있으며, 이
함수는 다음 메시지와 함께 `success: false, status: "disabled"`만
반환한다 — 실제 HTTP 요청을 만들지 않는다:

> "{platform} API 실제 게시는 이번 단계에서 비활성화되어 있습니다
> (Phase 3-21은 준비 단계까지만 지원합니다)."

유일한 예외는 **WordPress Draft 생성**(`lib/publish/wordpress-client.ts`,
`WORDPRESS_PUBLISH_ENABLED=true`일 때 실제 REST API 호출)과, 별도의
관리자 전용 **WordPress 실제 공개 게시**(`publishApprovedArticleToWordPress`,
`lib/publish/wordpress-public-publish-service.ts`) 경로다 — 이 둘은
아래 표에서 분리해서 다룬다.

## Capability 표

| 플랫폼 | capability | 실제로 가능한 일 | 실제 외부 API 게시 |
|---|---|---|---|
| wordpress_blog | `draft` | WordPress REST API로 실제 **Draft** 생성/업데이트(`WORDPRESS_PUBLISH_ENABLED=true` 필요) | **있음, 단 Draft만.** 공개 게시는 별도 관리자 전용 경로(아래 참고)에서만, 사람이 직접 클릭해야 실행됨 |
| naver_blog | `manual` | 수동 게시 준비 자료(체크리스트/export) 생성 | 없음(`naver-blog-api-publish-adapter.ts`도 disabled) |
| news_article | `manual` | 수동 게시 준비 자료 생성 | 없음 |
| opinion_column | `manual` | 수동 게시 준비 자료 생성 | 없음 |
| naver_cafe | `copy` | 게시용 본문 복사(clipboard) | 없음 |
| x | `copy` | 게시용 스레드 복사 | 없음 |
| threads | `copy` | 게시용 본문 복사 | 없음 |
| instagram | `copy` | 게시용 캡션 복사 | 없음 |

모든 "수동 게시 완료" 기록(`recordManualPostingResult` 등)은 **사용자가
외부 플랫폼에서 직접 게시를 마쳤다고 명시적으로 확인**했다는 사실만
로컬 DB에 기록한다 — 이 앱이 무언가를 실제로 게시했다는 뜻이 아니다
(governance 문서 `docs/ui-ux-governance-rules.md`의 "publish 실행/결과/완료
UX" 절 참고).

## WordPress 관리자 전용 실제 공개 게시 경로 — 안전성 재감사

`app/articles/[id]/page.tsx`의 "⚠ 관리자 전용" 이중 접힘 안에서만
노출되는 `publishApprovedArticleToWordPressAction`
(`app/articles/[id]/actions.ts:1640`)에 대해 **"접혀 있으므로
안전하다"고 가정하지 않고** server-side guard를 직접 코드로 재검증했다:

- **server-side guard 존재**: `checkPublicPublishGuard()`
  (`lib/publish/public-publish-guards.ts`)가 다음을 전부 만족해야만
  `canPublish: true`를 반환한다 — `article.status`가 reviewed/published,
  `publishReady`, `publishQualityGateStatus === "ready_to_publish"`,
  `publicPublishApprovalStatus === "approved"`, `publicPublishApproved`,
  `publishBlockedReason` 없음, WordPress draft post id 존재, 대표 이미지
  준비 완료, 아직 공개되지 않음(중복 공개 방지) — **fail-closed**(하나라도
  안 맞으면 `reasons`에 쌓이고 `canPublish=false`).
- **guard 우회 불가**: `publishApprovedArticleToWordPress()`
  (`lib/publish/wordpress-public-publish-service.ts`)는 `guard.canPublish`가
  false면 **WordPress API를 아예 호출하지 않고 반환**한다(코드 흐름상
  물리적으로 우회 경로가 없음 — `publishWordPressPost()` 호출이
  `if (!guard.canPublish) return ...` 다음에만 있다).
- **UI에서 이 action을 우회 호출할 방법 없음**: server action은
  `<form action={publishApprovedArticleToWordPressAction}>`으로만
  트리거되고, 다른 페이지/컴포넌트 어디에서도 이 action을 프로그램적으로
  호출하지 않는다(UX-06/UX-07 invariant 검사로 이미 확인됨 —
  `lib/ui/ux-invariants.test.ts`).

### 발견한 실제 gap — High로 분류

**이 프로젝트 전체에 사용자 인증/인가(authentication/authorization)
시스템이 전혀 없다.** `middleware.ts`가 존재하지 않고, `next-auth`/
`getServerSession`/Supabase Auth/세션 검사 코드가 어디에도 없음을
확인했다(전수 검색). 즉 **"누가 이 버튼을 눌렀는지"를 앱 코드 레벨에서
전혀 검증하지 않는다** — server action 자체에는 로그인/권한 검사가
없다. `checkPublicPublishGuard()`는 "이 article이 공개 게시 가능한
상태인가"만 검증할 뿐, "이 요청을 보낸 사람이 게시할 권한이 있는가"는
검증하지 않는다.

**이것은 High로 분류한다.** 단, OPS-02B의 범위 제한(새 인증 시스템
구축 금지, "새 콘텐츠 기능 개발이 아니다")에 따라 **이번 Phase에서
앱 코드로 인증을 새로 만들지 않는다.** 대신 아래를 운영 전제조건으로
고정한다:

> **배포 필수 전제조건**: 이 앱은 애플리케이션 레벨 인증이 없으므로,
> 배포 시 반드시 **호스팅/인프라 레벨 접근 제어**(예: Vercel Deployment
> Protection, reverse proxy basic auth, IP allowlist, VPN 전용 접근 등)를
> 함께 구성해야 한다. 이 전제조건 없이 공개 URL로 배포하면 누구나
> "⚠ 관리자 전용" 접힘을 열고 공개 게시 조건을 충족시킨 article에 대해
> 실제 WordPress 공개 게시를 트리거할 수 있다. `docs/ops/deployment-checklist.md`의
> "Before deploy" 체크리스트에 필수 항목으로 포함했다.

## Draft 생성 경로도 재확인

`WORDPRESS_PUBLISH_ENABLED=true`일 때만 실제 WordPress REST API가
호출된다(`process.env.WORDPRESS_PUBLISH_ENABLED === "true"` 엄격 비교,
`lib/publish/publish-service.ts`/`lib/publish/wordpress-client.ts`) —
누락/오타/false 값은 전부 안전한 방향(dry-run)으로 fallback한다(fail
closed 확인, 섹션 6). Draft 생성에도 별도의 사람 인증은 없지만, Draft는
공개되지 않는 초안이라 위 High 항목만큼 위험하지 않다 — 다만 같은
"앱 레벨 인증 없음" 전제가 적용되므로 위 배포 전제조건이 Draft 경로에도
동일하게 필요하다.
