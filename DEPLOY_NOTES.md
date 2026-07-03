## ÄLÄ DEPLOYAA HETZNERIIN ENNEN TÄTÄ (lisätty 2026-07-03, commitit 04b990f–4a15b5d)

Auth-purku + kertaostomalliin siirto pushattu origin/mainiin, mutta Stripe-webhook
(app/api/webhooks/stripe/route.ts) on testaamaton:
- Ei testitiedostoja repossa
- CI ei aja webhook-logiikkaa
- Ei todisteita manuaalisesta verifioinnista

Ennen tuotantodeployta:
1. Aja `stripe trigger checkout.session.completed` paikallista dev-serveriä vasten
2. Lähetä sama event kahdesti — varmista ettei tuplalaskutusta/tuplaflippiä tapahdu (idempotenssi)
3. Vasta kun molemmat vahvistettu: poista tämä merkintä ja deployaa
