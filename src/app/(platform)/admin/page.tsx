import type { Metadata } from "next";
import { LockKeyhole, ShieldAlert } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "管理后台",
  description: "Campus Connect 最小管理员能力。",
};

export default function AdminPage() {
  return (
    <ModulePlaceholder
      eyebrow="Restricted · Admin"
      title="最小、明确、服务端验证的治理入口"
      description="管理员后台后续只承担举报处理、用户限制与违规 Activity 管理。当前没有认证能力，因此不会渲染任何真实管理操作。"
      nextMilestone="Auth 与角色模型完成后，通过服务端权限校验保护此路由和全部管理操作。"
      icon={ShieldAlert}
    >
      <div className="flex min-h-64 items-center justify-center rounded-[1.25rem] border border-dashed border-signal/22 bg-signal/5 p-6 text-center">
        <div>
          <LockKeyhole size={30} className="mx-auto text-signal" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl font-semibold text-forest">尚未接入管理员身份</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-forest/52">
            后续不能依赖前端隐藏按钮，必须由服务端角色检查和 RLS 共同保护。
          </p>
        </div>
      </div>
    </ModulePlaceholder>
  );
}
