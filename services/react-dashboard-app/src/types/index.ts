export interface Security {
  id: number;
  ticker: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  peRatio: number;
  dividendYield: number;
  exchange: string;
}

export interface Portfolio {
  id: number;
  name: string;
  strategy: string;
  aum: number;
  inceptionDate: string;
  benchmark: string;
  ytdReturn: number;
  manager: string;
}

export interface Holding {
  id: number;
  portfolioId: number;
  securityId: number;
  weight: number;
  shares: number;
  marketValue: number;
  costBasis: number;
}

export interface EnrichedHolding extends Holding {
  ticker: string;
  securityName: string;
  portfolioName: string;
  gainLoss: number;
  gainLossPercent: number;
}
