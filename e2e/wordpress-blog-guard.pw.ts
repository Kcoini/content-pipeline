import { test, expect } from "@playwright/test";
import path from "node:path";
import { GENERATED_DIR } from "./support/render-fixture";
import { FIXTURE_NAMES } from "./support/fixture-names";

function fixtureUrl(name: string): string {
  return "file://" + path.join(GENERATED_DIR, `${name}.html`).replace(/\\/g, "/");
}

// QA-01-FIX1 실제 장애 재현: wordpress_blog(quality=ready, approval=approved,
// post body 존재, manual export 미실행)가 더 이상 잘못 차단되지 않는지
// 실제 Chromium 렌더링으로 확인한다.
test.describe("WordPress/blog: FIX1 재현 케이스 — manual export 없이도 정상 진입", () => {
  test("guard가 차단하지 않고(확인할 사항 없음), export_status/export_payload 요구가 사용자에게 보이지 않는다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.guardFix1NotBlocked));

    await expect(page.getByTestId("no-issues-marker")).toBeVisible();
    await expect(page.getByText("게시 전에 확인할 사항이")).toHaveCount(0);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("export_status");
    expect(bodyText).not.toContain("export_payload");
    expect(bodyText).not.toMatch(/\bnot_exported\b/);
  });

  test("승인 완료 후 다음 작업은 'WordPress Draft 만들기'다(공개 게시 버튼 아님, primary 1개, dead-end 없음)", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.wordpressNextActionReady));

    const primaryButtons = page.locator("button", { hasText: "WordPress Draft 만들기" });
    await expect(primaryButtons).toHaveCount(1);
    await expect(page.getByText("공개 게시")).toHaveCount(0);
    await expect(page.getByText("실제 게시")).toHaveCount(0);
    // dead-end 없음: primary action(버튼)이 최소 1개는 항상 존재한다.
    await expect(page.locator("button")).not.toHaveCount(0);
  });
});

test.describe("WordPress/blog: 정상 blocked — 자연어 안내 + raw 정보 기본 비노출", () => {
  test("게시 전에 확인할 사항 개수와 자연어 이유를 보여주고, raw checklist key/UUID/guardScore/ready는 기본 화면에 없다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.guardBlockedNaturalLanguage));

    await expect(page.getByText("게시 전에 확인할 사항이 1개 있습니다.")).toBeVisible();
    await expect(page.getByText("아직 승인되지 않았습니다.")).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("approval_status_approved");
    expect(bodyText).not.toContain("approval_status");
    expect(bodyText).not.toMatch(/guardScore/i);
    expect(bodyText).not.toMatch(/\bready\s*[:=]\s*(true|false)\b/i);
    expect(bodyText).not.toContain("\"failed\"");
  });

  test("'차단됨'/'확인 필요' 계열 문구는 있어도 'failed'라고 오해하게 표시하지 않는다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.guardBlockedNaturalLanguage));
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bfailed\b/i);
  });
});

test.describe("WordPress/blog: guard 실행 성공(blocked 포함)과 실행 예외를 다르게 표시한다", () => {
  test("정상 차단(social_platform_publish_guard_blocked, status=success)은 '차단됨'으로 표시된다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.guardExecutionFailure));
    const items = page.locator("li");
    await expect(items.first()).toContainText("차단됨");
  });

  test("실행 예외(social_platform_publish_guard_failed, status=failed)는 '실패'로 별도 표시된다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.guardExecutionFailure));
    const items = page.locator("li");
    await expect(items.nth(1)).toContainText("실패");
  });

  test("raw 영단어 'success'/'failed'가 배지 텍스트로 그대로 보이지 않는다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.guardExecutionFailure));
    const badgeTexts = await page.locator("li span.rounded-full").allInnerTexts();
    for (const text of badgeTexts) {
      expect(text.trim()).not.toBe("success");
      expect(text.trim()).not.toBe("failed");
    }
  });

  test("상세 JSON 보기는 브라우저 렌더링 기준으로 기본 닫힘이다(펼치기 전에는 guardScore 등이 화면에 보이지 않는다)", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.guardExecutionFailure));

    const detailsEl = page.locator("details").first();
    await expect(detailsEl).toBeVisible();
    expect(await detailsEl.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);

    // 펼치기 전에는 pre(JSON) 내용이 보이지 않는다(브라우저가 <details> 닫힘을 실제로 적용).
    const pre = detailsEl.locator("pre");
    await expect(pre).toBeHidden();

    // 사용자가 펼치면(summary 클릭) 실제로 보인다 — 완전히 숨겨진 게 아니라 접혀 있을 뿐임을 함께 확인한다.
    await detailsEl.locator("summary").click();
    await expect(pre).toBeVisible();
    expect(await pre.innerText()).toContain("guardStatus");
  });

  test("JSON 안에도 secret/token/password/전체 prompt가 없다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.guardExecutionFailure));
    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    expect(bodyText).not.toContain("authorization");
    expect(bodyText).not.toContain("api_key");
    expect(bodyText).not.toContain("app_password");
    expect(bodyText).not.toContain("token");
    expect(bodyText).not.toContain("password");
  });
});

test.describe("WordPress/blog: 좁은 화면/접근성 spot-check", () => {
  test("좁은 화면에서 가로 스크롤(overflow)이 생기지 않는다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.guardBlockedNaturalLanguage));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });

  test("summary(상세 JSON 보기)는 클릭 가능한 접근성 이름을 갖는다", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.guardExecutionFailure));
    const summary = page.locator("summary").first();
    await expect(summary).toHaveText("상세 JSON 보기");
  });

  test("대표 screenshot(정상 blocked 상태)", async ({ page }) => {
    await page.goto(fixtureUrl(FIXTURE_NAMES.guardBlockedNaturalLanguage));
    await page.screenshot({ path: path.join("e2e", ".artifacts", "screenshots", "wordpress-guard-blocked.png") });
  });
});
