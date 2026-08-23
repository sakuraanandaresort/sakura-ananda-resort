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

type ReportMode = 'monthly' | 'annual';

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
 * FORMATTERS
 * ============================================================
 */

function peso(value: number) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function wholePeso(value: number) {
  return `₱${Number(value || 0).toLocaleString('en-PH')}`;
}

function formatDate(date: string) {
  if (!date) return '—';

  return new Date(`${date}T00:00:00`).toLocaleDateString(
    'en-PH',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  );
}

function formatMonth(month: string) {
  if (!month) return '';

  const [year, m] = month.split('-').map(Number);

  return new Date(year, m - 1, 1).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'long',
    }
  );
}

function formatYear(year: string) {
  return year;
}

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

  if (total <= 0) return 'Unknown';

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
 * SALES HELPERS
 * ============================================================
 */

function isRevenueReservation(r: R) {
  return r.status !== 'Cancelled';
}

function reservationRevenue(r: R) {
  if (!isRevenueReservation(r)) return 0;

  return Number(r.room_total || 0);
}

function reservationCollected(r: R) {
  if (!isRevenueReservation(r)) return 0;

  return Number(r.deposit || 0);
}

function reservationOutstanding(r: R) {
  if (!isRevenueReservation(r)) return 0;

  return Math.max(
    0,
    Number(r.balance || 0)
  );
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

  const [reportMode, setReportMode] =
    useState<ReportMode>('monthly');

  const [reportYear, setReportYear] =
    useState(
      new Date().getFullYear().toString()
    );

  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState('All');

  const [busy, setBusy] =
    useState<string | null>(null);

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

  function closeEdit() {
    if (busy === 'edit') return;

    setEditingReservation(null);
  }

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
   * CUSTOMER EMAIL
   * ============================================================
   */

  async function notifyCustomer(
    reservation: R,
    event: string
  ) {
    if (
      !reservation.email ||
      reservation.notification_consent === false
    ) {
      return;
    }

    try {
      const {
        data: {
          session,
        },
      } = await s.auth.getSession();

      await fetch(
        '/api/notifications',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',

            ...(session?.access_token
              ? {
                  Authorization:
                    `Bearer ${session.access_token}`,
                }
              : {}),
          },
          body: JSON.stringify({
            event,
            reservation,
          }),
        }
      );
    } catch {
      // Reservation remains successful even if notification fails.
    }
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

    const emailEvent =
      updatedReservation.status ===
      'Confirmed'
        ? 'confirmed'
        : updatedReservation.status ===
          'Cancelled'
        ? 'cancelled'
        : updatedReservation.status ===
          'Checked-in'
        ? 'checked-in'
        : updatedReservation.status ===
          'Checked-out'
        ? 'checked-out'
        : 'updated';

    await notifyCustomer(
      updatedReservation,
      emailEvent
    );

    setEditingReservation(null);

    await load();

    setToast(
      `Reservation ${updatedReservation.booking_id} updated successfully.`
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

    const updatedReservation =
      data as R;

    const emailEvent =
      status === 'Confirmed'
        ? 'confirmed'
        : status === 'Cancelled'
        ? 'cancelled'
        : status === 'Checked-in'
        ? 'checked-in'
        : status === 'Checked-out'
        ? 'checked-out'
        : 'updated';

    await notifyCustomer(
      updatedReservation,
      emailEvent
    );

    setToast(
      'Reservation status updated successfully.'
    );

    await load();

    setBusy(null);
  }

  /*
   * ============================================================
   * PAYMENT PAID
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

    await notifyCustomer(
      data as R,
      'paid'
    );

    setToast(
      `Payment marked as PAID. ${wholePeso(roomTotal)}`
    );

    await load();

    setBusy(null);
  }

  /*
   * ============================================================
   * PAYMENT UNPAID
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

    await notifyCustomer(
      data as R,
      'unpaid'
    );

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
   * BASIC COUNTS
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
          !isReservationPaid(r)
      ).length,
  };

  /*
   * ============================================================
   * CURRENT MONTH SALES
   * ============================================================
   */

  const currentMonthRows =
    useMemo(() => {
      return rows.filter(
        r =>
          r.check_in?.startsWith(
            month
          ) &&
          isRevenueReservation(r)
      );
    }, [rows, month]);

  const currentMonthRevenue =
    currentMonthRows.reduce(
      (sum, r) =>
        sum + reservationRevenue(r),
      0
    );

  const currentMonthCollected =
    currentMonthRows.reduce(
      (sum, r) =>
        sum + reservationCollected(r),
      0
    );

  const currentMonthOutstanding =
    currentMonthRows.reduce(
      (sum, r) =>
        sum + reservationOutstanding(r),
      0
    );

  /*
   * ============================================================
   * ANNUAL SALES
   * ============================================================
   */

  const annualRows =
    useMemo(() => {
      return rows.filter(
        r =>
          r.check_in?.startsWith(
            reportYear
          ) &&
          isRevenueReservation(r)
      );
    }, [rows, reportYear]);

  const annualRevenue =
    annualRows.reduce(
      (sum, r) =>
        sum + reservationRevenue(r),
      0
    );

  const annualCollected =
    annualRows.reduce(
      (sum, r) =>
        sum + reservationCollected(r),
      0
    );

  const annualOutstanding =
    annualRows.reduce(
      (sum, r) =>
        sum + reservationOutstanding(r),
      0
    );

  /*
   * ============================================================
   * MONTHLY SALES CHART
   * ============================================================
   */

  const monthlySales =
    useMemo(() => {
      const year =
        Number(reportYear);

      return Array.from(
        { length: 12 },
        (_, index) => {
          const monthNumber =
            index + 1;

          const key =
            `${year}-${String(
              monthNumber
            ).padStart(2, '0')}`;

          const monthRows =
            rows.filter(
              r =>
                r.check_in?.startsWith(
                  key
                ) &&
                isRevenueReservation(r)
            );

          const revenue =
            monthRows.reduce(
              (sum, r) =>
                sum +
                reservationRevenue(r),
              0
            );

          const collected =
            monthRows.reduce(
              (sum, r) =>
                sum +
                reservationCollected(r),
              0
            );

          return {
            key,
            label:
              new Date(
                year,
                index,
                1
              ).toLocaleDateString(
                'en-US',
                {
                  month: 'short',
                }
              ),
            revenue,
            collected,
            bookings:
              monthRows.length,
          };
        }
      );
    }, [rows, reportYear]);

  const maxMonthlyRevenue =
    Math.max(
      ...monthlySales.map(
        x => x.revenue
      ),
      1
    );

  /*
   * ============================================================
   * ROOM SALES
   * ============================================================
   */

  const roomSales =
    useMemo(() => {
      return rooms.map(
        room => {
          const roomRows =
            currentMonthRows.filter(
              r =>
                r.room_id ===
                room.id
            );

          const revenue =
            roomRows.reduce(
              (sum, r) =>
                sum +
                reservationRevenue(r),
              0
            );

          const collected =
            roomRows.reduce(
              (sum, r) =>
                sum +
                reservationCollected(r),
              0
            );

          return {
            room,
            revenue,
            collected,
            bookings:
              roomRows.length,
          };
        }
      );
    }, [
      rooms,
      currentMonthRows,
    ]);

  /*
   * ============================================================
   * REPORT DATA
   * ============================================================
   */

  const reportRows =
    reportMode === 'monthly'
      ? currentMonthRows
      : annualRows;

  const reportRevenue =
    reportMode === 'monthly'
      ? currentMonthRevenue
      : annualRevenue;

  const reportCollected =
    reportMode === 'monthly'
      ? currentMonthCollected
      : annualCollected;

  const reportOutstanding =
    reportMode === 'monthly'
      ? currentMonthOutstanding
      : annualOutstanding;

  const reportBookings =
    reportRows.length;

  const reportAverage =
    reportBookings > 0
      ? reportRevenue /
        reportBookings
      : 0;

  /*
   * ============================================================
   * REPORT PRINT
   * ============================================================
   */

  function printReport() {
    window.print();
  }

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
   * YEARS
   * ============================================================
   */

  const availableYears =
    useMemo(() => {
      const set =
        new Set<string>();

      rows.forEach(r => {
        if (r.check_in) {
          set.add(
            r.check_in.slice(
              0,
              4
            )
          );
        }
      });

      set.add(
        new Date()
          .getFullYear()
          .toString()
      );

      return Array.from(set)
        .sort()
        .reverse();
    }, [rows]);

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
              reservations, guests, rooms,
              payments and resort sales.
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

        {/* =====================================================
            HEADER
            ===================================================== */}

        <div className="dash-top luxury-header">

          <div className="header-brand">

            <div className="mini-mark">
              桜
            </div>

            <div>

              <div className="eyebrow">
                SAKURA ANANDA • PRIVATE RESORT
              </div>

              <h1>
                Front Desk
              </h1>

              <div className="muted">
                Reservations, rooms, payments
                and resort performance.
              </div>

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

        {/* =====================================================
            NOTICES
            ===================================================== */}

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

        {/* =====================================================
            SALES HERO
            ===================================================== */}

        <section className="sales-hero">

          <div className="sales-hero-copy">

            <div className="eyebrow">
              SALES PERFORMANCE
            </div>

            <h2>
              {formatMonth(month)}
            </h2>

            <p>
              A clear view of your resort
              revenue, collections and
              outstanding payments.
            </p>

          </div>

          <div className="sales-hero-total">

            <span>
              ROOM REVENUE
            </span>

            <strong>
              {peso(
                currentMonthRevenue
              )}
            </strong>

            <small>
              {currentMonthRows.length}{' '}
              revenue-generating booking
              {currentMonthRows.length !== 1
                ? 's'
                : ''}
            </small>

          </div>

        </section>

        {/* =====================================================
            SALES CARDS
            ===================================================== */}

        <div className="sales-grid">

          <div className="card sales-card primary">

            <span>
              Total Revenue
            </span>

            <b>
              {peso(
                currentMonthRevenue
              )}
            </b>

            <small>
              Based on room totals
            </small>

          </div>

          <div className="card sales-card">

            <span>
              Collected
            </span>

            <b>
              {peso(
                currentMonthCollected
              )}
            </b>

            <small>
              Deposits / payments received
            </small>

          </div>

          <div className="card sales-card">

            <span>
              Outstanding
            </span>

            <b>
              {peso(
                currentMonthOutstanding
              )}
            </b>

            <small>
              Remaining guest balances
            </small>

          </div>

          <div className="card sales-card">

            <span>
              Average Booking
            </span>

            <b>
              {peso(
                currentMonthRows.length
                  ? currentMonthRevenue /
                      currentMonthRows.length
                  : 0
              )}
            </b>

            <small>
              Revenue per booking
            </small>

          </div>

        </div>

        {/* =====================================================
            QUICK STATS
            ===================================================== */}

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

        {/* =====================================================
            ANNUAL SALES
            ===================================================== */}

        <section className="report-section">

          <div className="section-title luxury-section">

            <div>

              <div className="eyebrow">
                BUSINESS PERFORMANCE
              </div>

              <h2>
                Annual Sales
              </h2>

              <p className="muted">
                Monthly revenue performance
                for the selected year.
              </p>

            </div>

            <div className="report-controls">

              <select
                value={reportYear}
                onChange={e =>
                  setReportYear(
                    e.target.value
                  )
                }
              >

                {availableYears.map(
                  year => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  )
                )}

              </select>

              <button
                type="button"
                className="btn luxury-button"
                onClick={() => {
                  setReportMode(
                    'annual'
                  );

                  setTimeout(
                    printReport,
                    50
                  );
                }}
              >
                🖨 Print Annual Report
              </button>

            </div>

          </div>

          <div className="annual-summary">

            <div className="annual-main card">

              <span>
                {reportYear} TOTAL REVENUE
              </span>

              <strong>
                {peso(
                  annualRevenue
                )}
              </strong>

              <small>
                {annualRows.length} bookings
              </small>

            </div>

            <div className="annual-small card">

              <span>
                COLLECTED
              </span>

              <b>
                {peso(
                  annualCollected
                )}
              </b>

            </div>

            <div className="annual-small card">

              <span>
                OUTSTANDING
              </span>

              <b>
                {peso(
                  annualOutstanding
                )}
              </b>

            </div>

          </div>

          <div className="card chart-card">

            <div className="chart-heading">

              <div>
                <div className="eyebrow">
                  REVENUE TREND
                </div>

                <h3>
                  Monthly sales
                </h3>
              </div>

              <span>
                {formatYear(
                  reportYear
                )}
              </span>

            </div>

            <div className="sales-chart">

              {monthlySales.map(
                item => {

                  const height =
                    item.revenue >
                    0
                      ? Math.max(
                          8,
                          (item.revenue /
                            maxMonthlyRevenue) *
                            100
                        )
                      : 3;

                  return (
                    <div
                      className="chart-column"
                      key={
                        item.key
                      }
                    >

                      <div className="chart-value">
                        {item.revenue >
                        0
                          ? wholePeso(
                              item.revenue
                            )
                          : '—'}
                      </div>

                      <div className="bar-area">

                        <div
                          className="bar"
                          style={{
                            height:
                              `${height}%`,
                          }}
                        />

                      </div>

                      <b>
                        {item.label}
                      </b>

                      <small>
                        {item.bookings}{' '}
                        booking
                        {item.bookings !==
                        1
                          ? 's'
                          : ''}
                      </small>

                    </div>
                  );
                }
              )}

            </div>

          </div>

        </section>

        {/* =====================================================
            REPORT CENTER
            ===================================================== */}

        <section className="report-center">

          <div className="section-title luxury-section">

            <div>

              <div className="eyebrow">
                REPORT CENTER
              </div>

              <h2>
                Sales Reports
              </h2>

              <p className="muted">
                Generate a professional
                printable report directly
                from your Supabase data.
              </p>

            </div>

          </div>

          <div className="report-panel card">

            <div className="report-tabs">

              <button
                type="button"
                className={
                  reportMode ===
                  'monthly'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setReportMode(
                    'monthly'
                  )
                }
              >
                Monthly Report
              </button>

              <button
                type="button"
                className={
                  reportMode ===
                  'annual'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setReportMode(
                    'annual'
                  )
                }
              >
                Annual Report
              </button>

            </div>

            <div className="report-options">

              {reportMode ===
              'monthly' ? (

                <div className="field">

                  <label>
                    Report month
                  </label>

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

              ) : (

                <div className="field">

                  <label>
                    Report year
                  </label>

                  <select
                    value={reportYear}
                    onChange={e =>
                      setReportYear(
                        e.target.value
                      )
                    }
                  >

                    {availableYears.map(
                      year => (
                        <option
                          key={year}
                          value={year}
                        >
                          {year}
                        </option>
                      )
                    )}

                  </select>

                </div>

              )}

              <div className="report-preview">

                <span>
                  Report revenue
                </span>

                <b>
                  {peso(
                    reportRevenue
                  )}
                </b>

                <small>
                  {reportBookings}{' '}
                  bookings
                </small>

              </div>

              <div className="report-preview">

                <span>
                  Collected
                </span>

                <b>
                  {peso(
                    reportCollected
                  )}
                </b>

              </div>

              <div className="report-preview">

                <span>
                  Outstanding
                </span>

                <b>
                  {peso(
                    reportOutstanding
                  )}
                </b>

              </div>

              <button
                type="button"
                className="btn luxury-button report-print-btn"
                onClick={
                  printReport
                }
              >
                🖨 Print Sales Report
              </button>

            </div>

          </div>

        </section>

        {/* =====================================================
            ROOM SALES
            ===================================================== */}

        <section>

          <div className="section-title luxury-section">

            <div>

              <div className="eyebrow">
                ROOM PERFORMANCE
              </div>

              <h2>
                Sales by Room
              </h2>

              <p className="muted">
                {formatMonth(month)}
              </p>

            </div>

          </div>

          <div className="room-sales-grid">

            {roomSales.map(
              item => {

                const percentage =
                  currentMonthRevenue >
                  0
                    ? Math.round(
                        (item.revenue /
                          currentMonthRevenue) *
                          100
                      )
                    : 0;

                return (
                  <div
                    className="card room-sales-card"
                    key={
                      item.room.id
                    }
                  >

                    <div className="room-sales-top">

                      <div>

                        <span className="room-symbol">
                          桜
                        </span>

                        <h3>
                          {
                            item.room
                              .name
                          }
                        </h3>

                      </div>

                      <b>
                        {wholePeso(
                          item.revenue
                        )}
                      </b>

                    </div>

                    <div className="progress">

                      <div
                        style={{
                          width:
                            `${percentage}%`,
                        }}
                      />

                    </div>

                    <div className="room-sales-meta">

                      <span>
                        {percentage}% of
                        revenue
                      </span>

                      <span>
                        {item.bookings}{' '}
                        booking
                        {item.bookings !==
                        1
                          ? 's'
                          : ''}
                      </span>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </section>

        {/* =====================================================
            ROOMS
            ===================================================== */}

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
                    {wholePeso(
                      Number(
                        room.rate || 0
                      )
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

        {/* =====================================================
            CALENDAR
            ===================================================== */}

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

        {/* =====================================================
            GCASH
            ===================================================== */}

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
                Email notifications
              </b>

              <p>
                Reservation notifications
                continue to be handled by
                your secure notification
                service.
              </p>

            </div>

          </div>

        </div>

        {/* =====================================================
            RESERVATIONS
            ===================================================== */}

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

                            {wholePeso(
                              Number(
                                r.rate_per_night ||
                                  0
                              )
                            )}

                            /night

                          </span>

                        </td>

                        <td>

                          <b>
                            {wholePeso(
                              Number(
                                r.room_total ||
                                  0
                              )
                            )}
                          </b>

                          <br />

                          Deposit{' '}
                          {wholePeso(
                            Number(
                              r.deposit ||
                                0
                            )
                          )}

                          <br />

                          Balance{' '}
                          {wholePeso(
                            Number(
                              r.balance ||
                                0
                            )
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

                        <td>

                          <span
                            className={`pill ${statusClass(
                              r.status
                            )}`}
                          >
                            {r.status}
                          </span>

                        </td>

                        <td>

                          <div className="actions luxury-actions">

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
          PRINT REPORT
          ===================================================== */}

      <div className="print-report">

        <div className="print-header">

          <div className="print-logo">
            桜
          </div>

          <h1>
            SAKURA ANANDA RESORT
          </h1>

          <p>
            PRIVATE RESORT • SALES REPORT
          </p>

        </div>

        <div className="print-report-title">

          <h2>
            {reportMode ===
            'monthly'
              ? 'Monthly Sales Report'
              : 'Annual Sales Report'}
          </h2>

          <p>

            {reportMode ===
            'monthly'
              ? formatMonth(month)
              : `January 1 – December 31, ${reportYear}`}

          </p>

          <small>
            Generated{' '}
            {new Date().toLocaleString(
              'en-PH'
            )}
          </small>

        </div>

        <div className="print-summary-grid">

          <div>
            <span>
              TOTAL REVENUE
            </span>

            <strong>
              {peso(
                reportRevenue
              )}
            </strong>
          </div>

          <div>
            <span>
              COLLECTED
            </span>

            <strong>
              {peso(
                reportCollected
              )}
            </strong>
          </div>

          <div>
            <span>
              OUTSTANDING
            </span>

            <strong>
              {peso(
                reportOutstanding
              )}
            </strong>
          </div>

          <div>
            <span>
              BOOKINGS
            </span>

            <strong>
              {reportBookings}
            </strong>
          </div>

        </div>

        <div className="print-section">

          <h3>
            Sales Summary
          </h3>

          <table>

            <tbody>

              <tr>
                <td>Total room revenue</td>
                <td>
                  {peso(
                    reportRevenue
                  )}
                </td>
              </tr>

              <tr>
                <td>Payments collected</td>
                <td>
                  {peso(
                    reportCollected
                  )}
                </td>
              </tr>

              <tr>
                <td>Outstanding balances</td>
                <td>
                  {peso(
                    reportOutstanding
                  )}
                </td>
              </tr>

              <tr>
                <td>Total bookings</td>
                <td>
                  {reportBookings}
                </td>
              </tr>

              <tr>
                <td>Average booking value</td>
                <td>
                  {peso(
                    reportAverage
                  )}
                </td>
              </tr>

            </tbody>

          </table>

        </div>

        {reportMode ===
          'annual' && (

          <div className="print-section">

            <h3>
              Monthly Revenue
            </h3>

            <table>

              <thead>

                <tr>
                  <th>Month</th>
                  <th>Bookings</th>
                  <th>Revenue</th>
                  <th>Collected</th>
                </tr>

              </thead>

              <tbody>

                {monthlySales.map(
                  item => (
                    <tr
                      key={
                        item.key
                      }
                    >

                      <td>
                        {new Date(
                          `${item.key}-01T00:00:00`
                        ).toLocaleDateString(
                          'en-US',
                          {
                            month:
                              'long',
                            year:
                              'numeric',
                          }
                        )}
                      </td>

                      <td>
                        {item.bookings}
                      </td>

                      <td>
                        {peso(
                          item.revenue
                        )}
                      </td>

                      <td>
                        {peso(
                          item.collected
                        )}
                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>

        )}

        <div className="print-section">

          <h3>
            Booking Details
          </h3>

          <table>

            <thead>

              <tr>
                <th>Booking</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Total</th>
                <th>Collected</th>
                <th>Balance</th>
              </tr>

            </thead>

            <tbody>

              {reportRows.map(
                r => (
                  <tr
                    key={
                      r.id
                    }
                  >

                    <td>
                      {r.booking_id}
                    </td>

                    <td>
                      {r.guest_name}
                    </td>

                    <td>
                      {r.room?.name ||
                        'Room'}
                    </td>

                    <td>
                      {formatDate(
                        r.check_in
                      )}
                    </td>

                    <td>
                      {formatDate(
                        r.check_out
                      )}
                    </td>

                    <td>
                      {peso(
                        reservationRevenue(
                          r
                        )
                      )}
                    </td>

                    <td>
                      {peso(
                        reservationCollected(
                          r
                        )
                      )}
                    </td>

                    <td>
                      {peso(
                        reservationOutstanding(
                          r
                        )
                      )}
                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>

        </div>

        <div className="print-footer">

          <p>
            Sakura Ananda Resort
          </p>

          <span>
            Confidential internal sales report
          </span>

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

                          {room.name} —{' '}
                          {wholePeso(
                            Number(
                              room.rate ||
                                0
                            )
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
                    {peso(
                      calculateEditTotal()
                    )}
                  </b>
                </div>

                <div>
                  <span>
                    Deposit
                  </span>

                  <b>
                    {peso(
                      Number(
                        editForm.deposit ||
                          0
                      )
                    )}
                  </b>
                </div>

                <div>
                  <span>
                    Balance
                  </span>

                  <b>
                    {peso(
                      Math.max(
                        0,
                        calculateEditTotal() -
                          Number(
                            editForm.deposit ||
                              0
                          )
                      )
                    )}
                  </b>
                </div>

              </div>

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
  --luxury-green: #58745b;
  --luxury-red: #a7584e;
  --luxury-blue: #536d80;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
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

button,
input,
select,
textarea {
  font: inherit;
}

/* ============================================================
   GENERAL
   ============================================================ */

.luxury-dashboard {
  max-width: 1500px;
  margin: 0 auto;
  padding: 38px 28px 100px;
}

.card {
  border-radius: 16px;
}

.muted {
  color: var(--luxury-muted);
}

.eyebrow {
  color: #967641;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .17em;
  text-transform: uppercase;
}

.gold-mark {
  color: var(--luxury-gold);
  font-family: Georgia, serif;
  font-size: 42px;
  margin-bottom: 8px;
}

/* ============================================================
   HEADER
   ============================================================ */

.luxury-header {
  padding: 18px 0 34px;
  border-bottom: 1px solid var(--luxury-border);
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 25px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 18px;
}

.mini-mark {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: 1px solid rgba(177,138,69,.35);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--luxury-gold);
  font-family: Georgia, serif;
  font-size: 28px;
  background: rgba(255,255,255,.45);
}

.luxury-header h1 {
  font-family: Georgia, serif;
  font-weight: 500;
  letter-spacing: -.04em;
  font-size: clamp(36px, 5vw, 58px);
  margin: 8px 0;
}

/* ============================================================
   SALES HERO
   ============================================================ */

.sales-hero {
  min-height: 250px;
  border-radius: 25px;
  padding: 38px;
  margin-bottom: 20px;

  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 30px;

  color: #fff;

  background:
    radial-gradient(
      circle at 80% 20%,
      rgba(216,189,131,.26),
      transparent 30%
    ),
    radial-gradient(
      circle at 10% 90%,
      rgba(255,255,255,.08),
      transparent 25%
    ),
    linear-gradient(
      135deg,
      #30291f,
      #4a3b27 55%,
      #76582f
    );

  box-shadow:
    0 25px 80px rgba(62,46,22,.22);

  position: relative;
  overflow: hidden;
}

.sales-hero::after {
  content: "桜";
  position: absolute;
  right: 50px;
  bottom: -65px;
  color: rgba(255,255,255,.06);
  font-family: Georgia, serif;
  font-size: 240px;
  pointer-events: none;
}

.sales-hero-copy {
  position: relative;
  z-index: 1;
}

.sales-hero-copy .eyebrow {
  color: #d8bd83;
}

.sales-hero-copy h2 {
  font-family: Georgia, serif;
  font-weight: 400;
  font-size: clamp(34px, 4vw, 52px);
  margin: 10px 0;
}

.sales-hero-copy p {
  color: rgba(255,255,255,.7);
  max-width: 540px;
  line-height: 1.7;
}

.sales-hero-total {
  position: relative;
  z-index: 1;
  min-width: 280px;
  text-align: right;
}

.sales-hero-total span {
  display: block;
  font-size: 10px;
  letter-spacing: .16em;
  color: #d8bd83;
}

.sales-hero-total strong {
  display: block;
  font-family: Georgia, serif;
  font-weight: 400;
  font-size: clamp(35px, 5vw, 58px);
  margin: 8px 0;
}

.sales-hero-total small {
  color: rgba(255,255,255,.62);
}

/* ============================================================
   SALES CARDS
   ============================================================ */

.sales-grid {
  display: grid;
  grid-template-columns:
    repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.sales-card {
  padding: 24px;
  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,.98),
      rgba(249,244,234,.95)
    );
  border: 1px solid var(--luxury-border);
  box-shadow:
    0 16px 50px rgba(70,55,30,.07);
}

.sales-card.primary {
  background:
    linear-gradient(
      135deg,
      #8b6834,
      #c39d5d
    );
  color: white;
  border: none;
}

.sales-card span {
  display: block;
  color: var(--luxury-muted);
  text-transform: uppercase;
  letter-spacing: .11em;
  font-size: 10px;
}

.sales-card.primary span {
  color: rgba(255,255,255,.72);
}

.sales-card b {
  display: block;
  font-family: Georgia, serif;
  font-weight: 500;
  font-size: 28px;
  margin: 10px 0 5px;
}

.sales-card small {
  color: var(--luxury-muted);
}

.sales-card.primary small {
  color: rgba(255,255,255,.65);
}

/* ============================================================
   QUICK STATS
   ============================================================ */

.luxury-stats {
  margin: 20px 0 42px;
}

.luxury-stat {
  position: relative;
  overflow: hidden;
  padding: 22px;
  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,.96),
      rgba(249,244,234,.94)
    );
  border: 1px solid var(--luxury-border);
  box-shadow:
    0 16px 50px rgba(70,55,30,.07);
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

/* ============================================================
   SECTION TITLES
   ============================================================ */

.section-title {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-end;
}

.luxury-section {
  margin: 42px 0 18px;
}

.luxury-section h2 {
  font-family: Georgia, serif;
  font-weight: 500;
  font-size: 30px;
  margin: 5px 0;
}

.luxury-section p {
  margin-top: 8px;
}

/* ============================================================
   ANNUAL
   ============================================================ */

.annual-summary {
  display: grid;
  grid-template-columns:
    2fr 1fr 1fr;
  gap: 14px;
}

.annual-summary .card {
  padding: 25px;
  border: 1px solid var(--luxury-border);
  background:
    linear-gradient(
      145deg,
      #fffdf8,
      #f6efe2
    );
  box-shadow:
    0 15px 45px rgba(60,45,20,.07);
}

.annual-main {
  background:
    linear-gradient(
      135deg,
      #30291f,
      #76582f
    ) !important;
  color: white;
}

.annual-summary span {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .12em;
  color: var(--luxury-muted);
}

.annual-main span {
  color: #d8bd83;
}

.annual-summary strong {
  display: block;
  font-family: Georgia, serif;
  font-weight: 400;
  font-size: 36px;
  margin: 10px 0;
}

.annual-summary b {
  display: block;
  font-family: Georgia, serif;
  font-weight: 500;
  font-size: 25px;
  margin-top: 10px;
}

.annual-summary small {
  color: var(--luxury-muted);
}

.annual-main small {
  color: rgba(255,255,255,.6);
}

/* ============================================================
   CHART
   ============================================================ */

.chart-card {
  margin-top: 14px;
  padding: 28px;
  border: 1px solid var(--luxury-border);
  background:
    linear-gradient(
      145deg,
      #fffdf9,
      #f5eee2
    );
  box-shadow:
    0 20px 60px rgba(60,45,20,.08);
}

.chart-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 25px;
}

.chart-heading h3 {
  font-family: Georgia, serif;
  font-size: 23px;
  font-weight: 500;
  margin: 5px 0 0;
}

.chart-heading > span {
  color: var(--luxury-muted);
}

.sales-chart {
  height: 330px;
  display: grid;
  grid-template-columns:
    repeat(12, minmax(30px, 1fr));
  gap: 12px;
  align-items: stretch;
  border-bottom: 1px solid var(--luxury-border);
}

.chart-column {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  min-width: 0;
}

.chart-value {
  min-height: 28px;
  font-size: 9px;
  color: #806538;
  white-space: nowrap;
  transform: rotate(-45deg);
  margin-bottom: 7px;
}

.bar-area {
  height: 230px;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: min(32px, 70%);
  min-height: 3px;
  border-radius: 8px 8px 0 0;
  background:
    linear-gradient(
      to top,
      #8c6936,
      #d0ad6b
    );
  box-shadow:
    0 6px 20px rgba(142,107,52,.18);
  transition:
    height .4s ease;
}

.chart-column > b {
  font-size: 11px;
  margin-top: 9px;
}

.chart-column > small {
  color: var(--luxury-muted);
  font-size: 8px;
  margin-top: 4px;
}

/* ============================================================
   REPORT CENTER
   ============================================================ */

.report-panel {
  padding: 24px;
  border: 1px solid var(--luxury-border);
  background:
    linear-gradient(
      145deg,
      #fffdf9,
      #f5eee2
    );
  box-shadow:
    0 18px 55px rgba(60,45,20,.08);
}

.report-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--luxury-border);
}

.report-tabs button {
  border: 0;
  background: transparent;
  padding: 12px 16px;
  cursor: pointer;
  color: var(--luxury-muted);
  border-bottom: 2px solid transparent;
}

.report-tabs button.active {
  color: #7b5b2d;
  border-bottom-color: var(--luxury-gold);
}

.report-options {
  display: grid;
  grid-template-columns:
    1.3fr 1fr 1fr 1fr auto;
  gap: 14px;
  align-items: end;
}

.report-preview {
  min-height: 68px;
  padding: 13px;
  border-radius: 10px;
  background: rgba(177,138,69,.07);
  border: 1px solid rgba(177,138,69,.12);
}

.report-preview span {
  display: block;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .09em;
  color: var(--luxury-muted);
}

.report-preview b {
  display: block;
  font-family: Georgia, serif;
  font-size: 17px;
  margin-top: 5px;
}

.report-preview small {
  display: block;
  color: var(--luxury-muted);
  margin-top: 3px;
}

/* ============================================================
   ROOM SALES
   ============================================================ */

.room-sales-grid {
  display: grid;
  grid-template-columns:
    repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.room-sales-card {
  padding: 22px;
  border: 1px solid var(--luxury-border);
  background:
    linear-gradient(
      145deg,
      #fffdf9,
      #f7f0e4
    );
  box-shadow:
    0 15px 45px rgba(60,45,20,.06);
}

.room-sales-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 15px;
}

.room-sales-top h3 {
  font-family: Georgia, serif;
  font-weight: 500;
  margin: 8px 0 0;
}

.room-sales-top > b {
  font-family: Georgia, serif;
  font-size: 17px;
  color: #7c5b2e;
}

.room-symbol {
  color: var(--luxury-gold);
  font-family: Georgia, serif;
  font-size: 22px;
}

.progress {
  height: 5px;
  border-radius: 20px;
  background: #e9dfcf;
  overflow: hidden;
  margin: 22px 0 10px;
}

.progress > div {
  height: 100%;
  background:
    linear-gradient(
      90deg,
      #8e6b34,
      #d1ae6d
    );
  border-radius: inherit;
}

.room-sales-meta {
  display: flex;
  justify-content: space-between;
  color: var(--luxury-muted);
  font-size: 10px;
}

/* ============================================================
   ROOMS
   ============================================================ */

.luxury-room {
  padding: 22px;
  transition:
    transform .2s ease,
    box-shadow .2s ease;

  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,.96),
      rgba(249,244,234,.94)
    );

  border: 1px solid var(--luxury-border);

  box-shadow:
    0 16px 50px rgba(70,55,30,.07);
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

/* ============================================================
   TABLE
   ============================================================ */

.luxury-table-wrap {
  border-radius: 18px;
  box-shadow:
    0 20px 70px rgba(60,45,20,.08);
  overflow-x: auto;
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

/* ============================================================
   BUTTONS
   ============================================================ */

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

.edit-btn {
  background: #8b6a38 !important;
  color: white !important;
}

.btn.blue {
  background: #536d80;
  color: white;
}

/* ============================================================
   CALENDAR
   ============================================================ */

.luxury-card {
  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,.96),
      rgba(249,244,234,.94)
    );
  border: 1px solid var(--luxury-border);
  box-shadow:
    0 16px 50px rgba(70,55,30,.07);
}

.calendar-wrap {
  border-radius: 18px;
}

.calendar {
  display: grid;
  grid-template-columns:
    repeat(7, 1fr);
  overflow: hidden;
}

.calendar-head {
  padding: 13px;
  text-align: center;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .1em;
  background: #eee6d5;
  color: #6d5a3c;
}

.day {
  min-height: 125px;
  padding: 9px;
  border-right: 1px solid var(--luxury-border);
  border-bottom: 1px solid var(--luxury-border);
}

.day.blank {
  background: rgba(0,0,0,.015);
}

.day-num {
  font-family: Georgia, serif;
  margin-bottom: 8px;
}

.room-dot {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 4px 0;
  font-size: 9px;
  color: var(--luxury-muted);
}

.room-dot i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d8d0c1;
}

.room-dot i.booked {
  background: #9d664f;
  box-shadow:
    0 0 0 3px rgba(157,102,79,.08);
}

/* ============================================================
   GCASH
   ============================================================ */

.settings-card {
  display: grid;
  grid-template-columns:
    1.4fr 1fr;
  gap: 25px;
  padding: 25px;
}

.luxury-qr {
  max-width: 240px;
  border-radius: 16px;
  border: 1px solid var(--luxury-border);
  box-shadow:
    0 12px 35px rgba(50,40,20,.1);
}

/* ============================================================
   LOGIN
   ============================================================ */

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

.luxury-loading {
  padding: 45px;
  text-align: center;
  background: rgba(255,255,255,.8);
}

/* ============================================================
   MODAL
   ============================================================ */

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

/* ============================================================
   PRINT REPORT
   ============================================================ */

.print-report {
  display: none;
}

/* ============================================================
   RESPONSIVE
   ============================================================ */

@media (max-width: 1150px) {

  .sales-grid {
    grid-template-columns:
      repeat(2, 1fr);
  }

  .room-sales-grid {
    grid-template-columns:
      repeat(2, 1fr);
  }

  .report-options {
    grid-template-columns:
      repeat(2, 1fr);
  }

  .report-print-btn {
    width: 100%;
  }

}

@media (max-width: 900px) {

  .luxury-dashboard {
    padding: 24px 14px 60px;
  }

  .sales-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .sales-hero-total {
    text-align: left;
  }

  .annual-summary {
    grid-template-columns: 1fr;
  }

  .settings-card {
    grid-template-columns: 1fr;
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

  .luxury-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .sales-grid {
    grid-template-columns: 1fr;
  }

  .room-sales-grid {
    grid-template-columns: 1fr;
  }

  .stats {
    grid-template-columns:
      repeat(2, 1fr);
  }

  .report-options {
    grid-template-columns: 1fr;
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

  .sales-chart {
    gap: 3px;
  }

  .chart-value {
    font-size: 7px;
  }

  .chart-column > b {
    font-size: 9px;
  }

}

/* ============================================================
   PRINT
   ============================================================ */

@media print {

  @page {
    size: A4;
    margin: 12mm;
  }

  html,
  body {
    background: white !important;
    color: #222 !important;
  }

  body * {
    visibility: hidden !important;
  }

  .print-report,
  .print-report * {
    visibility: visible !important;
  }

  .print-report {
    display: block !important;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    background: white;
    color: #222;
    font-family: Arial, sans-serif;
  }

  .print-header {
    text-align: center;
    border-bottom: 2px solid #8b6a38;
    padding-bottom: 15px;
  }

  .print-logo {
    font-family: Georgia, serif;
    color: #b18a45;
    font-size: 38px;
  }

  .print-header h1 {
    font-family: Georgia, serif;
    font-size: 22px;
    letter-spacing: .12em;
    margin: 5px 0;
  }

  .print-header p {
    font-size: 9px;
    letter-spacing: .16em;
    color: #777;
  }

  .print-report-title {
    text-align: center;
    margin: 25px 0;
  }

  .print-report-title h2 {
    font-family: Georgia, serif;
    font-weight: 400;
    font-size: 24px;
    margin: 0 0 7px;
  }

  .print-report-title p {
    margin: 0 0 5px;
    font-size: 14px;
  }

  .print-report-title small {
    color: #777;
  }

  .print-summary-grid {
    display: grid;
    grid-template-columns:
      repeat(4, 1fr);
    border: 1px solid #d7c7aa;
    margin-bottom: 25px;
  }

  .print-summary-grid > div {
    padding: 15px;
    text-align: center;
    border-right: 1px solid #d7c7aa;
  }

  .print-summary-grid > div:last-child {
    border-right: 0;
  }

  .print-summary-grid span {
    display: block;
    font-size: 8px;
    color: #777;
    letter-spacing: .1em;
  }

  .print-summary-grid strong {
    display: block;
    font-family: Georgia, serif;
    font-size: 16px;
    margin-top: 7px;
  }

  .print-section {
    margin-top: 24px;
    page-break-inside: avoid;
  }

  .print-section h3 {
    font-family: Georgia, serif;
    font-size: 16px;
    font-weight: 500;
    border-bottom: 1px solid #d7c7aa;
    padding-bottom: 7px;
  }

  .print-section table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
  }

  .print-section th {
    background: #f0e9dc;
    text-align: left;
    font-weight: 700;
  }

  .print-section th,
  .print-section td {
    padding: 7px;
    border: 1px solid #ddd;
  }

  .print-section td:not(:first-child),
  .print-section th:not(:first-child) {
    text-align: right;
  }

  .print-footer {
    margin-top: 35px;
    padding-top: 15px;
    border-top: 1px solid #d7c7aa;
    text-align: center;
    color: #777;
    font-size: 9px;
  }

  .print-footer p {
    margin: 0 0 4px;
    font-family: Georgia, serif;
    color: #555;
  }

}
`;
