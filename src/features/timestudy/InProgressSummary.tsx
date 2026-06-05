import { formatInProgressStaffLine, formatStartTimeOnly } from "./inProgressDisplay";

type InProgressSummaryProps = {
  staffName: string;
  actionName: string;
  startTime: Date;
  elapsedText: string;
  isLongRunning?: boolean;
};

export function InProgressSummary({
  staffName,
  actionName,
  startTime,
  elapsedText,
  isLongRunning = false,
}: InProgressSummaryProps) {
  return (
    <div className="in-progress-summary">
      <p className="in-progress-summary__staff">{formatInProgressStaffLine(staffName)}</p>
      <p className="in-progress-summary__detail">
        <span className="in-progress-summary__action">{actionName}</span>
        <span className="in-progress-summary__sep"> - </span>
        <span className="in-progress-summary__start">{formatStartTimeOnly(startTime)}</span>
        <span className="in-progress-summary__elapsed">{elapsedText}</span>
      </p>
      {isLongRunning ? (
        <p className="in-progress-summary__warn">5分以上進行中です。終了登録漏れに注意してください。</p>
      ) : null}
    </div>
  );
}

export function InProgressEmpty() {
  return <p className="in-progress-summary__empty">進行中の記録はありません</p>;
}
