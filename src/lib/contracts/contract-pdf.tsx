import "server-only";
import path from "node:path";
import { Circle, Document, Font, Page, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ContractData } from "@/lib/contracts/contract-data";
import { documentLabel, formatDocument } from "@/lib/documents";

// Contrato A4 na identidade do Guia Comercial, adaptada para impressão:
// faixa preta com a marca dourada no topo, corpo claro para leitura e
// rótulos dourados em caixa alta. Texto enxuto, cláusulas objetivas.

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Poppins",
    fonts: [
      { src: path.join(FONT_DIR, "Poppins-Light.ttf"), fontWeight: 300 },
      { src: path.join(FONT_DIR, "Poppins-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "Poppins-Medium.ttf"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "Poppins-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "Poppins-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const INK = "#0B0A08";
const GOLD = "#B8913F";
const GOLD_LIGHT = "#E9CD8C";
const TEXT = "#1C1A16";
const MUTED = "#6B655A";
const LINE = "#E6E0D4";
const SOFT = "#F7F4EE";

const s = StyleSheet.create({
  page: { fontFamily: "Poppins", fontSize: 8.6, color: TEXT, paddingTop: 34, paddingBottom: 46, lineHeight: 1.5 },
  band: { backgroundColor: INK, marginTop: -34, paddingHorizontal: 42, paddingTop: 26, paddingBottom: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { color: GOLD_LIGHT, fontSize: 13, fontWeight: 600, letterSpacing: 4 },
  bandTitle: { color: "#F5F0E6", fontSize: 17, fontWeight: 600, marginTop: 12, letterSpacing: -0.2 },
  bandMeta: { color: "#A69E8E", fontSize: 7.5, textAlign: "right", letterSpacing: 1.2 },
  body: { paddingHorizontal: 42, paddingTop: 18 },
  label: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, marginBottom: 6 },
  labelLine: { width: 16, height: 0.8, backgroundColor: GOLD },
  labelText: { color: GOLD, fontSize: 7, fontWeight: 600, letterSpacing: 2 },
  parties: { flexDirection: "row", gap: 10 },
  party: { flex: 1, borderWidth: 0.7, borderColor: LINE, borderRadius: 8, padding: 10 },
  partyRole: { fontSize: 6.8, color: MUTED, letterSpacing: 1.4, fontWeight: 500 },
  partyName: { fontSize: 9.6, fontWeight: 600, marginTop: 2 },
  small: { fontSize: 7.6, color: MUTED },
  table: { borderWidth: 0.7, borderColor: LINE, borderRadius: 8 },
  row: { flexDirection: "row", borderTopWidth: 0.7, borderTopColor: LINE, paddingVertical: 7, paddingHorizontal: 10 },
  rowFirst: { borderTopWidth: 0 },
  th: { fontSize: 6.8, color: MUTED, fontWeight: 600, letterSpacing: 1 },
  itemName: { fontSize: 9, fontWeight: 600 },
  money: { textAlign: "right", fontWeight: 500 },
  payBox: { backgroundColor: SOFT, borderRadius: 8, padding: 10, gap: 3 },
  clause: { marginBottom: 6 },
  clauseTitle: { fontSize: 8.4, fontWeight: 600, marginBottom: 1.5 },
  clauseText: { fontSize: 8.2, color: TEXT, textAlign: "justify" },
  signGrid: { flexDirection: "row", gap: 14, marginTop: 8 },
  signBox: { flex: 1, borderTopWidth: 0.8, borderTopColor: TEXT, paddingTop: 5 },
  footer: { position: "absolute", bottom: 18, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between", fontSize: 6.8, color: MUTED, letterSpacing: 1.2 },
});

function Mark({ size = 22 }: { size?: number }) {
  // Gradiente em traço não é suportado pelo react-pdf: dourado sólido.
  return (
    <Svg width={size * 1.66} height={size} viewBox="0 0 120 72">
      <Circle cx="36" cy="36" r="27" stroke={GOLD_LIGHT} strokeWidth={9} fill="none" />
      <Circle cx="84" cy="36" r="27" stroke="#C9A04E" strokeWidth={9} fill="none" />
    </Svg>
  );
}

function Label({ children }: { children: string }) {
  return (
    <View style={s.label} wrap={false}>
      <View style={s.labelLine} />
      <Text style={s.labelText}>{children.toUpperCase()}</Text>
    </View>
  );
}

function dateLong(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function buildClauses(d: ContractData): { title: string; text: string }[] {
  const clauses: { title: string; text: string }[] = [];
  const recurring = d.hasMonthly;
  const min = d.minMonths;

  clauses.push({
    title: "Objeto",
    text:
      "A CONTRATADA prestará ao CONTRATANTE os serviços descritos no Quadro de Serviços deste contrato, nos limites do escopo, das quantidades e das condições ali indicadas. " +
      "Demandas fora desse escopo serão orçadas à parte e só serão executadas após aprovação por escrito, inclusive por WhatsApp ou e-mail.",
  });

  const payParts = [
    "Os valores e a forma de pagamento são os indicados no Quadro de Investimento, já incluídas as taxas de cartão quando aplicáveis.",
  ];
  if (recurring)
    payParts.push(
      `A mensalidade vence todo dia ${d.paymentDay ?? 10} de cada mês, sendo a primeira devida na assinatura deste contrato, antes da primeira entrega ou diária de captação.`,
    );
  if (d.hasOneTime)
    payParts.push(
      d.currency === "BRL"
        ? "Os serviços pontuais têm início após a confirmação do pagamento ou da primeira parcela."
        : "Os serviços pontuais são pagos 50% na contratação, para início do projeto, e 50% na entrega.",
    );
  if (d.pixKey) payParts.push(`Pagamentos via Pix devem ser feitos para a chave ${d.pixKey}.`);
  clauses.push({ title: "Valores e pagamento", text: payParts.join(" ") });

  clauses.push({
    title: "Atraso e inadimplência",
    text:
      "O atraso no pagamento gera multa de 2% e juros de 1% ao mês, pro rata die, sobre o valor devido. Após 10 dias de atraso, a CONTRATADA poderá suspender os serviços até a regularização, " +
      "sem que isso altere prazos mínimos ou valores. Após 30 dias de atraso, a CONTRATADA poderá rescindir o contrato e cobrar os valores devidos, inclusive a multa da cláusula de cancelamento.",
  });

  clauses.push({
    title: "Vigência",
    text: recurring
      ? `Este contrato vigora a partir da assinatura${min ? `, com prazo mínimo de ${min} meses` : ""}. ${min ? "Após o prazo mínimo, renova-se" : "Renova-se"} automaticamente mês a mês, salvo aviso de qualquer das partes com 30 dias de antecedência.`
      : "Este contrato vigora a partir da assinatura até a entrega e aprovação dos serviços contratados.",
  });

  clauses.push({
    title: "Cancelamento",
    text: recurring
      ? `${min ? `Se o CONTRATANTE cancelar antes de completar o prazo mínimo de ${min} meses, pagará multa compensatória de 30% sobre a soma das mensalidades restantes até o fim desse prazo. ` : ""}` +
        "Em qualquer caso, são devidos os serviços já executados e as despesas já realizadas. A CONTRATADA pode rescindir em caso de descumprimento contratual, com aviso por escrito."
      : "Desistindo o CONTRATANTE após a assinatura, serão devidos os serviços já executados e as despesas realizadas, e 30% do valor total ficarão retidos a título de reserva de agenda e planejamento.",
  });

  clauses.push({
    title: "Execução, agenda e aprovações",
    text:
      (d.hasTravel
        ? "As diárias de captação são agendadas com no mínimo 5 dias úteis de antecedência. Remarcação pedida pelo CONTRATANTE com menos de 48 horas, ou ausência no dia, faz a diária ser considerada realizada, salvo caso fortuito comprovado. Diárias não utilizadas no mês não se acumulam. "
        : "") +
      "O CONTRATANTE fornecerá informações, acessos e materiais necessários em até 5 dias úteis da solicitação; atrasos do CONTRATANTE prorrogam os prazos da CONTRATADA na mesma medida. " +
      "Cada entrega admite até 2 rodadas de ajustes, solicitadas em até 5 dias úteis; sem manifestação nesse prazo, a entrega é considerada aprovada.",
  });

  const expenses = [];
  if (d.hasTravel) expenses.push("locomoção, hospedagem e alimentação da equipe para captações e eventos");
  if (d.hasAds) expenses.push("a verba de anúncios, paga diretamente pelo CONTRATANTE às plataformas");
  if (expenses.length)
    clauses.push({ title: "Despesas", text: `Correm por conta do CONTRATANTE ${expenses.join(" e ")}, que não estão incluídas nos valores deste contrato.` });

  clauses.push({
    title: "Direitos de uso e portfólio",
    text:
      "Quitados os valores, o CONTRATANTE recebe licença de uso do material final entregue para divulgação própria, por prazo indeterminado. Arquivos brutos e projetos editáveis permanecem com a CONTRATADA e só são cedidos mediante orçamento. " +
      "A CONTRATADA pode exibir o material em seu portfólio e redes, salvo pedido expresso de sigilo." +
      (d.hasImageCapture ? " O CONTRATANTE é responsável pelas autorizações de uso de imagem de pessoas e marcas que indicar para aparecer no conteúdo." : ""),
  });

  clauses.push({
    title: "Responsabilidades",
    text:
      "A CONTRATADA se compromete com a qualidade técnica e os prazos combinados, em obrigação de meio, sem garantia de resultados como alcance, seguidores ou vendas. " +
      "O CONTRATANTE responde pela veracidade das informações, produtos, ofertas e materiais de terceiros (músicas, marcas, imagens) que fornecer para uso.",
  });

  clauses.push({
    title: "Confidencialidade e dados pessoais",
    text:
      "As partes manterão sigilo sobre informações estratégicas e comerciais a que tiverem acesso. Dados pessoais serão tratados apenas para a execução deste contrato, nos termos da Lei 13.709/2018 (LGPD).",
  });

  clauses.push({
    title: "Disposições gerais",
    text:
      "Comunicações pelo WhatsApp e e-mail informados neste contrato valem como notificação formal. A tolerância a qualquer descumprimento não altera as condições aqui previstas. " +
      "As partes reconhecem a validade da assinatura eletrônica deste instrumento (MP 2.200-2/2001, art. 10, § 2º, e Lei 14.063/2020)." +
      (d.forum ? ` Fica eleito o foro da comarca de ${d.forum} para dirimir eventuais controvérsias.` : ""),
  });

  return clauses;
}

function ContractDocument({ d }: { d: ContractData }) {
  const money = (v: number) => new Intl.NumberFormat(d.currency === "USD" ? "en-US" : "pt-BR", { style: "currency", currency: d.currency }).format(v);
  const clauses = buildClauses(d);
  const kind = d.hasMonthly && d.hasOneTime ? "Recorrente + projeto" : d.hasMonthly ? "Serviço recorrente" : "Serviço pontual";
  const party = (p: ContractData["contratante"], role: string) => (
    <View style={s.party}>
      <Text style={s.partyRole}>{role}</Text>
      <Text style={s.partyName}>{p.name}</Text>
      {p.document && (
        <Text style={s.small}>
          {documentLabel(p.document)} {formatDocument(p.document)}
        </Text>
      )}
      {p.address && <Text style={s.small}>{p.address}</Text>}
      {(p.email || p.phone) && <Text style={s.small}>{[p.email, p.phone].filter(Boolean).join(" · ")}</Text>}
      {p.representative && (
        <Text style={s.small}>
          Representante: {p.representative}
          {p.representativeDoc ? ` · CPF ${p.representativeDoc}` : ""}
        </Text>
      )}
    </View>
  );

  return (
    <Document title={`Contrato ${d.code} · ${d.contratante.name}`} author={d.contratada.name} creator="LUMIBASE" language="pt-BR">
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed={false}>
          <View>
            <View style={s.brandRow}>
              <Mark />
              <Text style={s.brand}>LUMI</Text>
            </View>
            <Text style={s.bandTitle}>Contrato de prestação de serviços</Text>
          </View>
          <View>
            <Text style={s.bandMeta}>Nº {d.code}</Text>
            <Text style={s.bandMeta}>{kind.toUpperCase()}</Text>
            <Text style={s.bandMeta}>{dateLong(d.issuedAt).toUpperCase()}</Text>
          </View>
        </View>

        <View style={s.body}>
          <Label>Partes</Label>
          <View style={s.parties}>
            {party(d.contratada, "CONTRATADA")}
            {party(d.contratante, "CONTRATANTE")}
          </View>

          <Label>Quadro de serviços</Label>
          <View style={s.table}>
            <View style={[s.row, s.rowFirst]}>
              <Text style={[s.th, { flex: 1 }]}>SERVIÇO E ESCOPO</Text>
              <Text style={[s.th, { width: 90, textAlign: "right" }]}>VALOR (PIX)</Text>
            </View>
            {d.items.map((i, idx) => (
              <View key={idx} style={s.row} wrap={false}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={s.itemName}>
                    {i.quantity > 1 ? `${i.quantity} × ` : ""}
                    {i.name}
                  </Text>
                  {i.tagline && <Text style={s.small}>{i.tagline}</Text>}
                  {i.features.length > 0 && <Text style={[s.small, { color: TEXT, marginTop: 2 }]}>{i.features.join(" · ")}</Text>}
                  {i.terms && <Text style={[s.small, { marginTop: 2 }]}>Condições: {i.terms}</Text>}
                </View>
                <View style={{ width: 90 }}>
                  <Text style={s.money}>
                    {money(i.unitPrice * i.quantity)}
                    {i.billing === "MENSAL" ? "/mês" : ""}
                  </Text>
                  {i.monthlyFee ? <Text style={[s.small, { textAlign: "right" }]}>+ {money(i.monthlyFee * i.quantity)}/mês</Text> : null}
                </View>
              </View>
            ))}
          </View>

          <Label>Quadro de investimento</Label>
          <View style={s.payBox} wrap={false}>
            {d.quote.monthly && (
              <Text>
                <Text style={{ fontWeight: 600 }}>Mensalidade: </Text>
                {money(d.quote.monthly.pix)}/mês no Pix
                {d.quote.monthly.card != null ? ` ou ${money(d.quote.monthly.card + d.quote.monthly.pixOnly)}/mês no cartão` : ""}
                {d.minMonths ? ` · prazo mínimo de ${d.minMonths} meses` : ""}
                {d.paymentDay ? ` · vencimento todo dia ${d.paymentDay}` : ""}
              </Text>
            )}
            {d.quote.oneTime && (
              <Text>
                <Text style={{ fontWeight: 600 }}>Projeto: </Text>
                {money(d.quote.oneTime.pix)} à vista
                {d.quote.oneTime.credit.length > 1
                  ? ` ou até ${d.quote.oneTime.credit.at(-1)!.n}x de ${money(d.quote.oneTime.credit.at(-1)!.installment)} no cartão`
                  : ""}
              </Text>
            )}
            {d.quote.discountPercent > 0 && <Text style={s.small}>Inclui desconto de {d.quote.discountPercent}% concedido pela diretoria.</Text>}
            {d.paymentLines.length > 0 && (
              <Text style={{ marginTop: 3 }}>
                <Text style={{ fontWeight: 600, color: GOLD }}>Forma escolhida pelo CONTRATANTE: </Text>
                {d.paymentLines.join(" · ")}
              </Text>
            )}
            <Text style={[s.small, { marginTop: 2 }]}>{d.hasMonthly && d.minMonths ? "Valor total do contrato no período mínimo (base Pix)" : "Valor total do contrato (base Pix)"}: {money(d.quote.contractValue)}.</Text>
          </View>

          <Label>Cláusulas</Label>
          {clauses.map((c, idx) => (
            <View key={c.title} style={s.clause} wrap={false}>
              <Text style={s.clauseTitle}>
                {idx + 1}. {c.title}
              </Text>
              <Text style={s.clauseText}>{c.text}</Text>
            </View>
          ))}

          <View wrap={false}>
            <Label>Assinaturas</Label>
            <Text style={s.small}>
              As partes assinam eletronicamente pela plataforma Autentique; a página de assinaturas e a trilha de auditoria fazem parte deste documento.
            </Text>
            <View style={[s.signGrid, { marginTop: 28 }]}>
              <View style={s.signBox}>
                <Text style={{ fontWeight: 600 }}>{d.contratada.name}</Text>
                <Text style={s.small}>CONTRATADA{d.contratada.representative ? ` · ${d.contratada.representative}` : ""}</Text>
              </View>
              <View style={s.signBox}>
                <Text style={{ fontWeight: 600 }}>{d.contratante.name}</Text>
                <Text style={s.small}>CONTRATANTE{d.contratante.representative ? ` · ${d.contratante.representative}` : ""}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>LUMI · {d.contratada.name.toUpperCase()}</Text>
          <Text render={({ pageNumber, totalPages }) => `CONTRATO Nº ${d.code} · ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderContractPdf(data: ContractData): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ContractDocument d={data} />);
}
