import { useEffect, useMemo, useState } from 'react'
import { IS_LOCAL_BC_DEV_MODE } from './config/devMode'
import { GetrecordsfromdefaultBCAPIService } from './generated'
import { fetchBusinessCentralEntity, BCEntitySet } from './services/businessCentralDevApi'
import './App.css'



type Customer = {
  id: string
  number: string
  displayName: string
  phoneNumber?: string
  city?: string
  country?: string
  currencyCode?: string
}

function normalizeCustomers(data: unknown): Customer[] {
  if (Array.isArray(data)) {
    return data as Customer[]
  }

  if (data && typeof data === 'object' && 'value' in data) {
    const list = (data as { value: unknown }).value

    if (Array.isArray(list)) {
      return list as Customer[]
    }
  }

  return []
}

async function loadCustomersFromFlow(): Promise<Customer[]> {
  const result = await GetrecordsfromdefaultBCAPIService.Run({
    text: 'customers',
    text_1: '',
  })

  if (!result.success) {
    throw new Error(`Flow execution failed: ${result.error?.message || 'Unknown error'}`)
  }

  return normalizeCustomers(result.data as unknown)
}

async function loadCustomersFromBusinessCentralDevApi(): Promise<Customer[]> {
  const filter = import.meta.env.VITE_BC_ODATA_FILTER?.trim()
  return fetchBusinessCentralEntity<Customer>(BCEntitySet.Customers, filter)
}

function App() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selected, setSelected] = useState<Customer | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCustomers() {
      setLoading(true)
      setError(null)

      try {
        const list = IS_LOCAL_BC_DEV_MODE
          ? await loadCustomersFromBusinessCentralDevApi()
          : await loadCustomersFromFlow()

        setCustomers(list ?? [])
        setSelected((current) => current ?? list?.[0] ?? null)

        if (!list || list.length === 0) {
          setError('No customers returned.')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        setError(`Error: ${errorMessage}`)
      } finally {
        setLoading(false)
      }
    }

    loadCustomers()
  }, [])

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return customers
    }

    return customers.filter((customer) => {
      const lookup = [
        customer.displayName,
        customer.number,
        customer.phoneNumber ?? '',
        customer.city ?? '',
      ]

      return lookup.some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [customers, query])

  const headerTitle = loading ? 'Loading customers...' : `${filteredCustomers.length} customers`
  const sourceLabel = IS_LOCAL_BC_DEV_MODE
    ? `Business Central API (${BCEntitySet.Customers.apiType})`
    : 'Power Automate flow (getrecordsfromdefaultbcapi.Run)'

  return (
    <main className="shell">
      <header className="topbar">
        <div className="titleRow">
          <h1>Customers</h1>
          <span
            className={IS_LOCAL_BC_DEV_MODE ? 'sourceBadge api' : 'sourceBadge flow'}
            title="Current data source"
          >
            Source: {sourceLabel}
          </span>
        </div>
        <p>{headerTitle}</p>
      </header>

      <section className="searchPanel">
        <label htmlFor="customer-search">Search</label>
        <input
          id="customer-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, number, phone, city"
          autoComplete="off"
        />
      </section>

      {error ? <div className="status error">{error}</div> : null}
      {!error && loading ? <div className="status">Loading list...</div> : null}

      {!loading && !error ? (
        <section className="content">
          <ul className="customerList" aria-label="Customer list">
            {filteredCustomers.map((customer) => {
              const active = selected?.id === customer.id

              return (
                <li key={customer.id}>
                  <button
                    type="button"
                    className={active ? 'customerItem active' : 'customerItem'}
                    onClick={() => setSelected(customer)}
                  >
                    <span className="name">{customer.displayName}</span>
                    <span className="meta">#{customer.number}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <aside className="detailCard" aria-live="polite">
            {selected ? (
              <>
                <h2>{selected.displayName}</h2>
                <dl>
                  <div>
                    <dt>Number</dt>
                    <dd>{selected.number || '-'}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{selected.phoneNumber || '-'}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>
                      {[selected.city, selected.country].filter(Boolean).join(', ') || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt>Currency</dt>
                    <dd>{selected.currencyCode || '-'}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p>Select a customer to see details.</p>
            )}
          </aside>
        </section>
      ) : null}
    </main>
  )
}

export default App
