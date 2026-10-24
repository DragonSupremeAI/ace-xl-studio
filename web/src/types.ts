export type TaskStatus = 0 | 1 | 2; // queued/running | succeeded | failed

export type TaskType =
  | "text2music"
  | "cover"
  | "repaint"
  | "lego"
  | "extract"
  | "complete";

export interface GenerateParams {
  prompt: string;
  lyrics: string;
  task_type: TaskType;
  model?: string;
  thinking: boolean;
  use_format: boolean;
  vocal_language: string;
  audio_duration?: number;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  inference_steps: number;
  guidance_scale: number;
  use_random_seed: boolean;
  seed: number;
  batch_size: number;
  audio_format: string;
  repainting_start?: number;
  repainting_end?: number;
  audio_cover_strength?: number;
  instrumental?: boolean;
}

export interface ResultRow {
  file?: string;
  local_file?: string;
  status: TaskStatus;
  prompt?: string;
  lyrics?: string;
  seed_value?: string;
  metas?: {
    bpm?: number;
    duration?: number;
    genres?: string;
    keyscale?: string;
    timesignature?: string;
    prompt?: string;
    lyrics?: string;
  };
  generation_info?: string;
  lm_model?: string;
  dit_model?: string;
}

export interface TaskResult {
  task_id: string;
  status: TaskStatus;
  result?: ResultRow[] | string;
}

export interface LibraryEntry {
  task_id: string;
  saved_at: string;
  prompt: string;
  lyrics_preview: string;
  duration?: number;
  bpm?: number;
  seed_value?: string;
  files: string[];
}

export interface LibraryManifest {
  task_id: string;
  saved_at: string;
  params?: Record<string, unknown>;
  row: { status: number; result: string };
  files: string[];
}

export interface TrainingStatus {
  is_training?: boolean;
  should_stop?: boolean;
  current_step?: number;
  current_epoch?: number;
  current_loss?: number | null;
  loss_history?: number[];
  status?: string;
  steps_per_second?: number;
  estimated_time_remaining?: number;
  error?: string | null;
  tensorboard_url?: string | null;
  training_log?: string;
  [key: string]: unknown;
}

export interface DatasetSample {
  index: number;
  filename: string;
  audio_path: string;
  duration?: number;
  caption: string;
  genre: string;
  lyrics: string;
  bpm?: number;
  keyscale: string;
  timesignature: string;
  language: string;
  is_instrumental: boolean;
  labeled: boolean;
}

export const TASK_TYPES: { value: TaskType; label: string; needsSrc: boolean; model: string }[] = [
  { value: "text2music", label: "Generate", needsSrc: false, model: "acestep-v15-xl-turbo" },
  { value: "cover", label: "Remix / Cover", needsSrc: true, model: "acestep-v15-xl-sft" },
  { value: "repaint", label: "Repaint section", needsSrc: true, model: "acestep-v15-xl-sft" },
  { value: "lego", label: "Add stem (lego)", needsSrc: true, model: "acestep-v15-xl-base" },
  { value: "extract", label: "Extract stems", needsSrc: true, model: "acestep-v15-xl-base" },
  { value: "complete", label: "Complete", needsSrc: true, model: "acestep-v15-xl-base" },
];

export const LANGUAGES = [
  "en", "zh", "ja", "ko", "es", "fr", "de", "pt", "ru", "it", "hi", "instrumental",
];

export const AUDIO_FORMATS = ["mp3", "wav", "flac", "wav32", "opus", "aac"];
