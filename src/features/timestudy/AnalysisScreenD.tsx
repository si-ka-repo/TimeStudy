import type { CSSProperties } from "react";
import { useMemo } from "react";

import { TIME_STUDY_ACTIONS } from "../../config/timeStudyActions";
import type { StaffOption } from "./InputScreenA";
import {
  analyzeWorkflowClusters,
  type AnalysisLog,
  type ClusterAnalysisItem,
  type ClusterType,
  type ProcessTag,
} from "./clusterAnalysis";

type AnalysisScreenDProps = {
  logs: AnalysisLog[];
  staffs: StaffOption[];
  manualGridValues: Record<string, number>;
  selectedStaffId: string;
  workHourStart: number | null;
  workHourEnd: number | null;
};

export function AnalysisScreenD({
  logs,
  staffs,
  manualGridValues,
  selectedStaffId,
  workHourStart,
  workHourEnd,
}: AnalysisScreenDProps) {
  const effectiveLogs = useMemo(
    () => mergeLogsWithManualOverride(logs, manualGridValues, selectedStaffId, staffs),
    [logs, manualGridValues, selectedStaffId, staffs],
  );
  const analysis = useMemo(() => analyzeWorkflowClusters(effectiveLogs, staffs), [effectiveLogs, staffs]);
  const manualEditedSlotCount = useMemo(() => countManualEditedSlots(manualGridValues), [manualGridValues]);
  const requiredSlotCount = useMemo(() => calcRequiredSlotCount(workHourStart, workHourEnd), [workHourStart, workHourEnd]);

  const summary = useMemo(() => {
    const total = analysis.length;
    const rankA = analysis.filter((x) => x.suggestion.rank === "A").length;
    const rankB = analysis.filter((x) => x.suggestion.rank === "B").length;
    const rankC = analysis.filter((x) => x.suggestion.rank === "C").length;
    const avgScore = total > 0 ? Math.round(analysis.reduce((s, x) => s + x.suggestion.finalScore, 0) / total) : 0;
    return { total, rankA, rankB, rankC, avgScore };
  }, [analysis]);

  return (
    <main style={{ padding: 16, display: "grid", gap: 12 }}>
      <section style={cardStyle}>
        <h2 style={{ margin: "0 0 8px" }}>画面D: ワークフロークラスター分析（DX改善候補）</h2>
        <p style={subTextStyle}>タイムスタディログをプロセス単位で再構成し、改善優先度をスコア化します。</p>
        <div style={summaryGridStyle}>
          <span style={summaryItemStyle}>クラスター数: {summary.total}</span>
          <span style={summaryItemStyle}>平均スコア: {summary.avgScore}</span>
          <span style={{ ...summaryItemStyle, color: "#5b6b7a" }}>手入力コマ数: {manualEditedSlotCount}/{requiredSlotCount}</span>
          <span style={{ ...summaryItemStyle, color: "#8a2030" }}>A判定: {summary.rankA}</span>
          <span style={{ ...summaryItemStyle, color: "#7e5b16" }}>B判定: {summary.rankB}</span>
          <span style={{ ...summaryItemStyle, color: "#3f5b71" }}>C判定: {summary.rankC}</span>
        </div>
      </section>

      {analysis.length === 0 ? (
        <section style={cardStyle}>
          <p style={{ margin: 0, color: "#567" }}>
            分析対象ログがありません。画面Bの記録、または画面Cでの補正が必要です。
          </p>
          {manualEditedSlotCount > 0 ? (
            <p style={{ margin: "8px 0 0", color: "#7a5b26", fontSize: 12 }}>
              画面Cの補正コマ数は {manualEditedSlotCount}/{requiredSlotCount} です。
            </p>
          ) : null}
        </section>
      ) : (
        analysis.map((item, idx) => <ClusterCard key={item.instance.instanceId} item={item} index={idx + 1} />)
      )}
    </main>
  );
}

function mergeLogsWithManualOverride(
  logs: AnalysisLog[],
  manualGridValues: Record<string, number>,
  selectedStaffId: string,
  staffs: StaffOption[],
): AnalysisLog[] {
  const defaultStaffId = selectedStaffId || staffs[0]?.id || "manual_staff";
  const byKey = new Map<string, { staffId: string; subNo: number; slot: number; minutes: number; source: "registered" | "manual_grid" }>();

  for (const log of logs) {
    if (!log.endTime || !log.actionSubNo) continue;
    const start = minuteOfDay(log.startTime);
    const end = minuteOfDay(log.endTime);
    const startAbs = start;
    const endAbs = end >= start ? end : end + 1440;
    for (let slot = 0; slot < 144; slot += 1) {
      const slotStart = slot * 10;
      const slotEnd = slotStart + 10;
      const overlap = Math.max(0, Math.min(endAbs, slotEnd) - Math.max(startAbs, slotStart));
      if (overlap <= 0) continue;
      const key = `${log.staffId}_${log.actionSubNo}_${slot}`;
      const current = byKey.get(key);
      byKey.set(key, {
        staffId: log.staffId,
        subNo: log.actionSubNo,
        slot,
        minutes: Math.max(current?.minutes ?? 0, Math.round(overlap)),
        source: "registered",
      });
    }
  }

  for (const [key, raw] of Object.entries(manualGridValues)) {
    const [subNoText, slotText] = key.split("_");
    const subNo = Number(subNoText);
    const slot = Number(slotText);
    if (!Number.isFinite(subNo) || subNo < 1 || subNo > 24) continue;
    if (!Number.isFinite(slot) || slot < 0 || slot > 143) continue;
    const minutes = Math.max(0, Math.min(10, Math.round(raw)));
    if (minutes <= 0) continue;
    const mergedKey = `${defaultStaffId}_${subNo}_${slot}`;
    byKey.set(mergedKey, { staffId: defaultStaffId, subNo, slot, minutes, source: "manual_grid" });
  }

  const actionNameMap = new Map(TIME_STUDY_ACTIONS.map((a) => [a.subNo, a.actionName] as const));
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  const grouped = new Map<string, Array<{ subNo: number; slot: number; minutes: number; source: "registered" | "manual_grid" }>>();
  for (const item of byKey.values()) {
    const groupKey = `${item.staffId}_${item.subNo}`;
    const arr = grouped.get(groupKey) ?? [];
    arr.push({ subNo: item.subNo, slot: item.slot, minutes: item.minutes, source: item.source });
    grouped.set(groupKey, arr);
  }

  const result: AnalysisLog[] = [];
  for (const [groupKey, arr] of grouped.entries()) {
    const [staffId, subNoText] = groupKey.split("_");
    const subNo = Number(subNoText);
    const sorted = [...arr].sort((a, b) => a.slot - b.slot);

    let chain: typeof sorted = [];
    const flush = () => {
      if (chain.length === 0) return;
      const startSlot = chain[0].slot;
      const minutes = chain.reduce((s, x) => s + x.minutes, 0);
      const start = new Date(baseDate.getTime() + startSlot * 10 * 60_000);
      const end = new Date(start.getTime() + minutes * 60_000);
      const source = chain.some((x) => x.source === "manual_grid") ? "manual_grid" : "registered";
      result.push({
        id: `merged_${staffId}_${subNo}_${startSlot}`,
        staffId,
        actionSubNo: subNo,
        actionName: actionNameMap.get(subNo) ?? `項目${subNo}`,
        startTime: start,
        endTime: end,
        source,
      });
      chain = [];
    };

    for (const item of sorted) {
      if (chain.length === 0) {
        chain.push(item);
        continue;
      }
      const prev = chain[chain.length - 1];
      if (item.slot === prev.slot + 1) {
        chain.push(item);
      } else {
        flush();
        chain.push(item);
      }
    }
    flush();
  }

  return result;
}

function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function countManualEditedSlots(values: Record<string, number>): number {
  const slots = new Set<number>();
  for (const [key, v] of Object.entries(values)) {
    if (!(Number.isFinite(v) && v > 0)) continue;
    const [, slotText] = key.split("_");
    const slot = Number(slotText);
    if (Number.isFinite(slot)) slots.add(slot);
  }
  return slots.size;
}

function calcRequiredSlotCount(start: number | null, end: number | null): number {
  if (start === null || end === null || start === end) return 0;
  const minutes = start < end ? end - start : 1440 - start + end;
  return Math.ceil(minutes / 10);
}

function ClusterCard({ item, index }: { item: ClusterAnalysisItem; index: number }) {
  const { instance, metrics, suggestion } = item;

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 2 }}>
          <strong>
            #{index} {instance.staffName} / {clusterLabel(instance.clusterType)}
          </strong>
          <span style={subTextStyle}>
            {formatDateTime(instance.startedAt)} - {formatDateTime(instance.endedAt)}
          </span>
          <span style={subTextStyle}>イベント数: {instance.events.length}</span>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={rankPillStyle(suggestion.rank)}>{suggestion.rank} 優先</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{suggestion.finalScore}点</div>
        </div>
      </div>

      <div style={metricGridStyle}>
        <Metric label="総時間" value={`${metrics.totalMinutes}分`} />
        <Metric label="間接業務比率" value={`${Math.round(metrics.indirectRatio * 100)}%`} />
        <Metric label="時間集中(HHI)" value={metrics.timeConcentrationHHI.toFixed(3)} />
        <Metric label="重複作業" value={`${metrics.duplicateWorkScore}`} />
        <Metric label="転記推定" value={`${metrics.transcriptionCountEst}回`} />
      </div>

      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
        <strong>検出理由</strong>
        {suggestion.reasons.length === 0 ? (
          <span style={subTextStyle}>強い改善シグナルは検出されていません。</span>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {suggestion.reasons.map((r) => (
              <span key={r} style={reasonPillStyle}>{r}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
        <strong>DX候補</strong>
        {suggestion.candidates.length === 0 ? (
          <span style={subTextStyle}>候補なし</span>
        ) : (
          suggestion.candidates.map((c) => (
            <div key={c.dxId} style={dxCardStyle}>
              <strong>{c.title}</strong>
              <span style={subTextStyle}>{c.description}</span>
              <span style={subTextStyle}>想定削減: {c.expectedReductionMinPerDay}分/日 ・ 難易度: {c.difficulty}/5</span>
            </div>
          ))
        )}
      </div>

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>スコア内訳 / イベント内訳</summary>
        <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
            <span>Impact: {suggestion.impact}</span>
            <span>Urgency: {suggestion.urgency}</span>
            <span>Feasibility: {suggestion.feasibility}</span>
            <span>Reproducibility: {suggestion.reproducibility}</span>
            <span>Confidence: {suggestion.confidence}</span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>時刻</th>
                <th style={thStyle}>業務</th>
                <th style={thStyle}>タグ</th>
                <th style={thStyle}>分</th>
              </tr>
            </thead>
            <tbody>
              {instance.events.map((e) => (
                <tr key={e.logId}>
                  <td style={tdStyle}>{formatTime(e.startAt)} - {formatTime(e.endAt)}</td>
                  <td style={tdStyle}>{e.actionName}</td>
                  <td style={tdStyle}>{tagLabel(e.processTag)}</td>
                  <td style={tdStyle}>{e.minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCardStyle}>
      <span style={{ fontSize: 11, color: "#557" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function clusterLabel(type: ClusterType): string {
  if (type === "care_delivery") return "ケア提供クラスター";
  if (type === "record_handover") return "記録・連携クラスター";
  if (type === "movement_heavy") return "移動集中クラスター";
  if (type === "meeting_admin") return "会議・管理クラスター";
  return "混合クラスター";
}

function tagLabel(tag: ProcessTag): string {
  const map: Record<ProcessTag, string> = {
    care_core: "直接ケア",
    recording: "記録",
    handover: "申し送り",
    coordination: "連携",
    movement: "移動",
    meeting: "会議/教育",
    admin: "管理/その他",
  };
  return map[tag];
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("ja-JP", { hour12: false });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function rankPillStyle(rank: "A" | "B" | "C"): CSSProperties {
  if (rank === "A") return { ...rankPillBaseStyle, background: "#ffe2e5", color: "#8a2030" };
  if (rank === "B") return { ...rankPillBaseStyle, background: "#fff2d1", color: "#7e5b16" };
  return { ...rankPillBaseStyle, background: "#e7f4ff", color: "#2a5f84" };
}

const cardStyle: CSSProperties = {
  border: "1px solid #d6e5f2",
  borderRadius: 12,
  background: "#fff",
  padding: 12,
};

const subTextStyle: CSSProperties = {
  margin: 0,
  color: "#567",
  fontSize: 12,
};

const summaryGridStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const summaryItemStyle: CSSProperties = {
  border: "1px solid #d9e8f4",
  borderRadius: 999,
  background: "#f4faff",
  padding: "4px 10px",
  fontSize: 12,
};

const metricGridStyle: CSSProperties = {
  marginTop: 8,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 8,
};

const metricCardStyle: CSSProperties = {
  border: "1px solid #e2ecf5",
  borderRadius: 8,
  background: "#fbfdff",
  padding: "6px 8px",
  display: "grid",
  gap: 2,
};

const reasonPillStyle: CSSProperties = {
  border: "1px solid #f0c5ca",
  borderRadius: 999,
  background: "#fff1f3",
  color: "#8a2030",
  fontSize: 12,
  padding: "3px 10px",
};

const dxCardStyle: CSSProperties = {
  border: "1px solid #d9e6f3",
  borderRadius: 8,
  padding: "8px 10px",
  background: "#f7fbff",
  display: "grid",
  gap: 2,
};

const rankPillBaseStyle: CSSProperties = {
  borderRadius: 999,
  padding: "3px 10px",
  fontSize: 12,
  fontWeight: 700,
  display: "inline-block",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #dbe7f2",
  background: "#f4f9ff",
  padding: "6px 8px",
};

const tdStyle: CSSProperties = {
  borderBottom: "1px solid #edf3f8",
  padding: "6px 8px",
};
