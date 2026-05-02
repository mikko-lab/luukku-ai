"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { AnalysisResult, UpcomingRepair } from "@/types/analysis";
import Image from "next/image";
import CheckoutButton from "@/src/components/CheckoutButton";

type AppState = "idle" | "loading" | "done" | "error";

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
  const scoreColor = score >= 7 ? "#EF4444" : score >= 4 ? "#F59E0B" : "#22C55E";

  return (
    <svg viewBox="0 0 200 115" className="w-full max-w-[220px] mx-auto" aria-hidden="true">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#1E2035" strokeWidth="13" strokeLinecap="butt" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${p4.x.toFixed(1)} ${p4.y.toFixed(1)}`}
        fill="none" stroke="#22C55E" strokeWidth="13" strokeLinecap="butt" />
      <path d={`M ${p4.x.toFixed(1)} ${p4.y.toFixed(1)} A ${r} ${r} 0 0 1 ${p7.x.toFixed(1)} ${p7.y.toFixed(1)}`}
        fill="none" stroke="#F59E0B" strokeWidth="13" strokeLinecap="butt" />
      <path d={`M ${p7.x.toFixed(1)} ${p7.y.toFixed(1)} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#EF4444" strokeWidth="13" strokeLinecap="butt" />
      <line x1={cx} y1={cy} x2={tip.x.toFixed(1)} y2={tip.y.toFixed(1)}
        stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5.5" fill="#1E2035" />
      <circle cx={cx} cy={cy} r="2.5" fill="#00E5CC" />
      <text x={cx} y={cy - 16} textAnchor="middle" fontSize="32" fontWeight="800" fill={scoreColor}>{score}</text>
      <text x={cx} y={cy + 19} textAnchor="middle" fontSize="9" fill="#4B5563">/ 10</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  File upload                                                         */
/* ------------------------------------------------------------------ */

function LoadedFile({ file, label, onRemove }: { file: File; label: string; onRemove: () => void }) {
  const sizeKb = Math.round(file.size / 1024);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#161625] border border-[#00E5CC]/20">
      <div className="w-8 h-8 rounded-lg bg-[#00E5CC]/10 border border-[#00E5CC]/20 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-[#00E5CC]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{file.name}</p>
        <p className="text-[11px] text-[#8888A4]">{sizeKb} KB · {label}</p>
      </div>
      <button onClick={onRemove} className="text-xs text-[#8888A4] hover:text-red-400 transition-colors px-1">Poista</button>
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
      style={dragOver ? { boxShadow: "0 0 24px rgba(0,229,204,0.25), inset 0 0 0 1px #00E5CC" } : undefined}
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all min-h-[140px] group
        ${dragOver
          ? "border-[#00E5CC] bg-[#00E5CC]/5 scale-[1.01]"
          : "border-[#1E2035] bg-[#0A0A14] hover:border-[#00E5CC]/50 hover:bg-[#00E5CC]/5"
        }`}
    >
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-all
        ${dragOver
          ? "bg-[#00E5CC]/20 text-[#00E5CC]"
          : "bg-[#1E2035] text-[#8888A4] group-hover:text-[#00E5CC] group-hover:bg-[#00E5CC]/10"
        }`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-white text-center">
        {label}{optional && <span className="font-normal text-[#8888A4]"> (valinnainen)</span>}
      </p>
      <p className="text-xs text-[#8888A4] mt-1">{hint}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Category risk bars                                                  */
/* ------------------------------------------------------------------ */

function CategoryBar({ label, score, max = 5 }: { label: string; score: number; max?: number }) {
  const frac = Math.min(score / max, 1);
  const color = frac > 0.6 ? "bg-red-500" : frac > 0.3 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[#8888A4] w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-[#1E2035] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(frac * 100, 4)}%` }} />
      </div>
      <span className="text-xs font-semibold text-white w-7 text-right">{score.toFixed(1)}</span>
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
  const levelColor = level === "high" ? "text-emerald-400" : level === "medium" ? "text-amber-400" : "text-red-400";
  const strokeColor = level === "high" ? "#22C55E" : level === "medium" ? "#F59E0B" : "#EF4444";
  const dash = (pct / 100) * 100;
  const checks = [
    { label: "Taloustiedot", ok: !!result.extracted.maintenance_fee_monthly },
    { label: "Remonttihistoria", ok: (result.extracted.last_major_renovations?.length ?? 0) > 0 },
    { label: "Tulevat remontit", ok: result.upcoming_repairs.length > 0 },
    { label: "Rakennustiedot", ok: !!result.extracted.building_year },
  ];
  return (
    <div className="bg-[#0F0F1A] rounded-2xl border border-[#1E2035] p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8888A4] mb-4">Analyysin luotettavuus</h2>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-12 h-12 shrink-0">
          <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1E2035" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={strokeColor}
              strokeWidth="3.5" strokeDasharray={`${dash} ${100 - dash}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{pct}%</span>
          </div>
        </div>
        <div>
          <p className={`text-sm font-semibold ${levelColor}`}>{levelFi}</p>
          <p className="text-[11px] text-[#8888A4]">{(pct / 100).toFixed(2)} / 1.00</p>
        </div>
      </div>
      <div className="space-y-2">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${c.ok ? "bg-emerald-500/20" : "bg-[#1E2035]"}`}>
              {c.ok
                ? <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                : <svg className="w-2 h-2 text-[#8888A4]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>}
            </div>
            <span className={`text-xs ${c.ok ? "text-white" : "text-[#8888A4]"}`}>{c.label}</span>
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
    const text = buildText();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  return (
    <button onClick={copy}
      className="w-full py-2.5 rounded-xl border border-[#1E2035] text-sm text-[#8888A4] hover:text-white hover:border-[#2E2E45] transition-all">
      {copied ? "✓ Kopioitu leikepöydälle" : "Kopioi teksti"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Info panel (idle)                                                   */
/* ------------------------------------------------------------------ */

function InfoPanel() {
  const items = [
    {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
      title: "Riskipisteytys 0–10",
      desc: "Rakennus, remonttihistoria ja taloustiedot yhdistettynä selkeäksi riskiarvioksi.",
    },
    {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      title: "Todellinen kuukausikulu",
      desc: "Vastikkeet + tulevat remontit amortisoidaan rehelliseksi kuukausikuluksi.",
    },
    {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
      title: "Remonttiennuste",
      desc: "AI tunnistaa dokumenteista tulevat ja tehdyt remontit automaattisesti.",
    },
    {
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      title: "Asiantuntijaraportti",
      desc: "Valmis PDF asiakkaalle tai arkistoon — muutamassa sekunnissa.",
    },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => (
          <div key={i} className="bg-[#0F0F1A] rounded-xl border border-[#1E2035] p-4 hover:border-[#00E5CC]/30 transition-colors">
            <div className="text-[#00E5CC] mb-2">{item.icon}</div>
            <p className="text-sm font-semibold text-white mb-1">{item.title}</p>
            <p className="text-xs text-[#8888A4] leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2.5 bg-[#0F0F1A] rounded-xl border border-[#1E2035] px-4 py-3">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <p className="text-xs text-[#8888A4] leading-relaxed">
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
  const [state, setState] = useState<AppState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [brokerLogo, setBrokerLogo] = useState<string | null>(null);
  const [showAllFactors, setShowAllFactors] = useState(false);
  const [analysisTime, setAnalysisTime] = useState<number | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      setShowSuccessBanner(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const knownRepairs = result?.upcoming_repairs.filter((r) => r.type !== "other") ?? [];
  const knownRenovations = result?.extracted.last_major_renovations?.filter((r) => r.type !== "other") ?? [];
  const canAnalyze = !!file1;
  const isDone = state === "done" && !!result;

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

  const verdictColor = !result ? "" :
    result.verdict === "ÄLÄ OSTA" ? "text-red-400" :
    result.verdict === "HARKITSE TARKKAAN" ? "text-amber-400" : "text-emerald-400";

  const verdictDesc = !result ? "" :
    result.verdict === "ÄLÄ OSTA"
      ? "Kohteessa on vakavia riskejä. Harkitse kauppojen hylkäämistä tai lisäselvitystä."
    : result.verdict === "HARKITSE TARKKAAN"
      ? "Kohteessa on merkittäviä riskejä tulevien remonttikulujen suhteen. Neuvottele hinnasta."
      : "Kohde vaikuttaa teknisesti ja taloudellisesti kohtuullisen turvalliselta.";

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
    <div
      className="min-h-screen bg-[#0A0A0F] text-white"
      style={{
        backgroundImage: [
          "radial-gradient(ellipse at 15% 50%, rgba(0,229,204,0.05) 0%, transparent 50%)",
          "radial-gradient(ellipse at 85% 15%, rgba(0,229,204,0.03) 0%, transparent 40%)",
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "100% 100%, 100% 100%, 40px 40px, 40px 40px",
      }}
    >
      {/* Header */}
      <header className="border-b border-[#1E2035] px-8 py-4 flex items-center justify-between sticky top-0 bg-[#0A0A0F]/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#00E5CC]/10 border border-[#00E5CC]/30 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-[#00E5CC]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
          </div>
          <span className="font-black tracking-tight text-sm">
            Luukku<span className="text-[#00E5CC]">-AI</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <p className="text-xs text-[#8888A4]">Live</p>
        </div>
      </header>

      {showSuccessBanner && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-3 text-center">
          <p className="text-sm text-emerald-400 font-medium">
            Maksu onnistui — raportti lähetetään sähköpostiisi pian.
            <button onClick={() => setShowSuccessBanner(false)} className="ml-3 text-emerald-400/60 hover:text-emerald-400 text-xs">✕</button>
          </p>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6">

        {/* Hero */}
        <div className="pt-10 lg:pt-16 pb-8 lg:pb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#00E5CC] mb-4">
            Tekoälypohjainen asuntoanalyysi
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1] mb-5">
            Analysoi asunto.<br />
            <span className="text-[#00E5CC]">Ymmärrä</span> riski.
          </h1>
          <p className="text-[#8888A4] text-lg max-w-xl mx-auto leading-relaxed">
            Lataa isännöitsijäntodistus tai tilinpäätös — AI analysoi riskit, remontit ja todelliset kulut sekunneissa.
          </p>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start pb-16">

          {/* LEFT COLUMN */}
          <div className="space-y-5 min-w-0">

            {/* Upload card */}
            <div className="bg-[#0F0F1A] rounded-2xl border border-[#1E2035] p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-white">Lataa dokumentit</h2>
                {hasFiles && (
                  <span className="text-xs text-[#8888A4]">
                    {[file1, file2].filter(Boolean).length} / 2 tiedostoa
                  </span>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DropZone label="Isännöitsijäntodistus" hint="Vedä PDF tai klikkaa" onFile={setFile1} />
                  <DropZone label="Tilinpäätös" hint="Vedä PDF tai klikkaa" onFile={setFile2} optional />
                </div>
              )}

              {file2 && !file1 && (
                <p className="mt-3 text-xs text-amber-400">Lisää myös isännöitsijäntodistus parempaa analyysiä varten.</p>
              )}

              <div className="mt-6">
                <button
                  onClick={analyze}
                  disabled={!canAnalyze || state === "loading"}
                  aria-busy={state === "loading"}
                  style={canAnalyze && state !== "loading" ? { boxShadow: "0 0 24px rgba(0,229,204,0.30)" } : undefined}
                  className="w-full py-3.5 rounded-xl font-bold text-base transition-all
                    bg-[#00E5CC] text-[#0A0A0F] hover:bg-[#00f5da] active:scale-[0.98]
                    disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  {state === "loading" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analysoidaan…
                    </span>
                  ) : "Avaa analyysi"}
                </button>
              </div>

              {error && (
                <div role="alert" className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  {error}
                </div>
              )}

              {isDone && (
                <div className="mt-4 flex justify-end">
                  <button onClick={downloadReport}
                    className="text-xs font-semibold text-[#00E5CC] hover:underline underline-offset-2">
                    Tulosta raportti (PDF) →
                  </button>
                </div>
              )}
            </div>

            {/* Loading skeleton */}
            {state === "loading" && (
              <div aria-live="polite" aria-label="Analysoidaan" className="space-y-4">
                <div className="h-32 bg-[#0F0F1A] rounded-2xl border border-[#1E2035] animate-pulse" />
                <div className="h-48 bg-[#0F0F1A] rounded-2xl border border-[#1E2035] animate-pulse" />
              </div>
            )}

            {/* Results */}
            {isDone && result && (
              <div ref={resultsRef} tabIndex={-1} className="space-y-5 outline-none">

                {/* Yhteenveto */}
                <div className="bg-[#0F0F1A] rounded-2xl border border-[#1E2035] p-7">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8888A4] mb-5">Yhteenveto</h2>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8888A4] mb-2">Rakennus</p>
                      {([
                        ["Rakennusvuosi", result.extracted.building_year],
                        ["Pinta-ala", result.extracted.apartment_size_m2 ? `${result.extracted.apartment_size_m2} m²` : null],
                        ["Energialuokka", result.extracted.energy_class ?? null],
                        ["Lämmitys", result.extracted.heating_system ?? null],
                      ] as [string, unknown][]).filter(([, v]) => v != null).map(([label, value]) => {
                        const isEnergyClass = label === "Energialuokka";
                        const ec = String(value);
                        const energyColor = isEnergyClass
                          ? (ec === "A" || ec === "B") ? "text-emerald-400"
                          : (ec === "C" || ec === "D") ? "text-white"
                          : ec === "E" ? "text-amber-400"
                          : "text-red-400"
                          : "text-white";
                        return (
                          <div key={label} className="flex justify-between text-sm py-2 border-b border-[#1E2035]">
                            <span className="text-[#8888A4]">{label}</span>
                            <span className={`font-semibold ${energyColor}`}>{ec}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8888A4] mb-2">Talous</p>
                      {([
                        ["Hoitovastike", result.extracted.maintenance_fee_monthly ? `${result.extracted.maintenance_fee_monthly.toLocaleString("fi-FI")} €/kk` : null],
                        ["Rahoitusvastike", result.extracted.financing_fee_monthly ? `${result.extracted.financing_fee_monthly.toLocaleString("fi-FI")} €/kk` : null],
                        ["Laina/osake", result.extracted.loan_per_share ? `${result.extracted.loan_per_share.toLocaleString("fi-FI")} €` : null],
                        ["Yhtiölaina yht.", result.extracted.housing_company_debt_total ? `${result.extracted.housing_company_debt_total.toLocaleString("fi-FI")} €` : null],
                        ["Korjausrahasto", result.extracted.repair_fund ? `${result.extracted.repair_fund.toLocaleString("fi-FI")} €` : null],
                        ["Yhtiön tonttivuokra", result.extracted.ground_rent_monthly ? `${result.extracted.ground_rent_monthly.toLocaleString("fi-FI")} €/kk` : null],
                        ["Tontti", result.extracted.owns_land === true ? "Oma tontti" : result.extracted.owns_land === false ? `Vuokratontti${result.extracted.lease_end_year ? ` (päättyy ${result.extracted.lease_end_year})` : ""}` : null],
                        ["Arvioitu kk-kulu", `${result.monthly_cost.toLocaleString("fi-FI")} €/kk`],
                      ] as [string, unknown][]).filter(([, v]) => v != null).map(([label, value]) => (
                        <div key={label} className="flex justify-between text-sm py-2 border-b border-[#1E2035]">
                          <span className="text-[#8888A4]">{label}</span>
                          <span className={`font-semibold ${label === "Tontti" && result.extracted.owns_land === false ? "text-amber-400" : "text-white"}`}>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Remontit */}
                {(knownRepairs.length > 0 || knownRenovations.length > 0) && (
                  <div className="bg-[#0F0F1A] rounded-2xl border border-[#1E2035] p-7">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8888A4] mb-5">Suunnitellut ja tehdyt remontit</h2>
                    {knownRepairs.length > 0 && (
                      <div className="mb-6">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8888A4] mb-2">Tulevat</p>
                        <table className="w-full">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wide text-[#8888A4] border-b border-[#1E2035]">
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
                                ? "bg-red-500/10 text-red-400"
                                : r.confidence === "medium"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-[#1E2035] text-[#8888A4]";
                              const cost = r.cost_estimate_eur != null
                                ? `n. ${r.cost_estimate_eur.toLocaleString("fi-FI")} €` : "—";
                              return (
                                <tr key={i} className="border-b border-[#1E2035] last:border-0">
                                  <td className="py-3 pr-3 text-sm text-[#8888A4]">{r.planned_year ?? "—"}</td>
                                  <td className="py-3 pr-3 text-sm font-medium text-white">
                                    <div className="flex items-center gap-1.5">
                                      <span>{r.type}</span>
                                      {r.evidence && (
                                        <span title={`Lähde: "${r.evidence}"`}
                                          className="text-[#8888A4] hover:text-white cursor-help text-xs shrink-0" aria-label="Näytä lähde">ⓘ</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 pr-3">
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${confBadge}`}>
                                      {CONFIDENCE_FI[r.confidence] ?? r.confidence}
                                    </span>
                                  </td>
                                  <td className="py-3 pr-3 text-sm text-[#8888A4]">{cost}</td>
                                  <td className="py-3 text-right">
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
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
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8888A4] mb-2">Tehdyt</p>
                        <table className="w-full">
                          <tbody>
                            {knownRenovations.map((r, i) => {
                              const lowConf = r.extraction_confidence !== null && r.extraction_confidence !== undefined && r.extraction_confidence < 0.7;
                              return (
                                <tr key={i} className="border-b border-[#1E2035] last:border-0">
                                  <td className="py-2.5 pr-3 text-sm text-[#8888A4] w-12">{r.year ?? "—"}</td>
                                  <td className="py-2.5 text-sm text-white">
                                    <div className="flex items-center gap-1.5">
                                      <span>{r.type}</span>
                                      {lowConf && (
                                        <span title="AI on epävarma tästä merkinnästä — tarkista alkuperäisestä dokumentista"
                                          className="text-amber-400 cursor-help" aria-label="Epävarma tieto">⚠</span>
                                      )}
                                      {r.evidence && (
                                        <span title={`Lähde: "${r.evidence}"`}
                                          className="text-[#8888A4] hover:text-white cursor-help text-xs" aria-label="Näytä lähde">ⓘ</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 text-right">
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${lowConf ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                                      {lowConf ? "Tarkista" : "Tehty"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                )}

                <button onClick={reset}
                  className="w-full py-2 text-sm text-[#8888A4] hover:text-white transition-colors">
                  ← Analysoi uusi kohde
                </button>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            {isDone && result ? (
              <>
                {/* Score card */}
                <div className="bg-[#0F0F1A] rounded-2xl border border-[#1E2035] p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">Analyysi valmis</span>
                    <span className="text-[10px] text-[#8888A4]">
                      {new Date().toLocaleDateString("fi-FI")}{analysisTime ? ` · ${analysisTime} s` : ""}
                    </span>
                  </div>
                  <RiskGauge score={result.risk_score} />
                  <p className={`text-lg font-black mt-1 text-center tracking-tight ${verdictColor}`}>{result.verdict}</p>
                  <p className="text-xs text-[#8888A4] mt-1.5 text-center leading-relaxed px-1">{verdictDesc}</p>
                  <div className="mt-4 pt-4 border-t border-[#1E2035] flex items-baseline justify-between">
                    <p className="text-xs text-[#8888A4]">Kk-kulu</p>
                    <p className="text-2xl font-black text-white">
                      {result.monthly_cost.toLocaleString("fi-FI")}
                      <span className="text-sm font-normal text-[#8888A4]"> €/kk</span>
                    </p>
                  </div>
                </div>

                {/* Paywall overlay wraps everything below score card */}
                <div className="relative">
                  <div className="blur-[2px] pointer-events-none select-none opacity-60">

                {/* Risk factors */}
                {nonZeroFactors.length > 0 && (
                  <div className="bg-[#0F0F1A] rounded-2xl border border-[#1E2035] p-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8888A4] mb-3">Tärkeimmät riskitekijät</h2>
                    <div className="space-y-2.5">
                      {visibleFactors.map((f, i) => (
                        <div key={i} className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {f.impact > 0
                              ? <svg className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                              : <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                            <div className="min-w-0">
                              <span className="text-sm text-[#C8C8D4] leading-snug">{f.label}</span>
                              {f.reason && (
                                <p className="text-[11px] text-[#8888A4] leading-snug mt-0.5">{f.reason}</p>
                              )}
                            </div>
                          </div>
                          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                            f.impact > 2 ? "bg-red-500/10 text-red-400"
                            : f.impact > 0 ? "bg-amber-500/10 text-amber-400"
                            : "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            {f.impact > 0 ? "+" : ""}{f.impact}
                          </span>
                        </div>
                      ))}
                    </div>
                    {nonZeroFactors.length > 4 && (
                      <button onClick={() => setShowAllFactors(!showAllFactors)}
                        className="mt-3 text-xs text-[#00E5CC] hover:underline">
                        {showAllFactors ? "Näytä vähemmän" : `Näytä kaikki tekijät (${nonZeroFactors.length})`}
                      </button>
                    )}
                  </div>
                )}

                {/* Category risk profile */}
                {categoryRisks.some((c) => c.score > 0) && (
                  <div className="bg-[#0F0F1A] rounded-2xl border border-[#1E2035] p-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8888A4] mb-4">Riskiprofiili kategorioittain</h2>
                    <div className="space-y-3">
                      {categoryRisks.map((c) => <CategoryBar key={c.label} label={c.label} score={c.score} />)}
                    </div>
                  </div>
                )}

                <ConfidenceCard result={result} />

                <button
                  onClick={downloadReport}
                  style={{ boxShadow: "0 0 16px rgba(0,229,204,0.20)" }}
                  className="w-full py-2.5 rounded-xl bg-[#00E5CC] text-[#0A0A0F] font-bold text-sm hover:bg-[#00f5da] transition-colors"
                >
                  Lataa raportti (PDF)
                </button>
                <CopyButton result={result} file2={!!file2} />

                  </div>{/* end blur content */}

                  {/* Paywall overlay */}
                  <div className="absolute bottom-0 left-0 right-0 rounded-b-2xl z-10 px-6 pb-6 pt-16"
                    style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(10,10,15,0.97) 35%)" }}>
                    <CheckoutButton analysisData={result} />
                    <p className="text-[10px] text-[#8888A4] mt-3 text-center">Kertamaksu · Ei tilausta · Stripe-maksu</p>
                  </div>
                </div>{/* end relative paywall wrapper */}
              </>
            ) : (
              <>
                <InfoPanel />
                {/* Sample report — clickable/zoomable */}
                <div
                  className="bg-[#0F0F1A] rounded-2xl border border-[#1E2035] overflow-hidden cursor-zoom-in group transition-all hover:border-[#00E5CC]/40"
                  onClick={() => setShowImageModal(true)}
                >
                  <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#8888A4]">Esimerkkiraportti</p>
                    <span className="text-xs text-[#00E5CC] opacity-0 group-hover:opacity-100 transition-opacity">
                      Suurenna →
                    </span>
                  </div>
                  <div className="relative">
                    <Image
                      src="/raportti-esimerkki.jpg"
                      alt="Esimerkki Luukku-AI-raportista"
                      width={600}
                      height={800}
                      className="w-full h-auto"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F1A]/60 via-transparent to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-[#0A0A0F]/90 border border-[#1E2035] rounded-xl px-4 py-2 text-sm text-white font-semibold backdrop-blur-sm">
                        Klikkaa suurentaaksesi
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1E2035] px-8 py-5 text-center">
        <p className="text-xs text-[#8888A4]">
          <a href="#" className="hover:text-white transition-colors underline underline-offset-2">Tietosuojaseloste</a>
          {" · "}
          <a href="#" className="hover:text-white transition-colors underline underline-offset-2">Käyttöehdot</a>
        </p>
      </footer>

      {/* Image modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-black/92 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setShowImageModal(false)}
        >
          <button
            className="absolute top-5 right-5 text-white/60 hover:text-white text-sm px-3 py-1.5 bg-white/10 rounded-lg transition-colors"
            onClick={() => setShowImageModal(false)}
          >
            Sulje ✕
          </button>
          <Image
            src="/raportti-esimerkki.jpg"
            alt="Esimerkki Luukku-AI-raportista"
            width={900}
            height={1200}
            className="max-h-[90vh] w-auto rounded-xl"
            style={{ boxShadow: "0 0 60px rgba(0,229,204,0.15)" }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
