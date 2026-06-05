export function formatStartTimeOnly(date: Date): string {
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatElapsed(startTime: Date, now: number): string {
  const diffSeconds = Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 1000));
  const mm = Math.floor(diffSeconds / 60);
  const ss = diffSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function formatInProgressStaffLine(staffName: string): string {
  const trimmed = staffName.trim();
  if (!trimmed || trimmed === "未選択" || trimmed === "不明な職員") {
    return "記録中です";
  }
  return `${trimmed}さんで記録中です`;
}
