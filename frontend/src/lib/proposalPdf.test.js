import { createProposalPdfDefinition } from './proposalPdf';

beforeAll(() => {
  document.documentElement.style.setProperty('--brand-primary', '#5A0048');
  document.documentElement.style.setProperty('--text-primary', '#29212A');
  document.documentElement.style.setProperty('--text-secondary', '#665B66');
  document.documentElement.style.setProperty('--border-color', '#E8DDE5');
  document.documentElement.style.setProperty('--surface-alt', '#F3EBF0');
});

test('proposal PDF definition includes client, dates, investment and section text', () => {
  const logoDataUrl = 'data:image/png;base64,cm9ic29u';
  const definition = createProposalPdfDefinition({
    title: 'Plano de atendimento',
    client_name: 'Cliente Exemplo',
    contact_name: 'Ana',
    issue_date: '2026-03-01',
    valid_until: '2026-03-31',
    amount_cents: 750000,
    content: {
      city: 'São Paulo',
      provider: {
        display_name: 'Estúdio Exemplo',
        legal_name: 'Estúdio Exemplo Ltda.',
        document: '12.345.678/0001-90',
        email: 'contato@example.com',
      },
      sections: [
        { title: 'Objetivos', body: 'Aumentar alcance\n• Melhorar conversão' },
        { title: 'Investimento', body: '' },
      ],
    },
  }, logoDataUrl);
  const serialized = JSON.stringify(definition);
  const footer = JSON.stringify(definition.footer(1, 1));

  expect(serialized).toContain('Cliente Exemplo');
  expect(serialized).toContain('01/03/2026');
  expect(serialized).toContain('R$');
  expect(serialized).toContain('Aumentar alcance');
  expect(serialized).toContain('Melhorar conversão');
  expect(serialized).toContain('São Paulo');
  expect(footer).toContain('Estúdio Exemplo Ltda.');
  expect(footer).toContain('contato@example.com');
  expect(definition.header.columns[0].image).toBe(logoDataUrl);
  expect(serialized).toContain('#5A0048');
  expect(serialized).toContain('#29212A');
  expect(serialized).not.toContain('#0052CC');
  expect(serialized).not.toContain('#047857');
});

test('proposal PDF groups investment notes and scheduled payments', () => {
  const definition = createProposalPdfDefinition({
    title: 'Identidade visual',
    client_name: 'Cliente Exemplo',
    issue_date: '2026-03-01',
    valid_until: '2026-03-31',
    amount_cents: 100000,
    content: {
      payment_schedule: [
        {
          description: 'Entrada',
          due_date: '2026-03-05',
          amount_cents: 40000,
        },
        {
          description: 'Entrega',
          due_date: '2026-03-31',
          amount_cents: 60000,
        },
      ],
      sections: [
        { title: 'Investimento', body: 'Valor sujeito à aprovação final.' },
        { title: 'Condições de pagamento', body: 'Pagamento por transferência.' },
        { title: 'Aceite', body: 'Aprovação por e-mail.' },
      ],
    },
  }, 'data:image/png;base64,cm9ic29u');
  const serialized = JSON.stringify(definition);

  expect(serialized).toContain('Investimento e formas de pagamento');
  expect(serialized).toContain('1.000,00');
  expect(serialized).toContain('Entrada');
  expect(serialized).toContain('05/03/2026');
  expect(serialized).toContain('Valor sujeito à aprovação final.');
  expect(serialized).toContain('Pagamento por transferência.');
  expect(serialized.match(/Investimento e formas de pagamento/g)).toHaveLength(1);
});

test('proposal PDF always includes fixed clauses and optional maintenance plans after acceptance', () => {
  const definition = createProposalPdfDefinition({
    title: 'Projeto web',
    client_name: 'Cliente Exemplo',
    issue_date: '2026-03-01',
    valid_until: '2026-03-31',
    amount_cents: 100000,
    content: {
      sections: [
        { title: 'Itens não incluídos', body: 'Texto antigo editável.' },
        { title: 'Aceite', body: '' },
      ],
    },
  }, 'data:image/png;base64,cm9ic29u');
  const serialized = JSON.stringify(definition);

  expect(serialized).toContain('Fornecer os acessos necessários ao código, banco de dados, loja e hospedagem;');
  expect(serialized).toContain('Novas funcionalidades ou alterações de escopo poderão ser orçadas separadamente.');
  expect(serialized).toContain('A aprovação não substitui a validação jurídica dos textos legais');
  expect(serialized).toContain('Sua aprovação confirma a concordância com o escopo');
  expect(serialized).not.toContain('Texto antigo editável.');
  expect(serialized).toContain('Opcional: Planos de Manutenção e Suporte Contínuo (Sem Compromisso)');
  expect(serialized).toContain('ESSENCIAL');
  expect(serialized).toContain('PROFISSIONAL');
  expect(serialized).toContain('AVANÇADO');
  expect(serialized).toContain('Até 1 pequena alteração por mês');
  expect(serialized).toContain('Resposta em até 3 dias úteis');
  expect(serialized).toContain('Até 3 pequenas alterações por mês');
  expect(serialized).toContain('Resposta em até 2 dias úteis');
  expect(serialized).toContain('SEO técnico básico e relatório');
  expect(serialized).toContain('1.242,60');
  expect(serialized).toContain('109,00 / mês');
  expect(serialized).toContain('2.701,80');
  expect(serialized).toContain('237,00 / mês');
  expect(serialized).toContain('4.332,00');
  expect(serialized).toContain('380,00 / mês');
  expect(serialized.indexOf('Aceite')).toBeLessThan(serialized.indexOf('Opcional: Planos de Manutenção'));
});
