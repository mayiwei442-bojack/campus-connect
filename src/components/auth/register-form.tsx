"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { registerAction } from "@/app/(auth)/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";

type RegisterFormProps = {
  configured: boolean;
};

export function RegisterForm({ configured }: RegisterFormProps) {
  const [state, formAction, pending] = useActionState(registerAction, initialAuthActionState);

  if (state.status === "success") {
    return (
      <div className="rise-in rounded-[1.7rem] border border-forest/10 bg-white/52 p-7 sm:p-9" role="status">
        <span className="grid size-14 place-items-center rounded-full bg-forest text-paper">
          <CheckCircle2 size={26} aria-hidden="true" />
        </span>
        <p className="mt-7 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-signal">One last step</p>
        <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-forest">去邮箱完成确认</h2>
        <p className="mt-4 text-sm leading-7 text-forest/58">{state.message}</p>
        <p className="mt-3 break-all text-sm font-bold text-cobalt">{state.values?.email}</p>
        <Link href="/login" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-forest hover:text-signal">
          <ArrowLeft size={17} aria-hidden="true" />
          返回登录
        </Link>
      </div>
    );
  }

  return (
    <div className="rise-in">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-signal">Create your campus identity</p>
      <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em] text-forest sm:text-5xl">从一个真实昵称开始</h2>
      <p className="mt-4 text-sm leading-7 text-forest/56">邮箱用于登录；昵称会成为你在活动、Skill 和协作中的公开称呼。</p>

      <form action={formAction} className="mt-8 space-y-4" noValidate>
        <AuthField
          label="公开昵称"
          name="nickname"
          autoComplete="nickname"
          placeholder="例如：小未 / 林同学"
          defaultValue={state.values?.nickname}
          error={state.fieldErrors?.nickname}
          disabled={!configured || pending}
          icon={<UserRound size={18} aria-hidden="true" />}
        />
        <AuthField
          label="邮箱"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@campus.edu"
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
          disabled={!configured || pending}
          icon={<Mail size={18} aria-hidden="true" />}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            label="密码"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="至少 8 个字符"
            error={state.fieldErrors?.password}
            disabled={!configured || pending}
            icon={<LockKeyhole size={18} aria-hidden="true" />}
          />
          <AuthField
            label="确认密码"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="再次输入"
            error={state.fieldErrors?.confirmPassword}
            disabled={!configured || pending}
            icon={<LockKeyhole size={18} aria-hidden="true" />}
          />
        </div>

        {!configured ? (
          <p className="rounded-xl bg-cobalt/8 px-4 py-3 text-sm leading-6 text-cobalt">注册界面已经就绪，连接 Supabase 后即可创建真实账号。</p>
        ) : state.message ? (
          <p className="rounded-xl bg-signal/8 px-4 py-3 text-sm leading-6 text-signal" role="alert" aria-live="polite">{state.message}</p>
        ) : null}

        <button
          type="submit"
          disabled={!configured || pending}
          className="group mt-2 flex w-full items-center justify-between rounded-full bg-signal px-5 py-4 text-sm font-bold text-white shadow-[0_14px_35px_rgba(227,87,45,0.22)] transition hover:-translate-y-0.5 hover:bg-[#c94823] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
        >
          <span>{pending ? "正在创建账号…" : configured ? "创建并发送确认邮件" : "等待 Supabase 配置"}</span>
          {pending ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-forest/52">
        已经有账号？{" "}
        <Link href="/login" className="font-bold text-cobalt underline decoration-cobalt/25 underline-offset-4 hover:decoration-cobalt">直接登录</Link>
      </p>
    </div>
  );
}

type AuthFieldProps = {
  autoComplete: string;
  defaultValue?: string;
  disabled: boolean;
  error?: string;
  icon: React.ReactNode;
  inputMode?: "email";
  label: string;
  name: string;
  placeholder: string;
  type?: "email" | "password" | "text";
};

function AuthField({
  autoComplete,
  defaultValue,
  disabled,
  error,
  icon,
  inputMode,
  label,
  name,
  placeholder,
  type = "text",
}: AuthFieldProps) {
  const errorId = `${name}-error`;

  return (
    <label className="block">
      <span className="text-xs font-bold tracking-[0.08em] text-forest/66">{label}</span>
      <span className="mt-2 flex items-center gap-3 rounded-[1.05rem] border border-forest/12 bg-white/58 px-4 transition focus-within:border-forest/35 focus-within:bg-white">
        <span className="shrink-0 text-forest/38">{icon}</span>
        <input
          name={name}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-forest outline-none placeholder:text-forest/30 disabled:cursor-not-allowed"
          placeholder={placeholder}
        />
      </span>
      {error ? <span id={errorId} className="mt-1.5 block text-xs text-signal">{error}</span> : null}
    </label>
  );
}
