import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

const sb=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(req:Request){
  try{
    const b=await req.json();
    if(!b.guest_name||!b.mobile||!b.check_in||!b.check_out||!b.room_id)
      return NextResponse.json({error:'Missing required fields.'},{status:400});

    const s=sb();
    const {data,error}=await s.rpc('create_public_reservation',{
      p_guest_name:b.guest_name,
      p_mobile:b.mobile,
      p_email:b.email||null,
      p_check_in:b.check_in,
      p_check_out:b.check_out,
      p_guests:Number(b.guests||1),
      p_room_id:b.room_id,
      p_deposit:Number(b.deposit||0),
      p_payment_method:b.payment_method||'GCash',
      p_payment_ref:b.payment_ref||null,
      p_payment_proof_url:b.payment_proof_url||null,
      p_special_requests:b.special_requests||null
    });

    if(error) return NextResponse.json({error:error.message},{status:400});
    const bookingId=Array.isArray(data)?data[0]?.booking_id:data?.booking_id;
    return NextResponse.json({booking_id:bookingId});
  }catch(e:any){
    return NextResponse.json({error:e.message||'Server error'},{status:500});
  }
}
