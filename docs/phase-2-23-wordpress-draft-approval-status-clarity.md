# Phase 2-23: WordPress Draft 반영 승인 조건 명확화

## 문제

article 고급기능(원본 article WordPress Draft 전송) 또는 wordpress_blog
카드의 "WordPress에 반영하기"를 실행하면 다음 오류가 발생하는 경우가
있었다.

```
WordPress Draft 실패
실패 단계: WordPress Draft — 승인(reviewed)된 기사만 WordPress에 게시할 수 있습니다.
```

이 메시지가 혼란스러웠던 이유는, 사용자가 보기에 "reviewed(검토 완료)"와
"승인(approved)"이 서로 다른 두 단계처럼 보였고, 화면 곳곳에 있는 여러
"검토 완료" 배지(WordPress Metadata/SEO Plugin Metadata/대표 이미지)가
전부 이 오류와 관련 있는 것처럼 오해할 수 있었기 때문이다.

## 원인 확인

**결론부터: 이 프로젝트에는 `approval_status`라는 별도의 필드가 없다.**
`not_requested`/`review_requested`/`reviewed`/`approved`/`rejected` 5단계
상태 모델은 이 코드베이스에 존재하지 않는다. 실제로 WordPress Draft
반영을 가로막는 조건은 단 하나, **`article.status`**(`draft` →
`reviewed` → `published`)뿐이다.

- `/articles/[id]`의 "승인하기" 버튼(`approveArticleAction` →
  `lib/repositories/article-repository.ts`의 `approveArticle()`)은
  **하나의 동작**으로 `article.status`를 `draft`→`reviewed`로 바꾸고
  동시에 `approval_logs`에 `action='approve_article', status='approved'`
  기록을 남긴다. 즉 "검토 완료"와 "승인"은 이 프로젝트에서 별개의
  두 단계가 아니라 **버튼 하나로 한 번에 끝나는 동일한 게이트**다.
- `lib/publish/publish-service.ts`의 `publishArticleToWordPressDraft()`는
  이 게이트를 `article.status !== "reviewed"`로 확인한다. 이 조건은
  **원본 article 전송(article 고급기능)과 wordpress_blog 카드 전송
  모두에서 공유하는 동일한 함수**이므로 두 흐름 모두 같은 조건을
  적용받는다(`contentOverride` 유무와 무관).
- **실제 혼란의 원인**: `article.status`(마스터 승인 게이트)와는 완전히
  무관한 세 개의 하위 상태 — `WordPressMetadataStatus`,
  `SeoPluginMetadataStatus`, `FeaturedImageStatus` — 가 전부 우연히
  같은 문자열 값 `"reviewed"`를 가지고 있고, `app/articles/[id]/page.tsx`에서
  이 값을 전부 "검토 완료"라는 같은 한국어 라벨로 표시한다. 반면
  `article.status === "reviewed"`(마스터 게이트)는 같은 파일에서
  "승인됨 (reviewed)"이라는 **다른 라벨**로 표시된다. 같은 영어 단어
  (`reviewed`)가 한쪽은 "승인됨", 다른 쪽은 "검토 완료"로 번역되어
  있었던 것이 혼란의 근본 원인이다. 이 세 하위 상태는 어느 것도
  WordPress Draft 반영을 막지 않는다(모두 "선택 사항이며 게시를 막지는
  않습니다"라고 이미 명시되어 있다).
- **실제 재현 경로**: wordpress_blog 카드의 "WordPress에 반영하기"
  (`app/articles/[id]/blog/page.tsx`)는 `checkWordPressBlogPublishReadiness()`의
  `ready` 계산에 `article.status` 검사가 포함되어 있지 않아, 원본
  article이 아직 `draft`여도 버튼이 활성화된 채로 있었다. 그래서
  사용자가 버튼을 눌러야만(사전 경고 없이) 위 오류를 실행 후에
  발견하게 되는 구조였다.

## 조치 (DB schema 변경 없음)

### 1) 오류 메시지 명확화 (`lib/publish/publish-service.ts`)

"승인(reviewed)된 기사만 WordPress에 게시할 수 있습니다." →

> WordPress Draft에 반영하려면 먼저 원본 기사가 승인되어야 합니다
> (현재 상태: draft). 기사 개요 페이지에서 "승인하기"를 눌러 기사를
> 승인한 뒤 다시 시도하세요.

가짜 `approved` 상태를 새로 만들지 않고, 실제 필드(`article.status`)와
실제 다음 행동(기사 개요 페이지의 "승인하기" 버튼)을 그대로 안내한다.
이 메시지는 article 고급기능/wordpress_blog 양쪽에서 공유된다.

### 2) wordpress_blog 카드에 사전 경고 + 버튼 비활성화 추가 (`app/articles/[id]/blog/page.tsx`)

`checkWordPressBlogPublishReadiness()`의 `ready`/`blockers` 자체는
건드리지 않았다(wordpress_blog 흐름과 충돌하지 않기 위해, 이 함수는
다른 화면 요소와도 공유되는 핵심 로직이라 범위를 넓히지 않았다). 대신
화면 레벨에서 별도의 `isArticleApprovedForWordPress = article.status ===
"reviewed"` 조건을 추가해:

- "WordPress에 반영하기"(Step 3까지 한 번에 실행하는 primary button)
- "WordPress Draft 생성" / "WordPress Draft 업데이트"

세 버튼 모두 `!isArticleApprovedForWordPress`이면 비활성화하고, 버튼
바로 위에 "원본 기사가 아직 승인되지 않았습니다(article status: draft).
WordPress Draft에 반영하려면 먼저 기사 개요 페이지에서 '승인하기'를
눌러 기사를 승인하세요."라는 안내와 `/articles/[id]`로 가는 링크를
표시한다. 이제 실행 후 실패 메시지로 알게 되는 대신, 실행 전에 미리
안내한다.

### 3) 자동 게시 준비 흐름과의 관계 확인 (변경 없음)

`lib/publish/article-wordpress-publish-preparation-orchestrator.ts`
(article 고급기능의 "WordPress 게시 준비 자동 실행")와
`lib/social/wordpress-blog-publish-preparation-orchestrator.ts`
(wordpress_blog의 "WordPress에 반영하기") 둘 다 `approveArticle()`을
호출하지 않으며, `article.status`를 `reviewed`로 바꾸는 코드가 전혀
없음을 확인했다(정적 검사로 재확인). 두 자동 준비 흐름 모두 metadata/
SEO/이미지/quality gate까지만 자동으로 준비하고, 승인은 항상 사람이
직접 "승인하기" 버튼을 눌러야 한다 — 이 원칙은 이번 작업 이전부터
이미 지켜지고 있었고, 이번 작업으로도 변경하지 않았다.

## 승인 상태 정의 (실제 모델, 문서 정정)

| 값 | 의미 | WordPress Draft 반영 가능? |
| --- | --- | --- |
| `draft` | 아직 승인되지 않음 | ❌ 차단 |
| `reviewed` | 사람이 "승인하기"를 눌러 승인 완료 (검토+승인이 한 단계) | ✅ 가능 |
| `published` | MVP 이후 범위(현재 DB/타입 구조만 정의) | 해당 없음 |

이 표 외에 `wpMetadataStatus`/`seoPluginMetadataStatus`/
`featuredImageStatus`의 `"reviewed"` 값은 각 하위 항목을 사람이
검토했는지만 나타내는 **선택 사항** 플래그이며, 위 마스터 게이트와는
전혀 무관하다.

## 영향 범위 확인

- **wordpress_blog**: `checkWordPressBlogPublishReadiness()`의 로직은
  변경하지 않았다. 화면에 버튼 비활성화 조건과 안내 문구만 추가했다
  (추가적인 안전장치이지 흐름 변경이 아니다).
- **naver_blog**: 이번 수정 대상 파일을 전혀 참조하지 않으므로 영향
  없음.
- **DB schema**: 변경 없음.
- **public publish**: 관련 없음 — 이번 수정은 WordPress Draft 생성/
  업데이트 게이트에만 관여하며, `publishWordPressPost()`(실제 공개
  게시)는 건드리지 않았다.

## 테스트

- `lib/publish/publish-service.test.ts`: 미승인(`status !== "reviewed"`)
  상태 기사에 대한 오류 메시지가 "승인"/"현재 상태: draft"/"승인하기"를
  포함하는지 확인(기존 "reviewed" 포함 여부 assertion을 명확한 문구
  assertion으로 교체).
- `app/articles/[id]/blog/page.test.ts`: `isArticleApprovedForWordPress`
  조건이 세 버튼의 `disabled`에 모두 반영되는지, 안내 문구가 존재하는지
  정적 소스 검사로 확인.
- 전체 `npm run lint`(0 errors), `npm run test`(2410/2410 통과),
  `npx tsc --noEmit -p .`(기존 baseline 37건 유지, 신규 0건),
  `npm run build`(성공) 확인.

## 관련 문서

- `docs/phase-1-5-review-approval.md` (FR-9, 원래 승인 흐름 설계)
- `docs/phase-2-2-wordpress-draft-publish.md`
- `docs/phase-3-operation-manual.md`
- `docs/ui-ux-governance-rules.md`
