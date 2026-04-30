import type { HousingData } from "@/src/models/housingModel";
import { log } from "@/src/utils/logger";

const SERVICE = "populationService";

// 5-year population change % (2019→2024, source: Tilastokeskus StatFin)
// Positive = kasvava, negative = vähenevä
const POPULATION_TREND: Record<string, number> = {
  // Kasvukeskukset
  helsinki: 3.2,
  espoo: 4.1,
  vantaa: 3.8,
  tampere: 4.5,
  turku: 2.1,
  oulu: 3.9,
  jyvaskyla: 2.8,
  kuopio: 2.2,
  joensuu: 1.5,
  rovaniemi: 0.8,
  seinajoki: 1.9,
  vaasa: 1.4,
  jarvenpaa: 1.8,
  kerava: 1.2,
  sipoo: 3.1,
  nurmijarvi: 2.4,
  kirkkonummi: 2.2,
  tuusula: 1.9,
  ylivieska: 0.5,
  // Lievästi laskevat
  lahti: -0.3,
  hyvinkaa: -0.5,
  hameenlinna: -0.8,
  pori: -1.8,
  lappeenranta: -1.2,
  riihimaki: -1.1,
  rauma: -2.3,
  kajaani: -2.8,
  mikkeli: -3.1,
  // Merkittävästi laskevat
  kotka: -4.5,
  forssa: -4.7,
  raahe: -4.2,
  iisalmi: -3.9,
  harjavalta: -3.8,
  heinola: -5.1,
  // Vakavasti laskevat
  kouvola: -6.2,
  kemi: -6.4,
  imatra: -8.1,
  hapajarvi: -7.1,
  savonlinna: -7.8,
  varkaus: -8.5,
  outokumpu: -9.2,
  nurmes: -10.3,
  lieksa: -12.1,
  pieksamaki: -7.4,
  kuhmo: -11.2,
  suomussalmi: -13.5,
  viitasaari: -9.8,
  aanekoski: -4.1,
};

function normalize(city: string): string {
  return city
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z]/g, "");
}

export async function getPopulationData(data: HousingData): Promise<HousingData> {
  const city = data.location.city;

  if (!city) {
    log(SERVICE, "No city — skipping population check");
    return {
      ...data,
      population: { trend_5y: null, is_declining: null, municipality: null },
    };
  }

  const key = normalize(city);
  const trend = POPULATION_TREND[key] ?? null;

  log(
    SERVICE,
    `Population trend for "${city}": ${trend !== null ? `${trend > 0 ? "+" : ""}${trend}% (5v)` : "ei tietoa"}`
  );

  return {
    ...data,
    population: {
      trend_5y: trend,
      is_declining: trend !== null ? trend < -2 : null,
      municipality: city,
    },
  };
}
