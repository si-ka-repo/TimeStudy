import { useEffect, useMemo, useState } from "react";

import { exportOfficialTemplate, type ExportMeta } from "./features/export/exportOfficialTemplate";
import { SettingsScreenC, type WorkHourPreset } from "./features/timestudy/SettingsScreenC";
import { InputScreenA, type InProgressAction, type LogDraft, type StaffOption } from "./features/timestudy/InputScreenA";
import { SheetScreenB } from "./features/timestudy/SheetScreenB";

type UiTab = "A" | "B" | "C";

type UiLog = {
  id: string;
  staffId: string;
  actionSubNo?: number;
  actionName?: string;
  startTime: Date;
  endTime?: Date;
  memo?: string;
  isPending: boolean;
};

const DEFAULT_STAFFS: StaffOption[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "職員A", staffCode: "A001" },
  { id: "22222222-2222-4222-8222-222222222222", name: "職員B", staffCode: "B001" },
  { id: "33333333-3333-4333-8333-333333333333", name: "職員C", staffCode: "C001" },
];

const PRESET_STORAGE_KEY = "time-study-workhour-presets";
const APP_SETTINGS_STORAGE_KEY = "time-study-app-settings";
const STAFF_MASTER_STORAGE_KEY = "time-study-staff-master";
const SESSION_DATA_STORAGE_KEY = "time-study-session-data";

type PersistedSettings = {
  selectedStaffId: string;
  workHourStart: number | null;
  workHourEnd: number | null;
  exportMeta: Pick<ExportMeta, "facilityName" | "unitName" | "staffCode" | "remarks">;
};

type PersistedSessionData = {
  logs: Array<Omit<UiLog, "startTime" | "endTime"> & { startTime: string; endTime?: string }>;
  manualGridValues: Record<string, number>;
};

export function App() {
  const todayIso = getTodayIsoDate();
  const persistedSettings = readPersistedSettings();
  const persistedSessionData = readSessionData();
  const [activeTab, setActiveTab] = useState<UiTab>("A");
  const [logs, setLogs] = useState<UiLog[]>(persistedSessionData.logs);
  const [inProgress, setInProgress] = useState<InProgressAction | null>(null);
  const [staffs, setStaffs] = useState<StaffOption[]>(readStaffMaster);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(persistedSettings?.selectedStaffId ?? "");
  const [workHourStart, setWorkHourStart] = useState<number | null>(persistedSettings?.workHourStart ?? null);
  const [workHourEnd, setWorkHourEnd] = useState<number | null>(persistedSettings?.workHourEnd ?? null);
  const [presets, setPresets] = useState<WorkHourPreset[]>(readPresets);
  const [surveyDateIso, setSurveyDateIso] = useState<string>(todayIso);
  const [exportMeta, setExportMeta] = useState<ExportMeta>({
    facilityName: persistedSettings?.exportMeta.facilityName ?? "",
    unitName: persistedSettings?.exportMeta.unitName ?? "",
    staffCode: persistedSettings?.exportMeta.staffCode ?? "",
    surveyDate: formatSurveyDate(todayIso),
    remarks: persistedSettings?.exportMeta.remarks ?? "",
  });
  const [manualGridValues, setManualGridValues] = useState<Record<string, number>>(persistedSessionData.manualGridValues);
  const [notice, setNotice] = useState<string>("準備が完了しました。画面Aで設定してください。");

  useEffect(() => {
    try {
      window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
    } catch {
      // ignore write error
    }
  }, [presets]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STAFF_MASTER_STORAGE_KEY, JSON.stringify(staffs));
    } catch {
      // ignore write error
    }
  }, [staffs]);

  useEffect(() => {
    const payload: PersistedSettings = {
      selectedStaffId,
      workHourStart,
      workHourEnd,
      exportMeta: {
        facilityName: exportMeta.facilityName,
        unitName: exportMeta.unitName,
        staffCode: exportMeta.staffCode,
        remarks: exportMeta.remarks,
      },
    };
    try {
      window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore write error
    }
  }, [selectedStaffId, workHourStart, workHourEnd, exportMeta.facilityName, exportMeta.unitName, exportMeta.staffCode, exportMeta.remarks]);

  useEffect(() => {
    const payload: PersistedSessionData = {
      logs: logs.map((log) => ({
        ...log,
        startTime: log.startTime.toISOString(),
        endTime: log.endTime ? log.endTime.toISOString() : undefined,
      })),
      manualGridValues,
    };
    try {
      window.localStorage.setItem(SESSION_DATA_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore write error
    }
  }, [logs, manualGridValues]);

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    [logs],
  );

  const selectedStaffName = useMemo(
    () => staffs.find((x) => x.id === selectedStaffId)?.name ?? "未選択",
    [selectedStaffId, staffs],
  );
  const exportMissingFields = useMemo(() => {
    const missing: string[] = [];
    if (!selectedStaffId) missing.push("職員");
    if (workHourStart === null || workHourEnd === null) missing.push("勤務時間");
    if (!exportMeta.facilityName.trim()) missing.push("施設名");
    if (!exportMeta.unitName.trim()) missing.push("ユニット・フロア名");
    if (!exportMeta.staffCode.trim()) missing.push("職員ID");
    if (!exportMeta.surveyDate.trim()) missing.push("調査日");
    return missing;
  }, [selectedStaffId, workHourStart, workHourEnd, exportMeta]);
  const canExportTemplate = exportMissingFields.length === 0;

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!inProgress) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [inProgress]);

  function switchTab(nextTab: UiTab) {
    if (nextTab === activeTab) return;
    if (activeTab === "B" && nextTab === "A" && (logs.length > 0 || inProgress)) {
      window.alert("記録中は画面Aに戻れません。画面Cから提出チェックを行ってください。");
      return;
    }
    if (inProgress && activeTab === "B") {
      const ok = window.confirm("進行中の記録があります。画面を切り替えますか？");
      if (!ok) return;
    }
    setActiveTab(nextTab);
  }

  function onRegister(draft: LogDraft) {
    if (!draft.endTime) return;
    const start = draft.startTime;
    const end = draft.endTime;
    const newLog: UiLog = {
      id: crypto.randomUUID(),
      staffId: draft.staffId,
      actionSubNo: draft.actionSubNo,
      actionName: draft.actionName,
      startTime: new Date(start),
      endTime: new Date(end),
      memo: draft.memo,
      isPending: Boolean(draft.isPending),
    };
    setLogs((prev) => [...prev, newLog]);
    setNotice(
      `登録しました: ${newLog.actionName ?? "未分類"} / 開始 ${start.toLocaleTimeString("ja-JP")} / 終了 ${end.toLocaleTimeString("ja-JP")}`,
    );
  }

  function handleApplyWorkHours(start: number | null, end: number | null) {
    setWorkHourStart(start);
    setWorkHourEnd(end);
    if (start !== null && end !== null) {
      setNotice(`勤務時間を設定しました: ${formatMinutes(start)}〜${formatMinutes(end)}`);
    }
  }

  function handleAddPreset(name: string, start: number, end: number) {
    const preset: WorkHourPreset = {
      id: crypto.randomUUID(),
      name,
      startMinutes: start,
      endMinutes: end,
    };
    setPresets((prev) => [preset, ...prev]);
    setNotice(`お気に入りを保存しました: ${preset.name}`);
  }

  function handleDeletePreset(id: string) {
    const ok = window.confirm("このお気に入りを削除しますか？");
    if (!ok) return;
    setPresets((prev) => prev.filter((p) => p.id !== id));
    setNotice("お気に入りを削除しました。");
  }

  function handleUsePreset(preset: WorkHourPreset) {
    setWorkHourStart(preset.startMinutes);
    setWorkHourEnd(preset.endMinutes);
    setNotice(`お気に入りを適用しました: ${preset.name}`);
  }

  function handleSelectStaff(staffId: string) {
    setSelectedStaffId(staffId);
    const selected = staffs.find((s) => s.id === staffId);
    setExportMeta((prev) => ({ ...prev, staffCode: selected?.staffCode ?? "" }));
    setNotice(`職員を設定しました: ${selected?.name ?? "-"}`);
  }

  function handleAddStaff(name: string, staffCode: string): boolean {
    const normalizedName = name.trim();
    const normalizedCode = staffCode.trim();
    if (!normalizedName || !normalizedCode) return false;
    if (staffs.some((s) => s.staffCode === normalizedCode)) {
      window.alert("同じ職員IDがすでに登録されています。");
      return false;
    }
    const next: StaffOption = { id: crypto.randomUUID(), name: normalizedName, staffCode: normalizedCode };
    setStaffs((prev) => [...prev, next]);
    setNotice(`職員を追加しました: ${next.name}（${next.staffCode}）`);
    return true;
  }

  function handleUpdateStaff(staffId: string, patch: { name: string; staffCode: string }) {
    const normalizedName = patch.name.trim();
    const normalizedCode = patch.staffCode.trim();
    if (!normalizedName || !normalizedCode) return;
    if (staffs.some((s) => s.id !== staffId && s.staffCode === normalizedCode)) {
      window.alert("同じ職員IDがすでに登録されています。");
      return;
    }

    setStaffs((prev) =>
      prev.map((staff) => (staff.id === staffId ? { ...staff, name: normalizedName, staffCode: normalizedCode } : staff)),
    );

    if (selectedStaffId === staffId) {
      setExportMeta((prev) => ({ ...prev, staffCode: normalizedCode }));
    }
    setNotice(`職員情報を更新しました: ${normalizedName}（${normalizedCode}）`);
  }

  function handleSheetCellValueChange(payload: {
    rowLabel: string;
    rowSubNo?: number;
    slotIndex: number;
    hourLabel: string;
    slotLabel: string;
    value: number;
  }) {
    if (typeof payload.rowSubNo === "number" && payload.rowSubNo >= 1 && payload.rowSubNo <= 24) {
      const key = `${payload.rowSubNo}_${payload.slotIndex}`;
      setManualGridValues((prev) => ({ ...prev, [key]: payload.value }));
    }
    setNotice(`セル更新: ${payload.rowLabel} / ${payload.hourLabel} ${payload.slotLabel} = ${payload.value}`);
  }

  async function handleExportTemplate() {
    if (!canExportTemplate) {
      window.alert(`未入力項目があります。\n- ${exportMissingFields.join("\n- ")}`);
      setNotice("未入力項目があるため出力できません。画面Aで設定を確認してください。");
      return;
    }
    try {
      const feedback = await exportOfficialTemplate({
        logs: sortedLogs,
        workHourStart,
        workHourEnd,
        manualGridValues,
        meta: exportMeta,
      });
      if (feedback.warnings.length > 0) {
        setNotice(`出力完了（注意 ${feedback.warnings.length}件）。設定画面Cの注意欄を確認してください。`);
        window.alert(`出力は完了しました。\n\n注意事項:\n- ${feedback.warnings.join("\n- ")}`);
      } else {
        setNotice("公式テンプレートで出力しました。");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "不明なエラー";
      setNotice(`出力に失敗しました: ${message}`);
      window.alert(`出力に失敗しました。\n${message}`);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>介護タイムスタディ</h1>
        <div className="tabs">
          <button type="button" className={activeTab === "A" ? "tab active" : "tab"} onClick={() => switchTab("A")}>
            画面A 設定
          </button>
          <button type="button" className={activeTab === "B" ? "tab active" : "tab"} onClick={() => switchTab("B")}>
            画面B ログ入力
          </button>
          <button type="button" className={activeTab === "C" ? "tab active" : "tab"} onClick={() => switchTab("C")}>
            画面C 提出チェック
          </button>
        </div>
      </header>

      <p className="notice">{notice}</p>

      <div style={{ display: activeTab === "A" ? "block" : "none" }}>
        <SettingsScreenC
          staffs={staffs}
          selectedStaffId={selectedStaffId}
          onSelectStaff={handleSelectStaff}
          onAddStaff={handleAddStaff}
          onUpdateStaff={handleUpdateStaff}
          workHourStart={workHourStart}
          workHourEnd={workHourEnd}
          onApplyWorkHours={handleApplyWorkHours}
          presets={presets}
          onAddPreset={handleAddPreset}
          onDeletePreset={handleDeletePreset}
          onUsePreset={handleUsePreset}
          exportMeta={exportMeta}
          onExportMetaChange={setExportMeta}
          surveyDateIso={surveyDateIso}
          onSurveyDateIsoChange={(iso) => {
            setSurveyDateIso(iso);
            setExportMeta((prev) => ({ ...prev, surveyDate: formatSurveyDate(iso) }));
          }}
          onExportTemplate={handleExportTemplate}
          exportMissingFields={exportMissingFields}
          canExportTemplate={canExportTemplate}
        />
      </div>

      <div style={{ display: activeTab === "B" ? "block" : "none" }}>
        <InputScreenA
          staffs={staffs}
          selectedStaffId={selectedStaffId}
          selectedStaffName={selectedStaffName}
          logHistory={sortedLogs}
          onRegister={onRegister}
          onActiveActionChange={setInProgress}
        />
      </div>

      <div style={{ display: activeTab === "C" ? "block" : "none" }}>
        <SheetScreenB
          staffs={staffs}
          logs={sortedLogs}
          inProgress={inProgress}
          workHourStart={workHourStart}
          workHourEnd={workHourEnd}
          manualValues={manualGridValues}
          onCellValueChange={handleSheetCellValueChange}
        />
      </div>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatSurveyDate(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${m}月${d}日（${weekdays[date.getDay()]}）`;
}

function readPresets(): WorkHourPreset[] {
  try {
    const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkHourPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readPersistedSettings(): PersistedSettings | null {
  try {
    const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSettings;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function readStaffMaster(): StaffOption[] {
  try {
    const raw = window.localStorage.getItem(STAFF_MASTER_STORAGE_KEY);
    if (!raw) return DEFAULT_STAFFS;
    const parsed = JSON.parse(raw) as StaffOption[];
    if (!Array.isArray(parsed)) return DEFAULT_STAFFS;

    const normalized = parsed
      .filter((x) => x && typeof x.id === "string" && typeof x.name === "string")
      .map((x) => ({
        id: x.id,
        name: x.name,
        staffCode: typeof x.staffCode === "string" ? x.staffCode : "",
      }));

    return normalized.length > 0 ? normalized : DEFAULT_STAFFS;
  } catch {
    return DEFAULT_STAFFS;
  }
}

function readSessionData(): { logs: UiLog[]; manualGridValues: Record<string, number> } {
  try {
    const raw = window.localStorage.getItem(SESSION_DATA_STORAGE_KEY);
    if (!raw) return { logs: [], manualGridValues: {} };
    const parsed = JSON.parse(raw) as PersistedSessionData;
    if (!parsed || typeof parsed !== "object") return { logs: [], manualGridValues: {} };

    const logs = Array.isArray(parsed.logs)
      ? parsed.logs
          .map((x) => ({
            ...x,
            startTime: new Date(x.startTime),
            endTime: x.endTime ? new Date(x.endTime) : undefined,
          }))
          .filter((x) => !Number.isNaN(x.startTime.getTime()) && (!x.endTime || !Number.isNaN(x.endTime.getTime())))
      : [];

    const manualGridValues =
      parsed.manualGridValues && typeof parsed.manualGridValues === "object" ? parsed.manualGridValues : {};
    return { logs, manualGridValues };
  } catch {
    return { logs: [], manualGridValues: {} };
  }
}
