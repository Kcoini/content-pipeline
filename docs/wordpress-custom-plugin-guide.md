# WordPress Custom Plugin 가이드 (AI Pipeline SEO Endpoint)

## 1. 목적

`wordpress-plugin/ai-pipeline-seo-endpoint`는 Rank Math SEO plugin이
사용하는 post meta(`rank_math_title`/`rank_math_description`/
`rank_math_focus_keyword`)를 `update_post_meta`로 직접 저장하는 custom
REST endpoint 하나만 등록하는 최소 plugin이다. 표준 WordPress REST
posts meta 업데이트로는 Rank Math의 protected meta key가 반영되지 않는
경우가 있어(Phase 2-4/2-12에서 확인) Phase 2-13에서 추가했다.

- 공개 게시(publish)와는 무관하다 — 글의 `post_status`를 바꾸지 않는다.
- 이 plugin은 SEO metadata write만 담당한다.

## 2. 설치 위치

```
wordpress-plugin/
  ai-pipeline-seo-endpoint/
    ai-pipeline-seo-endpoint.php
  ai-pipeline-seo-endpoint.zip   # 위 폴더를 미리 압축해 둔 파일
```

## 3. zip 업로드 방법

저장소에 이미 준비된 `wordpress-plugin/ai-pipeline-seo-endpoint.zip`을
그대로 사용하거나, `ai-pipeline-seo-endpoint` 폴더 전체를 다시 압축해
사용한다. WordPress 관리자 → **플러그인(Plugins) → 새로 추가(Add New) →
플러그인 업로드(Upload Plugin)**에서 이 zip 파일을 선택하고 **지금 설치
(Install Now)**를 클릭한다.

## 4. 활성화 방법

설치 완료 후 **플러그인 활성화(Activate Plugin)** 버튼을 클릭한다.
플러그인 목록에서 "AI Pipeline SEO Endpoint"가 활성 상태인지 확인한다.

## 5. endpoint 경로

```
POST /wp-json/ai-pipeline/v1/seo-meta
```

`.env.local`의 `WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH`가 이 경로와 일치해야
한다 (기본값이 이미 이 경로다).

## 6. Rank Math meta key

이 plugin이 `update_post_meta`로 직접 쓰는 key는 다음 3개다.

- `rank_math_title`
- `rank_math_description`
- `rank_math_focus_keyword`

WordPress 관리자 화면에서 실제로 반영된 값을 확인하려면 **Rank Math
SEO** plugin이 별도로 설치·활성화되어 있어야 한다. Rank Math가 없어도
endpoint 자체는 값을 저장하지만, 화면에서 확인하려면 Rank Math가
필요하다.

## 7. permission_callback 설명

`ai_pipeline_seo_endpoint_permission_callback()`은 `__return_true`를
사용하지 않는다. 다음을 모두 확인해야 요청이 허용된다.

1. `is_user_logged_in()` — 인증된 사용자인지 확인 (미인증이면 401).
2. `postId`가 유효한 정수인지 확인 (아니면 400).
3. `provider`가 `rank_math`인지 확인 (아니면 400 — 이 plugin은 Rank Math
   전용이다).
4. 해당 `postId`의 글이 실제로 존재하는지 확인 (아니면 404).
5. `current_user_can('edit_post', $post_id)` — 요청자가 **이 글을 편집할
   권한**이 있는지 확인 (없으면 403).

REST route callback 내부에서도 동일한 권한 검사를 한 번 더 수행한다
(defense in depth — 캐싱/훅 순서 문제로 우회되지 않도록).

## 8. Application Password 권한 확인

`WORDPRESS_USERNAME`으로 사용하는 계정이 대상 글을 편집할 수 있는 역할
(관리자, 편집자, 또는 해당 글의 작성자 + 기여자 이상)인지 확인한다.
권한이 없으면 `permission_callback`에서 403 Forbidden을 반환한다.
Application Password는 WordPress 관리자 → 사용자 → 프로필 → "응용
프로그램 비밀번호"에서 발급하며, 이 문서를 포함한 어떤 문서에도 실제
값을 남기지 않는다.

## 9. 테스트 방법

1. 플러그인 활성화 후, 인증 없이 브라우저에서
   `https://your-site.example/wp-json/ai-pipeline/v1/seo-meta`에 접속해
   REST route가 등록되었는지 확인한다 (200이 아니라 권한 오류가 정상).
2. `.env.local`에 아래 값을 설정한다 (placeholder만 표기, 실제 값은
   로컬에서만 채운다).

   ```
   WORDPRESS_BASE_URL=https://your-site.example
   WORDPRESS_USERNAME=...
   WORDPRESS_APP_PASSWORD=...
   WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED=true
   WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH=/wp-json/ai-pipeline/v1/seo-meta
   ```

3. content-pipeline 앱의 article 상세 페이지에서 "Rank Math custom
   endpoint로 SEO 반영" 버튼(Phase 2-13 UI)을 눌러 실제 반영 여부를
   확인한다.

성공 응답 예시 (실제 값은 예시일 뿐이다):

```json
{
  "success": true,
  "postId": 123,
  "provider": "rank_math",
  "updatedKeys": ["rank_math_title", "rank_math_description", "rank_math_focus_keyword"],
  "verified": true
}
```

## 10. 오류 대응

| 상태 코드 | 원인 | 대응 |
|---|---|---|
| 404 | 플러그인 미활성화 또는 permalink 캐시 문제 | 플러그인 활성화 확인, 설정 → 고유주소에서 저장 버튼을 한 번 눌러 재작성 규칙 갱신 |
| 401 | username/Application Password가 올바르지 않음 | Application Password를 재발급하고 `.env.local`을 갱신 (git에는 커밋하지 않음) |
| 403 | 계정에 해당 글의 edit_post 권한이 없음 | 계정 역할을 편집자 이상으로 변경하거나 해당 글의 작성자로 지정 |
| 400 | `provider != rank_math` 또는 `postId` 누락/유효하지 않음 | 요청 payload 확인 (`SEO_PLUGIN_PROVIDER=rank_math`인지, WordPress draft post가 실제로 생성되어 있는지) |
| verified: false | 저장 직후 재조회 값이 비어 있음 | Rank Math plugin이 실제로 설치·활성화되어 있는지, 다른 plugin이 동일 meta key를 덮어쓰지 않는지 확인 |

자세한 설치 스크린샷 단위 절차는 `docs/phase-2-13-wordpress-plugin-install.md`,
custom endpoint 자체의 동작은 `docs/phase-2-13-custom-wordpress-seo-metadata-endpoint.md`를 참고한다.
