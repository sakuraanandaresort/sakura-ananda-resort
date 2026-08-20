import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {notifyReservation} from '../../../lib/notifications';

const adminClient=(token:string)=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:token}}});

export async function POST(req:Request){
  try{
    const auth=req.headers.get('authorization');
    if(!auth?.startsWith('Bearer ')) return NextResponse.json({error:'Staff authentication required.'},{status:401});
    const s=adminClient(auth);
    const {data:{user},error:ue}=await s.auth.getUser();
    if(ue||!user) return NextResponse.json({error:'Staff authentication required.'},{status:401});
    const {id,event}=await req.json();
    if(!id||!['confirmed','cancelled','checked-in','checked-out'].includes(event)) return NextResponse.json({error:'Invalid notification request.'},{status:400});
    const {data,error}=await s.from('reservations').select('*,room:rooms(name)').eq('id',id).single();
    if(error||!data) return NextResponse.json({error:error?.message||'Reservation not found.'},{status:404});
    const results=await notifyReservation(data,event);
    return NextResponse.json({ok:true,results});
  }catch(e:any){return NextResponse.json({error:e.message||'Notification error.'},{status:500});}
}
