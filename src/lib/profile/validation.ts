import type {
  ProfileActionState,
  ProfileFieldErrors,
  ProfileFormValues,
} from "@/lib/profile/action-state";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export function validateProfileForm(formData: FormData) {
  const values: ProfileFormValues = {
    allowMatching: readCheckbox(formData, "allowMatching"),
    allowStrangerMessages: readCheckbox(formData, "allowStrangerMessages"),
    bio: readText(formData, "bio"),
    campus: readText(formData, "campus"),
    isPublic: readCheckbox(formData, "isPublic"),
    nickname: readText(formData, "nickname"),
  };
  const fieldErrors: ProfileFieldErrors = {};
  const nicknameLength = Array.from(values.nickname).length;

  if (nicknameLength < 2 || nicknameLength > 24) {
    fieldErrors.nickname = "昵称需要 2–24 个字符。";
  }
  if (Array.from(values.campus).length > 80) {
    fieldErrors.campus = "校园信息不能超过 80 个字符。";
  }
  if (Array.from(values.bio).length > 280) {
    fieldErrors.bio = "个人简介不能超过 280 个字符。";
  }

  return { fieldErrors, values };
}

export function profileValidationErrorState(
  fieldErrors: ProfileFieldErrors,
  values: ProfileFormValues,
): ProfileActionState | null {
  if (Object.keys(fieldErrors).length === 0) {
    return null;
  }

  return {
    fieldErrors,
    message: "请检查标记的资料后再保存。",
    status: "error",
    values,
  };
}
