"use client";

import {
  Bot,
  CheckCircle2,
  Eye,
  LoaderCircle,
  MessageCircle,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useActionState } from "react";

import { updateProfileAction } from "@/app/(platform)/profile/actions";
import type { ProfileFormValues } from "@/lib/profile/action-state";
import { initialProfileActionState } from "@/lib/profile/action-state";

type ProfileEditorProps = {
  initialValues: ProfileFormValues;
};

export function ProfileEditor({ initialValues }: ProfileEditorProps) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialProfileActionState);
  const values = state.values ?? initialValues;

  return (
    <form action={formAction} className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]" noValidate>
      <fieldset className="rounded-[1.8rem] border border-forest/10 bg-white/52 p-5 shadow-[0_20px_70px_rgba(20,35,31,0.06)] sm:p-7">
        <legend className="relative top-3 z-10 ml-2 px-2 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-signal">
          Public identity
        </legend>
        <div className="mt-6 flex items-start justify-between gap-5 border-b border-forest/8 pb-5">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.025em] text-forest">编辑校园名片</h2>
            <p className="mt-2 max-w-xl text-sm leading-7 text-forest/52">资料与 AI 模块分开保存，不会等待匹配或 Persona 响应。</p>
          </div>
          <span className="hidden rounded-full bg-forest/7 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-forest/48 sm:inline-flex">
            owner only
          </span>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <ProfileTextField
            defaultValue={values.nickname}
            disabled={pending}
            error={state.fieldErrors?.nickname}
            label="公开昵称"
            maxLength={24}
            name="nickname"
            placeholder="你希望大家如何称呼你"
            required
          />
          <ProfileTextField
            defaultValue={values.campus}
            disabled={pending}
            error={state.fieldErrors?.campus}
            label="校园信息"
            maxLength={80}
            name="campus"
            placeholder="例如：北校区 · 计算机学院"
          />
          <label className="block sm:col-span-2">
            <span className="flex items-center justify-between gap-4 text-xs font-bold tracking-[0.06em] text-forest/66">
              <span>个人简介</span>
              <span className="font-mono text-[0.62rem] font-normal text-forest/34">最多 280 字</span>
            </span>
            <textarea
              name="bio"
              rows={6}
              maxLength={280}
              defaultValue={values.bio}
              disabled={pending}
              aria-invalid={Boolean(state.fieldErrors?.bio)}
              aria-describedby={state.fieldErrors?.bio ? "bio-error" : undefined}
              className="mt-2 w-full resize-y rounded-[1.25rem] border border-forest/12 bg-paper/42 px-4 py-3.5 text-sm leading-7 text-forest outline-none transition placeholder:text-forest/28 focus:border-forest/35 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="写下你愿意公开的兴趣、正在做的事，或者希望遇见怎样的同伴。"
            />
            {state.fieldErrors?.bio ? <span id="bio-error" className="mt-1.5 block text-xs text-signal">{state.fieldErrors.bio}</span> : null}
          </label>
        </div>
      </fieldset>

      <fieldset className="relative overflow-hidden rounded-[1.8rem] bg-forest p-5 text-paper shadow-[0_24px_80px_rgba(20,60,50,0.18)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full border border-white/8" />
        <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full border border-white/8" />
        <legend className="relative top-3 z-10 ml-2 px-2 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-skyline">
          Connection boundaries
        </legend>
        <div className="relative mt-6">
          <div className="flex items-start gap-3 border-b border-white/10 pb-5">
            <ShieldCheck className="mt-0.5 shrink-0 text-skyline" size={21} aria-hidden="true" />
            <div>
              <h2 className="font-display text-2xl font-semibold">谁可以找到你</h2>
              <p className="mt-2 text-sm leading-6 text-paper/56">这些设置由数据库权限和查询共同执行，不只是隐藏页面按钮。</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <PrivacySwitch
              defaultChecked={values.isPublic}
              description="关闭后，其他成员无法打开你的基础资料页。"
              disabled={pending}
              icon={Eye}
              label="公开个人资料"
              name="isPublic"
            />
            <PrivacySwitch
              defaultChecked={values.allowStrangerMessages}
              description="为后续私聊功能保留明确的陌生人联系边界。"
              disabled={pending}
              icon={MessageCircle}
              label="允许陌生人发起消息"
              name="allowStrangerMessages"
            />
            <PrivacySwitch
              defaultChecked={values.allowMatching}
              description="关闭后，你将从 AI 匹配的候选人中排除。"
              disabled={pending}
              icon={Bot}
              label="参与 AI 协作匹配"
              name="allowMatching"
            />
          </div>
        </div>
      </fieldset>

      <div className="xl:col-span-2 flex flex-col gap-4 rounded-[1.45rem] border border-forest/10 bg-paper-deep/45 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-h-6">
          {state.message ? (
            <p
              className={`flex items-center gap-2 text-sm font-semibold ${state.status === "success" ? "text-forest" : "text-signal"}`}
              role={state.status === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {state.status === "success" ? <CheckCircle2 size={17} aria-hidden="true" /> : null}
              {state.message}
            </p>
          ) : (
            <p className="text-xs leading-6 text-forest/46">保存后，个人主页和全站昵称会在下一次渲染时同步更新。</p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-signal px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(227,87,45,0.22)] transition hover:-translate-y-0.5 hover:bg-[#c94823] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
        >
          {pending ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
          {pending ? "正在保存…" : "保存个人资料"}
        </button>
      </div>
    </form>
  );
}

type ProfileTextFieldProps = {
  defaultValue: string;
  disabled: boolean;
  error?: string;
  label: string;
  maxLength: number;
  name: string;
  placeholder: string;
  required?: boolean;
};

function ProfileTextField({
  defaultValue,
  disabled,
  error,
  label,
  maxLength,
  name,
  placeholder,
  required,
}: ProfileTextFieldProps) {
  const errorId = `${name}-error`;

  return (
    <label className="block">
      <span className="text-xs font-bold tracking-[0.06em] text-forest/66">{label}</span>
      <input
        name={name}
        type="text"
        autoComplete={name === "nickname" ? "nickname" : "organization"}
        maxLength={maxLength}
        defaultValue={defaultValue}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="mt-2 w-full rounded-[1.05rem] border border-forest/12 bg-paper/42 px-4 py-3.5 text-sm text-forest outline-none transition placeholder:text-forest/28 focus:border-forest/35 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        placeholder={placeholder}
      />
      {error ? <span id={errorId} className="mt-1.5 block text-xs text-signal">{error}</span> : null}
    </label>
  );
}

type PrivacySwitchProps = {
  defaultChecked: boolean;
  description: string;
  disabled: boolean;
  icon: typeof Eye;
  label: string;
  name: string;
};

function PrivacySwitch({ defaultChecked, description, disabled, icon: Icon, label, name }: PrivacySwitchProps) {
  return (
    <label className="group flex cursor-pointer items-start gap-3 rounded-[1.15rem] border border-white/10 bg-white/[0.055] p-3.5 transition hover:bg-white/[0.085] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 text-skyline">
        <Icon size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-paper">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-paper/48">{description}</span>
      </span>
      <input className="peer sr-only" type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} />
      <span className="relative mt-1 h-6 w-11 shrink-0 rounded-full bg-white/14 transition peer-checked:bg-signal peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-skyline after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-paper after:transition-transform peer-checked:after:translate-x-5" aria-hidden="true" />
    </label>
  );
}
