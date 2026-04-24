"use client";

import { useState, useRef, useCallback } from "react";
import type { AnalysisResult, UpcomingRepair } from "@/types/analysis";

type AppState = "idle" | "loading" | "done" | "error";

function RiskBadge({ score }: { score: number }) {
  const color =
    score >= 7
      ? "text-red-600 bg-red-50 border-red-200"
      : score >= 4
        ? "text-yellow-600 bg-yellow-50 border-yellow-200"
        : "text-green-600 bg-green-50 border-green-200";

  const label = score >= 7 ? "Korkea riski" : score >= 4 ? "Kohtalainen" : "Matala riski";

  return (
    <div className={`inline-flex flex-col items-center border-2 rounded-2xl px-8 py-5 ${color}`}>
      <span className="text-7xl font-black leading-none">{score}</span>
      <span className="text-sm font-semibold mt-1 tracking-wide uppercase">{label}</span>
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
        {repair.planned_year && (
          <span className="text-sm text-gray-500">{repair.planned_year}</span>
        )}
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>
          {repair.confidence}
        </span>
      </div>
    </li>
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (file.type !== "application/pdf") {
      setError("Vain PDF-tiedostot hyväksytään.");
      return;
    }
    fileRef.current = file;
    setFileName(file.name);
    setError(null);
    setResult(null);
    setState("idle");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  async function analyze() {
    if (!fileRef.current) return;
    setState("loading");
    setError(null);

    const form = new FormData();
    form.append("file", fileRef.current);

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

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Asuntoanalyysi</h1>
          <p className="text-gray-500 mt-1">
            Lataa isännöitsijäntodistus tai tilinpäätös — saat riskianalyysin sekunteja.
          </p>
        </div>

        {/* Upload */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-colors
            ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white hover:border-gray-400"}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          {fileName ? (
            <p className="text-sm font-medium text-blue-700">{fileName}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">Vedä tiedosto tähän tai klikkaa</p>
              <p className="text-xs text-gray-400 mt-1">PDF, max 10 MB</p>
            </>
          )}
        </div>

        {/* Analyze button */}
        <button
          onClick={analyze}
          disabled={!fileName || state === "loading"}
          className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm
            hover:bg-blue-700 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {state === "loading" ? "Analysoidaan…" : "Analysoi"}
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
            {/* Score + cost */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center gap-8">
              <RiskBadge score={result.risk_score} />
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
              </div>
            </div>

            {/* Upcoming repairs */}
            {result.upcoming_repairs.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-4">
                  Tulevat remontit
                </h2>
                <ul>
                  {result.upcoming_repairs.map((r, i) => (
                    <RepairRow key={i} repair={r} />
                  ))}
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
              onClick={() => { setState("idle"); setResult(null); setFileName(null); fileRef.current = null; }}
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
