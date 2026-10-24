import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct, fetchSimilar, formatPrice, type Product } from '../api'
import { MAX_PER_ITEM, useCart } from '../cart'

export default function ProductDetail() {
  const { productId = '' } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState<string | null>(null)
  const [similar, setSimilar] = useState<Product[] | null>(null)
  const cart = useCart()

  useEffect(() => {
    setProduct(null)
    setError(null)
    setSelectedSize(null)
    setQuantity(1)
    setAdded(null)
    setSimilar(null)
    fetchProduct(productId)
      .then(setProduct)
      .catch((e: Error) =>
        setError(e.message === 'not-found' ? 'We couldn’t find that product.' : 'We couldn’t load this product. Please try again.'),
      )
    fetchSimilar(productId)
      .then(setSimilar)
      .catch(() => setSimilar([]))
  }, [productId])

  if (error) {
    return (
      <div className="container section">
        <p className="state state-error" role="alert">
          {error}
        </p>
        <Link to="/products" className="btn btn-ghost">
          ← Back to products
        </Link>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container section" aria-busy="true">
        <p className="state">Loading product…</p>
      </div>
    )
  }

  const selected = product.inventory?.find((s) => s.size === selectedSize)
  const inCart = selected
    ? (cart.items.find((i) => i.product_id === product.product_id && i.size === selected.size)?.quantity ?? 0)
    : 0
  // How many more of this size can go in the cart (stock minus what's already there, capped per item).
  const canAdd = selected ? Math.max(0, Math.min(selected.quantity, MAX_PER_ITEM) - inCart) : 0

  const handleAdd = () => {
    if (!selected || canAdd === 0) return
    const total = cart.add(
      {
        product_id: product.product_id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        size: selected.size,
        max: selected.quantity,
      },
      Math.min(quantity, canAdd),
    )
    setAdded(`Added to cart: ${product.name}, size ${selected.size} (${total} in cart).`)
    setQuantity(1)
  }

  return (
    <div className="container section">
      <Link to="/products" className="back-link">
        ← All products
      </Link>

      <article className="detail">
        <div className="detail-image">
          <img src={product.image_url} alt={product.name} />
        </div>

        <div className="detail-info">
          <p className="product-type">{product.garment_type}</p>
          <h1 className="detail-title">{product.name}</h1>
          <p className="detail-price">{formatPrice(product.price)}</p>
          <p className="detail-desc">{product.description}</p>

          <div className="detail-block">
            <h2>Size</h2>
            <div className="size-grid" role="radiogroup" aria-label="Choose a size">
              {product.inventory?.map((s) => (
                <button
                  key={s.size}
                  type="button"
                  role="radio"
                  aria-checked={selectedSize === s.size}
                  aria-label={s.quantity === 0 ? `${s.size}, sold out` : s.size}
                  className={`size-btn ${selectedSize === s.size ? 'is-selected' : ''}`}
                  disabled={s.quantity === 0}
                  onClick={() => {
                    setSelectedSize(s.size)
                    setQuantity(1)
                    setAdded(null)
                  }}
                >
                  {s.size}
                </button>
              ))}
            </div>
            <p className="stock-note" aria-live="polite">
              {product.total_stock === 0
                ? 'Sold out in all sizes.'
                : selected
                  ? selected.quantity <= 5
                    ? `Only ${selected.quantity} left in ${selected.size}.`
                    : `${selected.size} is in stock.`
                  : 'Select a size to check stock.'}
            </p>
          </div>

          <div className="detail-block buy-box">
            <div className="qty" role="group" aria-label="Quantity">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => q - 1)}
              >
                −
              </button>
              <span aria-live="polite">{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={!selected || quantity >= canAdd}
                onClick={() => setQuantity((q) => q + 1)}
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary add-to-cart"
              disabled={!selected || canAdd === 0}
              onClick={handleAdd}
            >
              {product.total_stock === 0
                ? 'Sold out'
                : !selected
                  ? 'Choose a size'
                  : canAdd === 0
                    ? 'All in your cart'
                    : 'Add to cart'}
            </button>
          </div>
          {added && (
            <p className="added-note" role="status">
              {added} <Link to="/cart">View cart →</Link>
            </p>
          )}

          <div className="detail-block">
            <h2>Tags</h2>
            <ul className="chips">
              {product.search_tags.map((t) => (
                <li key={t} className="chip chip-muted">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      {similar && similar.length > 0 && (
        <section className="similar" aria-labelledby="similar-title">
          <h2 id="similar-title" className="section-title">
            You may also like
          </h2>
          <div className="similar-grid">
            {similar.map((p) => (
              <Link to={`/products/${p.product_id}`} key={p.product_id} className="product-card">
                <div className="product-image">
                  <img src={p.image_url} alt={p.name} loading="lazy" />
                </div>
                <div className="product-body">
                  <p className="product-type">{p.garment_type}</p>
                  <h3 className="product-name">{p.name}</h3>
                  <p className="product-price">{formatPrice(p.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
