# Osallistumisohjeet

Kiitos kiinnostuksestasi Luukku AI:ta kohtaan!

## Kehitysympäristön pystytys

### Vaatimukset

- Node.js 20+
- Anthropic API -avain

### Asennus

```bash
git clone https://github.com/mikko-lab/luukku-ai.git
cd luukku-ai
npm install
cp .env.example .env.local
# täytä .env.local omilla arvoillasi
npx prisma migrate deploy
npm run dev
```

Avaa selaimessa `http://localhost:3000`.

## Miten voin osallistua?

### Bugiraportit

Avaa [Issue](https://github.com/mikko-lab/luukku-ai/issues) ja kuvaile:

- Mitä teit
- Mitä odotit tapahtuvan
- Mitä oikeasti tapahtui
- Node.js-versio ja käyttöjärjestelmä

### Ominaisuusehdotukset

Avaa Issue otsikolla `[feat]: ominaisuuden nimi`.

### Pull requestit

1. Forkkaa repositorio
2. Luo uusi haara: `git checkout -b feat/ominaisuuden-nimi`
3. Tee muutoksesi
4. Tarkista tyypit: `npx tsc --noEmit`
5. Tarkista lint: `npm run lint`
6. Commitoi selkeällä viestillä (ks. alla)
7. Avaa Pull Request `main`-haaraan

## Commit-viestikäytäntö

| Etuliite | Käyttötapaus |
|----------|-------------|
| `feat:`  | Uusi ominaisuus |
| `fix:`   | Bugikorjaus |
| `ci:`    | CI/CD-muutokset |
| `docs:`  | Dokumentaatiomuutokset |
| `refactor:` | Rakenteellinen muutos ilman toiminnallisia muutoksia |
| `chore:` | Ylläpitotehtävät |

## Tärkeää

- Älä koskaan commitoi `.db`-tiedostoja tai `.env.local`-tiedostoa
- `DATABASE_URL` tulee aina osoittaa absoluuttiseen polkuun
- Uudet Prisma-skeemamuutokset tehdään migraatioina: `npx prisma migrate dev --name kuvaus`

## Lisenssi

Osallistumalla hyväksyt, että muutoksesi julkaistaan [MIT-lisenssillä](LICENSE).
