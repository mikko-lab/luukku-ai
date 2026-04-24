"use client";

import { useState, useRef, useCallback } from "react";
import type { AnalysisResult, UpcomingRepair } from "@/types/analysis";

type AppState = "idle" | "loading" | "done" | "error";

const CONFIDENCE_FI: Record<string, string> = {
  high: "varma",
  medium: "epävarma",
  low: "alustava",
};

function VerdictBadge({ verdict, score }: { verdict: AnalysisResult["verdict"]; score: number }) {
  const styles: Record<AnalysisResult["verdict"], string> = {
    "ÄLÄ OSTA": "text-red-600 bg-red-50 border-red-200",
    "HARKITSE TARKKAAN": "text-yellow-600 bg-yellow-50 border-yellow-200",
    "HYVÄ KOHDE": "text-green-600 bg-green-50 border-green-200",
  };
  return (
    <div className={`inline-flex flex-col items-center border-2 rounded-2xl px-8 py-5 ${styles[verdict]}`}>
      <span className="text-7xl font-black leading-none">{score}</span>
      <span className="text-sm font-bold mt-2 tracking-wide">{verdict}</span>
      <span className="text-xs opacity-60 mt-0.5">/ 10</span>
    </div>
  );
}

function RepairRow({ repair }: { repair: UpcomingRepair }) {
  const badge =
    repair.confidence === "high"
      ? "bg-red-100 text-red-700"
      : repair.confidence === "medium"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-gray-100 text-gray-600";
  return (
    <li className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="font-medium text-gray-800">{repair.type}</span>
      <div className="flex items-center gap-2 shrink-0">
        {repair.planned_year && <span className="text-sm text-gray-500">{repair.planned_year}</span>}
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>
          {CONFIDENCE_FI[repair.confidence] ?? repair.confidence}
        </span>
      </div>
    </li>
  );
}

function FileZone({
  label,
  hint,
  fileName,
  onFile,
  optional,
}: {
  label: string;
  hint: string;
  fileName: string | null;
  onFile: (f: File) => void;
  optional?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f?.type === "application/pdf") onFile(f);
    },
    [onFile]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-colors
        ${dragOver ? "border-blue-400 bg-blue-50" : fileName ? "border-green-300 bg-green-50" : "border-gray-300 bg-white hover:border-gray-400"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
        {optional && <span className="text-xs text-gray-400">(valinnainen)</span>}
      </div>
      {fileName ? (
        <p className="text-sm font-medium text-green-700 text-center">{fileName}</p>
      ) : (
        <p className="text-sm text-gray-500 text-center">{hint}</p>
      )}
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);

  const knownRepairs = result?.upcoming_repairs.filter((r) => r.type !== "other") ?? [];
  const canAnalyze = !!file1;

  async function analyze() {
    if (!file1) return;
    setState("loading");
    setError(null);

    const form = new FormData();
    form.append("file", file1);
    if (file2) form.append("file2", file2);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analyysi epäonnistui");
      setResult(data);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tuntematon virhe");
      setState("error");
    }
  }

  function reset() {
    setState("idle");
    setResult(null);
    setFile1(null);
    setFile2(null);
    setError(null);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-6">
            <img src="/logo-mark.svg" alt="" width="32" height="32" />
            <span className="text-lg font-black tracking-tight text-gray-900">Luukku<span className="text-blue-600">-AI</span></span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Asuntoanalyysi</h1>
          <p className="text-gray-500 mt-1">
            Lataa isännöitsijäntodistus ja/tai tilinpäätös — saat riskianalyysin muutamassa sekunnissa.
          </p>
        </div>

        {/* Upload */}
        <div className="grid grid-cols-2 gap-3">
          <FileZone
            label="Isännöitsijäntodistus"
            hint="Vedä PDF tai klikkaa"
            fileName={file1?.name ?? null}
            onFile={setFile1}
          />
          <FileZone
            label="Tilinpäätös"
            hint="Vedä PDF tai klikkaa"
            fileName={file2?.name ?? null}
            onFile={setFile2}
            optional
          />
        </div>

        {file2 && !file1 && (
          <p className="mt-2 text-xs text-amber-600">Lisää myös isännöitsijäntodistus parempaa analyysiä varten.</p>
        )}

        {/* Analyze button */}
        <button
          onClick={analyze}
          disabled={!canAnalyze || state === "loading"}
          className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm
            hover:bg-blue-700 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {state === "loading"
            ? file2 ? "Analysoidaan kahta dokumenttia…" : "Analysoidaan…"
            : "Analysoi"}
        </button>

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {state === "loading" && (
          <div className="mt-8 space-y-3 animate-pulse">
            <div className="h-32 bg-gray-100 rounded-2xl" />
            <div className="h-24 bg-gray-100 rounded-2xl" />
            <div className="h-24 bg-gray-100 rounded-2xl" />
          </div>
        )}

        {/* Results */}
        {state === "done" && result && (
          <div className="mt-8 space-y-4">
            {/* Verdict + cost */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center gap-8">
              <VerdictBadge verdict={result.verdict} score={result.risk_score} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Arvioitu todellinen kuukausikulu
                </p>
                <p className="text-4xl font-black text-gray-900 mt-1">
                  {result.monthly_cost.toLocaleString("fi-FI")} €
                  <span className="text-base font-normal text-gray-400">/kk</span>
                </p>
                {result.extracted.apartment_size_m2 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Asunto {result.extracted.apartment_size_m2} m²
                    {result.extracted.building_year && ` · Rak. ${result.extracted.building_year}`}
                  </p>
                )}
                {result.extracted.confidence_percent && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Analyysin luotettavuus {result.extracted.confidence_percent}%
                    {file2 ? " · 2 dokumenttia" : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Upcoming repairs */}
            {knownRepairs.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-4">
                  Tulevat remontit
                </h2>
                <ul>
                  {knownRepairs.map((r, i) => <RepairRow key={i} repair={r} />)}
                </ul>
              </div>
            )}

            {/* Red flags */}
            {result.red_flags.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-4">
                  Huomiot
                </h2>
                <ul className="space-y-2">
                  {result.red_flags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-0.5 text-red-500 shrink-0">⚠</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Raw numbers */}
            <details className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <summary className="px-6 py-4 text-sm font-semibold uppercase tracking-wide text-gray-400 cursor-pointer select-none">
                Raakadata
              </summary>
              <div className="px-6 pb-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  ["Hoitovastike", result.extracted.maintenance_fee_monthly, "€/kk"],
                  ["Rahoitusvastike", result.extracted.financing_fee_monthly, "€/kk"],
                  ["Laina/osake", result.extracted.loan_per_share, "€"],
                  ["Laina/m²", result.extracted.loan_per_m2, "€/m²"],
                  ["Yhtiölaina yht.", result.extracted.housing_company_debt_total, "€"],
                  ["Korjausrahasto", result.extracted.repair_fund, "€"],
                ].map(([label, val, unit]) =>
                  val !== null && val !== undefined ? (
                    <div key={label as string} className="py-1 border-b border-gray-100">
                      <span className="text-gray-400">{label}</span>
                      <span className="ml-2 font-semibold text-gray-800">
                        {(val as number).toLocaleString("fi-FI")} {unit}
                      </span>
                    </div>
                  ) : null
                )}
              </div>
            </details>

            <button
              onClick={reset}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Analysoi uusi tiedosto
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
