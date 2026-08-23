import Link from 'next/link';

const rooms = [
  { name: 'Room 1', rate: '₱2,500', note: 'Warm, intimate and effortlessly comfortable.' },
  { name: 'Room 2', rate: '₱3,000', note: 'A calm retreat for slow mornings and easy evenings.' },
  { name: 'Room 3', rate: '₱3,000', note: 'A comfortable private space made for unwinding.' },
  { name: 'Room 4', rate: '₱3,500', note: 'Our spacious choice for a more indulgent escape.' },
];

export default function Home() {
  return (
    <div className="sa-home">
      <section className="sa-hero">
        <video className="sa-hero-video" autoPlay muted loop playsInline poster="/resort-hero.png" aria-hidden="true">
          <source src="/Sakura.mp4" type="video/mp4" />
        </video>
        <div className="sa-hero-shade" />
        <div className="sa-hero-grain" />

        <div className="shell sa-hero-inner">
          <div className="sa-hero-kicker">Santiago, Isabela • Philippines</div>
          <h1>Arrive.<br /><em>Exhale.</em><br />Stay awhile.</h1>
          <p>A private resort for unhurried days, warm nights and little moments that feel beautifully yours.</p>
          <div className="sa-hero-actions">
            <Link href="/reservation" className="sa-button sa-button-light">Check availability <span>↗</span></Link>
            <Link href="/rooms" className="sa-button sa-button-ghost">Explore the rooms</Link>
          </div>
        </div>

        <div className="sa-hero-meta">
          <span>PRIVATE RESORT</span><i />
          <span>INFINITY POOL</span><i />
          <span>COFFEE & BAR</span>
        </div>
      </section>

      <section className="sa-intro section">
        <div className="shell sa-intro-grid">
          <div>
            <span className="sa-kicker">The Sakura Ananda feeling</span>
            <h2>Luxury, without the noise.</h2>
          </div>
          <div className="sa-intro-copy">
            <p>There is no rush here. Wake slowly, take a swim, share coffee and let the afternoon stretch into evening.</p>
            <Link href="/amenities" className="sa-arrow-link">Discover the experience <span>→</span></Link>
          </div>
        </div>
      </section>

      <section className="sa-experience section">
        <div className="shell">
          <div className="sa-section-head">
            <div><span className="sa-kicker">Made for your stay</span><h2>Spaces to linger in.</h2></div>
            <span className="sa-index">01 — 03</span>
          </div>

          <div className="sa-experience-grid">
            <article className="sa-experience-card sa-pool">
              <div className="sa-card-shade" />
              <div className="sa-card-content"><span>01</span><h3>Infinity Pool</h3><p>Swim, float and watch the day soften around you.</p></div>
            </article>
            <article className="sa-experience-card sa-coffee">
              <div className="sa-card-shade" />
              <div className="sa-card-content"><span>02</span><h3>Coffee & Bar</h3><p>Good coffee by day. A relaxed drink when the lights come on.</p><Link href="/coffee-bar">Explore the space →</Link></div>
            </article>
            <article className="sa-experience-note">
              <span>03</span><h3>Four private rooms.</h3><p>Choose your pace, settle into your own space and make the stay yours.</p><Link href="/rooms">View rooms →</Link>
            </article>
          </div>
        </div>
      </section>

      <section className="sa-film section">
        <div className="shell">
          <div className="sa-film-intro"><span className="sa-kicker">A glimpse of the resort</span><h2>Let the atmosphere<br /><em>arrive first.</em></h2></div>
          <div className="sa-film-frame">
            <video autoPlay muted loop playsInline poster="/resort-hero.png" controls preload="metadata">
              <source src="/sakura-ananda-montage.mp4" type="video/mp4" />
            </video>
            <span>10 sec cinematic loop</span>
          </div>
        </div>
      </section>

      <section className="sa-rooms section">
        <div className="shell">
          <div className="sa-section-head"><div><span className="sa-kicker">Your private retreat</span><h2>Stay your way.</h2></div><Link href="/rooms" className="sa-arrow-link">All rooms <span>→</span></Link></div>
          <div className="sa-room-grid">
            {rooms.map((room, index) => (
              <article className="sa-room-card" key={room.name}>
                <div className={`sa-room-image sa-room-${index + 1}`}><span>ROOM {String(index + 1).padStart(2, '0')}</span></div>
                <div className="sa-room-body"><div><h3>{room.name}</h3><p>{room.note}</p></div><strong>{room.rate}<small>/ night</small></strong></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sa-booking-band">
        <div className="shell sa-booking-band-inner">
          <div><span className="sa-kicker sa-kicker-light">Direct reservations</span><h2>Your quiet escape is one click away.</h2><p>Reserve directly with Sakura Ananda and receive your booking details by email.</p></div>
          <Link href="/reservation" className="sa-button sa-button-light">Reserve your stay <span>↗</span></Link>
        </div>
      </section>
    </div>
  );
}
