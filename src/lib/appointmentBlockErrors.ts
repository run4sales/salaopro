type BlockError = { code?: string; message?: string; details?: string; hint?: string };

export function getBlockPersistenceErrorMessage(error: BlockError | null | undefined): string {
  const code = error?.code ?? "";
  const message = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
  if (code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
    return "Você só pode bloquear horários do profissional vinculado ao seu acesso. Se for sua agenda, peça à administração para revisar o vínculo.";
  }
  if (["42P01", "PGRST205", "PGRST204"].includes(code) || message.includes("schema cache")) {
    return "O bloqueio de horários está temporariamente indisponível. Tente novamente ou avise a administração.";
  }
  return error?.message ?? "Não foi possível salvar o bloqueio.";
}