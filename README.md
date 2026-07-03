# Luukku AI — Asuntoanalyysi

Lataa isännöitsijäntodistus ja/tai tilinpäätös, saat riskianalyysin muutamassa sekunnissa.

## Mitä se tekee

- Lukee PDF:n ja poimii talousluvut, remonttihistorian ja tulevat remontit
- Luokittelee remontit (putkiremontti, julkisivu, katto...) domain-logiikalla
- Laskee riskipisteen 0–10 ja antaa selkeän päätöksen: **ÄLÄ OSTA / HARKITSE TARKKAAN / HYVÄ KOHDE**
- Tukee kahden dokumentin yhdistämistä — isännöitsijäntodistus + tilinpäätös
- Yksittäinen kertaosto 14,90 € PDF-raportista — ei tilejä, ei kirjautumista
- PDF toimitetaan sähköpostiin liitteenä + pysyvä lataus-linkki

## Arkkitehtuuri

```
PDF upload
  → pdfExtractor              (pdf-parse, dynamic import)
  → normalizeText
  → llmExtractor              (Claude Haiku, 2-pass)
      Pass 1: talousluvut, koko, sijainti
      Pass 2: remonttihistoria rakenteistettuna
      Post: deduplicateCompletedRepairs (saman tyypin kirjaukset → viimeisin vuosi)
  → mergeService              (jos kaksi dokumenttia, deduplicateRenovations)
  → validationService         (bounds-tarkistus)
  → repairClassificationService (major / minor / unknown + REPAIR_WEIGHTS)
  → confidenceService         (0–1 painotettu kenttäläsnäolo)
  → scoringService            (buildingRiskModel + REPAIR_IMPACT + talouslogiikka)
  → db.analysisLog.create     (result_json + address tallennetaan paid=false-rivinä)
  → API response              (verdict, risk_score, monthly_cost, factors, red_flags, analysisId)

Paywall:
  POST /api/checkout          (analysisId + email → Stripe Checkout)
  POST /api/webhooks/stripe   (checkout.session.completed → atominen paid-flip
                               + suora PDF-render + Resend-email +
                               Idempotency-Key: analysis:<id>)
  POST /api/report            (stripe_session_id → PDF jos paid=true)
  GET  /api/checkout-status   (?session_id → polling hydratointiin)
```

## Teknologia

- **Next.js 15** App Router, TypeScript
- **Anthropic Claude Haiku** (`claude-haiku-4-5`) — LLM-ekstraktio
- **pdf-parse** — PDF-tekstin purku
- **Prisma + PostgreSQL** — analyysien kirjaus + maksutila
- **Stripe** — kertamaksu PDF-raportista, `stripe_session_id` toimii bearer-tokenina
- **Resend** — sähköpostitoimitus + uudelleenlatauslinkki
- **Upstash Redis** — per-IP rate-limit (valinnainen; ohitetaan jos puuttuu)
- **PM2 + Nginx** — tuotantodeploy Hetzner VPS:llä

## Käynnistys

```bash
cp .env.example .env.local
# täydennä muuttujat .env.local-tiedostoon

npm install
npx prisma db push    # synkronoi skeema DB:hen (luo/päivittää taulut)
npm run dev
```

Avaa http://localhost:3000

> **Skeemamuutokset:** projektissa ei ole `prisma/migrations/`-kansiota
> — `prisma db push` on kanonin komento sekä paikallisesti että prodia
> vasten. Aja se uudelleen skeemamuutoksen jälkeen.

## Ympäristömuuttujat

Pakolliset:

| Muuttuja | Kuvaus |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API-avain |
| `DATABASE_URL` | Postgres connection string |
| `DATABASE_URL_DIRECT` | Postgres connection ilman pgbouncer-poolia (Prisma db push:lle) |

Stripe-maksu + email (vaaditaan tuotannossa):

| Muuttuja | Kuvaus |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` dev:ssä, `sk_live_…` prodissa |
| `STRIPE_WEBHOOK_SECRET` | Stripe-webhook-allekirjoituksen salasana |
| `RESEND_API_KEY` | Resend API -avain PDF-raportin emailiin |
| `NEXT_PUBLIC_BASE_URL` | Sovelluksen julkinen URL (Stripe success/cancel URL + email-linkki) |

Valinnaiset:

| Muuttuja | Kuvaus |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Rate-limit (Upstash). Ei pakollinen — ratelimit ohitetaan jos puuttuu |
| `UPSTASH_REDIS_REST_TOKEN` | Pari `UPSTASH_REDIS_REST_URL`:lle |

## Riskilogiikka

Pisteet 0–10, lähtöpiste 5.

**Korottavat tekijät:**
- Putkiremontti puuttuu, rakennus yli 40v → +3
- Julkisivu puuttuu, rakennus yli 35v → +2
- Katto puuttuu, rakennus yli 30v → +1.5
- Iso remontti tulossa 5v sisällä → +2–2.5
- Korkea yhtiölaina → +1–2

**Alentavat tekijät:**
- Putkiremontti tehty → −3
- Julkisivu tehty → −2
- Katto tehty → −2
- (Ennen vuotta 2000 tehdyt remontit eivät laske pisteitä)

**Verdict:**
- ≥ 8 → ÄLÄ OSTA
- ≥ 6 → HARKITSE TARKKAAN
- < 6 → HYVÄ KOHDE

## Kehitysideat

- **Yhtiöjärjestyksen skannaus** — kolmas dokumenttityyppi isännöitsijäntodistuksen ja tilinpäätöksen rinnalle. Yhtiöjärjestyksestä voi poimia esim. lunastuslausekkeet, vuokrauskiellot, lemmikkirajoitukset ja muutostöiden rajoitukset — tekijöitä jotka vaikuttavat asunnon käytettävyyteen ja jälleenmyyntiarvoon mutta eivät näy talousasiakirjoissa.
