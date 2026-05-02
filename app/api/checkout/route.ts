import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { storeAnalysis } from '@/src/services/analysisStore'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { analysisData, email } = body as { analysisData: unknown; email?: string }

    if (!analysisData) {
      return NextResponse.json({ error: 'analysisData puuttuu' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luukkuai.win'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Luukku AI — Asuntoanalyysi PDF',
              description: 'Täydellinen riskianalyysi remontteineen ja luotettavuusarvioineen',
            },
            unit_amount: 1490,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/?paid=1`,
      cancel_url: `${baseUrl}/`,
    })

    storeAnalysis(session.id, analysisData)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[checkout]', err)
    return NextResponse.json({ error: 'Checkout epäonnistui' }, { status: 500 })
  }
}
