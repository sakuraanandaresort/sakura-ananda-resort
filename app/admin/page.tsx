'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import type { Reservation, Room } from '../../lib/types';

type R = Reservation & {
  room?: Room;
};

type EditForm = {
  guest_name: string;
  mobile: string;
  email: string;
  check_in: string;
  check_out: string;
  guests: number;
  room_id: string;
  rate_per_night: number;
  room_total: number;
  deposit: number;
  balance: number;
  payment_method: string;
  payment_ref: string;
  special_requests: string;
  status: string;
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

const today = () =>
  new Date().toISOString().slice(0, 10);

/*
 * ============================================================
 * PAYMENT HELPERS
 * ============================================================
 */

function isReservationPaid(r: R) {
  const total = Number(r.room_total || 0);
  const deposit = Number(r.deposit || 0);
  const balance = Number(r.balance || 0);

  return (
    total > 0 &&
    deposit >= total &&
    balance <= 0
  );
}

function paymentStatus(r: R) {
  const total = Number(r.room_total || 0);
  const deposit = Number(r.deposit || 0);
  const balance = Number(r.balance || 0);

  if (total <= 0) {
    return 'Unknown';
  }

  if (
    deposit >= total &&
    balance <= 0
  ) {
    return 'Paid';
  }

  if (
    deposit > 0 &&
    balance > 0
  ) {
    return 'Partially Paid';
  }

  return 'Unpaid';
}

/*
 * ============================================================
 * ADMIN
 * ============================================================
 */

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

  const [busy, setBusy] =
    useState<string | null>(null);

  /*
   * ============================================================
   * EDIT MODAL
   * ============================================================
   */

  const [editingReservation, setEditingReservation] =
    useState<R | null>(null);

  const [editForm, setEditForm] =
    useState<EditForm>({
      guest_name: '',
      mobile: '',
      email: '',
      check_in: '',
      check_out: '',
      guests: 1,
      room_id: '',
      rate_per_night: 0,
      room_total: 0,
      deposit: 0,
      balance: 0,
      payment_method: 'GCash',
      payment_ref: '',
      special_requests: '',
      status: 'Pending',
    });

  /*
   * ============================================================
   * AUTH
   * ============================================================
   */

  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      const { data, error } =
        await s.auth.getUser();

      if (!mounted) return;

      if (error) {
        setUser(null);
      } else {
        setUser(data.user || null);
      }

      setLoading(false);
    }

    checkUser();

    const {
      data: sub,
    } =
      s.auth.onAuthStateChange(
        (_event, session) => {
          setUser(
            session?.user || null
          );
        }
      );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [s]);

  /*
   * ============================================================
   * LOGIN
   * ============================================================
   */

  async function login(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError('');
    setToast('');

    const { error } =
      await s.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (error) {
      setError(error.message);
    }
  }

  /*
   * ============================================================
   * LOAD DATA
   * ============================================================
   */

  async function load() {
    setError('');

    const [
      reservationsResult,
      roomsResult,
      settingsResult,
    ] = await Promise.all([
      s
        .from('reservations')
        .select(
          '*, room:rooms(*)'
        )
        .order(
          'check_in',
          {
            ascending: true,
          }
        ),

      s
        .from('rooms')
        .select('*')
        .order('name'),

      s
        .from('settings')
        .select('value')
        .eq(
          'key',
          'gcash_qr_url'
        )
        .maybeSingle(),
    ]);

    if (
      reservationsResult.error
    ) {
      setError(
        reservationsResult.error.message
      );
      return;
    }

    if (
      roomsResult.error
    ) {
      setError(
        roomsResult.error.message
      );
      return;
    }

    setRows(
      (reservationsResult.data ||
        []) as R[]
    );

    setRooms(
      (roomsResult.data ||
        []) as Room[]
    );

    setQr(
      settingsResult.data?.value ||
        ''
    );
  }

  useEffect(() => {
    if (user) {
      load();
    }
  }, [user]);

  /*
   * ============================================================
   * OPEN EDIT
   * ============================================================
   */

  function openEdit(r: R) {
    setError('');
    setToast('');

    setEditingReservation(r);

    setEditForm({
      guest_name:
        r.guest_name || '',

      mobile:
        r.mobile || '',

      email:
        r.email || '',

      check_in:
        r.check_in || '',

      check_out:
        r.check_out || '',

      guests:
        Number(r.guests || 1),

      room_id:
        r.room_id || '',

      rate_per_night:
        Number(
          r.rate_per_night || 0
        ),

      room_total:
        Number(
          r.room_total || 0
        ),

      deposit:
        Number(
          r.deposit || 0
        ),

      balance:
        Number(
          r.balance || 0
        ),

      payment_method:
        r.payment_method ||
        'GCash',

      payment_ref:
        r.payment_ref || '',

      special_requests:
        r.special_requests || '',

      status:
        r.status || 'Pending',
    });
  }

  /*
   * ============================================================
   * CLOSE EDIT
   * ============================================================
   */

  function closeEdit() {
    if (busy === 'edit') return;

    setEditingReservation(null);
  }

  /*
   * ============================================================
   * CHANGE EDIT FIELD
   * ============================================================
   */

  function updateEditField(
    field: keyof EditForm,
    value: string | number
  ) {
    setEditForm(
      current => ({
        ...current,
        [field]: value,
      })
    );
  }

  /*
   * ============================================================
   * ROOM CHANGE
   * ============================================================
   */

  function handleRoomChange(
    roomId: string
  ) {
    const selectedRoom =
      rooms.find(
        room =>
          room.id === roomId
      );

    setEditForm(
      current => ({
        ...current,

        room_id:
          roomId,

        rate_per_night:
          selectedRoom
            ? Number(
                selectedRoom.rate || 0
              )
            : current.rate_per_night,
      })
    );
  }

  /*
   * ============================================================
   * CALCULATE TOTAL
   * ============================================================
   */

  function calculateEditTotal() {
    const checkIn =
      editForm.check_in;

    const checkOut =
      editForm.check_out;

    const rate =
      Number(
        editForm.rate_per_night || 0
      );

    if (
      !checkIn ||
      !checkOut ||
      rate <= 0
    ) {
      return 0;
    }

    const start =
      new Date(
        `${checkIn}T00:00:00`
      );

    const end =
      new Date(
        `${checkOut}T00:00:00`
      );

    const diff =
      end.getTime() -
      start.getTime();

    const nights =
      Math.max(
        0,
        Math.ceil(
          diff /
            (1000 *
              60 *
              60 *
              24)
        )
      );

    return nights * rate;
  }

  /*
   * ============================================================
   * GOOGLE SHEETS SYNC
   * ============================================================
   */

  async function syncToGoogleSheets(
    reservation: R
  ) {
    const webhook =
      process.env
        .NEXT_PUBLIC_GOOGLE_SHEETS_WEBHOOK_URL;

    if (!webhook) {
      throw new Error(
        'Google Sheets webhook URL is not configured.'
      );
    }

    const room =
      rooms.find(
        r =>
          r.id ===
          reservation.room_id
      );

    const payload = {
      action:
        'update_reservation',

      id:
        reservation.id,

      booking_id:
        reservation.booking_id,

      guest_name:
        reservation.guest_name || '',

      mobile:
        reservation.mobile || '',

      email:
        reservation.email || '',

      check_in:
        reservation.check_in || '',

      check_out:
        reservation.check_out || '',

      guests:
        Number(
          reservation.guests || 1
        ),

      room_id:
        reservation.room_id || '',

      room_name:
        reservation.room?.name ||
        room?.name ||
        '',

      rate_per_night:
        Number(
          reservation.rate_per_night ||
            0
        ),

      room_total:
        Number(
          reservation.room_total ||
            0
        ),

      deposit:
        Number(
          reservation.deposit || 0
        ),

      balance:
        Number(
          reservation.balance || 0
        ),

      payment_method:
        reservation.payment_method ||
        '',

      payment_ref:
        reservation.payment_ref ||
        '',

      special_requests:
        reservation.special_requests ||
        '',

      status:
        reservation.status || '',

      checked_out_at:
        reservation.checked_out_at ||
        '',

      created_at:
        reservation.created_at ||
        '',
    };

    const response =
      await fetch(
        webhook,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'text/plain;charset=utf-8',
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );

    const text =
      await response.text();

    let result: any = null;

    try {
      result =
        JSON.parse(text);
    } catch {
      result = {
        success:
          response.ok,
        message:
          text,
      };
    }

    if (
      !response.ok
    ) {
      throw new Error(
        `Google Sheets returned HTTP ${response.status}.`
      );
    }

    if (
      result &&
      result.success === false
    ) {
      throw new Error(
        result.message ||
          'Google Sheets rejected the update.'
      );
    }

    return result;
  }

  /*
   * ============================================================
   * UPDATE RESERVATION
   * ============================================================
   */

  async function updateReservation(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!editingReservation) {
      return;
    }

    setBusy('edit');
    setError('');
    setToast('');

    /*
     * VALIDATION
     */

    if (
      !editForm.guest_name.trim()
    ) {
      setError(
        'Guest name is required.'
      );

      setBusy(null);
      return;
    }

    if (
      !editForm.mobile.trim()
    ) {
      setError(
        'Mobile number is required.'
      );

      setBusy(null);
      return;
    }

    if (
      !editForm.check_in ||
      !editForm.check_out
    ) {
      setError(
        'Check-in and check-out dates are required.'
      );

      setBusy(null);
      return;
    }

    if (
      editForm.check_out <=
      editForm.check_in
    ) {
      setError(
        'Check-out must be after check-in.'
      );

      setBusy(null);
      return;
    }

    if (
      !editForm.room_id
    ) {
      setError(
        'Please select a room.'
      );

      setBusy(null);
      return;
    }

    /*
     * CALCULATE
     */

    const calculatedTotal =
      calculateEditTotal();

    const deposit =
      Number(
        editForm.deposit || 0
      );

    const balance =
      Math.max(
        0,
        calculatedTotal -
          deposit
      );

    /*
     * SUPABASE UPDATE
     */

    const updateData: any = {
      guest_name:
        editForm.guest_name.trim(),

      mobile:
        editForm.mobile.trim(),

      email:
        editForm.email.trim() ||
        null,

      check_in:
        editForm.check_in,

      check_out:
        editForm.check_out,

      guests:
        Number(
          editForm.guests || 1
        ),

      room_id:
        editForm.room_id,

      rate_per_night:
        Number(
          editForm.rate_per_night || 0
        ),

      room_total:
        calculatedTotal,

      deposit:
        deposit,

      balance:
        balance,

      payment_method:
        editForm.payment_method ||
        null,

      payment_ref:
        editForm.payment_ref.trim() ||
        null,

      special_requests:
        editForm.special_requests.trim() ||
        null,

      status:
        editForm.status,
    };

    if (
      editForm.status ===
      'Checked-out'
    ) {
      updateData.checked_out_at =
        new Date().toISOString();
    }

    const {
      data,
      error,
    } = await s
      .from('reservations')
      .update(updateData)
      .eq(
        'id',
        editingReservation.id
      )
      .select(
        '*, room:rooms(*)'
      )
      .single();

    if (error) {
      setError(
        `Unable to update reservation: ${error.message}`
      );

      setBusy(null);
      return;
    }

    if (!data) {
      setError(
        'No updated reservation was returned.'
      );

      setBusy(null);
      return;
    }

    const updatedReservation =
      data as R;

    /*
     * UPDATE LOCAL SCREEN FIRST
     */

    setRows(
      current =>
        current.map(
          r =>
            r.id ===
            editingReservation.id
              ? updatedReservation
              : r
        )
    );

    /*
     * GOOGLE SHEETS
     */

    try {
      await syncToGoogleSheets(
        updatedReservation
      );
    } catch (sheetError: any) {
      /*
       * Supabase succeeded but
       * Google Sheets failed.
       */

      setError(
        `Reservation saved in Supabase, but Google Sheets was not updated: ${
          sheetError?.message ||
          'Unknown Google Sheets error.'
        }`
      );

      setBusy(null);
      return;
    }

    /*
     * CLOSE MODAL
     */

    setEditingReservation(null);

    /*
     * RELOAD SUPABASE
     */

    await load();

    setToast(
      `Reservation ${
        updatedReservation.booking_id
      } updated successfully. Google Sheets synchronized.`
    );

    setBusy(null);
  }

  /*
   * ============================================================
   * STATUS UPDATE
   * ============================================================
   */

  async function action(
    id: string,
    status: string
  ) {
    setBusy(id);
    setError('');
    setToast('');

    const updateData: any = {
      status,
    };

    if (
      status ===
      'Checked-out'
    ) {
      updateData.checked_out_at =
        new Date().toISOString();
    }

    const {
      data,
      error,
    } = await s
      .from('reservations')
      .update(updateData)
      .eq(
        'id',
        id
      )
      .select(
        '*, room:rooms(*)'
      )
      .single();

    if (error) {
      setError(
        error.message
      );

      setBusy(null);
      return;
    }

    /*
     * Also synchronize status
     * to Google Sheets.
     */

    try {
      await syncToGoogleSheets(
        data as R
      );
    } catch (sheetError: any) {
      setError(
        `Status updated in Supabase, but Google Sheets was not updated: ${
          sheetError?.message ||
          'Unknown error.'
        }`
      );

      await load();
      setBusy(null);
      return;
    }

    setToast(
      'Reservation status updated successfully.'
    );

    await load();

    setBusy(null);
  }

  /*
   * ============================================================
   * MARK PAYMENT PAID
   * ============================================================
   */

  async function markPaymentPaid(
    id: string
  ) {
    setBusy(
      `payment-${id}`
    );

    setError('');
    setToast('');

    const reservation =
      rows.find(
        r =>
          r.id === id
      );

    if (!reservation) {
      setError(
        'Reservation not found.'
      );

      setBusy(null);
      return;
    }

    const roomTotal =
      Number(
        reservation.room_total ||
          0
      );

    if (
      roomTotal <= 0
    ) {
      setError(
        'Room total is zero or missing.'
      );

      setBusy(null);
      return;
    }

    const {
      data,
      error,
    } = await s
      .from('reservations')
      .update({
        deposit:
          roomTotal,
        balance: 0,
      })
      .eq(
        'id',
        id
      )
      .select(
        '*, room:rooms(*)'
      )
      .single();

    if (error) {
      setError(
        error.message
      );

      setBusy(null);
      return;
    }

    try {
      await syncToGoogleSheets(
        data as R
      );
    } catch (sheetError: any) {
      setError(
        `Payment updated in Supabase, but Google Sheets was not updated: ${
          sheetError?.message ||
          'Unknown error.'
        }`
      );

      await load();
      setBusy(null);
      return;
    }

    setToast(
      `Payment marked as PAID. ₱${roomTotal.toLocaleString(
        'en-PH'
      )}`
    );

    await load();

    setBusy(null);
  }

  /*
   * ============================================================
   * MARK PAYMENT UNPAID
   * ============================================================
   */

  async function markPaymentUnpaid(
    id: string
  ) {
    setBusy(
      `payment-${id}`
    );

    setError('');
    setToast('');

    const reservation =
      rows.find(
        r =>
          r.id === id
      );

    if (!reservation) {
      setError(
        'Reservation not found.'
      );

      setBusy(null);
      return;
    }

    const roomTotal =
      Number(
        reservation.room_total ||
          0
      );

    const {
      data,
      error,
    } = await s
      .from('reservations')
      .update({
        deposit: 0,
        balance:
          roomTotal,
      })
      .eq(
        'id',
        id
      )
      .select(
        '*, room:rooms(*)'
      )
      .single();

    if (error) {
      setError(
        error.message
      );

      setBusy(null);
      return;
    }

    try {
      await syncToGoogleSheets(
        data as R
      );
    } catch (sheetError: any) {
      setError(
        `Payment changed in Supabase, but Google Sheets was not updated: ${
          sheetError?.message ||
          'Unknown error.'
        }`
      );

      await load();
      setBusy(null);
      return;
    }

    setToast(
      'Payment changed back to UNPAID.'
    );

    await load();

    setBusy(null);
  }

  /*
   * ============================================================
   * GCASH QR
   * ============================================================
   */

  async function upload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    if (!file) return;

    setBusy('qr');
    setError('');
    setToast('');

    const extension =
      file.name
        .split('.')
        .pop() ||
      'png';

    const path =
      `gcash/qr-${Date.now()}.${extension}`;

    const {
      error,
    } = await s.storage
      .from(
        'payment-proofs'
      )
      .upload(
        path,
        file,
        {
          upsert: true,
        }
      );

    if (error) {
      setError(
        error.message
      );

      setBusy(null);
      return;
    }

    const {
      data,
    } =
      s.storage
        .from(
          'payment-proofs'
        )
        .getPublicUrl(
          path
        );

    const {
      error:
        settingsError,
    } = await s
      .from('settings')
      .upsert(
        {
          key:
            'gcash_qr_url',
          value:
            data.publicUrl,
        },
        {
          onConflict:
            'key',
        }
      );

    if (settingsError) {
      setError(
        settingsError.message
      );
    } else {
      setQr(
        data.publicUrl
      );

      setToast(
        'GCash QR updated successfully.'
      );
    }

    setBusy(null);
  }

  /*
   * ============================================================
   * STATS
   * ============================================================
   */

  const counts = {
    pending:
      rows.filter(
        r =>
          r.status ===
          'Pending'
      ).length,

    confirmed:
      rows.filter(
        r =>
          r.status ===
          'Confirmed'
      ).length,

    occupied:
      rows.filter(
        r =>
          r.status ===
          'Checked-in'
      ).length,

    arrivals:
      rows.filter(
        r =>
          r.check_in ===
            today() &&
          [
            'Confirmed',
            'Pending',
          ].includes(
            r.status
          )
      ).length,

    paid:
      rows.filter(
        isReservationPaid
      ).length,

    unpaid:
      rows.filter(
        r =>
          !isReservationPaid(
            r
          )
      ).length,
  };

  /*
   * ============================================================
   * FILTER
   * ============================================================
   */

  const filtered =
    filter === 'All'
      ? rows
      : rows.filter(
          r =>
            r.status ===
            filter
        );

  /*
   * ============================================================
   * CALENDAR
   * ============================================================
   */

  const monthDates =
    useMemo(() => {
      const [
        y,
        m,
      ] =
        month
          .split('-')
          .map(Number);

      const days =
        new Date(
          y,
          m,
          0
        ).getDate();

      const first =
        new Date(
          y,
          m - 1,
          1
        ).getDay();

      return {
        days,
        first,
      };
    }, [month]);

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <>
        <style jsx global>
          {luxuryStyles}
        </style>

        <div className="login-shell luxury-bg">
          <div className="card luxury-loading">
            <div className="gold-mark">
              桜
            </div>

            <div>
              Loading Sakura Ananda...
            </div>
          </div>
        </div>
      </>
    );
  }

  /*
   * ============================================================
   * LOGIN
   * ============================================================
   */

  if (!user) {
    return (
      <>
        <style jsx global>
          {luxuryStyles}
        </style>

        <div className="login-shell luxury-bg">

          <div className="brandline luxury-brand">
            <span>桜</span>
            Sakura Ananda Resort
          </div>

          <div className="card login-card luxury-login">

            <div className="gold-mark">
              桜
            </div>

            <div className="eyebrow">
              PRIVATE STAFF AREA
            </div>

            <h1>
              Welcome back.
            </h1>

            <p className="muted">
              A refined space for managing
              reservations, guests, rooms
              and payments.
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
                    setEmail(
                      e.target.value
                    )
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
                    setPassword(
                      e.target.value
                    )
                  }
                />
              </div>

              {error && (
                <div className="notice error">
                  {error}
                </div>
              )}

              <button
                className="btn luxury-button"
                type="submit"
              >
                Enter Staff Dashboard
              </button>

            </form>

          </div>

        </div>
      </>
    );
  }

  /*
   * ============================================================
   * DASHBOARD
   * ============================================================
   */

  return (
    <>
      <style jsx global>
        {luxuryStyles}
      </style>

      <div className="dashboard luxury-dashboard">

        {/* HEADER */}

        <div className="dash-top luxury-header">

          <div>

            <div className="eyebrow">
              SAKURA ANANDA • PRIVATE RESORT
            </div>

            <h1>
              Front Desk
            </h1>

            <div className="muted">
              Reservations, rooms and guest
              experiences — beautifully organized.
            </div>

          </div>

          <button
            type="button"
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
          <div className="notice success luxury-notice">
            {toast}
          </div>
        )}

        {error && (
          <div className="notice error luxury-notice">
            {error}
          </div>
        )}

        {/* STATS */}

        <div className="stats luxury-stats">

          <div className="card stat luxury-stat">
            <span>Pending</span>
            <b>{counts.pending}</b>
            <small>Requests</small>
          </div>

          <div className="card stat luxury-stat">
            <span>Confirmed</span>
            <b>{counts.confirmed}</b>
            <small>Upcoming stays</small>
          </div>

          <div className="card stat luxury-stat">
            <span>Occupied</span>
            <b>{counts.occupied}</b>
            <small>Rooms today</small>
          </div>

          <div className="card stat luxury-stat">
            <span>Arrivals</span>
            <b>{counts.arrivals}</b>
            <small>Today</small>
          </div>

          <div className="card stat luxury-stat">
            <span>Paid</span>
            <b>{counts.paid}</b>
            <small>Completed</small>
          </div>

          <div className="card stat luxury-stat">
            <span>Unpaid</span>
            <b>{counts.unpaid}</b>
            <small>Outstanding</small>
          </div>

        </div>

        {/* ROOMS */}

        <div className="section-title luxury-section">

          <div>
            <div className="eyebrow">
              ROOMS
            </div>

            <h2>
              Occupancy
            </h2>
          </div>

        </div>

        <div className="occupancy-grid">

          {rooms.map(
            room => {

              const active =
                rows.find(
                  r =>
                    r.room_id ===
                      room.id &&
                    r.status ===
                      'Checked-in'
                );

              const upcoming =
                rows.find(
                  r =>
                    r.room_id ===
                      room.id &&
                    r.status ===
                      'Confirmed' &&
                    r.check_in >=
                      today()
                );

              return (
                <div
                  className="card room-status luxury-room"
                  key={room.id}
                >

                  <div className="room-top">

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

                    <span className="room-symbol">
                      桜
                    </span>

                  </div>

                  <h3>
                    {room.name}
                  </h3>

                  <div className="room-price">
                    ₱
                    {Number(
                      room.rate || 0
                    ).toLocaleString(
                      'en-PH'
                    )}

                    <small>
                      / night
                    </small>
                  </div>

                  {active ? (
                    <p>
                      Guest:{' '}
                      <b>
                        {
                          active.guest_name
                        }
                      </b>

                      <br />

                      Until{' '}
                      {
                        active.check_out
                      }
                    </p>
                  ) : upcoming ? (
                    <p>
                      Next arrival:{' '}
                      <b>
                        {
                          upcoming.check_in
                        }
                      </b>

                      <br />

                      {
                        upcoming.guest_name
                      }
                    </p>
                  ) : (
                    <p>
                      Ready for a new stay.
                    </p>
                  )}

                </div>
              );
            }
          )}

        </div>

        {/* CALENDAR */}

        <div
          className="section-title luxury-section"
          style={{
            marginTop: 42,
          }}
        >

          <div>

            <div className="eyebrow">
              PLANNING
            </div>

            <h2>
              Availability calendar
            </h2>

          </div>

          <input
            type="month"
            value={month}
            onChange={e =>
              setMonth(
                e.target.value
              )
            }
          />

        </div>

        <div className="card calendar-wrap luxury-card">

          <div className="calendar">

            {[
              'Sun',
              'Mon',
              'Tue',
              'Wed',
              'Thu',
              'Fri',
              'Sat',
            ].map(
              x => (
                <div
                  className="calendar-head"
                  key={x}
                >
                  {x}
                </div>
              )
            )}

            {Array.from(
              {
                length:
                  monthDates.first +
                  monthDates.days,
              },
              (_, i) => {

                if (
                  i <
                  monthDates.first
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
                  `${month}-${String(
                    d
                  ).padStart(
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

                    {rooms.map(
                      room => {

                        const booked =
                          rows.some(
                            r =>
                              r.room_id ===
                                room.id &&
                              [
                                'Pending',
                                'Confirmed',
                                'Checked-in',
                              ].includes(
                                r.status
                              ) &&
                              r.check_in <=
                                ds &&
                              r.check_out >
                                ds
                          );

                        return (
                          <div
                            className="room-dot"
                            key={
                              room.id
                            }
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
                      }
                    )}

                  </div>
                );
              }
            )}

          </div>

        </div>

        {/* GCASH */}

        <div
          className="section-title luxury-section"
          style={{
            marginTop: 42,
          }}
        >

          <div>

            <div className="eyebrow">
              GUEST COMMUNICATION
            </div>

            <h2>
              GCash QR
            </h2>

          </div>

        </div>

        <div className="card luxury-card">

          <div className="settings-card">

            <div>

              <p className="muted">
                Upload the current GCash
                QR code shown to guests
                during reservation.
              </p>

              <input
                type="file"
                accept="image/*"
                onChange={upload}
                disabled={
                  busy === 'qr'
                }
              />

              {qr && (
                <div
                  style={{
                    marginTop: 16,
                  }}
                >
                  <img
                    className="qr luxury-qr"
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
                Reservation notifications
                are handled automatically
                by your Google Sheets +
                Apps Script workflow.
              </p>

            </div>

          </div>

        </div>

        {/* RESERVATIONS */}

        <div
          className="section-title luxury-section"
          style={{
            marginTop: 42,
          }}
        >

          <div>

            <div className="eyebrow">
              FRONT DESK
            </div>

            <h2>
              Reservations
            </h2>

            <p className="muted">
              Edit reservations, update
              payments and manage status.
            </p>

          </div>

          <select
            value={filter}
            onChange={e =>
              setFilter(
                e.target.value
              )
            }
          >

            <option value="All">
              All reservations
            </option>

            <option value="Pending">
              Pending
            </option>

            <option value="Confirmed">
              Confirmed
            </option>

            <option value="Checked-in">
              Checked-in
            </option>

            <option value="Checked-out">
              Checked-out
            </option>

            <option value="Cancelled">
              Cancelled
            </option>

          </select>

        </div>

        {/* TABLE */}

        <div className="table-wrap luxury-table-wrap">

          <table className="table luxury-table">

            <thead>

              <tr>
                <th>Booking</th>
                <th>Guest</th>
                <th>Stay</th>
                <th>Room</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>

            </thead>

            <tbody>

              {filtered.length ===
              0 ? (

                <tr>

                  <td
                    colSpan={7}
                    style={{
                      textAlign:
                        'center',
                      padding: 50,
                    }}
                  >

                    <span className="muted">
                      No reservations found.
                    </span>

                  </td>

                </tr>

              ) : (

                filtered.map(
                  r => {

                    const isPaid =
                      isReservationPaid(
                        r
                      );

                    const paymentBusy =
                      busy ===
                      `payment-${r.id}`;

                    const status =
                      paymentStatus(
                        r
                      );

                    return (
                      <tr
                        key={r.id}
                      >

                        {/* BOOKING */}

                        <td>

                          <b>
                            {
                              r.booking_id
                            }
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
                            {
                              r.guest_name
                            }
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

                          {
                            r.check_in
                          }

                          <br />

                          →

                          {' '}

                          {
                            r.check_out
                          }

                          <br />

                          <span className="muted">

                            {r.guests}{' '}
                            guest
                            {Number(
                              r.guests
                            ) !== 1
                              ? 's'
                              : ''}

                          </span>

                        </td>

                        {/* ROOM */}

                        <td>

                          <b className="room-name-display">

                            {r.room?.name ||
                              rooms.find(
                                room =>
                                  room.id ===
                                  r.room_id
                              )?.name ||
                              'Room unavailable'}

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
                              r.room_total ||
                                0
                            ).toLocaleString(
                              'en-PH'
                            )}
                          </b>

                          <br />

                          Deposit ₱
                          {Number(
                            r.deposit ||
                              0
                          ).toLocaleString(
                            'en-PH'
                          )}

                          <br />

                          Balance ₱
                          {Number(
                            r.balance ||
                              0
                          ).toLocaleString(
                            'en-PH'
                          )}

                          <br />

                          <span
                            className={`pill ${
                              isPaid
                                ? 'success'
                                : Number(
                                    r.deposit ||
                                      0
                                  ) > 0
                                ? 'warn'
                                : 'danger'
                            }`}
                            style={{
                              marginTop: 6,
                              display:
                                'inline-block',
                            }}
                          >
                            {status}
                          </span>

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

                              <div>

                                <span className="pill success">
                                  ✓ PAID
                                </span>

                                <button
                                  type="button"
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
                                  {paymentBusy
                                    ? 'Updating...'
                                    : 'Undo Paid'}
                                </button>

                              </div>

                            ) : (

                              <button
                                type="button"
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

                          <div className="actions luxury-actions">

                            {/* EDIT ONLY */}

                            <button
                              type="button"
                              className="btn edit-btn"
                              onClick={() =>
                                openEdit(
                                  r
                                )
                              }
                            >
                              Edit
                            </button>

                            {/* PENDING */}

                            {r.status ===
                              'Pending' && (
                              <>

                                <button
                                  type="button"
                                  className="btn green"
                                  disabled={
                                    busy ===
                                    r.id
                                  }
                                  onClick={() =>
                                    action(
                                      r.id,
                                      'Confirmed'
                                    )
                                  }
                                >
                                  {busy ===
                                  r.id
                                    ? 'Updating...'
                                    : 'Confirm'}
                                </button>

                                <button
                                  type="button"
                                  className="btn red"
                                  disabled={
                                    busy ===
                                    r.id
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

                            {/* CONFIRMED */}

                            {r.status ===
                              'Confirmed' && (
                              <>

                                <button
                                  type="button"
                                  className="btn blue"
                                  disabled={
                                    busy ===
                                    r.id
                                  }
                                  onClick={() =>
                                    action(
                                      r.id,
                                      'Checked-in'
                                    )
                                  }
                                >
                                  {busy ===
                                  r.id
                                    ? 'Updating...'
                                    : 'Check-in'}
                                </button>

                                <button
                                  type="button"
                                  className="btn red"
                                  disabled={
                                    busy ===
                                    r.id
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

                            {/* CHECKED IN */}

                            {r.status ===
                              'Checked-in' && (

                              <button
                                type="button"
                                className="btn secondary"
                                disabled={
                                  busy ===
                                  r.id
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
                  }
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* =====================================================
          EDIT MODAL
          ===================================================== */}

      {editingReservation && (

        <div
          className="modal-backdrop"
          onMouseDown={e => {

            if (
              e.target ===
              e.currentTarget
            ) {
              closeEdit();
            }

          }}
        >

          <div className="edit-modal">

            <div className="modal-header">

              <div>

                <div className="eyebrow">
                  RESERVATION EDITOR
                </div>

                <h2>
                  Edit Reservation
                </h2>

                <p className="muted">
                  Booking #
                  {
                    editingReservation.booking_id
                  }
                </p>

              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closeEdit
                }
              >
                ×
              </button>

            </div>

            <form
              className="edit-form"
              onSubmit={
                updateReservation
              }
            >

              {/* GUEST */}

              <div className="form-section-title">
                Guest Information
              </div>

              <div className="edit-grid">

                <div className="field">

                  <label>
                    Guest name
                  </label>

                  <input
                    required
                    value={
                      editForm.guest_name
                    }
                    onChange={e =>
                      updateEditField(
                        'guest_name',
                        e.target.value
                      )
                    }
                  />

                </div>

                <div className="field">

                  <label>
                    Mobile number
                  </label>

                  <input
                    required
                    type="text"
                    value={
                      editForm.mobile
                    }
                    onChange={e =>
                      updateEditField(
                        'mobile',
                        e.target.value
                      )
                    }
                    placeholder="+63..."
                  />

                </div>

                <div className="field">

                  <label>
                    Email
                  </label>

                  <input
                    type="email"
                    value={
                      editForm.email
                    }
                    onChange={e =>
                      updateEditField(
                        'email',
                        e.target.value
                      )
                    }
                  />

                </div>

                <div className="field">

                  <label>
                    Number of guests
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={
                      editForm.guests
                    }
                    onChange={e =>
                      updateEditField(
                        'guests',
                        Number(
                          e.target.value
                        )
                      )
                    }
                  />

                </div>

              </div>

              {/* STAY */}

              <div className="form-section-title">
                Stay Details
              </div>

              <div className="edit-grid">

                <div className="field">

                  <label>
                    Check-in
                  </label>

                  <input
                    type="date"
                    required
                    value={
                      editForm.check_in
                    }
                    onChange={e =>
                      updateEditField(
                        'check_in',
                        e.target.value
                      )
                    }
                  />

                </div>

                <div className="field">

                  <label>
                    Check-out
                  </label>

                  <input
                    type="date"
                    required
                    value={
                      editForm.check_out
                    }
                    onChange={e =>
                      updateEditField(
                        'check_out',
                        e.target.value
                      )
                    }
                  />

                </div>

                <div className="field">

                  <label>
                    Room
                  </label>

                  <select
                    required
                    value={
                      editForm.room_id
                    }
                    onChange={e =>
                      handleRoomChange(
                        e.target.value
                      )
                    }
                  >

                    <option value="">
                      Select a room
                    </option>

                    {rooms.map(
                      room => (

                        <option
                          key={
                            room.id
                          }
                          value={
                            room.id
                          }
                        >

                          {room.name} — ₱
                          {Number(
                            room.rate ||
                              0
                          ).toLocaleString(
                            'en-PH'
                          )}
                          /night

                        </option>

                      )
                    )}

                  </select>

                </div>

                <div className="field">

                  <label>
                    Rate per night
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={
                      editForm.rate_per_night
                    }
                    onChange={e =>
                      updateEditField(
                        'rate_per_night',
                        Number(
                          e.target.value
                        )
                      )
                    }
                  />

                </div>

              </div>

              {/* PAYMENT */}

              <div className="form-section-title">
                Payment
              </div>

              <div className="edit-grid">

                <div className="field">

                  <label>
                    Room total
                  </label>

                  <input
                    type="number"
                    value={
                      calculateEditTotal()
                    }
                    readOnly
                  />

                </div>

                <div className="field">

                  <label>
                    Deposit
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={
                      editForm.deposit
                    }
                    onChange={e =>
                      updateEditField(
                        'deposit',
                        Number(
                          e.target.value
                        )
                      )
                    }
                  />

                </div>

                <div className="field">

                  <label>
                    Balance
                  </label>

                  <input
                    type="number"
                    value={
                      Math.max(
                        0,
                        calculateEditTotal() -
                          Number(
                            editForm.deposit ||
                              0
                          )
                      )
                    }
                    readOnly
                  />

                </div>

                <div className="field">

                  <label>
                    Payment method
                  </label>

                  <select
                    value={
                      editForm.payment_method
                    }
                    onChange={e =>
                      updateEditField(
                        'payment_method',
                        e.target.value
                      )
                    }
                  >

                    <option value="GCash">
                      GCash
                    </option>

                    <option value="Cash">
                      Cash
                    </option>

                    <option value="Bank Transfer">
                      Bank Transfer
                    </option>

                    <option value="Card">
                      Card
                    </option>

                    <option value="Other">
                      Other
                    </option>

                  </select>

                </div>

                <div className="field">

                  <label>
                    Payment reference
                  </label>

                  <input
                    value={
                      editForm.payment_ref
                    }
                    onChange={e =>
                      updateEditField(
                        'payment_ref',
                        e.target.value
                      )
                    }
                  />

                </div>

              </div>

              {/* STATUS */}

              <div className="form-section-title">
                Reservation Status
              </div>

              <div className="edit-grid">

                <div className="field">

                  <label>
                    Status
                  </label>

                  <select
                    value={
                      editForm.status
                    }
                    onChange={e =>
                      updateEditField(
                        'status',
                        e.target.value
                      )
                    }
                  >

                    <option value="Pending">
                      Pending
                    </option>

                    <option value="Confirmed">
                      Confirmed
                    </option>

                    <option value="Checked-in">
                      Checked-in
                    </option>

                    <option value="Checked-out">
                      Checked-out
                    </option>

                    <option value="Cancelled">
                      Cancelled
                    </option>

                  </select>

                </div>

              </div>

              {/* SPECIAL REQUESTS */}

              <div className="field">

                <label>
                  Special requests
                </label>

                <textarea
                  rows={4}
                  value={
                    editForm.special_requests
                  }
                  onChange={e =>
                    updateEditField(
                      'special_requests',
                      e.target.value
                    )
                  }
                  placeholder="Guest requests, notes, special arrangements..."
                />

              </div>

              {/* SUMMARY */}

              <div className="edit-summary">

                <div>
                  <span>
                    Room
                  </span>

                  <b>
                    {rooms.find(
                      room =>
                        room.id ===
                        editForm.room_id
                    )?.name ||
                      'Not selected'}
                  </b>
                </div>

                <div>
                  <span>
                    Total
                  </span>

                  <b>
                    ₱
                    {calculateEditTotal().toLocaleString(
                      'en-PH'
                    )}
                  </b>
                </div>

                <div>
                  <span>
                    Deposit
                  </span>

                  <b>
                    ₱
                    {Number(
                      editForm.deposit ||
                        0
                    ).toLocaleString(
                      'en-PH'
                    )}
                  </b>
                </div>

                <div>
                  <span>
                    Balance
                  </span>

                  <b>
                    ₱
                    {Math.max(
                      0,
                      calculateEditTotal() -
                        Number(
                          editForm.deposit ||
                            0
                        )
                    ).toLocaleString(
                      'en-PH'
                    )}
                  </b>
                </div>

              </div>

              {/* BUTTONS */}

              <div className="modal-actions">

                <button
                  type="button"
                  className="btn secondary"
                  disabled={
                    busy === 'edit'
                  }
                  onClick={
                    closeEdit
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn luxury-button"
                  disabled={
                    busy === 'edit'
                  }
                >
                  {busy === 'edit'
                    ? 'Saving & Syncing...'
                    : 'Save Changes'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </>
  );
}

/*
 * ============================================================
 * LUXURY STYLES
 * ============================================================
 */

const luxuryStyles = `
:root {
  --luxury-bg: #f6f1e8;
  --luxury-card: #fffdf8;
  --luxury-dark: #211f1a;
  --luxury-muted: #827c70;
  --luxury-gold: #b18a45;
  --luxury-gold-light: #d8bd83;
  --luxury-border: rgba(120, 98, 60, .16);
}

* {
  box-sizing: border-box;
}

body {
  background:
    radial-gradient(
      circle at top right,
      rgba(190, 160, 100, .10),
      transparent 32%
    ),
    linear-gradient(
      135deg,
      #faf7f0,
      #f2ecdf
    );
  color: var(--luxury-dark);
}

.luxury-dashboard {
  max-width: 1500px;
  margin: 0 auto;
  padding: 38px 28px 80px;
}

.luxury-header {
  padding: 22px 0 34px;
  border-bottom: 1px solid var(--luxury-border);
  margin-bottom: 24px;
}

.luxury-header h1 {
  font-family: Georgia, serif;
  font-weight: 500;
  letter-spacing: -.04em;
  font-size: clamp(36px, 5vw, 58px);
  margin: 8px 0;
}

.luxury-brand {
  font-family: Georgia, serif;
  letter-spacing: .06em;
}

.luxury-brand span,
.gold-mark {
  color: var(--luxury-gold);
}

.gold-mark {
  font-family: Georgia, serif;
  font-size: 42px;
  margin-bottom: 8px;
}

.luxury-card,
.luxury-stat,
.luxury-room {
  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,.96),
      rgba(249,244,234,.94)
    );
  border: 1px solid var(--luxury-border);
  box-shadow:
    0 16px 50px rgba(70,55,30,.07),
    inset 0 1px 0 rgba(255,255,255,.8);
}

.luxury-stat {
  position: relative;
  overflow: hidden;
  padding: 22px;
}

.luxury-stat::after {
  content: "桜";
  position: absolute;
  right: 15px;
  bottom: -12px;
  font-family: Georgia, serif;
  font-size: 60px;
  color: rgba(177,138,69,.08);
}

.luxury-stat span {
  color: var(--luxury-muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .1em;
}

.luxury-stat b {
  display: block;
  font-family: Georgia, serif;
  font-size: 34px;
  font-weight: 500;
  margin: 8px 0 3px;
}

.luxury-stat small {
  color: var(--luxury-muted);
}

.luxury-section {
  align-items: flex-end;
}

.luxury-section h2 {
  font-family: Georgia, serif;
  font-weight: 500;
  font-size: 30px;
  margin: 5px 0;
}

.luxury-room {
  padding: 22px;
  transition:
    transform .2s ease,
    box-shadow .2s ease;
}

.luxury-room:hover {
  transform: translateY(-3px);
  box-shadow:
    0 20px 55px rgba(70,55,30,.11);
}

.room-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-symbol {
  color: var(--luxury-gold);
  font-family: Georgia, serif;
  font-size: 22px;
}

.luxury-room h3 {
  font-family: Georgia, serif;
  font-size: 24px;
  font-weight: 500;
  margin: 18px 0 5px;
}

.room-price {
  font-family: Georgia, serif;
  font-size: 20px;
  color: var(--luxury-gold);
}

.room-price small {
  color: var(--luxury-muted);
  font-family: inherit;
  font-size: 12px;
}

.room-name-display {
  color: #5b4423;
}

.luxury-table-wrap {
  border-radius: 18px;
  box-shadow:
    0 20px 70px rgba(60,45,20,.08);
}

.luxury-table th {
  background: #eee6d5;
  color: #6d5a3c;
  text-transform: uppercase;
  letter-spacing: .08em;
  font-size: 10px;
}

.luxury-table tbody tr {
  transition: background .15s ease;
}

.luxury-table tbody tr:hover {
  background: rgba(177,138,69,.055);
}

.luxury-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 150px;
}

.edit-btn {
  background: #8b6a38 !important;
  color: white !important;
}

.btn.blue {
  background: #536d80;
  color: white;
}

.luxury-button {
  background:
    linear-gradient(
      135deg,
      #8e6b34,
      #c19b58
    ) !important;
  color: white !important;
  border: 0 !important;
  box-shadow:
    0 8px 25px rgba(142,107,52,.25);
}

.luxury-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

.luxury-notice {
  border-left: 3px solid var(--luxury-gold);
}

.luxury-qr {
  max-width: 240px;
  border-radius: 16px;
  border: 1px solid var(--luxury-border);
  box-shadow:
    0 12px 35px rgba(50,40,20,.1);
}

/* LOGIN */

.luxury-bg {
  min-height: 100vh;
  background:
    radial-gradient(
      circle at 50% 0%,
      rgba(185,145,70,.16),
      transparent 35%
    ),
    #f4eee2;
}

.luxury-login {
  border:
    1px solid
    rgba(177,138,69,.22);

  box-shadow:
    0 30px 100px rgba(55,40,20,.13);
}

/* EDIT MODAL */

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(26,23,18,.66);
  backdrop-filter: blur(9px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
}

.edit-modal {
  width: min(900px, 100%);
  max-height: calc(100vh - 48px);
  overflow-y: auto;

  background:
    linear-gradient(
      145deg,
      #fffdf9,
      #f5eee2
    );

  border:
    1px solid
    rgba(177,138,69,.25);

  border-radius: 22px;

  box-shadow:
    0 35px 120px rgba(0,0,0,.28);
}

.modal-header {
  position: sticky;
  top: 0;
  z-index: 2;

  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  padding: 28px 30px 20px;

  background:
    rgba(255,253,249,.94);

  backdrop-filter: blur(12px);

  border-bottom:
    1px solid
    var(--luxury-border);
}

.modal-header h2 {
  font-family: Georgia, serif;
  font-size: 30px;
  font-weight: 500;
  margin: 5px 0;
}

.modal-close {
  width: 40px;
  height: 40px;
  border-radius: 50%;

  border:
    1px solid
    var(--luxury-border);

  background: white;

  font-size: 25px;

  cursor: pointer;

  color: #6d604e;
}

.edit-form {
  padding: 28px 30px 32px;
}

.form-section-title {
  font-family: Georgia, serif;
  color: #7d5d2f;
  font-size: 17px;

  margin: 24px 0 14px;
  padding-bottom: 8px;

  border-bottom:
    1px solid
    var(--luxury-border);
}

.edit-grid {
  display: grid;

  grid-template-columns:
    repeat(2, minmax(0, 1fr));

  gap: 16px;
}

.edit-form input,
.edit-form select,
.edit-form textarea {
  width: 100%;

  border:
    1px solid
    rgba(100,80,45,.18);

  background:
    rgba(255,255,255,.78);

  border-radius: 10px;

  padding: 12px 13px;

  color: #2b281f;

  outline: none;

  transition:
    border-color .15s ease,
    box-shadow .15s ease;
}

.edit-form input:focus,
.edit-form select:focus,
.edit-form textarea:focus {
  border-color:
    rgba(177,138,69,.65);

  box-shadow:
    0 0 0 3px
    rgba(177,138,69,.10);
}

.edit-form textarea {
  resize: vertical;
}

.edit-summary {
  display: grid;

  grid-template-columns:
    repeat(4, 1fr);

  gap: 10px;

  margin-top: 24px;
  padding: 18px;

  border-radius: 14px;

  background:
    rgba(177,138,69,.08);

  border:
    1px solid
    rgba(177,138,69,.16);
}

.edit-summary div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.edit-summary span {
  color: var(--luxury-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.edit-summary b {
  font-family: Georgia, serif;
  font-size: 17px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;

  margin-top: 28px;
  padding-top: 20px;

  border-top:
    1px solid
    var(--luxury-border);
}

@media (max-width: 900px) {

  .luxury-dashboard {
    padding: 24px 14px 60px;
  }

  .edit-grid {
    grid-template-columns: 1fr;
  }

  .edit-summary {
    grid-template-columns:
      repeat(2, 1fr);
  }

  .table-wrap {
    overflow-x: auto;
  }

  .luxury-table {
    min-width: 1050px;
  }
}

@media (max-width: 600px) {

  .stats {
    grid-template-columns:
      repeat(2, 1fr);
  }

  .edit-summary {
    grid-template-columns: 1fr;
  }

  .modal-backdrop {
    padding: 10px;
  }

  .edit-modal {
    max-height:
      calc(100vh - 20px);

    border-radius: 16px;
  }

  .modal-header,
  .edit-form {
    padding-left: 18px;
    padding-right: 18px;
  }
}
`;
