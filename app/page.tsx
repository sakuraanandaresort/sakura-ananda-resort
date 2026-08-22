'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import type { Reservation, Room } from '../../lib/types';

type R = Reservation & {
  room?: Room;
  payment_status?: string;
  paid_at?: string | null;
  payment_updated_at?: string | null;
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

  /*
   * AUTH
   */
  useEffect(() => {
    s.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: sub,
    } = s.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  /*
   * LOGIN
   */
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

  /*
   * LOAD DATA
   *
   * IMPORTANT:
   * room:rooms(*) gets the actual room name from the rooms table.
   *
   * This prevents:
   *
   * 1d48f0f4-50cf-4d0c-ad31-738b0ebff2b0
   *
   * from appearing as the room name.
   *
   * Instead it displays:
   *
   * Room 1
   */
  async function load() {
    setError('');

    const [reservationsResult, roomsResult, settingsResult] =
      await Promise.all([
        s
          .from('reservations')
          .select('*, room:rooms(*)')
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

    if (reservationsResult.error) {
      setError(reservationsResult.error.message);
    }

    if (roomsResult.error) {
      setError(roomsResult.error.message);
    }

    setRows((reservationsResult.data || []) as R[]);
    setRooms((roomsResult.data || []) as Room[]);
    setQr(settingsResult.data?.value || '');
  }

  useEffect(() => {
    if (user) {
      load();
    }
  }, [user]);

  /*
   * STATUS UPDATE
   */
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
        'Status updated. Google Sheets and customer email will update automatically.'
      );
    } else {
      setToast('Status updated.');
    }

    await load();

    setBusy(null);
  }

  /*
   * ==========================================
   * MARK PAYMENT AS PAID
   * ==========================================
   *
   * This is the new payment function.
   *
   * It updates:
   *
   * payment_status = Paid
   * paid_at = current time
   * payment_updated_at = current time
   *
   * Your Supabase UPDATE webhook will then send
   * the updated reservation to Google Apps Script.
   */
  async function markPaymentPaid(id: string) {
    setBusy(`payment-${id}`);
    setError('');
    setToast('');

    const now = new Date().toISOString();

    const { error } = await s
      .from('reservations')
      .update({
        payment_status: 'Paid',
        paid_at: now,
        payment_updated_at: now,
      })
      .eq('id', id);

    if (error) {
      setError(error.message);
      setBusy(null);
      return;
    }

    /*
     * Update the screen immediately.
     *
     * This makes the button disappear without waiting
     * for another database reload.
     */
    setRows((current) =>
      current.map((r) =>
        r.id === id
          ? {
              ...r,
              payment_status: 'Paid',
              paid_at: now,
              payment_updated_at: now,
            }
          : r
      )
    );

    setToast(
      'Payment marked as PAID. Google Sheets and payment email will update automatically.'
    );

    /*
     * Reload from Supabase so the screen is guaranteed
     * to contain the database value.
     */
    await load();

    setBusy(null);
  }

  /*
   * MARK PAYMENT UNPAID
   *
   * Optional safety feature.
   *
   * This allows staff to undo a payment accidentally
   * marked as paid.
   */
  async function markPaymentUnpaid(id: string) {
    setBusy(`payment-${id}`);
    setError('');
    setToast('');

    const { error } = await s
      .from('reservations')
      .update({
        payment_status: 'Unpaid',
        paid_at: null,
        payment_updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      setError(error.message);
      setBusy(null);
      return;
    }

    setToast('Payment changed back to UNPAID.');

    await load();

    setBusy(null);
  }

  /*
   * GCash QR UPLOAD
   */
  async function upload(e: any) {
    const file = e.target.files?.[0];

    if (!file) return;

    setBusy('qr');
    setError('');

    const extension =
      file.name.split('.').pop() || 'png';

    const path =
      `gcash/qr-${Date.now()}.${extension}`;

    const { error } = await s.storage
      .from('payment-proofs')
      .upload(path, file, {
        upsert: true,
      });

    if (error) {
      setError(error.message);
      setBusy(null);
      return;
    }

    const { data } = s.storage
      .from('payment-proofs')
      .getPublicUrl(path);

    const { error: settingsError } =
      await s
        .from('settings')
        .upsert({
          key: 'gcash_qr_url',
          value: data.publicUrl,
        });

    if (settingsError) {
      setError(settingsError.message);
    } else {
      setQr(data.publicUrl);
      setToast('GCash QR updated.');
    }

    setBusy(null);
  }

  /*
   * STATS
   */
  const counts = {
    pending: rows.filter(
      (r) => r.status === 'Pending'
    ).length,

    confirmed: rows.filter(
      (r) => r.status === 'Confirmed'
    ).length,

    occupied: rows.filter(
      (r) => r.status === 'Checked-in'
    ).length,

    arrivals: rows.filter(
      (r) =>
        r.check_in === today() &&
        ['Confirmed', 'Pending'].includes(r.status)
    ).length,

    paid: rows.filter(
      (r) =>
        String(r.payment_status || '').toLowerCase() ===
        'paid'
    ).length,

    unpaid: rows.filter(
      (r) =>
        String(r.payment_status || '').toLowerCase() !==
        'paid'
    ).length,
  };

  /*
   * FILTER
   */
  const filtered =
    filter === 'All'
      ? rows
      : rows.filter((r) => r.status === filter);

  /*
   * CALENDAR
   */
  const monthDates = useMemo(() => {
    const [y, m] = month.split('-').map(Number);

    const days =
      new Date(y, m, 0).getDate();

    const first =
      new Date(y, m - 1, 1).getDay();

    return {
      days,
      first,
    };
  }, [month]);

  /*
   * LOADING
   */
  if (loading) {
    return (
      <div className="login-shell">
        <div className="card">
          Loading staff workspace…
        </div>
      </div>
    );
  }

  /*
   * LOGIN
   */
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
                onChange={(e) =>
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
                onChange={(e) =>
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

  /*
   * DASHBOARD
   */
  return (
    <div className="dashboard">

      {/* ============================= */}
      {/* TOP */}
      {/* ============================= */}

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

      {/* ============================= */}
      {/* NOTICES */}
      {/* ============================= */}

      {toast && (
        <div
          className="notice success"
          style={{ marginBottom: 16 }}
        >
          {toast}
        </div>
      )}

      {error && (
        <div
          className="notice error"
          style={{ marginBottom: 16 }}
        >
          {error}
        </div>
      )}

      {/* ============================= */}
      {/* STATS */}
      {/* ============================= */}

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

        <div className="card stat">
          <span>
            Paid
          </span>
          <b>
            {counts.paid}
          </b>
        </div>

        <div className="card stat">
          <span>
            Unpaid
          </span>
          <b>
            {counts.unpaid}
          </b>
        </div>

      </div>

      {/* ============================= */}
      {/* ROOMS */}
      {/* ============================= */}

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

        {rooms.map((room) => {

          const active =
            rows.find(
              (r) =>
                r.room_id === room.id &&
                r.status === 'Checked-in'
            );

          const upcoming =
            rows.find(
              (r) =>
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
                {Number(room.rate).toLocaleString()}
                {' '} / night
              </div>

              {active ? (
                <p style={{ fontSize: 12 }}>
                  Guest:{' '}
                  <b>
                    {active.guest_name}
                  </b>
                  <br />
                  Until {active.check_out}
                </p>
              ) : upcoming ? (
                <p style={{ fontSize: 12 }}>
                  Next arrival:{' '}
                  <b>
                    {upcoming.check_in}
                  </b>
                  <br />
                  {upcoming.guest_name}
                </p>
              ) : (
                <p style={{ fontSize: 12 }}>
                  Ready for a new stay.
                </p>
              )}

            </div>
          );
        })}

      </div>

      {/* ============================= */}
      {/* CALENDAR */}
      {/* ============================= */}

      <div
        className="section-title"
        style={{ marginTop: 42 }}
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
          onChange={(e) =>
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
          ].map((x) => (
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

                  {rooms.map((room) => {

                    const booked =
                      rows.some(
                        (r) =>
                          r.room_id ===
                            room.id &&
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
                            booked
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

      {/* ============================= */}
      {/* GCASH */}
      {/* ============================= */}

      <div
        className="section-title"
        style={{ marginTop: 42 }}
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
              Guests see it on the reservation page.
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
              Email & SMS notifications
            </b>

            <p>
              Reservation emails are sent
              automatically by Google Sheets +
              Apps Script using your Google account.
            </p>

          </div>

        </div>

      </div>

      {/* ============================= */}
      {/* RESERVATIONS */}
      {/* ============================= */}

      <div
        className="section-title"
        style={{ marginTop: 42 }}
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
          onChange={(e) =>
            setFilter(e.target.value)
          }
        >

          <option>
            All
          </option>

          <option>
            Pending
          </option>

          <option>
            Confirmed
          </option>

          <option>
            Checked-in
          </option>

          <option>
            Checked-out
          </option>

          <option>
            Cancelled
          </option>

        </select>

      </div>

      {/* ============================= */}
      {/* RESERVATION TABLE */}
      {/* ============================= */}

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

            {filtered.map((r) => {

              const isPaid =
                String(
                  r.payment_status || ''
                ).toLowerCase() ===
                'paid';

              const paymentBusy =
                busy ===
                `payment-${r.id}`;

              return (

                <tr key={r.id}>

                  {/* BOOKING */}

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

                  {/* GUEST */}

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

                  {/* STAY */}

                  <td>

                    {r.check_in}

                    <br />

                    →

                    {' '}

                    {r.check_out}

                    <br />

                    <span className="muted">

                      {r.guests}

                      {' '}

                      guest

                      {r.guests !== 1
                        ? 's'
                        : ''}

                    </span>

                  </td>

                  {/* ROOM */}

                  <td>

                    <b>
                      {r.room?.name ||
                        'Room unavailable'}
                    </b>

                    <br />

                    <span className="muted">
                      ₱
                      {Number(
                        r.rate_per_night
                      ).toLocaleString()}
                      /night
                    </span>

                  </td>

                  {/* ===================== */}
                  {/* PAYMENT */}
                  {/* ===================== */}

                  <td>

                    <b>
                      ₱
                      {Number(
                        r.room_total
                      ).toLocaleString()}
                    </b>

                    <br />

                    Deposit ₱
                    {Number(
                      r.deposit
                    ).toLocaleString()}

                    <br />

                    Balance ₱
                    {Number(
                      r.balance
                    ).toLocaleString()}

                    <br />

                    <span className="muted">
                      {r.payment_method ||
                        'Not specified'}
                    </span>

                    <div
                      style={{
                        marginTop: 8,
                      }}
                    >

                      {isPaid ? (

                        /*
                         * =================================
                         * PAID
                         * =================================
                         *
                         * MARK AS PAID BUTTON IS COMPLETELY
                         * HIDDEN WHEN PAYMENT IS ALREADY PAID.
                         */

                        <div>

                          <span
                            className="pill success"
                          >
                            ✓ PAID
                          </span>

                          {r.paid_at && (
                            <div
                              className="muted"
                              style={{
                                fontSize: 11,
                                marginTop: 5,
                              }}
                            >
                              Paid{' '}
                              {new Date(
                                r.paid_at
                              ).toLocaleString(
                                'en-PH'
                              )}
                            </div>
                          )}

                          {/*
                           * OPTIONAL UNDO BUTTON
                           *
                           * Remove this section if you don't
                           * want staff to reverse a payment.
                           */}

                          <button
                            className="btn secondary"
                            style={{
                              marginTop: 7,
                              fontSize: 11,
                              padding:
                                '5px 8px',
                            }}
                            disabled={
                              paymentBusy
                            }
                            onClick={() =>
                              markPaymentUnpaid(
                                r.id
                              )
                            }
                          >
                            Undo Paid
                          </button>

                        </div>

                      ) : (

                        /*
                         * =================================
                         * UNPAID
                         * =================================
                         */

                        <button
                          className="btn green"
                          disabled={
                            paymentBusy
                          }
                          onClick={() =>
                            markPaymentPaid(
                              r.id
                            )
                          }
                        >
                          {paymentBusy
                            ? 'Updating...'
                            : 'Mark as Paid'}
                        </button>

                      )}

                    </div>

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

              );
            })}

          </tbody>

        </table>

      </div>

    </div>
  );
}