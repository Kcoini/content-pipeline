# Phase 2-13: WordPress Plugin 설치 방법

`wordpress-plugin/ai-pipeline-seo-endpoint/ai-pipeline-seo-endpoint.php`를
WordPress 사이트에 설치하는 방법이다. 이 plugin은 Rank Math SEO metadata를
`update_post_meta`로 직접 저장하는 custom REST endpoint
(`POST /wp-json/ai-pipeline/v1/seo-meta`) 하나만 등록한다 — 공개 게시
(publish)와는 무관하며, 글의 status를 바꾸지 않는다.

## 1. 플러그인 파일을 zip으로 압축한다

`wordpress-plugin/ai-pipeline-seo-endpoint` 폴더 전체를 압축한다
(`ai-pipeline-seo-endpoint.zip`). 폴더 안에는 `ai-pipeline-seo-endpoint.php`
파일 하나만 있으면 된다.

```
wordpress-plugin/
  ai-pipeline-seo-endpoint/
    ai-pipeline-seo-endpoint.php
```

## 2. WordPress 관리자 → 플러그인 → 새로 추가

WordPress 관리자 화면에 로그인한 뒤 **플러그인(Plugins) → 새로 추가(Add
New)**로 이동한다.

## 3. 플러그인 업로드

화면 상단의 **플러그인 업로드(Upload Plugin)** 버튼을 클릭한다.

## 4. zip 업로드

1번에서 만든 `ai-pipeline-seo-endpoint.zip` 파일을 선택하고 **지금 설치
(Install Now)**를 클릭한다.

## 5. 활성화

설치가 끝나면 **플러그인 활성화(Activate Plugin)** 버튼을 클릭한다.
활성화 후 **플러그인** 목록에서 "AI Pipeline SEO Endpoint"가 활성 상태인지
확인한다.

## 6. Rank Math plugin 활성화 여부 확인

이 custom endpoint는 Rank Math가 사용하는 post meta key
(`rank_math_title`/`rank_math_description`/`rank_math_focus_keyword`)에
직접 쓰기 때문에, **Rank Math SEO** plugin이 먼저 설치·활성화되어 있어야
실제로 SEO 화면에 반영된 값을 확인할 수 있다. Rank Math가 없어도 endpoint
자체는 값을 저장하지만, WordPress 관리자 화면에서 확인하려면 Rank Math가
필요하다.

## 7. Application Password 사용자에게 글 편집 권한이 있는지 확인

`WORDPRESS_USERNAME`으로 사용하는 계정이 대상 글을 편집할 수 있는 역할
(관리자, 편집자, 또는 해당 글의 작성자 + 기여자 이상)인지 확인한다.
`permission_callback`이 `current_user_can('edit_post', $post_id)`로 이를
확인하므로, 권한이 없으면 403 Forbidden이 반환된다.

## 8. endpoint 테스트 방법

플러그인이 활성화된 후, 브라우저에서 다음 주소에 접속해 REST route가
등록되었는지 확인할 수 있다 (인증 없이는 200이 아니라 권한 오류가 정상):

```
https://your-site.com/wp-json/ai-pipeline/v1/seo-meta
```

실제 호출은 content-pipeline 앱의 "Rank Math custom endpoint로 SEO 반영"
버튼(article 상세 페이지, Phase 2-13 UI)으로 테스트하거나, `.env.local`에
아래 값을 설정한 뒤 Node.js REPL/스크립트로 직접 호출해 확인할 수 있다.

```
WORDPRESS_BASE_URL=https://your-site.com
WORDPRESS_USERNAME=content-bot
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED=true
WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH=/wp-json/ai-pipeline/v1/seo-meta
```

성공 응답 예시:

```json
{
  "success": true,
  "postId": 123,
  "provider": "rank_math",
  "updatedKeys": ["rank_math_title", "rank_math_description", "rank_math_focus_keyword"],
  "verified": true
}
```

## 문제 해결

- **404**: 플러그인이 활성화되지 않았거나 permalink 설정이 갱신되지 않았을
  수 있다 (설정 → 고유주소에서 저장 버튼을 한 번 눌러 재작성 규칙을
  갱신해본다).
- **403**: Application Password 사용자에게 해당 글에 대한 edit_post 권한이
  없다.
- **401**: username/Application Password가 올바르지 않다.
