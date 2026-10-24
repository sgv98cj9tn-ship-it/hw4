import type { Product } from './api'

// The catalogue has ~20 garment_type spellings and ~20 color names, so group
// them into a few shopper-friendly options. Rules are checked in order.

export const CATEGORIES = ['T-shirts', 'Long sleeve', 'Crewnecks', 'Hoodies', 'Quarter-zips', 'Jackets & fleece'] as const

const categoryRules: [RegExp, string][] = [
  [/quarter-zip/i, 'Quarter-zips'],
  [/hood/i, 'Hoodies'],
  [/jacket|fleece/i, 'Jackets & fleece'],
  [/t-shirt/i, 'T-shirts'],
  [/long-sleeve/i, 'Long sleeve'],
  [/crewneck|mockneck|sweatshirt/i, 'Crewnecks'],
]

export function categoryOf(p: Product): string {
  return categoryRules.find(([re]) => re.test(p.garment_type))?.[1] ?? 'Other'
}

export const COLOR_FAMILIES = [
  { name: 'Navy', swatch: '#1b2a4a' },
  { name: 'Blue', swatch: '#3d7bd9' },
  { name: 'White', swatch: '#f5f3ee' },
  { name: 'Gray', swatch: '#8d8d96' },
  { name: 'Black', swatch: '#111111' },
  { name: 'Red & pink', swatch: '#d9445a' },
  { name: 'Yellow & gold', swatch: '#e2b93b' },
  { name: 'Green', swatch: '#3f9b5c' },
] as const

const colorRules: [RegExp, string][] = [
  [/navy/i, 'Navy'],
  [/blue/i, 'Blue'],
  [/gray|grey|charcoal/i, 'Gray'],
  [/white|cream|ivory/i, 'White'],
  [/black/i, 'Black'],
  [/red|coral|pink/i, 'Red & pink'],
  [/yellow|gold/i, 'Yellow & gold'],
  [/green/i, 'Green'],
]

// The first entry in `colors` is the garment's own color; the rest are logo
// and trim colors, so only the first one is used for filtering.
// These products have no colors in the database; the main color is taken from their photos.
const MAIN_COLOR_OVERRIDES: Record<string, string> = {
  'benjamin-franklin-t-shirt': 'heather gray',
  'berkeley-sweater-fleece-jacket': 'heather gray',
  'timothy-dwight-college-crewneck': 'heather gray',
}

export function mainColorFamilyOf(p: Product): string | null {
  const main = p.colors[0] ?? MAIN_COLOR_OVERRIDES[p.product_id]
  if (!main) return null
  return colorRules.find(([re]) => re.test(main))?.[1] ?? null
}

export const PRICE_RANGES = [
  { id: 'under-50', label: 'Under $50', test: (price: number) => price < 50 },
  { id: '50-70', label: '$50 – $69', test: (price: number) => price >= 50 && price < 70 },
  { id: '70-plus', label: '$70 and up', test: (price: number) => price >= 70 },
] as const

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

export function hasSizeInStock(p: Product, size: string): boolean {
  return p.inventory?.some((s) => s.size === size && s.quantity > 0) ?? false
}

export const SORTS = [
  { id: 'name', label: 'Name (A–Z)' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
] as const

export interface Filters {
  q: string
  categories: string[]
  colors: string[]
  prices: string[]
  sizes: string[]
  sort: string
}

export function matches(p: Product, f: Filters, skip?: keyof Filters): boolean {
  if (skip !== 'q' && f.q) {
    const haystack = [p.name, p.garment_type, p.description, ...p.colors, ...p.search_tags].join(' ').toLowerCase()
    if (!haystack.includes(f.q.toLowerCase())) return false
  }
  if (skip !== 'categories' && f.categories.length && !f.categories.includes(categoryOf(p))) return false
  if (skip !== 'colors' && f.colors.length) {
    const family = mainColorFamilyOf(p)
    if (!family || !f.colors.includes(family)) return false
  }
  if (skip !== 'prices' && f.prices.length) {
    const ranges = PRICE_RANGES.filter((r) => f.prices.includes(r.id))
    if (!ranges.some((r) => r.test(p.price))) return false
  }
  // A product matches a size filter if any chosen size is in stock.
  if (skip !== 'sizes' && f.sizes.length && !f.sizes.some((s) => hasSizeInStock(p, s))) return false
  return true
}

export function sortProducts(list: Product[], sort: string): Product[] {
  const copy = [...list]
  if (sort === 'price-asc') copy.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
  else if (sort === 'price-desc') copy.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
  else copy.sort((a, b) => a.name.localeCompare(b.name))
  return copy
}

// ---------- Collections ("Shop by what you love" on the Home page) ----------
// Matched against each product's name and search tags (whole words only).

export const COLLECTIONS = [
  {
    id: 'colleges',
    title: 'Residential colleges',
    keywords: [
      'benjamin franklin', 'berkeley', 'branford', 'davenport', 'ezra stiles', 'grace hopper', 'jonathan edwards',
      'morse', 'pauli murray', 'pierson', 'saybrook', 'silliman', 'timothy dwight', 'trumbull',
    ],
  },
  {
    id: 'sports',
    title: 'Yale sports',
    keywords: [
      'hockey', 'baseball', 'football', 'soccer', 'tennis', 'golf', 'lacrosse', 'fencing', 'sailing', 'squash',
      'diving', 'swimming', 'volleyball', 'basketball', 'track', 'rowing', 'the game',
    ],
  },
  {
    id: 'schools',
    title: 'Graduate & professional schools',
    keywords: ['school of', 'law school', 'divinity', 'som', 'forest school', 'graduate'],
  },
  {
    id: 'family',
    title: 'For the family',
    keywords: ['mom', 'dad', 'grandma', 'grandpa', 'aunt', 'uncle', 'brother', 'sister', 'cousin', 'family'],
  },
] as const

export type CollectionId = (typeof COLLECTIONS)[number]['id']

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function inCollection(p: Product, id: string): boolean {
  const collection = COLLECTIONS.find((c) => c.id === id)
  if (!collection) return false
  const text = [p.name, ...p.search_tags].join(' ').toLowerCase()
  return collection.keywords.some((k) => new RegExp(`\\b${escapeRe(k)}\\b`).test(text))
}
