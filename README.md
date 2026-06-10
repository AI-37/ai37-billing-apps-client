# @ai37/billing-apps-client

Framework-agnostic TypeScript client for the public billing-apps API exposed by `billing-microservice`.

## Features

- fetch billing runtime state by `billingOrgId`
- assert whether execution is currently allowed
- send usage events by `billingOrgId`, with `orgId` resolved by the SDK
- works in both ESM and CommonJS consumers

## Install

```bash
npm install @ai37/billing-apps-client
```

## Usage

```ts
import {
  BillingFeatureCode,
  BillingPrivilegeCode,
  createBillingAppsClient,
} from '@ai37/billing-apps-client'

const billingClient = createBillingAppsClient({
  baseUrl: process.env.BILLING_MICROSERVICE_BASE_URL!,
  authToken: process.env.BILLING_MICROSERVICE_APPS_AUTH_TOKEN!,
  timeoutMs: 5000,
  runtimeStateCacheTtlMs: 5000,
})

const state = await billingClient.assertExecutionAllowed('billing-org-123', {
  feature: BillingFeatureCode.ElevatorCalcAgent,
  privilege: BillingPrivilegeCode.ElevatorCalcAllowed,
})

await billingClient.sendUsageEvent({
  transactionId: 'task-123',
  billingOrgId: state.billingOrgId,
  code: 'lift_calculation',
  properties: {
    skill_id: 'calc-lifts',
    total_tokens: 76,
  },
})
```

## API

### `createBillingAppsClient(options)`

Creates a reusable client instance.

Options:

- `baseUrl: string`
- `authToken: string`
- `timeoutMs?: number`
- `runtimeStateCacheTtlMs?: number` - in-memory TTL for `getRuntimeStateByBillingOrgId`; defaults to `5000`, set to `0` to disable settled-value caching while keeping in-flight request deduplication
- `fetch?: typeof fetch`

Methods:

- `getRuntimeStateByBillingOrgId(billingOrgId)`
- `assertExecutionAllowed(billingOrgId, requirement?)`
- `sendUsageEvent(event)`

`BillingRuntimeState` includes both `orgId` and `billingOrgId`. The SDK uses `orgId`
for usage ingest routing and keeps `billingOrgId` as the lookup key for public
runtime state endpoints.

### `assertExecutionAllowed(billingOrgId, requirement?)`

Checks that:

- subscription entitlement status is `active`
- `remainingTotalTokens` is positive
- optional required `feature` exists in `state.features`
- optional required `privilege` exists in the selected feature, or in any feature if `feature` is omitted

Supported enums:

- `BillingFeatureCode`
- `BillingPrivilegeCode`

Example:

```ts
await billingClient.assertExecutionAllowed('billing-org-123', {
  feature: BillingFeatureCode.ElevatorCalcAgent,
  privilege: BillingPrivilegeCode.ElevatorCalcAllowed,
})
```

For boolean privileges, access is granted only when the privilege value is `true`.

## Publish

```bash
npm login
npm publish --access public
```

Before publishing:

```bash
npm run verify
```