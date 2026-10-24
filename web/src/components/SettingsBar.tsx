import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function SettingsBar() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [balance, setBalance] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  const checkBalance = () => {
    api.balance().then(setBalance).catch(() => setBalance({ error: "vastai CLI unavailable" }));
  };

  return (
    <div className="settingsbar">
      <button className="link" onClick={() => setOpen(!open)}>
        {open ? "▾" : "▸"} Server & instance
      </button>
      {stats?.data ? (
        <span className="dim">
          queue: {String((stats.data as Record<string, unknown>).queue_size ?? "—")} · avg job:{" "}
          {String((stats.data as Record<string, unknown>).avg_job_seconds ?? "—")}s
        </span>
      ) : null}
      {open && (
        <div className="settings-panel">
          <div className="row">
            <span className="dim">Server stats:</span>
            <code>{JSON.stringify(stats, null, 0).slice(0, 400)}</code>
          </div>
          <div className="row">
            <button onClick={checkBalance}>Check vast.ai balance</button>
            <code>{balance ? JSON.stringify(balance).slice(0, 300) : "—"}</code>
          </div>
        </div>
      )}
    </div>
  );
}
