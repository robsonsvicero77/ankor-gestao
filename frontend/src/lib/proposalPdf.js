import { getDesignColors } from './designColors';
import {
  MAINTENANCE_PLANS,
  normalizeProposalSections,
} from './proposalContent';

async function loadProposalLogo() {
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

function formatCurrency(cents) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((cents || 0) / 100);
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
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

function normalizeSectionTitle(title) {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isFinancialSection(section) {
  return section.kind === 'financial'
    || ['investimento', 'condicoes de pagamento'].includes(normalizeSectionTitle(section.title));
}

function financialSectionContent(proposal, sections, colors) {
  const notes = sections.map((section) => {
    const body = section.body?.trim() || '';
    if (!body) return '';

    if (section.kind !== 'financial') {
      const title = normalizeSectionTitle(section.title);
      if (title === 'investimento') return `Observações sobre investimento:\n${body}`;
      if (title === 'condicoes de pagamento') return `Condições de pagamento:\n${body}`;
    }

    return body;
  }).filter(Boolean).join('\n\n');
  const nodes = [
    { text: 'Investimento total', color: colors.textSecondary, fontSize: 9, margin: [0, 0, 0, 3] },
    {
      text: formatCurrency(proposal.amount_cents),
      bold: true,
      color: colors.brandPrimary,
      fontSize: 15,
      margin: [0, 0, 0, 12],
    },
  ];
  const payments = proposal.content?.payment_schedule || [];

  if (payments.length) {
    nodes.push({
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto'],
        body: [
          [
            { text: 'PARCELA', style: 'paymentTableHeader' },
            { text: 'VENCIMENTO', style: 'paymentTableHeader' },
            { text: 'VALOR', style: 'paymentTableHeader', alignment: 'right' },
          ],
          ...payments.map((payment) => [
            { text: payment.description, color: colors.textPrimary },
            { text: formatDate(payment.due_date), color: colors.textPrimary },
            { text: formatCurrency(payment.amount_cents), color: colors.textPrimary, alignment: 'right' },
          ]),
        ],
      },
      layout: {
        fillColor: (rowIndex) => (rowIndex === 0 ? colors.surfaceAlt : null),
        hLineColor: () => colors.border,
        vLineWidth: () => 0,
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 7,
        paddingBottom: () => 7,
      },
      fontSize: 9,
      margin: [0, 0, 0, notes ? 12 : 0],
    });
  }

  if (notes) nodes.push(...contentLines(notes, colors));
  return nodes;
}

function maintenancePlanContent(colors) {
  return [
    {
      text: 'Opcional: Planos de Manutenção e Suporte Contínuo (Sem Compromisso)',
      style: 'sectionHeading',
      keepWithNext: true,
    },
    {
      text: 'A configuração inicial e o domínio já estão totalmente inclusos no valor do projeto acima.',
      italics: true,
      color: colors.textSecondary,
      fontSize: 9,
      margin: [0, 0, 0, 4],
    },
    {
      text: 'Caso deseje contar com suporte técnico contínuo, ajustes recorrentes e atualizações de segurança após a entrega, apresentamos abaixo nossos planos opcionais, sem qualquer obrigação de contratação imediata:',
      italics: true,
      color: colors.textSecondary,
      fontSize: 9,
      lineHeight: 1.3,
      margin: [0, 0, 0, 12],
    },
    {
      table: {
        headerRows: 1,
        keepWithHeaderRows: 1,
        dontBreakRows: true,
        widths: [90, '*', '*', '*'],
        body: [
          [
            { text: 'PLANO', style: 'paymentTableHeader' },
            ...MAINTENANCE_PLANS.map((plan) => ({
              text: plan.name.toLocaleUpperCase('pt-BR'),
              style: 'paymentTableHeader',
            })),
          ],
          [
            { text: 'Entregáveis', bold: true, color: colors.textPrimary },
            ...MAINTENANCE_PLANS.map((plan) => ({
              ul: plan.deliverables,
              color: colors.textPrimary,
            })),
          ],
          [
            { text: 'Total à vista (5% de desconto)', bold: true, color: colors.textPrimary },
            ...MAINTENANCE_PLANS.map((plan) => ({
              text: formatCurrency(plan.cashPriceCents),
              color: colors.textPrimary,
            })),
          ],
          [
            { text: 'Total a prazo (12x)', bold: true, color: colors.textPrimary },
            ...MAINTENANCE_PLANS.map((plan) => ({
              text: `${formatCurrency(plan.monthlyPriceCents)} / mês`,
              color: colors.textPrimary,
            })),
          ],
        ],
      },
      layout: {
        fillColor: (rowIndex) => (rowIndex === 0 ? colors.surfaceAlt : null),
        hLineColor: () => colors.border,
        vLineColor: () => colors.border,
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 7,
        paddingBottom: () => 7,
      },
      fontSize: 8,
    },
  ];
}

export function createProposalPdfDefinition(proposal, logoDataUrl) {
  const colors = getDesignColors();
  const sections = normalizeProposalSections(proposal.content?.sections || []);
  const financialSections = sections.filter(isFinancialSection);
  const provider = proposal.content?.provider || {};
  const providerContact = [
    provider.display_name,
    provider.legal_name,
    provider.document,
    provider.email,
    provider.phone,
  ].filter(Boolean).join(' · ');
  const content = [
    { text: 'PROPOSTA COMERCIAL', style: 'eyebrow' },
    { text: proposal.title || 'Proposta', style: 'title' },
    {
      table: {
        widths: ['*', '*'],
        body: [
          [
            { text: [{ text: 'CLIENTE\n', style: 'metaLabel' }, { text: proposal.client_name || '—', style: 'metaValue' }] },
            { text: [{ text: 'CONTATO\n', style: 'metaLabel' }, { text: proposal.contact_name || '—', style: 'metaValue' }] },
          ],
          [
            { text: [{ text: 'EMISSÃO\n', style: 'metaLabel' }, { text: formatDate(proposal.issue_date) || '—', style: 'metaValue' }] },
            { text: [{ text: 'VALIDADE\n', style: 'metaLabel' }, { text: formatDate(proposal.valid_until) || '—', style: 'metaValue' }] },
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
      margin: [0, 8, 0, 24],
    },
  ];

  let financialRendered = false;
  sections.forEach((section) => {
    if (isFinancialSection(section)) {
      if (!financialRendered) {
        const title = financialSections.find((item) => item.kind === 'financial')?.title
          || 'Investimento e formas de pagamento';
        content.push({ text: title, style: 'sectionHeading', keepWithNext: true });
        content.push(...financialSectionContent(proposal, financialSections, colors));
        financialRendered = true;
      }
      return;
    }

    const body = section.body?.trim() || '';
    if (!body) return;

    content.push({ text: section.title, style: 'sectionHeading', keepWithNext: true });
    content.push(...contentLines(body, colors));
  });

  if (!financialRendered) {
    content.push({
      text: 'Investimento e formas de pagamento',
      style: 'sectionHeading',
      keepWithNext: true,
    });
    content.push(...financialSectionContent(proposal, [], colors));
  }

  content.push(...maintenancePlanContent(colors));

  if (proposal.content?.city) {
    content.push({
      text: `${proposal.content.city}, ${formatDate(proposal.issue_date)}`,
      color: colors.textSecondary,
      fontSize: 9,
      margin: [0, 22, 0, 0],
    });
  }

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
            { text: 'PROPOSTA COMERCIAL', color: colors.brandPrimary, bold: true, fontSize: 8 },
            { text: proposal.client_name || 'Proposta', color: colors.textSecondary, fontSize: 8, margin: [0, 4, 0, 0] },
            { text: formatDate(proposal.issue_date), color: colors.textSecondary, fontSize: 8, margin: [0, 3, 0, 0] },
          ],
          alignment: 'right',
        },
      ],
      columnGap: 12,
    },
    footer: (currentPage, pageCount) => ({
      margin: [48, 0, 48, 22],
      columns: [
        {
          text: [
            `Proposta para ${proposal.client_name || 'cliente'}`,
            providerContact,
          ].filter(Boolean).join(' · '),
          color: colors.textSecondary,
          fontSize: 7,
        },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', color: colors.textSecondary, fontSize: 8 },
      ],
    }),
    content,
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
        fontSize: 23,
        lineHeight: 1.15,
        margin: [0, 0, 0, 14],
      },
      metaLabel: {
        color: colors.textSecondary,
        bold: true,
        fontSize: 7,
        characterSpacing: 0.8,
      },
      metaValue: {
        color: colors.textPrimary,
        fontSize: 10,
        lineHeight: 1.4,
      },
      paymentTableHeader: {
        color: colors.textSecondary,
        bold: true,
        fontSize: 7,
        characterSpacing: 0.4,
      },
      sectionHeading: {
        color: colors.textPrimary,
        bold: true,
        fontSize: 12,
        margin: [0, 8, 0, 8],
      },
    },
    pageBreakBefore(currentNode, followingNodesOnPage) {
      return currentNode.style === 'sectionHeading'
        && followingNodesOnPage.length === 0;
    },
  };
}

export async function downloadProposalPdf(proposal) {
  const [pdfMakeModule, pdfFontsModule, logoDataUrl] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
    loadProposalLogo(),
  ]);
  const pdfMake = pdfMakeModule.default || pdfMakeModule;
  const pdfFonts = pdfFontsModule.default || pdfFontsModule;
  pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts;

  const filename = `${proposal.title || 'proposta'}-${proposal.client_name || 'cliente'}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  pdfMake.createPdf(createProposalPdfDefinition(proposal, logoDataUrl)).download(`${filename || 'proposta'}.pdf`);
}
