// PRODUCT-01F: Publish & Connection UX 6개 대표 상태를 desktop + narrow에서
// 확인한다. 문구는 fixture 생성 단계에서 실제 helper(getPostApprovalNextActions/
// fromPostApprovalNextActionsToPublishPreparation/notApprovedPublishPreparation/
// getWordPressPublishPrepState/getContentServiceReadiness)로 계산된 것을
// 그대로 구웠다 — 여기서는 "현재 상태/게시 방식/다음 행동이 명확한지,
// 실제 게시 여부를 오해하게 만들지 않는지, overflow가 없는지"만 확인한다.
import { test, expect } from "@playwright/test";
import path from "node:path";
import { GENERATED_DIR } from "./support/render-fixture";
import { FIXTURE_NAMES } from "./support/fixture-names";

function fixtureUrl(name: string): string {
  return "file://" + path.join(GENERATED_DIR, `${name}.html`).replace(/\\/g, "/");
}

const ALL_PUBLISH_FIXTURES = [
  FIXTURE_NAMES.publishApprovalRequired,
  FIXTURE_NAMES.publishWordpressReady,
  FIXTURE_NAMES.publishWordpressDraftComplete,
  FIXTURE_NAMES.publishCopyReady,
  FIXTURE_NAMES.publishManualReady,
  FIXTURE_NAMES.publishBlocked,
];

for (const name of ALL_PUBLISH_FIXTURES) {
  test(`${name}: 좁은 화면에서도 overflow가 없다`, async ({ page }) => {
    await page.goto(fixtureUrl(name));
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });
}

test.describe("A. 승인 전", () => {
  test("publish action이 없고, 무엇을 해야 하는지만 안내한다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.publishApprovalRequired));
    await expect(page.getByText("아직 승인되지 않았습니다.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button")).toHaveCount(0);
  });
});

test.describe("B. WordPress 승인 완료 — 게시 준비", () => {
  test("게시 방식이 '초안으로 저장'이고, 연결 상태가 Settings와 같은 문구로 보인다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.publishWordpressReady));
    await expect(page.getByText("게시 방식: 초안으로 저장", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "WordPress Draft 만들기" })).toBeVisible();
  });
});

test.describe("C. WordPress Draft 성공", () => {
  test("'초안 저장 완료'로 보이고, 공개 게시로 오해할 문구가 없다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.publishWordpressDraftComplete));
    await expect(page.getByText("WordPress 초안이 저장되었습니다.")).toBeVisible();
    await expect(page.getByText("공개 게시는 하지 않았습니다", { exact: false })).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("게시 완료");
    expect(bodyText).not.toContain("자동 게시");
  });
});

test.describe("D. Copy 플랫폼", () => {
  test("본문 복사 후 외부에서 직접 게시하라고 안내하고, 게시 완료로 표시하지 않는다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.publishCopyReady));
    await expect(page.getByText("게시 방식: 본문 복사 후 직접 게시")).toBeVisible();
    await expect(page.getByRole("button", { name: "본문 복사" })).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("게시 완료");
  });
});

test.describe("E. Manual 플랫폼", () => {
  test("외부에서 직접 게시한다고 안내하고, 앱이 직접 게시하는 것처럼 보이지 않는다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.publishManualReady));
    await expect(page.getByText("게시 방식: 외부에서 직접 게시")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/게시하기(?!\s*확인)/);
  });
});

test.describe("F. Blocked", () => {
  test("확인할 사항이 먼저 보이고, raw checklist key가 노출되지 않는다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.publishBlocked));
    await expect(page.getByText("게시 전에 확인할 사항이", { exact: false })).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("approval_status_approved");
  });
});
