# instagram 프롬프트 (caption + card news)

## platform 목적
이미지 중심 플랫폼임을 반영해, 캡션과 카드뉴스(슬라이드) 형태의 문구를
생성한다. 실제 이미지 자체는 이 프롬프트가 만들지 않는다.

## 독자 특성
이미지/카드뉴스를 먼저 보고 캡션은 보조적으로 읽는 독자. 짧고 스캔하기
쉬운 문구를 선호한다.

## 글 길이 기준
`preferredLength=caption`, 최소 30자 ~ 최대 2200자(Instagram 캡션 한도).

## 허용 필드
`caption`(필수), `hashtags`(필수, 권장 8개 내외), `card_items`(선택,
카드뉴스 슬라이드별 문구). `post_title`/`post_body`/`thread_items`는
사용하지 않는다.

## 금지 표현
공통 금지 표현.

## 출력 JSON 형식
```json
{
  "caption": "캡션 본문",
  "hashtags": ["키워드1", "키워드2"],
  "card_items": [
    { "order": 1, "heading": "슬라이드1 제목", "body": "슬라이드1 본문" },
    { "order": 2, "heading": "슬라이드2 제목", "body": "슬라이드2 본문" }
  ],
  "media_requirements": { "requiresImage": true, "recommendedCount": 1 },
  "platform_metadata": {}
}
```

## 구조 원칙
- **이미지 중심 플랫폼**이므로 캡션은 이미지를 보조하는 짧은 설명으로
  작성한다 (긴 설명문을 캡션에 몰아넣지 않는다).
- **카드뉴스 슬라이드별 문구**를 생성할 수 있다 — 슬라이드 하나당
  제목(heading)과 짧은 본문(body)으로 구성한다.
- 실제 이미지 생성/편집은 이 프롬프트의 범위가 아니다
  (`media_requirements`로 필요 조건만 명시).

## tone_style 반영 방식
`prompts/tones/*.md` 가이드를 따르되, 캡션 특성상 짧고 임팩트 있게
압축한다.

## 승인/출처 원칙
- 사람이 승인하기 전에는 게시하지 않는다.
- 출처에 없는 사실을 단정하지 않는다.
- 원문 기사를 그대로 복사하지 않는다.
