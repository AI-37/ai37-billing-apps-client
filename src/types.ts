export enum BillingFeatureCode {
  ElevatorCalcAgent = 'elevator-calc-agent',
}

export enum BillingPrivilegeCode {
  ElevatorCalcAllowed = 'elevator-calc-allowed',
}

export type BillingRuntimePrivilegeValueType =
  | 'integer'
  | 'boolean'
  | 'string'
  | 'select'

export interface BillingRuntimePrivilegeConfig {
  selectOptions?: string[]
}

export interface BillingRuntimePrivilege {
  code: string
  name?: string | null
  value?: number | boolean | string | null
  valueType: BillingRuntimePrivilegeValueType
  config: BillingRuntimePrivilegeConfig
}

export interface BillingRuntimeFeature {
  code: string
  name?: string | null
  description?: string | null
  privileges: BillingRuntimePrivilege[]
}

export interface BillingRuntimeState {
  orgId: string
  billingOrgId: string
  licensedExternalSubscriptionId?: string | null
  meteredExternalSubscriptionId?: string | null
  currentPlanCode?: string | null
  currentSubscriptionStatus?: string | null
  entitlementStatus: string
  remainingTotalTokens: number
  features: BillingRuntimeFeature[]
  trialEndsAt?: string | null
  snapshotUpdatedAt?: string
  snapshotVersion?: number
  stale: boolean
}

export interface BillingUsageEventInput {
  transactionId: string
  billingRuntimeState: BillingRuntimeState
  code: string
  timestamp?: number
  properties?: Record<string, unknown>
}

export type BillingFetch = typeof fetch

export interface BillingAppsClientOptions {
  baseUrl: string
  authToken: string
  timeoutMs?: number
  runtimeStateCacheTtlMs?: number
  fetch?: BillingFetch
}

export interface BillingExecutionRequirement {
  feature?: BillingFeatureCode
  privilege?: BillingPrivilegeCode
}

export interface BillingAppsClient {
  getRuntimeStateByBillingOrgId(
    billingOrgId: string,
  ): Promise<BillingRuntimeState>
  assertExecutionAllowed(
    billingOrgId: string,
    requirement?: BillingExecutionRequirement,
  ): Promise<BillingRuntimeState>
  sendUsageEvent(event: BillingUsageEventInput): Promise<void>
}