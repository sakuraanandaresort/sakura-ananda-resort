export type NotificationReservation = {
  booking_id:string;
  guest_name:string;
  mobile:string;
  email:string|null;
  check_in:string;
  check_out:string;
  guests:number;
  rate_per_night:number;
  nights:number;
  room_total:number;
  deposit:number;
  balance:number;
  payment_method:string;
  status:string;
  notification_consent?:boolean;
  room?:{name:string}|null;
};

const peso=(n:number)=>`₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:0,maximumFractionDigits:2})}`;
const date=(s:string)=>new Date(`${s}T00:00:00+08:00`).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'});
const esc=(s:string)=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]!));

export function notificationCopy(r:NotificationReservation,event:'created'|'confirmed'|'cancelled'|'checked-in'|'checked-out'){
  const room=r.room?.name||'Your selected room';
  const titles={created:'Reservation received',confirmed:'Reservation confirmed',cancelled:'Reservation cancelled','checked-in':'Welcome to Sakura Ananda','checked-out':'Thank you for staying with us'};
  const intro={
    created:'We have received your reservation request. Your room is pending staff confirmation.',
    confirmed:'Great news — your reservation has been confirmed by Sakura Ananda Resort.',
    cancelled:'Your reservation has been cancelled. Please contact the resort if you need assistance.',
    'checked-in':'Your check-in is complete. We hope you enjoy your stay.',
    'checked-out':'Your checkout has been recorded. Thank you for staying with us.'
  }[event];
  const subject=`Sakura Ananda Resort • ${titles[event]} • ${r.booking_id}`;
  const text=`Sakura Ananda Resort\n\n${intro}\n\nBooking ID: ${r.booking_id}\nGuest: ${r.guest_name}\nRoom: ${room}\nStay: ${date(r.check_in)} → ${date(r.check_out)}\nGuests: ${r.guests}\nRoom total: ${peso(r.room_total)}\nDeposit: ${peso(r.deposit)}\nBalance: ${peso(r.balance)}\nPayment: ${r.payment_method}\nStatus: ${r.status}\n\nThank you,\nSakura Ananda Resort`;
  const html=`<!doctype html><html><body style="margin:0;background:#f7f2ec;font-family:Arial,sans-serif;color:#2d2926"><div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #eadfd4;border-radius:24px;overflow:hidden"><div style="padding:28px 32px;background:linear-gradient(135deg,#fff8f1,#f3e8df)"><div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#9b6b61">桜 Sakura Ananda Resort</div><h1 style="font-family:Georgia,serif;font-weight:500;font-size:30px;margin:12px 0 6px">${esc(titles[event])}</h1><p style="margin:0;color:#6f625b">${esc(intro)}</p></div><div style="padding:30px 32px"><div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#f6eee8;color:#8d5f55;font-weight:700;font-size:13px">${esc(r.status)}</div><h2 style="font-family:Georgia,serif;font-weight:500">Booking ${esc(r.booking_id)}</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:9px 0;color:#766c66">Guest</td><td style="padding:9px 0;text-align:right;font-weight:700">${esc(r.guest_name)}</td></tr><tr><td style="padding:9px 0;color:#766c66">Room</td><td style="padding:9px 0;text-align:right;font-weight:700">${esc(room)}</td></tr><tr><td style="padding:9px 0;color:#766c66">Stay</td><td style="padding:9px 0;text-align:right">${date(r.check_in)} → ${date(r.check_out)}</td></tr><tr><td style="padding:9px 0;color:#766c66">Guests</td><td style="padding:9px 0;text-align:right">${r.guests}</td></tr><tr><td style="padding:9px 0;color:#766c66">Room total</td><td style="padding:9px 0;text-align:right;font-weight:700">${peso(r.room_total)}</td></tr><tr><td style="padding:9px 0;color:#766c66">Deposit</td><td style="padding:9px 0;text-align:right">${peso(r.deposit)}</td></tr><tr><td style="padding:9px 0;color:#766c66">Balance</td><td style="padding:9px 0;text-align:right;font-weight:700">${peso(r.balance)}</td></tr></table><div style="margin-top:24px;padding:16px;border-radius:16px;background:#faf7f3;color:#665b55;font-size:14px">Please keep your booking ID <strong>${esc(r.booking_id)}</strong> for check-in.</div></div><div style="padding:20px 32px;background:#2f2926;color:#e9ded6;font-size:12px">Sakura Ananda Resort • Asia/Manila • Thank you for choosing us.</div></div></body></html>`;
  const sms=`Sakura Ananda: ${titles[event]}. Booking ${r.booking_id}. ${room}, ${date(r.check_in)}-${date(r.check_out)}. Status: ${r.status}.`;
  return {subject,text,html,sms};
}

export async function sendEmail(to:string,subject:string,html:string,text:string){
  if(!to)return {sent:false,reason:'No recipient email'};

  // Free transactional email provider. Resend currently offers 3,000 emails/month
  // on its free plan. Brevo remains supported as a fallback at 300 emails/day.
  const resendKey=process.env.RESEND_API_KEY;
  const resendFrom=process.env.RESEND_FROM_EMAIL;
  if(resendKey&&resendFrom){
    const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:resendFrom,to:[to],subject,html,text})});
    if(!res.ok) throw new Error(`Resend email error: ${await res.text()}`);
    const data=await res.json().catch(()=>({}));
    return {sent:true,provider:'resend',messageId:data.id};
  }

  const brevoKey=process.env.BREVO_API_KEY;
  const brevoFrom=process.env.BREVO_FROM_EMAIL;
  const brevoName=process.env.BREVO_FROM_NAME||'Sakura Ananda Resort';
  if(brevoKey&&brevoFrom){
    const res=await fetch('https://api.brevo.com/v3/smtp/email',{
      method:'POST',
      headers:{accept:'application/json','api-key':brevoKey,'content-type':'application/json'},
      body:JSON.stringify({sender:{name:brevoName,email:brevoFrom},to:[{email:to}],subject,htmlContent:html,textContent:text})
    });
    if(!res.ok) throw new Error(`Brevo email error: ${await res.text()}`);
    const data=await res.json().catch(()=>({}));
    return {sent:true,provider:'brevo',messageId:data.messageId};
  }

  return {sent:false,reason:'Email is not configured. Add RESEND_API_KEY + RESEND_FROM_EMAIL in Vercel, or use BREVO_API_KEY + BREVO_FROM_EMAIL.'};
}

export async function sendSms(to:string,body:string){
  const sid=process.env.TWILIO_ACCOUNT_SID; const token=process.env.TWILIO_AUTH_TOKEN;
  const from=process.env.TWILIO_FROM_NUMBER; const messaging=process.env.TWILIO_MESSAGING_SERVICE_SID;
  if(!sid||!token||(!from&&!messaging)||!to)return {sent:false,reason:'SMS is not configured'};
  const form=new URLSearchParams({To:to,Body:body});
  if(messaging)form.set('MessagingServiceSid',messaging); else form.set('From',from!);
  const auth=Buffer.from(`${sid}:${token}`).toString('base64');
  const res=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body:form});
  if(!res.ok) throw new Error(`SMS provider error: ${await res.text()}`);
  return {sent:true};
}

export async function notifyReservation(r:NotificationReservation,event:'created'|'confirmed'|'cancelled'|'checked-in'|'checked-out'){
  const c=notificationCopy(r,event); const results:{email?:unknown;sms?:unknown}={};
  if(r.notification_consent !== false && r.email){try{results.email=await sendEmail(r.email,c.subject,c.html,c.text)}catch(e:any){results.email={sent:false,error:e.message}}}
  if(r.notification_consent !== false && process.env.ENABLE_SMS_NOTIFICATIONS==='true' && r.mobile){try{results.sms=await sendSms(r.mobile,c.sms)}catch(e:any){results.sms={sent:false,error:e.message}}}
  return results;
}
