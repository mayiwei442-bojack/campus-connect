export type ActivityDraft = {
  placeId: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
  joinMode: "free" | "approval";
};

export function parseActivityDraft(formData: FormData): ActivityDraft {
  const placeId = String(formData.get("placeId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const startsAtValue = String(formData.get("startsAt") ?? "").trim();
  const endsAtValue = String(formData.get("endsAt") ?? "").trim();
  const capacityValue = String(formData.get("capacity") ?? "").trim();
  const timezoneOffset = Number(formData.get("timezoneOffset") ?? 0);
  const joinModeValue = String(formData.get("joinMode") ?? "free");

  if (!placeId || title.length < 2 || title.length > 80 || (description?.length ?? 0) > 1000) {
    throw new Error("请填写有效的地点、标题和活动说明。");
  }
  if (joinModeValue !== "free" && joinModeValue !== "approval") {
    throw new Error("加入方式无效。");
  }

  const capacity = capacityValue ? Number(capacityValue) : null;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) {
    throw new Error("人数上限应为 1–500 的整数。");
  }

  if (!Number.isFinite(timezoneOffset) || timezoneOffset < -840 || timezoneOffset > 840) {
    throw new Error("时区信息无效，请刷新页面重试。");
  }
  const toUtc = (value: string) => {
    const localClock = new Date(`${value}:00Z`);
    if (Number.isNaN(localClock.getTime())) throw new Error("活动时间无效。");
    return new Date(localClock.getTime() + timezoneOffset * 60_000).toISOString();
  };
  const startsAt = startsAtValue ? toUtc(startsAtValue) : null;
  const endsAt = endsAtValue ? toUtc(endsAtValue) : null;
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new Error("结束时间必须晚于开始时间。");
  }

  return { placeId, title, description, startsAt, endsAt, capacity, joinMode: joinModeValue };
}
