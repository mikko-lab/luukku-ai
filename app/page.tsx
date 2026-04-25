"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisResult, UpcomingRepair } from "@/types/analysis";

type AppState = "idle" | "loading" | "done" | "error";
type UserInfo = { id: string; email: string; office_name: string; credits_remaining: number };

const CONFIDENCE_FI: Record<string, string> = {
  high: "varma", medium: "epävarma", low: "alustava",
};

/* ------------------------------------------------------------------ */
/*  Gauge                                                               */
/* ------------------------------------------------------------------ */

function RiskGauge({ score }: { score: number }) {
  const cx = 100, cy = 90, r = 68, rNeedle = 52;

  const arcPt = (s: number) => {
    const a = Math.PI * (1 - s / 10);
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };

  const p4 = arcPt(4);
  const p7 = arcPt(7);
  const a = Math.PI * (1 - Math.min(Math.max(score, 0), 10) / 10);
  const tip = { x: cx + rNeedle * Math.cos(a), y: cy - rNeedle * Math.sin(a) };

  const scoreColor = score >= 7 ? "#DC2626" : score >= 4 ? "#D97706" : "#16A34A";

  return (
    <svg viewBox="0 0 200 98" className="w-full max-w-[220px] mx-auto" aria-hidden="true">
      {/* Background */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#E5E7EB" strokeWidth="13" strokeLinecap="butt" />
      {/* Green 0–4 */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${p4.x.toFixed(1)} ${p4.y.toFixed(1)}`}
        fill="none" stroke="#22C55E" strokeWidth="13" strokeLinecap="butt" />
      {/* Amber 4–7 */}
      <path d={`M ${p4.x.toFixed(1)} ${p4.y.toFixed(1)} A ${r} ${r} 0 0 1 ${p7.x.toFixed(1)} ${p7.y.toFixed(1)}`}
        fill="none" stroke="#F59E0B" strokeWidth="13" strokeLinecap="butt" />
      {/* Red 7–10 */}
      <path d={`M ${p7.x.toFixed(1)} ${p7.y.toFixed(1)} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#EF4444" strokeWidth="13" strokeLinecap="butt" />
      {/* Needle */}
      <line x1={cx} y1={cy} x2={tip.x.toFixed(1)} y2={tip.y.toFixed(1)}
        stroke="#111827" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5.5" fill="#111827" />
      <circle cx={cx} cy={cy} r="2.5" fill="white" />
      {/* Score */}
      <text x={cx} y={cy - 16} textAnchor="middle" fontSize="32" fontWeight="800" fill={scoreColor}>{score}</text>
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize="9" fill="#9CA3AF">/ 10</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                             */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { label: "Uusi analyysi", active: true,
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
  { label: "Analyysit", active: false,
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h16M4 18h16" /> },
  { label: "Kohteet", active: false,
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /> },
  { label: "Raportit", active: false,
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
  { label: "Asetukset", active: false,
    icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></> },
  { label: "Ohjeet", active: false,
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
];

function NavIcon({ d }: { d: React.ReactNode }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      {d}
    </svg>
  );
}

function Sidebar({ user, onLogout }: { user: UserInfo | null; onLogout: () => void }) {
  return (
    <aside className="w-52 shrink-0 bg-[#111827] flex flex-col h-screen sticky top-0">
      <div className="px-5 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-apple-blue flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
          </div>
          <span className="text-white font-black tracking-tight text-sm">
            Luukku<span className="text-apple-blue">-AI</span>
          </span>
        </div>
        {user && <p className="text-xs text-gray-500 mt-2 truncate">{user.office_name}</p>}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5" aria-label="Päänavigaatio">
        {NAV_ITEMS.map((item) => (
          <button key={item.label} disabled={!item.active}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2.5 ${
              item.active ? "bg-white/10 text-white font-medium" : "text-gray-600 cursor-default"
            }`}>
            <NavIcon d={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mx-3 mb-3 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 p-3">
        <p className="text-xs font-semibold text-white">Pro-jäsenyys</p>
        <p className="text-[10px] text-gray-400 mt-0.5">Voimassa 31.12.2025 asti</p>
        <button className="mt-2 w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] text-white font-medium transition-colors">
          Päivitä tilaus
        </button>
      </div>

      {user && (
        <div className="px-4 py-3 border-t border-white/5">
          <p className="text-xs text-gray-400 font-medium truncate">{user.office_name}</p>
          <p className="text-[11px] text-gray-600 truncate">{user.email}</p>
          <button onClick={onLogout} className="mt-1.5 text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
            Kirjaudu ulos
          </button>
        </div>
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  File upload                                                         */
/* ------------------------------------------------------------------ */

function LoadedFile({ file, label, onRemove }: { file: File; label: string; onRemove: () => void }) {
  const sizeKb = Math.round(file.size / 1024);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
      <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
        <p className="text-[11px] text-gray-400">{sizeKb} KB · {label}</p>
      </div>
      <button onClick={onRemove} className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1">Poista</button>
    </div>
  );
}

function DropZone({ label, hint, onFile, optional }: {
  label: string; hint: string; onFile: (f: File) => void; optional?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") onFile(f);
  }, [onFile]);
  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
      role="button" tabIndex={0}
      aria-label={`${label}${optional ? " (valinnainen)" : ""} — ${hint}`}
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all min-h-[96px] group
        ${dragOver ? "border-apple-blue bg-blue-50 scale-[1.01]" : "border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"}`}
    >
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center mb-1.5 group-hover:border-gray-300 transition-colors">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </div>
      <p className="text-xs font-semibold text-gray-700 text-center">
        {label}{optional && <span className="font-normal text-gray-400"> (valinnainen)</span>}
      </p>
      <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Category risk bars                                                  */
/* ------------------------------------------------------------------ */

function CategoryBar({ label, score, max = 5 }: { label: string; score: number; max?: number }) {
  const frac = Math.min(score / max, 1);
  const color = frac > 0.6 ? "bg-red-400" : frac > 0.3 ? "bg-amber-400" : "bg-green-400";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(frac * 100, 4)}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-7 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Confidence card                                                     */
/* ------------------------------------------------------------------ */

function ConfidenceCard({ result }: { result: AnalysisResult }) {
  const pct = result.extracted.confidence_percent ?? Math.round(result.confidence * 100);
  const level = result.extracted.confidence_level ?? (pct >= 75 ? "high" : pct >= 50 ? "medium" : "low");
  const levelFi = level === "high" ? "Korkea luotettavuus" : level === "medium" ? "Kohtalainen luotettavuus" : "Alhainen luotettavuus";
  const levelColor = level === "high" ? "text-green-600" : level === "medium" ? "text-amber-600" : "text-red-600";
  const strokeColor = level === "high" ? "#16A34A" : level === "medium" ? "#D97706" : "#DC2626";
  const dash = (pct / 100) * 100;

  const checks = [
    { label: "Taloustiedot", ok: !!result.extracted.maintenance_fee_monthly },
    { label: "Remonttihistoria", ok: (result.extracted.last_major_renovations?.length ?? 0) > 0 },
    { label: "Tulevat remontit", ok: result.upcoming_repairs.length > 0 },
    { label: "Rakennustiedot", ok: !!result.extracted.building_year },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Analyysin luotettavuus</h2>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-12 h-12 shrink-0">
          <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F3F4F6" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={strokeColor}
              strokeWidth="3.5" strokeDasharray={`${dash} ${100 - dash}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-gray-700">{pct}%</span>
          </div>
        </div>
        <div>
          <p className={`text-sm font-semibold ${levelColor}`}>{levelFi}</p>
          <p className="text-[11px] text-gray-400">{(pct / 100).toFixed(2)} / 1.00</p>
        </div>
      </div>
      <div className="space-y-2">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${c.ok ? "bg-green-100" : "bg-gray-100"}`}>
              {c.ok
                ? <svg className="w-2.5 h-2.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                : <svg className="w-2 h-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>}
            </div>
            <span className={`text-xs ${c.ok ? "text-gray-700" : "text-gray-400"}`}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Copy button                                                         */
/* ------------------------------------------------------------------ */

function CopyButton({ result, file2 }: { result: AnalysisResult; file2: boolean }) {
  const [copied, setCopied] = useState(false);
  function buildText() {
    const e = result.extracted;
    const lines = [
      `Luukku-AI Asuntoanalyysi — ${new Date().toLocaleDateString("fi-FI")}`,
      `Kohde: ${e.building_year ?? "—"} · ${e.apartment_size_m2 ?? "—"} m²`,
      ``,
      `Riskiarvio: ${result.verdict} (${result.risk_score}/10)`,
      `Arvioitu kuukausikulu: ${result.monthly_cost.toLocaleString("fi-FI")} €/kk`,
      `Luotettavuus: ${e.confidence_percent ?? Math.round(result.confidence * 100)}%${file2 ? " · 2 dokumenttia" : ""}`,
    ];
    const known = result.upcoming_repairs.filter((r) => r.type !== "other");
    if (known.length > 0) {
      lines.push(``, `Tulevat remontit:`);
      known.forEach((r) => lines.push(`- ${r.type}${r.planned_year ? ` (${r.planned_year})` : ""} · ${CONFIDENCE_FI[r.confidence] ?? r.confidence}${r.cost_estimate_eur ? ` · n. ${r.cost_estimate_eur.toLocaleString("fi-FI")} €` : ""}`));
    }
    if (result.red_flags.length > 0) {
      lines.push(``, `Huomiot:`);
      result.red_flags.forEach((f) => lines.push(`- ${f}`));
    }
    if (e.maintenance_fee_monthly) lines.push(``, `Hoitovastike: ${e.maintenance_fee_monthly.toLocaleString("fi-FI")} €/kk`);
    if (e.financing_fee_monthly) lines.push(`Rahoitusvastike: ${e.financing_fee_monthly.toLocaleString("fi-FI")} €/kk`);
    if (e.housing_company_debt_total) lines.push(`Yhtiölaina: ${e.housing_company_debt_total.toLocaleString("fi-FI")} €`);
    return lines.join("\n");
  }
  async function copy() {
    try { await navigator.clipboard.writeText(buildText()); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  return (
    <button onClick={copy} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
      {copied ? "✓ Kopioitu leikepöydälle" : "Kopioi teksti"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Info panel (idle)                                                   */
/* ------------------------------------------------------------------ */

function InfoPanel() {
  const items = [
    { n: "1", title: "Riskipisteytys 0–10", desc: "Rakennus, remonttihistoria ja taloustiedot yhdistettynä selkeäksi riskiarvioksi." },
    { n: "2", title: "Todellinen kuukausikulu", desc: "Vastikkeet + tulevat remontit amortisoidaan rehelliseksi kuukausikuluksi." },
    { n: "3", title: "Remonttiennuste", desc: "AI tunnistaa dokumenteista tulevat ja tehdyt remontit automaattisesti." },
    { n: "4", title: "Asiantuntijaraportti", desc: "Valmis PDF asiakkaalle tai arkistoon — muutamassa sekunnissa." },
  ];
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-5">Mitä saat analyysistä</h2>
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.n} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-apple-blue/10 flex items-center justify-center text-[10px] font-bold text-apple-blue shrink-0 mt-0.5">
                {item.n}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-card px-5 py-4 flex items-start gap-3">
        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-2.5 h-2.5 text-green-600" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          </svg>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Dokumentteja ei tallenneta palvelimelle. Analyysi tehdään muistissa ja tiedostot poistetaan välittömästi käsittelyn jälkeen.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                           */
/* ------------------------------------------------------------------ */

export default function Home() {
  const router = useRouter();
  const [state, setState] = useState<AppState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [brokerLogo, setBrokerLogo] = useState<string | null>(null);
  const [showAllFactors, setShowAllFactors] = useState(false);
  const [analysisTime, setAnalysisTime] = useState<number | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number>(0);

  const knownRepairs = result?.upcoming_repairs.filter((r) => r.type !== "other") ?? [];
  const knownRenovations = result?.extracted.last_major_renovations?.filter((r) => r.type !== "other") ?? [];
  const outOfCredits = user !== null && user.credits_remaining <= 0;
  const canAnalyze = !!file1 && !outOfCredits;
  const isDone = state === "done" && !!result;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!data || data.error) { router.push("/login"); return; } setUser(data); })
      .catch(() => router.push("/login"));
  }, [router]);

  function handleLogoUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => setBrokerLogo(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function downloadReport() {
    if (!result) return;
    const address = result.extracted.apartment_size_m2
      ? `${result.extracted.building_year ?? ""} · ${result.extracted.apartment_size_m2} m²` : "Kohde";
    const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ result, address, brokerLogo }) });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "luukku-analyysi.pdf"; a.click();
    URL.revokeObjectURL(url);
  }

  async function analyze() {
    if (!file1) return;
    setState("loading"); setError(null); setShowAllFactors(false);
    startRef.current = Date.now();
    const form = new FormData();
    form.append("file", file1);
    if (file2) form.append("file2", file2);
    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analyysi epäonnistui");
      setResult(data);
      setState("done");
      setAnalysisTime(Math.round((Date.now() - startRef.current) / 100) / 10);
      setUser((u) => u ? { ...u, credits_remaining: u.credits_remaining - 1 } : u);
      setTimeout(() => resultsRef.current?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tuntematon virhe");
      setState("error");
    }
  }

  function reset() {
    setState("idle"); setResult(null); setFile1(null); setFile2(null);
    setError(null); setAnalysisTime(null); setShowAllFactors(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // Verdict helpers
  const verdictColor = !result ? "" :
    result.verdict === "ÄLÄ OSTA" ? "text-red-600" :
    result.verdict === "HARKITSE TARKKAAN" ? "text-amber-600" : "text-green-600";

  const verdictDesc = !result ? "" :
    result.verdict === "ÄLÄ OSTA"
      ? "Kohteessa on vakavia riskejä. Harkitse kauppojen hylkäämistä tai lisäselvitystä."
    : result.verdict === "HARKITSE TARKKAAN"
      ? "Kohteessa on merkittäviä riskejä tulevien remonttikulujen suhteen. Neuvottele hinnasta."
      : "Kohde vaikuttaa teknisesti ja taloudellisesti kohtuullisen turvalliselta.";

  // Category risk profile
  const categoryRisks = !result ? [] : [
    { label: "Putkilinja", kw: ["putki", "linja", "viemäri"] },
    { label: "Julkisivu", kw: ["julkisivu", "katto"] },
    { label: "Talous", kw: ["laina", "vastike", "rahasto"] },
    { label: "Ikä & kunto", kw: ["ikä", "rakennus", "vanha"] },
  ].map(({ label, kw }) => ({
    label,
    score: Math.min(
      result.factors
        .filter((f) => kw.some((k) => f.label.toLowerCase().includes(k) || f.reason.toLowerCase().includes(k)))
        .reduce((s, f) => s + Math.max(0, f.impact), 0),
      5
    ),
  }));

  const nonZeroFactors = result?.factors.filter((f) => f.impact !== 0) ?? [];
  const visibleFactors = showAllFactors ? nonZeroFactors : nonZeroFactors.slice(0, 4);
  const hasFiles = !!(file1 || file2);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F2F2F7]">
      <Sidebar user={user} onLogout={logout} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">Uusi riskianalyysi</h1>
            <p className="text-xs text-gray-400 mt-0.5">Lataa isännöitsijäntodistus ja/tai tilinpäätös ja käynnistä analyysi</p>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span aria-live="polite" aria-atomic="true"
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                  user.credits_remaining === 0 ? "bg-red-50 text-red-600"
                  : user.credits_remaining <= 5 ? "bg-yellow-50 text-yellow-700"
                  : "bg-gray-100 text-gray-500"
                }`}>
                {user.credits_remaining === 0 ? "Ei analyysejä" : `${user.credits_remaining} analyysiä jäljellä`}
              </span>
              <div className="w-8 h-8 rounded-full bg-apple-blue flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">{user.office_name.charAt(0).toUpperCase()}</span>
              </div>
            </div>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8 grid grid-cols-[1fr_300px] gap-6 items-start">

            {/* LEFT COLUMN */}
            <div className="space-y-5 min-w-0">

              {/* Upload card */}
              <div className="bg-white rounded-2xl shadow-card p-7">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-800">Lataa dokumentit</h2>
                  {hasFiles && (
                    <span className="text-xs text-gray-400">Ladatut tiedostot ({[file1, file2].filter(Boolean).length})</span>
                  )}
                </div>

                {hasFiles ? (
                  <div className="space-y-2">
                    {file1
                      ? <LoadedFile file={file1} label="Isännöitsijäntodistus" onRemove={() => setFile1(null)} />
                      : <DropZone label="Isännöitsijäntodistus" hint="Vedä PDF tai klikkaa" onFile={setFile1} />}
                    {file2
                      ? <LoadedFile file={file2} label="Tilinpäätös" onRemove={() => setFile2(null)} />
                      : <DropZone label="Tilinpäätös" hint="Vedä PDF tai klikkaa" onFile={setFile2} optional />}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <DropZone label="Isännöitsijäntodistus" hint="Vedä PDF tai klikkaa" onFile={setFile1} />
                    <DropZone label="Tilinpäätös" hint="Vedä PDF tai klikkaa" onFile={setFile2} optional />
                  </div>
                )}

                {file2 && !file1 && (
                  <p className="mt-3 text-xs text-amber-600">Lisää myös isännöitsijäntodistus parempaa analyysiä varten.</p>
                )}

                <div className="mt-5 flex items-center justify-between gap-4">
                  <div>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                    {brokerLogo ? (
                      <div className="flex items-center gap-2">
                        <img src={brokerLogo} alt="Logo" className="h-5 object-contain" />
                        <button onClick={() => { setBrokerLogo(null); if (logoInputRef.current) logoInputRef.current.value = ""; }}
                          className="text-xs text-gray-400 hover:text-gray-600">Poista</button>
                      </div>
                    ) : (
                      <button onClick={() => logoInputRef.current?.click()}
                        className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
                        + Lisää välittäjän logo PDF-raporttiin
                      </button>
                    )}
                  </div>
                  <button onClick={analyze} disabled={!canAnalyze || state === "loading"} aria-busy={state === "loading"}
                    className="px-6 py-2.5 rounded-xl bg-apple-blue text-white font-semibold text-sm hover:bg-apple-blueh active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    {state === "loading" ? "Analysoidaan…" : "Avaa analyysi"}
                  </button>
                </div>

                {outOfCredits && (
                  <div role="alert" className="mt-4 p-4 rounded-xl bg-yellow-50 text-sm text-yellow-800">
                    <p className="font-semibold">Analyysit käytetty</p>
                    <a href="mailto:mikkotark@protonmail.com?subject=Luukku-AI lisää analyysejä"
                      className="text-xs font-semibold underline mt-1 inline-block">Pyydä lisää käyttöä →</a>
                  </div>
                )}
                {error && (
                  <div role="alert" className="mt-4 p-4 rounded-xl bg-red-50 text-sm text-red-700">
                    {error === "NO_CREDITS" ? "Analyysit käytetty — pyydä lisää käyttöä." : error}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-gray-400">Tulosta kohteen PDF (max 50 MB)</p>
                  {isDone && (
                    <button onClick={downloadReport}
                      className="text-xs font-semibold text-apple-blue hover:underline underline-offset-2">
                      Tulosta raportti
                    </button>
                  )}
                </div>
              </div>

              {/* Loading */}
              {state === "loading" && (
                <div aria-live="polite" aria-label="Analysoidaan" className="space-y-4 animate-pulse">
                  <div className="h-32 bg-white rounded-2xl shadow-card" />
                  <div className="h-48 bg-white rounded-2xl shadow-card" />
                </div>
              )}

              {/* Results */}
              {isDone && result && (
                <div ref={resultsRef} tabIndex={-1} className="space-y-5 outline-none">

                  {/* Yhteenveto */}
                  <div className="bg-white rounded-2xl shadow-card p-7">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-5">Yhteenveto</h2>
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Rakennus</p>
                        {([
                          ["Rakennusvuosi", result.extracted.building_year],
                          ["Pinta-ala", result.extracted.apartment_size_m2 ? `${result.extracted.apartment_size_m2} m²` : null],
                          ["Hoitovastike", result.extracted.maintenance_fee_monthly ? `${result.extracted.maintenance_fee_monthly.toLocaleString("fi-FI")} €/kk` : null],
                          ["Rahoitusvastike", result.extracted.financing_fee_monthly ? `${result.extracted.financing_fee_monthly.toLocaleString("fi-FI")} €/kk` : null],
                        ] as [string, unknown][]).filter(([, v]) => v != null).map(([label, value]) => (
                          <div key={label} className="flex justify-between text-sm py-2 border-b border-gray-50">
                            <span className="text-gray-500">{label}</span>
                            <span className="font-semibold text-gray-800">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Talous</p>
                        {([
                          ["Laina/osake", result.extracted.loan_per_share ? `${result.extracted.loan_per_share.toLocaleString("fi-FI")} €` : null],
                          ["Yhtiölaina yht.", result.extracted.housing_company_debt_total ? `${result.extracted.housing_company_debt_total.toLocaleString("fi-FI")} €` : null],
                          ["Korjausrahasto", result.extracted.repair_fund ? `${result.extracted.repair_fund.toLocaleString("fi-FI")} €` : null],
                          ["Arvioitu kk-kulu", `${result.monthly_cost.toLocaleString("fi-FI")} €/kk`],
                        ] as [string, unknown][]).filter(([, v]) => v != null).map(([label, value]) => (
                          <div key={label} className="flex justify-between text-sm py-2 border-b border-gray-50">
                            <span className="text-gray-500">{label}</span>
                            <span className="font-semibold text-gray-800">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Remontit */}
                  {(knownRepairs.length > 0 || knownRenovations.length > 0) && (
                    <div className="bg-white rounded-2xl shadow-card p-7">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-5">Suunnitellut ja tehdyt remontit</h2>

                      {knownRepairs.length > 0 && (
                        <div className="mb-6">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Tulevat</p>
                          <table className="w-full">
                            <thead>
                              <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                                <th className="text-left pb-2 font-medium w-12">Vuosi</th>
                                <th className="text-left pb-2 font-medium">Remontti / toimenpide</th>
                                <th className="text-left pb-2 font-medium">Tyyppi</th>
                                <th className="text-left pb-2 font-medium">Vaikutus</th>
                                <th className="text-right pb-2 font-medium">Tila</th>
                              </tr>
                            </thead>
                            <tbody>
                              {knownRepairs.map((r, i) => {
                                const confBadge = r.confidence === "high"
                                  ? "bg-red-50 text-red-700" : r.confidence === "medium"
                                  ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500";
                                const cost = r.cost_estimate_eur != null
                                  ? `n. ${r.cost_estimate_eur.toLocaleString("fi-FI")} €` : "—";
                                return (
                                  <tr key={i} className="border-b border-gray-50 last:border-0">
                                    <td className="py-3 pr-3 text-sm text-gray-500">{r.planned_year ?? "—"}</td>
                                    <td className="py-3 pr-3 text-sm font-medium text-gray-800">{r.type}</td>
                                    <td className="py-3 pr-3">
                                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${confBadge}`}>
                                        {CONFIDENCE_FI[r.confidence] ?? r.confidence}
                                      </span>
                                    </td>
                                    <td className="py-3 pr-3 text-sm text-gray-600">{cost}</td>
                                    <td className="py-3 text-right">
                                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                        Suunnitteilla
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {knownRenovations.length > 0 && (
                        <>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Tehdyt</p>
                          <table className="w-full">
                            <tbody>
                              {knownRenovations.map((r, i) => (
                                <tr key={i} className="border-b border-gray-50 last:border-0">
                                  <td className="py-2.5 pr-3 text-sm text-gray-500 w-12">{r.year ?? "—"}</td>
                                  <td className="py-2.5 text-sm text-gray-700">{r.type}</td>
                                  <td className="py-2.5 text-right">
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Tehty</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      )}
                    </div>
                  )}

                  <button onClick={reset}
                    className="w-full py-2 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                    Analysoi uusi kohde
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              {isDone && result ? (
                <>
                  {/* Score card */}
                  <div className="bg-white rounded-2xl shadow-card p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">Analyysi valmis</span>
                      <span className="text-[10px] text-gray-400">
                        {new Date().toLocaleDateString("fi-FI")}{analysisTime ? ` · ${analysisTime} s` : ""}
                      </span>
                    </div>
                    <RiskGauge score={result.risk_score} />
                    <p className={`text-lg font-black mt-1 text-center tracking-tight ${verdictColor}`}>{result.verdict}</p>
                    <p className="text-[11px] text-gray-500 mt-1.5 text-center leading-relaxed px-1">{verdictDesc}</p>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-baseline justify-between">
                      <p className="text-xs text-gray-400">Kk-kulu</p>
                      <p className="text-2xl font-black text-gray-900">
                        {result.monthly_cost.toLocaleString("fi-FI")}
                        <span className="text-sm font-normal text-gray-400"> €/kk</span>
                      </p>
                    </div>
                  </div>

                  {/* Risk factors */}
                  {nonZeroFactors.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-card p-6">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Tärkeimmät riskitekijät</h2>
                      <div className="space-y-2.5">
                        {visibleFactors.map((f, i) => (
                          <div key={i} className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              {f.impact > 0
                                ? <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                : <svg className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                              <span className="text-sm text-gray-700 leading-snug">{f.label}</span>
                            </div>
                            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                              f.impact > 2 ? "bg-red-100 text-red-700"
                              : f.impact > 0 ? "bg-amber-50 text-amber-700"
                              : "bg-green-50 text-green-700"
                            }`}>
                              {f.impact > 0 ? "+" : ""}{f.impact}
                            </span>
                          </div>
                        ))}
                      </div>
                      {nonZeroFactors.length > 4 && (
                        <button onClick={() => setShowAllFactors(!showAllFactors)}
                          className="mt-3 text-xs text-apple-blue hover:underline">
                          {showAllFactors ? "Näytä vähemmän" : `Näytä kaikki tekijät (${nonZeroFactors.length})`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Category risk profile */}
                  {categoryRisks.some((c) => c.score > 0) && (
                    <div className="bg-white rounded-2xl shadow-card p-6">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Riskiprofiili kategorioittain</h2>
                      <div className="space-y-3">
                        {categoryRisks.map((c) => <CategoryBar key={c.label} label={c.label} score={c.score} />)}
                      </div>
                    </div>
                  )}

                  {/* Confidence */}
                  <ConfidenceCard result={result} />

                  <button onClick={downloadReport}
                    className="w-full py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-black transition-colors">
                    Lataa raportti (PDF)
                  </button>
                  <CopyButton result={result} file2={!!file2} />
                </>
              ) : (
                <InfoPanel />
              )}
            </div>

          </div>

          <footer className="px-8 pb-6 text-center">
            <p className="text-xs text-gray-400">
              LUUKKU-AI v1.2.0 ·{" "}
              <a href="#" className="hover:text-gray-600 underline underline-offset-2">Tietosuojaseloste</a>{" "}
              ·{" "}
              <a href="#" className="hover:text-gray-600 underline underline-offset-2">Käyttöehdot</a>{" "}
              {" "}· © 2025 Luukku Oy
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
