import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { E2E_USERS } from "./support/users";

async function login(page: Page, user: (typeof E2E_USERS)[keyof typeof E2E_USERS]) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/home$/);
}

async function createLoggedInPage(
  browser: Browser,
  baseURL: string,
  user: (typeof E2E_USERS)[keyof typeof E2E_USERS],
) {
  const context = await browser.newContext({ baseURL, locale: "zh-CN", timezoneId: "Asia/Shanghai" });
  const page = await context.newPage();
  await login(page, user);
  return { context, page };
}

test.describe.serial("Friend connections", () => {
  let requesterContext: BrowserContext;
  let requesterPage: Page;
  let addresseeContext: BrowserContext;
  let addresseePage: Page;

  test.beforeAll(async ({ baseURL, browser }) => {
    if (!baseURL) throw new Error("Friend connections require a Playwright baseURL.");
    ({ context: requesterContext, page: requesterPage } = await createLoggedInPage(browser, baseURL, E2E_USERS.connector));
    ({ context: addresseeContext, page: addresseePage } = await createLoggedInPage(browser, baseURL, E2E_USERS.candidate));
  });

  test.afterAll(async () => {
    await Promise.all([requesterContext.close(), addresseeContext.close()]);
  });

  test("searches by email, confirms friendship, and opens a realtime direct chat", async () => {
    await requesterPage.goto("/messages");
    await requesterPage.getByRole("button", { name: "搜索并添加好友" }).click();
    const requesterDialog = requesterPage.getByRole("dialog", { name: "好友中心" });
    await requesterDialog.locator("#friend-search").fill(E2E_USERS.candidate.email);
    await requesterDialog.getByRole("button", { name: "搜索", exact: true }).click();

    const candidateResult = requesterDialog.locator("article").filter({ hasText: E2E_USERS.candidate.nickname });
    await expect(candidateResult).toContainText("c***@golden-b.local");
    await requesterDialog.locator("#friend-introduction").fill("你好！想和你交流校园产品设计，也希望加个好友。");
    await candidateResult.getByRole("button", { name: "添加" }).click();
    await expect(requesterDialog.getByText(`已向 ${E2E_USERS.candidate.nickname} 发送好友申请。`)).toBeVisible();

    await addresseePage.goto("/messages");
    await addresseePage.getByRole("button", { name: /添加好友，1 条待处理申请/ }).click();
    const addresseeDialog = addresseePage.getByRole("dialog", { name: "好友中心" });
    const incomingCard = addresseeDialog.locator("article").filter({ hasText: E2E_USERS.connector.nickname });
    await expect(incomingCard).toContainText("你好！想和你交流校园产品设计，也希望加个好友。");
    await incomingCard.getByRole("button", { name: "接受并聊天" }).click();

    await expect(addresseePage).toHaveURL(/\/messages\?conversation=[0-9a-f-]+$/);
    await expect(addresseePage.getByRole("heading", { name: E2E_USERS.connector.nickname })).toBeVisible();
    await expect(addresseePage.getByRole("link", { name: "查看资料" })).toHaveAttribute("href", /\/profile\/[0-9a-f-]+$/);

    const firstMessage = "好友申请已收到，我们从原型思路开始聊吧。";
    await addresseePage.locator('form textarea[placeholder="输入消息…"]').fill(firstMessage);
    await addresseePage.getByRole("button", { name: "发送消息" }).click();
    await expect(addresseePage.getByText(firstMessage)).toBeVisible();

    await requesterPage.goto("/messages");
    await expect(requesterPage.getByRole("heading", { name: E2E_USERS.candidate.nickname })).toBeVisible();
    await expect(requesterPage.getByText(firstMessage)).toBeVisible();

    const reply = "好，我们先对齐目标用户和核心场景。";
    await requesterPage.locator('form textarea[placeholder="输入消息…"]').fill(reply);
    await requesterPage.getByRole("button", { name: "发送消息" }).click();
    await expect(addresseePage.getByText(reply)).toBeVisible({ timeout: 15_000 });
  });
});
