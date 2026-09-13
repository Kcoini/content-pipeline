# Phase 4-7: WordPress Media Upload / Connection Test 개발자용 정보 숨김

[Phase 4-6](./phase-4-6-developer-info-hiding.md)에서 `/articles/[id]`의
SEO Plugin Actual Write/Custom Endpoint를 정리한 데 이어, 이번 phase는
같은 페이지의 **WordPress Media Upload**(Step 2)와 **WordPress
Connection Test** 영역을 같은 원칙으로 정리한다.

## 문제

`app/articles/[id]/page.tsx`에 다음이 기본 화면에 그대로 노출되어
있었다:

- "Step 2. WordPress Media Upload" 제목, `WORDPRESS_MEDIA_UPLOAD_ENABLED`
  raw 값, "WordPress 이미지 업로드 테스트"/"업로드 상태 확인"/"업로드
  dry-run 확인" 개발자용 버튼, source type/local path/mime type/media
  id/media url/upload payload 미리보기 raw dl.
- "WordPress Connection Test" 제목, `process.env.WORDPRESS_BASE_URL`
  (base URL), `publish enabled`/`media upload enabled` raw 값.

## 1. WordPress Media Upload → "대표 이미지 업로드 상태"

헤더를 "Step 2. WordPress Media Upload" → "대표 이미지 업로드 상태"로
바꿨다. 기본 화면에는 상태 배지(기존 `MEDIA_UPLOAD_STATUS_LABEL` —
이미 한국어라 그대로 유지)와 현재 상태에 맞는 한 문장 안내만 보여준다
("대표 이미지를 먼저 저장하면 업로드를 진행할 수 있습니다." /
"대표 이미지가 WordPress에 업로드되었습니다." 등).

`WORDPRESS_MEDIA_UPLOAD_ENABLED` raw 값, 4개 버튼(준비/dry-run 확인/
업로드 테스트/상태 확인), raw dl(source type/url/local path/filename/
mime type/media id/media url/마지막 시도 시간), upload payload
미리보기, raw 오류 메시지는 모두 `<details>` "이미지 업로드 상세
보기"(기본 닫힘) 안으로 옮겼다 — **기능은 그대로 접힘 안에서
실행된다.**

## 2. WordPress Connection Test → "WordPress 연결 상태"

헤더를 "WordPress Connection Test" → "WordPress 연결 상태"로 바꿨다.
기본 화면에는 "Draft 생성: 가능/가능(dry-run 모드)", "이미지 업로드:
가능/비활성화됨"이라는 사용자 친화적 두 줄과 [연결 상태 확인] 버튼만
보여준다("WordPress 연결 테스트"라는 개발자용 버튼명 대신 사용자 표현
사용).

`base URL`(`process.env.WORDPRESS_BASE_URL`), `publish enabled`/
`media upload enabled` raw 값은 `<details>` "WordPress 연결 상세
보기" 안으로 옮겼다. Application Password/Authorization header는
이전부터 어디에도 표시하지 않았고, 이번에도(접힘 안에서도) 표시하지
않는다.

## 3. WordPress 게시 준비 요약 카드 (신규)

`lib/wordpress/wordpress-publishing-readiness-summary.ts`의
`summarizeWordPressPublishingReadiness()`가 연결/승인/대표 이미지/SEO
상태를 하나로 묶어 "지금 뭘 하면 되는지"를 계산한다(새 DB 컬럼 없음 —
기존 article 필드로부터 매 렌더링마다 다시 계산).

Step 1(대표 이미지 Source 설정) 섹션 바로 앞에 카드를 추가했다:

```
WordPress 게시 준비

WordPress 연결: 확인 필요       Draft 생성: 가능
SEO 정보: 반영 필요            대표 이미지: 준비 안 됨
공개 게시: 자동 실행 안 함

다음 작업: 대표 이미지를 업로드하거나 이미지 없이 진행할 수 있습니다.

[대표 이미지 업로드]
```

- `연결` 라벨은 별도 저장 없이 "WordPress draft를 만든 적이 있는지"로
  추정한다(`hasWordPressDraft`) — 정확한 실시간 확인은 여전히 [연결
  상태 확인] 버튼(WordPress Connection Test 기능)으로 한다.
- `SEO 정보`는 [Phase 4-6](./phase-4-6-developer-info-hiding.md)의
  `seoWriteSummary.status`를 그대로 재사용한다(짧은 라벨로 축약).
- primary action은 상태에 따라 하나만 강조한다: 승인 전이면 "기사
  승인하러 가기"(대시보드 승인 흐름 안내), 이미지 미준비면 [대표
  이미지 업로드](`#featured-image-source`로 스크롤), 준비 완료 시
  [WordPress Draft 반영](`#wordpress-draft-send`로 스크롤), draft
  생성 후에는 [WordPress Draft 보기](실제 postUrl 링크).
- "공개 게시" 항목은 항상 "자동 실행 안 함"으로 고정 표시한다 — 자동
  public publish는 이 phase에서도 추가하지 않는다.

## 4. "원본 article을 WordPress Draft로 전송" 섹션의 잔여 raw 정보

같은 섹션의 `WORDPRESS_PUBLISH_ENABLED`/"현재 모드" raw dl도 `<details>`
"고급 설정 보기"로 옮겼다. "media upload: deferred"/"SEO plugin write:
deferred"로 남아 있던 문구는 이미 두 기능이 구현된 지금 시점에는
사실과 다른 안내라 제거했다(기능 삭제가 아니라 오래된 잘못된 안내
문구 정리).

## 5. 다른 페이지 점검 결과 — 추가 수정 없음

`/articles/[id]/blog`, `/articles/[id]/social`, `/articles/[id]/rewrite`,
`/social-posts/[id]`, `/dashboard`, `/dashboard/*` 전체를
`Connection Test`/`Media Upload`/`Step 1/2/3`/`WORDPRESS_`/`raw status`
키워드로 다시 점검했다. "Step 1/2/3" 문구가 `/articles/[id]/blog`에도
있지만, 이는 완전히 다른 개념(wordpress_blog 카드 자신의 품질검사→
승인→WordPress Draft 진행 단계, 이미 한국어)이라 이번 원칙과 무관하다.
WordPress Media Upload/Connection Test 성격의 개발자용 블록은
`/articles/[id]`에만 있었다.

## 원칙 재확인

- WordPress Media Upload/Connection Test 기능은 삭제하지 않았다 —
  버튼과 서버 action은 그대로이고, 위치만 접힘 안으로 옮겼다.
- WordPress는 여전히 Draft 생성/업데이트까지만 자동화한다.
- 자동 public publish는 추가하지 않았다.
- 민감정보(Application Password, Authorization header, API key)는
  기본 화면은 물론 접힘 영역 안에서도 표시하지 않는다.
- DB schema는 바꾸지 않았다 — 요약은 항상 기존 필드로부터 다시
  계산되는 파생 값이다.

## 테스트

- `lib/wordpress/wordpress-publishing-readiness-summary.test.ts`: 4개
  상태 전이(승인 필요/이미지 준비/Draft 생성 가능/Draft 이미 있음),
  이미지 준비 판정(업로드됨/기존 media id/waived 모두 인정), SEO 라벨
  변환, "공개 게시: 자동 실행 안 함" 고정.
- `app/articles/[id]/page.test.ts`: 요약 카드 항목 표시, "Step 2.
  WordPress Media Upload"/"WordPress Connection Test"/raw env 값이
  기본 화면에 없음, 접힘 안에는 기존 raw 값과 기존 액션이 모두 남아
  있음, Application Password/Authorization header가 어디에도 없음.
- 전체 `npx vitest run`: 226 files / 2890 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 관련 문서

- [`phase-4-6-developer-info-hiding.md`](./phase-4-6-developer-info-hiding.md) — SEO Plugin Actual Write/Custom Endpoint 숨김(같은 페이지, 같은 원칙)
- [`wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md) — "요약 먼저, 상세는 접어서" 원칙
- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md), [`ui-review-agent-checklist.md`](./ui-review-agent-checklist.md)
