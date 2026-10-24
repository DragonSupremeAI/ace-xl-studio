import { useEffect, useState } from "react";
import { api } from "./api/client";
import SettingsBar from "./components/SettingsBar";
import GenerateTab from "./tabs/GenerateTab";
import EditTab from "./tabs/EditTab";
import TrainTab from "./tabs/TrainTab";
import LibraryTab from "./tabs/LibraryTab";

type Tab = "generate" | "edit" | "train" | "library";

const TABS: { id: Tab; label: string }[] = [
  { id: "generate", label: "Generate" },
  { id: "edit", label: "Edit Audio" },
  { id: "train", label: "Train LoRA" },
  { id: "library", label: "Library" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("generate");
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [preset, setPreset] = useState<{ params: Record<string, unknown>; nonce: number }>();

  const loadIntoGenerate = (params: Record<string, unknown>) => {
    setPreset({ params, nonce: Date.now() });
    setTab("generate");
  };

  useEffect(() => {
    api
      .health()
      .then(() => setServerOk(true))
      .catch(() => setServerOk(false));
    api
      .models()
      .then((m) => {
        const list = (m?.data ?? m ?? []) as { name?: string; id?: string }[];
        if (Array.isArray(list)) setModels(list.map((x) => x.name ?? x.id ?? "").filter(Boolean));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◈</span> ACE XL Studio
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className={serverOk === null ? "conn" : serverOk ? "conn ok" : "conn bad"}>
          {serverOk === null ? "connecting…" : serverOk ? "API online" : "API offline"}
        </div>
      </header>

      <SettingsBar />

      <main>
        {tab === "generate" && <GenerateTab models={models} preset={preset} />}
        {tab === "edit" && <EditTab models={models} />}
        {tab === "train" && <TrainTab />}
        {tab === "library" && <LibraryTab onLoadSettings={loadIntoGenerate} />}
      </main>
    </div>
  );
}
