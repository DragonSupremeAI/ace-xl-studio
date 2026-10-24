import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import AudioUpload from "../components/AudioUpload";
import JobResult from "../components/JobResult";
import { AUDIO_FORMATS, LANGUAGES } from "../types";
import type { ResultRow, TaskStatus } from "../types";

interface Props {
  models: string[];
}

export default function GenerateTab({ models }: Props) {
  const [prompt, setPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [duration, setDuration] = useState(120);
  const [bpm, setBpm] = useState<number | "">("");
  const [keyScale, setKeyScale] = useState("");
  const [timeSig, setTimeSig] = useState("");
  const [language, setLanguage] = useState("en");
  const [instrumental, setInstrumental] = useState(false);
  const [model, setModel] = useState("acestep-v15-xl-turbo");
  const [thinking, setThinking] = useState(true);
  const [useFormat, setUseFormat] = useState(false);
  const [steps, setSteps] = useState(8);
  const [guidance, setGuidance] = useState(7.0);
  const [randomSeed, setRandomSeed] = useState(true);
  const [seed, setSeed] = useState(-1);
  const [batch, setBatch] = useState(1);
  const [format, setFormat] = useState("mp3");
  const [refAudio, setRefAudio] = useState<File | null>(null);

  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pollRef = useRef<number>();

  useEffect(() => () => clearInterval(pollRef.current), []);

  const poll = (id: string) => {
    clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await api.queryResult([id]);
        const t = res.data?.[0];
        if (!t) return;
        setStatus(t.status);
        if (t.result) {
          const parsed = typeof t.result === "string" ? JSON.parse(t.result) : t.result;
          setRows(parsed);
        }
        if (t.status !== 0) clearInterval(pollRef.current);
      } catch {
        /* keep polling */
      }
    }, 1500);
  };

  const enhance = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await api.formatInput({ prompt, lyrics });
      const d = (res as Record<string, { prompt?: string; lyrics?: string }>)?.data ?? {};
      if (d.prompt) setPrompt(d.prompt);
      if (d.lyrics) setLyrics(d.lyrics);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setErr("");
    setRows([]);
    setStatus(null);
    try {
      const params: Record<string, unknown> = {
        prompt,
        lyrics: instrumental ? "" : lyrics,
        task_type: "text2music",
        thinking,
        use_format: useFormat,
        vocal_language: language,
        model,
        audio_duration: duration,
        inference_steps: steps,
        guidance_scale: guidance,
        use_random_seed: randomSeed,
        seed,
        batch_size: batch,
        audio_format: format,
      };
      if (bpm !== "") params.bpm = bpm;
      if (keyScale) params.key_scale = keyScale;
      if (timeSig) params.time_signature = timeSig;
      const res = await api.generate(params, refAudio ?? undefined);
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
        <label className="field-label">Caption / style prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. aggressive trap beat, dark 808s, male rap vocal"
          rows={3}
        />

        <label className="field-label">
          Lyrics <span className="hint-inline">[Verse]/[Chorus] tags supported</span>
        </label>
        <textarea
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder="[Verse 1]&#10;…&#10;[Chorus]&#10;…"
          rows={9}
          disabled={instrumental}
        />
        <div className="row">
          <label className="check">
            <input
              type="checkbox"
              checked={instrumental}
              onChange={(e) => setInstrumental(e.target.checked)}
            />
            instrumental
          </label>
          <label className="check">
            <input type="checkbox" checked={useFormat} onChange={(e) => setUseFormat(e.target.checked)} />
            LM format
          </label>
          <label className="check">
            <input type="checkbox" checked={thinking} onChange={(e) => setThinking(e.target.checked)} />
            thinking (LM plan)
          </label>
          <button className="link" onClick={enhance} disabled={busy}>
            enhance w/ LM ↗
          </button>
        </div>

        <AudioUpload
          label="Reference audio (style / timbre)"
          file={refAudio}
          onFile={setRefAudio}
          hint="Optional. ~30s clean/dry clip works best for voice timbre."
        />
      </section>

      <section className="panel">
        <div className="field-grid">
          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {(models.length ? models : ["acestep-v15-xl-turbo", "acestep-v15-xl-sft", "acestep-v15-xl-base"]).map(
                (m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                )
              )}
            </select>
          </label>
          <label>
            Language
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Duration (s)
            <input type="number" min={10} max={600} value={duration} onChange={(e) => setDuration(+e.target.value)} />
          </label>
          <label>
            BPM
            <input type="number" value={bpm} placeholder="auto" onChange={(e) => setBpm(e.target.value === "" ? "" : +e.target.value)} />
          </label>
          <label>
            Key
            <input value={keyScale} placeholder="auto" onChange={(e) => setKeyScale(e.target.value)} />
          </label>
          <label>
            Time sig
            <input value={timeSig} placeholder="4/4" onChange={(e) => setTimeSig(e.target.value)} />
          </label>
          <label>
            Steps
            <input type="number" min={1} max={100} value={steps} onChange={(e) => setSteps(+e.target.value)} />
          </label>
          <label>
            Guidance
            <input type="number" step={0.1} value={guidance} onChange={(e) => setGuidance(+e.target.value)} />
          </label>
          <label>
            Batch (≤8)
            <input type="number" min={1} max={8} value={batch} onChange={(e) => setBatch(+e.target.value)} />
          </label>
          <label>
            Format
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {AUDIO_FORMATS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="row">
          <label className="check">
            <input type="checkbox" checked={randomSeed} onChange={(e) => setRandomSeed(e.target.checked)} />
            random seed
          </label>
          <input
            type="number"
            className="seed-input"
            value={seed}
            disabled={randomSeed}
            onChange={(e) => setSeed(+e.target.value)}
            placeholder="seed"
          />
        </div>

        <button className="primary" onClick={submit} disabled={busy || !prompt}>
          {busy ? "submitting…" : "Generate"}
        </button>
        {err && <div className="error">{err}</div>}
        {taskId && (
          <JobResult
            taskId={taskId}
            status={status}
            rows={rows}
            onSnapshot={() => api.snapshot(taskId).then(() => alert("saved to library"))}
          />
        )}
      </section>
    </div>
  );
}
