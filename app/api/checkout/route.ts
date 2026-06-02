import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/src/lib/db'
import { getCheckoutRatelimit, getClientIp } from '@/src/lib/ratelimit'

export const runtime = 'nodejs'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia',
  })
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = getCheckoutRatelimit()
    if (rl) {
      const { success } = await rl.limit(`checkout:${ip}`)
      if (!success) {
        return NextResponse.json(
          { error: 'Liian monta pyyntöä, odota hetki' },
          { status: 429 },
        )
      }
    }

    const body = await req.json()
    const { analysisId, email, brokerLogo } = body as {
      analysisId?: string
      email?: string
      brokerLogo?: string
    }

    if (!analysisId) {
      return NextResponse.json({ error: 'analysisId puuttuu' }, { status: 400 })
    }
    if (!email) {
      return NextResponse.json({ error: 'email vaaditaan' }, { status: 400 })
    }

    const analysis = await db.analysisLog.findUnique({
      where: { id: analysisId },
      select: { id: true, paid: true },
    })
    if (!analysis) {
      return NextResponse.json({ error: 'Analyysiä ei löydy' }, { status: 404 })
    }
    if (analysis.paid) {
      return NextResponse.json({ error: 'Tämä raportti on jo maksettu' }, { status: 409 })
    }

    // Persist email + broker_logo onto the row before redirecting to Stripe.
    // The webhook renders the PDF entirely from the DB row, and uses the
    // persisted email as a fallback if Stripe's customer_details.email is
    // somehow blank when checkout.session.completed arrives.
    await db.analysisLog.update({
      where: { id: analysisId },
      data: {
        email,
        ...(typeof brokerLogo === 'string' && brokerLogo.length > 0
          ? { broker_logo: brokerLogo }
          : {}),
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luukkuai.win'

    const checkout = await getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      metadata: { analysisId },
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
      success_url: `${baseUrl}/?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?canceled=1`,
    })

    return NextResponse.json({ url: checkout.url })
  } catch (err) {
    console.error('[checkout]', err)
    return NextResponse.json({ error: 'Checkout epäonnistui' }, { status: 500 })
  }
}
