# Muutosloki

Kaikki merkittävät muutokset dokumentoidaan tähän tiedostoon.

Formaatti perustuu [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) -käytäntöön,
ja projekti noudattaa [semanttista versiointia](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-05-03

### Lisätty
- PDF-purku ja tekstin normalisointi (pdf-parse)
- Claude Haiku -ekstraktio kaksivaiheisella promptilla (talousluvut + remonttihistoria)
- Remonttien deduplikointi ja luokittelu (major / minor / unknown)
- Kahden dokumentin yhdistäminen (isännöitsijäntodistus + tilinpäätös)
- Riskilogiikka 0–10 pisteasteikolla (putkiremontti, julkisivu, katto, yhtiölaina)
- Verdict-päätös: ÄLÄ OSTA / HARKITSE TARKKAAN / HYVÄ KOHDE
- PDF-raportin generointi välittäjälogolla
- Kirjautuminen ja analyysikredittijärjestelmä (bcryptjs + JWT)
- Next.js 15 App Router, Prisma + SQLite
- PM2 + Nginx -tuotantodeploy
- GitHub Actions CI (TypeScript typecheck + lint)

[Unreleased]: https://github.com/mikko-lab/luukku-ai/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mikko-lab/luukku-ai/releases/tag/v1.0.0
