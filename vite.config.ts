import { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { powerApps } from '@microsoft/power-apps-vite/plugin'

type ApiType = 'default' | 'custom'

type DevProxyRequestBody = {
  entitySet?: string
  apiType?: ApiType
  filter?: string
}

function getRequiredEnv(env: Record<string, string>, name: string): string {
  const value = env[name]

  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`)
  }

  return value.trim()
}

function readJsonBody(req: IncomingMessage): Promise<DevProxyRequestBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8')
        resolve(raw ? (JSON.parse(raw) as DevProxyRequestBody) : {})
      } catch {
        reject(new Error('Request body must be valid JSON'))
      }
    })

    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

async function getAccessToken(env: Record<string, string>): Promise<string> {
  const tenantId = getRequiredEnv(env, 'VITE_BC_TENANT_ID')
  const clientId = getRequiredEnv(env, 'VITE_BC_CLIENT_ID')
  const clientSecret = getRequiredEnv(env, 'VITE_BC_CLIENT_SECRET')
  const scope = getRequiredEnv(env, 'VITE_BC_SCOPE')

  const tokenEndpoint = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Token request failed (${response.status}): ${details || 'Unknown error'}`)
  }

  const payload = (await response.json()) as { access_token?: string }

  if (!payload.access_token) {
    throw new Error('Token response did not include access_token')
  }

  return payload.access_token
}

function buildApiPath(env: Record<string, string>, apiType: ApiType): string {
  const apiVersion = getRequiredEnv(env, 'VITE_BC_API_VERSION')

  if (apiType === 'custom') {
    const apiPublisher = getRequiredEnv(env, 'VITE_BC_API_PUBLISHER')
    const apiGroup = getRequiredEnv(env, 'VITE_BC_API_GROUP')

    return [apiPublisher, apiGroup, apiVersion].map(encodeURIComponent).join('/')
  }

  return encodeURIComponent(apiVersion)
}

function buildEntityUrl(env: Record<string, string>, entitySet: string, apiType: ApiType, filter?: string): string {
  const tenantId = getRequiredEnv(env, 'VITE_BC_TENANT_ID')
  const environment = getRequiredEnv(env, 'VITE_BC_ENVIRONMENT')
  const companyId = getRequiredEnv(env, 'VITE_BC_COMPANY_ID')

  const baseUrl = [
    'https://api.businesscentral.dynamics.com',
    'v2.0',
    encodeURIComponent(tenantId),
    encodeURIComponent(environment),
    'api',
    buildApiPath(env, apiType),
    `companies(${encodeURIComponent(companyId)})`,
  ].join('/')

  const url = new URL(`${baseUrl}/${encodeURIComponent(entitySet)}`)

  if (filter && filter.trim()) {
    url.searchParams.set('$filter', filter.trim())
  }

  return url.toString()
}

function businessCentralDevProxyPlugin(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    name: 'business-central-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/bc/entity', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed. Use POST.' })
          return
        }

        try {
          const body = await readJsonBody(req)
          const entitySet = body.entitySet?.trim()
          const apiType: ApiType = body.apiType === 'custom' ? 'custom' : 'default'

          if (!entitySet) {
            sendJson(res, 400, { error: 'Missing entitySet in request body.' })
            return
          }

          const accessToken = await getAccessToken(env)
          const url = buildEntityUrl(env, entitySet, apiType, body.filter)

          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          })

          if (!response.ok) {
            const details = await response.text()
            sendJson(res, response.status, {
              error: `Business Central request failed (${response.status}): ${details || 'Unknown error'}`,
            })
            return
          }

          const data = await response.json()
          sendJson(res, 200, data)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          sendJson(res, 500, { error: message })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), powerApps(), businessCentralDevProxyPlugin(mode)],
}))
