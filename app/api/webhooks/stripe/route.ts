import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { db } from '@/src/lib/db'
import { renderReportPdf } from '@/src/services/reportRenderer'
import type { AnalysisResult } from '@/types/analysis'

export const runtime = 'nodejs'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Stripe-signature puuttuu' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[webhook] Allekirjoituksen tarkistus epäonnistui:', err)
    return NextResponse.json({ error: 'Virheellinen webhook-allekirjoitus' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const analysisId = session.metadata?.analysisId

  if (!analysisId) {
    console.warn(`[webhook] Sessiossa ${session.id} ei ole metadata.analysisId`)
    return NextResponse.json({ received: true })
  }

  // Atomic paid flip. WHERE paid=false ensures we only run side effects
  // once per analysis even if Stripe redelivers the event. count===0 means
  // either (a) we've already processed this row, or (b) the analysis was
  // never created — both cases fall through to the post-flip email branch
  // which checks emailed_at to decide whether to (re)send.
  const flip = await db.analysisLog.updateMany({
    where: { id: analysisId, paid: false },
    data: {
      paid: true,
      paid_at: new Date(),
      stripe_session_id: session.id,
    },
  })
  if (flip.count === 1) {
    console.log(`[webhook] Maksu lukittu analyysille ${analysisId}`)
  }

  const row = await db.analysisLog.findUnique({
    where: { id: analysisId },
    select: {
      id: true,
      paid: true,
      emailed_at: true,
      address: true,
      broker_logo: true,
      result_json: true,
    },
  })

  if (!row || !row.paid) {
    console.warn(`[webhook] Analyysiä ${analysisId} ei löydy tai paid=false flipin jälkeen`)
    return NextResponse.json({ received: true })
  }

  if (row.emailed_at) {
    // Email already delivered on a previous webhook invocation.
    return NextResponse.json({ received: true })
  }

  const recipient = session.customer_details?.email ?? session.customer_email
  if (!recipient) {
    console.error(`[webhook] Ei vastaanottaja-emailia sessiolle ${session.id}`)
    return NextResponse.json({ received: true })
  }

  if (!row.result_json) {
    console.error(`[webhook] result_json puuttuu analyysilta ${analysisId}`)
    return NextResponse.json({ received: true })
  }

  try {
    const pdf = await renderReportPdf({
      result: row.result_json as unknown as AnalysisResult,
      address: row.address ?? 'Kohde',
      brokerLogo: row.broker_logo ?? undefined,
    })

    await getResend().emails.send({
      from: 'Luukku AI <raportti@luukkuai.win>',
      to: recipient,
      subject: 'Asuntoanalyysiraporttisi on valmis',
      html: `
        <p>Hei,</p>
        <p>Kiitos tilauksestasi! Täydellinen asuntoanalyysi on liitteenä.</p>
        <p>Raportti sisältää riskipisteytyksen, remonttihistorian, talousanalyysin ja punaiset liput.</p>
        <p>— Luukku AI</p>
      `,
      attachments: [{ filename: 'asuntoanalyysi.pdf', content: Buffer.from(pdf) }],
    })

    await db.analysisLog.update({
      where: { id: analysisId },
      data: { emailed_at: new Date() },
    })

    console.log(`[webhook] PDF lähetetty: ${recipient}, analyysi: ${analysisId}`)
    return NextResponse.json({ received: true })
  } catch (err) {
    // paid stays true — money is captured, customer can still download
    // from the UI via /api/report. emailed_at stays null so a Stripe
    // webhook retry (triggered by this 500) re-attempts the email only.
    console.error(`[webhook] Email-toimitus epäonnistui analyysille ${analysisId}:`, err)
    return NextResponse.json({ error: 'Email-toimitus epäonnistui' }, { status: 500 })
  }
}
