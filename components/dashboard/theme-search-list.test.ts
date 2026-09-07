import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const componentSource = readFileSync(path.join(__dirname, "theme-search-list.tsx"), "utf8");

describe("ThemeSearchList (정적 소스 검사, Phase 1-23)", () => {
  it("filterThemesByQuery(순수 함수)를 재사용해 검색어로 즉시 필터링한다", () => {
    expect(componentSource).toContain('import { filterThemesByQuery } from "@/lib/dashboard/theme-search"');
    expect(componentSource).toMatch(/filterThemesByQuery\(items, query, \(entry\) => entry\.theme\.title\)/);
  });

  it("검색 input에 접근성 라벨을 제공한다", () => {
    expect(componentSource).toContain('type="search"');
    expect(componentSource).toContain('aria-label="테마 검색"');
  });

  it("archiveThemeAction(삭제)은 prop으로 전달받아 그대로 사용한다(기능 로직 변경 없음)", () => {
    expect(componentSource).toContain("archiveAction: (formData: FormData) => void | Promise<void>");
    expect(componentSource).toContain("<form action={archiveAction}>");
  });

  it("삭제 버튼은 작고 옅은 색으로 우측 보조 영역에 둔다(강하게 보이지 않게)", () => {
    expect(componentSource).toMatch(/text-\[10px\] font-medium text-zinc-400/);
  });

  it("동일 제목 테마를 구분할 수 있도록 출처 수/진행 단계/등록일을 부제목으로 표시한다 (Phase 3-23-3)", () => {
    expect(componentSource).toContain("stageLabel");
    expect(componentSource).toContain("dateLabel");
    expect(componentSource).toMatch(/출처 \{sourceCount\} · \{stageLabel\} · \{dateLabel\}/);
  });
});
