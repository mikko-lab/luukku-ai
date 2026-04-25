# Luukku AI — Asuntoanalyysi

Lataa isännöitsijäntodistus ja/tai tilinpäätös, saat riskianalyysin muutamassa sekunnissa.

## Mitä se tekee

- Lukee PDF:n ja poimii talousluvut, remonttihistorian ja tulevat remontit
- Luokittelee remontit (putkiremontti, julkisivu, katto...) domain-logiikalla
- Laskee riskipisteen 0–10 ja antaa selkeän päätöksen: **ÄLÄ OSTA / HARKITSE TARKKAAN / HYVÄ KOHDE**
- Tukee kahden dokumentin yhdistämistä — isännöitsijäntodistus + tilinpäätös
- Generoi PDF-raportin välittäjälogolla
- Kirjautuminen ja analyysikredittijärjestelmä toimistotason käyttöön

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
  → db.$transaction           (kredit vähennetään + analysisLog kirjataan)
  → API response              (verdict, risk_score, monthly_cost, factors, red_flags)
```

## Teknologia

- **Next.js 15** App Router, TypeScript
- **Anthropic Claude Haiku** (`claude-haiku-4-5`) — LLM-ekstraktio
- **pdf-parse** — PDF-tekstin purku
- **Prisma + SQLite** — käyttäjähallinta ja analyysien kirjaus
- **bcryptjs + JWT** — autentikaatio, evästepohjaiset sessiot
- **PM2 + Nginx** — tuotantodeploy Hetzner VPS:llä

## Käynnistys

```bash
cp .env.example .env.local
# täydennä muuttujat .env.local-tiedostoon

npm install
npx prisma migrate deploy   # luo SQLite-tietokannan
npm run dev
```

Avaa http://localhost:3000

## Ympäristömuuttujat

| Muuttuja | Kuvaus |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API-avain |
| `DATABASE_URL` | Prisma SQLite-polku, esim. `file:/absoluuttinen/polku/prod.db` |
| `JWT_SECRET` | Vähintään 32-merkkinen satunnainen merkkijono sessiolle |
| `COOKIE_SECURE` | `true` HTTPS-tuotannossa, `false` HTTP:llä |

> **Huom DATABASE_URL:** käytä absoluuttista polkua — Prisma CLI ja Next.js runtime ratkaisevat suhteelliset polut eri hakemistoista.

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
