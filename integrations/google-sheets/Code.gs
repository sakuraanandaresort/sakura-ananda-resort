/**
 * Sakura Ananda Resort
 * Supabase -> Google Sheets -> Gmail/Google MailApp
 *
 * Deploy this script as a Web App:
 * Execute as: Me
 * Who has access: Anyone
 *
 * Then create a Supabase Database Webhook on public.reservations for
 * INSERT + UPDATE and point it at the Web App URL.
 */

const CONFIG = {
  SPREADSHEET_ID: '1iNpswyOS1PjU0nSPCoIVxvKKHNjBwHsvxncmtHi91TU',
  SHEET_NAME: 'Reservations',
  LOG_SHEET_NAME: 'Email Log',
  RESORT_NAME: 'Sakura Ananda Resort',
  SECRET: 'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET',
  REPLY_TO: '', // Optional: resort Gmail address for customer replies.
};

const HEADERS = [
  'Last Updated', 'Event', 'Booking ID', 'Guest Name', 'Email', 'Mobile',
  'Room', 'Check-in', 'Check-out', 'Guests', 'Rate/Night', 'Nights',
  'Room Total', 'Deposit', 'Balance', 'Payment Method', 'Payment Ref',
  'Status', 'Special Requests', 'Notification Consent', 'Email Sent', 'Email Error'
];

const LOG_HEADERS = ['Timestamp', 'Booking ID', 'Event', 'Recipient', 'Subject', 'Result', 'Error'];


function testConnection() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(ss, CONFIG.SHEET_NAME, HEADERS);
  return json_({
    ok: true,
    spreadsheet_id: CONFIG.SPREADSHEET_ID,
    spreadsheet_name: ss.getName(),
    sheet_name: sheet.getName(),
    email_quota_remaining: MailApp.getRemainingDailyQuota()
  });
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ok: true, service: 'Sakura Ananda Google Sheets Bridge'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const suppliedSecret = e && e.parameter ? e.parameter.secret : '';
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const secret = suppliedSecret || body.secret || '';

    if (CONFIG.SECRET && CONFIG.SECRET !== 'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET' && secret !== CONFIG.SECRET) {
      return json_({ok: false, error: 'Unauthorized'});
    }

    if (body.schema !== 'public' || body.table !== 'reservations') {
      return json_({ok: false, ignored: true, reason: 'Not a reservations webhook'});
    }

    const type = String(body.type || '').toUpperCase();
    const record = body.record || {};
    const oldRecord = body.old_record || {};
    if (!record.booking_id) return json_({ok: false, error: 'Missing booking_id'});

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = getOrCreateSheet_(ss, CONFIG.SHEET_NAME, HEADERS);
    const row = rowValues_(record, type);
    const existingRow = findBookingRow_(sheet, record.booking_id);

    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    // Send only for a new booking or a real status transition.
    let emailResult = {sent: false, reason: 'No email event'};
    const hasEmail = record.email && String(record.email).trim();
    const consent = record.notification_consent !== false;
    const statusChanged = type === 'UPDATE' && String(oldRecord.status || '') !== String(record.status || '');
    const shouldEmail = hasEmail && consent && (type === 'INSERT' || statusChanged);

    if (shouldEmail) {
      const event = type === 'INSERT' ? 'created' : statusEvent_(record.status);
      if (emailAlreadySent_(ss, record.booking_id, event)) {
        emailResult = {sent: true, reason: 'Already sent; duplicate webhook ignored'};
      } else {
        emailResult = sendBookingEmail_(record, event);
        logEmail_(ss, record, event, emailResult);
      }

      // Update email status only when this webhook actually represented an email event.
      const latestRow = findBookingRow_(sheet, record.booking_id);
      if (latestRow) {
        sheet.getRange(latestRow, 21, 1, 2).setValues([[emailResult.sent ? 'YES' : 'NO', emailResult.error || emailResult.reason || '']]);
      }
    }

    return json_({ok: true, booking_id: record.booking_id, email: emailResult});
  } catch (err) {
    console.error(err);
    return json_({ok: false, error: String(err && err.message ? err.message : err)});
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function rowValues_(r, type) {
  return [
    new Date(), type,
    r.booking_id || '', r.guest_name || '', r.email || '', r.mobile || '',
    r.room_name || r.room_id || '', r.check_in || '', r.check_out || '', r.guests || '',
    r.rate_per_night || '', r.nights || '', r.room_total || '', r.deposit || '', r.balance || '',
    r.payment_method || '', r.payment_ref || '', r.status || '', r.special_requests || '',
    r.notification_consent === false ? 'NO' : 'YES', '', ''
  ];
}

function findBookingRow_(sheet, bookingId) {
  if (sheet.getLastRow() < 2) return null;
  const values = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(bookingId)) return i + 2;
  }
  return null;
}

function statusEvent_(status) {
  switch (String(status || '')) {
    case 'Confirmed': return 'confirmed';
    case 'Cancelled': return 'cancelled';
    case 'Checked-in': return 'checked-in';
    case 'Checked-out': return 'checked-out';
    default: return 'updated';
  }
}

function sendBookingEmail_(r, event) {
  const recipient = String(r.email || '').trim();
  if (!recipient) return {sent: false, reason: 'No guest email'};
  if (MailApp.getRemainingDailyQuota() < 1) return {sent: false, reason: 'Google email quota reached'};

  const copy = emailCopy_(r, event);
  try {
    const options = {
      htmlBody: copy.html,
      name: CONFIG.RESORT_NAME,
    };
    if (CONFIG.REPLY_TO) options.replyTo = CONFIG.REPLY_TO;
    MailApp.sendEmail(recipient, copy.subject, copy.text, options);
    return {sent: true, reason: 'Sent by Google MailApp'};
  } catch (err) {
    return {sent: false, error: String(err && err.message ? err.message : err)};
  }
}

function emailCopy_(r, event) {
  const titles = {
    created: 'Reservation received',
    confirmed: 'Reservation confirmed',
    cancelled: 'Reservation cancelled',
    'checked-in': 'Welcome to Sakura Ananda',
    'checked-out': 'Thank you for staying with us',
    updated: 'Reservation updated',
  };
  const intros = {
    created: 'We have received your reservation request. Your room is pending staff confirmation.',
    confirmed: 'Great news — your reservation has been confirmed by Sakura Ananda Resort.',
    cancelled: 'Your reservation has been cancelled. Please contact the resort if you need assistance.',
    'checked-in': 'Your check-in is complete. We hope you enjoy your stay.',
    'checked-out': 'Your checkout has been recorded. Thank you for staying with us.',
    updated: 'Your reservation has been updated.',
  };
  const title = titles[event] || titles.updated;
  const intro = intros[event] || intros.updated;
  const booking = esc_(r.booking_id);
  const room = esc_(r.room_name || r.room_id || 'Selected room');
  const guest = esc_(r.guest_name);
  const checkIn = formatDate_(r.check_in);
  const checkOut = formatDate_(r.check_out);
  const total = peso_(r.room_total);
  const deposit = peso_(r.deposit);
  const balance = peso_(r.balance);

  const subject = CONFIG.RESORT_NAME + ' • ' + title + ' • ' + r.booking_id;
  const text = [
    CONFIG.RESORT_NAME, '', intro, '',
    'Booking ID: ' + r.booking_id,
    'Guest: ' + r.guest_name,
    'Room: ' + (r.room_name || r.room_id || ''),
    'Stay: ' + checkIn + ' → ' + checkOut,
    'Guests: ' + (r.guests || ''),
    'Room total: ' + total,
    'Deposit: ' + deposit,
    'Balance: ' + balance,
    'Payment: ' + (r.payment_method || ''),
    'Status: ' + (r.status || ''), '',
    'Please keep your booking ID ' + r.booking_id + ' for check-in.', '',
    'Thank you,', CONFIG.RESORT_NAME
  ].join('\n');

  const html = '<!doctype html><html><body style="margin:0;background:#f7f2ec;font-family:Arial,sans-serif;color:#2d2926">' +
    '<div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #eadfd4;border-radius:24px;overflow:hidden">' +
    '<div style="padding:28px 32px;background:linear-gradient(135deg,#fff8f1,#f3e8df)">' +
    '<div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#9b6b61">桜 Sakura Ananda Resort</div>' +
    '<h1 style="font-family:Georgia,serif;font-weight:500;font-size:30px;margin:12px 0 6px">' + esc_(title) + '</h1>' +
    '<p style="margin:0;color:#6f625b">' + esc_(intro) + '</p></div>' +
    '<div style="padding:30px 32px">' +
    '<div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#f6eee8;color:#8d5f55;font-weight:700;font-size:13px">' + esc_(r.status) + '</div>' +
    '<h2 style="font-family:Georgia,serif;font-weight:500">Booking ' + booking + '</h2>' +
    '<table style="width:100%;border-collapse:collapse">' +
    tr_('Guest', guest, true) + tr_('Room', room, true) + tr_('Stay', checkIn + ' → ' + checkOut, false) +
    tr_('Guests', r.guests || '', false) + tr_('Room total', total, true) + tr_('Deposit', deposit, false) + tr_('Balance', balance, true) +
    '</table>' +
    '<div style="margin-top:24px;padding:16px;border-radius:16px;background:#faf7f3;color:#665b55;font-size:14px">Please keep your booking ID <strong>' + booking + '</strong> for check-in.</div>' +
    '</div><div style="padding:20px 32px;background:#2f2926;color:#e9ded6;font-size:12px">Sakura Ananda Resort • Asia/Manila • Thank you for choosing us.</div>' +
    '</div></body></html>';

  return {subject, text, html};
}

function tr_(label, value, bold) {
  return '<tr><td style="padding:9px 0;color:#766c66">' + esc_(label) + '</td><td style="padding:9px 0;text-align:right' + (bold ? ';font-weight:700' : '') + '">' + esc_(value) + '</td></tr>';
}

function peso_(value) {
  return '₱' + Number(value || 0).toLocaleString('en-PH', {minimumFractionDigits: 0, maximumFractionDigits: 2});
}

function formatDate_(value) {
  if (!value) return '';
  const d = new Date(String(value) + 'T00:00:00+08:00');
  return Utilities.formatDate(d, 'Asia/Manila', 'MMM d, yyyy');
}

function esc_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function emailAlreadySent_(ss, bookingId, event) {
  const sheet = ss.getSheetByName(CONFIG.LOG_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return false;
  const values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 5).getValues();
  return values.some(row => String(row[0]) === String(bookingId) && String(row[1]) === String(event) && String(row[4]) === 'SENT');
}

function logEmail_(ss, r, event, result) {
  const sheet = getOrCreateSheet_(ss, CONFIG.LOG_SHEET_NAME, LOG_HEADERS);
  const copy = emailCopy_(r, event);
  sheet.appendRow([new Date(), r.booking_id, event, r.email || '', copy.subject, result.sent ? 'SENT' : 'FAILED', result.error || result.reason || '']);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
