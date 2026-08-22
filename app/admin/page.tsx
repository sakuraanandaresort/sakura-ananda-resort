'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import type { Reservation, Room } from '../../lib/types';

type R = Reservation & {
  room?: Room;
};

const statusClass = (s: string) =>
  s === 'Confirmed' || s === 'Checked-in'
    ? 'success'
    : s === 'Pending'
    ? 'warn'
    : s === 'Cancelled'
    ? 'danger'
    : s === 'Checked-out'
    ? 'info'
    : '';

const today = () => new Date().toISOString().slice(0, 10);

export default function Admin() {
  const s = supabaseBrowser();

  const [user, setUser] = useState<any>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [rows, setRows] = useState<R[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [qr, setQr] = useState('');

  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  const [busy, setBusy] = useState<string | null>(null);

  // PAYMENT MODAL
  const [paymentOpen, setPaymentOpen] = useState<R | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentProof, setPaymentProof] = useState('');

  useEffect(() => {
    s.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: sub,
    } = s.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();

    setError('');

    const { error } = await s.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
  }

  async function load() {
    setError('');

    const [a, b, c] = await Promise.all([
      s
        .from('reservations')
        .select('*,room:rooms(*)')
        .order('check_in', { ascending: true }),

      s
        .from('rooms')
        .select('*')
        .order('name'),

      s
        .from('settings')
        .select('value')
        .eq('key', 'gcash_qr_url')
        .maybeSingle(),
    ]);

    if (a.error) {
      setError(a.error.message);
    }

    if (b.error) {
      setError(b.error.message);
    }

    setRows((a.data || []) as R[]);
    setRooms((b.data || []) as Room[]);
    setQr(c.data?.value || '');
  }

  useEffect(() => {
    if (user) {
      load();
    }
  }, [user]);

  // --------------------------------------------------
  // STATUS UPDATE
  // --------------------------------------------------

  async function action(id: string, status: string) {
    setBusy(id);
    setError('');
    setToast('');

    const updateData: any = {
      status,
    };

    if (status === 'Checked-out') {
      updateData.checked_out_at = new Date().toISOString();
    }

    const { error } = await s
      .from('reservations')
      .update(updateData)
      .eq('id', id);

    if (error) {
      setError(error.message);
      setBusy(null);
      return;
    }

    const event =
      status === 'Confirmed'
        ? 'confirmed'
        : status === 'Cancelled'
        ? 'cancelled'
        : status === 'Checked-out'
        ? 'checked-out'
        : status === 'Checked-in'
        ? 'checked-in'
        : '';

    if (event) {
      setToast(
        'Status updated. Google Sheets and email will update automatically.'
      );
    } else {
      setToast('Status updated.');
    }

    await load();

    setBusy(null);
  }

  // --------------------------------------------------
  // PAYMENT UPDATE
  // --------------------------------------------------

  async function updatePayment(r: R) {
    setBusy(r.id);
    setError('');
    setToast('');

    const amount = Number(paymentAmount);

    const roomTotal = Number(r.room_total || 0);

    if (!Number.isFinite(amount) || amount < 0) {
      setError('Please enter a valid payment amount.');
      setBusy(null);
      return;
    }

    if (amount > roomTotal) {
      setError(
        `Payment cannot be greater than the room total of ₱${roomTotal.toLocaleString(
          'en-PH'
        )}.`
      );

      setBusy(null);
      return;
    }

    const balance = Math.max(roomTotal - amount, 0);

    const { error } = await s
      .from('reservations')
      .update({
        deposit: amount,
        balance: balance,
        payment_method: paymentMethod || null,
        payment_ref: paymentRef || null,
        payment_proof_url: paymentProof || null,
      })
      .eq('id', r.id);

    if (error) {
      setError(error.message);
      setBusy(null);
      return;
    }

    setPaymentOpen(null);
    setPaymentAmount('');
    setPaymentMethod('');
    setPaymentRef('');
    setPaymentProof('');

    if (balance === 0) {
      setToast(
        'Payment updated. Reservation is FULLY PAID. Google Sheets and email will update automatically.'
      );
    } else {
      setToast(
        'Payment updated. Google Sheets and email will update automatically.'
      );
    }

    await load();

    setBusy(null);
  }

  // --------------------------------------------------
  // OPEN PAYMENT MODAL
  // --------------------------------------------------

  function openPayment(r: R) {
    setError('');

    setPaymentOpen(r);

    setPaymentAmount(
      String(Number(r.deposit || 0))
    );

    setPaymentMethod(
      r.payment_method || ''
    );

    setPaymentRef(
      r.payment_ref || ''
    );

    setPaymentProof(
      r.payment_proof_url || ''
    );
  }

  // --------------------------------------------------
  // GCash QR
  // --------------------------------------------------

  async function upload(e: any) {
    const file = e.target.files?.[0];

    if (!file) return;

    setBusy('qr');
    setError('');

    const extension =
      file.name.split('.').pop() || 'png';

    const path =
      `gcash/qr-${Date.now()}.${extension}`;

    const {
      error,
    } = await s.storage
      .from('payment-proofs')
      .upload(
        path,
        file,
        {
          upsert: true,
        }
      );

    if (error) {
      setError(error.message);
      setBusy(null);
      return;
    }

    const {
      data,
    } = s.storage
      .from('payment-proofs')
      .getPublicUrl(path);

    const {
      error: se,
    } = await s
      .from('settings')
      .upsert({
        key: 'gcash_qr_url',
        value: data.publicUrl,
      });

    if (se) {
      setError(se.message);
    } else {
      setQr(data.publicUrl);

      setToast(
        'GCash QR updated successfully.'
      );
    }

    setBusy(null);
  }

  // --------------------------------------------------
  // COUNTS
  // --------------------------------------------------

  const counts = {
    pending: rows.filter(
      r => r.status === 'Pending'
    ).length,

    confirmed: rows.filter(
      r => r.status === 'Confirmed'
    ).length,

    occupied: rows.filter(
      r => r.status === 'Checked-in'
    ).length,

    arrivals: rows.filter(
      r =>
        r.check_in === today() &&
        ['Confirmed', 'Pending'].includes(r.status)
    ).length,
  };

  const filtered =
    filter === 'All'
      ? rows
      : rows.filter(
          r => r.status === filter
        );

  // --------------------------------------------------
  // CALENDAR
  // --------------------------------------------------

  const monthDates = useMemo(() => {
    const [y, m] =
      month.split('-').map(Number);

    const days =
      new Date(y, m, 0).getDate();

    const first =
      new Date(y, m - 1, 1).getDay();

    return {
      days,
      first,
    };
  }, [month]);

  // --------------------------------------------------
  // LOGIN LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="login-shell">
        <div className="card">
          Loading staff workspace…
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // LOGIN
  // --------------------------------------------------

  if (!user) {
    return (
      <div className="login-shell">

        <div className="brandline">
          桜 Sakura Ananda Resort
        </div>

        <div className="card login-card">

          <div className="eyebrow">
            Private staff area
          </div>

          <h1>
            Welcome back.
          </h1>

          <p className="muted">
            Sign in to manage reservations,
            rooms, guest arrivals and checkout.
          </p>

          <form
            className="form"
            onSubmit={login}
          >

            <div className="field">

              <label>
                Staff email
              </label>

              <input
                type="email"
                required
                value={email}
                onChange={e =>
                  setEmail(e.target.value)
                }
                placeholder="staff@sakuraanandaresort.com"
              />

            </div>

            <div className="field">

              <label>
                Password
              </label>

              <input
                type="password"
                required
                value={password}
                onChange={e =>
                  setPassword(e.target.value)
                }
              />

            </div>

            {error && (
              <div className="notice error">
                {error}
              </div>
            )}

            <button className="btn">
              Sign in to dashboard
            </button>

          </form>

        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // DASHBOARD
  // --------------------------------------------------

  return (
    <div className="dashboard">

      {/* TOP */}

      <div className="dash-top">

        <div>

          <div className="eyebrow">
            Sakura Ananda • Staff
          </div>

          <h1>
            Good evening.
          </h1>

          <div className="muted">
            A calm front desk, at a glance.
          </div>

        </div>

        <button
          className="btn secondary"
          onClick={() =>
            s.auth.signOut()
          }
        >
          Sign out
        </button>

      </div>

      {/* NOTICES */}

      {toast && (
        <div
          className="notice success"
          style={{
            marginBottom: 16,
          }}
        >
          {toast}
        </div>
      )}

      {error && (
        <div
          className="notice error"
          style={{
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* STATS */}

      <div className="stats">

        <div className="card stat">
          <span>
            Pending requests
          </span>

          <b>
            {counts.pending}
          </b>
        </div>

        <div className="card stat">
          <span>
            Confirmed stays
          </span>

          <b>
            {counts.confirmed}
          </b>
        </div>

        <div className="card stat">
          <span>
            Occupied now
          </span>

          <b>
            {counts.occupied}
          </b>
        </div>

        <div className="card stat">
          <span>
            Arrivals today
          </span>

          <b>
            {counts.arrivals}
          </b>
        </div>

      </div>

      {/* ROOMS */}

      <div className="section-title">

        <div>
          <div className="eyebrow">
            Rooms
          </div>

          <h2>
            Occupancy
          </h2>
        </div>

      </div>

      <div className="occupancy-grid">

        {rooms.map(room => {

          const active =
            rows.find(
              r =>
                r.room_id === room.id &&
                r.status === 'Checked-in'
            );

          const upcoming =
            rows.find(
              r =>
                r.room_id === room.id &&
                r.status === 'Confirmed' &&
                r.check_in >= today()
            );

          return (
            <div
              className="card room-status"
              key={room.id}
            >

              <span
                className={`pill ${
                  active
                    ? 'danger'
                    : 'success'
                }`}
              >
                {active
                  ? 'Occupied'
                  : 'Available'}
              </span>

              <h3>
                {room.name}
              </h3>

              <div className="muted">
                ₱
                {Number(
                  room.rate || 0
                ).toLocaleString(
                  'en-PH'
                )}
                {' '} / night
              </div>

              {active ? (
                <p style={{fontSize:12}}>
                  Guest:{' '}
                  <b>
                    {active.guest_name}
                  </b>

                  <br />

                  Until{' '}
                  {active.check_out}
                </p>
              ) : upcoming ? (
                <p style={{fontSize:12}}>
                  Next arrival:{' '}
                  <b>
                    {upcoming.check_in}
                  </b>

                  <br />

                  {upcoming.guest_name}
                </p>
              ) : (
                <p style={{fontSize:12}}>
                  Ready for a new stay.
                </p>
              )}

            </div>
          );
        })}

      </div>

      {/* CALENDAR */}

      <div
        className="section-title"
        style={{
          marginTop: 42,
        }}
      >

        <div>

          <div className="eyebrow">
            Planning
          </div>

          <h2>
            Availability calendar
          </h2>

        </div>

        <input
          type="month"
          value={month}
          onChange={e =>
            setMonth(e.target.value)
          }
        />

      </div>

      <div className="card calendar-wrap">

        <div className="calendar">

          {[
            'Sun',
            'Mon',
            'Tue',
            'Wed',
            'Thu',
            'Fri',
            'Sat',
          ].map(x => (
            <div
              className="calendar-head"
              key={x}
            >
              {x}
            </div>
          ))}

          {Array.from(
            {
              length:
                monthDates.first +
                monthDates.days,
            },
            (_, i) => {

              if (
                i < monthDates.first
              ) {
                return (
                  <div
                    className="day blank"
                    key={i}
                  />
                );
              }

              const d =
                i -
                monthDates.first +
                1;

              const ds =
                `${month}-${String(d).padStart(
                  2,
                  '0'
                )}`;

              return (
                <div
                  className="day"
                  key={ds}
                >

                  <div className="day-num">
                    {d}
                  </div>

                  {rooms.map(room => {

                    const b =
                      rows.some(
                        r =>
                          r.room_id === room.id &&
                          [
                            'Pending',
                            'Confirmed',
                            'Checked-in',
                          ].includes(
                            r.status
                          ) &&
                          r.check_in <= ds &&
                          r.check_out > ds
                      );

                    return (
                      <div
                        className="room-dot"
                        key={room.id}
                      >
                        <i
                          className={
                            b
                              ? 'booked'
                              : ''
                          }
                        />

                        <span>
                          {room.name.replace(
                            'Room ',
                            'R'
                          )}
                        </span>
                      </div>
                    );
                  })}

                </div>
              );
            }
          )}

        </div>

      </div>

      {/* GCASH QR */}

      <div
        className="section-title"
        style={{
          marginTop: 42,
        }}
      >

        <div>

          <div className="eyebrow">
            Guest communication
          </div>

          <h2>
            GCash QR
          </h2>

        </div>

      </div>

      <div className="card">

        <div className="settings-card">

          <div>

            <p className="muted">
              Upload the current GCash QR.
              Guests see it on the reservation
              page.
            </p>

            <input
              type="file"
              accept="image/*"
              onChange={upload}
              disabled={busy === 'qr'}
            />

            {qr && (
              <div
                style={{
                  marginTop: 16,
                }}
              >
                <img
                  className="qr"
                  src={qr}
                  alt="Current GCash QR"
                />
              </div>
            )}

          </div>

          <div className="notice">

            <b>
              Email notifications
            </b>

            <p>
              Reservation and payment emails
              are sent automatically by Google
              Sheets + Apps Script.
            </p>

          </div>

        </div>

      </div>

      {/* RESERVATIONS */}

      <div
        className="section-title"
        style={{
          marginTop: 42,
        }}
      >

        <div>

          <div className="eyebrow">
            Front desk
          </div>

          <h2>
            Reservations
          </h2>

        </div>

        <select
          value={filter}
          onChange={e =>
            setFilter(e.target.value)
          }
        >
          <option>All</option>
          <option>Pending</option>
          <option>Confirmed</option>
          <option>Checked-in</option>
          <option>Checked-out</option>
          <option>Cancelled</option>
        </select>

      </div>

      <div className="table-wrap">

        <table className="table">

          <thead>

            <tr>

              <th>
                Booking
              </th>

              <th>
                Guest
              </th>

              <th>
                Stay
              </th>

              <th>
                Room
              </th>

              <th>
                Payment
              </th>

              <th>
                Status
              </th>

              <th>
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            {filtered.map(r => (

              <tr key={r.id}>

                <td>

                  <b>
                    {r.booking_id}
                  </b>

                  <br />

                  <span className="muted">
                    {new Date(
                      r.created_at
                    ).toLocaleDateString(
                      'en-PH'
                    )}
                  </span>

                </td>

                <td>

                  <b>
                    {r.guest_name}
                  </b>

                  <br />

                  <span className="muted">
                    {r.mobile}
                  </span>

                  <br />

                  <span className="muted">
                    {r.email ||
                      'No email'}
                  </span>

                </td>

                <td>

                  {r.check_in}

                  <br />

                  →

                  {' '}

                  {r.check_out}

                  <br />

                  <span className="muted">

                    {r.guests}{' '}
                    guest
                    {r.guests !== 1
                      ? 's'
                      : ''}

                  </span>

                </td>

                <td>

                  <b>
                    {r.room?.name ||
                      'Room'}
                  </b>

                  <br />

                  <span className="muted">

                    ₱
                    {Number(
                      r.rate_per_night ||
                        0
                    ).toLocaleString(
                      'en-PH'
                    )}

                    /night

                  </span>

                </td>

                {/* PAYMENT */}

                <td>

                  <b>
                    ₱
                    {Number(
                      r.room_total || 0
                    ).toLocaleString(
                      'en-PH'
                    )}
                  </b>

                  <br />

                  Paid:{' '}

                  ₱
                  {Number(
                    r.deposit || 0
                  ).toLocaleString(
                    'en-PH'
                  )}

                  <br />

                  Balance:{' '}

                  ₱
                  {Number(
                    r.balance || 0
                  ).toLocaleString(
                    'en-PH'
                  )}

                  <br />

                  <span className="muted">
                    {r.payment_method ||
                      'No payment method'}
                  </span>

                  <br />

                  {Number(
                    r.balance || 0
                  ) === 0 ? (

                    <span
                      className="pill success"
                      style={{
                        marginTop: 6,
                        display:
                          'inline-block',
                      }}
                    >
                      FULLY PAID
                    </span>

                  ) : null}

                  <br />

                  <button
                    className="btn secondary"
                    style={{
                      marginTop: 8,
                    }}
                    onClick={() =>
                      openPayment(r)
                    }
                  >
                    Update Payment
                  </button>

                </td>

                {/* STATUS */}

                <td>

                  <span
                    className={`pill ${statusClass(
                      r.status
                    )}`}
                  >
                    {r.status}
                  </span>

                </td>

                {/* ACTIONS */}

                <td>

                  <div className="actions">

                    {r.status ===
                      'Pending' && (
                      <>
                        <button
                          className="btn green"
                          disabled={
                            busy === r.id
                          }
                          onClick={() =>
                            action(
                              r.id,
                              'Confirmed'
                            )
                          }
                        >
                          Confirm
                        </button>

                        <button
                          className="btn red"
                          disabled={
                            busy === r.id
                          }
                          onClick={() =>
                            action(
                              r.id,
                              'Cancelled'
                            )
                          }
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {r.status ===
                      'Confirmed' && (
                      <button
                        className="btn red"
                        disabled={
                          busy === r.id
                        }
                        onClick={() =>
                          action(
                            r.id,
                            'Cancelled'
                          )
                        }
                      >
                        Cancel
                      </button>
                    )}

                    {r.status ===
                      'Checked-in' && (
                      <button
                        className="btn secondary"
                        disabled={
                          busy === r.id
                        }
                        onClick={() =>
                          action(
                            r.id,
                            'Checked-out'
                          )
                        }
                      >
                        Checkout
                      </button>
                    )}

                  </div>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* PAYMENT MODAL */}

      {paymentOpen && (

        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(0,0,0,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >

          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#fff',
              padding: 28,
              borderRadius: 20,
            }}
          >

            <div className="eyebrow">
              Payment Update
            </div>

            <h2
              style={{
                marginTop: 6,
              }}
            >
              {paymentOpen.booking_id}
            </h2>

            <p className="muted">

              {paymentOpen.guest_name}

              <br />

              <b>
                {paymentOpen.room?.name ||
                  'Room'}
              </b>

            </p>

            <div
              className="notice"
              style={{
                marginBottom: 18,
              }}
            >

              <b>
                Room Total:
              </b>{' '}

              ₱
              {Number(
                paymentOpen.room_total || 0
              ).toLocaleString(
                'en-PH'
              )}

              <br />

              <b>
                Current Paid:
              </b>{' '}

              ₱
              {Number(
                paymentOpen.deposit || 0
              ).toLocaleString(
                'en-PH'
              )}

              <br />

              <b>
                Current Balance:
              </b>{' '}

              ₱
              {Number(
                paymentOpen.balance || 0
              ).toLocaleString(
                'en-PH'
              )}

            </div>

            <div className="form">

              <div className="field">

                <label>
                  Total Amount Paid
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={e =>
                    setPaymentAmount(
                      e.target.value
                    )
                  }
                  placeholder="0"
                />

                <small className="muted">
                  Enter the TOTAL amount paid
                  so far, not just the new
                  payment.
                </small>

              </div>

              <div className="field">

                <label>
                  Payment Method
                </label>

                <select
                  value={paymentMethod}
                  onChange={e =>
                    setPaymentMethod(
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Select payment method
                  </option>

                  <option value="Cash">
                    Cash
                  </option>

                  <option value="GCash">
                    GCash
                  </option>

                  <option value="Bank Transfer">
                    Bank Transfer
                  </option>

                  <option value="Maya">
                    Maya
                  </option>

                  <option value="Other">
                    Other
                  </option>

                </select>

              </div>

              <div className="field">

                <label>
                  Payment Reference
                </label>

                <input
                  type="text"
                  value={paymentRef}
                  onChange={e =>
                    setPaymentRef(
                      e.target.value
                    )
                  }
                  placeholder="e.g. GCash reference number"
                />

              </div>

              <div className="field">

                <label>
                  Payment Proof URL
                </label>

                <input
                  type="url"
                  value={paymentProof}
                  onChange={e =>
                    setPaymentProof(
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                />

              </div>

              {paymentAmount !== '' && (

                <div
                  className="notice success"
                  style={{
                    marginTop: 8,
                  }}
                >

                  <b>
                    Remaining Balance:
                  </b>{' '}

                  ₱
                  {Math.max(
                    Number(
                      paymentOpen.room_total ||
                        0
                    ) -
                      Number(
                        paymentAmount || 0
                      ),
                    0
                  ).toLocaleString(
                    'en-PH'
                  )}

                </div>

              )}

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 20,
                }}
              >

                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    setPaymentOpen(null);
                    setError('');
                  }}
                  disabled={
                    busy === paymentOpen.id
                  }
                >
                  Cancel
                </button>

                <button
                  className="btn green"
                  type="button"
                  onClick={() =>
                    updatePayment(
                      paymentOpen
                    )
                  }
                  disabled={
                    busy === paymentOpen.id
                  }
                >
                  {busy === paymentOpen.id
                    ? 'Updating…'
                    : 'Update Payment'}
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}