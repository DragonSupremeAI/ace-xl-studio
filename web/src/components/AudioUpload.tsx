interface Props {
  label: string;
  file: File | null;
  onFile: (f: File | null) => void;
  hint?: string;
}

export default function AudioUpload({ label, file, onFile, hint }: Props) {
  return (
    <div className="upload">
      <label className="field-label">{label}</label>
      <div className="upload-row">
        <input
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.ogg,.opus,.m4a"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <button className="link" onClick={() => onFile(null)}>
            clear
          </button>
        )}
      </div>
      {hint && <div className="hint">{hint}</div>}
      {file && (
        <audio controls src={URL.createObjectURL(file)} className="preview-audio" />
      )}
    </div>
  );
}
