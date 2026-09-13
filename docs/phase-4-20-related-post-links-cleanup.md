# Phase 4-20: "상세 보기 → 성과 보기 → 기사 개요 →" 화살표 링크 정리

## 문제

`/articles/[id]/blog`, `/articles/[id]/social`, `/articles/[id]/rewrite`의
글 카드 안에 "상세 보기 →", "성과 보기 →", "기사 개요 →" 같은 화살표
링크가 primary/secondary action과 나란히, 또는 그보다 먼저 표시되고
있었다. 화살표가 작업 순서처럼 보이지만 실제로는 관련 화면으로
이동하는 보조 링크일 뿐이라 사용자가 이게 다음 단계인지 이동 링크인지
헷갈렸고, "기사 개요 →"처럼 마지막 링크에도 화살표가 붙어 의미가
불분명했다.

## 해결

### 1) 공통 `RelatedPostLinks` 컴포넌트

`components/navigation/related-post-links.tsx`(신규)가 링크 배열을
받아 기본 접힘 상태의 "▸ 관련 화면 보기"로 묶어 보여준다. 각 링크는
화살표 없이 버튼 스타일 텍스트 링크로만 표시한다. 링크가 비어 있으면
아무것도 렌더링하지 않는다(빈 접힘 영역을 만들지 않는다).

```tsx
<RelatedPostLinks
  links={[
    { label: "글 상세 보기", href: ... },
    { label: "성과 확인", href: ... }, // shouldShowPerformanceLink(post)일 때만 포함
    { label: "원본 기사 개요", href: ... },
  ]}
/>
```

### 2) 성과 확인 표시 조건 — `shouldShowPerformanceLink`

`lib/social/performance-link-visibility.ts`(신규)의
`shouldShowPerformanceLink(post)`가 다음 중 하나라도 참이면 true를
반환한다: `manualPostStatus === "posted"`, `latestMetricsRecordedAt`이
있음, `performanceStatus !== "not_measured"`. 세 조건이 모두 거짓이면
(게시 전 + 성과 미측정) "성과 확인" 링크 자체를 목록에서 뺀다 —
링크 기능을 삭제하는 게 아니라, 의미 없는 상태에서 강조하지 않는
것뿐이다(게시 후 다시 방문하면 조건이 바뀌어 다시 나타난다).

### 3) 적용 위치

- `app/articles/[id]/blog/page.tsx`: 선택된 글/다른 platform 상세
  영역의 "상세 보기 →/성과 보기 →/Rewrite 관리에서 보기 →/기사
  개요 →" 4개 링크를 `RelatedPostLinks` 하나로 교체.
- `app/articles/[id]/social/page.tsx`: primary/secondary action과
  같은 줄에 있던 "기사 개요 →"를 그 줄에서 빼고, "상세 상태 보기 /
  보조 작업" 접힘 안에 있던 "성과 보기 →"/"재작성 관리에서 보기 →"
  와 합쳐 `RelatedPostLinks` 하나로 통합했다(중복 접힘을 만들지
  않기 위해 기존 접힘 영역 안의 링크는 제거하고 새 컴포넌트로
  옮겼다).
- `app/articles/[id]/rewrite/page.tsx`: 두 곳(재작성 제안 카드,
  재작성 버전 카드) 모두 primary 버튼보다 **먼저** 있던 관련 링크를
  버튼 **아래**로 옮기고 `RelatedPostLinks`로 교체했다. 버전 카드의
  action 행에는 이미 `nextAction` 기반 "성과 보기"(조건부 primary/
  secondary)가 있어, `RelatedPostLinks`에는 중복으로 넣지 않았다.

## 안전 원칙

- 어떤 링크의 이동 대상(href)도 삭제하지 않았다 — 표현/위치만
  바꿨다("상세 보기" → "글 상세 보기", "기사 개요" → "원본 기사
  개요" 등 라벨 문구만 사용자 친화적으로 다듬었다).
- 자동 public publish는 이번 변경과 무관하다(어떤 게시 로직도
  건드리지 않았다).
- 기존 게시 guard/승인 흐름은 변경하지 않았다.

## 이번 작업에서 하지 않은 것 (범위)

- `app/articles/[id]/page.tsx`의 "블로그 글쓰기 관리 →"/"성과 보기
  →" 등은 카드 안 이동 링크 체인이 아니라 페이지 상단의 독립된
  섹션 이동 버튼(각각 다른 색상의 버튼 스타일)이라 이번 정리 대상이
  아니다 — 화살표가 작업 순서를 암시하지도 않고, 각 버튼이 이미
  명확히 구분되어 있다.
- `app/dashboard/page.tsx`는 이번 조사에서 "상세 보기 →" 계열
  체인이 발견되지 않아 변경하지 않았다.

## 테스트

- `lib/social/performance-link-visibility.test.ts`(신규, 4개).
- `components/navigation/related-post-links.test.tsx`(신규, 4개):
  빈 배열/접힘 기본값/화살표 미포함/`defaultOpen` 렌더링 확인.
- `app/articles/[id]/blog/page.test.ts`: 새 describe 1개(3개 테스트)
  추가. 190 → 193개 통과.
- `app/articles/[id]/social/page.test.ts`: 새 describe 1개(3개 테스트)
  추가. 34 → 37개 통과.
- `app/articles/[id]/rewrite/page.test.ts`: 새 describe 1개(3개 테스트)
  추가. 16 → 19개 통과.
- 전체 `npx vitest run`: 246 files / 3146 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류. `npm run build`: 성공.

## 관련 문서

- [`ui-ux-governance-rules.md`](./ui-ux-governance-rules.md)
- [`phase-4-14-social-post-list-inline-body.md`](./phase-4-14-social-post-list-inline-body.md)
- [`phase-4-19-post-card-primary-publish-action.md`](./phase-4-19-post-card-primary-publish-action.md)
