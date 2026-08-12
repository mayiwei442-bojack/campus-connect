import { describe, expect, it } from "vitest";

import {
  validateLoginForm,
  validateRegistrationForm,
  validationErrorState,
} from "./validation";

function createFormData(values: Record<string, string>) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("auth form validation", () => {
  it("normalizes a valid login email", () => {
    const result = validateLoginForm(
      createFormData({ email: "  STUDENT@Campus.edu  ", password: "correct horse battery staple" }),
    );

    expect(result.email).toBe("student@campus.edu");
    expect(result.fieldErrors).toEqual({});
  });

  it("rejects a malformed login form", () => {
    const result = validateLoginForm(createFormData({ email: "not-an-email", password: "" }));

    expect(result.fieldErrors).toEqual({
      email: "请输入有效的邮箱地址。",
      password: "请输入密码。",
    });
  });

  it("accepts a complete registration form", () => {
    const result = validateRegistrationForm(
      createFormData({
        confirmPassword: "a-secure-password",
        email: "student@campus.edu",
        nickname: "林同学",
        password: "a-secure-password",
      }),
    );

    expect(result.fieldErrors).toEqual({});
  });

  it("rejects short nicknames, weak passwords and mismatched confirmation", () => {
    const result = validateRegistrationForm(
      createFormData({
        confirmPassword: "different",
        email: "invalid",
        nickname: "A",
        password: "short",
      }),
    );

    expect(result.fieldErrors).toEqual({
      confirmPassword: "两次输入的密码不一致。",
      email: "请输入有效的邮箱地址。",
      nickname: "昵称需要 2–24 个字符。",
      password: "密码至少需要 8 个字符。",
    });
  });

  it("creates a serializable validation state only when errors exist", () => {
    expect(validationErrorState({}, { email: "student@campus.edu" })).toBeNull();
    expect(validationErrorState({ email: "错误" }, { email: "invalid" })).toEqual({
      fieldErrors: { email: "错误" },
      message: "请检查标记的内容后再提交。",
      status: "error",
      values: { email: "invalid" },
    });
  });
});
