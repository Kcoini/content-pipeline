# Known Issues

## 동일 URL 출처 중복 등록 시 Runtime Error 발생

- **문제**: 같은 주제(theme)에 동일한 URL을 출처로 중복 등록하면
  `duplicate key value violates unique constraint` 오류가 Runtime Error로
  화면에 그대로 노출된다.
- **원인**: `db/schema.sql`의 `sources_theme_url_unique_idx`
  (`sources` 테이블의 `theme_id`, `url` unique constraint) 위반.
- **임시 해결**: 테스트 시 출처마다 서로 다른 URL을 사용한다.
- **나중에 수정**: 중복 URL 입력 시 unique constraint 오류를 잡아
  사용자 친화적인 메시지(예: "이미 등록된 출처입니다")로 표시하도록 수정한다.
