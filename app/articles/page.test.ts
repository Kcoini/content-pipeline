import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const actionsSource = readFileSync(path.join(__dirname, "actions.ts"), "utf8");

describe("기사 목록 삭제(보관 처리) 버튼 (정적 소스 검사)", () => {
  it("기사 목록에 삭제 버튼(archiveArticleAction)이 있다", () => {
    expect(pageSource).toContain("archiveArticleAction");
    expect(pageSource).toContain("ConfirmSubmitButton");
  });

  it("삭제 확인 모달 문구에 연결된 블로그/소셜 글 개수와 WordPress 안내가 포함된다", () => {
    expect(pageSource).toContain("이 기사를 삭제하시겠습니까?");
    expect(pageSource).toMatch(/연결된 블로그 글\/소셜 글 \$\{counts\.socialPostCount\}개/);
    expect(pageSource).toContain("WordPress에 생성된 Draft/Post는 자동 삭제되지 않습니다");
  });

  it("삭제/에러 메시지를 TransientNotice로 표시한다", () => {
    expect(pageSource).toContain("TransientNotice");
    expect(pageSource).toContain("deleteMessage");
    expect(pageSource).toContain("deleteError");
  });

  it("actions.ts는 hard delete가 아니라 archiveArticle(soft delete)만 호출한다", () => {
    expect(actionsSource).toContain("archiveArticle(articleId)");
    expect(actionsSource).not.toMatch(/\.delete\(\)/);
  });

  it("이미 보관된 기사는 article_delete_blocked로 기록하고, 성공 시 article_archived로 기록한다", () => {
    expect(actionsSource).toContain("article_delete_blocked");
    expect(actionsSource).toContain("article_archived");
  });

  it("삭제 전 연관 데이터(getArticleRelatedCounts)를 조회한다", () => {
    expect(actionsSource).toContain("getArticleRelatedCounts(articleId)");
  });

  it("실제 WordPress 원격 삭제 API를 호출하지 않는다", () => {
    expect(actionsSource).not.toMatch(/deletePost|deleteDraft|wp-json.*DELETE/i);
  });
});
