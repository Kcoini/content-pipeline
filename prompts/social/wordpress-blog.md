# wordpress_blog 프롬프트

## platform 목적
검색 유입을 목표로 하는 긴 SEO형 블로그 글을 작성한다. 기존 WordPress
발행 파이프라인(Phase 2)의 article과 동일한 성격이며, 이 프롬프트는
article을 다른 플랫폼용으로 "변환"할 때 재사용하는 경우를 위한 것이다.

## 독자 특성
검색을 통해 유입되는 독자. 구체적인 정보/기준/절차를 원하며 체류시간이
길어질수록 검색엔진 평가에 유리하다.

## 글 길이 기준
`preferredLength=long`, 최소 800자 ~ 최대 8000자
(`lib/social/platform-writing-config.ts`의 `wordpress_blog` 설정과 일치).

## 허용 필드
`post_title`(필수), `post_body`(필수), `excerpt`(선택), `hashtags`는
지원하지 않음(WordPress는 카테고리/태그를 별도 필드로 관리).

## 금지 표현
공통 금지 표현(`prompts/safety/*.md` 참고) + 광고 클릭 유도 문구 + 허위/
과장 수익 보장 표현.

## 출력 JSON 형식
```json
{
  "post_title": "SEO 제목",
  "post_body": "본문 (markdown, h2/h3 구조 포함)",
  "excerpt": "요약 (선택)",
  "hashtags": [],
  "platform_metadata": { "seoTitle": "", "metaDescription": "" }
}
```

## tone_style 반영 방식
`prompts/tones/*.md`에 정의된 문체 가이드를 본문 어조에 반영하되, 구조
(h2/h3, 목차, 체크리스트 등)는 유지한다.

## 구조
- h2/h3 소제목으로 섹션을 구분한다.
- 도입부 → 핵심 정보 → (필요 시) 비교/체크리스트 → 결론 순서를 권장한다.

## SEO title/meta description과의 관계
article에 이미 저장된 `seo_title`/`meta_description`과 충돌하지 않도록
작성한다 — 이 프롬프트가 만드는 `post_title`/`excerpt`는 그것을 대체하지
않고 보완하는 역할이다.

## AD_SLOT marker
기존 article이 `monetized_blog` 모드이고 이미 AD_SLOT marker
(`lib/articles/article-modes.ts`의 `AD_SLOT_MARKERS`)를 포함하고 있다면,
그 기준을 그대로 존중한다 — 이 프롬프트가 새로운 광고 슬롯 배치 규칙을
임의로 만들지 않는다.

## 승인/출처 원칙
- 사람이 승인하기 전에는 게시하지 않는다 (자동 게시 금지).
- 출처에 없는 사실을 단정하지 않는다.
- 원문 기사를 그대로 복사하지 않는다 (반드시 재구성해서 작성한다).
