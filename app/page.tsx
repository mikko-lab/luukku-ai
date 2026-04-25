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
  const cx = 100, cy = 88, r = 72;
  const frac = Math.min(Math.max(score / 10, 0.001), 0.999);
  const angle = frac * Math.PI;
  const ex = cx - r * Math.cos(angle);
  const ey = cy - r * Math.sin(angle);
  const largeArc = frac > 0.5 ? 1 : 0;
  const color = score >= 7 ? "#DC2626" : score >= 5 ? "#D97706" : "#16A34A";

  return (
    <svg viewBox="0 0 200 100" className="w-full max-w-[220px] mx-auto" aria-hidden="true">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#F3F4F6" strokeWidth="13" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`}
        fill="none" stroke={color} strokeWidth="13" strokeLinecap="round" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="30" fontWeight="700" fill={color}>{score}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="10" fill="#9CA3AF">/ 10</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                             */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { label: "Uusi analyysi", active: true },
  { label: "Analyysit", active: false },
  { label: "Kohteet", active: false },
  { label: "Raportit", active: false },
  { label: "Asetukset", active: false },
  { label: "Ohjeet", active: false },
];

function Sidebar({ user, onLogout }: { user: UserInfo | null; onLogout: () => void }) {
  return (
    <aside className="w-52 shrink-0 bg-gray-900 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-6">
        <span className="text-white font-black tracking-tight text-base">
          Luukku<span className="text-apple-blue">-AI</span>
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-0.5" aria-label="Päänavigaatio">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            disabled={!item.active}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              item.active
                ? "bg-gray-700 text-white font-medium"
                : "text-gray-500 cursor-default"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {user && (
        <div className="px-4 py-5 border-t border-gray-800">
          <p className="text-xs text-gray-400 truncate">{user.office_name}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
          <button
            onClick={onLogout}
            className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Kirjaudu ulos
          </button>
        </div>
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  File drop zone                                                      */
/* ------------------------------------------------------------------ */

function FileZone({ label, hint, fileName, onFile, optional }: {
  label: string; hint: string; fileName: string | null;
  onFile: (f: File) => void; optional?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") onFile(f);
  }, [onFile]);

  const inputId = `file-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
      role="button" tabIndex={0}
      aria-label={`${label}${optional ? " (valinnainen)" : ""} — ${fileName ? `Valittu: ${fileName}` : hint}`}
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-5 cursor-pointer transition-colors min-h-[90px]
        ${dragOver ? "border-apple-blue bg-blue-50" : fileName ? "border-gray-200 bg-white" : "border-gray-200 bg-white hover:border-gray-300"}`}
    >
      <input ref={inputRef} id={inputId} type="file" accept="application/pdf"
        className="hidden" aria-hidden="true" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1" aria-hidden="true">
        {label}{optional && <span className="normal-case font-normal"> (valinnainen)</span>}
      </p>
      {fileName
        ? <p className="text-sm font-medium text-green-600 text-center" aria-hidden="true">✓ {fileName}</p>
        : <p className="text-sm text-gray-400 text-center" aria-hidden="true">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Repair row                                                          */
/* ------------------------------------------------------------------ */

function RepairRow({ repair }: { repair: UpcomingRepair }) {
  const badge =
    repair.confidence === "high" ? "bg-red-100 text-red-700" :
    repair.confidence === "medium" ? "bg-yellow-100 text-yellow-700" :
    "bg-gray-100 text-gray-500";

  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="py-3 pr-4 text-sm font-medium text-gray-800">{repair.type}</td>
      <td className="py-3 pr-4 text-sm text-gray-500">{repair.planned_year ?? "—"}</td>
      <td className="py-3 pr-4">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>
          {CONFIDENCE_FI[repair.confidence] ?? repair.confidence}
        </span>
      </td>
      <td className="py-3 text-sm text-right font-medium text-gray-700">
        {repair.cost_estimate_eur != null
          ? `n. ${repair.cost_estimate_eur.toLocaleString("fi-FI")} €`
          : "—"}
      </td>
    </tr>
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
      `Analyysin luotettavuus: ${result.extracted.confidence_percent ?? Math.round(result.confidence * 100)}%${file2 ? " · 2 dokumenttia" : ""}`,
    ];

    const known = result.upcoming_repairs.filter((r) => r.type !== "other");
    if (known.length > 0) {
      lines.push(``, `Tulevat remontit:`);
      known.forEach((r) => {
        lines.push(`- ${r.type}${r.planned_year ? ` (${r.planned_year})` : ""} · ${CONFIDENCE_FI[r.confidence] ?? r.confidence}${r.cost_estimate_eur ? ` · n. ${r.cost_estimate_eur.toLocaleString("fi-FI")} €` : ""}`);
      });
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
    try {
      await navigator.clipboard.writeText(buildText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <button
      onClick={copy}
      className="w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
    >
      {copied ? "✓ Kopioitu" : "Kopioi teksti"}
    </button>
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
  const logoInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const knownRepairs = result?.upcoming_repairs.filter((r) => r.type !== "other") ?? [];
  const knownRenovations = result?.extracted.last_major_renovations.filter((r) => r.type !== "other") ?? [];
  const outOfCredits = user !== null && user.credits_remaining <= 0;
  const canAnalyze = !!file1 && !outOfCredits;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || data.error) { router.push("/login"); return; }
        setUser(data);
      })
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
      ? `${result.extracted.building_year ?? ""} · ${result.extracted.apartment_size_m2} m²`
      : "Kohde";
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result, address, brokerLogo }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "luukku-analyysi.pdf"; a.click();
    URL.revokeObjectURL(url);
  }

  async function analyze() {
    if (!file1) return;
    setState("loading"); setError(null);
    const form = new FormData();
    form.append("file", file1);
    if (file2) form.append("file2", file2);
    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analyysi epäonnistui");
      setResult(data);
      setState("done");
      setUser((u) => u ? { ...u, credits_remaining: u.credits_remaining - 1 } : u);
      setTimeout(() => resultsRef.current?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tuntematon virhe");
      setState("error");
    }
  }

  function reset() {
    setState("idle"); setResult(null); setFile1(null); setFile2(null); setError(null);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const verdictColor = result
    ? result.verdict === "ÄLÄ OSTA" ? "text-red-600"
    : result.verdict === "HARKITSE TARKKAAN" ? "text-yellow-600"
    : "text-green-600"
    : "";

  return (
    <div className="flex h-screen overflow-hidden bg-apple-bg">
      <Sidebar user={user} onLogout={logout} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Uusi riskianalyysi</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Lataa isännöitsijäntodistus ja/tai tilinpäätös ja käynnistä analyysi
            </p>
          </div>
          {user && (
            <span
              aria-live="polite" aria-atomic="true"
              className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                user.credits_remaining === 0 ? "bg-red-50 text-red-600"
                : user.credits_remaining <= 5 ? "bg-yellow-50 text-yellow-700"
                : "bg-gray-100 text-gray-500"
              }`}
            >
              {user.credits_remaining === 0
                ? "Ei analyysejä jäljellä"
                : `${user.credits_remaining} / 20 analyysiä jäljellä`}
            </span>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className={`p-8 gap-6 ${state === "done" && result ? "grid grid-cols-[1fr_320px]" : "max-w-2xl"}`}>

            {/* LEFT COLUMN */}
            <div className="space-y-5 min-w-0">

              {/* Upload card */}
              <div className="bg-white rounded-2xl shadow-card p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Lataa dokumentit</h2>
                <div className="grid grid-cols-2 gap-3">
                  <FileZone label="Isännöitsijäntodistus" hint="Vedä PDF tai klikkaa"
                    fileName={file1?.name ?? null} onFile={setFile1} />
                  <FileZone label="Tilinpäätös" hint="Vedä PDF tai klikkaa"
                    fileName={file2?.name ?? null} onFile={setFile2} optional />
                </div>

                {file2 && !file1 && (
                  <p className="mt-2 text-xs text-amber-600">Lisää myös isännöitsijäntodistus parempaa analyysiä varten.</p>
                )}

                {/* Broker logo */}
                <div className="mt-4 flex items-center gap-3">
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                  {brokerLogo ? (
                    <div className="flex items-center gap-2">
                      <img src={brokerLogo} alt="Logo" className="h-6 object-contain" />
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

                <button
                  onClick={analyze}
                  disabled={!canAnalyze || state === "loading"}
                  aria-busy={state === "loading"}
                  className="mt-4 w-full py-2.5 rounded-xl bg-apple-blue text-white font-semibold text-sm
                    hover:bg-apple-blueh active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {state === "loading"
                    ? (file2 ? "Analysoidaan kahta dokumenttia…" : "Analysoidaan…")
                    : "Aloita analyysi"}
                </button>

                {outOfCredits && (
                  <div role="alert" className="mt-3 p-4 rounded-xl bg-yellow-50 text-sm text-yellow-800">
                    <p className="font-semibold">Analyysit käytetty</p>
                    <a href="mailto:mikkotark@protonmail.com?subject=Luukku-AI lisää analyysejä"
                      className="text-xs font-semibold underline mt-1 inline-block">
                      Pyydä lisää käyttöä →
                    </a>
                  </div>
                )}
                {error && (
                  <div role="alert" className="mt-3 p-4 rounded-xl bg-red-50 text-sm text-red-700">
                    {error === "NO_CREDITS" ? "Analyysit käytetty — pyydä lisää käyttöä." : error}
                  </div>
                )}
              </div>

              {/* Loading skeleton */}
              {state === "loading" && (
                <div aria-live="polite" aria-label="Analysoidaan dokumenttia" className="space-y-3 animate-pulse">
                  <div className="h-28 bg-white rounded-2xl shadow-card" />
                  <div className="h-40 bg-white rounded-2xl shadow-card" />
                </div>
              )}

              {/* Summary + repairs */}
              {state === "done" && result && (
                <div ref={resultsRef} tabIndex={-1} className="space-y-5 outline-none">

                  {/* Yhteenveto */}
                  <div className="bg-white rounded-2xl shadow-card p-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Yhteenveto</h2>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      {[
                        ["Rakennusvuosi", result.extracted.building_year],
                        ["Pinta-ala", result.extracted.apartment_size_m2 ? `${result.extracted.apartment_size_m2} m²` : null],
                        ["Hoitovastike", result.extracted.maintenance_fee_monthly ? `${result.extracted.maintenance_fee_monthly.toLocaleString("fi-FI")} €/kk` : null],
                        ["Rahoitusvastike", result.extracted.financing_fee_monthly ? `${result.extracted.financing_fee_monthly.toLocaleString("fi-FI")} €/kk` : null],
                        ["Laina/osake", result.extracted.loan_per_share ? `${result.extracted.loan_per_share.toLocaleString("fi-FI")} €` : null],
                        ["Yhtiölaina yht.", result.extracted.housing_company_debt_total ? `${result.extracted.housing_company_debt_total.toLocaleString("fi-FI")} €` : null],
                        ["Korjausrahasto", result.extracted.repair_fund ? `${result.extracted.repair_fund.toLocaleString("fi-FI")} €` : null],
                        ["Arvioitu kk-kulu", `${result.monthly_cost.toLocaleString("fi-FI")} €/kk`],
                      ].filter(([, v]) => v != null).map(([label, value]) => (
                        <div key={label as string} className="flex justify-between py-1.5 border-b border-gray-50">
                          <span className="text-gray-500">{label}</span>
                          <span className="font-semibold text-gray-800">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Remontit */}
                  {(knownRepairs.length > 0 || knownRenovations.length > 0) && (
                    <div className="bg-white rounded-2xl shadow-card p-6">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">
                        Suunnitellut ja tehdyt remontit
                      </h2>

                      {knownRepairs.length > 0 && (
                        <>
                          <p className="text-xs font-medium text-gray-500 mb-2">Tulevat</p>
                          <table className="w-full mb-4">
                            <thead>
                              <tr className="text-xs text-gray-400 border-b border-gray-100">
                                <th className="text-left pb-2 font-medium">Remontti</th>
                                <th className="text-left pb-2 font-medium">Vuosi</th>
                                <th className="text-left pb-2 font-medium">Varmuus</th>
                                <th className="text-right pb-2 font-medium">Rahavaikutus</th>
                              </tr>
                            </thead>
                            <tbody>
                              {knownRepairs.map((r, i) => <RepairRow key={i} repair={r} />)}
                            </tbody>
                          </table>
                        </>
                      )}

                      {knownRenovations.length > 0 && (
                        <>
                          <p className="text-xs font-medium text-gray-500 mb-2">Tehdyt</p>
                          <div className="space-y-1">
                            {knownRenovations.map((r, i) => (
                              <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                                <span className="text-gray-700">{r.type}</span>
                                <span className="text-gray-400">{r.year ?? "—"}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <button onClick={reset}
                    className="w-full py-2 text-sm text-apple-gray hover:text-gray-900 transition-colors">
                    Analysoi uusi tiedosto
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN — only when results available */}
            {state === "done" && result && (
              <div className="space-y-4">

                {/* Score card */}
                <div className="bg-white rounded-2xl shadow-card p-6 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Riskiarvio</p>
                  <RiskGauge score={result.risk_score} />
                  <p className={`text-base font-bold mt-3 ${verdictColor}`}>{result.verdict}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Luotettavuus {result.extracted.confidence_percent ?? Math.round(result.confidence * 100)}%
                    {file2 ? " · 2 dok." : ""}
                  </p>

                  <div className="mt-5 text-left border-t border-gray-50 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Arvioitu kk-kulu</p>
                    <p className="text-3xl font-black text-gray-900">
                      {result.monthly_cost.toLocaleString("fi-FI")}
                      <span className="text-base font-normal text-gray-400"> €/kk</span>
                    </p>
                  </div>
                </div>

                {/* Risk factors */}
                {result.factors.filter((f) => f.impact !== 0).length > 0 && (
                  <div className="bg-white rounded-2xl shadow-card p-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Riskitekijät</h2>
                    <div className="space-y-2">
                      {result.factors.filter((f) => f.impact !== 0).map((f, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 text-sm">
                          <span className="text-gray-700 leading-snug">{f.label}</span>
                          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                            f.impact > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                          }`}>
                            {f.impact > 0 ? "+" : ""}{f.impact}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {result.red_flags.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-card p-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Huomiot</h2>
                    <ul className="space-y-3">
                      {result.red_flags.map((flag, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-gray-700 leading-relaxed">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <button onClick={downloadReport}
                  className="w-full py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-black transition-colors">
                  Lataa raportti (PDF)
                </button>
                <CopyButton result={result} file2={!!file2} />
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="px-8 py-6 text-center">
            <p className="text-xs text-gray-400">
              powered by{" "}
              <a href="https://wpsaavutettavuus.fi" target="_blank" rel="noopener noreferrer"
                className="hover:text-gray-600 underline underline-offset-2">
                wpsaavutettavuus.fi
              </a>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
