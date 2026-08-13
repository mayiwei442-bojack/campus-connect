"use client";

import { ImagePlus, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";

import { validateProfileBackground } from "@/lib/profile/background";

export function ProfileBackgroundUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function uploadBackground(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isUploading) return;

    const validationError = validateProfileBackground(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set("background", file);
      const response = await fetch("/api/profile/background", { method: "POST", body: formData });
      const payload = await response.json() as { error?: string };

      if (!response.ok) {
        setError(payload.error || "背景图片上传失败，请稍后重试。");
        return;
      }

      router.refresh();
    } catch {
      setError("背景图片上传失败，请检查网络后重试。");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="absolute right-5 top-12 z-10 text-right sm:right-6 sm:top-14">
      <label
        className={`inline-flex items-center gap-2 rounded-full border border-white/20 bg-[#123b58]/45 px-3 py-2 text-[0.65rem] font-bold tracking-[0.08em] text-white shadow-[0_10px_26px_rgba(9,31,46,0.18)] backdrop-blur-sm transition ${isUploading ? "pointer-events-none opacity-70" : "cursor-pointer hover:bg-white/16"}`}
      >
        {isUploading ? <LoaderCircle className="animate-spin" size={14} aria-hidden="true" /> : <ImagePlus size={14} aria-hidden="true" />}
        <span>{isUploading ? "正在上传" : "自定义背景"}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => void uploadBackground(event)}
        />
      </label>
      {error ? <p role="alert" className="mt-2 max-w-44 text-right text-[0.65rem] leading-5 text-white/90">{error}</p> : null}
    </div>
  );
}
