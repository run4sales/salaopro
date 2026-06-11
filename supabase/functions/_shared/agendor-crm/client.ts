/* global Deno */
const AGENDOR_BASE_URL = 'https://api.agendor.com.br/v3';

export type SignupLeadBody = {
  business_name?: string;
  document?: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  cep?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  business_type?: string;
  selected_plan?: string;
};

type AgendorResponse<T = Record<string, unknown>> = {
  data?: T;
  [key: string]: unknown;
};

export type AgendorSyncResult = {
  organization_id: number;
  deal_id: number | null;
};

function onlyDigits(value?: string) {
  return (value ?? '').replace(/\D/g, '');
}

function compactObject<T extends Record<string, unknown>>(object: T) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      return true;
    }),
  ) as Partial<T>;
}

function envValueAsNumberOrString(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) return undefined;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && /^\d+$/.test(value) ? numericValue : value;
}

function normalizeText(value?: string) {
  return value?.trim() || undefined;
}

function normalizePhone(value?: string) {
  const digits = onlyDigits(value);
  return digits || normalizeText(value);
}

function getAgendorHeaders(apiKey: string) {
  return {
    authorization: `Token ${apiKey}`,
    'content-type': 'application/json',
    'User-Agent': 'SalaoPro/1.0',
  };
}

async function parseAgendorResponse<T>(response: Response) {
  const payload = await response.json().catch(() => ({})) as AgendorResponse<T>;

  if (!response.ok) {
    throw new Error(`Agendor ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function agendorRequest<T>(path: string, init: RequestInit, apiKey: string) {
  const response = await fetch(`${AGENDOR_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...getAgendorHeaders(apiKey),
      ...(init.headers ?? {}),
    },
  });

  return parseAgendorResponse<T>(response);
}

function buildOrganizationPayload(body: SignupLeadBody) {
  const documentDigits = onlyDigits(body.document);
  const phone = normalizePhone(body.phone);
  const ownerName = normalizeText(body.owner_name);
  const businessType = normalizeText(body.business_type);
  const selectedPlan = normalizeText(body.selected_plan);

  return compactObject({
    name: normalizeText(body.business_name) ?? 'Salão sem nome',
    cnpj: documentDigits.length === 14 ? documentDigits : undefined,
    description: [
      ownerName ? `Responsável: ${ownerName}` : undefined,
      businessType ? `Tipo de negócio: ${businessType}` : undefined,
      selectedPlan ? `Plano escolhido: ${selectedPlan}` : undefined,
      documentDigits && documentDigits.length !== 14 ? `Documento informado no cadastro: ${documentDigits}` : undefined,
      'Origem: cadastro no SalaoPro',
    ].filter(Boolean).join('\n'),
    contact: compactObject({
      email: normalizeText(body.email),
      work: phone,
      mobile: phone,
      whatsapp: phone,
    }),
    address: compactObject({
      country: 'Brasil',
      postalCode: normalizeText(body.cep),
      streetName: normalizeText(body.street),
      district: normalizeText(body.neighborhood),
      city: normalizeText(body.city),
    }),
    leadOrigin: envValueAsNumberOrString('AGENDOR_LEAD_ORIGIN'),
    category: envValueAsNumberOrString('AGENDOR_CATEGORY'),
    ownerUser: envValueAsNumberOrString('AGENDOR_OWNER_USER'),
    allowToAllUsers: true,
  });
}

function buildDealPayload(body: SignupLeadBody) {
  const businessName = normalizeText(body.business_name) ?? 'Salão sem nome';
  const ownerName = normalizeText(body.owner_name);
  const selectedPlan = normalizeText(body.selected_plan);
  const dealStage = Deno.env.get('AGENDOR_DEAL_STAGE')?.trim();
  const funnel = Deno.env.get('AGENDOR_FUNNEL')?.trim();

  return compactObject({
    title: `Novo cadastro - ${businessName}`.slice(0, 150),
    dealStatusText: 'ongoing',
    description: [
      'Negócio criado automaticamente a partir de um cadastro no SalaoPro.',
      ownerName ? `Responsável: ${ownerName}` : undefined,
      normalizeText(body.email) ? `Email: ${normalizeText(body.email)}` : undefined,
      normalizeText(body.phone) ? `Telefone: ${normalizeText(body.phone)}` : undefined,
      selectedPlan ? `Plano escolhido: ${selectedPlan}` : undefined,
    ].filter(Boolean).join('\n'),
    startTime: new Date().toISOString(),
    dealStage: dealStage ? Number(dealStage) : 1,
    funnel: funnel ? Number(funnel) : undefined,
    ownerUser: envValueAsNumberOrString('AGENDOR_OWNER_USER'),
    allowToAllUsers: true,
  });
}

async function findOrganizationByEmail(email: string | undefined, apiKey: string) {
  if (!email) return undefined;

  const searchParams = new URLSearchParams({ email, per_page: '1' });
  const result = await agendorRequest<Array<{ id?: number }>>(`/organizations?${searchParams.toString()}`, {
    method: 'GET',
  }, apiKey);

  return result.data?.[0]?.id;
}

async function findOrganizationByName(name: string, apiKey: string) {
  const searchParams = new URLSearchParams({ nameExact: name, per_page: '1' });
  const result = await agendorRequest<Array<{ id?: number }>>(`/organizations?${searchParams.toString()}`, {
    method: 'GET',
  }, apiKey);

  return result.data?.[0]?.id;
}

export async function syncAgendorSignupLead(body: SignupLeadBody, apiKey: string): Promise<AgendorSyncResult> {
  const businessName = normalizeText(body.business_name);
  const email = normalizeText(body.email);

  if (!businessName) {
    throw new Error('Nome do salão é obrigatório');
  }

  const organizationPayload = buildOrganizationPayload(body);
  const organization = await agendorRequest<{ id?: number }>('/organizations/upsert', {
    method: 'POST',
    body: JSON.stringify(organizationPayload),
  }, apiKey);

  let organizationId = organization.data?.id;

  if (!organizationId) {
    organizationId = await findOrganizationByEmail(email, apiKey);
  }

  if (!organizationId) {
    organizationId = await findOrganizationByName(businessName, apiKey);
  }

  if (!organizationId) {
    throw new Error('Agendor não retornou o ID da empresa criada');
  }

  const dealPayload = buildDealPayload(body);
  const deal = await agendorRequest<{ id?: number }>(`/organizations/${organizationId}/deals`, {
    method: 'POST',
    body: JSON.stringify(dealPayload),
  }, apiKey);

  return {
    organization_id: organizationId,
    deal_id: deal.data?.id ?? null,
  };
}
