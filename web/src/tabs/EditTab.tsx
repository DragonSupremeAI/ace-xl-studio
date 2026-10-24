import { useRef, useState } from "react";
import { api } from "../api/client";
import AudioUpload from "../components/AudioUpload";
import JobResult from "../components/JobResult";
import { TASK_TYPES } from "../types";
import type { ResultRow, TaskStatus, TaskType } from "../types";

interface Props {
  models: string[];
}

export default function EditTab({ models }: Props) {
  const [taskType, setTaskType] = useState<TaskType>("cover");
  const [srcAudio, setSrcAudio] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [repaintStart, setRepaintStart] = useState(0);
  const [repaintEnd, setRepaintEnd] = useState<number>(-1);
  const [coverStrength, setCoverStrength] = useState(0.95);
  const [model, setModel] = useState("acestep-v15-xl-sft");
  const [duration, setDuration] = useState<number | null>(null);

  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pollRef = useRef<number>();

  const taskMeta = TASK_TYPES.find((t) => t.value === taskType)!;

  const pick = (t: TaskType) => {
    setTaskType(t);
    setModel(TASK_TYPES.find((x) => x.value === t)?.model ?? model);
  };

  const poll = (id: string) => {
    clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await api.queryResult([id]);
        const t = res.data?.[0];
        if (!t) return;
        setStatus(t.status);
        if (t.result) setRows(typeof t.result === "string" ? JSON.parse(t.result) : t.result);
        if (t.status !== 0) clearInterval(pollRef.current);
      } catch {
        /* keep polling */
      }
    }, 1500);
  };

  const submit = async () => {
    if (!srcAudio) return;
    setBusy(true);
    setErr("");
    setRows([]);
    setStatus(null);
    try {
      const params: Record<string, unknown> = {
        prompt,
        lyrics,
        task_type: taskType,
        model,
        audio_cover_strength: coverStrength,
      };
      if (duration) params.audio_duration = duration;
      if (taskType === "repaint") {
        params.repainting_start = repaintStart;
        params.repainting_end = repaintEnd;
      }
      const res = await api.generate(params, undefined, srcAudio);
      const id = res.data.task_id;
      setTaskId(id);
      setStatus(0);
      poll(id);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid-2">
      <section className="panel">
        <div className="task-picker">
          {TASK_TYPES.filter((t) => t.needsSrc).map((t) => (
            <button
              key={t.value}
              className={taskType === t.value ? "task-btn active" : "task-btn"}
              onClick={() => pick(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AudioUpload
          label={`Source audio (${taskMeta.label.toLowerCase()})`}
          file={srcAudio}
          onFile={setSrcAudio}
          hint={
            taskType === "cover"
              ? "Remix: keep the same lyrics; strength 0.92–0.99 keeps wording faithful, ~0.2 for style transfer."
              : taskType === "repaint"
                ? "Pick the time range to regenerate."
                : taskType === "extract"
                  ? "Extract stems from this file (base model)."
                  : "Upload the source track."
          }
        />

        {taskType === "repaint" && (
          <div className="row">
            <label>
              start (s)
              <input type="number" min={0} step={0.1} value={repaintStart} onChange={(e) => setRepaintStart(+e.target.value)} />
            </label>
            <label>
              end (s, -1 = end)
              <input type="number" step={0.1} value={repaintEnd} onChange={(e) => setRepaintEnd(+e.target.value)} />
            </label>
          </div>
        )}

        {taskType === "cover" && (
          <label>
            cover strength ({coverStrength})
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={coverStrength}
              onChange={(e) => setCoverStrength(+e.target.value)}
            />
          </label>
        )}

        <label className="field-label">Caption</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="style for the regenerated audio" />
        <label className="field-label">Lyrics (same as source for remix)</label>
        <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={7} />
      </section>

      <section className="panel">
        <div className="field-grid">
          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {(models.length ? models : ["acestep-v15-xl-turbo", "acestep-v15-xl-sft", "acestep-v15-xl-base"]).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Duration (s, blank = source length)
            <input
              type="number"
              value={duration ?? ""}
              onChange={(e) => setDuration(e.target.value === "" ? null : +e.target.value)}
            />
          </label>
        </div>
        <button className="primary" onClick={submit} disabled={busy || !srcAudio}>
          {busy ? "submitting…" : `Run ${taskMeta.label}`}
        </button>
        {err && <div className="error">{err}</div>}
        {taskId && (
          <JobResult taskId={taskId} status={status} rows={rows} onSnapshot={() => api.snapshot(taskId).then(() => alert("saved"))} />
        )}
      </section>
    </div>
  );
}
