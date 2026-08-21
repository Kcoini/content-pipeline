# wordpress_blog 카드 UI 규칙

[`docs/ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)를 `/articles/[id]/blog`의
`platform === "wordpress_blog"` 카드에 적용한 구체적인 화면 구조 규칙이다.
이 문서는 규칙만 정의한다 — 실제 구현 상세는
[`docs/article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md)를,
현재 구현이 이 규칙을 얼마나 만족하는지는
[`docs/ui-audit-wordpress-blog-card.md`](./ui-audit-wordpress-blog-card.md)를 참고한다.

**적용 범위**: `platform === "wordpress_blog"` social post 카드에만 적용한다.
`naver_blog`/`naver_cafe`/`x`/`threads`/`instagram` 카드나 `/articles/[id]`의
article 고급 기능에는 적용하지 않는다(각자 다른 규칙을 따를 수 있다).

## 필수 구조 — 고정 영역 + 탭

카드 하나가 너무 길어져 스크롤 부담이 커지는 문제(글 내용/미리보기/
품질검사/승인/WordPress 반영/대표 이미지/체크리스트가 전부 세로로 쌓여
있던 문제)를 해결하기 위해, **고정 영역(탭과 무관하게 항상 보임) + 탭
6개**로 나눈다(`lib/social/wordpress-blog-card-tabs.ts`).

### 고정 영역 (탭 위에 위치, 항상 보임)

1. **단계별 상태 요약** — 품질검사/승인/Draft/SEO Metadata/대표 이미지/
   게시 준비/체크리스트 7개 항목을 badge로 보여준다.
2. **다음 추천 작업** — 지금 상태 기준 다음 할 일 한 문장 + 해당 작업이
   있는 탭으로 바로 이동하는 "○○ 탭으로 이동" 버튼
   (`getTabForWorkflowStep()`이 다음 추천 작업의 step을 탭으로 변환한다).
3. **"WordPress에 반영하기" primary button** — 화면에서 가장 눈에 띄는
   단일 버튼(`prepareWordPressBlogPostForPublishingAction` 재사용).
   Draft 생성/업데이트, SEO Metadata 업데이트, 대표 이미지 연결, 게시
   가능 상태 확인을 순서대로 실행한다. **public publish는 하지 않는다**
   — 버튼 바로 아래에 "공개 게시 버튼은 누르지 않습니다"를 항상 표시한다.

### 탭 내비게이션 (고정 영역 아래, sticky)

`WORDPRESS_BLOG_CARD_TABS` 6개, 새 라이브러리 없이 기존 Tailwind
`sticky top-0`로 카드 안에서 상단에 고정된 것처럼 보이게 한다. 좁은
화면에서는 `overflow-x-auto`로 가로 스크롤된다. 각 탭 이름 옆에는
`getWordPressBlogCardTabBadges()`가 계산한 상태 badge(완료/필요/확인
필요)를 붙인다("글 내용"/"WordPress 미리보기" 탭은 정보 제공용이라
badge를 붙이지 않는다).

| 탭 | key | 내용 |
| --- | --- | --- |
| 글 내용 | `content` | wordpress_blog 제목, 본문 요약(500~800자, 전체 본문은 접어둠), 이 글 자신이 생성한 SEO/게시용 metadata(seoTitle/metaDescription/targetKeyword/secondaryKeywords/answerSummary/policyRiskScore/monetizationScore 등) |
| WordPress 미리보기 | `preview` | WordPress 게시 미리보기(제목/대표 이미지/본문/AD_SLOT/FAQ/참고자료) + WordPress 반영 데이터 요약 |
| 품질·승인 | `quality` | 검사가 많은 이유 안내 + Step 1(품질검사) + Step 2(승인) |
| WordPress 반영 | `wordpress` | 최근 WordPress 반영 결과 + Step 3(WordPress Draft) + Step 4(SEO Metadata, SEO Plugin Metadata 포함) |
| 대표 이미지 | `image` | Step 5(대표 이미지) 전체 — 파일 선택/업로드/Media ID/연결/이미지 없이 진행 |
| 체크리스트 | `checklist` | Step 6(게시 가능 상태 확인) + Step 7(체크리스트/Handoff, 확인 필요 항목, 게시 URL 입력) |

## 추가 규칙

- primary button의 이름은 **"WordPress에 반영하기"**로 통일한다(기존
  "게시 준비 자동 실행"/"WordPress 게시 준비 일괄 실행"에서 전환).
- 이 버튼은 **public publish를 하지 않는다** — 어떤 상황에서도 WordPress에
  공개 게시 API를 호출하지 않고 draft 상태로만 반영한다.
- 개별 단계 버튼(탭 안의 버튼)은 primary button과 구분되는 보조 버튼
  스타일로 둔다. primary button은 탭과 무관하게 고정 영역에 한 번만
  둔다(탭 안에 다시 중복 배치하지 않는다).
- 사용자는 **wordpress_blog 카드 안에서** WordPress 게시 준비 작업을 끝낼
  수 있어야 한다 — 다른 페이지로 이동해서 처리해야 하는 작업(대표 이미지
  업로드, media ID 저장, 대표 이미지 연결, 이미지 없이 진행, 게시 URL
  기록)이 있어서는 안 된다.
- **대표 이미지 업로드 / Media ID 저장 / 연결 / 이미지 없음 진행**은 모두
  대표 이미지 탭(`image`) 안에서 처리한다.
- **게시 URL 기록**도 체크리스트 탭(`checklist`) 안에서 처리한다.
- **탭 이동 시 상태를 유지한다**: `articleId`/`socialPostId`/`returnTo`/
  `highlight`에 더해 `tab` query param(`?tab=image` 등)을 사용한다.
  action form들의 `returnTo`는 지금 보고 있는 탭을 포함한
  `selfReturnTo`(`buildArticleBlogUrl(id, { socialPostId, highlight,
  tab: activeTab })`)를 사용해, action 실행 후에도 같은 카드·같은 탭으로
  돌아온다.
- naver_blog 카드에는 이 문서의 어떤 UI(탭 구조 포함)도 표시하지 않는다.
  naver_blog는 기존 manual export 중심 UI를 그대로 유지한다.

## 카드 안 정보와 시스템 로그를 분리한다

카드 안에는 **사용자가 실제로 해야 하는 작업**만 남기고, 프로세스
로그/실행 이력/raw JSON details 같은 **디버그성 정보는 카드에 두지
않는다** — 페이지 최하단 "프로세스 로그 / 실행 이력" 섹션(`#process-logs`,
`docs/article-blog-wordpress-workflow.md` 참고)으로 모은다.

- **카드 안에 남기는 것**: Draft 상태, SEO Metadata 상태, 대표 이미지
  상태, 게시 준비 상태, 마지막 실행 성공/실패 **요약**(한 줄 ~ 짧은
  목록), 다음 추천 작업, WordPress에 반영하기 버튼, "상세 로그
  보기" 링크(하단 로그 섹션으로 이동).
- **페이지 하단으로 옮기는 것**: pipeline_logs 원본, 각 이벤트의
  raw JSON details, dry-run/handoff 상세 로그, 체크리스트 생성/실행
  이력 등 시스템 실행 기록 전반.
- **체크리스트는 로그가 아니다**: Step 7의 체크리스트 항목(needs_review
  확인, 확인 완료 표시, 게시 URL 입력)은 **사용자가 지금 처리해야 하는
  작업**이므로 체크리스트 탭(`checklist`)에 그대로 둔다. 반대로
  "이 action이 언제 실행됐고 성공/실패했는지"는 시스템 기록이므로
  하단 로그 섹션에 둔다.

## action 실행 결과는 toast로, persistent alert는 두지 않는다

`/articles/[id]/blog` 페이지는 action 실행 후 `?publishMessage=...`/
`?error=...` query param으로 결과 메시지를 돌려받는다. 이 메시지를
본문 중간의 큰 alert box로 계속 보여주지 않는다 — `components/ui/transient-notice.tsx`
(`TransientNotice`)로 화면 오른쪽 위에 잠깐(기본 4초) 띄웠다 자동으로
사라지게 한다(닫기 버튼도 제공, `position: fixed`라서 레이아웃을 밀지
않는다). "선택한 항목을 강조 표시했습니다." 같은, 카드 하이라이트로
이미 알 수 있는 확인 메시지는 아예 표시하지 않는다(`DeepLinkNotice`를
`found=true`일 때는 렌더링하지 않고, `found=false`—실제 경고—일 때만
사용한다). 이 규칙은 wordpress_blog 카드뿐 아니라 페이지 전체(naver_blog
포함)에 적용된다 — action 결과 전달 방식(query param) 자체는 여러
페이지가 공유하는 인프라라 이 페이지의 렌더링 방식만 바꿨다.

## 카드 안 정보는 핵심 요약 → 상세(접기) 순으로 배치한다

카드 하나 안에 제목/본문/상태/metadata/오류/버튼이 한꺼번에 노출되면
읽기 어렵다. 각 박스는 "지금 바로 봐야 하는 요약"과 "필요할 때만 보는
상세"를 분리한다.

- **기본으로 보이는 것**: 상태 badge(완료/필요/확인 필요/차단됨/실패),
  Draft/SEO/대표 이미지/게시 준비 상태, 다음 추천 작업, WordPress에
  반영하기 버튼, 현재 상태에 실제로 영향을 주는 오류(짧은 한 줄).
- **`<details>`로 접어두는 것**: seoTitle/metaDescription/targetKeyword/
  secondaryKeywords 같은 SEO metadata 전체("SEO Metadata 상세 보기"),
  media URL/업로드 상태/마지막 연결 시각 같은 대표 이미지 부가 정보
  ("대표 이미지 상세 보기"), quality_status/approval_status/
  publish_status/export_status/manual_post_status 같은 raw 내부
  상태값("내부 상태값 보기"), primary button의 긴 설명("자세히 보기").
  전부 새 라이브러리 없이 네이티브 `<details>`만 사용한다.
- **오류는 "현재 상태"와 "이전 이력"을 구분한다**: 예를 들어 대표
  이미지가 waived(이미지 없이 진행)로 처리된 상태에서 예전에 Media
  ID 연결이 실패했던 기록이 남아 있다면, 그 오류를 지금도 문제인 것
  처럼 크게 보여주지 않는다 — "참고: 이전 Media ID 연결 시도 실패
  기록 있음(현재는 이미지 없이 진행 중)."처럼 참고용으로만 짧게
  보여주고, 원문 오류 메시지는 "대표 이미지 상세 보기" 안에 둔다.
  반대로 지금 실제로 상태에 영향을 주는 오류는 짧은 빨강 경고 한 줄로
  바로 보여준다.
- **색상은 의미별로만 쓴다**: 일반 설명 문장은 muted(zinc) 색상을
  쓰고, 파란색(indigo)은 링크에만 쓴다. 성공은 초록, 확인 필요는
  노랑, 실패/오류는 빨강 badge를 쓰고, primary action 버튼에만 강한
  색상(indigo-800 배경)을 준다. 설명 문장 전체를 파란색으로 칠하지
  않는다.
- **raw internal status는 사용자에게 직접 노출하지 않는다**: `ready`/
  `approved`/`exported`/`ready_to_record` 같은 DB 원본 문자열은 상단에
  그대로 보여주지 않고, 한국어 상태(완료/승인됨/내보내기 완료/기록
  필요 등)로 변환해서 보여준다. 원본 문자열이 필요한 사람(개발자/
  관리자)을 위해서만 "내부 상태값 보기"에 그대로 남겨둔다.

## 관련 문서

- [`docs/ui-ux-governance-rules.md`](./ui-ux-governance-rules.md) — 이 문서의 근거가 되는 프로젝트 전체 규칙
- [`docs/ui-review-agent-checklist.md`](./ui-review-agent-checklist.md) — 이 구조를 실제로 만족하는지 점검하는 체크리스트
- [`docs/ui-audit-wordpress-blog-card.md`](./ui-audit-wordpress-blog-card.md) — 현재 구현이 이 규칙을 얼마나 만족하는지 점검한 결과
- [`docs/article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md) — Step 1~7/체크리스트 구현 상세
