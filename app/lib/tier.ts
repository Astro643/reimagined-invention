// Plan tiers. "trial" grants everything for TRIAL_DAYS then expires — the
// sweeper (expireTrials) nulls plan, and trialUsed keeps the trial card
// grayed out so it can only ever be claimed once per account.

export const TRIAL_DAYS = 30

export interface TierUser {
  plan?: string | null
  trialEndsAt?: string | Date | null
  trialUsed?: boolean | null
}

export function trialEndsAtFrom(now = new Date()) {
  return new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
}

// The plan that is actually in force right now. An expired trial behaves as
// "no plan" even before the hourly sweeper nulls it in the database.
export function effectivePlan(user: TierUser | null | undefined): string | null {
  const plan = user?.plan ?? null
  if (plan !== "trial") return plan
  const ends = user?.trialEndsAt ? new Date(user.trialEndsAt) : null
  if (ends && ends.getTime() < Date.now()) return null
  return plan
}

export function canClaimTrial(user: TierUser | null | undefined) {
  return !user?.trialUsed
}
