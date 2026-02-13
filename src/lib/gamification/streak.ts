import { differenceInCalendarDays, parseISO } from "date-fns";

export function computeNextStreak(args: {
  previousStreakCount: number;
  previousStreakDate: string | null; // YYYY-MM-DD
  today: string; // YYYY-MM-DD
}) {
  if (!args.previousStreakDate) {
    return { streakCount: 1, streakDate: args.today, isNewDay: true, isConsecutive: true };
  }

  const diff = differenceInCalendarDays(parseISO(args.today), parseISO(args.previousStreakDate));
  if (diff === 0) {
    return {
      streakCount: args.previousStreakCount,
      streakDate: args.previousStreakDate,
      isNewDay: false,
      isConsecutive: true
    };
  }

  if (diff === 1) {
    return {
      streakCount: Math.max(1, args.previousStreakCount + 1),
      streakDate: args.today,
      isNewDay: true,
      isConsecutive: true
    };
  }

  return { streakCount: 1, streakDate: args.today, isNewDay: true, isConsecutive: false };
}

