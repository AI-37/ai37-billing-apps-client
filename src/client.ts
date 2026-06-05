import { BillingExecutionDeniedError } from './errors'
import {
  ensureOk,
  normalizeBillingBaseUrl,
  resolveFetch,
  validateOptions,
} from './http'
import type {
  BillingAppsClient,
  BillingAppsClientOptions,
  BillingRuntimeState,
  BillingUsageEventInput,
} from './types'

export function createBillingAppsClient(
  options: BillingAppsClientOptions,
): BillingAppsClient {
  validateOptions(options)

  const baseUrl = normalizeBillingBaseUrl(options.baseUrl)
  const authToken = options.authToken
  const timeoutMs = options.timeoutMs ?? 5000
  const fetchImpl = resolveFetch(options.fetch)

  async function getRuntimeStateByBillingOrgId(
    billingOrgId: string,
  ): Promise<BillingRuntimeState> {
    const response = await fetchImpl(
      `${baseUrl}/api/v1/billing/customers/by-billing-org/${encodeURIComponent(billingOrgId)}/state`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
      },
    )

    await ensureOk(
      response,
      `Billing state request failed for billingOrgId=${billingOrgId}`,
    )

    return (await response.json()) as BillingRuntimeState
  }

  async function assertExecutionAllowed(
    billingOrgId: string,
  ): Promise<BillingRuntimeState> {
    const state = await getRuntimeStateByBillingOrgId(billingOrgId)
    if (
      state.entitlementStatus !== 'active' ||
      state.remainingTotalTokens <= 0
    ) {
      throw new BillingExecutionDeniedError(state)
    }

    return state
  }

  async function sendUsageEvent(event: BillingUsageEventInput): Promise<void> {
    const payload = buildUsageEventPayload(event)
    const response = await fetchImpl(`${baseUrl}/api/v1/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    })

    await ensureOk(response, 'Billing usage event rejected')
  }

  return {
    getRuntimeStateByBillingOrgId,
    assertExecutionAllowed,
    sendUsageEvent,
  }
}

function buildUsageEventPayload(event: BillingUsageEventInput) {
  return {
    event: {
      transaction_id: event.transactionId,
      external_customer_id: event.externalCustomerId,
      external_subscription_id: event.externalSubscriptionId,
      code: event.code,
      timestamp: event.timestamp ?? Math.floor(Date.now() / 1000),
      properties: event.properties ?? {},
    },
  }
}