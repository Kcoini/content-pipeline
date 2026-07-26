# 보안 체크리스트 (Phase 2)

WordPress 발행 파이프라인을 운영하기 전에 반드시 확인해야 할 보안 항목
목록이다. 이 문서 자체에도 실제 값은 절대 쓰지 않는다.

## 필수 확인 항목

- [ ] **.env.local 커밋 금지**: `.env.local`이 git에 추적되지 않는지
      `git status`/`git ls-files | grep env.local`로 확인한다.
      (`.gitignore`의 `.env*` 규칙에 의해 기본적으로 제외되며,
      `.env.example`만 예외적으로 추적된다.)
- [ ] **Application Password 노출 금지**: `WORDPRESS_APP_PASSWORD`가
      코드/문서/커밋 메시지/PR 설명 어디에도 평문으로 남지 않았는지
      확인한다.
- [ ] **Authorization header 로그 저장 금지**: `lib/publish/wordpress-client.ts`의
      `buildAuthHeader()` 결과가 `logEvent`/`savePublishLog`의 `details`에
      전달되지 않는지 확인한다 (모든 서비스 테스트에 "auth 정보가 logs에
      저장되지 않는다" 케이스가 포함되어 있다).
- [ ] **article full content를 details_json에 저장 금지**: 모든
      `publish_logs.details_json`/`pipeline_logs.details_json` 저장
      경로가 checklist 요약, 상태, 점수 등 안전한 필드만 포함하는지
      확인한다.
- [ ] **raw WordPress response 전체 저장 금지**: WordPress API 응답에서
      `id`/`link`/`status`/`slug`/`modified`/`date` 등 필요한 필드만
      추출해 저장하는지 확인한다.
- [ ] **publish는 human approval 이후에만 가능**: Phase 2-17의
      `checkPublicPublishGuard()`가 `public_publish_approval_status=
      'approved'` && `public_publish_approved=true`를 확인하지 않으면
      WordPress API를 호출하지 않는지 확인한다.
- [ ] **자동 public publish 금지**: 스케줄러/cron/webhook 등 사람의
      개입 없이 `publishApprovedArticleToWordPress()`를 호출하는 코드
      경로가 없는지 확인한다.
- [ ] **source/citation 유지**: Publish Quality Gate의
      `source_citation_exists` 항목이 출처가 없는 기사를 `blocked`로
      막는지 확인한다.
- [ ] **copyright risk 확인**: Publish Quality Gate의
      `content_safety_copyright_risk` 항목(문장 구분 없는 긴 단락 탐지)이
      활성화되어 있는지 확인한다.
- [ ] **AdSense 정책상 광고 클릭 유도 표현 금지**: Publish Quality Gate의
      `monetization_banned_phrases` 항목이 "광고 클릭", "수익 보장" 등
      문구를 monetized_blog 모드에서 `blocked`로 처리하는지 확인한다.
- [ ] **API key rotation 필요 시 절차**: 아래 "API key rotation 절차"를
      따른다.

## API key rotation 절차

1. 새 key를 발급한다 (Supabase secret key, Anthropic API key, WordPress
   Application Password, Naver/Kakao API key 등 — 발급 위치는 각 서비스
   콘솔에서 확인).
2. 로컬 `.env.local`과 배포 환경(Vercel 등)의 환경변수를 새 key로
   교체한다. **이 문서/커밋/PR에는 절대 실제 값을 기록하지 않는다.**
3. 배포 환경을 재배포해 새 key가 적용되었는지 확인한다
   (`npm run build` 및 실제 배포 환경에서 연결 테스트 재실행).
4. 이전 key를 발급 서비스 콘솔에서 폐기(revoke)한다.
5. `pipeline_logs`/`publish_logs`에 이전 key 값이 남아있지 않은지
   샘플 조회로 재확인한다 (애초에 저장하지 않는 것이 원칙이지만,
   회귀 방지 차원의 재확인이다).

## 참고: 이미 코드에 내장된 안전장치

- 모든 발행 관련 서비스(`lib/publish/*.ts`)는 실행 중 예외가 발생해도
  Runtime Error로 터지지 않고 안전한 실패(`{ success: false, ... }`)를
  반환한다.
- 모든 migration은 `add column if not exists`만 사용해 idempotent하며
  기존 데이터를 삭제/변경하지 않는다.
- WordPress draft 생성/media 업로드/SEO metadata write 등 실제 API를
  호출하는 기능은 모두 `*_ENABLED` 환경변수 기본값이 `false`로,
  명시적으로 켜지 않으면 dry-run으로 동작한다.
