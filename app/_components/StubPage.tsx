"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";

type UserInfo = { id: string; email: string; office_name: string; credits_remaining: number };

export function StubPage({ title, description }: { title: string; description: string }) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!data || data.error) { router.push("/login"); return; } setUser(data); })
      .catch(() => router.push("/login"));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F2F2F7]">
      <Sidebar user={user} onLogout={logout} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="shrink-0 bg-white border-b border-gray-100 px-8 py-4">
          <h1 className="text-base font-bold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">Tulossa pian</p>
            <p className="text-xs text-gray-500 mt-1">Tämä ominaisuus on kehitteillä.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
