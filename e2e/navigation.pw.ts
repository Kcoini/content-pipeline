// PRODUCT-01C: 상단 navigation trigger를 실제 브라우저에서 확인한다.
// DashboardTopNav는 client component(useState로 드롭다운 열림/닫힘을
// 관리)라 hydration 없는 fixture에서는 열린 상태를 실제로 클릭해
// 재현할 수 없다(e2e/support/render-fixture.ts 주석 참고) — 그래서
// 여기서는 "기본(닫힘) 상태의 트리거"만 실제 브라우저 렌더링으로
// 확인한다. admin/user 그룹 분리(구분선/안내 문구)는 정적 소스 검사
// (components/navigation/dashboard-top-nav.test.ts)로 이미 검증되어
// 있다 — 이 파일은 "실제 CSS로 렌더링했을 때 트리거가 올바르게
// 보이는지"를 보완한다.
import { test, expect } from "@playwright/test";
import path from "node:path";
import { GENERATED_DIR } from "./support/render-fixture";
import { FIXTURE_NAMES } from "./support/fixture-names";

function fixtureUrl(name: string): string {
  return "file://" + path.join(GENERATED_DIR, `${name}.html`).replace(/\\/g, "/");
}

test.describe("상단 navigation 트리거 — '대시보드'가 아니라 '메뉴'다", () => {
  test("트리거 라벨이 '메뉴'로 보이고, '대시보드'라는 문구는 어디에도 없다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.dashboardTopNavClosed));

    await expect(page.getByRole("button", { name: /메뉴/ })).toBeVisible();
    await expect(page.getByText("대시보드", { exact: false })).toHaveCount(0);
  });

  test("트리거 버튼에 드롭다운 접근성 속성이 있다(aria-haspopup/aria-expanded)", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.dashboardTopNavClosed));

    const trigger = page.getByRole("button", { name: /메뉴/ });
    await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("좁은 화면에서도 상단 영역이 가로로 넘치지 않는다(줄바꿈/overflow 없음)", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.dashboardTopNavClosed));

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });
});
