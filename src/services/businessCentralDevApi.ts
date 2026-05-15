type BCEntitySetEntry = {
  entitySet: string
  apiType: 'default' | 'custom'
}

export const BCEntitySet = {
  Customers: { entitySet: 'customers', apiType: 'default' },
} as const satisfies Record<string, BCEntitySetEntry>

export type BCEntitySet = (typeof BCEntitySet)[keyof typeof BCEntitySet]

type ODataResponse<T> = {
  value?: T[]
}

export async function fetchBusinessCentralEntity<T>(entity: BCEntitySetEntry, filter?: string): Promise<T[]> {
  const response = await fetch('/api/bc/entity', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      entitySet: entity.entitySet,
      apiType: entity.apiType,
      filter,
    }),
  })

  if (!response.ok) {
    const details = await response.json().catch(() => null)
    const message =
      details && typeof details === 'object' && 'error' in details
        ? String(details.error)
        : `Business Central request failed (${response.status})`
    throw new Error(message)
  }

  const data = (await response.json()) as ODataResponse<T> | T[]

  if (Array.isArray(data)) {
    return data
  }

  return Array.isArray(data.value) ? data.value : []
}
