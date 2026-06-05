import type { StaffOption } from "./InputScreenA";

export type ProcessTag =
  | "care_core"
  | "recording"
  | "handover"
  | "coordination"
  | "movement"
  | "meeting"
  | "admin";

export type ClusterType = "care_delivery" | "record_handover" | "movement_heavy" | "meeting_admin" | "mixed";

export type AnalysisLog = {
  id: string;
  staffId: string;
  actionSubNo?: number;
  actionName?: string;
  startTime: Date;
  endTime?: Date;
  source?: "registered" | "manual_grid";
};

export type WorkflowEvent = {
  logId: string;
  staffId: string;
  staffName: string;
  role: string;
  actionSubNo?: number;
  actionName: string;
  startAt: Date;
  endAt: Date;
  minutes: number;
  isIndirect: boolean;
  processTag: ProcessTag;
  source: "registered" | "manual_grid";
};

export type WorkflowInstance = {
  instanceId: string;
  staffId: string;
  staffName: string;
  role: string;
  startedAt: Date;
  endedAt: Date;
  events: WorkflowEvent[];
  clusterType: ClusterType;
};

export type ClusterMetrics = {
  instanceId: string;
  totalMinutes: number;
  indirectRatio: number;
  timeConcentrationHHI: number;
  duplicateWorkScore: number;
  transcriptionCountEst: number;
  manualSourceRatio: number;
};

export type DxCandidate = {
  dxId: string;
  title: string;
  description: string;
  expectedReductionMinPerDay: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
};

export type ClusterSuggestion = {
  instanceId: string;
  finalScore: number;
  rank: "A" | "B" | "C";
  impact: number;
  urgency: number;
  feasibility: number;
  reproducibility: number;
  confidence: number;
  reasons: string[];
  candidates: DxCandidate[];
};

export type ClusterAnalysisItem = {
  instance: WorkflowInstance;
  metrics: ClusterMetrics;
  suggestion: ClusterSuggestion;
};

const WORKFLOW_GAP_MINUTES = 20;

export function analyzeWorkflowClusters(logs: AnalysisLog[], staffs: StaffOption[]): ClusterAnalysisItem[] {
  const byStaff = new Map<string, WorkflowEvent[]>();

  for (const log of logs) {
    if (!log.endTime) continue;
    if (log.endTime.getTime() <= log.startTime.getTime()) continue;

    const staff = staffs.find((s) => s.id === log.staffId);
    const event: WorkflowEvent = {
      logId: log.id,
      staffId: log.staffId,
      staffName: staff?.name ?? "不明な職員",
      role: "未設定",
      actionSubNo: log.actionSubNo,
      actionName: log.actionName ?? "未分類",
      startAt: new Date(log.startTime),
      endAt: new Date(log.endTime),
      minutes: Math.max(1, Math.round((log.endTime.getTime() - log.startTime.getTime()) / 60000)),
      isIndirect: isIndirect(log.actionSubNo),
      processTag: mapProcessTag(log.actionSubNo, log.actionName),
      source: log.source ?? "registered",
    };

    const arr = byStaff.get(log.staffId) ?? [];
    arr.push(event);
    byStaff.set(log.staffId, arr);
  }

  const instances: WorkflowInstance[] = [];
  for (const [staffId, events] of byStaff.entries()) {
    const sorted = [...events].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    let bucket: WorkflowEvent[] = [];
    for (const event of sorted) {
      if (bucket.length === 0) {
        bucket.push(event);
        continue;
      }
      const prev = bucket[bucket.length - 1];
      const gap = (event.startAt.getTime() - prev.endAt.getTime()) / 60000;
      if (gap >= WORKFLOW_GAP_MINUTES) {
        instances.push(buildInstance(staffId, bucket));
        bucket = [event];
      } else {
        bucket.push(event);
      }
    }
    if (bucket.length > 0) instances.push(buildInstance(staffId, bucket));
  }

  return instances
    .map((instance) => {
      const metrics = calcMetrics(instance);
      const suggestion = suggestForInstance(instance, metrics);
      return { instance, metrics, suggestion };
    })
    .sort((a, b) => b.suggestion.finalScore - a.suggestion.finalScore);
}

function buildInstance(staffId: string, events: WorkflowEvent[]): WorkflowInstance {
  const startedAt = events[0].startAt;
  const endedAt = events[events.length - 1].endAt;
  const clusterType = classifyCluster(events);

  return {
    instanceId: `${staffId}_${startedAt.toISOString()}`,
    staffId,
    staffName: events[0].staffName,
    role: events[0].role,
    startedAt,
    endedAt,
    events,
    clusterType,
  };
}

function classifyCluster(events: WorkflowEvent[]): ClusterType {
  const totals = sumByTag(events);
  const total = events.reduce((s, x) => s + x.minutes, 0) || 1;
  const care = (totals.care_core ?? 0) / total;
  const recordHandover = ((totals.recording ?? 0) + (totals.handover ?? 0)) / total;
  const move = (totals.movement ?? 0) / total;
  const meetingAdmin = ((totals.meeting ?? 0) + (totals.admin ?? 0)) / total;

  if (care >= 0.6) return "care_delivery";
  if (recordHandover >= 0.45) return "record_handover";
  if (move >= 0.35) return "movement_heavy";
  if (meetingAdmin >= 0.5) return "meeting_admin";
  return "mixed";
}

function calcMetrics(instance: WorkflowInstance): ClusterMetrics {
  const totalMinutes = instance.events.reduce((s, x) => s + x.minutes, 0);
  const indirectMinutes = instance.events.filter((x) => x.isIndirect).reduce((s, x) => s + x.minutes, 0);
  const indirectRatio = totalMinutes > 0 ? indirectMinutes / totalMinutes : 0;
  const manualMinutes = instance.events.filter((x) => x.source === "manual_grid").reduce((s, x) => s + x.minutes, 0);
  const manualSourceRatio = totalMinutes > 0 ? manualMinutes / totalMinutes : 0;

  const slotMap = new Map<number, number>();
  for (const e of instance.events) {
    const startMin = e.startAt.getHours() * 60 + e.startAt.getMinutes();
    const slots = Math.max(1, Math.ceil(e.minutes / 10));
    for (let i = 0; i < slots; i += 1) {
      const slot = Math.floor((startMin + i * 10) / 10) % 144;
      slotMap.set(slot, (slotMap.get(slot) ?? 0) + 10);
    }
  }

  let hhi = 0;
  for (const v of slotMap.values()) {
    const share = totalMinutes > 0 ? v / totalMinutes : 0;
    hhi += share * share;
  }

  let duplicateWorkScore = 0;
  const recentByTag = new Map<ProcessTag, Date>();
  for (const e of instance.events) {
    const prev = recentByTag.get(e.processTag);
    if (prev) {
      const delta = (e.startAt.getTime() - prev.getTime()) / 60000;
      if (delta <= 30) duplicateWorkScore += 1;
    }
    recentByTag.set(e.processTag, e.endAt);
  }

  for (let i = 1; i < instance.events.length - 1; i += 1) {
    const a = instance.events[i - 1];
    const b = instance.events[i];
    const c = instance.events[i + 1];
    if (a.processTag === "recording" && b.processTag === "care_core" && c.processTag === "recording") {
      duplicateWorkScore += 2;
    }
  }

  const transcriptionCountEst = instance.events.filter((x) => x.processTag === "recording").length;

  return {
    instanceId: instance.instanceId,
    totalMinutes,
    indirectRatio,
    timeConcentrationHHI: round3(hhi),
    duplicateWorkScore,
    transcriptionCountEst,
    manualSourceRatio: round3(manualSourceRatio),
  };
}

function suggestForInstance(instance: WorkflowInstance, metrics: ClusterMetrics): ClusterSuggestion {
  const candidates: DxCandidate[] = [];
  const reasons: string[] = [];
  const hasHandover = instance.events.some((x) => x.processTag === "handover");

  if (metrics.indirectRatio >= 0.55) {
    reasons.push("間接業務の比率が高い");
    candidates.push({
      dxId: "dx_shift_direct_input",
      title: "現場直接入力への切替",
      description: "記録を後追い転記から現場入力へ寄せ、間接業務を削減する",
      expectedReductionMinPerDay: 30,
      difficulty: 2,
    });
  }

  if (metrics.duplicateWorkScore >= 3 && hasHandover) {
    reasons.push("重複作業が多い");
    candidates.push({
      dxId: "dx_handover_template",
      title: "申し送りテンプレート＋自動通知",
      description: "同じ連絡の繰り返しを抑え、共有漏れと再作業を減らす",
      expectedReductionMinPerDay: 20,
      difficulty: 2,
    });
  }

  if (metrics.transcriptionCountEst >= 3) {
    reasons.push("転記が多い");
    candidates.push({
      dxId: "dx_record_integration",
      title: "記録フォーマット統合",
      description: "記録先を集約し、二重入力を削減する",
      expectedReductionMinPerDay: 25,
      difficulty: 3,
    });
  }

  if (instance.clusterType === "movement_heavy") {
    reasons.push("移動に時間が集中");
    candidates.push({
      dxId: "dx_route_opt",
      title: "訪問ルート最適化",
      description: "時間帯と訪問先の並びを最適化して移動ロスを減らす",
      expectedReductionMinPerDay: 35,
      difficulty: 3,
    });
  }

  if (instance.clusterType === "meeting_admin") {
    reasons.push("会議・管理業務に偏り");
    candidates.push({
      dxId: "dx_meeting_pack",
      title: "会議準備の標準化",
      description: "会議資料の事前配布と定型アジェンダで会議時間を圧縮する",
      expectedReductionMinPerDay: 15,
      difficulty: 1,
    });
  }

  const impact = clamp0to(40, Math.round((metrics.totalMinutes * metrics.indirectRatio) / 3));
  const urgency = clamp0to(
    25,
    Math.round((metrics.indirectRatio * 20) + metrics.duplicateWorkScore * 1.2 + metrics.transcriptionCountEst * 0.8),
  );
  const feasibility = clamp0to(20, 20 - Math.min(...(candidates.map((x) => x.difficulty) as number[]), 5) * 2 + 4);
  const reproducibility = clamp0to(15, instance.events.length >= 3 ? 12 : 8);
  const confidence = clamp01(Math.min(1, instance.events.length / 5));

  const raw = impact + urgency + feasibility + reproducibility;
  const finalScore = Math.round(raw * confidence);
  const rank: "A" | "B" | "C" = finalScore >= 80 ? "A" : finalScore >= 60 ? "B" : "C";

  return {
    instanceId: instance.instanceId,
    finalScore,
    rank,
    impact,
    urgency,
    feasibility,
    reproducibility,
    confidence: round3(confidence),
    reasons,
    candidates: uniqueCandidates(candidates),
  };
}

function mapProcessTag(subNo?: number, actionName?: string): ProcessTag {
  if (!subNo) return "admin";
  if (subNo >= 1 && subNo <= 9) return "care_core";
  if (subNo === 10) return "movement";
  if (subNo === 11) return "recording";
  if (subNo === 12) return "coordination";
  if (subNo === 15) return "meeting";

  const name = actionName ?? "";
  if (name.includes("記録") || name.includes("文書")) return "recording";
  if (name.includes("連絡") || name.includes("申し送り")) return "handover";
  if (name.includes("会議") || name.includes("研修") || name.includes("教育")) return "meeting";
  if (name.includes("移動") || name.includes("巡回")) return "movement";
  return "admin";
}

function isIndirect(subNo?: number): boolean {
  if (!subNo) return true;
  return subNo >= 10;
}

function sumByTag(events: WorkflowEvent[]): Partial<Record<ProcessTag, number>> {
  const totals: Partial<Record<ProcessTag, number>> = {};
  for (const e of events) totals[e.processTag] = (totals[e.processTag] ?? 0) + e.minutes;
  return totals;
}

function uniqueCandidates(candidates: DxCandidate[]): DxCandidate[] {
  const map = new Map<string, DxCandidate>();
  for (const c of candidates) map.set(c.dxId, c);
  return [...map.values()];
}

function clamp0to(max: number, value: number): number {
  return Math.max(0, Math.min(max, value));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
