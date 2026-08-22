import Link from 'next/link';
const rooms=[
 {name:'Room 1',rate:'₱2,500',tag:'Cozy retreat',desc:'Warm, private and intimate — ideal for a relaxed overnight stay.'},
 {name:'Room 2',rate:'₱3,000',tag:'Slow mornings',desc:'A comfortable room with a calm atmosphere for couples and small groups.'},
 {name:'Room 3',rate:'₱3,000',tag:'Peaceful stay',desc:'A restful private space designed around comfort and quiet.'},
 {name:'Room 4',rate:'₱3,500',tag:'Spacious escape',desc:'Our spacious choice for guests celebrating a special getaway.'},
];
export default function Rooms(){return <div className="page-shell"><section className="page-heading"><div className="eyebrow">Sakura Ananda • Accommodation</div><h1>Rooms made for<br/><em>slow mornings.</em></h1><p>Four private rooms, one peaceful place. Choose your room and reserve directly online.</p></section><div className="room-gallery">{rooms.map((r,i)=><article className={`large-room-card room-photo-${i+1}`} key={r.name}><div className="room-card-overlay"/><div className="large-room-content"><span className="pill light-pill">{r.tag}</span><h2>{r.name}</h2><p>{r.desc}</p><div className="room-bottom"><strong>{r.rate}</strong><span>per night</span></div></div></article>)}</div><div className="center-cta"><Link className="btn" href="/reservation">Check availability & reserve</Link></div></div>}
