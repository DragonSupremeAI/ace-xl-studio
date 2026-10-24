import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { LibraryEntry } from "../types";

export default function LibraryTab() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [err, setErr] = useState("");

  const load = () => api.library().then((r) => setEntries(r.entries)).catch((e) => setErr(String(e)));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="panel">
      <div className="row spread">
        <h3>Generation library</h3>
        <button className="link" onClick={load}>refresh</button>
      </div>
      {err && <div className="error">{err}</div>}
      {entries.length === 0 && <p className="dim">No saved generations yet — use “save to library” on a finished job.</p>}
      {entries.map((e) => (
        <div key={e.task_id} className="lib-entry">
          <div className="row spread">
            <div>
              <div className="lib-prompt">{e.prompt || "(no prompt)"}</div>
              <div className="dim small">
                {new Date(e.saved_at).toLocaleString()}
                {e.bpm ? ` · ${e.bpm}bpm` : ""}
                {e.duration ? ` · ${e.duration}s` : ""}
                {e.seed_value ? ` · seed ${e.seed_value}` : ""}
              </div>
            </div>
            <button className="link" onClick={() => api.deleteEntry(e.task_id).then(load)}>delete</button>
          </div>
          {e.files.map((f) => (
            <div key={f} className="row">
              <audio controls src={api.libraryFileUrl(e.task_id, f)} className="result-audio" />
              <a className="link" href={api.libraryFileUrl(e.task_id, f)} download>
                ↓ {f}
              </a>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
