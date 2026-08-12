export type ProfileFieldErrors = Partial<Record<"bio" | "campus" | "nickname", string>>;

export type ProfileFormValues = {
  allowMatching: boolean;
  allowStrangerMessages: boolean;
  bio: string;
  campus: string;
  isPublic: boolean;
  nickname: string;
};

export type ProfileActionState = {
  fieldErrors?: ProfileFieldErrors;
  message: string;
  status: "idle" | "error" | "success";
  values?: ProfileFormValues;
};

export const initialProfileActionState: ProfileActionState = {
  message: "",
  status: "idle",
};
