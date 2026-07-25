# Phase 2-2: WordPress Draft Publish

## 목적

사람이 검토하고 승인(`status = 'reviewed'`)한 기사만 WordPress에 **draft(초안) post**로
생성할 수 있게 한다. 자동 공개(publish)는 이번 단계에서 구현하지 않으며,
WordPress 쪽 최종 검토/공개 여부는 항상 사람이 WordPress 관리자 화면에서 직접
결정한다.

## WordPress draft publish 흐름

```
/articles/[id] (status=reviewed)
  → "WordPress 초안 생성" 버튼 클릭
  → publishToWordPressDraftAction (서버 액션)
  → lib/publish/publish-service.ts: publishArticleToWordPressDraft(articleId)
      1. article 조회 (없으면 실패 반환)
      2. article.status === 'reviewed' 확인
      3. article.content가 비어있지 않은지 확인
      4. approval_logs에 해당 article_id 승인 기록이 있는지 확인
      5. 이미 WordPress success publish_logs가 있으면 중복 생성 방지 (성공으로 응답)
      6. WORDPRESS_PUBLISH_ENABLED=false → dry-run publish_logs 저장 후 종료
      7. WORDPRESS_PUBLISH_ENABLED=true  → lib/publish/wordpress-client.ts로 실제 API 호출
      8. 성공/실패 결과를 publish_logs에 저장, pipeline_logs에 이벤트 기록
  → revalidatePath(`/articles/${articleId}`)
  → /articles/[id]에서 최신 게시 상태 표시
```

WordPress에는 항상 `status: "draft"`로 전송한다 — 이 값은 코드에서 고정되며,
어떤 입력값으로도 변경할 수 없다 (`lib/publish/wordpress-client.ts`의
`createDraftPost` 참고).

## Application Password 생성 방법

1. WordPress 관리자 화면 로그인 → **사용자 → 프로필**
2. 하단 **Application Passwords** 섹션에서 이름(예: `content-pipeline`) 입력 후
   **Add New Application Password** 클릭
3. 발급된 비밀번호를 복사한다 (다시 확인할 수 없으므로 즉시 `.env.local`에 저장)
4. `.env.local`에 아래 값을 채운다 (`.env.local`은 절대 커밋하지 않는다):

```
WORDPRESS_BASE_URL=https://your-wordpress-site.example.com
WORDPRESS_USERNAME=your-wp-username
WORDPRESS_APP_PASSWORD=발급받은-application-password
WORDPRESS_PUBLISH_ENABLED=true
```

- Application Password는 일반 로그인 비밀번호와 다른, WordPress REST API 전용
  자격 증명이다. 유출되어도 사이트 관리자 화면에서 즉시 폐기(revoke)할 수 있다.
- `WORDPRESS_APP_PASSWORD`는 `NEXT_PUBLIC_` 접두사를 사용하지 않으므로 브라우저
  번들에 포함되지 않는다. `lib/publish/wordpress-client.ts`는 Server Action에서만
  import되는 서버 전용 파일이다.

## 필요한 환경변수

| 변수 | 설명 | 기본값 |
|---|---|---|
| `WORDPRESS_BASE_URL` | WordPress 사이트 URL (예: `https://blog.example.com`) | (없음) |
| `WORDPRESS_USERNAME` | WordPress 계정 사용자명 | (없음) |
| `WORDPRESS_APP_PASSWORD` | Application Password | (없음) |
| `WORDPRESS_PUBLISH_ENABLED` | `true`면 실제 API 호출, `false`면 dry-run | `false` |

## dry-run mode 설명

`WORDPRESS_PUBLISH_ENABLED=false`(기본값)이면 `lib/publish/wordpress-client.ts`의
`createDraftPost`는 전혀 호출되지 않는다. 대신 `publish_logs`에
`status = 'dry_run'`인 로그를 저장하고, `details`에는 다음 정보만 저장한다
(본문 전체는 저장하지 않는다):

```json
{
  "title": "WordPress에 전송될 제목",
  "articleId": "...",
  "articleMode": "monetized_blog",
  "wouldPublishTo": "wordpress"
}
```

`/articles/[id]` 화면에는 "dry-run 완료 (실제 WordPress에는 생성되지 않음)"이
표시된다. 실제 WordPress 연동 전에 안전하게 흐름을 검증할 수 있는 기본 모드다.

## reviewed 상태의 글만 게시 가능한 이유

`CLAUDE.md`의 핵심 원칙(Human Approval)에 따라, 사람의 명시적 승인 없이는
어떤 자동화도 기사를 외부로 내보낼 수 없다. `publishArticleToWordPressDraft`는
`article.status !== 'reviewed'`이면 즉시 `wordpress_publish_skipped_not_reviewed`
이벤트를 기록하고 실패를 반환하며, `approval_logs`에 해당 기사의 승인 기록이
없어도 동일하게 차단한다. draft 상태에서는 `/articles/[id]`의 "WordPress 초안
생성" 버튼 자체가 숨겨진다.

## 자동 공개 게시를 하지 않는 이유

- WordPress REST API 요청에 `status: "draft"`를 코드 레벨에서 고정해, 어떤 경우에도
  공개(publish) 상태로 생성되지 않는다.
- 실제 공개 여부, 카테고리/태그 최종 조정, SEO 검토는 WordPress 관리자 화면에서
  사람이 마지막으로 확인하도록 의도적으로 남겨두었다.
- 자동 공개 게시, 네이버/티스토리 게시, 이미지·영상 첨부는 이번 단계 범위 밖이다.

## 중복 게시 방지 방식

`publish_logs`에서 `article_id + target='wordpress' + status='success'`인 기록이
이미 있으면 `hasSuccessfulPublishLog()`가 `true`를 반환하고,
`publishArticleToWordPressDraft`는 `wordpress_publish_skipped_duplicate` 이벤트만
기록한 뒤 새 WordPress post를 생성하지 않고 종료한다 (기존 게시를 성공으로
간주해 응답한다). `/articles/[id]`에는 "이미 WordPress 초안 생성됨"과 함께
기존 `post_url`이 표시된다.

## 실패 시 확인 방법

- `/articles/[id]` 화면의 "WordPress 게시" 섹션에 최근 게시 상태(`success` /
  `failed` / `dry_run`)와 `error_message`가 표시된다.
- `publish_logs.details`에 HTTP status code, statusText, 응답 본문 일부
  (`responseBodyExcerpt`, 최대 300자)가 저장된다. Authorization header나
  password는 어떤 경우에도 저장/로그되지 않는다.
- `pipeline_logs`에서 `wordpress_publish_failed` 이벤트로 실패 이력을 추적할 수
  있다.
- 흔한 실패 원인: `WORDPRESS_APP_PASSWORD` 만료/폐기(401), `WORDPRESS_BASE_URL`
  오타, REST API가 비활성화된 WordPress 플러그인 설정.

## 다음 단계 제안

- 네이버 블로그 / 티스토리 draft 게시 연동 (동일한 `publish_logs`/`target` 구조
  재사용 가능)
- WordPress 카테고리/태그 매핑 UI (`createDraftPost`의 `categories`/`tags` 입력은
  이미 준비되어 있음)
- featured image 업로드 (별도 Phase, 이미지 생성/업로드 파이프라인 필요)
