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
   * CAPITALIZE TEXT
   * ==========================================
   *
   * Converts:
   *
   * juan dela cruz
   *
   * into:
   *
   * JUAN DELA CRUZ
   *
   * This is useful for names, references,
   * and text fields.
   */
  function uppercase(
    value: string
  ) {
    return value.toUpperCase();
  }

  /*
   * ==========================================
   * MOBILE NUMBER
   * ==========================================
   *
   * Digits only.
   *
   * Maximum 11 digits.
   *
   * Example:
   *
   * 09123456789
   *
   * Displayed as:
   *
   * 0912 345 6789
   */
  function formatMobile(
    value: string
  ) {
    const digits =
      value
        .replace(/\D/g, '')
        .slice(0, 11);

    if (digits.length <= 4) {
      return digits;
    }

    if (digits.length <= 7) {
      return (
        digits.slice(0, 4) +
        ' ' +
        digits.slice(4)
      );
    }

    return (
      digits.slice(0, 4) +
      ' ' +
      digits.slice(4, 7) +
      ' ' +
      digits.slice(7)
    );
  }

  /*
   * ==========================================
   * RAW MOBILE NUMBER
   * ==========================================
   */
  function cleanMobile(
    value: string
  ) {
    return value.replace(
      /\D/g,
      ''
    );
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
     * ROOM VALIDATION
     */
    if (!f.room_id) {
      setMsg(
        'Please select a room.'
      );
      setBusy(false);
      return;
    }

    /*
     * DATE VALIDATION
     */
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

    /*
     * MOBILE VALIDATION
     */
    const mobile =
      cleanMobile(
        f.mobile
      );

    if (
      mobile.length !== 11
    ) {
      setMsg(
        'Please enter a valid 11-digit Philippine mobile number.'
      );
      setBusy(false);
      return;
    }

    if (
      !mobile.startsWith('09')
    ) {
      setMsg(
        'Mobile number must start with 09.'
      );
      setBusy(false);
      return;
    }

    /*
     * GUEST LIMIT
     */
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
     * SEND RESERVATION
     *
     * room_id remains the UUID.
     *
     * The room name is resolved from
     * the rooms table and displayed to
     * the guest.
     */
    const payload = {
      ...f,

      /*
       * Store clean 11-digit mobile.
       */
      mobile,

      /*
       * Capitalize guest name.
       */
      guest_name:
        uppercase(
          f.guest_name.trim()
        ),

      /*
       * Capitalize payment reference.
       */
      payment_ref:
        uppercase(
          f.payment_ref.trim()
        ),

      /*
       * Capitalize special requests.
       */
      special_requests:
        uppercase(
          f.special_requests.trim()
        ),

      guests:
        Number(f.guests),

      deposit:
        depositAmount,

      payment_status:
        'Unpaid',

      payment_updated_at:
        null,

      paid_at:
        null,
    };

    try {
      const response =
        await fetch(
          '/api/reservations',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify(
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
       * RESET
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
   * TODAY
   * ==========================================
   */
  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  /*
   * ==========================================
   * SUCCESS SCREEN
   * ==========================================
   */
  if (booking) {
    return (
      <div className="booking-page">

        <div className="booking-background" />

        <div className="booking-panel">

          <div className="brand-mark">
            桜
          </div>

          <div className="eyebrow">
            SAKURA ANANDA • PRIVATE RESORT
          </div>

          <h1>
            Reservation received.
          </h1>

          <p className="muted intro">
            Thank you for choosing
            Sakura Ananda Resort.
            Your reservation request
            has been successfully received.
          </p>

          <div className="card success-card">

            <span className="pill success">
              ✓ Reservation Received
            </span>

            <div className="booking-label">
              YOUR BOOKING ID
            </div>

            <h2 className="booking-number">
              {booking}
            </h2>

            <p className="success-message">
              {msg}
            </p>

            <div className="notice success">

              <b>
                Payment verification
              </b>

              <p>
                If you entered a deposit,
                our staff will verify the
                payment before marking the
                reservation as
                <strong> PAID</strong>.
              </p>

            </div>

            <div className="notice">

              <b>
                Keep your booking ID
              </b>

              <p>
                Please keep this booking ID
                for future inquiries,
                confirmation, and payment
                verification.
              </p>

            </div>

          </div>

        </div>

        <style jsx>{`
          .booking-page {
            min-height: 100vh;
            position: relative;
            overflow: hidden;
            background:
              radial-gradient(
                circle at 10% 10%,
                rgba(210, 161, 154, 0.18),
                transparent 32%
              ),
              radial-gradient(
                circle at 90% 90%,
                rgba(185, 145, 120, 0.15),
                transparent 30%
              ),
              #f7f2ed;
          }

          .booking-background {
            position: absolute;
            inset: 0;
            pointer-events: none;
            background-image:
              radial-gradient(
                rgba(154, 106, 96, 0.12) 1px,
                transparent 1px
              );
            background-size: 28px 28px;
            opacity: 0.25;
          }

          .booking-panel {
            position: relative;
            width: min(680px, calc(100% - 32px));
            margin: auto;
            padding: 70px 0;
          }

          .brand-mark {
            font-family:
              Georgia,
              'Times New Roman',
              serif;
            color: #a36e64;
            font-size: 38px;
            margin-bottom: 6px;
          }

          .eyebrow {
            font-size: 11px;
            letter-spacing: 2.4px;
            color: #9b8177;
            font-weight: 700;
          }

          h1 {
            font-family:
              Georgia,
              'Times New Roman',
              serif;
            font-weight: 400;
            color: #342b27;
            font-size: clamp(38px, 7vw, 58px);
            line-height: 1.05;
            margin: 14px 0;
          }

          .intro {
            max-width: 580px;
            line-height: 1.8;
          }

          .card {
            background: rgba(255, 255, 255, 0.94);
            border: 1px solid #e8ddd5;
            border-radius: 22px;
            box-shadow:
              0 20px 60px rgba(76, 54, 45, 0.10);
          }

          .success-card {
            padding: 34px;
            margin-top: 32px;
          }

          .pill {
            display: inline-flex;
            padding: 8px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
          }

          .pill.success {
            color: #3f6849;
            background: #eaf4ec;
          }

          .booking-label {
            margin-top: 32px;
            font-size: 11px;
            letter-spacing: 2px;
            color: #9a8b83;
            font-weight: 700;
          }

          .booking-number {
            margin: 8px 0 12px;
            font-family:
              Georgia,
              'Times New Roman',
              serif;
            font-size: clamp(32px, 7vw, 46px);
            color: #8e6259;
            letter-spacing: 1px;
            word-break: break-word;
          }

          .success-message {
            color: #625751;
            line-height: 1.7;
          }

          .notice {
            margin-top: 18px;
            padding: 18px 20px;
            border-radius: 14px;
            background: #faf6f1;
            border: 1px solid #e9dfd7;
            color: #665b54;
          }

          .notice p {
            margin: 7px 0 0;
            line-height: 1.65;
          }

          .notice.success {
            background: #f0f7f1;
            border-color: #d5e6d8;
          }
        `}</style>
      </div>
    );
  }

  /*
   * ==========================================
   * FORM
   * ==========================================
   */
  return (
    <div className="booking-page">

      <div className="booking-background" />

      <div className="booking-panel">

        <div className="brand-mark">
          桜
        </div>

        <div className="eyebrow">
          SAKURA ANANDA • PRIVATE RESORT
        </div>

        <h1>
          Reserve your stay.
        </h1>

        <p className="muted intro">
          Create your reservation request
          and let our team prepare your
          stay with care.
        </p>

        <div className="welcome-card">

          <div className="welcome-icon">
            ✦
          </div>

          <div>
            <strong>
              A peaceful stay awaits.
            </strong>

            <p>
              Select your room and dates,
              provide your details, and
              submit your request.
            </p>
          </div>

        </div>

        <form
          className="card form-card form"
          onSubmit={submit}
        >

          {/* ============================== */}
          {/* GUEST DETAILS */}
          {/* ============================== */}

          <div className="section-title">
            <span>01</span>
            Guest Details
          </div>

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
                    uppercase(
                      e.target.value
                    )
                  )
                }
                placeholder="FULL NAME"
                autoCapitalize="characters"
              />

              <small>
                Automatically capitalized
              </small>

            </div>

            <div className="field">

              <label>
                Mobile *
              </label>

              <input
                required
                type="tel"
                inputMode="numeric"
                pattern="09[0-9]{9}"
                maxLength={13}
                value={formatMobile(f.mobile)}
                onChange={(e) =>
                  update(
                    'mobile',
                    cleanMobile(
                      e.target.value
                    )
                  )
                }
                placeholder="0912 345 6789"
              />

              <small>
                11 digits • Philippine mobile number
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

          <div className="section-title">
            <span>02</span>
            Your Stay
          </div>

          <div className="row">

            <div className="field">

              <label>
                Check-in *
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
                Check-out *
              </label>

              <input
                type="date"
                required
                min={
                  f.check_in ||
                  today
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
          {/* SUMMARY */}
          {/* ============================== */}

          {nights > 0 && (

            <div className="stay-summary">

              <div className="summary-heading">
                <span>
                  Stay Summary
                </span>

                <span className="summary-room">
                  {room?.name}
                </span>
              </div>

              <div className="summary-line">

                <span>
                  {nights}
                  {' '}
                  night
                  {nights !== 1
                    ? 's'
                    : ''}
                </span>

                <strong>
                  ₱
                  {total.toLocaleString()}
                </strong>

              </div>

              <div className="summary-line secondary">

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

          <div className="section-title">
            <span>03</span>
            Payment
          </div>

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
          {/* GCash */}
          {/* ============================== */}

          {qr &&
            f.payment_method ===
              'GCash' && (

            <div className="payment-card">

              <div className="payment-header">
                <span className="payment-icon">
                  ₱
                </span>

                <div>
                  <b>
                    GCash Payment
                  </b>

                  <p>
                    Scan the QR code to
                    make your deposit.
                  </p>
                </div>
              </div>

              <img
                className="qr"
                src={qr}
                alt="Sakura Ananda GCash QR"
              />

              <div className="payment-warning">
                Your payment will remain
                <strong> UNPAID</strong> until
                our staff verifies it.
              </div>

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
                    uppercase(
                      e.target.value
                    )
                  )
                }
                placeholder="REFERENCE NUMBER"
                autoCapitalize="characters"
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
                placeholder="HTTPS://..."
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
                  uppercase(
                    e.target.value
                  )
                )
              }
              placeholder="ARRIVAL NOTES, CELEBRATIONS, SPECIAL REQUESTS..."
              autoCapitalize="characters"
            />

          </div>

          {/* ============================== */}
          {/* CONSENT */}
          {/* ============================== */}

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
              : 'Submit Reservation Request'}

            {!busy && (
              <span>
                →
              </span>
            )}

          </button>

          <div className="form-footer">
            Sakura Ananda Resort
            <span>•</span>
            Private & Peaceful
          </div>

        </form>

      </div>

      <style jsx>{`

        * {
          box-sizing: border-box;
        }

        .booking-page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 8% 5%,
              rgba(210, 161, 154, 0.18),
              transparent 30%
            ),
            radial-gradient(
              circle at 92% 90%,
              rgba(190, 150, 126, 0.14),
              transparent 30%
            ),
            #f7f2ed;
        }

        .booking-background {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            radial-gradient(
              rgba(154, 106, 96, 0.12) 1px,
              transparent 1px
            );
          background-size: 28px 28px;
          opacity: 0.28;
        }

        .booking-panel {
          position: relative;
          width: min(
            860px,
            calc(100% - 30px)
          );
          margin: auto;
          padding: 55px 0 80px;
        }

        .brand-mark {
          font-family:
            Georgia,
            'Times New Roman',
            serif;
          color: #a36e64;
          font-size: 38px;
          margin-bottom: 5px;
        }

        .eyebrow {
          font-size: 10px;
          letter-spacing: 2.8px;
          color: #9b8177;
          font-weight: 800;
        }

        h1 {
          font-family:
            Georgia,
            'Times New Roman',
            serif;
          font-weight: 400;
          color: #342b27;
          font-size: clamp(
            40px,
            8vw,
            66px
          );
          line-height: 1;
          margin: 16px 0 18px;
        }

        .intro {
          max-width: 680px;
          font-size: 16px;
          line-height: 1.8;
        }

        .muted {
          color: #756962;
        }

        .welcome-card {
          display: flex;
          gap: 16px;
          align-items: center;
          margin: 28px 0;
          padding: 18px 20px;
          background: rgba(
            255,
            255,
            255,
            0.72
          );
          border: 1px solid #e8ddd5;
          border-radius: 16px;
          color: #554b45;
        }

        .welcome-card p {
          margin: 5px 0 0;
          font-size: 13px;
          color: #82766e;
          line-height: 1.6;
        }

        .welcome-icon {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #f3e5df;
          color: #9a6a60;
        }

        .card {
          background: rgba(
            255,
            255,
            255,
            0.96
          );
          border: 1px solid #e7dcd4;
          border-radius: 24px;
          box-shadow:
            0 25px 70px
            rgba(
              70,
              49,
              40,
              0.11
            );
        }

        .form-card {
          padding: clamp(
            24px,
            5vw,
            42px
          );
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 8px 0 22px;
          padding-bottom: 12px;
          border-bottom: 1px solid #eee5df;
          font-family:
            Georgia,
            'Times New Roman',
            serif;
          font-size: 22px;
          color: #403632;
        }

        .section-title span {
          display: grid;
          place-items: center;
          width: 29px;
          height: 29px;
          border-radius: 50%;
          background: #f1e3de;
          color: #9a6a60;
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: 800;
        }

        .row {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 18px;
        }

        .field {
          margin-bottom: 18px;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          color: #514640;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .field small {
          display: block;
          margin-top: 6px;
          color: #9b8d85;
          font-size: 10px;
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid #ded2ca;
          border-radius: 12px;
          background: #fffdfa;
          color: #332c28;
          padding: 14px 15px;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 14px;
          outline: none;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease;
        }

        input:hover,
        select:hover,
        textarea:hover {
          border-color: #c9aea4;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #a9786d;
          background: #ffffff;
          box-shadow:
            0 0 0 4px
            rgba(
              169,
              120,
              109,
              0.10
            );
        }

        input::placeholder,
        textarea::placeholder {
          color: #b2a59e;
        }

        textarea {
          min-height: 110px;
          resize: vertical;
        }

        select {
          cursor: pointer;
        }

        .stay-summary {
          margin: 5px 0 30px;
          padding: 21px;
          border-radius: 16px;
          background:
            linear-gradient(
              135deg,
              #faf3ed,
              #f5ebe5
            );
          border: 1px solid #eadbd2;
        }

        .summary-heading {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 15px;
          font-family:
            Georgia,
            'Times New Roman',
            serif;
          color: #4a3d37;
          font-size: 17px;
        }

        .summary-room {
          color: #9b6d63;
          font-family: Arial, sans-serif;
          font-size: 12px;
          font-weight: 700;
        }

        .summary-line {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          color: #554943;
          font-size: 14px;
        }

        .summary-line strong {
          color: #8e5f55;
        }

        .summary-line.secondary {
          margin-top: 9px;
          padding-top: 9px;
          border-top: 1px solid #e7d9d1;
          color: #8a7b73;
          font-size: 12px;
        }

        .payment-card {
          margin: 5px 0 24px;
          padding: 24px;
          border-radius: 18px;
          background: #fbf7f3;
          border: 1px solid #eaded6;
          text-align: center;
        }

        .payment-header {
          display: flex;
          align-items: center;
          gap: 13px;
          text-align: left;
          margin-bottom: 20px;
        }

        .payment-header p {
          margin: 4px 0 0;
          color: #82766e;
          font-size: 12px;
        }

        .payment-icon {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: #efe0d9;
          color: #97675d;
          font-weight: 800;
        }

        .qr {
          display: block;
          width: min(
            260px,
            100%
          );
          margin: auto;
          border-radius: 14px;
          border: 8px solid white;
          box-shadow:
            0 12px 30px
            rgba(
              70,
              50,
              40,
              0.12
            );
        }

        .payment-warning {
          margin-top: 18px;
          padding: 12px;
          border-radius: 10px;
          background: #f5ece6;
          color: #786b63;
          font-size: 12px;
          line-height: 1.6;
        }

        .payment-warning strong {
          color: #97675d;
        }

        .consent {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin: 24px 0;
          color: #766a63;
          font-size: 12px;
          line-height: 1.6;
          cursor: pointer;
        }

        .consent input {
          width: 17px;
          height: 17px;
          margin-top: 1px;
          accent-color: #a36e64;
        }

        .notice {
          margin: 18px 0;
          padding: 17px 19px;
          border-radius: 13px;
          background: #faf6f1;
          border: 1px solid #e8ddd5;
          color: #665a53;
          font-size: 13px;
          line-height: 1.6;
        }

        .notice.success {
          background: #f0f7f1;
          border-color: #d5e6d8;
          color: #4d6953;
        }

        .notice.error {
          background: #fff0ee;
          border-color: #efd3ce;
          color: #8a5148;
        }

        .btn {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 14px;
          border: 0;
          border-radius: 13px;
          padding: 17px 20px;
          background:
            linear-gradient(
              135deg,
              #9c6b61,
              #b27e72
            );
          color: white;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.5px;
          cursor: pointer;
          box-shadow:
            0 12px 28px
            rgba(
              145,
              95,
              85,
              0.22
            );
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            opacity 0.2s ease;
        }

        .btn:hover:not(:disabled) {
          transform:
            translateY(-2px);
          box-shadow:
            0 16px 32px
            rgba(
              145,
              95,
              85,
              0.28
            );
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .form-footer {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 18px;
          color: #a0928a;
          font-size: 10px;
          letter-spacing: 0.5px;
        }

        /* SUCCESS */

        .success-card {
          padding: 34px;
        }

        .pill {
          display: inline-flex;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
        }

        .pill.success {
          color: #3f6849;
          background: #eaf4ec;
        }

        .booking-label {
          margin-top: 32px;
          color: #9a8b83;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .booking-number {
          margin: 8px 0 14px;
          color: #8e6259;
          font-family:
            Georgia,
            'Times New Roman',
            serif;
          font-size: clamp(
            32px,
            7vw,
            46px
          );
          word-break: break-word;
        }

        .success-message {
          color: #665b54;
          line-height: 1.7;
        }

        @media (max-width: 680px) {

          .booking-panel {
            width:
              calc(100% - 22px);
            padding:
              35px 0 55px;
          }

          .row {
            grid-template-columns: 1fr;
            gap: 0;
            margin-bottom: 0;
          }

          .form-card {
            padding: 21px;
            border-radius: 19px;
          }

          .welcome-card {
            align-items: flex-start;
          }

          .success-card {
            padding: 25px;
          }

          .section-title {
            margin-top: 15px;
          }

        }

      `}</style>

    </div>
  );
}
