export type AuthFieldErrors = Partial<Record<"confirmPassword" | "email" | "nickname" | "password", string>>;

export type AuthActionState = {
  fieldErrors?: AuthFieldErrors;
  message: string;
  status: "idle" | "error" | "success";
  values?: {
    email?: string;
    nickname?: string;
  };
};

export const initialAuthActionState: AuthActionState = {
  message: "",
  status: "idle",
};
