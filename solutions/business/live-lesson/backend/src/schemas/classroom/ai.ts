/** AI / discuss / personal-touch response types */

export interface AiAskResponse {
  answer: string;
  category: string;
}

export interface AiDiscussResponse {
  reply: string;
  goalReached: boolean;
  llmFailed: boolean;
}

export interface DiscussCompleteResponse {
  ok: boolean;
  mcCorrect?: boolean;
}

export interface PersonalTouchResponse {
  strategies: Array<{ task: number; strategy: string; score: number; attempts: number }>;
  tier: { label: string; labelEn: string; tone: 'gold' | 'blue' | 'neutral' };
  aiComment: string;
  bonusUnlocked: boolean;
}

export interface CheckResultResponse {
  type: string;
  allCorrect: boolean;
  items: Array<Record<string, unknown>>;
}
