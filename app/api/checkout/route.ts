import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSession } from '@/src/lib/auth'
import { db } from '@/src/lib/db'

export const runtime = 'nodejs'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia',
  })
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Kirjaudu sisään' }, { status: 401 })
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
      select: { id: true, user_id: true, paid: true },
    })
    if (!analysis || analysis.user_id !== session.userId) {
      return NextResponse.json({ error: 'Analyysiä ei löydy' }, { status: 404 })
    }
    if (analysis.paid) {
      return NextResponse.json({ error: 'Tämä raportti on jo maksettu' }, { status: 409 })
    }

    // Persist the broker logo (if any) onto the row before redirecting to
    // Stripe — the webhook renders the PDF entirely from the DB row.
    if (typeof brokerLogo === 'string' && brokerLogo.length > 0) {
      await db.analysisLog.update({
        where: { id: analysisId },
        data: { broker_logo: brokerLogo },
      })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luukkuai.win'

    const checkout = await getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      metadata: {
        analysisId,
        userId: session.userId,
      },
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
      success_url: `${baseUrl}/?paid=1&analysis=${analysisId}`,
      cancel_url: `${baseUrl}/?canceled=1`,
    })

    return NextResponse.json({ url: checkout.url })
  } catch (err) {
    console.error('[checkout]', err)
    return NextResponse.json({ error: 'Checkout epäonnistui' }, { status: 500 })
  }
}
