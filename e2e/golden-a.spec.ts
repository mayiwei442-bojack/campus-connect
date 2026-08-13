import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { E2E_USERS } from "./support/users";

const PLACE_ID = "tennis_5";
const PLACE_LABEL = "Tennis 5";
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nCEAAAAASUVORK5CYII=",
  "base64",
);

async function login(page: Page, user: (typeof E2E_USERS)[keyof typeof E2E_USERS]) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: /今天想一起/ })).toBeVisible();
}

async function createActivity(
  page: Page,
  { capacity, joinMode, title }: { capacity?: number; joinMode: "approval" | "free"; title: string },
) {
  await page.goto("/activities/new");
  const form = page.locator('form:has(input[name="title"])');
  await form.locator('input[name="title"]').fill(title);
  await form.locator('select[name="placeId"]').selectOption(PLACE_ID);
  if (capacity) await form.locator('input[name="capacity"]').fill(String(capacity));
  await form.locator(`input[name="joinMode"][value="${joinMode}"]`).check();
  await form.locator('textarea[name="description"]').fill("Playwright 黄金路径 A 验收活动");
  await form.getByRole("button", { name: "创建活动" }).click();
  await expect(page).toHaveURL(/\/activities\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return page.url();
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

async function createOwnerAssertionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error("Golden path A database assertions require the isolated local Supabase public client.");
  }
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: E2E_USERS.owner.email,
    password: E2E_USERS.owner.password,
  });
  if (error) throw new Error(`Unable to establish the local owner assertion session: ${error.message}`);
  return client;
}

function activityIdFromUrl(url: string) {
  const activityId = new URL(url).pathname.split("/").at(-1);
  if (!activityId) throw new Error(`Unable to resolve Activity id from ${url}`);
  return activityId;
}

test.describe.serial("Golden path A", () => {
  let ownerContext: BrowserContext;
  let ownerPage: Page;
  let memberContext: BrowserContext;
  let memberPage: Page;
  let waiterContext: BrowserContext;
  let waiterPage: Page;
  let reserveContext: BrowserContext;
  let reservePage: Page;
  let approvalActivityUrl: string;
  let freeActivityUrl: string;

  test.beforeAll(async ({ baseURL, browser }) => {
    if (!baseURL) throw new Error("Golden path A requires a Playwright baseURL.");
    ({ context: ownerContext, page: ownerPage } = await createLoggedInPage(browser, baseURL, E2E_USERS.owner));
    ({ context: memberContext, page: memberPage } = await createLoggedInPage(browser, baseURL, E2E_USERS.member));
    ({ context: waiterContext, page: waiterPage } = await createLoggedInPage(browser, baseURL, E2E_USERS.waiter));
    ({ context: reserveContext, page: reservePage } = await createLoggedInPage(browser, baseURL, E2E_USERS.reserve));
  });

  test.afterAll(async () => {
    await Promise.all([ownerContext.close(), memberContext.close(), waiterContext.close(), reserveContext.close()]);
  });

  test("protects authenticated routes", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test("creates an approval activity, joins chat, exchanges realtime media, opens Profile, and archives history", async () => {
    const title = "E2E 审批制共创";
    approvalActivityUrl = await createActivity(ownerPage, { capacity: 2, joinMode: "approval", title });

    await ownerPage.goto("/home");
    await expect(ownerPage.getByRole("heading", { name: title })).toBeVisible();

    await memberPage.goto("/home");
    await memberPage.locator('aside a[href="/map"]').click();
    await expect(memberPage).toHaveURL(/\/map$/);
    await expect(memberPage.getByText("73 组节点已配对")).toBeVisible({ timeout: 30_000 });
    await memberPage.locator('input[placeholder*="library"]').fill(PLACE_ID);
    await memberPage.getByRole("button", { name: /Library.*PLACE_library/i }).click();
    await expect(memberPage.getByText("ANCHOR_library")).toBeVisible();
    await memberPage.getByRole("link", { name: title }).click();
    await expect(memberPage).toHaveURL(new RegExp(`${new URL(approvalActivityUrl).pathname}$`));
    await memberPage.getByRole("button", { name: "申请加入" }).click();
    await expect(memberPage.getByRole("button", { name: "退出活动" })).toBeVisible();

    await ownerPage.goto(approvalActivityUrl);
    await expect(ownerPage.getByRole("link", { name: E2E_USERS.member.nickname })).toBeVisible();
    await ownerPage.getByRole("button", { name: "通过" }).click();
    await expect(ownerPage.getByText("已加入 · 2")).toBeVisible();

    await memberPage.reload();
    await expect(memberPage.getByRole("link", { name: "进入活动群聊" })).toBeVisible();
    await memberPage.getByRole("link", { name: "进入活动群聊" }).click();
    await ownerPage.getByRole("link", { name: "进入活动群聊" }).click();
    await expect(memberPage.getByText("实时连接")).toBeVisible({ timeout: 15_000 });
    await expect(ownerPage.getByText("实时连接")).toBeVisible({ timeout: 15_000 });

    const message = "来自 E2E Member 的实时消息";
    await memberPage.locator("textarea").fill(message);
    await memberPage.getByRole("button", { name: "发送消息" }).click();
    await expect(memberPage.getByText(message)).toBeVisible();
    await expect(ownerPage.getByText(message)).toBeVisible({ timeout: 15_000 });

    await memberPage.locator('input[type="file"]').setInputFiles({
      name: "golden-a.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    await expect(ownerPage.getByRole("img", { name: "聊天图片" })).toBeVisible({ timeout: 15_000 });

    await memberPage.goto(approvalActivityUrl);
    await memberPage.getByRole("link", { name: E2E_USERS.owner.nickname }).click();
    await expect(memberPage.getByRole("heading", { name: E2E_USERS.owner.nickname, exact: true })).toBeVisible();
    await expect(memberPage.getByText(/公开 Skill/)).toBeVisible();

    await ownerPage.goto(approvalActivityUrl);
    await ownerPage.getByRole("button", { name: "结束并归档活动" }).click();
    await ownerPage.goto("/messages");
    await expect(ownerPage.getByText("只读归档")).toBeVisible();
    await expect(ownerPage.getByText(message)).toBeVisible();
    await expect(ownerPage.locator("textarea")).toBeDisabled();
  });

  test("serializes concurrent joins and promotes two waiters in FIFO order", async () => {
    freeActivityUrl = await createActivity(ownerPage, {
      capacity: 2,
      joinMode: "free",
      title: "E2E 自由加入与候补",
    });

    const activityId = activityIdFromUrl(freeActivityUrl);
    const ownerAssertions = await createOwnerAssertionClient();

    await memberPage.goto(freeActivityUrl);
    await waiterPage.goto(freeActivityUrl);
    await Promise.all([
      memberPage.getByRole("button", { name: "加入活动" }).click(),
      waiterPage.getByRole("button", { name: "加入活动" }).click(),
    ]);

    const contestantNames = [E2E_USERS.member.nickname, E2E_USERS.waiter.nickname];
    const { data: contestants, error: contestantError } = await ownerAssertions
      .from("profiles")
      .select("id, nickname")
      .in("nickname", contestantNames);
    expect(contestantError).toBeNull();
    expect(contestants).toHaveLength(2);
    const nameById = new Map((contestants ?? []).map((profile) => [profile.id, profile.nickname]));

    let raceRows: { profile_id: string; queue_position: number | null; status: string }[] = [];
    await expect.poll(async () => {
      const { data, error } = await ownerAssertions
        .from("activity_participations")
        .select("profile_id, queue_position, status")
        .eq("activity_id", activityId)
        .in("profile_id", [...nameById.keys()]);
      if (error) throw error;
      raceRows = data ?? [];
      return raceRows.map((row) => row.status).sort();
    }).toEqual(["joined", "waitlisted"]);

    const joinedRow = raceRows.find((row) => row.status === "joined");
    const firstWaiterRow = raceRows.find((row) => row.status === "waitlisted");
    expect(joinedRow).toBeTruthy();
    expect(firstWaiterRow?.queue_position).not.toBeNull();

    const joinedName = nameById.get(joinedRow!.profile_id);
    const firstWaiterName = nameById.get(firstWaiterRow!.profile_id);
    const joinedPage = joinedName === E2E_USERS.member.nickname ? memberPage : waiterPage;
    const firstWaiterPage = firstWaiterName === E2E_USERS.member.nickname ? memberPage : waiterPage;

    await reservePage.goto(freeActivityUrl);
    await reservePage.getByRole("button", { name: "加入活动" }).click();
    const { data: reserveProfile, error: reserveProfileError } = await ownerAssertions
      .from("profiles")
      .select("id")
      .eq("nickname", E2E_USERS.reserve.nickname)
      .single();
    expect(reserveProfileError).toBeNull();

    let reserveQueuePosition: number | null = null;
    await expect.poll(async () => {
      const { data, error } = await ownerAssertions
        .from("activity_participations")
        .select("queue_position, status")
        .eq("activity_id", activityId)
        .eq("profile_id", reserveProfile!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      reserveQueuePosition = data.queue_position;
      return data.status;
    }).toBe("waitlisted");
    expect(reserveQueuePosition).not.toBeNull();
    expect(reserveQueuePosition!).toBeGreaterThan(firstWaiterRow!.queue_position!);

    const { count: joinedCount, error: countError } = await ownerAssertions
      .from("activity_participations")
      .select("*", { count: "exact", head: true })
      .eq("activity_id", activityId)
      .eq("status", "joined");
    expect(countError).toBeNull();
    expect(joinedCount).toBe(2);

    await joinedPage.reload();
    await joinedPage.getByRole("button", { name: "退出活动" }).click();
    await expect.poll(async () => {
      const { data } = await ownerAssertions
        .from("activity_participations")
        .select("status")
        .eq("activity_id", activityId)
        .eq("profile_id", firstWaiterRow!.profile_id)
        .maybeSingle();
      return data?.status;
    }).toBe("joined");

    await firstWaiterPage.reload();
    await expect(firstWaiterPage.getByRole("link", { name: "进入活动群聊" })).toBeVisible();
    await firstWaiterPage.getByRole("button", { name: "退出活动" }).click();
    await expect.poll(async () => {
      const { data } = await ownerAssertions
        .from("activity_participations")
        .select("status")
        .eq("activity_id", activityId)
        .eq("profile_id", reserveProfile!.id)
        .maybeSingle();
      return data?.status;
    }).toBe("joined");

    await reservePage.reload();
    await expect(reservePage.getByRole("link", { name: "进入活动群聊" })).toBeVisible();
  });

  test("loads the GLB, resolves Place and Anchor search, and aggregates five Activity Beacons", async () => {
    for (let index = 1; index <= 4; index += 1) {
      await createActivity(ownerPage, {
        joinMode: "free",
        title: `E2E 地图聚合 ${index}`,
      });
    }

    await ownerPage.goto("/map");
    await expect(ownerPage.getByText("73 组节点已配对")).toBeVisible({ timeout: 30_000 });
    await ownerPage.locator('input[placeholder*="library"]').fill(PLACE_ID);
    await ownerPage.getByRole("button", { name: new RegExp(`${PLACE_LABEL}.*PLACE_${PLACE_ID}`, "i") }).click();
    await expect(ownerPage.getByText(`ANCHOR_${PLACE_ID}`)).toBeVisible();
    await expect(ownerPage.getByText("5 个活动 Beacon")).toBeVisible();
    await expect(ownerPage.getByText("另有 +1 个活动")).toBeVisible();
    await expect(ownerPage.getByRole("link", { name: "E2E 地图聚合 4" })).toBeVisible();
  });

  test("logs out and keeps protected content locked", async () => {
    await ownerPage.goto("/home");
    await ownerPage.getByRole("button", { name: "退出登录" }).click();
    await expect(ownerPage).toHaveURL(/\/login\?message=signed_out$/);
    await ownerPage.goto("/messages");
    await expect(ownerPage).toHaveURL(/\/login$/);
  });
});
