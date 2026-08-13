"use client";

import { BookOpenCheck, LoaderCircle, MessageCircleQuestion, Send, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";

type AnswerPayload = {
  answer: string;
  citations: Array<{ id: string; knowledgeKey: string; content: string }>;
  refused: boolean;
  ai?: { organizedByModel: boolean; warning: string | null };
};

export function PersonaAskCard({ personaId, personaName }: { personaId: string; personaName: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AnswerPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true);
    setError("");
    setAnswer(null);
    try {
      const response = await fetch(`/api/personas/${personaId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const payload = await response.json() as AnswerPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Persona 暂时无法回答。");
      setAnswer(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Persona 暂时无法回答。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-[1.35rem] border border-forest/10 bg-white/48 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cobalt text-white"><MessageCircleQuestion size={18} /></span>
        <div>
          <h4 className="text-sm font-bold text-forest">问问「{personaName}」</h4>
          <p className="mt-1 text-xs leading-5 text-forest/46">回答只拼接主人确认过的条目；没有依据时会明确拒绝推断。</p>
        </div>
      </div>
      <form onSubmit={ask} className="mt-4 flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">向 Persona 提问</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="例如：他有校园夜景拍摄经验吗？"
            className="w-full resize-none rounded-2xl border border-forest/10 bg-paper/55 px-4 py-3 text-sm leading-6 text-forest outline-none focus:border-cobalt/40"
          />
        </label>
        <button type="submit" disabled={busy || !question.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-signal text-white disabled:opacity-35" aria-label="发送 Persona 问题">
          {busy ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}
        </button>
      </form>
      {error ? <p role="alert" className="mt-3 flex items-center gap-2 text-xs font-semibold text-signal"><ShieldAlert size={14} />{error}</p> : null}
      {answer ? (
        <div className={`mt-4 rounded-xl p-4 ${answer.refused ? "bg-signal/7" : "bg-forest/6"}`} aria-live="polite">
          <p className="text-sm leading-7 text-forest/72">{answer.answer}</p>
          {answer.citations.length ? (
            <div className="mt-3 space-y-2 border-t border-forest/8 pt-3">
              {answer.citations.map((citation) => (
                <p key={citation.id} className="flex items-start gap-2 text-xs leading-5 text-forest/48"><BookOpenCheck size={13} className="mt-1 shrink-0 text-cobalt" />已确认依据 · {citation.knowledgeKey}</p>
              ))}
            </div>
          ) : null}
          {answer.ai?.warning ? <p className="mt-2 text-[0.65rem] text-forest/36">{answer.ai.warning}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
