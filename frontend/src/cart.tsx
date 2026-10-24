import { displayName } from './display'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// The demo shopping cart. Kept in localStorage so it survives a refresh.
// Nothing here talks to a payment provider.

const STORAGE_KEY = 'cc_cart'
export const MAX_PER_ITEM = 10

export interface CartItem {
  product_id: string
  name: string
  price: number
  image_url: string
  size: string
  quantity: number
  /** Stock for this size when it was added, so the cart never allows more. */
  max: number
}

interface CartState {
  items: CartItem[]
  count: number
  subtotal: number
  add: (item: Omit<CartItem, 'quantity'>, quantity: number) => number
  setQuantity: (productId: string, size: string, quantity: number) => void
  remove: (productId: string, size: string) => void
  clear: () => void
}

const CartContext = createContext<CartState | null>(null)

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // Older saved carts may hold raw catalogue names, so tidy them on load.
    return raw ? (JSON.parse(raw) as CartItem[]).map((i) => ({ ...i, name: displayName(i.name) })) : []
  } catch {
    return []
  }
}

const limit = (item: Pick<CartItem, 'max'>) => Math.min(item.max, MAX_PER_ITEM)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  /** Adds to the cart (merging with the same product and size) and returns the new quantity. */
  const add = useCallback(
    (item: Omit<CartItem, 'quantity'>, quantity: number) => {
      const existing = items.find((i) => i.product_id === item.product_id && i.size === item.size)
      const result = Math.min((existing?.quantity ?? 0) + quantity, limit(item))
      setItems((current) =>
        existing
          ? current.map((i) =>
              i.product_id === item.product_id && i.size === item.size ? { ...i, max: item.max, quantity: result } : i,
            )
          : [...current, { ...item, quantity: result }],
      )
      return result
    },
    [items],
  )

  const setQuantity = useCallback((productId: string, size: string, quantity: number) => {
    setItems((current) =>
      current.map((i) =>
        i.product_id === productId && i.size === size ? { ...i, quantity: Math.max(1, Math.min(quantity, limit(i))) } : i,
      ),
    )
  }, [])

  const remove = useCallback((productId: string, size: string) => {
    setItems((current) => current.filter((i) => !(i.product_id === productId && i.size === size)))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [items, add, setQuantity, remove, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
