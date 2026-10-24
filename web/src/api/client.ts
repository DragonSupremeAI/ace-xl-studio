import type { DatasetSample, LibraryEntry, LibraryManifest, TaskResult, TrainingStatus } from "../types";

const API = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, init);
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

const post = <T>(path: string, body: unknown) =>
  req<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

export const api = {
  health: () => req<Record<string, unknown>>("/health"),
  stats: () => req<Record<string, unknown>>("/stats"),
  models: () => req<Record<string, unknown>>("/models"),
  formatInput: (payload: { prompt?: string; lyrics?: string; param_obj?: string }) =>
    post("/format_input", payload),

  generate: (params: Record<string, unknown>, refAudio?: File, srcAudio?: File) => {
    const fd = new FormData();
    fd.append("payload", JSON.stringify(params));
    if (refAudio) fd.append("reference_audio", refAudio);
    if (srcAudio) fd.append("src_audio", srcAudio);
    return req<{ data: { task_id: string } }>("/generate", { method: "POST", body: fd });
  },
  queryResult: (taskIds: string[]) =>
    post<{ data: TaskResult[] }>("/query_result", { task_id_list: taskIds }),
  audioUrl: (serverPath: string) => `${API}/audio?path=${encodeURIComponent(serverPath)}`,

  // library
  snapshot: (taskId: string, params?: Record<string, unknown>) =>
    post(`/library/snapshot/${taskId}`, { params: params ?? {} }),
  library: () => req<{ entries: LibraryEntry[] }>("/library/entries"),
  manifest: (taskId: string) => req<LibraryManifest>(`/library/entries/${taskId}/manifest`),
  libraryFileUrl: (taskId: string, f: string) =>
    `${API}/library/entries/${taskId}/files/${encodeURIComponent(f)}`,
  deleteEntry: (taskId: string) =>
    req(`/library/entries/${taskId}`, { method: "DELETE" }),

  // training — datasets
  datasets: () => req<{ datasets: string[] }>("/training/datasets"),
  datasetFiles: (name: string) =>
    req<{ files: { name: string; size: number }[] }>(`/training/datasets/${name}/files`),
  uploadDatasetFiles: (name: string, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return req(`/training/datasets/${name}/files`, { method: "POST", body: fd });
  },
  deleteDatasetFile: (name: string, filename: string) =>
    req(`/training/datasets/${name}/files/${encodeURIComponent(filename)}`, { method: "DELETE" }),
  datasetScan: (payload: {
    audio_dir: string;
    dataset_name?: string;
    custom_tag?: string;
    tag_position?: string;
    all_instrumental?: boolean;
  }) => post("/training/dataset/scan", payload),
  datasetLoad: (dataset_path: string) => post("/training/dataset/load", { dataset_path }),
  datasetSave: (payload: { save_path: string; dataset_name?: string; custom_tag?: string; genre_ratio?: number }) =>
    post("/training/dataset/save", payload),
  datasetSamples: () => req<{ data: DatasetSample[] }>("/training/dataset/samples"),
  updateSample: (idx: number, payload: Partial<DatasetSample>) =>
    req(`/training/dataset/sample/${idx}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  autoLabel: (payload: Record<string, unknown>) => post("/training/dataset/auto_label", payload),
  autoLabelStatus: () => req<Record<string, unknown>>("/training/dataset/auto_label_status"),
  preprocess: (payload: { output_dir: string; skip_existing?: boolean }) =>
    post("/training/dataset/preprocess", payload),
  preprocessStatus: () => req<Record<string, unknown>>("/training/dataset/preprocess_status"),

  // training — runs & adapters
  startTraining: (payload: Record<string, unknown>) => post("/training/start", payload),
  startLokr: (payload: Record<string, unknown>) => post("/training/start_lokr", payload),
  trainingStatus: () => req<TrainingStatus>("/training/status"),
  stopTraining: () => post("/training/stop", {}),
  exportAdapter: (payload: { export_path: string; lora_output_dir: string }) =>
    post("/training/export", payload),
  loraLoad: (lora_path: string) => post("/training/lora/load", { lora_path }),
  loraUnload: () => post("/training/lora/unload", {}),
  loraToggle: (enable: boolean) => post("/training/lora/toggle", { enable }),
  loraScale: (scale: number) => post("/training/lora/scale", { scale }),
  loraStatus: () => req<Record<string, unknown>>("/training/lora/status"),

  // instance
  instanceStatus: () => req<Record<string, unknown>>("/instance/status"),
  balance: () => req<Record<string, unknown>>("/instance/balance"),
};
