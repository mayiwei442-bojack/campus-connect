import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { E2E_USERS } from "./support/users";

const PLACE_ID = "library";
const INTENT = "产品设计 校园应用 原型共创";

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

test.describe.serial("Golden path B", () => {
  let connectorContext: BrowserContext;
  let connectorPage: Page;
  let candidateContext: BrowserContext;
  let candidatePage: Page;

  test.beforeAll(async ({ baseURL, browser }) => {
    if (!baseURL) throw new Error("Golden path B requires a Playwright baseURL.");
    ({ context: connectorContext, page: connectorPage } = await createLoggedInPage(browser, baseURL, E2E_USERS.connector));
    ({ context: candidateContext, page: candidatePage } = await createLoggedInPage(browser, baseURL, E2E_USERS.candidate));
  });

  test.afterAll(async () => {
    await Promise.all([connectorContext.close(), candidateContext.close()]);
  });

  test("turns a Connect recommendation into an accepted Activity invitation and realtime chat", async () => {
    await connectorPage.goto("/connect");
    await connectorPage.locator("#connect-intent").fill(INTENT);
    await connectorPage.getByRole("button", { name: "开始推荐" }).click();

    await expect(connectorPage.getByRole("heading", { name: "推荐同学" })).toBeVisible();
    const candidateCard = connectorPage.locator("article").filter({ hasText: E2E_USERS.candidate.nickname });
    await expect(candidateCard).toBeVisible();
    await expect(candidateCard.getByText(/公开 Skill：产品设计/)).toBeVisible();
    await expect(candidateCard.getByText(/已确认 Persona「共创搭档」/)).toBeVisible();

    const profileHref = await candidateCard.getByRole("link", { name: /查看 Profile/ }).getAttribute("href");
    const invitationHref = await candidateCard.getByRole("link", { name: "创建活动并邀请" }).getAttribute("href");
    expect(profileHref).toMatch(/^\/profile\/[0-9a-f-]+$/);
    expect(invitationHref).toMatch(/^\/activities\/new\?/);

    await connectorPage.goto(profileHref!);
    await expect(connectorPage.getByRole("heading", { name: E2E_USERS.candidate.nickname, exact: true })).toBeVisible();
    await expect(connectorPage.getByRole("heading", { name: "已公开的 Persona" })).toBeVisible();
    await expect(connectorPage.getByRole("heading", { name: "共创搭档", exact: true })).toBeVisible();
    await expect(connectorPage.getByText("校园应用产品设计经验", { exact: false })).toBeVisible();

    await connectorPage.goto(invitationHref!);
    await expect(connectorPage.getByText(`创建成功后会同时向 ${E2E_USERS.candidate.nickname} 发送活动邀请`, { exact: false })).toBeVisible();
    const activityForm = connectorPage.locator('form:has(input[name="title"])');
    await expect(activityForm.locator('input[name="title"]')).toHaveValue(INTENT);
    await activityForm.locator('select[name="placeId"]').selectOption(PLACE_ID);
    await activityForm.locator('input[name="capacity"]').fill("4");
    await activityForm.locator('textarea[name="description"]').fill("黄金路径 B：从推荐、邀请到实时协作聊天。");
    await activityForm.getByRole("button", { name: "创建活动" }).click();
    await expect(connectorPage).toHaveURL(/\/activities\/[0-9a-f-]+$/);
    const activityUrl = connectorPage.url();
    await expect(connectorPage.getByRole("heading", { name: INTENT })).toBeVisible();

    await candidatePage.goto("/notifications");
    const invitationCard = candidatePage.locator("article").filter({ hasText: INTENT });
    await expect(invitationCard).toContainText(`${E2E_USERS.connector.nickname} 邀请你参加`);
    await invitationCard.getByRole("button", { name: "接受并查看活动" }).click();
    await expect(candidatePage).toHaveURL(new RegExp(`${new URL(activityUrl).pathname}$`));
    await expect(candidatePage.getByRole("link", { name: "进入活动群聊" })).toBeVisible();

    await candidatePage.getByRole("link", { name: "进入活动群聊" }).click();
    await connectorPage.getByRole("link", { name: "进入活动群聊" }).click();
    await expect(candidatePage.getByText("实时连接")).toBeVisible({ timeout: 15_000 });
    await expect(connectorPage.getByText("实时连接")).toBeVisible({ timeout: 15_000 });

    const message = "邀请已接受，我们从产品原型开始协作。";
    await candidatePage.locator("textarea").fill(message);
    await candidatePage.getByRole("button", { name: "发送消息" }).click();
    await expect(candidatePage.getByText(message)).toBeVisible();
    await connectorPage.reload();
    await expect(connectorPage.getByText(message)).toBeVisible();
  });
});
