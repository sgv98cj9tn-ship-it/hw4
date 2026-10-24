import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { formatPrice, placeDemoOrder } from '../api'
import { useAuth } from '../auth'
import { useCart } from '../cart'
import DemoNotice from '../components/DemoNotice'

export default function Checkout() {
  const { items, count, subtotal, clear } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState(user ? `${user.first_name} ${user.last_name}` : '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [delivery, setDelivery] = useState<'pickup' | 'shipping'>('pickup')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (items.length === 0 && !loading) return <Navigate to="/cart" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const order = await placeDemoOrder({
        name,
        email,
        delivery,
        items: items.map((i) => ({ product_id: i.product_id, size: i.size, quantity: i.quantity })),
      })
      navigate('/order-confirmation', { replace: true, state: { order } })
      clear()
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="container section">
      <p className="eyebrow">Checkout</p>
      <h1 className="page-title">Place your demo order</h1>
      <DemoNotice />

      <div className="cart-layout">
        <form className="auth-card checkout-form" onSubmit={handleSubmit}>
          <h2>Contact</h2>
          <label className="field">
            <span>Full name</span>
            <input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <fieldset className="delivery">
            <legend>Delivery</legend>
            <label className={`delivery-option ${delivery === 'pickup' ? 'is-checked' : ''}`}>
              <input
                type="radio"
                name="delivery"
                value="pickup"
                checked={delivery === 'pickup'}
                onChange={() => setDelivery('pickup')}
              />
              <span>
                <strong>Pick up in store</strong>
                <small>57 Broadway, New Haven</small>
              </span>
            </label>
            <label className={`delivery-option ${delivery === 'shipping' ? 'is-checked' : ''}`}>
              <input
                type="radio"
                name="delivery"
                value="shipping"
                checked={delivery === 'shipping'}
                onChange={() => setDelivery('shipping')}
              />
              <span>
                <strong>Ship to me</strong>
                <small>A real store would ask for your address here.</small>
              </span>
            </label>
          </fieldset>

          <div className="payment-placeholder">
            <h2>Payment</h2>
            <p className="muted small">
              This is a demo, so there are no payment fields and nothing is charged.
            </p>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error} <Link to="/cart">Update your cart</Link>
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Placing demo order…' : `Place demo order · ${formatPrice(subtotal)}`}
          </button>
        </form>

        <aside className="cart-summary" aria-label="Order summary">
          <h2>Order summary</h2>
          <ul className="summary-items">
            {items.map((i) => (
              <li key={`${i.product_id}-${i.size}`}>
                <span>
                  {i.name} <span className="muted">· {i.size} × {i.quantity}</span>
                </span>
                <span>{formatPrice(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row summary-total">
            <span>Total ({count} items)</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
        </aside>
      </div>
    </div>
  )
}
