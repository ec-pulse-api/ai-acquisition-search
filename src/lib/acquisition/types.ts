export type AcquisitionTarget = {
  id: string;
  name: string;
  category: string;
  model: string;
  summary: string;
  description: string;
  signals: string[];
  stage: string;
  score: number;
  revenueProfile: string;
  growthProfile: string;
  aiOpportunity: string;
  acquisitionRationale: string[];
  risks: string[];
  sourceType: "sample";
};

export type SearchFilters = {
  query?: string;
  category?: string;
  model?: string;
  minScore?: number;
};
