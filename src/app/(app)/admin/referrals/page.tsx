import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Megaphone, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormState } from "@/components/auth/auth-form-state";
import { SubmitButton } from "@/components/form/submit-button";
import { requireAdmin } from "@/app/(app)/admin/guard";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getAppUrl } from "@/lib/app-url";
import {
  createCampaignReferralCodeAction,
  toggleCampaignReferralCodeStatusAction
} from "@/app/(app)/admin/referrals/actions";

export const dynamic = "force-dynamic";

type CampaignCode = {
  code: string;
  campaignExternalId: string;
  influencerName: string;
  influencerEmail: string | null;
  influencerPhone: string | null;
  isActive: boolean;
  createdAt: string | null;
};

type ReferralUse = {
  code: string;
  inviteeUserId: string;
  createdAt: string | null;
};

type ProfileSnapshot = {
  userId: string;
  displayName: string;
  email: string | null;
  subscriptionTier: string | null;
  proUntil: string | null;
};

type SubscriptionSnapshot = {
  userId: string;
  provider: string | null;
  tier: string | null;
  status: string | null;
};

type CommissionSnapshot = {
  code: string;
  amountKobo: number;
  referredUserId: string | null;
  paymentReference: string | null;
  paidAt: string | null;
};

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function toBool(value: unknown, defaultValue = false) {
  if (typeof value === "boolean") return value;
  const raw = cleanText(value, 20).toLowerCase();
  if (!raw) return defaultValue;
  return raw === "true" || raw === "1" || raw === "yes";
}

function toIso(value: unknown) {
  const raw = cleanText(value, 40);
  return raw || null;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function selectByInBatches(args: {
  firebase: Awaited<ReturnType<typeof createFirebaseServerClient>>;
  table: string;
  select: string;
  field: string;
  values: string[];
}) {
  if (!args.values.length) return [];

  const rows: any[] = [];
  for (const batch of chunk(args.values, 25)) {
    const { data } = await args.firebase.from(args.table).select(args.select).in(args.field, batch);
    rows.push(...(data ?? []));
  }

  return rows;
}

function hasActivePaidSubscription(rows: SubscriptionSnapshot[]) {
  return rows.some((row) => {
    const provider = cleanText(row.provider, 40).toLowerCase();
    const tier = cleanText(row.tier, 20).toLowerCase();
    const status = cleanText(row.status, 20).toLowerCase();
    const paidProvider = provider === "paystack" || provider === "stripe";
    return paidProvider && tier === "pro" && status === "active";
  });
}

function hasActiveProAccess(profile: ProfileSnapshot | null | undefined) {
  if (!profile) return false;
  const tier = cleanText(profile.subscriptionTier, 20).toLowerCase();
  if (tier !== "pro") return false;

  const until = profile.proUntil ? new Date(profile.proUntil).getTime() : Number.NaN;
  if (!Number.isFinite(until)) return true;
  return until > Date.now();
}

export default async function AdminReferralsPage(props: { searchParams: Promise<{ created?: string }> }) {
  const { user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/admin");

  const sp = await props.searchParams;
  const created = sp.created === "1";

  const firebase = await createFirebaseServerClient();
  const { data: rawCodes } = await firebase
    .from("referral_codes")
    .select(
      "code,campaign_external_id,influencer_name,influencer_email,influencer_phone,is_active,created_at"
    )
    .eq("owner_kind", "campaign")
    .order("created_at", { ascending: false })
    .limit(300);

  const campaignCodes: CampaignCode[] = (rawCodes ?? [])
    .map((row: any) => {
      const code = cleanText(row.code, 24).toUpperCase();
      if (!code) return null;
      return {
        code,
        campaignExternalId: cleanText(row.campaign_external_id, 48),
        influencerName: cleanText(row.influencer_name, 80) || "Unknown influencer",
        influencerEmail: cleanText(row.influencer_email, 120) || null,
        influencerPhone: cleanText(row.influencer_phone, 40) || null,
        isActive: toBool(row.is_active, true),
        createdAt: toIso(row.created_at)
      };
    })
    .filter(Boolean) as CampaignCode[];

  const codes = campaignCodes.map((entry) => entry.code);
  const rawReferrals = await selectByInBatches({
    firebase,
    table: "referrals",
    select: "id,code,invitee_user_id,created_at",
    field: "code",
    values: codes
  });

  const referralUses: ReferralUse[] = rawReferrals
    .map((row: any) => {
      const code = cleanText(row.code, 24).toUpperCase();
      const inviteeUserId = cleanText(row.invitee_user_id, 80);
      if (!code || !inviteeUserId) return null;
      return {
        code,
        inviteeUserId,
        createdAt: toIso(row.created_at)
      };
    })
    .filter(Boolean) as ReferralUse[];

  const inviteeUserIds = Array.from(new Set(referralUses.map((entry) => entry.inviteeUserId)));

  const rawProfiles = await selectByInBatches({
    firebase,
    table: "profiles",
    select: "user_id,display_name,name,email,subscription_tier,pro_until",
    field: "user_id",
    values: inviteeUserIds
  });

  const rawSubscriptions = await selectByInBatches({
    firebase,
    table: "subscriptions",
    select: "user_id,provider,tier,status",
    field: "user_id",
    values: inviteeUserIds
  });
  const commissionOwnerIds = Array.from(
    new Set(
      campaignCodes
        .map((entry) => cleanText(entry.campaignExternalId, 48).toLowerCase())
        .filter(Boolean)
        .map((campaignId) => `campaign:${campaignId}`)
    )
  );
  const rawCommissionEvents = await selectByInBatches({
    firebase,
    table: "billing_events",
    select: "user_id,amount_kobo,paid_at,metadata",
    field: "user_id",
    values: commissionOwnerIds
  });

  const profileByUserId = new Map<string, ProfileSnapshot>();
  for (const row of rawProfiles) {
    const userId = cleanText((row as any).user_id, 80);
    if (!userId) continue;
    const displayName =
      cleanText((row as any).display_name, 80) || cleanText((row as any).name, 80) || cleanText((row as any).email, 120) || userId;
    profileByUserId.set(userId, {
      userId,
      displayName,
      email: cleanText((row as any).email, 120) || null,
      subscriptionTier: cleanText((row as any).subscription_tier, 20) || null,
      proUntil: toIso((row as any).pro_until)
    });
  }

  const subscriptionsByUserId = new Map<string, SubscriptionSnapshot[]>();
  for (const row of rawSubscriptions) {
    const userId = cleanText((row as any).user_id, 80);
    if (!userId) continue;
    const list = subscriptionsByUserId.get(userId) ?? [];
    list.push({
      userId,
      provider: cleanText((row as any).provider, 40) || null,
      tier: cleanText((row as any).tier, 20) || null,
      status: cleanText((row as any).status, 20) || null
    });
    subscriptionsByUserId.set(userId, list);
  }

  const commissionsByCode = new Map<string, CommissionSnapshot[]>();
  let totalCommissionKobo = 0;
  for (const row of rawCommissionEvents) {
    const metadata = (row as any)?.metadata;
    const code = cleanText(metadata?.referral_code, 24).toUpperCase();
    const amountKobo = Number((row as any)?.amount_kobo ?? 0);
    if (!code || !Number.isFinite(amountKobo) || amountKobo <= 0) continue;

    const commission: CommissionSnapshot = {
      code,
      amountKobo,
      referredUserId: cleanText(metadata?.referred_user_id, 120) || null,
      paymentReference: cleanText(metadata?.source_payment_reference, 120) || null,
      paidAt: toIso((row as any)?.paid_at)
    };

    totalCommissionKobo += amountKobo;
    const list = commissionsByCode.get(code) ?? [];
    list.push(commission);
    commissionsByCode.set(code, list);
  }

  for (const list of commissionsByCode.values()) {
    list.sort((a, b) => {
      const aMs = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const bMs = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return bMs - aMs;
    });
  }

  const referralsByCode = new Map<string, ReferralUse[]>();
  for (const row of referralUses) {
    const list = referralsByCode.get(row.code) ?? [];
    list.push(row);
    referralsByCode.set(row.code, list);
  }

  for (const list of referralsByCode.values()) {
    list.sort((a, b) => {
      const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bMs - aMs;
    });
  }

  const analyticsByCode = new Map<
    string,
    {
      onboardedCount: number;
      paidCount: number;
      activeProCount: number;
      conversionRate: number;
      commissionKobo: number;
      commissions: CommissionSnapshot[];
      recentUsers: Array<{
        userId: string;
        label: string;
        email: string | null;
        joinedAt: string | null;
        hasPaid: boolean;
        hasActivePro: boolean;
      }>;
    }
  >();

  for (const code of campaignCodes) {
    const uses = referralsByCode.get(code.code) ?? [];
    const uniqueInvitees = Array.from(new Set(uses.map((entry) => entry.inviteeUserId)));

    let paidCount = 0;
    let activeProCount = 0;

    for (const inviteeId of uniqueInvitees) {
      const hasPaid = hasActivePaidSubscription(subscriptionsByUserId.get(inviteeId) ?? []);
      const hasPro = hasActiveProAccess(profileByUserId.get(inviteeId));
      if (hasPaid) paidCount += 1;
      if (hasPro) activeProCount += 1;
    }

    const recentUsers = uses.slice(0, 10).map((entry) => {
      const profile = profileByUserId.get(entry.inviteeUserId);
      const hasPaid = hasActivePaidSubscription(subscriptionsByUserId.get(entry.inviteeUserId) ?? []);
      const hasActivePro = hasActiveProAccess(profile);
      return {
        userId: entry.inviteeUserId,
        label: profile?.displayName ?? entry.inviteeUserId,
        email: profile?.email ?? null,
        joinedAt: entry.createdAt,
        hasPaid,
        hasActivePro
      };
    });
    const commissions = commissionsByCode.get(code.code) ?? [];
    const commissionKobo = commissions.reduce((sum, item) => sum + item.amountKobo, 0);

    analyticsByCode.set(code.code, {
      onboardedCount: uniqueInvitees.length,
      paidCount,
      activeProCount,
      conversionRate: uniqueInvitees.length ? Math.round((paidCount / uniqueInvitees.length) * 100) : 0,
      commissionKobo,
      commissions,
      recentUsers
    });
  }

  const totalOnboardedUsers = inviteeUserIds.length;
  const totalPaidUsers = inviteeUserIds.filter((userId) =>
    hasActivePaidSubscription(subscriptionsByUserId.get(userId) ?? [])
  ).length;
  const totalActiveProUsers = inviteeUserIds.filter((userId) => hasActiveProAccess(profileByUserId.get(userId))).length;
  const appUrl = getAppUrl();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-[0_30px_80px_-40px_rgba(2,12,27,0.85)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/70">
              <Megaphone className="h-3.5 w-3.5" />
              Growth workspace
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Referral campaigns and conversion tracking</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/70">
              Create influencer codes, distribute campaign links, and monitor onboarding plus paid conversion from a single board.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/admin">Back to admin</Link>
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/60">
              <BarChart3 className="h-3.5 w-3.5" />
              Campaign codes
            </div>
            <div className="mt-2 text-3xl font-semibold">{campaignCodes.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/60">Onboarded users</div>
            <div className="mt-2 text-3xl font-semibold">{totalOnboardedUsers}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/60">
              <TrendingUp className="h-3.5 w-3.5" />
              Active pro users
            </div>
            <div className="mt-2 text-3xl font-semibold">{totalActiveProUsers}</div>
          </div>
        </div>
      </div>

      {created ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
          Campaign referral code created.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign codes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{campaignCodes.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Onboarded users</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalOnboardedUsers}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paid subscribers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalPaidUsers}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active pro users</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalActiveProUsers}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referral earnings</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            N{Math.round(totalCommissionKobo / 100).toLocaleString("en-NG")}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create campaign code</CardTitle>
          <CardDescription>Use unique campaign IDs so each influencer has clear, auditable attribution.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthFormState action={createCampaignReferralCodeAction}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="campaign_external_id">Campaign ID</Label>
                <Input id="campaign_external_id" name="campaign_external_id" placeholder="INFLUENCER_JANE_001" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="influencer_name">Influencer name</Label>
                <Input id="influencer_name" name="influencer_name" placeholder="Jane Doe" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="influencer_email">Influencer email (optional)</Label>
                <Input id="influencer_email" name="influencer_email" type="email" placeholder="jane@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="influencer_phone">Influencer phone (optional)</Label>
                <Input id="influencer_phone" name="influencer_phone" placeholder="+234..." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="code">Custom referral code (optional)</Label>
                <Input id="code" name="code" placeholder="Leave empty to auto-generate" />
              </div>
            </div>
            <SubmitButton type="submit" pendingText="Creating...">
              Create referral campaign code
            </SubmitButton>
          </AuthFormState>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign analytics</CardTitle>
          <CardDescription>Track onboarding and paid conversion for each campaign code.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaignCodes.length ? (
            campaignCodes.map((entry) => {
              const analytics = analyticsByCode.get(entry.code);
              const campaignLink = new URL(`/r/${entry.code}`, appUrl).toString();

              return (
                <div key={entry.code} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold">{entry.influencerName}</div>
                        <Badge variant={entry.isActive ? "default" : "outline"}>
                          {entry.isActive ? "active" : "inactive"}
                        </Badge>
                        <Badge variant="secondary">Code: {entry.code}</Badge>
                        {entry.campaignExternalId ? <Badge variant="outline">ID: {entry.campaignExternalId}</Badge> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.influencerEmail ?? "No email"} {entry.influencerPhone ? `| ${entry.influencerPhone}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Link:{" "}
                        <a className="underline underline-offset-4" href={campaignLink} target="_blank" rel="noreferrer">
                          {campaignLink}
                        </a>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created: {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "Unknown"}
                      </div>
                    </div>
                    <div className="w-full lg:w-[190px]">
                      <AuthFormState action={toggleCampaignReferralCodeStatusAction}>
                        <input type="hidden" name="code" value={entry.code} />
                        <input type="hidden" name="next_active" value={entry.isActive ? "false" : "true"} />
                        <SubmitButton
                          type="submit"
                          variant={entry.isActive ? "outline" : "default"}
                          pendingText="Saving..."
                          className="w-full"
                        >
                          {entry.isActive ? "Deactivate code" : "Activate code"}
                        </SubmitButton>
                      </AuthFormState>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border px-3 py-2">
                      <div className="text-xs text-muted-foreground">Onboarded</div>
                      <div className="text-xl font-semibold">{analytics?.onboardedCount ?? 0}</div>
                    </div>
                    <div className="rounded-lg border px-3 py-2">
                      <div className="text-xs text-muted-foreground">Paid subscribers</div>
                      <div className="text-xl font-semibold">{analytics?.paidCount ?? 0}</div>
                    </div>
                    <div className="rounded-lg border px-3 py-2">
                      <div className="text-xs text-muted-foreground">Active pro users</div>
                      <div className="text-xl font-semibold">{analytics?.activeProCount ?? 0}</div>
                    </div>
                    <div className="rounded-lg border px-3 py-2">
                      <div className="text-xs text-muted-foreground">Paid conversion</div>
                      <div className="text-xl font-semibold">{analytics?.conversionRate ?? 0}%</div>
                    </div>
                    <div className="rounded-lg border px-3 py-2">
                      <div className="text-xs text-muted-foreground">Earnings credited</div>
                      <div className="text-xl font-semibold">
                        N{Math.round((analytics?.commissionKobo ?? 0) / 100).toLocaleString("en-NG")}
                      </div>
                    </div>
                  </div>

                  <details className="mt-3 rounded-lg border bg-muted/20 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium">Recent onboarded users</summary>
                    <div className="mt-2 space-y-2">
                      {analytics?.recentUsers?.length ? (
                        analytics.recentUsers.map((item) => (
                          <div key={`${entry.code}:${item.userId}:${item.joinedAt ?? ""}`} className="rounded-md border bg-card px-3 py-2 text-xs">
                            <div className="font-medium">{item.label}</div>
                            <div className="text-muted-foreground">{item.email ?? item.userId}</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Badge variant={item.hasPaid ? "default" : "outline"}>
                                {item.hasPaid ? "Paid subscriber" : "Not paid"}
                              </Badge>
                              <Badge variant={item.hasActivePro ? "secondary" : "outline"}>
                                {item.hasActivePro ? "Active pro" : "No active pro"}
                              </Badge>
                            </div>
                            <div className="mt-1 text-muted-foreground">
                              Onboarded: {item.joinedAt ? new Date(item.joinedAt).toLocaleString() : "Unknown"}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground">No onboarded users yet for this code.</div>
                      )}
                    </div>
                  </details>

                  <details className="mt-3 rounded-lg border bg-muted/20 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium">Commission credits</summary>
                    <div className="mt-2 space-y-2">
                      {analytics?.commissions?.length ? (
                        analytics.commissions.map((item) => (
                          <div
                            key={`${entry.code}:${item.paymentReference ?? ""}:${item.paidAt ?? ""}`}
                            className="rounded-md border bg-card px-3 py-2 text-xs"
                          >
                            <div className="font-medium">
                              N{Math.round(item.amountKobo / 100).toLocaleString("en-NG")} credited
                            </div>
                            <div className="text-muted-foreground">
                              Payment ref: {item.paymentReference ?? "Unknown"}
                            </div>
                            <div className="text-muted-foreground">
                              Referred user: {item.referredUserId ?? "Unknown"}
                            </div>
                            <div className="mt-1 text-muted-foreground">
                              Credited at: {item.paidAt ? new Date(item.paidAt).toLocaleString() : "Unknown"}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground">No commission credits yet for this code.</div>
                      )}
                    </div>
                  </details>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground">
              No admin campaign codes yet. Create one above, share the link, and analytics will populate after onboarding.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
