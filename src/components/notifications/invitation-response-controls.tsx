"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useActionState } from "react";

import {
  respondActivityInvitationAction,
  type InvitationResponseState,
} from "@/app/(platform)/notifications/actions";

const initialState: InvitationResponseState = { message: "", status: "idle" };

export function InvitationResponseControls({ invitationId }: { invitationId: string }) {
  const [state, formAction, pending] = useActionState(respondActivityInvitationAction, initialState);

  return (
    <div>
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="invitationId" value={invitationId} />
        <button
          type="submit"
          name="decision"
          value="accept"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2.5 text-xs font-bold text-paper disabled:opacity-45"
        >
          {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
          接受并查看活动
        </button>
        <button
          type="submit"
          name="decision"
          value="decline"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full border border-forest/12 bg-white/55 px-4 py-2.5 text-xs font-bold text-forest disabled:opacity-45"
        >
          <X size={14} />婉拒
        </button>
      </form>
      {state.message ? (
        <p role={state.status === "error" ? "alert" : "status"} className={`mt-3 text-xs font-semibold ${state.status === "error" ? "text-signal" : "text-forest/55"}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
