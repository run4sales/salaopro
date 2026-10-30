import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sales = readFileSync(new URL('../src/pages/Sales.tsx', import.meta.url), 'utf8');
const staff = readFileSync(new URL('../src/pages/StaffUsers.tsx', import.meta.url), 'utf8');
const editUser = readFileSync(new URL('../src/components/users/EditUserDialog.tsx', import.meta.url), 'utf8');
const updateFn = readFileSync(new URL('../supabase/functions/update-staff-user/index.ts', import.meta.url), 'utf8');

test('PDV carrega tipo e estoque e separa serviços de produtos em abas', () => {
  assert.match(sales, /select\("id, name, price, commission_solo, kind, stock_quantity"\)/);
  assert.match(sales, /catalogTab === "product"/);
  assert.match(sales, /Serviços \(\{catalogCounts\.service\}\)/);
  assert.match(sales, /Produtos \(\{catalogCounts\.product\}\)/);
});

test('PDV impede venda de produto sem estoque ou acima do estoque', () => {
  assert.match(sales, /stock_quantity <= 0/);
  assert.match(sales, /qty \+ 1 > svc\.stock_quantity/);
  assert.match(sales, /outOfStock/);
});

test('cadastro de equipe vincula apenas serviços (nunca produtos)', () => {
  assert.match(staff, /\.eq\("kind", "service"\)/);
});

test('edição de usuário envia serviços vinculados para a função', () => {
  assert.match(editUser, /service_ids: selectedServices/);
  assert.match(editUser, /service_professionals/);
});

test('função de edição substitui os serviços do profissional com validação da loja', () => {
  assert.match(updateFn, /service_ids/);
  assert.match(updateFn, /\.from\("service_professionals"\)\s*\.delete\(\)/);
  assert.match(updateFn, /Um ou mais serviços selecionados são inválidos/);
});
