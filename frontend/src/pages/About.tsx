import { Link } from 'react-router-dom'
import HandsomeDan from '../components/HandsomeDan'

export default function About() {
  return (
    <div className="container section narrow">
      <p className="eyebrow">About Us</p>
      <h1 className="page-title">A Broadway shop for Yale pride</h1>

      {/* Illustrated storefront: striped awning, shop sign, and Handsome Dan at the door */}
      <figure className="storefront" aria-label="Illustration of the Campus Customs storefront on Broadway">
        <div className="awning" aria-hidden="true" />
        <div className="storefront-body">
          <div className="storefront-sign">
            <span className="wordmark-main">Campus Customs</span>
            <span className="storefront-address">57 Broadway · New Haven</span>
          </div>
          <div className="storefront-row">
            <div className="storefront-window" aria-hidden="true">
              <span className="window-tee">Y</span>
              <span className="window-tee alt">Y</span>
            </div>
            <div className="storefront-door" aria-hidden="true" />
            <HandsomeDan className="storefront-dan" title="" />
          </div>
        </div>
        <figcaption>On Broadway since the 1970s</figcaption>
      </figure>

      <div className="prose">
        <p>
          Campus Customs is a family-run business at 57 Broadway in New Haven, directly across from
          Yale's campus. The store has been selling Yale gear on Broadway since the 1970s.
        </p>

        <h2>What we carry</h2>
        <p>
          We sell officially licensed Yale merchandise: T-shirts, hoodies, crewnecks, quarter-zips,
          fleece jackets and more. You'll find items for each residential college, Yale's sports
          teams, the graduate and professional schools, alumni and class years, and family members
          who want to show their Yale connection.
        </p>

        <h2>Made next door</h2>
        <p>
          Campus Customs has its own production space next to the store, with screen printing,
          embroidery and graphic design done in-house. That lets us take on custom orders for teams,
          departments and student groups, and set up online stores for fundraising.{' '}
          <Link to="/custom-order">Request a custom order →</Link>
        </p>

        <h2>Visit us</h2>
        <p>
          Stop by 57 Broadway, New Haven, CT 06511, or shop the full catalogue online at{' '}
          <a href="https://yalebulldogblue.com/" target="_blank" rel="noreferrer">
            Yale Bulldog Blue by Campus Customs
          </a>
          .
        </p>
      </div>
    </div>
  )
}
