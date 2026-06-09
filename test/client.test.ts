import { describe, expect, it, vi } from 'vitest'
import {
  BillingConfigurationError,
  BillingExecutionDeniedError,
  BillingRequestError,
  createBillingAppsClient,
  normalizeBillingBaseUrl,
} from '../src/index'

describe('normalizeBillingBaseUrl', () => {
  it('removes duplicate trailing slash and api suffix', () => {
    expect(normalizeBillingBaseUrl('https://billing.example.com/api/v1/')).toBe(
      'https://billing.example.com',
    )
  })
})

describe('createBillingAppsClient', () => {
  it('throws when baseUrl is empty', () => {
    expect(() =>
      createBillingAppsClient({
        baseUrl: '',
        authToken: 'secret',
        fetch: vi.fn() as typeof fetch,
      }),
    ).toThrow(BillingConfigurationError)
  })

  it('throws when runtime state cache ttl is negative', () => {
    expect(() =>
      createBillingAppsClient({
        baseUrl: 'https://billing.example.com',
        authToken: 'secret',
        fetch: vi.fn() as typeof fetch,
        runtimeStateCacheTtlMs: -1,
      }),
    ).toThrow(BillingConfigurationError)
  })

  it('fetches billing state by billingOrgId', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          billingOrgId: 'org-1',
          entitlementStatus: 'active',
          remainingTotalTokens: 15,
          features: [
            {
              code: 'elevator-calc-agent',
              name: 'Call elevator calc agent',
              description: 'Allows access to the elevator calculation agent.',
              privileges: [
                {
                  code: 'elevator-calc-allowed',
                  name: 'Elevator calc allowed',
                  value: true,
                  valueType: 'boolean',
                  config: {},
                },
              ],
            },
          ],
          stale: false,
          activeExternalSubscriptionId: 'sub-1',
        }),
        { status: 200 },
      ),
    )
    const client = createBillingAppsClient({
      baseUrl: 'https://billing.example.com/api/v1/',
      authToken: 'apps-token',
      fetch: fetchMock as typeof fetch,
      timeoutMs: 1234,
    })

    const state = await client.getRuntimeStateByBillingOrgId('org-1')

    expect(state.activeExternalSubscriptionId).toBe('sub-1')
  expect(state.features[0]?.privileges[0]?.valueType).toBe('boolean')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://billing.example.com/api/v1/billing/customers/by-billing-org/org-1/state',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer apps-token',
        },
        signal: expect.any(AbortSignal),
      },
    )
  })

  it('reuses cached billing state for repeated calls within ttl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          billingOrgId: 'org-1',
          entitlementStatus: 'active',
          remainingTotalTokens: 15,
          features: [
            {
              code: 'elevator-calc-agent',
              privileges: [
                {
                  code: 'elevator-calc-allowed',
                  value: true,
                  valueType: 'boolean',
                  config: {},
                },
              ],
            },
          ],
          stale: false,
        }),
        { status: 200 },
      ),
    )
    const client = createBillingAppsClient({
      baseUrl: 'https://billing.example.com',
      authToken: 'apps-token',
      fetch: fetchMock as typeof fetch,
      runtimeStateCacheTtlMs: 10_000,
    })

    const firstState = await client.getRuntimeStateByBillingOrgId('org-1')
    const secondState = await client.getRuntimeStateByBillingOrgId('org-1')

    expect(secondState).toEqual(firstState)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent billing state requests for the same org', async () => {
    let resolveResponse: ((response: Response) => void) | undefined
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve
        }),
    )
    const client = createBillingAppsClient({
      baseUrl: 'https://billing.example.com',
      authToken: 'apps-token',
      fetch: fetchMock as typeof fetch,
      runtimeStateCacheTtlMs: 10_000,
    })

    const firstRequest = client.getRuntimeStateByBillingOrgId('org-1')
    const secondRequest = client.getRuntimeStateByBillingOrgId('org-1')

    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveResponse?.(
      new Response(
        JSON.stringify({
          billingOrgId: 'org-1',
          entitlementStatus: 'active',
          remainingTotalTokens: 15,
          features: [
            {
              code: 'elevator-calc-agent',
              privileges: [
                {
                  code: 'elevator-calc-allowed',
                  value: true,
                  valueType: 'boolean',
                  config: {},
                },
              ],
            },
          ],
          stale: false,
        }),
        { status: 200 },
      ),
    )

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      {
        billingOrgId: 'org-1',
        entitlementStatus: 'active',
        remainingTotalTokens: 15,
        features: [
          {
            code: 'elevator-calc-agent',
            privileges: [
              {
                code: 'elevator-calc-allowed',
                value: true,
                valueType: 'boolean',
                config: {},
              },
            ],
          },
        ],
        stale: false,
      },
      {
        billingOrgId: 'org-1',
        entitlementStatus: 'active',
        remainingTotalTokens: 15,
        features: [
          {
            code: 'elevator-calc-agent',
            privileges: [
              {
                code: 'elevator-calc-allowed',
                value: true,
                valueType: 'boolean',
                config: {},
              },
            ],
          },
        ],
        stale: false,
      },
    ])
  })

  it('does not cache failed billing state requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'temporary outage' }), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            billingOrgId: 'org-1',
            entitlementStatus: 'active',
            remainingTotalTokens: 15,
            features: [
              {
                code: 'elevator-calc-agent',
                privileges: [
                  {
                    code: 'elevator-calc-allowed',
                    value: true,
                    valueType: 'boolean',
                    config: {},
                  },
                ],
              },
            ],
            stale: false,
          }),
          { status: 200 },
        ),
      )
    const client = createBillingAppsClient({
      baseUrl: 'https://billing.example.com',
      authToken: 'apps-token',
      fetch: fetchMock as typeof fetch,
      runtimeStateCacheTtlMs: 10_000,
    })

    await expect(client.getRuntimeStateByBillingOrgId('org-1')).rejects.toBeInstanceOf(
      BillingRequestError,
    )

    await expect(client.getRuntimeStateByBillingOrgId('org-1')).resolves.toMatchObject(
      {
        billingOrgId: 'org-1',
        entitlementStatus: 'active',
      },
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws typed error when billing state request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'not found' }), { status: 404 }),
    )
    const client = createBillingAppsClient({
      baseUrl: 'https://billing.example.com',
      authToken: 'apps-token',
      fetch: fetchMock as typeof fetch,
    })

    await expect(client.getRuntimeStateByBillingOrgId('missing')).rejects.toMatchObject({
      name: 'BillingRequestError',
      status: 404,
    })
  })

  it('throws execution denied when entitlement is inactive', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          billingOrgId: 'org-1',
          entitlementStatus: 'no_resources',
          remainingTotalTokens: 0,
          features: [],
          stale: false,
        }),
        { status: 200 },
      ),
    )
    const client = createBillingAppsClient({
      baseUrl: 'https://billing.example.com',
      authToken: 'apps-token',
      fetch: fetchMock as typeof fetch,
    })

    await expect(client.assertExecutionAllowed('org-1')).rejects.toBeInstanceOf(
      BillingExecutionDeniedError,
    )
  })

  it('posts a Lago-compatible usage event', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accepted: true }), { status: 200 }),
    )
    const client = createBillingAppsClient({
      baseUrl: 'https://billing.example.com/',
      authToken: 'apps-token',
      fetch: fetchMock as typeof fetch,
    })

    await client.sendUsageEvent({
      transactionId: 'task-1',
      externalCustomerId: 'org-1',
      externalSubscriptionId: 'sub-1',
      code: 'lift_calculation',
      timestamp: 123456,
      properties: {
        skill_id: 'calc-lifts',
      },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://billing.example.com/api/v1/events',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer apps-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: {
            transaction_id: 'task-1',
            external_customer_id: 'org-1',
            external_subscription_id: 'sub-1',
            code: 'lift_calculation',
            timestamp: 123456,
            properties: {
              skill_id: 'calc-lifts',
            },
          },
        }),
        signal: expect.any(AbortSignal),
      },
    )
  })

  it('throws typed error when usage event is rejected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'bad metric' }), { status: 422 }),
    )
    const client = createBillingAppsClient({
      baseUrl: 'https://billing.example.com',
      authToken: 'apps-token',
      fetch: fetchMock as typeof fetch,
    })

    await expect(
      client.sendUsageEvent({
        transactionId: 'task-1',
        externalCustomerId: 'org-1',
        externalSubscriptionId: 'sub-1',
        code: 'lift_calculation',
      }),
    ).rejects.toMatchObject({
      name: 'BillingRequestError',
      status: 422,
    })
  })
})