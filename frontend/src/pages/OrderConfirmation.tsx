import { Link, Navigate, useLocation } from 'react-router-dom'
import { formatPrice, type DemoOrder } from '../api'
import DemoNotice from '../components/DemoNotice'

export default function OrderConfirmation() {
  const order = (useLocation().state as { order?: DemoOrder } | null)?.order
  if (!order) return <Navigate to="/products" replace />

  return (
    <div className="container section narrow">
      <div className="confirm-icon" aria-hidden="true">
        ✓
      </div>
      <p className="eyebrow">Order confirmed</p>
      <h1 className="page-title">Thanks, {order.name.split(' ')[0]}!</h1>
      <p className="lead">
        Your demo order <strong>{order.order_number}</strong> is confirmed.{' '}
        {order.delivery === 'pickup'
          ? 'In a real order, it would be ready to pick up at 57 Broadway.'
          : 'In a real order, it would be shipped to you.'}
      </p>
      <DemoNotice />

      <ul className="summary-items confirm-items">
        {order.items.map((i, n) => (
          <li key={n}>
            <span>
              {i.name} <span className="muted">· {i.size} × {i.quantity}</span>
            </span>
            <span>{formatPrice(i.price * i.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="summary-row summary-total">
        <span>Total</span>
        <span>{formatPrice(order.subtotal)}</span>
      </div>

      <Link to="/products" className="btn btn-primary">
        Keep shopping
      </Link>
    </div>
  )
}
