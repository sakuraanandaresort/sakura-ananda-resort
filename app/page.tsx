import Link from 'next/link';

const rooms = [
  ['Room 1','₱2,500','Warm, private and intimate.'],
  ['Room 2','₱3,000','A relaxed room for slow mornings.'],
  ['Room 3','₱3,000','Comfortable space for a peaceful stay.'],
  ['Room 4','₱3,500','Our spacious choice for a special escape.'],
];

export default function Home(){
  return <>
    <section className="photo-hero">
      <video className="hero-montage" autoPlay muted loop playsInline poster="/resort-hero.png" aria-hidden="true">
        <source src="/sakura-ananda-montage.mp4" type="video/mp4" />
      </video>
      <div className="photo-hero-overlay" />
      <div className="hero-orb orb-one" />
      <div className="hero-orb orb-two" />
      <span className="petal petal-one">✿</span><span className="petal petal-two">✿</span><span className="petal petal-three">✿</span>
      <div className="photo-hero-content shell">
        <div className="eyebrow light">Sakura Ananda Resort • Santiago, Isabela</div>
        <h1>Stay beautifully.<br/><em>Slow down.</em></h1>
        <p>A private resort made for quiet mornings, sunset swims, good coffee and unhurried evenings.</p>
        <div className="actions">
          <Link className="btn light-btn" href="/reservation">Reserve your stay</Link>
          <Link className="btn glass-btn" href="/rooms">Explore the rooms</Link>
        </div>
      </div>
      <div className="hero-caption">Infinity pool • Private rooms • Coffee & Bar</div>
    </section>

    <section className="intro-section section">
      <div className="section-title">
        <div><div className="eyebrow">Your private escape</div><h2>Designed for restful days.</h2></div>
        <Link className="text-link" href="/amenities">View amenities →</Link>
      </div>
      <div className="feature-grid">
        <article className="feature-card photo-card pool-card reveal-card"><div className="feature-copy"><span>01</span><h3>Infinity Pool</h3><p>Take a quiet swim while the sky changes above you.</p></div></article>
        <article className="feature-card photo-card coffee-card reveal-card"><div className="feature-copy"><span>02</span><h3>Coffee & Bar</h3><p>Slow mornings, afternoon coffee and relaxed evening drinks.</p><Link href="/coffee-bar" className="text-link light-link">Discover the space →</Link></div></article>
        <article className="feature-card soft-card reveal-card"><div className="feature-copy dark"><span>03</span><h3>Four private rooms</h3><p>Choose the room that fits your stay, then reserve directly with the resort.</p><Link href="/rooms" className="text-link">See all rooms →</Link></div></article>
      </div>
    </section>


    <section className="montage-strip section">
      <div className="montage-copy">
        <div className="eyebrow">A glimpse of Sakura Ananda</div>
        <h2>Let the stay begin before you arrive.</h2>
        <p>Enjoy a gentle cinematic loop of the resort while exploring rooms, amenities, and our Coffee & Bar.</p>
      </div>
      <div className="montage-frame">
        <video autoPlay muted loop playsInline poster="/resort-hero.png" controls preload="metadata">
          <source src="/sakura-ananda-montage.mp4" type="video/mp4" />
          Your browser does not support video playback.
        </video>
        <div className="montage-badge">10 sec • cinematic loop</div>
      </div>
    </section>

    <section className="section room-preview">
      <div className="section-title"><div><div className="eyebrow">Four private rooms</div><h2>Choose your retreat.</h2></div><span className="muted">Rates are per night</span></div>
      <div className="grid">{rooms.map(x=><article className="card room-card reveal-card" key={x[0]}><div><span className="pill">Up to 4 guests</span><h3>{x[0]}</h3><p>{x[2]}</p></div><div className="price">{x[1]} <span className="muted">/ night</span></div></article>)}</div>
    </section>

    <section className="booking-cta">
      <div className="shell booking-cta-inner"><div><div className="eyebrow">Simple reservation</div><h2>Reserve directly with Sakura Ananda.</h2><p>Your booking details can be sent automatically to your email after submission.</p></div><Link className="btn" href="/reservation">Reserve now</Link></div>
    </section>
  </>;
}
