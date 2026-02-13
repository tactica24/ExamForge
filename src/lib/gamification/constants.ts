export const XP = {
  perQuiz: 10,
  goodScoreBonus: 5,
  streakMilestones: {
    3: 20,
    7: 50,
    14: 100
  } as Record<number, number>
};

export function computeLevel(totalXp: number) {
  return Math.max(1, Math.floor(totalXp / 100) + 1);
}

