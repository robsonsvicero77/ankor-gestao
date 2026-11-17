import { createContractPdfDefinition } from './contractPdf';

beforeAll(() => {
  document.documentElement.style.setProperty('--brand-primary', '#5A0048');
  document.documentElement.style.setProperty('--text-primary', '#29212A');
  document.documentElement.style.setProperty('--text-secondary', '#665B66');
  document.documentElement.style.setProperty('--border-color', '#E8DDE5');
  document.documentElement.style.setProperty('--surface-alt', '#F3EBF0');
});

test('contract PDF preserves both parties, payment schedule, clauses, and logo', () => {
  const logoDataUrl = 'data:image/png;base64,cm9ic29u';
  const definition = createContractPdfDefinition({
    title: 'Contrato de UX Design',
    issue_date: '2026-03-01',
    start_date: '2026-03-05',
    end_date: '2026-04-05',
    total_amount_cents: 125000,
    client_snapshot: {
      person_type: 'PJ',
      name: 'Empresa Exemplo Ltda.',
      trade_name: 'Empresa Exemplo',
      document: '11222333000181',
      email: 'contato@example.com',
      phone: '11999999999',
      street: 'Rua Exemplo',
      number: '10',
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      postal_code: '01310100',
    },
    content: {
      service_types: ['UX Design'],
      object_description: 'Pesquisa e projeto de experiência.',
      scope: 'Mapeamento de jornadas\n- Protótipo navegável',
      deliverables: 'Relatório de descobertas',
      client_representative: 'Ana Silva',
      contract_city: 'São Paulo/SP',
      provider: {
        display_name: 'Prestador Exemplo',
        legal_name: 'Prestador Exemplo Ltda.',
        document: '11222333000181',
        address: 'Rua do Prestador, 20',
        representative_name: 'Roberto',
      },
      payment_schedule: [
        { description: 'Entrada', due_date: '2026-03-05', amount_cents: 50000 },
        { description: 'Entrega', due_date: '2026-04-05', amount_cents: 75000 },
      ],
      clauses: [
        { title: 'CLÁUSULA 1ª – DO OBJETO', body: 'Os serviços serão executados conforme escopo.' },
      ],
    },
  }, logoDataUrl);
  const serialized = JSON.stringify(definition);

  expect(serialized).toContain('Empresa Exemplo Ltda.');
  expect(serialized).toContain('Prestador Exemplo Ltda.');
  expect(serialized).toContain('Pesquisa e projeto de experiência.');
  expect(serialized).toContain('Entrada');
  expect(serialized).toContain('R$');
  expect(serialized).toContain('CLÁUSULA 1ª');
  expect(serialized).toContain('Ana Silva');
  expect(serialized).toContain('#5A0048');
  expect(serialized).toContain('#29212A');
  expect(serialized).not.toContain('#0052CC');
  expect(definition.header.columns[0].image).toBe(logoDataUrl);
});
