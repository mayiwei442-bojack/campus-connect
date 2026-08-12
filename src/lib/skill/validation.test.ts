import { describe, expect, it } from "vitest";

import {
  normalizeSkillNameForLookup,
  skillValidationErrorState,
  validateSkillForm,
} from "./validation";

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

describe("skill form validation", () => {
  it("normalizes a complete ability entry", () => {
    const result = validateSkillForm(
      createFormData({
        allowContact: true,
        allowMatching: true,
        isPublic: true,
        kind: "ability",
        name: "  UI   Design  ",
        note: "  可以一起做校园产品原型。  ",
        selfRating: "4",
      }),
    );

    expect(result).toEqual({
      fieldErrors: {},
      values: {
        allowContact: true,
        allowMatching: true,
        isPublic: true,
        kind: "ability",
        name: "UI Design",
        note: "可以一起做校园产品原型。",
        selfRating: 4,
      },
    });
    expect(normalizeSkillNameForLookup("  UI   Design ")).toBe("ui design");
  });

  it("allows an interest without a self rating", () => {
    const result = validateSkillForm(createFormData({ kind: "interest", name: "校园摄影" }));

    expect(result.fieldErrors).toEqual({});
    expect(result.values.selfRating).toBeNull();
  });

  it("rejects invalid kind, name, rating and note", () => {
    const result = validateSkillForm(
      createFormData({ kind: "unknown", name: "A", note: "说".repeat(161), selfRating: "7" }),
    );

    expect(result.fieldErrors).toEqual({
      kind: "请选择能力或兴趣。",
      name: "Skill 名称需要 2–40 个字符。",
      note: "说明不能超过 160 个字符。",
      selfRating: "自评需要是 1–5 之间的整数。",
    });
  });

  it("returns a serializable state only for invalid input", () => {
    const { values } = validateSkillForm(createFormData({ kind: "interest", name: "电影" }));

    expect(skillValidationErrorState({}, values)).toBeNull();
    expect(skillValidationErrorState({ name: "错误" }, values)).toMatchObject({
      fieldErrors: { name: "错误" },
      status: "error",
      values,
    });
  });
});
