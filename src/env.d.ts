/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_LOCAL_BC_API?: string
  readonly VITE_BC_TENANT_ID?: string
  readonly VITE_BC_ENVIRONMENT?: string
  readonly VITE_BC_COMPANY_ID?: string
  readonly VITE_BC_API_PUBLISHER?: string
  readonly VITE_BC_API_GROUP?: string
  readonly VITE_BC_API_VERSION?: string
  readonly VITE_BC_SCOPE?: string
  readonly VITE_BC_CLIENT_ID?: string
  readonly VITE_BC_CLIENT_SECRET?: string
  readonly VITE_BC_ODATA_FILTER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
