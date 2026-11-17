import { formatCurrency, formatDate, getClientAddress } from './contractUtils';
import { getDesignColors } from './designColors';

async function loadContractLogo() {
  const logoUrl = `${process.env.PUBLIC_URL || ''}/logo_robsonsvicero.png`;
  const response = await fetch(logoUrl);
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o logo para o PDF (${response.status}).`);
  }

  const logoBlob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Não foi possível converter o logo para o PDF.'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => {
      reject(reader.error || new Error('Não foi possível converter o logo para o PDF.'));
    };
    reader.readAsDataURL(logoBlob);
  });
}

function contentLines(body, colors) {
  const nodes = [];
  let bullets = [];

  const flushBullets = () => {
    if (bullets.length) {
      nodes.push({
        ul: bullets,
        margin: [0, 0, 0, 9],
        color: colors.textPrimary,
        fontSize: 10,
        lineHeight: 1.3,
      });
      bullets = [];
    }
  };

  String(body || '').split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    const bullet = line.match(/^(?:[-*•])\s+(.+)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flushBullets();
    if (line) {
      nodes.push({
        text: line,
        margin: [0, 0, 0, 8],
        color: colors.textPrimary,
        fontSize: 10,
        lineHeight: 1.3,
      });
    } else {
      nodes.push({ text: ' ', margin: [0, 0, 0, 3] });
    }
  });
  flushBullets();
  return nodes;
}

function partyText(party, representative) {
  return [
    { text: party.name || '—', bold: true, fontSize: 10 },
    party.trade_name ? { text: `\nNome fantasia: ${party.trade_name}`, fontSize: 9 } : null,
    party.legal_name ? { text: `\nRazão social: ${party.legal_name}`, fontSize: 9 } : null,
    party.document ? { text: `\nCPF/CNPJ: ${party.document}`, fontSize: 9 } : null,
    getClientAddress(party) ? { text: `\nEndereço: ${getClientAddress(party)}`, fontSize: 9 } : null,
    party.phone ? { text: `\nTelefone: ${party.phone}`, fontSize: 9 } : null,
    party.email ? { text: `\nE-mail: ${party.email}`, fontSize: 9 } : null,
    representative ? { text: `\nRepresentante: ${representative}`, fontSize: 9 } : null,
  ].filter(Boolean);
}

export function createContractPdfDefinition(contract, logoDataUrl) {
  const colors = getDesignColors();
  const client = contract.client_snapshot || {};
  const content = contract.content || {};
  const provider = content.provider || {};
  const paymentSchedule = [...(content.payment_schedule || [])]
    .sort((left, right) => left.due_date.localeCompare(right.due_date));
  const paymentTotal = paymentSchedule.reduce((total, payment) => total + payment.amount_cents, 0);
  const serviceLabel = [
    ...(content.service_types || []).filter((service) => service !== 'Outro'),
    ...(content.service_types?.includes('Outro') && content.custom_service
      ? [content.custom_service]
      : []),
  ].join(', ');

  const body = [
    { text: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS', style: 'eyebrow' },
    { text: contract.title || 'Contrato de serviços', style: 'title' },
    {
      text: [
        'Pelo presente instrumento particular, as partes identificadas abaixo acordam a prestação dos serviços descritos neste contrato, conforme as cláusulas e condições a seguir.',
      ],
      color: colors.textPrimary,
      fontSize: 10,
      lineHeight: 1.35,
      margin: [0, 0, 0, 14],
    },
    {
      table: {
        widths: ['*', '*'],
        body: [[
          {
            stack: [
              { text: 'CONTRATANTE', style: 'metaLabel' },
              ...partyText(client, content.client_representative),
            ],
            margin: [0, 0, 12, 0],
          },
          {
            stack: [
              { text: 'CONTRATADA', style: 'metaLabel' },
              ...partyText({
                name: provider.display_name,
                legal_name: provider.legal_name,
                document: provider.document,
                street: provider.address,
                phone: provider.phone,
                email: provider.email,
              }, provider.representative_name),
            ],
          },
        ]],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 6,
        paddingBottom: () => 8,
      },
      margin: [0, 0, 0, 18],
    },
    {
      table: {
        widths: ['*', '*'],
        body: [
          [
            { text: [{ text: 'EMISSÃO\n', style: 'metaLabel' }, { text: formatDate(contract.issue_date), style: 'metaValue' }] },
            { text: [{ text: 'INÍCIO PREVISTO\n', style: 'metaLabel' }, { text: formatDate(contract.start_date), style: 'metaValue' }] },
          ],
          [
            { text: [{ text: 'TÉRMINO PREVISTO\n', style: 'metaLabel' }, { text: formatDate(contract.end_date), style: 'metaValue' }] },
            {
              text: [
                { text: 'VALOR TOTAL\n', style: 'metaLabel' },
                { text: formatCurrency(contract.total_amount_cents), style: 'amount' },
              ],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 12,
        paddingTop: () => 7,
        paddingBottom: () => 7,
      },
      margin: [0, 0, 0, 16],
    },
    { text: 'Objeto e escopo dos serviços', style: 'sectionHeading', keepWithNext: true },
    { text: `Serviços: ${serviceLabel || 'Serviço personalizado'}`, style: 'body' },
    ...contentLines(content.object_description, colors),
    ...contentLines(content.scope, colors),
  ];

  if (content.deliverables) {
    body.push({ text: 'Entregáveis', style: 'subheading', keepWithNext: true });
    body.push(...contentLines(content.deliverables, colors));
  }

  body.push({ text: 'Prazo e cronograma', style: 'sectionHeading', keepWithNext: true });
  body.push({
    text: `Início previsto: ${formatDate(contract.start_date)}${contract.end_date ? ` · Término previsto: ${formatDate(contract.end_date)}` : ''}`,
    style: 'body',
  });
  if (content.timeline_notes) body.push(...contentLines(content.timeline_notes, colors));

  body.push({ text: 'Investimento e forma de pagamento', style: 'sectionHeading', keepWithNext: true });
  body.push({
    table: {
      headerRows: 1,
      widths: ['*', 94, 110],
      body: [
        [
          { text: 'Descrição', style: 'tableHeader' },
          { text: 'Vencimento', style: 'tableHeader' },
          { text: 'Valor', style: 'tableHeader', alignment: 'right' },
        ],
        ...paymentSchedule.map((payment) => [
          { text: payment.description, style: 'tableCell' },
          { text: formatDate(payment.due_date), style: 'tableCell' },
          { text: formatCurrency(payment.amount_cents), style: 'tableCell', alignment: 'right' },
        ]),
        [
          { text: 'Total', style: 'tableTotal', colSpan: 2 },
          {},
          { text: formatCurrency(paymentTotal), style: 'tableTotal', alignment: 'right' },
        ],
      ],
    },
    layout: {
      hLineColor: () => colors.border,
      vLineColor: () => colors.border,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 7,
      paddingBottom: () => 7,
    },
    margin: [0, 0, 0, 16],
  });

  (content.clauses || []).forEach((clause) => {
    body.push({ text: clause.title, style: 'sectionHeading', keepWithNext: true });
    if (clause.body?.trim()) body.push(...contentLines(clause.body, colors));
  });

  if (content.contract_city) {
    body.push({
      text: `${content.contract_city}, ${formatDate(contract.issue_date)}`,
      color: colors.textSecondary,
      fontSize: 9,
      margin: [0, 18, 0, 12],
    });
  }

  body.push({
    text: 'E, por estarem de acordo, as partes assinam o presente instrumento.',
    style: 'body',
    margin: [0, 8, 0, 4],
  });
  body.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: 'CONTRATANTE', style: 'signatureLabel' },
          { text: '\n\n____________________________________', alignment: 'center', color: colors.textSecondary },
          { text: client.name || 'Contratante', style: 'signatureName', alignment: 'center' },
          { text: client.document ? `CPF/CNPJ: ${client.document}` : '', style: 'signatureMeta', alignment: 'center' },
        ],
      },
      {
        width: '*',
        stack: [
          { text: 'CONTRATADA', style: 'signatureLabel' },
          { text: '\n\n____________________________________', alignment: 'center', color: colors.textSecondary },
          { text: provider.display_name || 'Contratada', style: 'signatureName', alignment: 'center' },
          { text: provider.document ? `CPF/CNPJ: ${provider.document}` : '', style: 'signatureMeta', alignment: 'center' },
        ],
      },
    ],
    columnGap: 24,
    margin: [0, 20, 0, 0],
  });

  return {
    pageSize: 'A4',
    pageMargins: [48, 96, 48, 54],
    defaultStyle: {
      font: 'Roboto',
      color: colors.textPrimary,
    },
    header: {
      margin: [48, 16, 48, 0],
      columns: [
        { image: logoDataUrl, fit: [64, 64] },
        {
          width: '*',
          stack: [
            { text: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS', color: colors.brandPrimary, bold: true, fontSize: 8 },
            { text: contract.title || 'Contrato', color: colors.textSecondary, fontSize: 8, margin: [0, 4, 0, 0] },
            { text: client.name || 'Contratante', color: colors.textSecondary, fontSize: 8, margin: [0, 3, 0, 0] },
          ],
          alignment: 'right',
        },
      ],
      columnGap: 12,
    },
    footer: (currentPage, pageCount) => ({
      margin: [48, 0, 48, 22],
      columns: [
        { text: `Contrato para ${client.name || 'cliente'}`, color: colors.textSecondary, fontSize: 8 },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', color: colors.textSecondary, fontSize: 8 },
      ],
    }),
    content: body,
    styles: {
      eyebrow: {
        color: colors.brandPrimary,
        bold: true,
        fontSize: 8,
        characterSpacing: 1.6,
        margin: [0, 0, 0, 7],
      },
      title: {
        color: colors.textPrimary,
        bold: true,
        fontSize: 22,
        lineHeight: 1.15,
        margin: [0, 0, 0, 12],
      },
      metaLabel: {
        color: colors.textSecondary,
        bold: true,
        fontSize: 7,
        characterSpacing: 0.8,
        margin: [0, 0, 0, 4],
      },
      metaValue: {
        color: colors.textPrimary,
        fontSize: 10,
        lineHeight: 1.4,
      },
      amount: {
        color: colors.brandPrimary,
        bold: true,
        fontSize: 14,
      },
      sectionHeading: {
        color: colors.textPrimary,
        bold: true,
        fontSize: 12,
        margin: [0, 8, 0, 8],
      },
      subheading: {
        color: colors.textPrimary,
        bold: true,
        fontSize: 10,
        margin: [0, 4, 0, 6],
      },
      body: {
        color: colors.textPrimary,
        fontSize: 10,
        lineHeight: 1.3,
        margin: [0, 0, 0, 8],
      },
      tableHeader: {
        color: colors.textPrimary,
        bold: true,
        fontSize: 9,
        fillColor: colors.surfaceAlt,
      },
      tableCell: {
        color: colors.textPrimary,
        fontSize: 9,
      },
      tableTotal: {
        color: colors.brandPrimary,
        bold: true,
        fontSize: 10,
      },
      signatureLabel: {
        color: colors.textSecondary,
        bold: true,
        fontSize: 8,
        alignment: 'center',
      },
      signatureName: {
        color: colors.textPrimary,
        bold: true,
        fontSize: 9,
        margin: [0, 4, 0, 0],
      },
      signatureMeta: {
        color: colors.textSecondary,
        fontSize: 8,
      },
    },
  };
}

export async function downloadContractPdf(contract) {
  const [pdfMakeModule, pdfFontsModule, logoDataUrl] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
    loadContractLogo(),
  ]);
  const pdfMake = pdfMakeModule.default || pdfMakeModule;
  const pdfFonts = pdfFontsModule.default || pdfFontsModule;
  pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts;

  const filename = `${contract.title || 'contrato'}-${contract.client_snapshot?.name || 'cliente'}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  pdfMake.createPdf(createContractPdfDefinition(contract, logoDataUrl))
    .download(`${filename || 'contrato'}.pdf`);
}
