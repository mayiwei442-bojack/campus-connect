"use client";

import { ArrowRight, LoaderCircle, LockKeyhole, Mail, Radio } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { loginAction } from "@/app/(auth)/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";

type LoginFormProps = {
  configured: boolean;
  initialNotice?: string;
};

export function LoginForm({ configured, initialNotice }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, initialAuthActionState);
  const notice = state.message || initialNotice;

  return (
    <div className="rise-in">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-signal">Member entrance</p>
      <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em] text-forest sm:text-5xl">回到校园现场</h2>
      <p className="mt-4 text-sm leading-7 text-forest/56">登录后继续查看活动、消息，以及与你的意图真正相关的人。</p>

      {!configured ? (
        <div className="mt-7 flex gap-3 rounded-[1.2rem] border border-cobalt/15 bg-cobalt/8 p-4 text-sm leading-6 text-cobalt">
          <Radio size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>界面已经可用，正在等待 Supabase 项目 URL 与 publishable key。</p>
        </div>
      ) : null}

      <form action={formAction} className="mt-8 space-y-5" noValidate>
        <label className="block">
          <span className="text-xs font-bold tracking-[0.08em] text-forest/66">邮箱</span>
          <span className="mt-2 flex items-center gap-3 rounded-[1.1rem] border border-forest/12 bg-white/58 px-4 transition focus-within:border-forest/35 focus-within:bg-white">
            <Mail size={18} className="shrink-0 text-forest/38" aria-hidden="true" />
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              defaultValue={state.values?.email}
              disabled={!configured || pending}
              aria-invalid={Boolean(state.fieldErrors?.email)}
              aria-describedby={state.fieldErrors?.email ? "login-email-error" : undefined}
              className="min-w-0 flex-1 bg-transparent py-4 text-sm text-forest outline-none placeholder:text-forest/30 disabled:cursor-not-allowed"
              placeholder="name@campus.edu"
            />
          </span>
          {state.fieldErrors?.email ? <span id="login-email-error" className="mt-2 block text-xs text-signal">{state.fieldErrors.email}</span> : null}
        </label>

        <label className="block">
          <span className="text-xs font-bold tracking-[0.08em] text-forest/66">密码</span>
          <span className="mt-2 flex items-center gap-3 rounded-[1.1rem] border border-forest/12 bg-white/58 px-4 transition focus-within:border-forest/35 focus-within:bg-white">
            <LockKeyhole size={18} className="shrink-0 text-forest/38" aria-hidden="true" />
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              disabled={!configured || pending}
              aria-invalid={Boolean(state.fieldErrors?.password)}
              aria-describedby={state.fieldErrors?.password ? "login-password-error" : undefined}
              className="min-w-0 flex-1 bg-transparent py-4 text-sm text-forest outline-none placeholder:text-forest/30 disabled:cursor-not-allowed"
              placeholder="输入你的密码"
            />
          </span>
          {state.fieldErrors?.password ? <span id="login-password-error" className="mt-2 block text-xs text-signal">{state.fieldErrors.password}</span> : null}
        </label>

        {notice ? (
          <p
            className={`rounded-xl px-4 py-3 text-sm leading-6 ${state.status === "error" ? "bg-signal/8 text-signal" : "bg-forest/7 text-forest/68"}`}
            role={state.status === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!configured || pending}
          className="group flex w-full items-center justify-between rounded-full bg-forest px-5 py-4 text-sm font-bold text-paper shadow-[0_14px_35px_rgba(20,60,50,0.2)] transition hover:-translate-y-0.5 hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
        >
          <span>{pending ? "正在确认身份…" : configured ? "进入 Campus Connect" : "等待 Supabase 配置"}</span>
          {pending ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-forest/52">
        第一次来到这里？{" "}
        <Link href="/register" className="font-bold text-cobalt underline decoration-cobalt/25 underline-offset-4 hover:decoration-cobalt">
          创建账号
        </Link>
      </p>
    </div>
  );
}
