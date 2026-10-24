import type { TrainingStatus } from "../types";

function fmtEta(sec: number): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${Math.round(sec % 60)}s`;
}

/** Tiny inline SVG sparkline for the loss curve. */
function LossSparkline({ history }: { history: number[] }) {
  if (history.length < 2) return null;
  const w = 220;
  const h = 48;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = max - min || 1;
  const pts = history
    .map((v, i) => `${((i / (history.length - 1)) * w).toFixed(1)},${(h - ((v - min) / span) * (h - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#6ee7b7" strokeWidth="1.5" />
    </svg>
  );
}

interface Props {
  status: TrainingStatus | null;
}

export default function TrainingStatusPanel({ status }: Props) {
  if (!status) return null;
  const data = (status.data as TrainingStatus | undefined) ?? status;
  const history = Array.isArray(data.loss_history) ? data.loss_history : [];
  const running = data.is_training === true;

  return (
    <div className="train-status">
      <div className="row spread">
        <span className={running ? "badge running" : "badge"}>{data.status ?? "Idle"}</span>
        {data.current_epoch != null && <span className="dim small">epoch {data.current_epoch}</span>}
        {data.current_step != null && <span className="dim small">step {data.current_step}</span>}
        {data.current_loss != null && <span>loss {Number(data.current_loss).toFixed(4)}</span>}
        {data.steps_per_second ? <span className="dim small">{data.steps_per_second.toFixed(2)} it/s</span> : null}
        {data.estimated_time_remaining ? <span className="dim small">eta {fmtEta(data.estimated_time_remaining)}</span> : null}
      </div>
      <LossSparkline history={history} />
      {data.error && <div className="error">{String(data.error)}</div>}
      {data.tensorboard_url && (
        <a className="link" href={String(data.tensorboard_url)} target="_blank" rel="noreferrer">
          tensorboard ↗
        </a>
      )}
    </div>
  );
}
