// PRODUCT-01D: 첫 사용(welcome) 빈 상태와 /dashboard/settings를 실제
// 브라우저(desktop + narrow)에서 확인한다. Settings는 DB 의존이 없는
// 서버 컴포넌트라 실제 SettingsPage를 그대로 구운 fixture를 연다.
// welcome 빈 상태는 app/dashboard/page.tsx가 async/DB 의존이라 그
// 분기의 JSX만 재현한 fixture를 연다(e2e/generate-fixtures.setup.tsx
// 주석 참고).
import { test, expect } from "@playwright/test";
import path from "node:path";
import { GENERATED_DIR } from "./support/render-fixture";
import { FIXTURE_NAMES } from "./support/fixture-names";

function fixtureUrl(name: string): string {
  return "file://" + path.join(GENERATED_DIR, `${name}.html`).replace(/\\/g, "/");
}

test.describe("첫 사용(welcome) 빈 상태", () => {
  test("환영 문구/5단계 안내/첫 콘텐츠 만들기 버튼이 보이고, 좁은 화면에서도 잘려 보이지 않는다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.dashboardWelcomeEmptyState));

    await expect(page.getByText("환영합니다.")).toBeVisible();
    await expect(page.getByRole("link", { name: "첫 콘텐츠 만들기" })).toBeVisible();
    await expect(page.getByText("1. 주제 선택")).toBeVisible();
    await expect(page.getByText("5. 게시 준비")).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("첫 콘텐츠 만들기 버튼은 실제 테마 목록 위치(#theme-list)로 연결된다(가짜 wizard 경로 아님)", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.dashboardWelcomeEmptyState));

    await expect(page.getByRole("link", { name: "첫 콘텐츠 만들기" })).toHaveAttribute("href", "#theme-list");
  });
});

test.describe("/dashboard/settings — 서비스 준비 완료 상태", () => {
  test("연결 상태가 '사용 가능'/'연결됨'으로 보이고, 기술 용어가 화면에 없다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.settingsReady));

    await expect(page.getByRole("heading", { name: "설정", exact: true })).toBeVisible();
    await expect(page.getByText("연결됨")).toBeVisible();
    await expect(page.getByText("항상 초안(Draft)으로 저장됩니다", { exact: false })).toBeVisible();
    await expect(page.getByText("WORDPRESS_BASE_URL", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Supabase", { exact: false })).toHaveCount(0);

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("출처 확인/최종 확인 안전 항목에는 끄는 버튼이 없다(항상 '사용 중')", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.settingsReady));

    await expect(page.getByText("사용 중").first()).toBeVisible();
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
  });
});

test.describe("/dashboard/settings — 일부 확인 필요 상태", () => {
  test("WordPress를 '연결 안 됨'으로 단정하지 않고 확인을 요청하는 문구를 보여준다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.settingsPartial));

    await expect(page.getByText("확인해 주세요", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("관리자에게 연결 설정을 요청해 주세요", { exact: false })).toBeVisible();
    await expect(page.getByText(">연결하기<", { exact: false })).toHaveCount(0);
  });
});
