export interface BillingRuntimeState {
  billingOrgId: string
  activeExternalSubscriptionId?: string | null
  currentPlanCode?: string | null
  currentSubscriptionStatus?: string | null
  entitlementStatus: string
  remainingTotalTokens: number
  trialEndsAt?: string | null
  snapshotUpdatedAt?: string
  snapshotVersion?: number
  stale: boolean
}

export interface BillingUsageEventInput {
  transactionId: string
  externalCustomerId: string
  externalSubscriptionId: string
  code: string
  timestamp?: number
  properties?: Record<string, unknown>
}

export type BillingFetch = typeof fetch

export interface BillingAppsClientOptions {
  baseUrl: string
  authToken: string
  timeoutMs?: number
  fetch?: BillingFetch
}

export interface BillingAppsClient {
  getRuntimeStateByBillingOrgId(
    billingOrgId: string,
  ): Promise<BillingRuntimeState>
  assertExecutionAllowed(billingOrgId: string): Promise<BillingRuntimeState>
  sendUsageEvent(event: BillingUsageEventInput): Promise<void>
}