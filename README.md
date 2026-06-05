# ai37-billing-apps-client

Framework-agnostic TypeScript client for the public billing-apps API exposed by `billing-microservice`.

## Features

- fetch billing runtime state by `billingOrgId`
- assert whether execution is currently allowed
- send Lago-compatible usage events to the billing facade
- works in both ESM and CommonJS consumers

## Install

```bash
npm install ai37-billing-apps-client
```

## Usage

```ts
import { createBillingAppsClient } from 'ai37-billing-apps-client'

const billingClient = createBillingAppsClient({
  baseUrl: process.env.BILLING_MICROSERVICE_BASE_URL!,
  authToken: process.env.BILLING_MICROSERVICE_APPS_AUTH_TOKEN!,
  timeoutMs: 5000,
})

const state = await billingClient.assertExecutionAllowed('billing-org-123')

await billingClient.sendUsageEvent({
  transactionId: 'task-123',
  externalCustomerId: 'billing-org-123',
  externalSubscriptionId: state.activeExternalSubscriptionId!,
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
- `fetch?: typeof fetch`

Methods:

- `getRuntimeStateByBillingOrgId(billingOrgId)`
- `assertExecutionAllowed(billingOrgId)`
- `sendUsageEvent(event)`

## Publish

```bash
npm login
npm publish --access public
```

Before publishing:

```bash
npm run verify
```