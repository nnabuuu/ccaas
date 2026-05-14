/** Depth leaderboard types for teacher dashboard */

export interface DepthLeaderboardEntry {
  studentId: string;
  studentName: string;
  rank: number;
  score: number;
  highlightCount: number;
  tpHitCount: number;
  aiSummary: string | null;
}

export interface DepthLeaderboard {
  rankings: DepthLeaderboardEntry[];
  generatedAt: number;
}
