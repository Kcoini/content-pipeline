import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Phase UX-07: H5(관리자 접힘 카테고리 그룹핑)/H6(본문 수정 vs 글 정보
 * 편집 용어 구분)가 다시 무너지지 않는지 회귀 검사한다. UX-06의
 * ux-invariants.test.ts/raw-technical-info.test.ts와 별도로, 이번
 * Phase에서 새로 만든 구조만 좁게 검사한다.
 */

function readPage(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf-8");
}

describe("UX-07 H5: /articles/[id] 관리자 접힘 카테고리 그룹핑", () => {
  const source = readPage("app/articles/[id]/page.tsx");

  it("관리자 기능 접힘은 기본 닫힘 상태다(open 속성 없음)", () => {
    const marker = source.indexOf("관리자 기능: 원본 article WordPress 전송");
    const before = source.slice(Math.max(0, marker - 300), marker);
    expect(before).toContain("<details>");
    expect(before).not.toMatch(/<details\s+open/);
  });

  it("관리자 기능 내부가 4개의 카테고리 accordion으로 묶여 있다(한꺼번에 쏟아지지 않음)", () => {
    expect(source).toContain("SEO 연동");
    expect(source).toContain("대표 이미지");
    expect(source).toContain("WordPress 연결 · 반영 실행 (실행/진단 정보)");
    expect(source).toContain("게시 안전 설정");
  });

  it("새로 추가한 카테고리 accordion도 기본 닫힘 상태다", () => {
    const labels = ["SEO 연동", "대표 이미지", "WordPress 연결 · 반영 실행 \\(실행/진단 정보\\)", "게시 안전 설정"];
    for (const label of labels) {
      const pattern = new RegExp(
        `<details className="rounded border border-amber-200 bg-white">\\s*<summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-amber-700">\\s*${label}`,
      );
      expect(source).toMatch(pattern);
    }
  });

  it("⚠ 관리자 전용 공개 게시 이중 접힘은 카테고리 accordion에 흡수되지 않고 여전히 별도로 분리되어 있다", () => {
    expect(source).toContain("⚠ 관리자 전용: WordPress 실제 공개 게시");
  });
});

describe("UX-07 H6: /social-posts/[id] 글 정보 편집과 본문 수정(inline)의 용어 구분", () => {
  const detailSource = readPage("app/social-posts/[id]/page.tsx");

  it("상세 페이지의 다중 필드 편집 탭은 '수정하기'가 아니라 '글 정보 편집'으로 표기한다", () => {
    expect(detailSource).toContain('"글 정보 편집"');
    expect(detailSource).not.toContain('"수정하기"');
  });

  it("'글 정보 편집'은 본문 외 필드(제목/캡션/해시태그/스레드)도 함께 다룬다는 안내를 포함한다", () => {
    const idx = detailSource.indexOf("글 정보 편집</h2>");
    const after = detailSource.slice(idx, idx + 400);
    expect(after).toContain("본문 수정");
  });

  it("카드형 화면의 inline 본문 수정 버튼은 여전히 '본문 수정'이라는 별도 용어를 쓴다(post-body-action-row.tsx)", () => {
    const rowSource = readPage("components/social/post-body-action-row.tsx");
    expect(rowSource).toContain("본문 수정");
  });
});
