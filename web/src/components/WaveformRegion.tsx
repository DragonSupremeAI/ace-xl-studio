import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";

interface Props {
  file: File;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}

/** Interactive waveform with a draggable repaint region.
 *  Drag on the waveform to create/reposition the highlighted range. */
export default function WaveformRegion({ file, start, end, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const regionRef = useRef<{ start: number; end: number } | null>(null);
  const [duration, setDuration] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 110,
      waveColor: "#3d4a63",
      progressColor: "#6ee7b7",
      cursorColor: "#e2e8f0",
      cursorWidth: 1,
      normalize: true,
      minPxPerSec: 20,
    });
    const regions = ws.registerPlugin(RegionsPlugin.create());
    wsRef.current = ws;
    regionsRef.current = regions;

    ws.on("decode", (dur: number) => {
      setDuration(dur);
      regions.clearRegions();
      const r = regions.addRegion({
        start: Math.min(start, dur),
        end: end >= 0 ? Math.min(end, dur) : dur,
        color: "rgba(110, 231, 183, 0.18)",
        drag: true,
        resize: true,
      });
      regionRef.current = r;
      onChange(r.start, r.end);
    });
    regions.enableDragSelection({ color: "rgba(110, 231, 183, 0.18)" });
    const report = (r: { start: number; end: number }) => {
      regionRef.current = r;
      onChange(r.start, r.end);
    };
    regions.on("region-updated", report);
    regions.on("region-created", report);

    ws.loadBlob(file).catch((e: unknown) => setErr(String(e)));

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
  };

  return (
    <div className="wave-region">
      <div ref={containerRef} className="wave-container" />
      {err && <div className="error">{err}</div>}
      <div className="row spread dim small">
        <span>
          repaint range: {fmt(start)} → {end < 0 ? fmt(duration) : fmt(end)}
          {duration ? ` / ${fmt(duration)}` : ""}
        </span>
        <span className="hint-inline">drag on waveform to select · drag edges to resize</span>
      </div>
    </div>
  );
}
