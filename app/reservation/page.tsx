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
      /*
       * LOAD ACTIVE ROOMS
       *
       * Visible room name comes from r.name.
       * Example:
       * Room 1
       *
       * The UUID remains internally stored
       * in room_id.
       */
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

      const qrRow =
        settingsData?.find(
          (x) => x.key === 'gcash_qr_url'
        );

      const depositRow =
        settingsData?.find(
          (x) => x.key === 'deposit_percent'
        );

      setQr(qrRow?.value || null);

      const configuredDeposit =
        Number(
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

  const suggested =
    Math.round(
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
      Number(f.guests) > room.max_guests
    ) {
      setMsg(
        `${room.name} can accommodate a maximum of ${room.max_guests} guests.`
      );

      setBusy(false);
      return;
    }

    /*
     * DEPOSIT
     *
     * If the guest leaves the field empty,
     * use the suggested deposit amount.
     */
    const depositAmount =
      f.deposit === ''
        ? suggested
        : Math.max(
            0,
            Number(f.deposit)
          );

    /*
     * RESERVATION PAYLOAD
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
      <div className="booking-panel">

        <div className="eyebrow">
          Sakura Ananda • Reservation
        </div>

        <h1>
          Reservation received.
        </h1>

        <p className="muted">
          Thank you for choosing
          Sakura Ananda Resort.
        </p>

        <div
          className="card"
          style={{
            marginTop: 26,
          }}
        >

          <span className="pill success">
            Reservation received
          </span>

          <h2
            style={{
              fontSize: 42,
              margin:
                '12px 0 4px',
            }}
          >
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

          <div
            className="notice"
            style={{
              marginTop: 12,
            }}
          >

            <b>
              Keep your booking ID.
            </b>

            <p>
              Staff will use your booking ID
              when confirming your reservation
              and payment.
            </p>

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
    <div className="booking-panel">

      <div className="eyebrow">
        Sakura Ananda • Reservation
      </div>

      <h1>
        Reserve your stay.
      </h1>

      <p className="muted">
        Your reservation is separate from
        front-desk check-in. We protect the
        dates while your request is reviewed
        by staff.
      </p>

      <form
        className="card form-card form"
        onSubmit={submit}
      >

        {/* ============================== */}
        {/* GUEST DETAILS */}
        {/* ============================== */}

        <div className="row">

          <div className="field">

            <label>
              Guest name *
            </label>

            <input
              required
              value={f.guest_name}
              onChange={(e) =>
                update(
                  'guest_name',
                  e.target.value
                )
              }
              placeholder="Full name"
            />

          </div>

          <div className="field">

            <label>
              Mobile *
            </label>

            <input
              required
              type="tel"
              value={f.mobile}
              onChange={(e) =>
                update(
                  'mobile',
                  e.target.value
                )
              }
              placeholder="Mobile number"
            />

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
              placeholder="you@example.com"
            />

          </div>

          <div className="field">

            <label>
              Guests *
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

        {/* ============================== */}
        {/* DATES */}
        {/* ============================== */}

        <div className="row">

          <div className="field">

            <label>
              Check-in *
            </label>

            <input
              type="date"
              required
              min={
                new Date()
                  .toISOString()
                  .slice(0, 10)
              }
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
              Check-out *
            </label>

            <input
              type="date"
              required
              min={
                f.check_in ||
                new Date()
                  .toISOString()
                  .slice(0, 10)
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

        {/* ============================== */}
        {/* ROOM */}
        {/* ============================== */}

        <div className="field">

          <label>
            Room *
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

        {/* ============================== */}
        {/* STAY SUMMARY */}
        {/* ============================== */}

        {nights > 0 && (

          <div className="notice">

            <b>
              Stay summary
            </b>

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                marginTop: 8,
              }}
            >

              <span>
                {nights}
                {' '}
                night
                {nights !== 1
                  ? 's'
                  : ''}
                {' • '}
                {room?.name}
              </span>

              <strong>
                ₱
                {total.toLocaleString()}
              </strong>

            </div>

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                marginTop: 5,
              }}
            >

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

        {/* ============================== */}
        {/* PAYMENT */}
        {/* ============================== */}

        <div className="row">

          <div className="field">

            <label>
              Payment method *
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

        {/* ============================== */}
        {/* PAYMENT INFORMATION */}
        {/* ============================== */}

        {qr &&
          f.payment_method ===
            'GCash' && (

          <div className="notice">

            <b>
              GCash payment
            </b>

            <p>
              Scan the resort QR,
              then enter your payment
              reference below.
            </p>

            <img
              className="qr"
              src={qr}
              alt="Sakura Ananda GCash QR"
            />

            <p
              className="muted"
              style={{
                marginTop: 10,
              }}
            >
              Your payment will remain
              <strong>
                {' '}
                UNPAID
              </strong>
              {' '}
              until staff verifies it.
            </p>

          </div>

        )}

        {/* ============================== */}
        {/* PAYMENT REFERENCE */}
        {/* ============================== */}

        <div className="row">

          <div className="field">

            <label>
              Payment reference
            </label>

            <input
              value={f.payment_ref}
              onChange={(e) =>
                update(
                  'payment_ref',
                  e.target.value
                )
              }
              placeholder="Optional reference number"
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
              placeholder="Optional image link"
            />

          </div>

        </div>

        {/* ============================== */}
        {/* SPECIAL REQUESTS */}
        {/* ============================== */}

        <div className="field">

          <label>
            Special requests
          </label>

          <textarea
            value={
              f.special_requests
            }
            onChange={(e) =>
              update(
                'special_requests',
                e.target.value
              )
            }
            placeholder="Arrival notes, celebrations, etc."
          />

        </div>

        {/* ============================== */}
        {/* CONSENT */}
        {/* ============================== */}

        <label
          style={{
            display: 'flex',
            gap: 10,
            alignItems:
              'flex-start',
            fontSize: 12,
            color: '#6f625b',
          }}
        >

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

        {/* ============================== */}
        {/* MESSAGE */}
        {/* ============================== */}

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

        {/* ============================== */}
        {/* SUBMIT */}
        {/* ============================== */}

        <button
          className="btn"
          disabled={busy}
          type="submit"
        >

          {busy
            ? 'Securing your dates…'
            : 'Submit reservation request'}

        </button>

      </form>

    </div>
  );
}
