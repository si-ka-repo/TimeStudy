import XlsxPopulate from "xlsx-populate/browser/xlsx-populate";

import {
  BLOCK_TIME_COLUMNS,
  HEADER_CELL_MAPPINGS,
  HOUR_LABEL_CELLS_BLOCK1,
  HOUR_LABEL_CELLS_BLOCK2,
  OFFICIAL_TEMPLATE_NAME,
  OFFICIAL_TEMPLATE_PATH,
  OFFICIAL_TEMPLATE_SHEET_NAME,
  TIME_GRID_MAPPINGS,
} from "./officialTemplateMapping";

type ExportLog = {
  actionSubNo?: number;
  actionName?: string;
  startTime: Date;
  endTime?: Date;
  isPending: boolean;
};

export type ExportMeta = {
  facilityName: string;
  unitName: string;
  staffCode: string;
  surveyDate: string;
  remarks: string;
};

export type ExportInput = {
  logs: ExportLog[];
  workHourStart: number | null;
  workHourEnd: number | null;
  manualGridValues?: Record<string, number>;
  meta: ExportMeta;
};

export type ExportFeedback = {
  warnings: string[];
};

export async function exportOfficialTemplate(input: ExportInput): Promise<ExportFeedback> {
  const warnings: string[] = [];

  if (input.workHourStart === null || input.workHourEnd === null) {
    throw new Error("勤務時間が未設定です。画面Cで勤務時間を設定してください。");
  }
  if (input.workHourStart === input.workHourEnd) {
    throw new Error("勤務時間の開始と終了が同じです。設定を確認してください。");
  }

  const workbookData = await loadOfficialTemplateBinary();
  const workbook = await XlsxPopulate.fromDataAsync(workbookData);
  const sheet = workbook.sheet(OFFICIAL_TEMPLATE_SHEET_NAME);

  const actualBounds = calcActualWorkBounds(input.logs);
  const actualRange = actualBounds ? `${formatTime(actualBounds.start)}〜${formatTime(actualBounds.end)}` : null;
  const scheduledText = `${formatMinutes(input.workHourStart)}〜${formatMinutes(input.workHourEnd)}`;
  const baseStartMinutesRaw = actualBounds ? minuteOfDay(actualBounds.start) : input.workHourStart;
  const baseStartMinutes = Math.floor(baseStartMinutesRaw / 10) * 10;

  const headerValues: Record<string, string> = {
    facilityName: input.meta.facilityName,
    unitName: input.meta.unitName,
    staffCode: input.meta.staffCode,
    surveyDate: input.meta.surveyDate,
    scheduledWorkTime: scheduledText,
    actualWorkTime: actualRange ?? "",
    remarksTop: input.meta.remarks,
    remarksBottom: input.meta.remarks,
  };

  for (const mapping of HEADER_CELL_MAPPINGS) {
    sheet.cell(mapping.cell).value(headerValues[mapping.key] ?? "");
  }

  const slotMinutes = buildSlotMinutes(input.logs, baseStartMinutes, input.manualGridValues ?? {});

  // hour labels (6 hours per block x 2 blocks = 12h)
  for (let i = 0; i < HOUR_LABEL_CELLS_BLOCK1.length; i += 1) {
    const baseMinutes = (baseStartMinutes + i * 60) % 1440;
    sheet.cell(HOUR_LABEL_CELLS_BLOCK1[i]).value(Math.floor(baseMinutes / 60));
  }
  for (let i = 0; i < HOUR_LABEL_CELLS_BLOCK2.length; i += 1) {
    const baseMinutes = (baseStartMinutes + 360 + i * 60) % 1440;
    sheet.cell(HOUR_LABEL_CELLS_BLOCK2[i]).value(Math.floor(baseMinutes / 60));
  }

  for (const rowDef of TIME_GRID_MAPPINGS) {
    for (let slot = 0; slot < 72; slot += 1) {
      const col = BLOCK_TIME_COLUMNS[slot % 36];
      const row = slot < 36 ? rowDef.block1Row : rowDef.block2Row;
      const value = slotMinutes[rowDef.subNo]?.[slot] ?? 0;
      sheet.cell(`${col}${row}`).value(value > 0 ? value : undefined);
    }
  }

  const over12h = input.logs.some((x) => {
    if (!x.endTime) return false;
    return (x.endTime.getTime() - x.startTime.getTime()) / 60000 > 720;
  });

  if (over12h) warnings.push("12時間を超えるログがあり、テンプレート外は出力できません。");
  if (!input.meta.facilityName) warnings.push("施設名が未入力です。ヘッダが空欄になります。");
  if (!input.meta.unitName) warnings.push("ユニット・フロア名が未入力です。ヘッダが空欄になります。");
  if (!input.meta.staffCode) warnings.push("職員IDが未入力です。ヘッダが空欄になります。");

  const outputData = await workbook.outputAsync();
  downloadBlob(new Blob([outputData], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `export_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.xlsx`);

  return { warnings };
}

function buildSlotMinutes(
  logs: ExportLog[],
  shiftStartMinutes: number,
  manualGridValues: Record<string, number>,
): Record<number, number[]> {
  const result: Record<number, number[]> = {};
  for (let subNo = 1; subNo <= 24; subNo += 1) result[subNo] = Array.from({ length: 72 }, () => 0);

  for (const log of logs) {
    if (!log.actionSubNo || log.actionSubNo < 1 || log.actionSubNo > 24) continue;
    if (!log.endTime) continue;

    const startMin = minuteOfDay(log.startTime);
    const duration = Math.max(1, Math.round((log.endTime.getTime() - log.startTime.getTime()) / 60000));
    let offsetStart = (startMin - shiftStartMinutes + 1440) % 1440;
    if (offsetStart >= 720) continue;

    const offsetEnd = Math.min(720, offsetStart + duration);

    for (let slot = 0; slot < 72; slot += 1) {
      const slotStart = slot * 10;
      const slotEnd = slotStart + 10;
      const overlap = Math.max(0, Math.min(offsetEnd, slotEnd) - Math.max(offsetStart, slotStart));
      if (overlap > 0) {
        result[log.actionSubNo][slot] += Math.round(overlap);
      }
    }
  }

  for (const [key, rawValue] of Object.entries(manualGridValues)) {
    const [subNoText, slotIndexText] = key.split("_");
    const subNo = Number(subNoText);
    const slotIndex = Number(slotIndexText);
    if (!Number.isFinite(subNo) || subNo < 1 || subNo > 24) continue;
    if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex > 143) continue;

    const clampedValue = Math.max(0, Math.min(10, Math.round(rawValue)));
    const slotAbsoluteMinute = slotIndex * 10;
    const offsetMinutes = (slotAbsoluteMinute - shiftStartMinutes + 1440) % 1440;
    if (offsetMinutes >= 720) continue;

    const outputSlot = Math.floor(offsetMinutes / 10);
    result[subNo][outputSlot] = clampedValue;
  }

  return result;
}

function calcActualWorkBounds(logs: ExportLog[]): { start: Date; end: Date } | null {
  const ended = logs.filter((x) => x.endTime);
  if (ended.length === 0) return null;

  const minStart = ended.reduce((min, x) => (x.startTime.getTime() < min.getTime() ? x.startTime : min), ended[0].startTime);
  const maxEnd = ended.reduce(
    (max, x) => ((x.endTime as Date).getTime() > max.getTime() ? (x.endTime as Date) : max),
    ended[0].endTime as Date,
  );
  return { start: minStart, end: maxEnd };
}

function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadOfficialTemplateBinary(): Promise<ArrayBuffer> {
  const response = await fetch(OFFICIAL_TEMPLATE_PATH, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`公式テンプレートの読み込みに失敗しました（HTTP ${response.status}）。`);
  }

  const data = await response.arrayBuffer();
  if (!isZipFile(data)) {
    throw new Error(
      `テンプレートがExcel形式で読み込めませんでした。${OFFICIAL_TEMPLATE_NAME} が /public/templates に正しく配置されているか確認してください。`,
    );
  }
  return data;
}

function isZipFile(data: ArrayBuffer): boolean {
  if (data.byteLength < 4) return false;
  const view = new Uint8Array(data);
  return view[0] === 0x50 && view[1] === 0x4b && (view[2] === 0x03 || view[2] === 0x05 || view[2] === 0x07);
}
