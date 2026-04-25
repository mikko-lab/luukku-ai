"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type UserInfo = { id: string; email: string; office_name: string; credits_remaining: number };

const NAV_ITEMS = [
  {
    label: "Uusi analyysi", href: "/",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  },
  {
    label: "Analyysit", href: "/analyysit",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h16M4 18h16" />,
  },
  {
    label: "Kohteet", href: "/kohteet",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
  },
  {
    label: "Raportit", href: "/raportit",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  },
  {
    label: "Asetukset", href: "/asetukset",
    icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
  },
  {
    label: "Ohjeet", href: "/ohjeet",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
];

function NavIcon({ d }: { d: React.ReactNode }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      {d}
    </svg>
  );
}

export function Sidebar({ user, onLogout }: { user: UserInfo | null; onLogout: () => void }) {
  const pathname = usePathname();

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
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2.5 ${
                isActive ? "bg-white/10 text-white font-medium" : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <NavIcon d={item.icon} />
              {item.label}
            </Link>
          );
        })}
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
