import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import { HEADER_CELL_MAPPINGS } from "../export/officialTemplateMapping";
import type { StaffOption } from "./InputScreenA";
import type { ExportMeta } from "../export/exportOfficialTemplate";

export type WorkHourPreset = {
  id: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
};

type SettingsScreenCProps = {
  staffs: StaffOption[];
  selectedStaffId: string;
  onSelectStaff: (staffId: string) => void;
  onAddStaff: (name: string, staffCode: string) => boolean;
  onUpdateStaff: (staffId: string, patch: { name: string; staffCode: string }) => void;
  workHourStart: number | null;
  workHourEnd: number | null;
  onApplyWorkHours: (start: number | null, end: number | null) => void;
  presets: WorkHourPreset[];
  onAddPreset: (name: string, start: number, end: number) => void;
  onDeletePreset: (id: string) => void;
  onUsePreset: (preset: WorkHourPreset) => void;
  exportMeta: ExportMeta;
  onExportMetaChange: (next: ExportMeta) => void;
  surveyDateIso: string;
  onSurveyDateIsoChange: (iso: string) => void;
  onExportTemplate: () => void;
  exportMissingFields: string[];
  canExportTemplate: boolean;
};

const START_HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h);
const END_HOUR_OPTIONS = Array.from({ length: 25 }, (_, h) => h);
const MINUTE_OPTIONS: Array<0 | 30> = [0, 30];

export function SettingsScreenC({
  staffs,
  selectedStaffId,
  onSelectStaff,
  onAddStaff,
  onUpdateStaff,
  workHourStart,
  workHourEnd,
  onApplyWorkHours,
  presets,
  onAddPreset,
  onDeletePreset,
  onUsePreset,
  exportMeta,
  onExportMetaChange,
  surveyDateIso,
  onSurveyDateIsoChange,
  onExportTemplate,
  exportMissingFields,
  canExportTemplate,
}: SettingsScreenCProps) {
  const [startHour, setStartHour] = useState<number | null>(toHour(workHourStart));
  const [startMinute, setStartMinute] = useState<0 | 30 | null>(toMinute(workHourStart));
  const [endHour, setEndHour] = useState<number | null>(toHour(workHourEnd));
  const [endMinute, setEndMinute] = useState<0 | 30 | null>(toMinute(workHourEnd));
  const [presetName, setPresetName] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCode, setNewStaffCode] = useState("");
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingStaffName, setEditingStaffName] = useState("");
  const [editingStaffCode, setEditingStaffCode] = useState("");
  const [editableFields, setEditableFields] = useState<Record<"facilityName" | "unitName" | "staffCode" | "surveyDate" | "remarks", boolean>>({
    facilityName: false,
    unitName: false,
    staffCode: false,
    surveyDate: false,
    remarks: false,
  });

  useEffect(() => {
    setStartHour(toHour(workHourStart));
    setStartMinute(toMinute(workHourStart));
  }, [workHourStart]);

  useEffect(() => {
    setEndHour(toHour(workHourEnd));
    setEndMinute(toMinute(workHourEnd));
  }, [workHourEnd]);

  const draftStart = toMinutes(startHour, startMinute);
  const draftEnd = toMinutes(endHour, endMinute);
  const canApply = draftStart !== null && draftEnd !== null && draftStart !== draftEnd;

  const selectedStaffName = useMemo(
    () => staffs.find((x) => x.id === selectedStaffId)?.name ?? "未選択",
    [staffs, selectedStaffId],
  );

  function handleApplyWorkHours() {
    if (!canApply || draftStart === null || draftEnd === null) return;
    onApplyWorkHours(draftStart, draftEnd);
  }

  function handleSavePreset() {
    if (!canApply || draftStart === null || draftEnd === null) return;
    const name = presetName.trim() || `${formatMinutes(draftStart)}-${formatMinutes(draftEnd)}`;
    onAddPreset(name, draftStart, draftEnd);
    setPresetName("");
  }

  function startEditStaff(staff: StaffOption) {
    setEditingStaffId(staff.id);
    setEditingStaffName(staff.name);
    setEditingStaffCode(staff.staffCode);
  }

  function saveEditStaff() {
    if (!editingStaffId) return;
    onUpdateStaff(editingStaffId, { name: editingStaffName, staffCode: editingStaffCode });
    setEditingStaffId(null);
  }

  function handleAddStaffClick() {
    const ok = onAddStaff(newStaffName, newStaffCode);
    if (ok) {
      setNewStaffName("");
      setNewStaffCode("");
    }
  }

  function unlockField(field: "facilityName" | "unitName" | "staffCode" | "surveyDate" | "remarks") {
    setEditableFields((prev) => ({ ...prev, [field]: true }));
  }

  function lockField(field: "facilityName" | "unitName" | "staffCode" | "surveyDate" | "remarks") {
    setEditableFields((prev) => ({ ...prev, [field]: false }));
  }

  return (
    <main style={{ padding: 16, display: "grid", gap: 16 }}>
      <section style={cardStyle}>
        <h2 style={{ margin: "0 0 8px" }}>職員設定</h2>
        <p style={subTextStyle}>選択中: {selectedStaffName}</p>
        <div style={{ display: "grid", gap: 8 }}>
          {staffs.map((staff) => (
            <div key={staff.id} style={staffItemStyle}>
              {editingStaffId === staff.id ? (
                <>
                  <input value={editingStaffName} onChange={(e) => setEditingStaffName(e.target.value)} style={inputStyle} placeholder="職員名" />
                  <input value={editingStaffCode} onChange={(e) => setEditingStaffCode(e.target.value)} style={inputStyle} placeholder="職員ID" />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={saveEditStaff}>保存</button>
                    <button type="button" onClick={() => setEditingStaffId(null)}>キャンセル</button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onSelectStaff(staff.id)}
                    aria-pressed={selectedStaffId === staff.id}
                    style={{
                      ...staffSelectButtonStyle,
                      background: selectedStaffId === staff.id ? "#dceeff" : "#fff",
                    }}
                  >
                    {staff.name}（{staff.staffCode || "ID未設定"}）
                  </button>
                  <button type="button" onClick={() => startEditStaff(staff)}>編集</button>
                </>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input
            value={newStaffName}
            onChange={(e) => setNewStaffName(e.target.value)}
            style={inputStyle}
            placeholder="新規職員名"
          />
          <input
            value={newStaffCode}
            onChange={(e) => setNewStaffCode(e.target.value)}
            style={inputStyle}
            placeholder="新規職員ID"
          />
          <button type="button" onClick={handleAddStaffClick} disabled={!newStaffName.trim() || !newStaffCode.trim()}>
            職員を追加
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: "0 0 8px" }}>勤務時間設定</h2>
        <p style={subTextStyle}>
          現在: {workHourStart !== null && workHourEnd !== null ? `${formatMinutes(workHourStart)}〜${formatMinutes(workHourEnd)}` : "未設定"}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <label style={labelRowStyle}>
            開始
            <select value={startHour ?? ""} onChange={(e) => setStartHour(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">--</option>
              {START_HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}時
                </option>
              ))}
            </select>
            <select
              value={startMinute ?? ""}
              onChange={(e) => setStartMinute(e.target.value === "" ? null : (Number(e.target.value) as 0 | 30))}
            >
              <option value="">--</option>
              {MINUTE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}分
                </option>
              ))}
            </select>
          </label>

          <label style={labelRowStyle}>
            終了
            <select value={endHour ?? ""} onChange={(e) => setEndHour(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">--</option>
              {END_HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}時
                </option>
              ))}
            </select>
            <select
              value={endMinute ?? ""}
              onChange={(e) => setEndMinute(e.target.value === "" ? null : (Number(e.target.value) as 0 | 30))}
            >
              <option value="">--</option>
              {getEndMinuteOptions(endHour).map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}分
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={handleApplyWorkHours} disabled={!canApply}>
            勤務時間を適用
          </button>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="お気に入り名（例: 日勤）"
            style={{ padding: "7px 9px", border: "1px solid #b7cddd", borderRadius: 8, minWidth: 220 }}
          />
          <button type="button" onClick={handleSavePreset} disabled={!canApply}>
            お気に入り保存
          </button>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {presets.length === 0 ? (
            <p style={{ margin: 0, color: "#567" }}>お気に入りはまだありません。</p>
          ) : (
            presets.map((preset) => (
              <div key={preset.id} style={presetItemStyle}>
                <div>
                  <strong>{preset.name}</strong>
                  <div style={{ fontSize: 12, color: "#556f80" }}>
                    {formatMinutes(preset.startMinutes)}〜{formatMinutes(preset.endMinutes)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => onUsePreset(preset)}>
                    使用
                  </button>
                  <button type="button" onClick={() => onDeletePreset(preset.id)}>
                    削除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: "0 0 8px" }}>出力設定（公式テンプレート）</h2>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={fieldLabelStyle}>
            施設名
            <div style={editControlRowStyle}>
              <button type="button" onClick={() => (editableFields.facilityName ? lockField("facilityName") : unlockField("facilityName"))}>
                {editableFields.facilityName ? "編集完了" : "編集"}
              </button>
            </div>
            <input
              value={exportMeta.facilityName}
              onChange={(e) => onExportMetaChange({ ...exportMeta, facilityName: e.target.value })}
              disabled={!editableFields.facilityName}
              style={inputStyle}
            />
          </label>
          <label style={fieldLabelStyle}>
            ユニット・フロア名
            <div style={editControlRowStyle}>
              <button type="button" onClick={() => (editableFields.unitName ? lockField("unitName") : unlockField("unitName"))}>
                {editableFields.unitName ? "編集完了" : "編集"}
              </button>
            </div>
            <input
              value={exportMeta.unitName}
              onChange={(e) => onExportMetaChange({ ...exportMeta, unitName: e.target.value })}
              disabled={!editableFields.unitName}
              style={inputStyle}
            />
          </label>
          <label style={fieldLabelStyle}>
            職員ID
            <div style={editControlRowStyle}>
              <button type="button" onClick={() => (editableFields.staffCode ? lockField("staffCode") : unlockField("staffCode"))}>
                {editableFields.staffCode ? "編集完了" : "編集"}
              </button>
            </div>
            <input
              value={exportMeta.staffCode}
              onChange={(e) => onExportMetaChange({ ...exportMeta, staffCode: e.target.value })}
              disabled={!editableFields.staffCode}
              style={inputStyle}
            />
          </label>
          <label style={fieldLabelStyle}>
            調査日
            <div style={editControlRowStyle}>
              <button type="button" onClick={() => (editableFields.surveyDate ? lockField("surveyDate") : unlockField("surveyDate"))}>
                {editableFields.surveyDate ? "編集完了" : "編集"}
              </button>
            </div>
            <input
              type="date"
              value={surveyDateIso}
              onChange={(e) => {
                const next = e.target.value;
                onSurveyDateIsoChange(next);
              }}
              disabled={!editableFields.surveyDate}
              style={inputStyle}
            />
            <span style={{ fontSize: 12, color: "#556f80" }}>
              出力値: {exportMeta.surveyDate || "未選択"}
            </span>
          </label>
          <label style={fieldLabelStyle}>
            備考
            <div style={editControlRowStyle}>
              <button type="button" onClick={() => (editableFields.remarks ? lockField("remarks") : unlockField("remarks"))}>
                {editableFields.remarks ? "編集完了" : "編集"}
              </button>
            </div>
            <textarea
              value={exportMeta.remarks}
              onChange={(e) => onExportMetaChange({ ...exportMeta, remarks: e.target.value })}
              rows={2}
              disabled={!editableFields.remarks}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
          <button type="button" onClick={onExportTemplate}>
            公式テンプレートで出力（.xlsx）
          </button>
          {canExportTemplate ? (
            <p style={{ margin: 0, fontSize: 12, color: "#1c6b35" }}>出力に必要な入力は揃っています。</p>
          ) : (
            <div style={missingWrapStyle}>
              <strong style={{ fontSize: 12, color: "#8d2a32" }}>未入力項目</strong>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {exportMissingFields.map((item) => (
                  <li key={item} style={{ fontSize: 12, color: "#8d2a32" }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: "0 0 8px" }}>セル番地マッピング一覧</h2>
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={mapHeaderStyle}>項目</th>
                <th style={mapHeaderStyle}>セル</th>
                <th style={mapHeaderStyle}>入力元</th>
              </tr>
            </thead>
            <tbody>
              {HEADER_CELL_MAPPINGS.map((m) => (
                <tr key={m.key}>
                  <td style={mapBodyStyle}>{m.label}</td>
                  <td style={mapBodyStyle}>{m.cell}</td>
                  <td style={mapBodyStyle}>{m.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function toMinutes(hour: number | null, minute: 0 | 30 | null): number | null {
  if (hour === null || minute === null) return null;
  return hour * 60 + minute;
}

function toHour(minutes: number | null): number | null {
  if (minutes === null) return null;
  return Math.floor(minutes / 60);
}

function toMinute(minutes: number | null): 0 | 30 | null {
  if (minutes === null) return null;
  const m = minutes % 60;
  if (m === 0 || m === 30) return m;
  return null;
}

function getEndMinuteOptions(hour: number | null): Array<0 | 30> {
  if (hour === 24) return [0];
  return [0, 30];
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const cardStyle: CSSProperties = {
  border: "1px solid #d6e5f2",
  borderRadius: 12,
  background: "#ffffff",
  padding: 12,
};

const subTextStyle: CSSProperties = {
  margin: "0 0 8px",
  color: "#567",
  fontSize: 13,
};

const labelRowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
};

const staffItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 8,
  alignItems: "center",
  border: "1px solid #e0ebf4",
  borderRadius: 10,
  background: "#f8fcff",
  padding: "8px 10px",
};

const staffSelectButtonStyle: CSSProperties = {
  textAlign: "left",
  borderRadius: 999,
  padding: "8px 12px",
  border: "1px solid #9fb5c7",
};

const presetItemStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  border: "1px solid #e0ebf4",
  borderRadius: 10,
  background: "#f8fcff",
  padding: "8px 10px",
};

const fieldLabelStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 13,
};

const editControlRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const inputStyle: CSSProperties = {
  padding: "7px 9px",
  border: "1px solid #b7cddd",
  borderRadius: 8,
};

const mapHeaderStyle: CSSProperties = {
  borderBottom: "1px solid #d8e6f2",
  textAlign: "left",
  padding: "6px 8px",
  background: "#f3f9ff",
};

const mapBodyStyle: CSSProperties = {
  borderBottom: "1px solid #edf3f8",
  textAlign: "left",
  padding: "6px 8px",
};

const missingWrapStyle: CSSProperties = {
  border: "1px solid #f1b7bc",
  borderRadius: 8,
  background: "#fff1f2",
  padding: "6px 8px",
  display: "grid",
  gap: 4,
};
