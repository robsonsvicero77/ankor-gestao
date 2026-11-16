const PDF_GREEN = '#047857';
const PDF_DARK = '#17211f';
const PDF_MUTED = '#596562';

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

function contentLines(body) {
  const nodes = [];
  let bullets = [];

  const flushBullets = () => {
    if (bullets.length) {
      nodes.push({
        ul: bullets,
        margin: [0, 0, 0, 9],
        color: PDF_DARK,
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
        color: PDF_DARK,
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

export function createProposalPdfDefinition(proposal) {
  const sections = proposal.content?.sections || [];
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
          [
            {
              text: [
                { text: 'INVESTIMENTO TOTAL\n', style: 'metaLabel' },
                { text: formatCurrency(proposal.amount_cents), style: 'amount' },
              ],
              colSpan: 2,
            },
            {},
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

  sections.forEach((section) => {
    const body = section.body?.trim() || '';
    if (!body && section.title.toLowerCase() !== 'investimento') return;

    content.push({ text: section.title, style: 'sectionHeading', keepWithNext: true });
    if (section.title.toLowerCase() === 'investimento') {
      content.push({
        text: `Investimento total: ${formatCurrency(proposal.amount_cents)}`,
        bold: true,
        color: PDF_GREEN,
        fontSize: 10,
        margin: [0, 0, 0, body ? 8 : 12],
      });
    }
    if (body) content.push(...contentLines(body));
  });

  if (proposal.content?.city) {
    content.push({
      text: `${proposal.content.city}, ${formatDate(proposal.issue_date)}`,
      color: PDF_MUTED,
      fontSize: 9,
      margin: [0, 22, 0, 0],
    });
  }

  return {
    pageSize: 'A4',
    pageMargins: [48, 62, 48, 54],
    defaultStyle: {
      font: 'Roboto',
      color: PDF_DARK,
    },
    header: {
      margin: [48, 24, 48, 0],
      columns: [
        { text: proposal.client_name || 'Proposta', color: PDF_GREEN, bold: true, fontSize: 8 },
        { text: formatDate(proposal.issue_date), alignment: 'right', color: PDF_MUTED, fontSize: 8 },
      ],
      columnGap: 12,
    },
    footer: (currentPage, pageCount) => ({
      margin: [48, 0, 48, 22],
      columns: [
        { text: `Proposta para ${proposal.client_name || 'cliente'}`, color: PDF_MUTED, fontSize: 8 },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', color: PDF_MUTED, fontSize: 8 },
      ],
    }),
    content,
    styles: {
      eyebrow: {
        color: PDF_GREEN,
        bold: true,
        fontSize: 8,
        characterSpacing: 1.6,
        margin: [0, 0, 0, 7],
      },
      title: {
        color: PDF_DARK,
        bold: true,
        fontSize: 23,
        lineHeight: 1.15,
        margin: [0, 0, 0, 14],
      },
      metaLabel: {
        color: PDF_MUTED,
        bold: true,
        fontSize: 7,
        characterSpacing: 0.8,
      },
      metaValue: {
        color: PDF_DARK,
        fontSize: 10,
        lineHeight: 1.4,
      },
      amount: {
        color: PDF_GREEN,
        bold: true,
        fontSize: 15,
      },
      sectionHeading: {
        color: PDF_DARK,
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
  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
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
  pdfMake.createPdf(createProposalPdfDefinition(proposal)).download(`${filename || 'proposta'}.pdf`);
}
