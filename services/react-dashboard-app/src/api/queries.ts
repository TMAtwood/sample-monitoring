import { useQuery } from "@tanstack/react-query";
import type { Security, Portfolio, EnrichedHolding } from "@/types";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const useSecurities = () =>
  useQuery({ queryKey: ["securities"], queryFn: () => fetchJson<Security[]>("/securities"), staleTime: 30_000 });

export const useSecurity = (id: string) =>
  useQuery({
    queryKey: ["securities", id],
    queryFn: () => fetchJson<Security & { holdings: EnrichedHolding[] }>(`/securities/${id}`),
    staleTime: 30_000,
  });

export const usePortfolios = () =>
  useQuery({ queryKey: ["portfolios"], queryFn: () => fetchJson<Portfolio[]>("/portfolios"), staleTime: 30_000 });

export const usePortfolio = (id: string) =>
  useQuery({
    queryKey: ["portfolios", id],
    queryFn: () => fetchJson<Portfolio & { holdings: EnrichedHolding[] }>(`/portfolios/${id}`),
    staleTime: 30_000,
  });

export const useHoldings = () =>
  useQuery({ queryKey: ["holdings"], queryFn: () => fetchJson<EnrichedHolding[]>("/holdings"), staleTime: 30_000 });
