# Business Central Customers — Power Apps Code App

A phone-friendly Power Apps code app that shows a live customer list from Microsoft Dynamics 365 Business Central. Built with React + TypeScript + Vite, deployed as a Power Apps code app, and connected to Business Central through a Power Automate flow.

---

## What the App Does

- Loads customers from Business Central on startup via a Power Automate flow
- Displays a searchable, scrollable customer list
- Tap a customer to see details: number, phone, location, and currency
- Works on phone and desktop
- All Business Central authentication is handled by Power Automate — no secrets in the app

---

## Architecture

```
Power Apps (host)
  └── Code App (React / Vite)
        └── Power Automate Flow: "Get records from default BC API"
              └── Business Central API → customers endpoint
```

The app calls the flow using the `GetrecordsfromdefaultBCAPIService` generated service. The flow handles authentication to Business Central and returns the customer data. No credentials are stored in the app.

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

> Note: the Power Automate flow service only executes inside the Power Apps runtime. When running locally, the flow call will hang because there is no Power Apps context. Use `npx power-apps push` and test in the browser to verify flow connectivity.

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
  App.tsx              Main app component — customer list and detail panel
  App.css              Mobile-first styles
  index.css            Global styles
  generated/           Auto-generated flow service and models (do not edit)
    services/          GetrecordsfromdefaultBCAPIService.ts
    models/            GetrecordsfromdefaultBCAPIModel.ts
    index.ts
.power/
  schemas/
    logicflows/        GetrecordsfromdefaultBCAPI.Schema.json
power.config.json      App configuration — environment, app ID, flow references
```

---

## Security Notes

- Business Central client ID and secret live only inside the Power Automate flow configuration
- The app never handles or stores credentials
- The flow should be scoped to read-only Business Central API permissions where possible
- Do not commit `.env.local` to source control
