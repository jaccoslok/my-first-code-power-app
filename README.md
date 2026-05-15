# Business Central Customers — Power Apps Code App

A phone-friendly Power Apps code app that shows a live customer list from Microsoft Dynamics 365 Business Central. Built with React + TypeScript + Vite, deployed as a Power Apps code app, and connected through either Power Automate (hosted/runtime path) or a local Vite proxy (local development path).

---

## What the App Does

- Loads customers from Business Central on startup
- Displays a searchable, scrollable customer list
- Tap a customer to open a dedicated customer detail page
- Customer detail page includes a back action to return to the list
- Works on phone and desktop
- Shows a source badge in the UI indicating whether data comes from Power Automate or Business Central API (default/custom)

---

## Architecture

```
Power Apps (host)
  └── Code App (React)
    └── Power Automate Flow: "Get records from default BC API"
      └── Business Central API → customers endpoint

Local Dev (Vite)
  └── Code App (React)
    └── Vite Middleware: POST /api/bc/entity
      ├── Azure AD token endpoint
      └── Business Central API → customers endpoint

Navigation
  └── HashRouter routes
    ├── #/                     customer list + search
    └── #/customers/:customerId customer detail page
```

The app calls the flow using the `PA_GetRecordsFromBCAPIService` generated service in hosted/runtime mode. In local mode, the app calls `/api/bc/entity`; Vite middleware performs token acquisition and Business Central calls server-side to avoid browser CORS issues.

The app uses `HashRouter` so navigation works reliably in embedded/hosted contexts where server-side route rewrites are not available.

---

## Power Automate Flow

Flow name: **Get records from default BC API**  
Flow ID: `609c39a9-4826-4bae-31a0-3371af4c7bbc`

The flow accepts two inputs:

| Parameter | Title    | Used for                               |
|-----------|----------|----------------------------------------|
| `text`    | endpoint | BC API entity, e.g. `customers`        |
| `text_1`  | filter   | Optional OData filter string           |

The flow must include a **Response** action that returns the Business Central API response as JSON with status `200`. Without a Response action, the service returns `void` and no data reaches the app.

Expected response shape from the flow:

```json
{
  "value": [
    {
      "id": "...",
      "number": "10000",
      "displayName": "Adatum Corporation",
      "phoneNumber": "+31 10 123 4567",
      "city": "Rotterdam",
      "country": "NL",
      "currencyCode": "EUR"
    }
  ]
}
```

---

## Prerequisites

- Node.js 18 or later
- Power Platform environment access
- Power Apps license
- The Power Automate flow deployed and solution-aware

---

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

For local testing in VS Code, you have two options:

1. Set `VITE_USE_LOCAL_BC_API=true` in `.env.local` to use the local Vite proxy (`/api/bc/entity`) for Business Central Sandbox calls.
2. Leave `VITE_USE_LOCAL_BC_API=false` to keep using the generated Power Automate flow path.

In production (Power Apps runtime), the app uses the generated flow service.

### Local Business Central Scaffold

The local DEV scaffold includes:

- Vite middleware endpoint: `POST /api/bc/entity`
- Server-side OAuth2 client credentials request to Azure AD token endpoint (no browser token call)
- Base URL builder for Business Central API:
  - Default API: `v2.0/{tenant}/{environment}/api/{version}/companies({companyId})/{entitySet}`
  - Custom API: `v2.0/{tenant}/{environment}/api/{publisher}/{group}/{version}/companies({companyId})/{entitySet}`
- Entity registry in code (`BCEntitySet`) with `entitySet` + `apiType` metadata
- Generic entity fetch function (`fetchBusinessCentralEntity<T>(entity, filter)`)
- Optional OData filter through `VITE_BC_ODATA_FILTER`

Use `.env.example` as a template for required values.

> Important: the local proxy runs only in Vite development mode. In production (Power Apps runtime), use the flow path.

---

## Build and Deploy

Build the app:

```bash
npm run build
```

Deploy to Power Apps:

```bash
npx power-apps push
```

Open the deployed app:  
[https://apps.powerapps.com/play/e/46d325dc-7193-eb2b-bad6-f39a35c3625b/app/dabbfc16-d8fb-49fd-a9b4-f89f5de690e0](https://apps.powerapps.com/play/e/46d325dc-7193-eb2b-bad6-f39a35c3625b/app/dabbfc16-d8fb-49fd-a9b4-f89f5de690e0)

---

## Updating the Flow

If the flow definition changes (new parameters, updated connections), regenerate the service:

```bash
npx power-apps add-flow --flow-id 609c39a9-4826-4bae-31a0-3371af4c7bbc
npm run build
npx power-apps push
```

---

## Project Structure

```
src/
  App.tsx              Main app component — list route and customer detail route
  main.tsx             App bootstrap + HashRouter
  App.css              Mobile-first styles
  index.css            Global styles
  generated/           Auto-generated flow service and models (do not edit)
    services/          PA_GetRecordsFromBCAPIService.ts
    models/            PA_GetRecordsFromBCAPIModel.ts
    index.ts
.power/
  schemas/
    logicflows/        PA_GetRecordsFromBCAPI.Schema.json
power.config.json      App configuration — environment, app ID, flow references
```

---

## Security Notes

- In production (Power Apps runtime), Business Central authentication is handled by Power Automate
- In local development mode, credentials are read by Vite middleware from `.env.local`
- Browser-side token requests are avoided; token exchange is server-side in local dev
- The flow should be scoped to read-only Business Central API permissions where possible
- Do not commit `.env.local` to source control

---

## Technical Documentation

See `TECHNICAL_PAPER.md` for the full architecture and schema-focused technical paper.
