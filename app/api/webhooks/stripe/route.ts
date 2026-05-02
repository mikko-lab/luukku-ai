import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { consumeAnalysis } from '@/src/services/analysisStore'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

const resend = new Resend(process.env.RESEND_API_KEY!)

async function generatePdfBuffer(analysisData: unknown): Promise<Buffer> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luukkuai.win'
  const res = await fetch(`${baseUrl}/api/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(analysisData),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`/api/report virhe ${res.status}: ${text}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Stripe-signature puuttuu' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[webhook] Allekirjoituksen tarkistus epäonnistui:', err)
    return NextResponse.json({ error: 'Virheellinen webhook-allekirjoitus' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const customerEmail = session.customer_details?.email ?? session.customer_email
    const analysisData = consumeAnalysis(session.id)

    if (!analysisData) {
      console.warn(`[webhook] Ei analyysidataa sessiolle ${session.id}`)
      return NextResponse.json({ received: true })
    }

    try {
      const pdfBuffer = await generatePdfBuffer(analysisData)

      await resend.emails.send({
        from: 'Luukku AI <raportti@luukkuai.win>',
        to: customerEmail!,
        subject: 'Asuntoanalyysiraporttisi on valmis',
        html: `
          <p>Hei,</p>
          <p>Kiitos tilauksestasi! Täydellinen asuntoanalyysi on liitteenä.</p>
          <p>Raportti sisältää riskipisteytyksen, remonttihistorian, talousanalyysin ja punaiset liput.</p>
          <p>— Luukku AI</p>
        `,
        attachments: [{ filename: 'asuntoanalyysi.pdf', content: pdfBuffer }],
      })

      console.log(`[webhook] PDF lähetetty: ${customerEmail}, sessio: ${session.id}`)
    } catch (err) {
      console.error('[webhook] Epäonnistui:', err)
      return NextResponse.json({ error: 'Käsittely epäonnistui' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
