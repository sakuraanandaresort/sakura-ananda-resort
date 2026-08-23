import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Sakura Ananda Resort | Private Resort Stay',
  description: 'A refined private resort stay in Santiago, Isabela — rooms, amenities, coffee and direct reservations.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header sa-header">
          <div className="sa-nav shell">
            <Link href="/" className="sa-brand" aria-label="Sakura Ananda Resort home">
              <span className="sa-brand-flower">桜</span>
              <span className="sa-brand-copy">
                <strong>Sakura Ananda</strong>
                <small>PRIVATE RESORT</small>
              </span>
            </Link>

            <nav className="sa-nav-links" aria-label="Primary navigation">
              <Link href="/rooms">Stay</Link>
              <Link href="/amenities">Experience</Link>
              <Link href="/coffee-bar">Coffee & Bar</Link>
              <Link href="/checkin">Check-in</Link>
			  <Link href="/reservation">Reservation</Link>
              <Link href="/admin" className="sa-nav-cta">Staff Portal</Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer sa-footer">
          <div className="shell sa-footer-grid">
            <div>
              <div className="sa-footer-mark">桜</div>
              <h2>Sakura Ananda</h2>
              <p>Private stays • Quiet moments • Thoughtful service</p>
            </div>
            <div>
              <span className="sa-footer-label">LOCATION</span>
              <p>Santiago, Isabela<br />Philippines</p>
            </div>
            <div>
              <span className="sa-footer-label">RESERVATIONS</span>
              <Link href="/reservation">Reserve your stay →</Link>
            </div>
          </div>
          <div className="shell sa-footer-bottom">
            <span>© {new Date().getFullYear()} Sakura Ananda Resort</span>
            <span>Asia/Manila</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
