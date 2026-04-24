import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { AnalysisResult } from "@/types/analysis";

const CONFIDENCE_FI: Record<string, string> = {
  high: "varma",
  medium: "epävarma",
  low: "alustava",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1F2937",
    lineHeight: 1.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  productName: {
    fontSize: 9,
    color: "#6B7280",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  address: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  date: {
    fontSize: 9,
    color: "#9CA3AF",
    textAlign: "right",
  },
  verdictBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  verdictLabel: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  verdictText: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
  },
  verdictScore: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#9CA3AF",
    marginBottom: 8,
  },
  section: {
    marginBottom: 20,
  },
  columns: {
    flexDirection: "row",
    gap: 16,
  },
  column: {
    flex: 1,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 6,
  },
  tableLabel: {
    width: "50%",
    color: "#6B7280",
  },
  tableValue: {
    width: "50%",
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  repairRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  repairType: {
    color: "#374151",
  },
  repairYear: {
    color: "#6B7280",
  },
  badge: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flagRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
  },
  flagBullet: {
    color: "#EF4444",
    width: 10,
  },
  flagText: {
    flex: 1,
    color: "#374151",
  },
  disclaimer: {
    marginTop: "auto",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    fontSize: 8,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 1.6,
  },
});

function verdictColors(verdict: AnalysisResult["verdict"]) {
  if (verdict === "ÄLÄ OSTA") return { bg: "#FEF2F2", text: "#DC2626" };
  if (verdict === "HARKITSE TARKKAAN") return { bg: "#FEFCE8", text: "#CA8A04" };
  return { bg: "#F0FDF4", text: "#16A34A" };
}

interface Props {
  result: AnalysisResult;
  address: string;
  brokerLogo?: string;
}

export function ReportPDF({ result, address, brokerLogo }: Props) {
  const colors = verdictColors(result.verdict);
  const e = result.extracted;
  const today = new Date().toLocaleDateString("fi-FI");
  const knownUpcoming = result.upcoming_repairs.filter((r) => r.type !== "other");

  return (
    <Document
      title={`Luukku AI Analyysi – ${address}`}
      author="Luukku AI"
      subject="Asuntoanalyysi"
    >
      <Page style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.productName}>Luukku AI — Asuntoanalyysi</Text>
            <Text style={styles.address}>{address || "Kohde"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {brokerLogo && (
              <Image src={brokerLogo} style={{ height: 28, objectFit: "contain", marginBottom: 4 }} />
            )}
            <Text style={styles.date}>{today}</Text>
          </View>
        </View>

        {/* Verdict */}
        <View style={[styles.verdictBox, { backgroundColor: colors.bg }]}>
          <View>
            <Text style={[styles.verdictLabel, { color: colors.text }]}>Riskiarvio</Text>
            <Text style={[styles.verdictText, { color: colors.text }]}>{result.verdict}</Text>
            <Text style={{ fontSize: 9, color: colors.text, marginTop: 2 }}>
              Luotettavuus {Math.round(result.confidence * 100)}%
            </Text>
          </View>
          <Text style={[styles.verdictScore, { color: colors.text }]}>{result.risk_score}/10</Text>
        </View>

        {/* Taloustiedot + Remontit rinnakkain */}
        <View style={styles.columns}>
          {/* Taloustiedot */}
          <View style={[styles.section, styles.column]}>
            <Text style={styles.sectionTitle}>Taloustiedot</Text>
            {[
              ["Hoitovastike", e.maintenance_fee_monthly != null ? `${e.maintenance_fee_monthly.toLocaleString("fi-FI")} €/kk` : null],
              ["Rahoitusvastike", e.financing_fee_monthly != null ? `${e.financing_fee_monthly.toLocaleString("fi-FI")} €/kk` : null],
              ["Laina/osake", e.loan_per_share != null ? `${e.loan_per_share.toLocaleString("fi-FI")} €` : null],
              ["Laina/m²", e.loan_per_m2 != null ? `${e.loan_per_m2.toLocaleString("fi-FI")} €/m²` : null],
              ["Yhtiölaina yht.", e.housing_company_debt_total != null ? `${e.housing_company_debt_total.toLocaleString("fi-FI")} €` : null],
              ["Korjausrahasto", e.repair_fund != null ? `${e.repair_fund.toLocaleString("fi-FI")} €` : null],
              ["Arvioitu kuukausikulu", `${result.monthly_cost.toLocaleString("fi-FI")} €/kk`],
            ]
              .filter(([, v]) => v != null)
              .map(([label, value]) => (
                <View key={label as string} style={styles.tableRow}>
                  <Text style={styles.tableLabel}>{label}</Text>
                  <Text style={styles.tableValue}>{value}</Text>
                </View>
              ))}
          </View>

          {/* Remontit */}
          <View style={[styles.section, styles.column]}>
            {e.last_major_renovations.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Tehdyt remontit</Text>
                {e.last_major_renovations.map((r, i) => (
                  <View key={i} style={styles.repairRow}>
                    <Text style={styles.repairType}>{r.type}</Text>
                    <Text style={styles.repairYear}>{r.year ?? "—"}</Text>
                  </View>
                ))}
              </>
            )}

            {knownUpcoming.length > 0 && (
              <View style={{ marginTop: e.last_major_renovations.length > 0 ? 12 : 0 }}>
                <Text style={styles.sectionTitle}>Tulevat remontit</Text>
                {knownUpcoming.map((r, i) => (
                  <View key={i} style={styles.repairRow}>
                    <Text style={styles.repairType}>{r.type}</Text>
                    <Text style={styles.repairYear}>
                      {r.planned_year ?? "—"} · {CONFIDENCE_FI[r.confidence] ?? r.confidence}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Huomiot */}
        {result.red_flags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Huomiot</Text>
            {result.red_flags.map((flag, i) => (
              <View key={i} style={styles.flagRow}>
                <Text style={styles.flagBullet}>▲</Text>
                <Text style={styles.flagText}>{flag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text>
            Tämä raportti on generoitu automaattisesti Luukku AI -analyysityökalulla päätöksenteon tueksi.
            Se perustuu annettuihin dokumentteihin eikä korvaa asiantuntijan tekemää kuntotarkastusta.
            Varmista tiedot aina alkuperäisistä dokumenteista ennen päätöksentekoa.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
