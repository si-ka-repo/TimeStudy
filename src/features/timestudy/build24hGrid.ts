import { TIME_STUDY_ACTIONS } from "../../config/timeStudyActions";
import { buildDaySlots, toSlotIndex, type SlotInfo, TOTAL_SLOTS } from "./timeSlots";

export type LogForGrid = {
  id: string;
  actionSubNo?: number | null;
  actionName?: string | null;
  startTime: Date;
  endTime?: Date | null;
  isPending: boolean;
};

export type GridCell = {
  logId?: string;
  minutes: number;
  isPending: boolean;
  hasEmptyAction: boolean;
};

export type GridRow = {
  subNo?: number;
  label: string;
  cells: GridCell[];
};

export type TimeStudyGrid = {
  slots: SlotInfo[];
  rows: GridRow[];
  columnTotals: number[];
};

const SLOT_MS = 10 * 60 * 1000;

function createEmptyCells(): GridCell[] {
  return Array.from({ length: TOTAL_SLOTS }, () => ({
    minutes: 0,
    isPending: false,
    hasEmptyAction: false,
  }));
}

export function build24hGrid(logs: LogForGrid[]): TimeStudyGrid {
  const slots = buildDaySlots();

  const baseRows: GridRow[] = TIME_STUDY_ACTIONS.map((a) => ({
    subNo: a.subNo,
    label: `${a.subNo}. ${a.actionName}`,
    cells: createEmptyCells(),
  }));

  const notesRow: GridRow = {
    label: "備考・補足等",
    cells: createEmptyCells(),
  };

  const rowBySubNo = new Map<number, GridRow>();
  for (const row of baseRows) {
    if (row.subNo) rowBySubNo.set(row.subNo, row);
  }

  for (const log of logs) {
    const start = log.startTime;
    const end = log.endTime ?? log.startTime;
    const normalizedEnd = end.getTime() === start.getTime() ? new Date(end.getTime() + 60_000) : end;
    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const startIdx = toSlotIndex(start);
    const endIdx = toSlotIndex(normalizedEnd);
    const firstIdx = Math.min(startIdx, endIdx);
    const lastIdx = Math.max(startIdx, endIdx);
    const targetRow =
      (typeof log.actionSubNo === "number" ? rowBySubNo.get(log.actionSubNo) : undefined) ?? notesRow;

    for (let i = firstIdx; i <= lastIdx; i += 1) {
      const cell = targetRow.cells[i];
      const slotStartMs = dayStart.getTime() + i * SLOT_MS;
      const slotEndMs = slotStartMs + SLOT_MS;
      const overlapMs = Math.max(
        0,
        Math.min(normalizedEnd.getTime(), slotEndMs) - Math.max(start.getTime(), slotStartMs),
      );
      const overlapMinutes = Math.max(0, Math.round(overlapMs / 60_000));
      cell.minutes += overlapMinutes;
      cell.isPending = cell.isPending || log.isPending;
      cell.hasEmptyAction = cell.hasEmptyAction || !log.actionSubNo || !log.actionName;
      if (!cell.logId) cell.logId = log.id;
    }
  }

  const rows = [...baseRows, notesRow];
  const columnTotals = Array.from({ length: TOTAL_SLOTS }, (_, idx) =>
    rows.reduce((sum, row) => sum + row.cells[idx].minutes, 0),
  );

  return { slots, rows, columnTotals };
}
