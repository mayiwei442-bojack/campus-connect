import path from "node:path";

import { chromium } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
const email = process.env.PERSONA_PREVIEW_EMAIL;
const password = process.env.PERSONA_PREVIEW_PASSWORD;
const screenshotPath = process.env.PERSONA_PREVIEW_SCREENSHOT;

if (!baseUrl || !email || !password) {
  throw new Error("Preview URL, email, and password are required.");
}

const preview = new URL(baseUrl);
if (
  preview.protocol !== "https:"
  || preview.hostname !== "campus-connect-git-codex-persona-glb-uploads-restore-mayiwei.vercel.app"
) {
  throw new Error("This verifier may only run against the approved Persona GLB Preview deployment.");
}

const glbPath = path.resolve("local-assets/persona/einstein.glb");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  baseURL: preview.toString(),
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
  viewport: { height: 900, width: 1440 },
});
const page = await context.newPage();
const consoleErrors = [];
let uploadedModel = null;

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

try {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/home$/);

  await page.goto("/profile/me", { waitUntil: "domcontentloaded" });
  const manager = page
    .getByRole("heading", { name: "为 Persona 添加 GLB 形象" })
    .locator("xpath=ancestor::section[1]");
  await manager.waitFor();

  const form = manager.locator("form").filter({ hasText: "尚未添加 3D 形象" }).first();
  if (await form.count() === 0) {
    throw new Error("The preview seed account has no empty Persona slot for a non-destructive upload test.");
  }

  await form.locator('input[name="model"]').setInputFiles(glbPath);
  const registrationResponsePromise = page.waitForResponse((response) => (
    response.request().method() === "POST"
    && /\/api\/personas\/[0-9a-f-]+\/avatar-model$/.test(new URL(response.url()).pathname)
  ));
  await form.getByRole("button", { name: "上传 GLB" }).click();
  const registrationResponse = await registrationResponsePromise;
  const registrationRequest = registrationResponse.request();
  const registrationBody = registrationRequest.postDataJSON();
  const registrationPayload = await registrationResponse.json();
  if (registrationResponse.status() !== 201 || typeof registrationPayload.id !== "string") {
    throw new Error(`Avatar registration failed with HTTP ${registrationResponse.status()}.`);
  }

  uploadedModel = {
    id: registrationPayload.id,
    personaId: new URL(registrationResponse.url()).pathname.split("/")[3],
    storagePath: registrationBody.storagePath,
  };

  await manager.getByText(/3D 形象已更新/).waitFor();
  await manager.getByText("einstein.glb", { exact: false }).waitFor();
  await manager.locator('[role="group"][aria-label$="3D 预览"][aria-busy="false"]').waitFor();
  await manager.locator("canvas").first().waitFor({ state: "visible" });
  if (screenshotPath) await manager.screenshot({ path: screenshotPath });

  const deleteButton = manager.getByRole("button", { name: /删除 .* 的 3D 形象/ }).first();
  await deleteButton.click();
  await manager.getByText("再次点击垃圾桶确认删除", { exact: false }).waitFor();
  const deletionResponsePromise = page.waitForResponse((response) => (
    response.request().method() === "DELETE"
    && /\/api\/personas\/[0-9a-f-]+\/avatar-model$/.test(new URL(response.url()).pathname)
  ));
  await manager.getByRole("button", { name: /确认删除 .* 的 3D 形象/ }).click();
  const deletionResponse = await deletionResponsePromise;
  if (deletionResponse.status() !== 200) {
    throw new Error(`Avatar deletion failed with HTTP ${deletionResponse.status()}.`);
  }
  uploadedModel = null;

  await manager.getByText(/3D 形象已移除/).waitFor();
  await manager.getByText("尚未添加 3D 形象", { exact: true }).first().waitFor();

  if (consoleErrors.length) {
    throw new Error(`Browser console errors: ${consoleErrors.join(" | ")}`);
  }

  console.log("Persona Preview: login, GLB upload, registration, 3D render, and deletion all passed.");
} finally {
  if (uploadedModel) {
    await page.evaluate(async ({ id, personaId, storagePath }) => {
      await fetch(`/api/personas/${personaId}/avatar-model`, {
        body: JSON.stringify({ modelId: id, storagePath }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
    }, uploadedModel).catch(() => undefined);
  }
  await context.close();
  await browser.close();
}
