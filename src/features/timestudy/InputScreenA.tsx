import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { TIME_STUDY_ACTIONS, type TimeStudyActionDefinition } from "../../config/timeStudyActions";

export type StaffOption = {
  id: string;
  name: string;
  staffCode: string;
};

export type LogDraft = {
  staffId: string;
  actionSubNo?: number;
  actionName?: string;
  startTime: Date;
  endTime?: Date;
  memo?: string;
  isPending?: boolean;
};

export type InputLogHistoryItem = {
  id: string;
  staffId: string;
  actionName?: string;
  startTime: Date;
  endTime?: Date;
  memo?: string;
  isPending: boolean;
};

export type InProgressAction = {
  staffId: string;
  actionSubNo: number;
  actionName: string;
  startTime: Date;
};

type InputScreenAProps = {
  staffs: StaffOption[];
  selectedStaffId: string;
  selectedStaffName: string;
  logHistory: InputLogHistoryItem[];
  onRegister: (draft: LogDraft) => void;
  onActiveActionChange?: (active: InProgressAction | null) => void;
};

const LONG_PRESS_MS = 600;

export function InputScreenA({
  staffs,
  selectedStaffId,
  selectedStaffName,
  logHistory,
  onRegister,
  onActiveActionChange,
}: InputScreenAProps) {
  const [selectedActionSubNo, setSelectedActionSubNo] = useState<number | undefined>();
  const [otherMemo, setOtherMemo] = useState("");
  const [activeAction, setActiveAction] = useState<{ action: TimeStudyActionDefinition; startTime: Date } | null>(null);
  const [longPressEnabled, setLongPressEnabled] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ actionName: string; startTime: Date; endTime: Date } | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const holdTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const selectedAction = useMemo(
    () => TIME_STUDY_ACTIONS.find((a) => a.subNo === selectedActionSubNo),
    [selectedActionSubNo],
  );
  const directCareActions = useMemo(() => TIME_STUDY_ACTIONS.filter((a) => a.subNo <= 9), []);
  const nonDirectActions = useMemo(() => TIME_STUDY_ACTIONS.filter((a) => a.subNo >= 10), []);

  const isOtherSelected = Boolean(selectedAction?.isOther);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedStaffId && activeAction) {
      setActiveAction(null);
      onActiveActionChange?.(null);
    }
  }, [selectedStaffId, activeAction, onActiveActionChange]);

  const elapsedText = activeAction ? formatElapsed(activeAction.startTime, nowMs) : "";
  const elapsedSeconds = activeAction ? Math.max(0, Math.floor((nowMs - new Date(activeAction.startTime).getTime()) / 1000)) : 0;
  const isLongRunning = elapsedSeconds >= 5 * 60;

  function resolveStaffName(staffId: string): string {
    return staffs.find((x) => x.id === staffId)?.name ?? "不明な職員";
  }

  function commitAction(action: TimeStudyActionDefinition, startTime: Date, endTime: Date) {
    if (!selectedStaffId) return;
    if (endTime.getTime() < startTime.getTime()) return;

    const memo = action.isOther ? otherMemo.trim() : "";
    const draft: LogDraft = {
      staffId: selectedStaffId,
      actionSubNo: action.subNo,
      actionName: action.actionName,
      startTime,
      endTime,
      memo: memo || undefined,
      isPending: false,
    };

    onRegister(draft);
    setLastSaved({
      actionName: draft.actionName ?? "-",
      startTime: draft.startTime,
      endTime: draft.endTime ?? endTime,
    });
  }

  function transitionAction(nextAction: TimeStudyActionDefinition) {
    if (!selectedStaffId) {
      window.alert("先に画面Aで職員を選択してください。");
      return;
    }

    const now = new Date();

    if (!activeAction) {
      const nextActive = { action: nextAction, startTime: now };
      setActiveAction(nextActive);
      onActiveActionChange?.({
        staffId: selectedStaffId,
        actionSubNo: nextAction.subNo,
        actionName: nextAction.actionName,
        startTime: now,
      });
      setSelectedActionSubNo(nextAction.subNo);
      if (!nextAction.isOther) setOtherMemo("");
      return;
    }

    if (activeAction.action.subNo === nextAction.subNo) {
      setSelectedActionSubNo(nextAction.subNo);
      return;
    }

    commitAction(activeAction.action, activeAction.startTime, now);
    const nextActive = { action: nextAction, startTime: now };
    setActiveAction(nextActive);
    onActiveActionChange?.({
      staffId: selectedStaffId,
      actionSubNo: nextAction.subNo,
      actionName: nextAction.actionName,
      startTime: now,
    });
    setSelectedActionSubNo(nextAction.subNo);
    if (!nextAction.isOther) setOtherMemo("");
  }

  function endCurrentAction() {
    if (!activeAction) {
      window.alert("進行中の項目はありません。");
      return;
    }

    const now = new Date();
    commitAction(activeAction.action, activeAction.startTime, now);
    setActiveAction(null);
    onActiveActionChange?.(null);
  }

  function handleActionPointerDown(action: TimeStudyActionDefinition) {
    if (!longPressEnabled) return;
    longPressTriggeredRef.current = false;

    holdTimerRef.current = window.setTimeout(() => {
      transitionAction(action);
      longPressTriggeredRef.current = true;
    }, LONG_PRESS_MS);
  }

  function handleActionPointerUp(action: TimeStudyActionDefinition) {
    if (!longPressEnabled) return;

    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (!longPressTriggeredRef.current) {
      return;
    }

    longPressTriggeredRef.current = false;
    setSelectedActionSubNo(action.subNo);
  }

  function handleActionPointerLeave() {
    if (!longPressEnabled) return;
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function renderActionButton(action: TimeStudyActionDefinition) {
    const isRecording = activeAction?.action.subNo === action.subNo;
    const isSelected = selectedActionSubNo === action.subNo;
    const className = [
      "action-btn",
      isRecording ? "action-btn--recording" : "",
      !isRecording && isSelected ? "action-btn--selected" : "",
      longPressEnabled && !isRecording ? "action-btn--long-press-mode" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        key={action.subNo}
        type="button"
        className={className}
        onClick={longPressEnabled ? undefined : () => transitionAction(action)}
        onPointerDown={() => handleActionPointerDown(action)}
        onPointerUp={() => handleActionPointerUp(action)}
        onPointerLeave={handleActionPointerLeave}
        onPointerCancel={handleActionPointerLeave}
        aria-pressed={isSelected}
        aria-label={`${action.subNo}. ${action.actionName}${isRecording ? "（記録中）" : ""}`}
      >
        {action.subNo}. {action.actionName}
        {isRecording ? <span className="action-btn__badge">● 記録中</span> : null}
      </button>
    );
  }

  return (
    <main className="screen-main">
      <Card variant="info" style={staffInfoCardStyle}>
        <strong>設定中の職員</strong>
        <span>{selectedStaffId ? selectedStaffName : "未設定（画面Aで選択）"}</span>
      </Card>

      <Card
        variant={activeAction ? "inProgressActive" : "inProgress"}
        style={stickyInProgressCardStyle}
      >
        {activeAction ? <span className="in-progress-badge">記録中</span> : null}
        <strong style={{ color: "var(--color-text-strong)" }}>進行中</strong>
        {activeAction ? (
          <div style={{ display: "grid", gap: 2, fontSize: 13 }}>
            <span>職員: {selectedStaffName}</span>
            <span>項目: {activeAction.action.actionName}</span>
            <span>開始: {activeAction.startTime.toLocaleString("ja-JP")}</span>
            <span style={{ fontWeight: 700, color: "var(--color-danger)" }}>経過: {elapsedText}</span>
            {isLongRunning ? <span style={warningTextStyle}>5分以上進行中です。終了登録漏れに注意してください。</span> : null}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>進行中の記録はありません</span>
        )}
      </Card>

      <section>
        <h2>介助項目（クイック選択）</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, minHeight: "var(--touch-min)" }}>
            <input
              type="checkbox"
              checked={longPressEnabled}
              onChange={(e) => setLongPressEnabled(e.target.checked)}
            />
            長押しで項目開始（誤爆回避）
          </label>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {longPressEnabled ? "長押し(0.6秒)で開始/切替" : "タップで開始/切替"}
          </span>
        </div>

        {longPressEnabled ? (
          <p className="long-press-banner" role="note">
            長押しモード中です。各項目を約0.6秒押し続けると開始・切替します（短いタップでは反応しません）。
          </p>
        ) : null}

        <div style={{ background: "#ffeef3", border: "1px solid #f4ccd8", borderRadius: 10, padding: 10 }}>
          <p style={{ margin: "0 0 8px", color: "#3f6179", fontSize: 13 }}>1-9: 直接介護</p>
          <div className="action-grid">{directCareActions.map(renderActionButton)}</div>
        </div>
        <div style={{ marginTop: 10, background: "#fff9e8", border: "1px solid #f0dfad", borderRadius: 10, padding: 10 }}>
          <p style={{ margin: "0 0 8px", color: "#3f6179", fontSize: 13 }}>10-24: 間接業務・休憩・その他・余裕時間</p>
          <div className="action-grid">{nonDirectActions.map(renderActionButton)}</div>
        </div>
      </section>

      {isOtherSelected ? (
        <section>
          <h3>「その他」内容</h3>
          <textarea
            value={otherMemo}
            onChange={(e) => setOtherMemo(e.target.value)}
            placeholder="具体的な内容を入力（または音声入力の結果を保持）"
            rows={3}
            style={{ width: "100%", padding: 8 }}
          />
        </section>
      ) : null}

      <section>
        <h2>操作</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button variant="primary" onClick={endCurrentAction} disabled={!activeAction}>
            現在の項目を終了して登録
          </Button>
        </div>
      </section>

      <aside
        style={{
          borderTop: "1px solid #ddd",
          paddingTop: 8,
          color: "#555",
          fontSize: 12,
        }}
      >
        最終入力:
        {lastSaved
          ? ` ${lastSaved.actionName} / 開始 ${lastSaved.startTime.toLocaleTimeString("ja-JP")} / 終了 ${lastSaved.endTime.toLocaleTimeString("ja-JP")}`
          : " なし"}
      </aside>

      <aside style={{ justifySelf: "end", width: "min(100%, 560px)" }}>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>登録ログ一覧（画面B）</summary>
          <div
            style={{
              marginTop: 8,
              border: "1px solid #d3dce2",
              borderRadius: 8,
              maxHeight: 280,
              overflow: "auto",
              background: "#fff",
            }}
          >
            {logHistory.length === 0 ? (
              <p style={{ margin: 0, padding: 12, color: "#567" }}>登録ログはありません。</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={logHeaderCellStyle}>時刻</th>
                    <th style={logHeaderCellStyle}>職員</th>
                    <th style={logHeaderCellStyle}>項目</th>
                    <th style={logHeaderCellStyle}>メモ</th>
                  </tr>
                </thead>
                <tbody>
                  {logHistory.map((log) => (
                    <tr key={log.id}>
                      <td style={logBodyCellStyle}>
                        {new Date(log.startTime).toLocaleTimeString("ja-JP")} -{" "}
                        {log.endTime ? new Date(log.endTime).toLocaleTimeString("ja-JP") : "未終了"}
                      </td>
                      <td style={logBodyCellStyle}>{resolveStaffName(log.staffId)}</td>
                      <td style={logBodyCellStyle}>
                        {log.actionName ?? "未分類"} {log.isPending ? "(要確認)" : ""}
                      </td>
                      <td style={logBodyCellStyle}>{log.memo ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>
      </aside>
    </main>
  );
}

function formatElapsed(startTime: Date, now: number): string {
  const diffSeconds = Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 1000));
  const mm = Math.floor(diffSeconds / 60);
  const ss = diffSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

const staffInfoCardStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
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

const stickyInProgressCardStyle: CSSProperties = {
  position: "sticky",
  top: "var(--sticky-panel-top)",
  zIndex: 6,
  border: "1px solid #b9d2e5",
  borderRadius: 10,
  background: "#f3f9ff",
  padding: "8px 12px",
  display: "grid",
  gap: 4,
  maxHeight: "var(--sticky-panel-max-height)",
  overflowY: "auto",
};

const warningTextStyle: CSSProperties = {
  marginTop: 4,
  color: "#9a2f3f",
  fontSize: 12,
  fontWeight: 700,
};
