'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import type { Room } from '../../lib/types';

export default function Reservation() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [depositPct, setDepositPct] = useState(0.3);

  const [msg, setMsg] = useState('');
  const [booking, setBooking] = useState('');
  const [busy, setBusy] = useState(false);

  const [f, setF] = useState({
    guest_name: '',
    mobile: '',
    email: '',
    check_in: '',
    check_out: '',
    guests: '2',
    room_id: '',

    payment_method: 'GCash',

    deposit: '',

    payment_ref: '',
    special_requests: '',
    payment_proof_url: '',

    notification_consent: true,
  });

  /*
   * ==========================================
   * LOAD ROOMS + SETTINGS
   * ==========================================
   */
  useEffect(() => {
    const s = supabaseBrowser();

    async function loadData() {
      const {
        data: roomData,
        error: roomError,
      } = await s
        .from('rooms')
        .select('*')
        .eq('active', true)
        .order('name');

      if (roomError) {
        setMsg(roomError.message);
        return;
      }

      if (roomData) {
        setRooms(roomData as Room[]);

        setF((current) => ({
          ...current,
          room_id:
            current.room_id ||
            roomData[0]?.id ||
            '',
        }));
      }

      /*
       * LOAD SETTINGS
       */
      const {
        data: settingsData,
        error: settingsError,
      } = await s
        .from('settings')
        .select('key,value')
        .in('key', [
          'gcash_qr_url',
          'deposit_percent',
        ]);

      if (settingsError) {
        setMsg(settingsError.message);
        return;
      }

      const qrRow = settingsData?.find(
        (x) => x.key === 'gcash_qr_url'
      );

      const depositRow = settingsData?.find(
        (x) => x.key === 'deposit_percent'
      );

      setQr(qrRow?.value || null);

      const configuredDeposit = Number(
        depositRow?.value ?? 0.3
      );

      setDepositPct(
        Number.isFinite(configuredDeposit)
          ? configuredDeposit
          : 0.3
      );
    }

    loadData();
  }, []);

  /*
   * ==========================================
   * SELECTED ROOM
   * ==========================================
   */
  const room = rooms.find(
    (r) => r.id === f.room_id
  );

  /*
   * ==========================================
   * NIGHTS
   * ==========================================
   */
  const nights = useMemo(() => {
    if (!f.check_in || !f.check_out) {
      return 0;
    }

    const a = new Date(
      `${f.check_in}T00:00:00`
    );

    const b = new Date(
      `${f.check_out}T00:00:00`
    );

    const difference =
      b.getTime() - a.getTime();

    return Math.max(
      0,
      Math.round(
        difference / 86400000
      )
    );
  }, [
    f.check_in,
    f.check_out,
  ]);

  /*
   * ==========================================
   * TOTALS
   * ==========================================
   */
  const total =
    Number(room?.rate || 0) * nights;

  const suggested = Math.round(
    total * depositPct
  );

  /*
   * ==========================================
   * UPDATE FORM
   * ==========================================
   */
  function update(
    key: string,
    value: any
  ) {
    setF((current) => ({
      ...current,
      [key]: value,
    }));
  }

  /*
   * ==========================================
   * CAPITALIZE TEXT
   * ==========================================
   *
   * Guest names, payment references,
   * special requests and other text fields
   * are automatically converted to uppercase.
   *
   * Email and mobile are NOT capitalized.
   */
  function updateText(
    key: string,
    value: string
  ) {
    update(
      key,
      value.toUpperCase()
    );
  }

  /*
   * ==========================================
   * TODAY
   * ==========================================
   */
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  /*
   * ==========================================
   * SUBMIT RESERVATION
   * ==========================================
   */
  async function submit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setBusy(true);
    setMsg('');
    setBooking('');

    /*
     * BASIC VALIDATION
     */
    if (!f.room_id) {
      setMsg(
        'Please select a room.'
      );
      setBusy(false);
      return;
    }

    if (!f.check_in || !f.check_out) {
      setMsg(
        'Please select your check-in and check-out dates.'
      );
      setBusy(false);
      return;
    }

    if (nights <= 0) {
      setMsg(
        'Check-out must be after check-in.'
      );
      setBusy(false);
      return;
    }

    if (
      room &&
      Number(f.guests) >
        room.max_guests
    ) {
      setMsg(
        `${room.name} can accommodate a maximum of ${room.max_guests} guests.`
      );
      setBusy(false);
      return;
    }

    /*
     * DEPOSIT
     */
    const depositAmount =
      f.deposit === ''
        ? suggested
        : Math.max(
            0,
            Number(f.deposit)
          );

    /*
     * PAYLOAD
     */
    const payload = {
      ...f,

      guests: Number(f.guests),

      deposit: depositAmount,

      payment_status: 'Unpaid',

      payment_updated_at: null,
      paid_at: null,
    };

    try {
      const response = await fetch(
        '/api/reservations',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify(
            payload
          ),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setMsg(
          data.error ||
            'Unable to reserve.'
        );

        setBusy(false);
        return;
      }

      /*
       * SUCCESS
       */
      setBooking(
        data.booking_id
      );

      setMsg(
        'Your reservation request has been received. Staff will review your reservation and payment. Your booking details will be emailed automatically.'
      );

      /*
       * RESET FORM
       */
      setF((current) => ({
        ...current,

        guest_name: '',
        mobile: '',
        email: '',

        check_in: '',
        check_out: '',

        guests: '2',

        room_id:
          current.room_id,

        payment_method:
          current.payment_method,

        deposit: '',
        payment_ref: '',
        special_requests: '',
        payment_proof_url: '',

        notification_consent:
          true,
      }));
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : 'Unable to reserve.'
      );
    }

    setBusy(false);
  }

  /*
   * ==========================================
   * SUCCESS SCREEN
   * ==========================================
   */
  if (booking) {
    return (
      <div className="booking-page">
        <div className="booking-glow" />

        <div className="booking-panel">

          <div className="brand-mark">
            <span>SAKURA ANANDA</span>
            <small>PRIVATE RESORT</small>
          </div>

          <div className="eyebrow">
            RESERVATION
          </div>

          <h1>
            Reservation received.
          </h1>

          <p className="muted">
            Thank you for choosing
            Sakura Ananda Resort.
          </p>

          <div className="card success-card">

            <span className="pill success">
              ✓ Reservation received
            </span>

            <div className="booking-label">
              BOOKING ID
            </div>

            <h2>
              {booking}
            </h2>

            <p>
              {msg}
            </p>

            <div className="notice success">

              <b>
                Payment verification
              </b>

              <p>
                If you entered a deposit,
                staff will verify the payment
                before marking it as
                <strong> PAID</strong>.
              </p>

            </div>

            <div className="notice">

              <b>
                Keep your booking ID
              </b>

              <p>
                Staff will use your booking
                ID when confirming your
                reservation and payment.
              </p>

            </div>

          </div>

        </div>
      </div>
    );
  }

  /*
   * ==========================================
   * RESERVATION FORM
   * ==========================================
   */
  return (
    <div className="booking-page">

      <div className="booking-glow" />

      <div className="booking-panel">

        {/* BRAND */}
        <div className="brand-mark">
          <span>SAKURA ANANDA</span>
          <small>PRIVATE RESORT</small>
        </div>

        <div className="eyebrow">
          RESERVATION
        </div>

        <h1>
          Reserve your stay.
        </h1>

        <p className="muted intro">
          A peaceful stay begins here.
          Complete your reservation details
          and our team will review your request.
        </p>

        <form
          className="card form-card"
          onSubmit={submit}
        >

          {/* ================================= */}
          {/* GUEST DETAILS */}
          {/* ================================= */}

          <div className="section-title">
            <span>01</span>
            Guest details
          </div>

          <div className="row">

            <div className="field">

              <label>
                Guest name <b>*</b>
              </label>

              <input
                required
                value={f.guest_name}
                onChange={(e) =>
                  updateText(
                    'guest_name',
                    e.target.value
                  )
                }
                placeholder="FULL NAME"
                autoComplete="name"
              />

            </div>

            <div className="field">

              <label>
                Mobile <b>*</b>
              </label>

              <input
                required
                value={f.mobile}
                onChange={(e) =>
                  update(
                    'mobile',
                    e.target.value
                  )
                }
                placeholder="09XX XXX XXXX"
                inputMode="tel"
                autoComplete="tel"
              />

              <small className="field-hint">
                Enter your contact number.
              </small>

            </div>

          </div>

          <div className="row">

            <div className="field">

              <label>
                Email
              </label>

              <input
                type="email"
                value={f.email}
                onChange={(e) =>
                  update(
                    'email',
                    e.target.value
                  )
                }
                placeholder="YOU@EXAMPLE.COM"
                autoComplete="email"
              />

            </div>

            <div className="field">

              <label>
                Guests <b>*</b>
              </label>

              <input
                type="number"
                min="1"
                max={
                  room?.max_guests ||
                  4
                }
                value={f.guests}
                onChange={(e) =>
                  update(
                    'guests',
                    e.target.value
                  )
                }
              />

            </div>

          </div>

          {/* ================================= */}
          {/* DATES */}
          {/* ================================= */}

          <div className="section-title">
            <span>02</span>
            Stay details
          </div>

          <div className="row">

            <div className="field">

              <label>
                Check-in <b>*</b>
              </label>

              <input
                type="date"
                required
                min={today}
                value={f.check_in}
                onChange={(e) =>
                  update(
                    'check_in',
                    e.target.value
                  )
                }
              />

            </div>

            <div className="field">

              <label>
                Check-out <b>*</b>
              </label>

              <input
                type="date"
                required
                min={
                  f.check_in || today
                }
                value={f.check_out}
                onChange={(e) =>
                  update(
                    'check_out',
                    e.target.value
                  )
                }
              />

            </div>

          </div>

          {/* ================================= */}
          {/* ROOM */}
          {/* ================================= */}

          <div className="field">

            <label>
              Room <b>*</b>
            </label>

            <select
              value={f.room_id}
              onChange={(e) =>
                update(
                  'room_id',
                  e.target.value
                )
              }
              required
            >

              {rooms.map((r) => (
                <option
                  key={r.id}
                  value={r.id}
                >
                  {r.name}
                  {' — ₱'}
                  {Number(
                    r.rate
                  ).toLocaleString()}
                  /night
                  {' — up to '}
                  {r.max_guests}
                  {' guests'}
                </option>
              ))}

            </select>

          </div>

          {/* ================================= */}
          {/* SUMMARY */}
          {/* ================================= */}

          {nights > 0 && (
            <div className="notice stay-summary">

              <div className="summary-heading">
                <span>
                  YOUR STAY
                </span>

                <span>
                  {nights}{' '}
                  night
                  {nights !== 1
                    ? 's'
                    : ''}
                </span>
              </div>

              <div className="summary-line">

                <span>
                  {room?.name}
                </span>

                <strong>
                  ₱
                  {total.toLocaleString()}
                </strong>

              </div>

              <div className="summary-line subtle">

                <span>
                  Suggested deposit (
                  {Math.round(
                    depositPct * 100
                  )}
                  %)
                </span>

                <strong>
                  ₱
                  {suggested.toLocaleString()}
                </strong>

              </div>

            </div>
          )}

          {/* ================================= */}
          {/* PAYMENT */}
          {/* ================================= */}

          <div className="section-title">
            <span>03</span>
            Payment
          </div>

          <div className="row">

            <div className="field">

              <label>
                Payment method <b>*</b>
              </label>

              <select
                value={
                  f.payment_method
                }
                onChange={(e) =>
                  update(
                    'payment_method',
                    e.target.value
                  )
                }
              >

                <option>
                  GCash
                </option>

                <option>
                  Cash
                </option>

                <option>
                  Maya
                </option>

                <option>
                  Bank Transfer
                </option>

              </select>

            </div>

            <div className="field">

              <label>
                Deposit paid
              </label>

              <input
                type="number"
                min="0"
                max={total}
                value={f.deposit}
                onChange={(e) =>
                  update(
                    'deposit',
                    e.target.value
                  )
                }
                placeholder={
                  suggested
                    ? String(
                        suggested
                      )
                    : '0'
                }
              />

            </div>

          </div>

          {/* ================================= */}
          {/* GCASH */}
          {/* ================================= */}

          {qr &&
            f.payment_method ===
              'GCash' && (

            <div className="notice payment-box">

              <div className="payment-title">
                <span className="payment-icon">
                  ₱
                </span>

                <div>
                  <b>
                    GCash payment
                  </b>

                  <p>
                    Scan the QR code to
                    make your deposit.
                  </p>
                </div>
              </div>

              <div className="qr-wrapper">
                <img
                  className="qr"
                  src={qr}
                  alt="Sakura Ananda GCash QR"
                />
              </div>

              <p className="payment-note">
                Your payment will remain
                <strong> UNPAID </strong>
                until staff verifies it.
              </p>

            </div>
          )}

          {/* ================================= */}
          {/* PAYMENT REFERENCE */}
          {/* ================================= */}

          <div className="row">

            <div className="field">

              <label>
                Payment reference
              </label>

              <input
                value={
                  f.payment_ref
                }
                onChange={(e) =>
                  updateText(
                    'payment_ref',
                    e.target.value
                  )
                }
                placeholder="OPTIONAL REFERENCE NUMBER"
              />

            </div>

            <div className="field">

              <label>
                Payment proof link
              </label>

              <input
                value={
                  f.payment_proof_url
                }
                onChange={(e) =>
                  update(
                    'payment_proof_url',
                    e.target.value
                  )
                }
                placeholder="OPTIONAL IMAGE LINK"
              />

            </div>

          </div>

          {/* ================================= */}
          {/* SPECIAL REQUESTS */}
          {/* ================================= */}

          <div className="section-title">
            <span>04</span>
            Additional information
          </div>

          <div className="field">

            <label>
              Special requests
            </label>

            <textarea
              value={
                f.special_requests
              }
              onChange={(e) =>
                updateText(
                  'special_requests',
                  e.target.value
                )
              }
              placeholder="ARRIVAL NOTES, CELEBRATIONS, SPECIAL REQUESTS, ETC."
              rows={4}
            />

          </div>

          {/* ================================= */}
          {/* CONSENT */}
          {/* ================================= */}

          <label className="consent">

            <input
              type="checkbox"
              checked={
                f.notification_consent
              }
              onChange={(e) =>
                update(
                  'notification_consent',
                  e.target.checked
                )
              }
            />

            <span>
              I agree to receive booking
              updates and reminders by SMS
              and/or email using the contact
              details above.
            </span>

          </label>

          {/* ================================= */}
          {/* MESSAGE */}
          {/* ================================= */}

          {msg && (
            <div
              className={`notice ${
                msg.startsWith(
                  'Your reservation'
                )
                  ? 'success'
                  : 'error'
              }`}
            >
              {msg}
            </div>
          )}

          {/* ================================= */}
          {/* SUBMIT */}
          {/* ================================= */}

          <button
            type="submit"
            className="btn"
            disabled={busy}
          >

            <span>
              {busy
                ? 'Securing your dates…'
                : 'Submit reservation request'}
            </span>

            {!busy && (
              <span className="arrow">
                →
              </span>
            )}

          </button>

          <p className="secure-note">
            ✦ Your reservation details are
            securely submitted for staff review.
          </p>

        </form>

      </div>

      {/* ===================================== */}
      {/* PAGE STYLES */}
      {/* ===================================== */}

      <style jsx global>{`

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background:
            linear-gradient(
              135deg,
              #faf7f2 0%,
              #f5eee7 45%,
              #f8f1ec 100%
            );
          color: #302723;
        }

        .booking-page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          padding: 70px 20px 100px;
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .booking-glow {
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          background:
            radial-gradient(
              circle,
              rgba(190, 145, 120, .18),
              transparent 70%
            );
          top: -180px;
          right: -160px;
          pointer-events: none;
        }

        .booking-panel {
          width: 100%;
          max-width: 920px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .brand-mark {
          text-align: center;
          margin-bottom: 42px;
          color: #5b4034;
          letter-spacing: .18em;
        }

        .brand-mark span {
          display: block;
          font-family:
            Georgia,
            "Times New Roman",
            serif;
          font-size: 23px;
          font-weight: 600;
          letter-spacing: .22em;
        }

        .brand-mark small {
          display: block;
          margin-top: 7px;
          font-size: 9px;
          letter-spacing: .42em;
          color: #a88775;
        }

        .eyebrow {
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .28em;
          color: #a37862;
          margin-bottom: 14px;
        }

        h1 {
          text-align: center;
          font-family:
            Georgia,
            "Times New Roman",
            serif;
          font-size: clamp(38px, 6vw, 64px);
          font-weight: 400;
          line-height: 1.05;
          color: #392a25;
          margin: 0;
        }

        .muted {
          color: #81736c;
          line-height: 1.7;
        }

        .intro {
          max-width: 650px;
          text-align: center;
          margin: 18px auto 42px;
          font-size: 15px;
        }

        .card {
          background:
            rgba(255, 253, 250, .88);
          border: 1px solid
            rgba(146, 111, 91, .15);
          border-radius: 26px;
          box-shadow:
            0 25px 70px
              rgba(82, 55, 43, .10),
            0 4px 14px
              rgba(82, 55, 43, .05);
          backdrop-filter: blur(12px);
        }

        .form-card {
          padding: clamp(24px, 5vw, 48px);
        }

        .row {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 22px;
          margin-bottom: 22px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 9px;
          margin-bottom: 22px;
        }

        .field label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: #65544c;
        }

        .field label b {
          color: #b26d63;
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid #e3d8d0;
          border-radius: 13px;
          background: #fffdfb;
          color: #302723;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          transition:
            border-color .2s ease,
            box-shadow .2s ease,
            background .2s ease;
        }

        input,
        select {
          height: 52px;
          padding: 0 16px;
        }

        textarea {
          padding: 15px 16px;
          resize: vertical;
          min-height: 110px;
          line-height: 1.6;
        }

        input::placeholder,
        textarea::placeholder {
          color: #b3a69f;
          letter-spacing: .04em;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #b9927d;
          background: #fff;
          box-shadow:
            0 0 0 4px
              rgba(185, 146, 125, .10);
        }

        input[type="date"] {
          color-scheme: light;
        }

        input[type="number"] {
          appearance: textfield;
        }

        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          opacity: .5;
        }

        .field-hint {
          font-size: 11px;
          color: #9b8d85;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 10px 0 24px;
          padding-bottom: 12px;
          border-bottom: 1px solid #eee4dd;
          font-family:
            Georgia,
            "Times New Roman",
            serif;
          font-size: 20px;
          color: #4b3830;
        }

        .section-title span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #eee1d8;
          color: #8d6654;
          font-family: inherit;
          font-size: 11px;
        }

        .notice {
          padding: 18px 20px;
          margin: 12px 0 24px;
          border-radius: 16px;
          background: #f7f1ec;
          border: 1px solid #e8ddd5;
          color: #62534c;
          line-height: 1.6;
        }

        .notice p {
          margin:
            7px 0 0;
        }

        .notice.success {
          background: #f0f5ef;
          border-color: #d8e5d5;
          color: #50634d;
        }

        .notice.error {
          background: #fbefed;
          border-color: #efd2ce;
          color: #9a554d;
        }

        .stay-summary {
          background:
            linear-gradient(
              135deg,
              #f8f1ec,
              #f4ebe4
            );
        }

        .summary-heading,
        .summary-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .summary-heading {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .15em;
          color: #9a7968;
          margin-bottom: 13px;
        }

        .summary-line {
          font-size: 15px;
          color: #4d3b33;
        }

        .summary-line strong {
          color: #754f3d;
          font-size: 17px;
        }

        .summary-line.subtle {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid
            rgba(120, 90, 70, .10);
          font-size: 12px;
          color: #85766e;
        }

        .summary-line.subtle strong {
          font-size: 13px;
        }

        .payment-box {
          text-align: center;
        }

        .payment-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 13px;
          text-align: left;
        }

        .payment-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #eadbd2;
          color: #775341;
          font-weight: 700;
        }

        .payment-title p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #8c7c74;
        }

        .qr-wrapper {
          display: flex;
          justify-content: center;
          margin: 22px 0 15px;
        }

        .qr {
          width: 220px;
          max-width: 100%;
          padding: 10px;
          border-radius: 15px;
          background: #fff;
          border: 1px solid #e4d9d1;
          box-shadow:
            0 12px 30px
              rgba(70, 48, 38, .08);
        }

        .payment-note {
          font-size: 12px;
          color: #8a7a72;
        }

        .payment-note strong {
          color: #9a554d;
        }

        .consent {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin: 8px 0 24px;
          font-size: 12px;
          line-height: 1.6;
          color: #786b64;
          cursor: pointer;
        }

        .consent input {
          width: 17px;
          height: 17px;
          min-width: 17px;
          margin-top: 1px;
          accent-color: #96715f;
        }

        .btn {
          width: 100%;
          height: 58px;
          border: 0;
          border-radius: 15px;
          background:
            linear-gradient(
              135deg,
              #6d4d3e,
              #8c6551
            );
          color: #fff;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 15px;
          box-shadow:
            0 12px 30px
              rgba(94, 65, 52, .22);
          transition:
            transform .2s ease,
            box-shadow .2s ease,
            opacity .2s ease;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 17px 36px
              rgba(94, 65, 52, .28);
        }

        .btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn:disabled {
          opacity: .65;
          cursor: not-allowed;
        }

        .arrow {
          font-size: 20px;
          font-weight: 400;
        }

        .secure-note {
          text-align: center;
          color: #a0938c;
          font-size: 10px;
          letter-spacing: .04em;
          margin:
            18px 0 0;
        }

        /* SUCCESS */

        .success-card {
          max-width: 680px;
          margin: 30px auto 0;
          padding: clamp(28px, 5vw, 48px);
        }

        .pill {
          display: inline-flex;
          align-items: center;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .pill.success {
          background: #eaf2e8;
          color: #60755c;
        }

        .booking-label {
          margin-top: 30px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .2em;
          color: #a18576;
        }

        .success-card h2 {
          margin:
            7px 0 12px;
          font-family:
            Georgia,
            "Times New Roman",
            serif;
          font-size: clamp(34px, 8vw, 48px);
          color: #4b362d;
          word-break: break-word;
        }

        .success-card > p {
          color: #756861;
          line-height: 1.7;
        }

        @media (max-width: 700px) {

          .booking-page {
            padding:
              45px 14px 70px;
          }

          .row {
            grid-template-columns: 1fr;
            gap: 0;
            margin-bottom: 0;
          }

          .form-card {
            padding: 22px;
            border-radius: 20px;
          }

          .brand-mark {
            margin-bottom: 30px;
          }

          .brand-mark span {
            font-size: 18px;
          }

          .section-title {
            margin-top: 6px;
          }

          .success-card {
            padding: 25px;
          }

        }

      `}</style>

    </div>
  );
}
