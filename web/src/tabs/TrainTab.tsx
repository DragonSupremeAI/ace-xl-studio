import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import TrainingStatusPanel from "../components/TrainingStatus";
import type { DatasetSample, TrainingStatus } from "../types";

type Stage = "dataset" | "train" | "adapters";

export default function TrainTab() {
  const [stage, setStage] = useState<Stage>("dataset");

  // dataset builder
  const [dsName, setDsName] = useState("my_dataset");
  const [customTag, setCustomTag] = useState("");
  const [tagPos, setTagPos] = useState("prepend");
  const [allInstrumental, setAllInstrumental] = useState(false);
  const [serverDir, setServerDir] = useState("");
  const [samples, setSamples] = useState<DatasetSample[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<DatasetSample>>({});
  const [savePath, setSavePath] = useState("");
  const [msg, setMsg] = useState("");

  // preprocessing
  const [tensorDir, setTensorDir] = useState("");
  const [prepStatus, setPrepStatus] = useState<{ status?: string; progress?: string } | null>(null);

  // training
  const [adapterType, setAdapterType] = useState<"lora" | "lokr">("lora");
  const [lr, setLr] = useState(1e-4);
  const [epochs, setEpochs] = useState(500);
  const [rank, setRank] = useState(64);
  const [alpha, setAlpha] = useState(128);
  const [batchSize, setBatchSize] = useState(1);
  const [gradAccum, setGradAccum] = useState(4);
  const [saveEvery, setSaveEvery] = useState(5);
  const [shift, setShift] = useState(3.0);
  const [seed, setSeed] = useState(42);
  const [outDir, setOutDir] = useState("./lora_output");
  const [trainStatus, setTrainStatus] = useState<TrainingStatus | null>(null);

  // adapters
  const [loraPath, setLoraPath] = useState("");
  const [loraScale, setLoraScale] = useState(1.0);
  const [loraStatus, setLoraStatus] = useState<Record<string, unknown> | null>(null);

  const pollRef = useRef<number>();
  useEffect(() => () => clearInterval(pollRef.current), []);

  const note = (m: string) => setMsg(m);

  const refreshSamples = async () => {
    const res = await api.datasetSamples();
    setSamples(res.data ?? []);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    await api.uploadDatasetFiles(dsName, Array.from(files));
    note(`uploaded ${files.length} file(s) to dataset "${dsName}"`);
  };

  const scan = async () => {
    const dir = serverDir || `/workspace/datasets/${dsName}`;
    await api.datasetScan({
      audio_dir: dir,
      dataset_name: dsName,
      custom_tag: customTag,
      tag_position: tagPos,
      all_instrumental: allInstrumental,
    });
    await refreshSamples();
    note(`scanned ${dir}`);
  };

  const saveSample = async () => {
    if (editIdx === null) return;
    await api.updateSample(editIdx, editDraft);
    setEditIdx(null);
    await refreshSamples();
  };

  const autoLabel = async () => {
    await api.autoLabel({ only_unlabeled: true, skip_metas: false });
    note("auto-label started — polling…");
    clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      const s = await api.autoLabelStatus();
      note(`auto-label: ${JSON.stringify(s).slice(0, 140)}`);
      if ((s as Record<string, { status?: string }>)?.data?.status !== "running") {
        clearInterval(pollRef.current);
        refreshSamples();
      }
    }, 2000);
  };

  const preprocess = async () => {
    await api.preprocess({ output_dir: tensorDir });
    note("preprocess started — polling…");
    clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      const s = await api.preprocessStatus();
      const task = (s as Record<string, { status?: string; progress?: string }>)?.data ?? s;
      setPrepStatus(task);
      if (task?.status !== "running") {
        clearInterval(pollRef.current);
      }
    }, 2000);
  };

  const startTraining = async () => {
    const base = {
      tensor_dir: tensorDir,
      learning_rate: lr,
      train_epochs: epochs,
      train_batch_size: batchSize,
      gradient_accumulation: gradAccum,
      save_every_n_epochs: saveEvery,
      training_shift: shift,
      training_seed: seed,
    };
    if (adapterType === "lora") {
      await api.startTraining({ ...base, lora_rank: rank, lora_alpha: alpha, lora_output_dir: outDir });
    } else {
      await api.startLokr({ ...base, output_dir: outDir, lokr_linear_dim: rank, lokr_linear_alpha: alpha });
    }
    clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      setTrainStatus(await api.trainingStatus());
    }, 3000);
  };

  const loadAdapter = async () => {
    await api.loraLoad(loraPath);
    setLoraStatus(await api.loraStatus());
  };

  return (
    <div>
      <div className="subtabs">
        {(["dataset", "train", "adapters"] as Stage[]).map((s) => (
          <button key={s} className={stage === s ? "subtab active" : "subtab"} onClick={() => setStage(s)}>
            {s}
          </button>
        ))}
      </div>
      {msg && <div className="notice">{msg}</div>}

      {stage === "dataset" && (
        <div className="panel">
          <h3>1 · Dataset</h3>
          <div className="field-grid">
            <label>
              Dataset name
              <input value={dsName} onChange={(e) => setDsName(e.target.value)} />
            </label>
            <label>
              Trigger tag
              <input value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="e.g. myvoice" />
            </label>
            <label>
              Tag position
              <select value={tagPos} onChange={(e) => setTagPos(e.target.value)}>
                <option>prepend</option>
                <option>append</option>
                <option>replace</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={allInstrumental} onChange={(e) => setAllInstrumental(e.target.checked)} />
              all instrumental
            </label>
          </div>
          <div className="row">
            <input type="file" multiple accept="audio/*,.txt,.json,.csv" onChange={(e) => upload(e.target.files)} />
            <button onClick={scan}>scan on server</button>
            <button className="link" onClick={autoLabel}>auto-label (LM)</button>
          </div>
          <div className="row dim small">
            server dir: <code>{serverDir || `/workspace/datasets/${dsName}`}</code>
            <input
              className="grow"
              value={serverDir}
              onChange={(e) => setServerDir(e.target.value)}
              placeholder="override server-side audio dir (optional)"
            />
          </div>

          {samples.length > 0 && (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>file</th>
                    <th>dur</th>
                    <th>bpm</th>
                    <th>key</th>
                    <th>caption</th>
                    <th>labeled</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {samples.map((s) => (
                    <tr key={s.index}>
                      <td className="mono">{s.filename}</td>
                      <td>{s.duration?.toFixed(0)}s</td>
                      <td>{s.bpm ?? "—"}</td>
                      <td>{s.keyscale || "—"}</td>
                      <td className="truncate">{s.caption || "—"}</td>
                      <td>{s.labeled ? "✓" : "✗"}</td>
                      <td>
                        <button
                          className="link"
                          onClick={() => {
                            setEditIdx(s.index);
                            setEditDraft(s);
                          }}
                        >
                          edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row">
                <input
                  className="grow"
                  value={savePath}
                  onChange={(e) => setSavePath(e.target.value)}
                  placeholder="/workspace/datasets/my_dataset.json"
                />
                <button
                  onClick={() =>
                    api
                      .datasetSave({ save_path: savePath, dataset_name: dsName, custom_tag: customTag })
                      .then(() => note(`dataset saved → ${savePath}`))
                  }
                >
                  save dataset JSON
                </button>
              </div>
            </>
          )}

          {editIdx !== null && (
            <div className="edit-card">
              <h4>Sample #{editIdx}</h4>
              <label className="field-label">caption</label>
              <input className="grow" value={editDraft.caption ?? ""} onChange={(e) => setEditDraft({ ...editDraft, caption: e.target.value })} />
              <label className="field-label">lyrics</label>
              <textarea rows={5} value={editDraft.lyrics ?? ""} onChange={(e) => setEditDraft({ ...editDraft, lyrics: e.target.value })} />
              <div className="row">
                <input type="number" placeholder="bpm" value={editDraft.bpm ?? ""} onChange={(e) => setEditDraft({ ...editDraft, bpm: +e.target.value })} />
                <input placeholder="key" value={editDraft.keyscale ?? ""} onChange={(e) => setEditDraft({ ...editDraft, keyscale: e.target.value })} />
                <input placeholder="time sig" value={editDraft.timesignature ?? ""} onChange={(e) => setEditDraft({ ...editDraft, timesignature: e.target.value })} />
                <input placeholder="lang" value={editDraft.language ?? ""} onChange={(e) => setEditDraft({ ...editDraft, language: e.target.value })} />
                <button onClick={saveSample}>save</button>
              </div>
            </div>
          )}

          <h3>2 · Preprocess → tensors</h3>
          <div className="row">
            <input
              className="grow"
              value={tensorDir}
              onChange={(e) => setTensorDir(e.target.value)}
              placeholder="/workspace/datasets/my_dataset_tensors"
            />
            <button onClick={preprocess} disabled={!tensorDir}>
              preprocess
            </button>
          </div>
          {prepStatus && (
            <div className="train-status">
              <span className={prepStatus.status === "running" ? "badge running" : "badge"}>
                {prepStatus.status ?? "—"}
              </span>
              {prepStatus.progress && <div className="dim small">{prepStatus.progress}</div>}
            </div>
          )}
        </div>
      )}

      {stage === "train" && (
        <div className="panel">
          <div className="row">
            <label className="check">
              <input type="radio" checked={adapterType === "lora"} onChange={() => setAdapterType("lora")} />
              LoRA (PEFT · stable)
            </label>
            <label className="check">
              <input type="radio" checked={adapterType === "lokr"} onChange={() => { setAdapterType("lokr"); setLr(0.03); }} />
              LoKr (~10× faster · experimental)
            </label>
          </div>
          <div className="field-grid">
            <label>tensor dir<input value={tensorDir} onChange={(e) => setTensorDir(e.target.value)} /></label>
            <label>output dir<input value={outDir} onChange={(e) => setOutDir(e.target.value)} /></label>
            <label>learning rate<input type="number" step="0.0001" value={lr} onChange={(e) => setLr(+e.target.value)} /></label>
            <label>epochs<input type="number" value={epochs} onChange={(e) => setEpochs(+e.target.value)} /></label>
            <label>{adapterType === "lora" ? "rank" : "linear dim"}<input type="number" value={rank} onChange={(e) => setRank(+e.target.value)} /></label>
            <label>alpha<input type="number" value={alpha} onChange={(e) => setAlpha(+e.target.value)} /></label>
            <label>batch<input type="number" value={batchSize} onChange={(e) => setBatchSize(+e.target.value)} /></label>
            <label>grad accum<input type="number" value={gradAccum} onChange={(e) => setGradAccum(+e.target.value)} /></label>
            <label>save every<input type="number" value={saveEvery} onChange={(e) => setSaveEvery(+e.target.value)} /></label>
            <label>shift<input type="number" step={0.1} value={shift} onChange={(e) => setShift(+e.target.value)} /></label>
            <label>seed<input type="number" value={seed} onChange={(e) => setSeed(+e.target.value)} /></label>
          </div>
          <div className="row">
            <button className="primary" onClick={startTraining} disabled={!tensorDir}>
              start {adapterType} training
            </button>
            <button onClick={() => api.stopTraining()}>stop</button>
            <button className="link" onClick={async () => setTrainStatus(await api.trainingStatus())}>
              refresh status
            </button>
          </div>
          <TrainingStatusPanel status={trainStatus} />
        </div>
      )}

      {stage === "adapters" && (
        <div className="panel">
          <h3>Load adapter for generation</h3>
          <div className="row">
            <input
              className="grow"
              value={loraPath}
              onChange={(e) => setLoraPath(e.target.value)}
              placeholder="/workspace/ACE-Step-1.5/lora_output/final  (LoRA dir or LoKr .safetensors)"
            />
            <button onClick={loadAdapter}>load</button>
            <button onClick={() => api.loraUnload()}>unload</button>
          </div>
          <label>
            lora scale ({loraScale})
            <input type="range" min={0} max={2} step={0.05} value={loraScale} onChange={(e) => setLoraScale(+e.target.value)} />
          </label>
          <button onClick={() => api.loraScale(loraScale)}>apply scale</button>
          <button className="link" onClick={async () => setLoraStatus(await api.loraStatus())}>status</button>
          {loraStatus && <code className="block">{JSON.stringify(loraStatus, null, 1).slice(0, 500)}</code>}
          <p className="hint">
            Note: adapter loading requires quantization disabled on the server. LoKr loads via a
            .safetensors file path; LoRA loads via the adapter directory containing adapter_config.json.
          </p>
        </div>
      )}
    </div>
  );
}
