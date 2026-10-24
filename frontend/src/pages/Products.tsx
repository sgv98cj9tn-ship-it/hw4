import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchProducts, formatPrice, type Product } from '../api'
import { useChatResults } from '../chatResults'
import {
  CATEGORIES,
  COLLECTIONS,
  COLOR_FAMILIES,
  PRICE_RANGES,
  SIZES,
  SORTS,
  categoryOf,
  mainColorFamilyOf,
  hasSizeInStock,
  inCollection,
  matches,
  sortProducts,
  type Filters,
} from '../filters'

type ListKey = 'categories' | 'colors' | 'prices' | 'sizes'
const LIST_KEYS: ListKey[] = ['categories', 'colors', 'prices', 'sizes']

function readFilters(params: URLSearchParams): Filters {
  const list = (key: string) => params.get(key)?.split(',').filter(Boolean) ?? []
  return {
    q: params.get('q') ?? '',
    categories: list('categories'),
    colors: list('colors'),
    prices: list('prices'),
    sizes: list('sizes'),
    sort: params.get('sort') ?? 'name',
  }
}

export default function Products() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const [panelOpen, setPanelOpen] = useState(false)
  const filters = useMemo(() => readFilters(params), [params])
  const { results: chatResults, clear: clearChatResults } = useChatResults()

  // ?collection=colleges shows one "Shop by what you love" collection from the Home page.
  const collection = COLLECTIONS.find((c) => c.id === params.get('collection')) ?? null

  // ?chat=1 means "show what the chat agent found" instead of the full catalogue.
  const chatMode = !collection && params.get('chat') === '1' && chatResults !== null

  // The products this page starts from: the chat's matches (in the agent's order) or everything.
  const base = useMemo(() => {
    if (!products) return null
    if (collection) return products.filter((p) => inCollection(p, collection.id))
    if (!chatMode) return products
    const byId = new Map(products.map((p) => [p.product_id, p]))
    return chatResults!.productIds.map((id) => byId.get(id)).filter((p): p is Product => p !== undefined)
  }, [products, collection, chatMode, chatResults])

  // A ?chat=1 link with no saved results (e.g. a new tab) falls back to the full catalogue.
  useEffect(() => {
    if (params.get('chat') === '1' && chatResults === null) {
      const next = new URLSearchParams(params)
      next.delete('chat')
      setParams(next, { replace: true })
    }
  }, [params, chatResults, setParams])

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setError('We couldn’t load the catalogue. Make sure the backend is running, then refresh.'))
  }, [])

  const update = (key: keyof Filters, value: string | string[]) => {
    const next = new URLSearchParams(params)
    const str = Array.isArray(value) ? value.join(',') : value
    if (str && !(key === 'sort' && str === 'name')) next.set(key, str)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const toggle = (key: ListKey, value: string) => {
    const current = filters[key]
    update(key, current.includes(value) ? current.filter((v) => v !== value) : [...current, value])
  }

  const clearAll = () => {
    const next: Record<string, string> = {}
    if (filters.sort !== 'name') next.sort = filters.sort
    if (chatMode) next.chat = '1'
    if (collection) next.collection = collection.id
    setParams(next, { replace: true })
  }

  const exitChatResults = () => {
    clearChatResults()
    setParams({}, { replace: true })
  }

  // Keep the agent's order for chat results unless the shopper picks a sort.
  const keepAgentOrder = chatMode && !params.get('sort')

  const visible = useMemo(
    () => {
      if (!base) return []
      const filtered = base.filter((p) => matches(p, filters))
      return keepAgentOrder ? filtered : sortProducts(filtered, filters.sort)
    },
    [base, filters, keepAgentOrder],
  )

  // How many products each option would show, given the other active filters.
  const counts = useMemo(() => {
    const result = { categories: {}, colors: {}, prices: {}, sizes: {} } as Record<ListKey, Record<string, number>>
    if (!base) return result
    for (const key of LIST_KEYS) {
      for (const p of base.filter((p) => matches(p, filters, key))) {
        const values =
          key === 'categories'
            ? [categoryOf(p)]
            : key === 'colors'
              ? [mainColorFamilyOf(p) ?? '']
              : key === 'prices'
                ? PRICE_RANGES.filter((r) => r.test(p.price)).map((r) => r.id)
                : SIZES.filter((s) => hasSizeInStock(p, s))
        for (const v of values) result[key][v] = (result[key][v] ?? 0) + 1
      }
    }
    return result
  }, [base, filters])

  // Only offer colors that at least one garment actually is.
  const colorOptions = useMemo(() => {
    const present = new Set(products?.map(mainColorFamilyOf))
    return COLOR_FAMILIES.filter((c) => present.has(c.name))
  }, [products])

  const activeChips = [
    ...filters.categories.map((v) => ({ key: 'categories' as const, value: v, label: v })),
    ...filters.colors.map((v) => ({ key: 'colors' as const, value: v, label: v })),
    ...filters.prices.map((v) => ({
      key: 'prices' as const,
      value: v,
      label: PRICE_RANGES.find((r) => r.id === v)?.label ?? v,
    })),
    ...filters.sizes.map((v) => ({ key: 'sizes' as const, value: v, label: `Size ${v}` })),
  ]
  const activeCount = activeChips.length + (filters.q ? 1 : 0)

  return (
    <div className="container section">
      <div className="page-head">
        <div>
          <p className="eyebrow">Shop</p>
          <h1 className="page-title">Products</h1>
        </div>
        <label className="search">
          <span className="sr-only">Search products</span>
          <input
            type="search"
            placeholder="Search hoodies, colleges, sports…"
            value={filters.q}
            onChange={(e) => update('q', e.target.value)}
          />
        </label>
      </div>

      <div className="shop">
        <aside className={`filters ${panelOpen ? 'is-open' : ''}`} aria-label="Product filters">
          <div className="filters-head">
            <h2>Filters</h2>
            {activeCount > 0 && (
              <button type="button" className="link-btn" onClick={clearAll}>
                Clear all
              </button>
            )}
          </div>

          <fieldset className="filter-group">
            <legend>Category</legend>
            {CATEGORIES.map((c) => (
              <CheckOption
                key={c}
                label={c}
                count={counts.categories[c] ?? 0}
                checked={filters.categories.includes(c)}
                onChange={() => toggle('categories', c)}
              />
            ))}
          </fieldset>

          <fieldset className="filter-group">
            <legend>Color</legend>
            <div className="swatch-grid">
              {colorOptions.map((c) => {
                const checked = filters.colors.includes(c.name)
                const count = counts.colors[c.name] ?? 0
                return (
                  <label key={c.name} className={`swatch-option ${checked ? 'is-checked' : ''} ${count === 0 && !checked ? 'is-empty' : ''}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={count === 0 && !checked}
                      onChange={() => toggle('colors', c.name)}
                    />
                    <span className="swatch" style={{ background: c.swatch }} aria-hidden="true" />
                    <span className="swatch-label">{c.name}</span>
                    <span className="option-count">{count}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="filter-group">
            <legend>Price</legend>
            {PRICE_RANGES.map((r) => (
              <CheckOption
                key={r.id}
                label={r.label}
                count={counts.prices[r.id] ?? 0}
                checked={filters.prices.includes(r.id)}
                onChange={() => toggle('prices', r.id)}
              />
            ))}
          </fieldset>

          <fieldset className="filter-group">
            <legend>Size in stock</legend>
            <div className="size-filter">
              {SIZES.map((s) => {
                const checked = filters.sizes.includes(s)
                const count = counts.sizes[s] ?? 0
                return (
                  <label key={s} className={`size-chip ${checked ? 'is-checked' : ''}`} title={`${count} products`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={count === 0 && !checked}
                      onChange={() => toggle('sizes', s)}
                    />
                    {s}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <button type="button" className="btn btn-primary btn-block filters-done" onClick={() => setPanelOpen(false)}>
            Show {visible.length} {visible.length === 1 ? 'item' : 'items'}
          </button>
        </aside>

        <section className="shop-results" aria-label="Products">
          {collection && (
            <div className="chat-banner" role="status">
              <span className="chat-banner-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M12 2 2 7l10 5 10-5-10-5Zm-8 9.5V17l8 4 8-4v-5.5l-8 4-8-4Z" />
                </svg>
              </span>
              <div className="chat-banner-text">
                <p className="chat-banner-title">{collection.title}</p>
                <p className="chat-banner-query">
                  {base ? `${base.length} ${base.length === 1 ? 'item' : 'items'}` : 'Loading…'}
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>
                ← All products
              </button>
            </div>
          )}

          {chatMode && (
            <div className="chat-banner" role="status">
              <span className="chat-banner-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Z" />
                </svg>
              </span>
              <div className="chat-banner-text">
                <p className="chat-banner-title">
                  Chat results: {base?.length ?? chatResults!.productIds.length}{' '}
                  {(base?.length ?? chatResults!.productIds.length) === 1 ? 'item' : 'items'}
                </p>
                <p className="chat-banner-query">For “{chatResults!.query}”</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={exitChatResults}>
                Clear · see all products
              </button>
            </div>
          )}

          <div className="results-bar">
            <button
              type="button"
              className="btn btn-ghost btn-sm filters-toggle"
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen((o) => !o)}
            >
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
            <p className="muted result-count" aria-live="polite">
              {base ? `${visible.length} of ${base.length} items` : ''}
            </p>
            <label className="sort">
              <span>Sort</span>
              <select
                value={keepAgentOrder ? 'chat' : filters.sort}
                onChange={(e) => update('sort', e.target.value === 'chat' ? '' : e.target.value)}
              >
                {chatMode && <option value="chat">Chat order</option>}
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {activeChips.length > 0 && (
            <ul className="active-filters" aria-label="Active filters">
              {activeChips.map((c) => (
                <li key={`${c.key}-${c.value}`}>
                  <button type="button" className="active-chip" onClick={() => toggle(c.key, c.value)}>
                    {c.label} <span aria-hidden="true">×</span>
                    <span className="sr-only">Remove filter</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="state state-error" role="alert">
              {error}
            </p>
          )}

          {!error && !products && (
            <div className="product-grid" aria-busy="true" aria-label="Loading products">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="product-card skeleton" />
              ))}
            </div>
          )}

          {products &&
            (visible.length === 0 ? (
              <div className="state empty">
                <p>No products match these filters.</p>
                <button type="button" className="btn btn-primary btn-sm" onClick={clearAll}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="product-grid">
                {visible.map((p) => (
                  <Link to={`/products/${p.product_id}`} key={p.product_id} className="product-card">
                    <div className="product-image">
                      <img src={p.image_url} alt={p.name} loading="lazy" />
                      {p.total_stock === 0 && <span className="badge">Sold out</span>}
                    </div>
                    <div className="product-body">
                      <p className="product-type">{p.garment_type}</p>
                      <h2 className="product-name">{p.name}</h2>
                      <p className="product-desc">{p.description}</p>
                      <p className="product-price">{formatPrice(p.price)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
        </section>
      </div>
    </div>
  )
}

function CheckOption(props: { label: string; count: number; checked: boolean; onChange: () => void }) {
  const disabled = props.count === 0 && !props.checked
  return (
    <label className={`check-option ${disabled ? 'is-empty' : ''}`}>
      <input type="checkbox" checked={props.checked} disabled={disabled} onChange={props.onChange} />
      <span>{props.label}</span>
      <span className="option-count">{props.count}</span>
    </label>
  )
}
