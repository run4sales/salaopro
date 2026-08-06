/**
 * FONTE ÚNICA DE VERDADE — regras financeiras do Beauty Core.
 *
 * Regras oficiais (usadas por TODOS os relatórios):
 *
 * 1. Período: intervalo semiaberto [início 00:00:00 , dia seguinte ao fim 00:00:00).
 *    Isso garante que o último dia selecionado entre inteiro, sem depender de
 *    milissegundos ou de conversão de timezone.
 *
 * 2. Faturamento realizado = soma de `sales.amount` das vendas finalizadas
 *    (não excluídas / `deleted_at IS NULL`) cuja `sale_date` está no período.
 *    O crédito do cliente (sinal/adiantamento) é apenas FORMA DE PAGAMENTO de
 *    uma venda já finalizada — descontá-lo subestimaria a receita do serviço
 *    prestado. O caixa do sinal já é tratado separadamente em cash_flow_entries.
 *
 * 3. Recebido em caixa (dinheiro novo entrando na venda) = `paid_now`
 *    (fallback: bruto - crédito usado). É uma métrica DIFERENTE de faturamento.
 *
 * 4. Faturamento previsto = agendamentos futuros + entradas de caixa ainda não
 *    confirmadas. Nunca somado ao realizado.
 *
 * 5. Comissão: a base de cada profissional é o valor da venda RATEADO pelo
 *    número de profissionais associados àquela venda; o percentual é o
 *    percentual individual gravado em `sale_professionals`.
 */

export type PeriodRange = {
  startISO: string;
  endExclusiveISO: string;
};

export type SaleLike = {
  id: string;
  amount: number | null;
  gross_amount?: number | null;
  net_amount?: number | null;
  paid_now?: number | null;
  credit_used?: number | null;
  fee_amount?: number | null;
  client_id?: string | null;
  sale_date?: string | null;
};

export type SaleProfessionalLike = {
  sale_id: string;
  professional_id: string;
  role?: string | null;
  commission_percentage?: number | null;
  commission_amount?: number | null;
};

export function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round2(value: number): number {
  return Math.round((asNumber(value) + Number.EPSILON) * 100) / 100;
}

/** Intervalo semiaberto: [start 00:00, dia seguinte ao end 00:00). */
export function toPeriodRange(start: Date, end: Date): PeriodRange {
  const startOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  const endExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1, 0, 0, 0, 0);
  return { startISO: startOfDay.toISOString(), endExclusiveISO: endExclusive.toISOString() };
}

/** Período imediatamente anterior, com a mesma duração. */
export function previousPeriodRange(range: PeriodRange): PeriodRange {
  const start = new Date(range.startISO).getTime();
  const end = new Date(range.endExclusiveISO).getTime();
  const length = end - start;
  return {
    startISO: new Date(start - length).toISOString(),
    endExclusiveISO: range.startISO,
  };
}

/** Regra 2 — faturamento realizado de uma venda. */
export function saleRealizedRevenue(sale: SaleLike): number {
  return asNumber(sale.amount);
}

/** Regra 3 — dinheiro efetivamente recebido no ato da venda. */
export function saleCashReceived(sale: SaleLike): number {
  if (sale.paid_now !== null && sale.paid_now !== undefined) return asNumber(sale.paid_now);
  const gross = sale.gross_amount ?? sale.amount;
  return Math.max(0, asNumber(gross) - asNumber(sale.credit_used));
}

export function sumRealizedRevenue(sales: SaleLike[]): number {
  return round2(sales.reduce((total, sale) => total + saleRealizedRevenue(sale), 0));
}

export function sumCashReceived(sales: SaleLike[]): number {
  return round2(sales.reduce((total, sale) => total + saleCashReceived(sale), 0));
}

export function sumCreditUsed(sales: SaleLike[]): number {
  return round2(sales.reduce((total, sale) => total + asNumber(sale.credit_used), 0));
}

export function sumFees(sales: SaleLike[]): number {
  return round2(sales.reduce((total, sale) => total + asNumber(sale.fee_amount), 0));
}

export function countUniqueClients(sales: SaleLike[]): number {
  return new Set(sales.map((sale) => sale.client_id).filter(Boolean)).size;
}

export function averageTicket(sales: SaleLike[]): number {
  if (sales.length === 0) return 0;
  return round2(sumRealizedRevenue(sales) / sales.length);
}

export type CommissionEntry = {
  id: string;
  saleId: string;
  date: string | null;
  professionalId: string;
  role: string;
  /** Nº de profissionais que dividem a mesma venda. */
  participants: number;
  /** Valor total da venda (não somar para evitar duplicidade em multi-profissional). */
  saleAmount: number;
  /** Base do profissional = valor da venda / participantes. */
  baseAmount: number;
  percent: number;
  commission: number;
};

/**
 * Regra 5 — monta as linhas de comissão sem duplicar o valor da venda.
 * Cada linha carrega a base rateada do profissional; a soma das bases de uma
 * venda é exatamente o valor da venda.
 */
export function buildCommissionEntries(
  sales: SaleLike[],
  saleProfessionals: SaleProfessionalLike[],
): CommissionEntry[] {
  const saleById = new Map(sales.map((sale) => [sale.id, sale]));
  const participantsBySale = new Map<string, number>();
  for (const link of saleProfessionals) {
    participantsBySale.set(link.sale_id, (participantsBySale.get(link.sale_id) ?? 0) + 1);
  }

  return saleProfessionals
    .filter((link) => saleById.has(link.sale_id))
    .map((link) => {
      const sale = saleById.get(link.sale_id) as SaleLike;
      const participants = participantsBySale.get(link.sale_id) ?? 1;
      const saleAmount = saleRealizedRevenue(sale);
      const baseAmount = round2(saleAmount / participants);
      const percent = asNumber(link.commission_percentage);
      const stored = link.commission_amount;
      const commission =
        stored === null || stored === undefined
          ? round2(baseAmount * (percent / 100))
          : round2(asNumber(stored));
      return {
        id: `${link.sale_id}:${link.professional_id}:${link.role ?? "solo"}`,
        saleId: link.sale_id,
        date: sale.sale_date ?? null,
        professionalId: link.professional_id,
        role: link.role ?? "solo",
        participants,
        saleAmount,
        baseAmount,
        percent,
        commission,
      };
    });
}

/** Soma de comissões (uma linha por profissional/venda, sem duplicidade). */
export function sumCommissions(entries: CommissionEntry[]): number {
  return round2(entries.reduce((total, entry) => total + entry.commission, 0));
}

/** Base comissionável: soma das parcelas rateadas (nunca multiplica a venda). */
export function sumCommissionBase(entries: CommissionEntry[]): number {
  return round2(entries.reduce((total, entry) => total + entry.baseAmount, 0));
}
