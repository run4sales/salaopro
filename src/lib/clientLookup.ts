export type ClientName = { id: string; name: string };

/** Fetch referenced clients in batches below the API row limit. */
export async function loadClientNames(
  clientIds: (string | null | undefined)[],
  fetchBatch: (ids: string[]) => Promise<ClientName[]>,
): Promise<ClientName[]> {
  const ids = [...new Set(clientIds.filter((id): id is string => Boolean(id)))];
  const clients: ClientName[] = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    clients.push(...await fetchBatch(ids.slice(offset, offset + 200)));
  }
  return clients;
}