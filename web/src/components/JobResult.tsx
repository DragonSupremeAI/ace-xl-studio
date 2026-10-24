import { api } from "../api/client";
import type { ResultRow, TaskStatus } from "../types";

interface Props {
  taskId: string;
  status: TaskStatus | null;
  rows: ResultRow[];
  onSnapshot: () => void;
}

export default function JobResult({ taskId, status, rows, onSnapshot }: Props) {
  if (status === null) return null;
  return (
    <div className="job-result">
      <div className="row spread">
        <span className={`status s${status}`}>
          {status === 0 ? "running…" : status === 1 ? "done" : "failed"}
        </span>
        <span className="dim mono">{taskId.slice(0, 8)}</span>
        {status === 1 && (
          <button className="link" onClick={onSnapshot}>
            save to library ↓
          </button>
        )}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="result-item">
          {r.file && (
            <audio
              controls
              src={api.audioUrl(decodeURIComponent(r.file.split("path=")[1] ?? r.file))}
              className="result-audio"
            />
          )}
          <div className="dim small">
            {r.metas?.bpm ? `${r.metas.bpm} bpm · ` : ""}
            {r.metas?.keyscale ? `${r.metas.keyscale} · ` : ""}
            {r.seed_value ? `seed ${r.seed_value}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
