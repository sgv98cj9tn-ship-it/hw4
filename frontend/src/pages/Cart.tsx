import { Link } from 'react-router-dom'
import { formatPrice } from '../api'
import { useCart } from '../cart'
import DemoNotice from '../components/DemoNotice'
import HandsomeDan from '../components/HandsomeDan'

export default function Cart() {
  const { items, count, subtotal, setQuantity, remove } = useCart()

  return (
    <div className="container section">
      <p className="eyebrow">Shop</p>
      <h1 className="page-title">Your cart</h1>
      <DemoNotice />

      {items.length === 0 ? (
        <div className="empty-cart">
          <HandsomeDan className="empty-cart-dan" title="Handsome Dan guarding an empty cart" />
          <div>
            <h2>Your cart is empty</h2>
            <p className="muted">Dan’s guarding an empty basket. Let’s find something worth fetching.</p>
            <Link to="/products" className="btn btn-primary">
              Browse products
            </Link>
          </div>
        </div>
      ) : (
        <div className="cart-layout">
          <ul className="cart-list" aria-label="Items in your cart">
            {items.map((item) => (
              <li key={`${item.product_id}-${item.size}`} className="cart-item">
                <Link to={`/products/${item.product_id}`} className="cart-thumb">
                  <img src={item.image_url} alt={item.name} />
                </Link>
                <div className="cart-info">
                  <Link to={`/products/${item.product_id}`} className="cart-name">
                    {item.name}
                  </Link>
                  <p className="muted small">
                    Size {item.size} · {formatPrice(item.price)} each
                  </p>
                  <div className="cart-controls">
                    <div className="qty" role="group" aria-label={`Quantity of ${item.name}, size ${item.size}`}>
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={item.quantity <= 1}
                        onClick={() => setQuantity(item.product_id, item.size, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span aria-live="polite">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={item.quantity >= Math.min(item.max, 10)}
                        onClick={() => setQuantity(item.product_id, item.size, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button type="button" className="link-btn" onClick={() => remove(item.product_id, item.size)}>
                      Remove
                    </button>
                  </div>
                  {item.quantity >= item.max && <p className="field-hint">That’s all we have in this size.</p>}
                </div>
                <p className="cart-line-total">{formatPrice(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>

          <aside className="cart-summary" aria-label="Order summary">
            <h2>Summary</h2>
            <div className="summary-row">
              <span>
                Items ({count})
              </span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="summary-row muted">
              <span>Shipping</span>
              <span>Free (demo)</span>
            </div>
            <div className="summary-row summary-total">
              <span>Total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <Link to="/checkout" className="btn btn-primary btn-block">
              Checkout
            </Link>
            <Link to="/products" className="btn btn-ghost btn-block">
              Keep shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  )
}
