import { displayName } from './display'

export interface SizeStock {
  size: string
  quantity: number
}

export interface Product {
  product_id: string
  name: string
  garment_type: string
  description: string
  colors: string[]
  search_tags: string[]
  image_url: string
  price: number
  total_stock: number
  inventory?: SizeStock[]
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'not-found' : `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

// Product names are shown with displayName() ("1 4 Zip" -> "Quarter-Zip").
const named = <T extends { name: string }>(p: T): T => ({ ...p, name: displayName(p.name) })

export const fetchProducts = () => getJson<Product[]>('/api/products').then((ps) => ps.map(named))

export const fetchProduct = (id: string) =>
  getJson<Product>(`/api/products/${encodeURIComponent(id)}`).then(named)

export interface ProductCard {
  product_id: string
  name: string
  price: number
  image_url: string
}

export interface ChatReply {
  reply: string
  products: ProductCard[]
  /** True when `products` should be shown on the Products page. */
  show_on_page: boolean
}

export interface PageContext {
  path: string
  product_id: string | null
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface SavedChatMessage extends ChatTurn {
  id: number
  products: ProductCard[]
  created_at: string
}

export async function sendChatMessage(
  message: string,
  options: { token: string | null; page: PageContext; history: ChatTurn[] },
): Promise<ChatReply> {
  let res: Response
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      // Logged-in history comes from the database, so only guests send theirs.
      body: JSON.stringify({ message, page: options.page, history: options.token ? [] : options.history }),
    })
  } catch {
    throw new Error('Couldn’t reach the assistant. Check that the backend is running.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : 'The assistant ran into a problem. Please try again.')
  }
  const reply = (await res.json()) as ChatReply
  return { ...reply, reply: displayName(reply.reply), products: reply.products.map(named) }
}

export async function fetchChatHistory(token: string): Promise<SavedChatMessage[]> {
  const res = await fetch('/api/chat/history', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Couldn’t load chat history (${res.status})`)
  const saved = (await res.json()) as SavedChatMessage[]
  return saved.map((m) => ({ ...m, content: displayName(m.content), products: m.products.map(named) }))
}

// ---------- Accounts ----------

export interface User {
  id: number
  first_name: string
  last_name: string
  email: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface SignupInput {
  first_name: string
  last_name: string
  email: string
  password: string
}

const FIELD_LABELS: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  email: 'Email',
  password: 'Password',
  garment_category: 'Clothing type',
  quantity: 'Quantity',
  needed_by: 'Date needed',
  customization: 'Customization details',
}

// Turn FastAPI error bodies into one readable sentence.
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail) && body.detail.length) {
      const e = body.detail[0]
      const field = FIELD_LABELS[e.loc?.at(-1)] ?? 'A field'
      const msg = String(e.msg).replace(/^Value error, /, '')
      if (msg.startsWith('String should have at least')) return `${field} ${msg.replace('String should have', 'needs')}.`
      if (msg.startsWith('Input should be')) return `${field}: ${msg.replace('Input should be', 'must be')}.`
      return field === 'A field' ? msg : `${field}: ${msg}`
    }
  } catch {
    /* fall through */
  }
  return 'Something went wrong. Please try again.'
}

async function postAuth(url: string, body: object): Promise<AuthResponse> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Can’t reach the server. Check that the backend is running.')
  }
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<AuthResponse>
}

export const signup = (input: SignupInput) => postAuth('/api/auth/signup', input)

export const login = (email: string, password: string) => postAuth('/api/auth/login', { email, password })

export async function fetchMe(token: string): Promise<User | null> {
  const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json() as Promise<User>
}

export const formatPrice = (price: number) =>
  price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

// ---------- "You may also like" and demo checkout ----------

export const fetchSimilar = (id: string) =>
  getJson<Product[]>(`/api/products/${encodeURIComponent(id)}/similar`).then((ps) => ps.map(named))

export interface DemoOrderInput {
  name: string
  email: string
  delivery: 'pickup' | 'shipping'
  items: { product_id: string; size: string; quantity: number }[]
}

export interface DemoOrder {
  order_number: string
  name: string
  delivery: 'pickup' | 'shipping'
  items: { name: string; size: string; quantity: number; price: number }[]
  subtotal: number
  note: string
}

export async function placeDemoOrder(input: DemoOrderInput): Promise<DemoOrder> {
  let res: Response
  try {
    res = await fetch('/api/orders/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error('Can’t reach the server. Check that the backend is running.')
  }
  if (!res.ok) throw new Error(await errorMessage(res))
  const order = (await res.json()) as DemoOrder
  return { ...order, items: order.items.map(named) }
}

// ---------- Custom order requests ----------

export const CUSTOM_CATEGORIES = ['T-shirt', 'Long-sleeve shirt', 'Crewneck', 'Hoodie', 'Quarter-Zip', 'Jacket or fleece', 'Other']

export interface CustomRequestInput {
  first_name: string
  last_name: string
  email: string
  garment_category: string
  quantity: number
  needed_by: string // YYYY-MM-DD
  customization: string
}

export interface CustomRequestConfirmation {
  request_number: string
  first_name: string
  garment_category: string
  quantity: number
  needed_by: string
}

export async function submitCustomRequest(
  input: CustomRequestInput,
  token: string | null,
): Promise<CustomRequestConfirmation> {
  let res: Response
  try {
    res = await fetch('/api/custom-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error('Can’t reach the server. Check that the backend is running.')
  }
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<CustomRequestConfirmation>
}
