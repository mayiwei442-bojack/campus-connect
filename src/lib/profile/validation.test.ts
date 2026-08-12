import { describe, expect, it } from "vitest";

import { profileValidationErrorState, validateProfileForm } from "./validation";

function createFormData(values: Record<string, boolean | string>) {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      if (value) formData.set(key, "on");
      return;
    }

    formData.set(key, value);
  });

  return formData;
}

describe("profile form validation", () => {
  it("normalizes text and reads privacy switches", () => {
    const result = validateProfileForm(
      createFormData({
        allowMatching: true,
        allowStrangerMessages: false,
        bio: "  喜欢把想法做成真实活动。  ",
        campus: "  北校区  ",
        isPublic: true,
        nickname: "  林同学  ",
      }),
    );

    expect(result).toEqual({
      fieldErrors: {},
      values: {
        allowMatching: true,
        allowStrangerMessages: false,
        bio: "喜欢把想法做成真实活动。",
        campus: "北校区",
        isPublic: true,
        nickname: "林同学",
      },
    });
  });

  it("rejects invalid profile lengths", () => {
    const result = validateProfileForm(
      createFormData({
        bio: "介".repeat(281),
        campus: "校".repeat(81),
        nickname: "A",
      }),
    );

    expect(result.fieldErrors).toEqual({
      bio: "个人简介不能超过 280 个字符。",
      campus: "校园信息不能超过 80 个字符。",
      nickname: "昵称需要 2–24 个字符。",
    });
  });

  it("returns a serializable state only when validation fails", () => {
    const { values } = validateProfileForm(createFormData({ nickname: "林同学" }));

    expect(profileValidationErrorState({}, values)).toBeNull();
    expect(profileValidationErrorState({ nickname: "错误" }, values)).toMatchObject({
      fieldErrors: { nickname: "错误" },
      status: "error",
      values,
    });
  });
});
