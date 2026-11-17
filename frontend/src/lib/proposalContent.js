function normalizeSectionTitle(title) {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export const FIXED_PROPOSAL_SECTIONS = [
  {
    title: 'Responsabilidades do cliente',
    body: [
      '- Fornecer os acessos necessários ao código, banco de dados, loja e hospedagem;',
      '- Escolher o gateway de pagamento e disponibilizar as contas necessárias;',
      '- Definir, em conjunto, as regras de consumo e acesso;',
      '- Fornecer ou validar os textos jurídicos;',
      '- Aprovar entregas dentro dos prazos combinados;',
      '- Custear hospedagem (quando não contratada manutenção com o estúdio), inteligência artificial, gateway e outros serviços de terceiros;',
      '- Revogar chaves de API expostas e fornecer novas credenciais por canal seguro.',
    ].join('\n'),
  },
  {
    title: 'Itens não incluídos',
    body: [
      '- Custos de hospedagem, domínio, inteligência artificial e serviços de terceiros;',
      '- Taxas de transação e parcelamento do gateway;',
      '- Redação ou consultoria jurídica;',
      '- Publicação automática de conteúdo no Instagram ou integração com a API da Meta;',
      '- Novas funcionalidades não descritas no escopo;',
      '- Suporte e manutenção contínuos após a entrega;',
      '- Gestão de redes sociais, conteúdo ou campanhas de tráfego pago.',
      '',
      'Novas funcionalidades ou alterações de escopo poderão ser orçadas separadamente.',
    ].join('\n'),
  },
  {
    title: 'Critérios de aprovação',
    body: [
      'A entrega será considerada aprovada quando as funcionalidades previstas no escopo estiverem publicadas e testadas, o controle de acesso e consumo estiver validado, o fluxo de pagamento estiver testado conforme os recursos disponíveis do gateway e o cliente aprovar a versão final.',
      '',
      'A aprovação não substitui a validação jurídica dos textos legais nem a contratação dos serviços de terceiros necessários à operação.',
    ].join('\n'),
  },
  {
    title: 'Aceite',
    body: 'Sua aprovação confirma a concordância com o escopo, o investimento, as condições de pagamento e as responsabilidades descritas. A participação sobre assinaturas será detalhada em contrato.',
  },
];

export const MAINTENANCE_PLANS = [
  {
    name: 'Essencial',
    deliverables: [
      'Hospedagem e domínio inclusos',
      'Até 1 pequena alteração por mês',
      'Resposta em até 3 dias úteis',
    ],
    cashPriceCents: 124260,
    monthlyPriceCents: 10900,
  },
  {
    name: 'Profissional',
    deliverables: [
      'Hospedagem e domínio inclusos',
      'Até 3 pequenas alterações por mês',
      'Resposta em até 2 dias úteis',
    ],
    cashPriceCents: 270180,
    monthlyPriceCents: 23700,
  },
  {
    name: 'Avançado',
    deliverables: [
      'Hospedagem e domínio inclusos',
      'Até 5 pequenas alterações por mês',
      'SEO técnico básico e relatório',
    ],
    cashPriceCents: 433200,
    monthlyPriceCents: 38000,
  },
];

export function getFixedProposalSection(sectionOrTitle) {
  const title = typeof sectionOrTitle === 'string'
    ? sectionOrTitle
    : sectionOrTitle?.title;
  const normalizedTitle = normalizeSectionTitle(title);
  return FIXED_PROPOSAL_SECTIONS.find(
    (section) => normalizeSectionTitle(section.title) === normalizedTitle,
  );
}

export function normalizeProposalSections(sections = []) {
  const normalizedSections = [];
  const seenFixedSections = new Set();
  sections.forEach((section) => {
    const fixedSection = getFixedProposalSection(section);
    if (fixedSection) {
      if (seenFixedSections.has(fixedSection)) return;
      seenFixedSections.add(fixedSection);
      normalizedSections.push({ ...section, ...fixedSection, kind: 'text' });
      return;
    }
    normalizedSections.push(section);
  });

  FIXED_PROPOSAL_SECTIONS.forEach((fixedSection, fixedIndex) => {
    const exists = normalizedSections.some(
      (section) => getFixedProposalSection(section) === fixedSection,
    );
    if (exists) return;

    const nextFixedIndex = normalizedSections.findIndex((section) => {
      const existingFixedSection = getFixedProposalSection(section);
      return existingFixedSection
        && FIXED_PROPOSAL_SECTIONS.indexOf(existingFixedSection) > fixedIndex;
    });
    const insertionIndex = nextFixedIndex === -1
      ? normalizedSections.length
      : nextFixedIndex;
    normalizedSections.splice(insertionIndex, 0, {
      ...fixedSection,
      kind: 'text',
    });
  });

  return normalizedSections;
}
