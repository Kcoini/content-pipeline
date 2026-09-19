import { test, expect } from "@playwright/test";
import path from "node:path";
import { GENERATED_DIR } from "./support/render-fixture";
import { FIXTURE_NAMES } from "./support/fixture-names";

function fixtureUrl(name: string): string {
  return "file://" + path.join(GENERATED_DIR, `${name}.html`).replace(/\\/g, "/");
}

test.describe("Multi-platform: 검토 요약 카드 — raw 상태값 비노출", () => {
  test("자연어 라벨(게시 전 해결 필요/확인 필요/확인할 사항 없음/승인 완료)만 보이고 raw enum이 없다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.multiPlatformReviewSummary));

    await expect(page.getByText("게시 전 해결 필요")).toBeVisible();
    await expect(page.getByText("확인 필요", { exact: true })).toBeVisible();
    await expect(page.getByText("확인할 사항 없음")).toBeVisible();
    await expect(page.getByText("승인 완료")).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    for (const raw of ["ready", "needs_confirmation", "blocked", "checking", "failed", "approval_status"]) {
      expect(bodyText).not.toMatch(new RegExp(`\\b${raw}\\b`));
    }
  });
});

test.describe("게시 준비: 요약 카드 — raw state 비노출, Draft/공개 게시 혼동 없음", () => {
  test("자연어 라벨만 보이고, '게시 준비 완료'가 '공개 게시 완료'로 오인될 문구를 쓰지 않는다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.publishPreparationSummary));

    await expect(page.getByText("게시 준비 완료")).toBeVisible();
    await expect(page.getByText("공개 게시 완료")).toHaveCount(0);
    await expect(page.getByText("게시 완료")).toHaveCount(0);

    const bodyText = await page.locator("body").innerText();
    for (const raw of ["not_approved", "needs_attention", "needs_setup", "in_progress", "publish_status", "export_status"]) {
      expect(bodyText).not.toMatch(new RegExp(`\\b${raw}\\b`));
    }
  });
});

test.describe("X thread: inline 편집기 — 페이지 이동 없는 카드 내 편집", () => {
  test("thread item마다 별도 textarea가 있고(순서 보존), 280자 제한 안내가 보인다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.xThreadInlineEditor));

    const textareas = page.locator("textarea[name='threadItemText']");
    await expect(textareas).toHaveCount(2);
    await expect(textareas.nth(0)).toHaveValue("첫 번째 트윗입니다.");
    await expect(textareas.nth(1)).toHaveValue("두 번째 트윗입니다.");
    await expect(page.getByText("(11/280자)").first()).toBeVisible();
  });

  test("저장 action이 primary(저장 후 승인) 1개 + secondary 여러 개로 구성되고, 화면 이동(<a>) 없이 폼 제출 버튼만 있다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.xThreadInlineEditor));

    await expect(page.getByRole("button", { name: "저장 후 승인" })).toBeVisible();
    await expect(page.locator("a")).toHaveCount(0);
  });
});

test.describe("본문 복사/전체 보기/본문 수정 버튼 행 — 항상 같은 순서, inline 편집 원칙", () => {
  test("버튼 순서가 [본문 복사] → [전체 보기] → [본문 수정]이다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.postBodyActionRow));

    const buttons = page.locator("button");
    await expect(buttons).toHaveCount(3);
    await expect(buttons.nth(0)).toHaveText("본문 복사");
    await expect(buttons.nth(1)).toHaveText("전체 보기");
    await expect(buttons.nth(2)).toHaveText("본문 수정");
  });

  test("'본문 수정'은 <a>(navigation)이 아니라 <button>(inline)이다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.postBodyActionRow));
    const editButton = page.getByRole("button", { name: "본문 수정" });
    await expect(editButton).toBeVisible();
    expect(await page.locator("a", { hasText: "본문 수정" }).count()).toBe(0);
  });

  test("좁은 화면에서도 버튼 행이 넘치지 않고 줄바꿈된다(flex-wrap)", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.postBodyActionRow));
    const row = page.locator("div.flex-wrap").first();
    await expect(row).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
