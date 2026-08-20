import './globals.css';
import Link from 'next/link';
export const metadata={title:'Sakura Ananda Resort | Reservations'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><header><div className="nav"><Link href="/" className="brand">桜 Sakura Ananda Resort</Link><nav><Link href="/reservation">Reserve</Link><Link href="/checkin">Check-in</Link><Link href="/admin">Staff</Link></nav></div></header><main>{children}</main><footer>Sakura Ananda Resort • Reservation & Front Desk System</footer></body></html>}
