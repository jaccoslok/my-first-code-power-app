# Technical Paper: Business Central Customers Power Apps Code App

## Abstract
This paper describes the architecture, runtime behavior, interface contracts, and schema model of the Power Apps code app in this repository. The application is a React + TypeScript frontend that runs in two modes:

- Power Apps runtime mode: data is fetched through a generated Power Automate connector service.
- Local development mode: data is fetched through a Vite server-side proxy that authenticates against Microsoft Entra ID (Azure AD) and calls Business Central APIs.

The design separates UI concerns from integration concerns, provides clear contracts for request/response shapes, and avoids browser-side token exchange in local mode.

## 1. System Overview
The app shows a searchable list of Business Central customers and a route-based customer detail page.

Primary implementation files:

- `src/App.tsx`: UI composition, data-source selection, search/filter, and route-based detail navigation.
- `src/main.tsx`: application bootstrap and `HashRouter` setup.
- `src/services/businessCentralDevApi.ts`: local dev API client and entity registry.
- `vite.config.ts`: Vite plugin middleware for local Business Central proxy.
- `src/generated/services/PA_GetRecordsFromBCAPIService.ts`: generated Power Automate service client.
- `src/generated/models/PA_GetRecordsFromBCAPIModel.ts`: generated flow input model.
- `power.config.json`: Power Apps app/environment wiring.
- `.power/schemas/logicflows/PA_GetRecordsFromBCAPI.Schema.json`: connector OpenAPI schema for flow trigger.

## 2. Runtime Modes
### 2.1 Mode Selection
Mode selection is controlled by `IS_LOCAL_BC_DEV_MODE` in `src/config/devMode.ts`, derived from:

- `import.meta.env.DEV`
- `VITE_USE_LOCAL_BC_API === 'true'`

### 2.2 Power Apps Runtime Mode (Flow)
When local mode is off, the app calls:

- `PA_GetRecordsFromBCAPIService.Run({ text: 'customers', text_1: '' })`

This invokes the solution-aware flow connector in the Power Apps environment.

### 2.3 Local Development Mode (Direct BC via Proxy)
When local mode is on, the app calls:

- `fetchBusinessCentralEntity(BCEntitySet.Customers, filter)`

This sends a request to a same-origin dev endpoint:

- `POST /api/bc/entity`

The Vite middleware performs OAuth token retrieval and Business Central API calls server-side.

## 3. Architectural Data Flow
### 3.1 Power Apps Runtime Path
1. React app initializes in `App.tsx`.
2. `loadCustomersFromFlow` calls generated service `Run`.
3. Connector invokes Power Automate flow trigger.
4. Flow calls Business Central and returns JSON.
5. UI normalizes response and renders list/details.

### 3.2 Local Development Path
1. React app initializes in `App.tsx`.
2. `loadCustomersFromBusinessCentralDevApi` calls `fetchBusinessCentralEntity`.
3. Browser posts to `/api/bc/entity` (Vite middleware).
4. Middleware gets OAuth token from `login.microsoftonline.com`.
5. Middleware calls Business Central OData endpoint.
6. Middleware returns JSON payload to browser.
7. UI normalizes response and renders list/details.

## 3.3 Navigation Flow
1. The app is wrapped in `HashRouter` (`src/main.tsx`).
2. Route `#/` renders search + customer list.
3. Selecting a customer navigates to `#/customers/:customerId`.
4. Detail route resolves `customerId` from route params and renders the selected customer.
5. Back action navigates to `#/`.

Navigation schema (logical):

```json
{
  "routes": [
    { "path": "/", "view": "customer-list" },
    { "path": "/customers/:customerId", "view": "customer-detail" },
    { "path": "*", "redirectTo": "/" }
  ]
}
```

## 4. Schema and Contract Definitions
## 4.1 Power Apps App Configuration Schema (power.config.json)
Current configuration values (instance-specific):

```json
{
  "version": "1.0",
  "appId": "dabbfc16-d8fb-49fd-a9b4-f89f5de690e0",
  "environmentId": "46d325dc-7193-eb2b-bad6-f39a35c3625b",
  "buildPath": "./dist",
  "buildEntryPoint": "index.html",
  "connectionReferences": {
    "8e524d69-9dc5-4a77-863b-dc54aa419611": {
      "id": "/providers/Microsoft.PowerApps/apis/shared_logicflows",
      "dataSources": ["pa_getrecordsfrombcapi"],
      "workflowDetails": {
        "workflowName": "609c39a9-4826-4bae-31a0-3371af4c7bbc"
      }
    }
  }
}
```

Interpretation:

- `appId` and `environmentId` bind the deploy target.
- `buildPath` and `buildEntryPoint` define packaged artifact location.
- `connectionReferences` map generated data sources to logic flow connectors.

## 4.2 Flow Trigger OpenAPI Schema
From `.power/schemas/logicflows/PA_GetRecordsFromBCAPI.Schema.json`:

- Operation: `Run`
- Path: `/{connectionId}/triggers/manual/run`
- Method: `POST`
- Request body schema reference: `ManualTriggerInput`

`ManualTriggerInput` schema:

```json
{
  "type": "object",
  "properties": {
    "text": {
      "title": "endpoint",
      "type": "string"
    },
    "text_1": {
      "title": "filter",
      "type": "string"
    }
  },
  "required": ["text", "text_1"]
}
```

Generated TypeScript model in `src/generated/models/PA_GetRecordsFromBCAPIModel.ts`:

```ts
export interface ManualTriggerInput {
  text: string;
  text_1: string;
}
```

## 4.3 Generated Service Contract
From `src/generated/services/PA_GetRecordsFromBCAPIService.ts`:

```ts
public static async Run(input: ManualTriggerInput): Promise<IOperationResult<void>>
```

Although typed as `void`, runtime data is normalized by the UI through `normalizeCustomers`, which accepts either an array or an object containing `value: []`.

## 4.4 Local Proxy Request/Response Schema
Client request schema (logical):

```json
{
  "type": "object",
  "properties": {
    "entitySet": { "type": "string" },
    "apiType": { "type": "string", "enum": ["default", "custom"] },
    "filter": { "type": "string" }
  },
  "required": ["entitySet", "apiType"]
}
```

Client call in `src/services/businessCentralDevApi.ts`:

```ts
fetch('/api/bc/entity', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ entitySet, apiType, filter })
})
```

Proxy response schema (success):

```json
{
  "value": [
    {
      "id": "...",
      "number": "10000",
      "displayName": "Adatum Corporation"
    }
  ]
}
```

Proxy response schema (error):

```json
{
  "error": "Human-readable error message"
}
```

## 4.5 Domain Entity Schema (Customer)
UI-level customer schema in `App.tsx`:

```ts
type Customer = {
  id: string
  number: string
  displayName: string
  phoneNumber?: string
  city?: string
  country?: string
  currencyCode?: string
}
```

## 5. API Path Resolution Model
The local API client defines an entity registry:

```ts
export const BCEntitySet = {
  Customers: { entitySet: 'customers', apiType: 'default' }
}
```

This model binds each callable entity set to its API family:

- `default`: `/api/{version}/companies({companyId})/{entitySet}`
- `custom`: `/api/{publisher}/{group}/{version}/companies({companyId})/{entitySet}`

Path composition occurs in `vite.config.ts` via `buildApiPath` and `buildEntityUrl`.

## 6. Security and Compliance Considerations
### 6.1 CORS and Token Acquisition
Direct browser calls to Microsoft Entra token endpoint fail due to CORS restrictions for this pattern. The app resolves this by using server-side token exchange in Vite middleware.

### 6.2 Secret Handling
`VITE_` values are available to frontend code at build/dev time. In this project, token exchange is moved server-side in local mode, but production should continue to prefer Power Automate/managed connectors to avoid distributing secrets.

### 6.3 Error Surfaces
- Proxy returns structured JSON errors (`{ error: string }`).
- Client maps error payload to thrown `Error`.
- UI displays errors in a dedicated status block.

## 7. UI Behavior and Observability
### 7.1 Loading and Empty States
The app exposes:

- Loading indicator while fetching.
- Empty state message when no customers are returned.
- Error state message when service calls fail.

### 7.2 Route-Based Detail View
- Customer list and customer detail are separate routes.
- Deep-linking to a customer detail route is supported via hash URL.
- If a route references a missing customer ID, the UI shows `Customer not found.`

### 7.3 Data Source Badge
Header badge indicates active source:

- `Business Central API (default|custom)` in local mode.
- `Power Automate flow (pa_getrecordsfrombcapi.Run)` in hosted mode.

This improves runtime observability and reduces environment confusion.

## 8. Deployment Model
Build and deployment process:

```bash
npm run build
npx power-apps push
```

Artifacts:

- Built SPA from `dist/`
- Target app/environment from `power.config.json`

## 9. Known Technical Tradeoffs
1. The generated flow service is typed as `IOperationResult<void>`, which is less strict than actual payload behavior.
2. The local proxy exists only in dev server context (`vite.config.ts`) and is not a production backend.
3. Schema evolution in the flow may require regenerating service files (`npx power-apps add-flow ...`).

## 10. Conclusion
This app uses a pragmatic dual-path integration strategy: managed Power Automate connector execution for hosted/runtime deployment and a Vite server-side proxy for local development diagnostics. The schema contracts across `power.config.json`, flow OpenAPI metadata, generated TypeScript models, and local proxy payloads provide clear integration boundaries and predictable behavior for extending customer retrieval to additional entities.
