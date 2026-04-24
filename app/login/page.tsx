"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const body = mode === "login"
      ? { email, password }
      : { email, password, office_name: officeName };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Jokin meni pieleen");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  const inputClass = "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <img src="/logo-mark.svg" alt="" width="28" height="28" />
          <span className="text-lg font-black tracking-tight text-gray-900">
            Luukku<span className="text-blue-600">-AI</span>
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {mode === "login" ? "Kirjaudu sisään" : "Luo tili"}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {mode === "login"
            ? "Syötä toimiston tunnukset"
            : "Aloita 20 ilmaisella analyysillä"}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label htmlFor="office-name" className={labelClass}>Toimiston nimi</label>
              <input
                id="office-name"
                type="text"
                autoComplete="organization"
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className={labelClass}>Sähköposti</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>Salasana</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className={inputClass}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Hetki…" : mode === "login" ? "Kirjaudu" : "Luo tili"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          {mode === "login" ? "Ei tiliä vielä?" : "Onko sinulla jo tili?"}{" "}
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
            className="text-blue-600 hover:underline font-medium"
          >
            {mode === "login" ? "Rekisteröidy" : "Kirjaudu"}
          </button>
        </p>
      </div>
    </main>
  );
}
