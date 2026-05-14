import { useEffect, useMemo, useState } from 'react'
import { GetrecordsfromdefaultBCAPIService } from './generated'
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
        console.log('Starting flow call...')
        console.log('Service:', GetrecordsfromdefaultBCAPIService)

        const result = await GetrecordsfromdefaultBCAPIService.Run({
          text: 'customers',
          text_1: '',
        })

        console.log('✅ Flow returned:', result)
        console.log('result.success:', result.success)
        console.log('result.data type:', typeof result.data)
        console.log('result.data:', JSON.stringify(result.data, null, 2))
        console.log('result.error:', result.error)

        if (!result.success) {
          throw new Error(`Flow execution failed: ${result.error?.message || 'Unknown error'}`)
        }

        const data = result.data as unknown
        console.log('Data from flow:', data)

        let list: Customer[] = []

        if (Array.isArray(data)) {
          list = data
        } else if (data && typeof data === 'object') {
          if ('value' in data && Array.isArray((data as { value: unknown }).value)) {
            list = (data as { value: Customer[] }).value
          }
        }

        console.log('Customers extracted:', list)
        setCustomers(list ?? [])
        setSelected((current) => current ?? list?.[0] ?? null)

        if (!list || list.length === 0) {
          setError('No customers returned from flow.')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('❌ Error:', errorMessage)
        setError(`Error: ${errorMessage}`)
      } finally {
        setLoading(false)
      }
    }

    console.log('useEffect triggered')
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

  return (
    <main className="shell">
      <header className="topbar">
        <h1>Customers</h1>
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
