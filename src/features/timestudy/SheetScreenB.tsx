import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { build24hGrid, type GridRow, type LogForGrid } from "./build24hGrid";
import type { InProgressAction, StaffOption } from "./InputScreenA";
import { slotLabel } from "./timeSlots";

type SheetScreenBProps = {
  staffs: StaffOption[];
  logs: LogForGrid[];
  inProgress?: InProgressAction | null;
  workHourStart: number | null;
  workHourEnd: number | null;
  manualValues?: Record<string, number>;
  onCellValueChange?: (payload: {
    rowLabel: string;
    rowSubNo?: number;
    slotIndex: number;
    hourLabel: string;
    slotLabel: string;
    value: number;
  }) => void;
};

type EditingCell = {
  rowLabel: string;
  slotIndex: number;
  x?: number;
  y?: number;
} | null;

export function SheetScreenB({
  staffs,
  logs,
  inProgress,
  workHourStart,
  workHourEnd,
  manualValues,
  onCellValueChange,
}: SheetScreenBProps) {
  const grid = build24hGrid(logs);
  const [localManualValues, setLocalManualValues] = useState<Record<string, number>>({});
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isMobile, setIsMobile] = useState(false);
  const [slotPage, setSlotPage] = useState(0);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);

  const hasWorkHours = workHourStart !== null && workHourEnd !== null && workHourStart !== workHourEnd;

  const visibleSlotIndexes = useMemo(() => {
    if (!hasWorkHours) return [];
    const pairs: Array<{ index: number; minute: number }> = [];
    const start = workHourStart as number;
    const end = workHourEnd as number;
    const crossesMidnight = start > end;
    for (const slot of grid.slots) {
      const slotStartMinutes = slot.hour * 60 + slot.minuteFrom;
      const inRange = crossesMidnight
        ? slotStartMinutes >= start || slotStartMinutes < end
        : slotStartMinutes >= start && slotStartMinutes < end;
      if (inRange) {
        pairs.push({ index: slot.index, minute: slotStartMinutes });
      }
    }

    pairs.sort((a, b) => {
      const aOffset = (a.minute - start + 1440) % 1440;
      const bOffset = (b.minute - start + 1440) % 1440;
      return aOffset - bOffset;
    });

    return pairs.map((p) => p.index);
  }, [grid.slots, hasWorkHours, workHourStart, workHourEnd]);

  const pagedSlotIndexes = useMemo(() => chunkArray(visibleSlotIndexes, 18), [visibleSlotIndexes]);
  const maxPage = Math.max(0, pagedSlotIndexes.length - 1);
  const activeSlotIndexes = isMobile ? pagedSlotIndexes[slotPage] ?? [] : visibleSlotIndexes;
  const tableMinWidth = isMobile
    ? Math.max(260, MOBILE_ROW_HEADER_WIDTH + activeSlotIndexes.length * MOBILE_TIME_CELL_WIDTH)
    : 1600;

  const displayRows = useMemo(
    () =>
      grid.rows.map((row) => ({
        ...row,
        cells: row.cells.map((cell, idx) => {
          const key = typeof row.subNo === "number" ? toSubNoCellKey(row.subNo, idx) : toExtraCellKey(row.label, idx);
          const manual = localManualValues[key];
          return {
            ...cell,
            minutes: typeof manual === "number" ? manual : cell.minutes,
          };
        }),
      })),
    [grid.rows, localManualValues],
  );

  const displayColumnTotals = useMemo(
    () =>
      Array.from({ length: grid.slots.length }, (_, idx) =>
        displayRows.reduce((sum, row) => sum + row.cells[idx].minutes, 0),
      ),
    [displayRows, grid.slots.length],
  );

  const issueUnderSlots = useMemo(
    () => visibleSlotIndexes.filter((idx) => displayColumnTotals[idx] > 0 && displayColumnTotals[idx] < 10),
    [visibleSlotIndexes, displayColumnTotals],
  );
  const issueOverSlots = useMemo(
    () => visibleSlotIndexes.filter((idx) => displayColumnTotals[idx] > 10),
    [visibleSlotIndexes, displayColumnTotals],
  );
  const validSlotsCount = useMemo(
    () => visibleSlotIndexes.filter((idx) => displayColumnTotals[idx] === 10).length,
    [visibleSlotIndexes, displayColumnTotals],
  );
  const emptySlotsCount = useMemo(
    () => visibleSlotIndexes.filter((idx) => displayColumnTotals[idx] === 0).length,
    [visibleSlotIndexes, displayColumnTotals],
  );
  const isSubmittable = hasWorkHours && issueUnderSlots.length === 0 && issueOverSlots.length === 0 && emptySlotsCount === 0;

  const queueItems = useMemo(() => {
    return logs
      .filter((log) => log.isPending || !log.actionName)
      .map((log) => {
        const slot = grid.slots.find((s) => s.hour === log.startTime.getHours() && s.minuteFrom <= log.startTime.getMinutes() && log.startTime.getMinutes() <= s.minuteTo) ?? grid.slots[0];
        const rowLabel =
          displayRows.find((r) => (typeof log.actionSubNo === "number" ? r.subNo === log.actionSubNo : false))?.label ??
          "備考・補足等";
        return {
          id: log.id,
          rowLabel,
          slotIndex: slot.index,
          actionName: log.actionName ?? "未分類",
          isPending: log.isPending,
          startTime: log.startTime,
        };
      });
  }, [displayRows, grid.slots, logs]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!manualValues) return;
    setLocalManualValues((prev) => ({ ...prev, ...manualValues }));
  }, [manualValues]);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 800);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    if (slotPage > maxPage) setSlotPage(maxPage);
  }, [isMobile, slotPage, maxPage]);

  const inProgressStaffName = inProgress ? staffs.find((s) => s.id === inProgress.staffId)?.name ?? "不明な職員" : "";
  const elapsedText = inProgress ? formatElapsed(inProgress.startTime, nowMs) : "";
  const elapsedSeconds = inProgress ? Math.max(0, Math.floor((nowMs - new Date(inProgress.startTime).getTime()) / 1000)) : 0;
  const isLongRunning = elapsedSeconds >= 5 * 60;

  function applyCellValue(value: number) {
    if (!editingCell || !hasWorkHours) return;
    const rowSubNo = displayRows.find((r) => r.label === editingCell.rowLabel)?.subNo;
    const key = typeof rowSubNo === "number"
      ? toSubNoCellKey(rowSubNo, editingCell.slotIndex)
      : toExtraCellKey(editingCell.rowLabel, editingCell.slotIndex);
    setLocalManualValues((prev) => ({ ...prev, [key]: value }));

    const slot = grid.slots[editingCell.slotIndex];
    onCellValueChange?.({
      rowLabel: editingCell.rowLabel,
      rowSubNo: typeof rowSubNo === "number" ? rowSubNo : undefined,
      slotIndex: editingCell.slotIndex,
      hourLabel: formatMinutes(slot.hour * 60 + slot.minuteFrom),
      slotLabel: slotLabel(slot),
      value,
    });
    setEditingCell(null);
  }

  function onCellTap(event: MouseEvent<HTMLTableCellElement>, rowLabel: string, slotIndex: number) {
    if (!hasWorkHours) return;
    if (!activeSlotIndexes.includes(slotIndex)) return;

    if (isMobile) {
      setEditingCell({ rowLabel, slotIndex });
      return;
    }

    const x = Math.min(event.clientX + 10, window.innerWidth - 260);
    const y = Math.min(event.clientY + 10, window.innerHeight - 220);
    setEditingCell({ rowLabel, slotIndex, x, y });
  }

  function jumpToSlot(slotIndex: number) {
    if (isMobile) {
      const nextPage = pagedSlotIndexes.findIndex((chunk) => chunk.includes(slotIndex));
      if (nextPage >= 0) setSlotPage(nextPage);
    }
    const th = tableViewportRef.current?.querySelector(`[data-slot-index='${slotIndex}']`) as HTMLElement | null;
    th?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  function jumpToQueueItem(item: { rowLabel: string; slotIndex: number }) {
    jumpToSlot(item.slotIndex);
    if (isMobile) {
      setEditingCell({ rowLabel: item.rowLabel, slotIndex: item.slotIndex });
    }
  }

  return (
    <main style={{ padding: 16, position: "relative", background: "#eef6ff" }}>
      <section style={stickyTopPanelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong>勤務時間</strong>
            <span style={pillStyle}>{hasWorkHours ? `${formatMinutes(workHourStart)}〜${formatMinutes(workHourEnd)}` : "未設定（画面Aで設定）"}</span>
            {!hasWorkHours ? <span style={{ color: "#9a2f3f", fontSize: 12 }}>画面Aで勤務時間を設定すると入力できます</span> : null}
          </div>

          <details>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>ログ一覧（画面B）</summary>
            <div style={{ marginTop: 8, border: "1px solid #d3dce2", borderRadius: 8, maxHeight: 280, width: "min(100vw - 64px, 720px)", overflow: "auto", background: "#fff" }}>
              {logs.length === 0 ? (
                <p style={{ margin: 0, padding: 12, color: "#567" }}>ログはありません。</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={logHeaderCellStyle}>時刻</th>
                      <th style={logHeaderCellStyle}>項目</th>
                      <th style={logHeaderCellStyle}>状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td style={logBodyCellStyle}>{new Date(log.startTime).toLocaleTimeString("ja-JP")} - {log.endTime ? new Date(log.endTime).toLocaleTimeString("ja-JP") : "未終了"}</td>
                        <td style={logBodyCellStyle}>{log.actionName ?? "未分類"}</td>
                        <td style={logBodyCellStyle}>{log.isPending ? "要確認" : "確定"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </details>
        </div>

        <div style={progressCardStyle}>
          <strong style={{ color: "#234760" }}>進行中</strong>
          {inProgress ? (
            <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
              <div style={inProgressMetaRowStyle}>
                <span>職員: {inProgressStaffName}</span>
                <span>項目: {inProgress.actionName}</span>
                <span>開始: {new Date(inProgress.startTime).toLocaleString("ja-JP")}</span>
              </div>
              <div style={inProgressElapsedRowStyle}>
                <span style={{ fontWeight: 700, color: "#9a2f3f" }}>経過: {elapsedText}</span>
                {isLongRunning ? <span style={inProgressWarnStyle}>5分以上進行中です。終了登録漏れに注意してください。</span> : null}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: "#556f80" }}>進行中の記録はありません</span>
          )}
        </div>

        <p style={validationTextStyle}>列合計バリデーション: 合計10分 = 水色 / 10分未満 = 赤 / 10分超過 = 黄色</p>
        <div style={submitStatusWrapStyle}>
          <strong>提出判定</strong>
          <span style={isSubmittable ? submitOkStyle : submitNgStyle}>
            {isSubmittable ? "提出可能（勤務時間内の全列が品質OK）" : "提出不可（未解消の品質エラーあり）"}
          </span>
        </div>
        <div style={qualitySummaryStyle}>
          <strong style={{ fontSize: 12 }}>品質サマリー（勤務時間内の全列）</strong>
          <span style={{ fontSize: 12, color: "#2a5f84" }}>合計10: {validSlotsCount}</span>
          <span style={{ fontSize: 12, color: "#44576a" }}>未入力(0): {emptySlotsCount}</span>
          <span style={{ fontSize: 12, color: "#9a2f3f" }}>不足: {issueUnderSlots.length}</span>
          <span style={{ fontSize: 12, color: "#9a6b1f" }}>超過: {issueOverSlots.length}</span>
          <button type="button" onClick={() => issueUnderSlots[0] !== undefined && jumpToSlot(issueUnderSlots[0])} disabled={issueUnderSlots.length === 0}>
            先頭の不足へ
          </button>
          <button type="button" onClick={() => issueOverSlots[0] !== undefined && jumpToSlot(issueOverSlots[0])} disabled={issueOverSlots.length === 0}>
            先頭の超過へ
          </button>
        </div>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>要確認キュー（未分類/要確認）</summary>
          <div style={queuePanelStyle}>
            {queueItems.length === 0 ? (
              <span style={{ color: "#567", fontSize: 12 }}>要確認データはありません。</span>
            ) : (
              queueItems.map((item) => (
                <div key={item.id} style={queueItemStyle}>
                  <div style={{ display: "grid", gap: 1 }}>
                    <span style={{ fontSize: 12 }}>{item.actionName}</span>
                    <span style={{ fontSize: 11, color: "#567" }}>
                      {new Date(item.startTime).toLocaleTimeString("ja-JP")} / {item.rowLabel} / {item.isPending ? "要確認" : "未分類"}
                    </span>
                  </div>
                  <button type="button" onClick={() => jumpToQueueItem(item)}>
                    移動
                  </button>
                </div>
              ))
            )}
          </div>
        </details>

        {isMobile ? (
          <div style={mobileControlRowStyle}>
            <strong style={{ fontSize: 12 }}>時間帯ページ（3時間）</strong>
            <button type="button" onClick={() => setSlotPage((p) => Math.max(0, p - 1))} disabled={slotPage <= 0}>前へ</button>
            <span style={{ fontSize: 12 }}>{pagedSlotIndexes.length === 0 ? "0 / 0" : `${slotPage + 1} / ${pagedSlotIndexes.length}`}</span>
            <button type="button" onClick={() => setSlotPage((p) => Math.min(maxPage, p + 1))} disabled={slotPage >= maxPage}>次へ</button>
          </div>
        ) : null}

        {!isMobile && editingCell ? (
          <div style={focusedInfoStyle}>選択中: {editingCell.rowLabel} / {grid.slots[editingCell.slotIndex].hour}時 {slotLabel(grid.slots[editingCell.slotIndex])}</div>
        ) : null}
      </section>

      <div style={tableViewportStyle} ref={tableViewportRef}>
        <table style={{ borderCollapse: "collapse", minWidth: tableMinWidth, width: "max-content" }}>
          <thead>
            <tr>
              <th style={stickyTopLeftHeaderStyle}>項目</th>
              {activeSlotIndexes.map((slotIndex) => {
                const slot = grid.slots[slotIndex];
                return (
                  <th
                    key={slot.index}
                    data-slot-index={slot.index}
                    style={buildStickyHeaderCellStyle(statusByTotal(displayColumnTotals[slot.index]))}
                  >
                    {slot.hour}時
                    <br />
                    {slotLabel(slot)}
                    <br />
                    計:{displayColumnTotals[slot.index]}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr key={row.label}>
                <th style={{ ...rowHeaderStyle, ...(isMobile ? rowHeaderMobileStyle : null), ...(row.subNo === 10 ? categoryBoundaryStyle : null) }} title={row.label}>
                  {renderRowLabel(row, isMobile)}
                </th>
                {activeSlotIndexes.map((idx) => {
                  const cell = row.cells[idx];
                  const isWarn = cell.isPending || cell.hasEmptyAction;
                  const columnStatus = statusByTotal(displayColumnTotals[idx]);
                  const isEditing = editingCell?.rowLabel === row.label && editingCell.slotIndex === idx;
                  return (
                    <td
                      key={`${row.label}-${idx}`}
                      style={{
                        ...bodyCellStyle,
                        ...(isMobile ? bodyCellMobileStyle : null),
                        ...(row.subNo === 10 ? categoryBoundaryStyle : null),
                        background: isWarn ? "#ffdfe0" : columnStatus === "valid" ? "#e7f4ff" : columnStatus === "under" ? "#ffe1e3" : "#fff4c9",
                        cursor: hasWorkHours ? "pointer" : "not-allowed",
                        outline: isEditing ? "2px solid #4b90c5" : "none",
                      }}
                      onClick={(e) => onCellTap(e, row.label, idx)}
                      title={!hasWorkHours ? "勤務時間を設定すると入力できます" : isWarn ? "要確認: 未分類/未確定データがあります" : `列合計 ${displayColumnTotals[idx]}分 (${statusLabel(columnStatus)})`}
                    >
                      {cell.minutes > 0 ? cell.minutes : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingCell && !isMobile ? (
        <div style={{ position: "fixed", left: editingCell.x, top: editingCell.y, zIndex: 30, width: 240, background: "#fff", border: "1px solid #b8cedf", borderRadius: 10, boxShadow: "0 10px 24px rgba(0,0,0,0.15)", padding: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ fontSize: 12 }}>{editingCell.rowLabel}<br />{grid.slots[editingCell.slotIndex].hour}時 {slotLabel(grid.slots[editingCell.slotIndex])}</strong>
            <button type="button" onClick={() => setEditingCell(null)}>x</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(40px, 1fr))", gap: 6 }}>
            {Array.from({ length: 11 }, (_, n) => (
              <button key={n} type="button" onClick={() => applyCellValue(n)} style={{ padding: "8px 0" }}>{n}</button>
            ))}
          </div>
        </div>
      ) : null}

      {editingCell && isMobile ? (
        <div style={mobileBottomSheetStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ fontSize: 12 }}>{editingCell.rowLabel}<br />{grid.slots[editingCell.slotIndex].hour}時 {slotLabel(grid.slots[editingCell.slotIndex])}</strong>
            <button type="button" onClick={() => setEditingCell(null)}>閉じる</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(38px, 1fr))", gap: 6 }}>
            {Array.from({ length: 11 }, (_, n) => (
              <button key={n} type="button" onClick={() => applyCellValue(n)} style={{ padding: "9px 0" }}>{n}</button>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function toSubNoCellKey(subNo: number, slotIndex: number): string {
  return `${subNo}_${slotIndex}`;
}

function toExtraCellKey(rowLabel: string, slotIndex: number): string {
  return `extra:${rowLabel}__${slotIndex}`;
}

type ColumnStatus = "under" | "valid" | "over";

function statusByTotal(total: number): ColumnStatus {
  if (total < 10) return "under";
  if (total > 10) return "over";
  return "valid";
}

function statusLabel(status: ColumnStatus): string {
  if (status === "valid") return "合計10";
  if (status === "under") return "10未満";
  return "10超過";
}

function buildHeaderCellStyle(status: ColumnStatus): CSSProperties {
  return {
    ...headerCellStyle,
    background: status === "valid" ? "#dff1ff" : status === "under" ? "#ffd7db" : "#ffefb3",
  };
}

function buildStickyHeaderCellStyle(status: ColumnStatus): CSSProperties {
  return {
    ...buildHeaderCellStyle(status),
    ...stickyHeaderCellStyle,
  };
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "--:--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatElapsed(startTime: Date, now: number): string {
  const diffSeconds = Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 1000));
  const mm = Math.floor(diffSeconds / 60);
  const ss = diffSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function chunkArray(values: number[], size: number): number[][] {
  if (size <= 0) return [values];
  const chunks: number[][] = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

function renderRowLabel(row: GridRow, isMobile: boolean): JSX.Element | string {
  if (!isMobile) return row.label;

  const no = typeof row.subNo === "number" ? row.subNo : "-";
  const name = typeof row.subNo === "number" ? abbreviateLabel(row.label) : "備考";
  const lines = splitTwoLines(name);

  return (
    <div style={mobileRowLabelWrapStyle}>
      <span style={mobileRowNoStyle}>{no}</span>
      <span style={mobileRowTextStyle}>
        <span>{lines[0]}</span>
        <span>{lines[1]}</span>
      </span>
    </div>
  );
}

function abbreviateLabel(label: string): string {
  const body = label.replace(/^\d+\.\s*/, "");
  if (body.includes("・")) {
    return body.split("・").slice(0, 2).join("・");
  }
  return body.slice(0, 10);
}

function splitTwoLines(text: string): [string, string] {
  if (text.length <= 6) return [text, ""];
  return [text.slice(0, 6), text.slice(6, 12)];
}

const pillStyle: CSSProperties = {
  display: "inline-block",
  border: "1px solid #bed2e3",
  borderRadius: 999,
  background: "#ffffff",
  padding: "3px 10px",
  fontSize: 12,
};

const headerCellStyle: CSSProperties = {
  border: "1px solid #bbb",
  padding: "4px 6px",
  fontSize: 11,
  whiteSpace: "nowrap",
  background: "#f5f5f5",
};

const stickyHeaderCellStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 5,
  backgroundColor: "#eef6ff",
  backgroundImage: "none",
  border: "1px solid #9fb5c7",
  backgroundClip: "padding-box",
  boxShadow: "0 1px 0 #9fb5c7",
};

const stickyTopLeftHeaderStyle: CSSProperties = {
  ...stickyHeaderCellStyle,
  left: 0,
  zIndex: 8,
  backgroundColor: "#ffffff",
  border: "1px solid #9fb5c7",
};

const MOBILE_ROW_HEADER_WIDTH = 92;
const MOBILE_TIME_CELL_WIDTH = 44;

const rowHeaderStyle: CSSProperties = {
  border: "1px solid #bbb",
  padding: "4px 8px",
  fontSize: 12,
  textAlign: "left",
  whiteSpace: "nowrap",
  background: "#ffffff",
  position: "sticky",
  left: 0,
  zIndex: 4,
  minWidth: 160,
};

const rowHeaderMobileStyle: CSSProperties = {
  minWidth: MOBILE_ROW_HEADER_WIDTH,
  minHeight: 68,
  padding: "8px 4px",
};

const bodyCellStyle: CSSProperties = {
  border: "1px solid #ddd",
  minWidth: 44,
  textAlign: "center",
  fontSize: 11,
  padding: 2,
};

const bodyCellMobileStyle: CSSProperties = {
  minHeight: 64,
  minWidth: MOBILE_TIME_CELL_WIDTH,
  fontSize: 12,
};

const logHeaderCellStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  background: "#eef6ff",
  borderBottom: "1px solid #d7e4ef",
  padding: "8px 10px",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const logBodyCellStyle: CSSProperties = {
  borderBottom: "1px solid #edf1f4",
  padding: "8px 10px",
  verticalAlign: "top",
};

const categoryBoundaryStyle: CSSProperties = {
  borderTop: "3px solid #7c9bb3",
};

const progressCardStyle: CSSProperties = {
  marginTop: 8,
  border: "1px solid #b9d2e5",
  borderRadius: 10,
  background: "#f3f9ff",
  padding: "8px 12px",
  display: "grid",
  gap: 4,
};

const stickyTopPanelStyle: CSSProperties = {
  position: "sticky",
  top: "var(--sticky-panel-top-b)",
  zIndex: 10,
  background: "#eef6ff",
  paddingBottom: "var(--sticky-panel-padding-bottom)",
  maxHeight: "var(--sticky-panel-max-height)",
  overflowY: "auto",
  marginBottom: 8,
  borderRadius: 10,
  border: "1px solid #d6e5f2",
  boxShadow: "0 2px 8px rgba(35,71,96,0.08)",
};

const validationTextStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 12,
  color: "#556f80",
};

const tableViewportStyle: CSSProperties = {
  overflow: "auto",
  maxHeight: "var(--sheet-table-viewport-height)",
  border: "1px solid #dbe7f2",
  borderRadius: 10,
  marginTop: 0,
  background: "#fff",
};

const inProgressMetaRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const inProgressElapsedRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const inProgressWarnStyle: CSSProperties = {
  color: "#8f2b35",
  fontSize: 12,
};

const mobileControlRowStyle: CSSProperties = {
  marginTop: 8,
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const focusedInfoStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  background: "#edf5ff",
  border: "1px solid #c9dff2",
  borderRadius: 8,
  padding: "6px 8px",
};

const mobileBottomSheetStyle: CSSProperties = {
  position: "fixed",
  left: 8,
  right: 8,
  bottom: 8,
  zIndex: 40,
  background: "#ffffff",
  border: "1px solid #b8cedf",
  borderRadius: 12,
  boxShadow: "0 -4px 20px rgba(0,0,0,0.16)",
  padding: 10,
};

const qualitySummaryStyle: CSSProperties = {
  marginTop: 8,
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  background: "#f8fcff",
  border: "1px solid #d4e4f2",
  borderRadius: 8,
  padding: "6px 8px",
};

const submitStatusWrapStyle: CSSProperties = {
  marginTop: 8,
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const submitOkStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#1c6b35",
  background: "#e6f7ec",
  border: "1px solid #a8d9b7",
  borderRadius: 999,
  padding: "3px 10px",
};

const submitNgStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#8d2a32",
  background: "#ffe9eb",
  border: "1px solid #f1b7bc",
  borderRadius: 999,
  padding: "3px 10px",
};

const queuePanelStyle: CSSProperties = {
  marginTop: 8,
  display: "grid",
  gap: 6,
  border: "1px solid #dbe7f2",
  borderRadius: 8,
  background: "#fff",
  padding: 8,
};

const queueItemStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  borderBottom: "1px solid #edf2f6",
  paddingBottom: 6,
};

const mobileRowLabelWrapStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "20px 1fr",
  gap: 4,
  alignItems: "center",
};

const mobileRowNoStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1,
  color: "#223a4b",
};

const mobileRowTextStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "1fr 1fr",
  lineHeight: 1.2,
  fontSize: 11,
};
