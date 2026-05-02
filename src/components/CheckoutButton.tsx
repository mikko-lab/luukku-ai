'use client'

import { useState } from 'react'

interface CheckoutButtonProps {
  analysisData: unknown
}

type Step = 'idle' | 'email' | 'loading' | 'error'

export default function CheckoutButton({ analysisData }: CheckoutButtonProps) {
  const [step, setStep] = useState<Step>('idle')
  const [email, setEmail] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleCheckout() {
    if (!email || !email.includes('@')) {
      setErrorMsg('Syötä kelvollinen sähköpostiosoite.')
      return
    }
    setStep('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisData, email }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Tuntematon virhe')
      window.location.href = data.url
    } catch (err) {
      console.error(err)
      setErrorMsg('Maksupalveluun yhdistäminen epäonnistui. Yritä uudelleen.')
      setStep('email')
    }
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('email')}
        style={{ boxShadow: '0 0 24px rgba(0,229,204,0.30)' }}
        className="w-full py-3 rounded-xl bg-[#00E5CC] text-[#0A0A0F] font-bold text-sm hover:bg-[#00f5da] transition-colors"
      >
        Näytä raportti — 14,90 €
      </button>
    )
  }

  if (step === 'loading') {
    return (
      <button disabled className="w-full py-3 rounded-xl bg-[#00E5CC] text-[#0A0A0F] font-bold text-sm opacity-50 cursor-not-allowed">
        Siirrytään maksupalveluun…
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-[#8888A4]">Raportti lähetetään sähköpostiisi maksun jälkeen.</p>
      <input
        type="email"
        placeholder="sinun@email.fi"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCheckout()}
        autoFocus
        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A14] border border-[#1E2035] text-white text-sm placeholder-[#4B4B6A] focus:outline-none focus:border-[#00E5CC]/50"
      />
      {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
      <button
        onClick={handleCheckout}
        style={{ boxShadow: '0 0 24px rgba(0,229,204,0.30)' }}
        className="w-full py-3 rounded-xl bg-[#00E5CC] text-[#0A0A0F] font-bold text-sm hover:bg-[#00f5da] transition-colors"
      >
        Jatka maksuun →
      </button>
      <button
        onClick={() => { setStep('idle'); setErrorMsg('') }}
        className="text-xs text-[#8888A4] hover:text-white transition-colors py-1"
      >
        Peruuta
      </button>
    </div>
  )
}
