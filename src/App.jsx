import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const APP_VERSION = "v1100";
const MAX_RECEIPT_SIZE_MB = 8;

const expenseCategories = [
  "Tournament",
  "League Fees",
  "Practice",
  "Food",
  "Travel",
  "Equipment",
  "Maintenance",
  "Coaching",
  "Merchandise",
  "Other",
];

const incomeSources = [
  "Tournament Winnings",
  "Side Hustle",
  "Sales",
  "Sponsorship",
  "Refund",
  "Other",
];

const performanceTypes = ["Practice", "League", "Tournament"];

const appStyles = {
  background: "linear-gradient(135deg, #0b0f2f, #0d1b4c, #001f3f, #ff6a00)",
  text: "#ffffff",
  card: "rgba(66, 120, 255, 0.20)",
  cardBorder: "rgba(255,255,255,0.14)",
  panel: "rgba(56, 106, 255, 0.24)",
  input: "rgba(11, 24, 79, 0.85)",
  accent: "#ff9560",
  accent2: "#34f0ef",
  accent3: "#7aa7ff",
  success: "#2bff66",
  danger: "#8b1e2d",
  muted: "#d8e3ff",
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function cleanText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\(/g, "-")
    .replace(/\)/g, "")
    .trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.abs(num) : 0;
}

function monthKey(dateStr) {
  if (!dateStr) return "";
  return String(dateStr).slice(0, 7);
}

function getCalendarYear(dateStr) {
  if (!dateStr) return "No Year";
  return String(dateStr).slice(0, 4);
}

function getTaxYear(dateStr) {
  if (!dateStr) return "No Year";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return getCalendarYear(dateStr);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return String(month >= 1 && month <= 12 ? year : year);
}

function normalizeDate(value) {
  if (!value) return todayString();

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const yyyy = String(parsed.y).padStart(4, "0");
      const mm = String(parsed.m).padStart(2, "0");
      const dd = String(parsed.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const tryDate = new Date(raw);
  if (!Number.isNaN(tryDate.getTime())) {
    return tryDate.toISOString().slice(0, 10);
  }

  return todayString();
}

function sameish(a, b) {
  if (!a && !b) return true;
  return String(a).trim() === String(b).trim();
}

function receiptFingerprint(receipt) {
  if (!receipt) return "";
  return String(receipt).slice(0, 120);
}

async function compressImage(file, maxWidth = 1600, quality = 0.8) {
  if (!file || !file.type?.startsWith("image/")) return null;

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", quality);
}

function calcSeriesStats(series) {
  const games = [
    Number(series.game1 || 0),
    Number(series.game2 || 0),
    Number(series.game3 || 0),
    Number(series.game4 || 0),
    Number(series.game5 || 0),
    Number(series.game6 || 0),
  ].filter((g) => g > 0);

  const total = games.reduce((sum, g) => sum + g, 0);
  const average = games.length ? (total / games.length).toFixed(1) : "0.0";
  const highGame = games.length ? Math.max(...games) : 0;

  return { games, total, average, highGame };
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escapeCell = (value) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(",")),
  ];
  return lines.join("\n");
}

function StatCard({ label, value, subValue, valueColor }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: `1px solid ${appStyles.cardBorder}`,
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        textAlign: "center",
      }}
    >
      <div style={{ color: appStyles.muted, fontWeight: 700, marginBottom: 10 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: valueColor || appStyles.text,
          marginBottom: 8,
        }}
      >
        {value}
      </div>
      <div style={{ color: appStyles.muted }}>{subValue}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 14 }}>
      <div style={{ fontSize: 24, fontWeight: 900 }}>{title}</div>
      {subtitle ? (
        <div style={{ color: appStyles.muted, marginTop: 6 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");

  const [filterMonth, setFilterMonth] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [yearMode, setYearMode] = useState("calendar");
  const [searchTerm, setSearchTerm] = useState("");

  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingIncomeId, setEditingIncomeId] = useState(null);

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [seriesList, setSeriesList] = useState([]);

  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });

  const [expenseForm, setExpenseForm] = useState({
    date: todayString(),
    category: "Tournament",
    amount: "",
    note: "",
    receipt: "",
  });

  const [incomeForm, setIncomeForm] = useState({
    date: todayString(),
    source: "Tournament Winnings",
    amount: "",
    note: "",
  });

  const [newSeries, setNewSeries] = useState({
    date: todayString(),
    house: "",
    type: "Practice",
    game1: "",
    game2: "",
    game3: "",
    game4: "",
    game5: "",
    game6: "",
    notes: "",
  });

  const importFileRef = useRef(null);

  const isPhone = screenWidth < 700;

  const buttonStyle = {
    padding: "12px 18px",
    borderRadius: 14,
    border: "none",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 16,
    boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
  };

  const inputStyle = {
    background: appStyles.input,
    color: appStyles.text,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 16,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;

    setDataLoading(true);

    const expensesQ = query(
      collection(db, "expenses"),
      where("uid", "==", user.uid),
      orderBy("date", "desc")
    );

    const incomeQ = query(
      collection(db, "income"),
      where("uid", "==", user.uid),
      orderBy("date", "desc")
    );

    const seriesQ = query(
      collection(db, "series"),
      where("uid", "==", user.uid),
      orderBy("date", "desc")
    );

    const unsubExpenses = onSnapshot(
  expensesQ,
  (snap) => {
    setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setDataLoading(false);
  },
  (error) => {
    console.error("Expenses snapshot error:", error);
    setDataLoading(false);
    showToast(`Expenses load failed: ${error.message}`, "error");
  }
);

const unsubIncome = onSnapshot(
  incomeQ,
  (snap) => {
    setIncome(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  },
  (error) => {
    console.error("Income snapshot error:", error);
    showToast(`Income load failed: ${error.message}`, "error");
  }
);

const unsubSeries = onSnapshot(
  seriesQ,
  (snap) => {
    setSeriesList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  },
  (error) => {
    console.error("Series snapshot error:", error);
    showToast(`Series load failed: ${error.message}`, "error");
  }
);

    return () => {
      unsubExpenses();
      unsubIncome();
      unsubSeries();
    };
  }, [user]);

  async function handleReceiptFile(file) {
    if (!file) return;

    const maxBytes = MAX_RECEIPT_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      showToast(
        `Receipt is too large. Keep it under ${MAX_RECEIPT_SIZE_MB} MB.`,
        "error"
      );
      return;
    }

    try {
      const compressed = await compressImage(file);
      setExpenseForm((prev) => ({ ...prev, receipt: compressed || "" }));
      showToast("Receipt added.");
    } catch (error) {
      console.error(error);
      showToast("Could not process receipt.", "error");
    }
  }

  function resetExpenseForm() {
    setExpenseForm({
      date: todayString(),
      category: "Tournament",
      amount: "",
      note: "",
      receipt: "",
    });
    setEditingExpenseId(null);
  }

  function resetIncomeForm() {
    setIncomeForm({
      date: todayString(),
      source: "Tournament Winnings",
      amount: "",
      note: "",
    });
    setEditingIncomeId(null);
  }

  function resetSeriesForm() {
    setNewSeries({
      date: todayString(),
      house: "",
      type: "Practice",
      game1: "",
      game2: "",
      game3: "",
      game4: "",
      game5: "",
      game6: "",
      notes: "",
    });
  }

  async function isDuplicateExpense(item) {
    if (!user?.uid) return false;

    const q = query(collection(db, "expenses"), where("uid", "==", user.uid));
    const snap = await getDocs(q);

    return snap.docs.some((d) => {
      const e = d.data();
      return (
        sameish(e.date, item.date) &&
        sameish(e.category, item.category) &&
        Number(e.amount || 0) === Number(item.amount || 0) &&
        sameish(cleanText(e.note), cleanText(item.note)) &&
        sameish(receiptFingerprint(e.receipt), receiptFingerprint(item.receipt))
      );
    });
  }

  async function saveExpense() {
    if (!expenseForm.amount) {
      showToast("Add an expense amount first.", "error");
      return;
    }

    const payload = {
      uid: user.uid,
      date: expenseForm.date,
      category: expenseForm.category,
      amount: Number(expenseForm.amount),
      note: expenseForm.note.trim(),
      receipt: expenseForm.receipt || "",
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingExpenseId) {
        await updateDoc(doc(db, "expenses", editingExpenseId), payload);
        showToast("Expense updated.");
      } else {
        if (payload.receipt) {
          const exists = await isDuplicateExpense(payload);
          if (exists) {
            showToast("Duplicate receipt detected. Expense not saved.", "error");
            return;
          }
        }

        await addDoc(collection(db, "expenses"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast("Expense saved.");
      }

      resetExpenseForm();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not save expense.", "error");
    }
  }

  async function saveIncome() {
    if (!incomeForm.amount) {
      showToast("Add an income amount first.", "error");
      return;
    }

    const payload = {
      uid: user.uid,
      date: incomeForm.date,
      source: incomeForm.source,
      amount: Number(incomeForm.amount),
      note: incomeForm.note.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingIncomeId) {
        await updateDoc(doc(db, "income", editingIncomeId), payload);
        showToast("Income updated.");
      } else {
        await addDoc(collection(db, "income"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast("Income saved.");
      }

      resetIncomeForm();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not save income.", "error");
    }
  }
  async function saveSeries() {
    const stats = calcSeriesStats(newSeries);

    if (!newSeries.house.trim()) {
      showToast("Add a house first.", "error");
      return;
    }

    if (stats.games.length < 1) {
      showToast("Add at least 1 game.", "error");
      return;
    }

    const payload = {
      uid: user.uid,
      date: newSeries.date,
      house: newSeries.house.trim(),
      type: newSeries.type,
      game1: Number(newSeries.game1 || 0),
      game2: Number(newSeries.game2 || 0),
      game3: Number(newSeries.game3 || 0),
      game4: Number(newSeries.game4 || 0),
      game5: Number(newSeries.game5 || 0),
      game6: Number(newSeries.game6 || 0),
      notes: newSeries.notes.trim(),
      games: stats.games,
      total: stats.total,
      average: Number(stats.average),
      highGame: stats.highGame,
      updatedAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "series"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      resetSeriesForm();
      showToast("Series saved.");
    } catch (error) {
      console.error(error);
      showToast("Could not save series.", "error");
    }
  }

  async function removeExpense(item) {
    const confirmed = window.confirm(
      `Delete expense for ${currency(item.amount)}?`
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "expenses", item.id));
      showToast("Expense deleted.");
    } catch (error) {
      console.error(error);
      showToast("Could not delete expense.", "error");
    }
  }

  async function removeIncome(item) {
    const confirmed = window.confirm(`Delete income for ${currency(item.amount)}?`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "income", item.id));
      showToast("Income deleted.");
    } catch (error) {
      console.error(error);
      showToast("Could not delete income.", "error");
    }
  }

  function exportTransactionsCsv() {
    const rows = [
      ...expenses.map((e) => ({
        Type: "Expense",
        Date: e.date,
        Category: e.category,
        Amount: Number(e.amount || 0),
        Note: e.note,
      })),
      ...income.map((i) => ({
        Type: "Income",
        Date: i.date,
        Category: i.source,
        Amount: Number(i.amount || 0),
        Note: i.note,
      })),
    ].sort((a, b) => String(b.Date).localeCompare(String(a.Date)));

    const csv = toCsv(rows);
    downloadTextFile("transactions.csv", csv);
  }

  function exportTaxSummaryCsv() {
    const grouped = {};
    expenses.forEach((e) => {
      const key = e.category || "Other";
      grouped[key] = (grouped[key] || 0) + Number(e.amount || 0);
    });

    const rows = Object.entries(grouped).map(([category, total]) => ({
      Category: category,
      Total: total,
    }));

    const csv = toCsv(rows);
    downloadTextFile("tax-summary.csv", csv);
  }

  function handleImportFile(file) {
    if (!file || !user) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
const sheet = workbook.Sheets["All Business Expenses"];
const rows = XLSX.utils.sheet_to_json(sheet);

let added = 0;
let skipped = 0;

for (const row of rows) {
  const payload = {
    uid: user.uid,
    date: normalizeDate(row["Date"]),
    category: row["Schedule C category"] || "Other",
    amount: Math.abs(
      Number(String(row["Expense amount"] || 0).replace(/[$,]/g, ""))
    ),
    note: [
      row["Merchant"],
      row["Expense category subtype"],
      row["Notes"],
    ]
      .filter(Boolean)
      .join(" - "),
    receipt: "",
    updatedAt: serverTimestamp(),
  };

  if (!payload.amount) {
    skipped++;
    continue;
  }

  const exists = await isDuplicateExpense(payload);
  if (exists) {
    skipped++;
  } else {
    await addDoc(collection(db, "expenses"), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    added++;
  }
}

        showToast(`Imported ${added}, skipped ${skipped} duplicates.`);
      } catch (err) {
        console.error(err);
        showToast("Import failed.", "error");
      }
    };

    reader.readAsArrayBuffer(file);
  }

  const months = useMemo(() => {
    const set = new Set([
      ...expenses.map((e) => monthKey(e.date)),
      ...income.map((i) => monthKey(i.date)),
    ]);
    return Array.from(set).filter(Boolean).sort((a, b) => b.localeCompare(a));
  }, [expenses, income]);

  const years = useMemo(() => {
    const set = new Set([
      ...expenses.map((e) =>
        yearMode === "tax" ? getTaxYear(e.date) : getCalendarYear(e.date)
      ),
      ...income.map((i) =>
        yearMode === "tax" ? getTaxYear(i.date) : getCalendarYear(i.date)
      ),
      ...seriesList.map((s) =>
        yearMode === "tax" ? getTaxYear(s.date) : getCalendarYear(s.date)
      ),
    ]);
    return Array.from(set).filter(Boolean).sort((a, b) => b.localeCompare(a));
  }, [expenses, income, seriesList, yearMode]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const matchesMonth =
        filterMonth === "all" || monthKey(item.date) === filterMonth;
      const matchesCategory =
        filterCategory === "all" || item.category === filterCategory;
      const itemYear =
        yearMode === "tax" ? getTaxYear(item.date) : getCalendarYear(item.date);
      const matchesYear = filterYear === "all" || itemYear === filterYear;
      const matchesSearch =
        !searchTerm ||
        `${item.category} ${item.note} ${item.amount}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      return matchesMonth && matchesCategory && matchesYear && matchesSearch;
    });
  }, [expenses, filterMonth, filterCategory, filterYear, yearMode, searchTerm]);

  const filteredIncome = useMemo(() => {
    return income.filter((item) => {
      const matchesMonth =
        filterMonth === "all" || monthKey(item.date) === filterMonth;
      const itemYear =
        yearMode === "tax" ? getTaxYear(item.date) : getCalendarYear(item.date);
      const matchesYear = filterYear === "all" || itemYear === filterYear;
      const matchesSearch =
        !searchTerm ||
        `${item.source} ${item.note} ${item.amount}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      return matchesMonth && matchesYear && matchesSearch;
    });
  }, [income, filterMonth, filterYear, yearMode, searchTerm]);

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [filteredExpenses]
  );
  const totalIncome = useMemo(
    () => filteredIncome.reduce((sum, i) => sum + Number(i.amount || 0), 0),
    [filteredIncome]
  );
  const profit = totalIncome - totalExpenses;

  const activityItems = useMemo(() => {
    const list = [
      ...filteredExpenses.map((e) => ({
        id: e.id,
        type: "Expense",
        title: e.category,
        date: e.date,
        note: e.note,
        amount: -Math.abs(Number(e.amount || 0)),
      })),
      ...filteredIncome.map((i) => ({
        id: i.id,
        type: "Income",
        title: i.source,
        date: i.date,
        note: i.note,
        amount: Math.abs(Number(i.amount || 0)),
      })),
    ];

    return list
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 8);
  }, [filteredExpenses, filteredIncome]);

  const receiptItems = useMemo(() => {
    return filteredExpenses.filter((e) => e.receipt).slice(0, 12);
  }, [filteredExpenses]);

  const performanceSummary = useMemo(() => {
    const allGames = seriesList.flatMap((s) => s.games || []);
    return {
      totalSeries: seriesList.length,
      bestSeries: seriesList.length
        ? Math.max(...seriesList.map((s) => Number(s.total || 0)))
        : 0,
      bestGame: allGames.length ? Math.max(...allGames) : 0,
      overallAverage: allGames.length
        ? (
            allGames.reduce((sum, g) => sum + Number(g || 0), 0) / allGames.length
          ).toFixed(1)
        : "0.0",
    };
  }, [seriesList]);
  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: appStyles.background,
          color: appStyles.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          fontWeight: 800,
        }}
      >
        Loading Ten Back Precision...
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: appStyles.background,
          color: appStyles.text,
          fontFamily: "Inter, Arial, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            width: 460,
            maxWidth: "100%",
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: `1px solid ${appStyles.cardBorder}`,
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>
            🎳 TEN BACK PRECISION {APP_VERSION}
          </div>
          <div style={{ color: appStyles.muted, marginBottom: 18 }}>
            Bowling LLC tracker for expenses, income, receipts, reports, and performance.
          </div>

          <input
            type="email"
            placeholder="Email"
            value={authForm.email}
            onChange={(e) =>
              setAuthForm({ ...authForm, email: e.target.value })
            }
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          <input
            type="password"
            placeholder="Password"
            value={authForm.password}
            onChange={(e) =>
              setAuthForm({ ...authForm, password: e.target.value })
            }
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          <button
            onClick={async () => {
              try {
                if (authMode === "signin") {
                  await signInWithEmailAndPassword(
                    auth,
                    authForm.email,
                    authForm.password
                  );
                  showToast("Signed in.");
                } else {
                  await createUserWithEmailAndPassword(
                    auth,
                    authForm.email,
                    authForm.password
                  );
                  showToast("Account created.");
                }
              } catch (error) {
                console.error(error);
                showToast(error.message || "Authentication failed", "error");
              }
            }}
            style={{
              ...buttonStyle,
              width: "100%",
              background: appStyles.accent,
              color: "#231528",
              marginBottom: 12,
            }}
          >
            {authMode === "signin" ? "Sign In" : "Sign Up"}
          </button>

          <button
            onClick={() =>
              setAuthMode(authMode === "signin" ? "signup" : "signin")
            }
            style={{
              ...buttonStyle,
              width: "100%",
              background: "rgba(255,255,255,0.12)",
              color: appStyles.text,
            }}
          >
            Switch to {authMode === "signin" ? "Sign Up" : "Sign In"}
          </button>
        </div>
      </div>
    );
  }

  if (activeView === "performance") {
    const sortedSeries = [...seriesList].sort((a, b) =>
      String(b.date).localeCompare(String(a.date))
    );

    return (
      <div
        style={{
          minHeight: "100vh",
          background: appStyles.background,
          color: appStyles.text,
          padding: 20,
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 44, fontWeight: 900 }}>🎳 Performance</div>
            <div style={{ color: appStyles.muted, marginTop: 6 }}>
              Track houses, games, and series without junk-drawering the money side.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setActiveView("dashboard")}
              style={{
                ...buttonStyle,
                background: appStyles.accent,
                color: "#1a1633",
              }}
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={() => setActiveView("receipts")}
              style={{
                ...buttonStyle,
                background: "rgba(255,255,255,0.12)",
                color: appStyles.text,
              }}
            >
              Receipts
            </button>

            <button
              type="button"
              onClick={() => signOut(auth)}
              style={{
                ...buttonStyle,
                background: "rgba(255,255,255,0.12)",
                color: appStyles.text,
              }}
            >
              Log Out
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isPhone ? "1fr" : "repeat(4, minmax(0, 1fr))",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <StatCard
            label="Series Logged"
            value={String(performanceSummary.totalSeries)}
            subValue="Tracked and ready"
          />
          <StatCard
            label="Overall Avg"
            value={String(performanceSummary.overallAverage)}
            subValue="Across all saved games"
          />
          <StatCard
            label="Best Series"
            value={String(performanceSummary.bestSeries)}
            subValue="Highest total"
          />
          <StatCard
            label="Best Game"
            value={String(performanceSummary.bestGame)}
            subValue="High score"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isPhone ? "1fr" : "repeat(2, minmax(0, 1fr))",
            gap: 18,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: `1px solid ${appStyles.cardBorder}`,
              borderRadius: 18,
              padding: 18,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            }}
          >
            <SectionTitle
              title="Add Series"
              subtitle="House, event type, games, and notes"
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isPhone ? "1fr" : "repeat(2, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <input
                type="date"
                value={newSeries.date}
                onChange={(e) =>
                  setNewSeries((prev) => ({ ...prev, date: e.target.value }))
                }
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="House"
                value={newSeries.house}
                onChange={(e) =>
                  setNewSeries((prev) => ({ ...prev, house: e.target.value }))
                }
                style={inputStyle}
              />

              <select
                value={newSeries.type}
                onChange={(e) =>
                  setNewSeries((prev) => ({ ...prev, type: e.target.value }))
                }
                style={inputStyle}
              >
                {performanceTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>

              <div />

              {["game1", "game2", "game3", "game4", "game5", "game6"].map(
                (field, index) => (
                  <input
                    key={field}
                    type="number"
                    placeholder={`Game ${index + 1}`}
                    value={newSeries[field]}
                    onChange={(e) =>
                      setNewSeries((prev) => ({
                        ...prev,
                        [field]: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                )
              )}

              <textarea
                placeholder="Notes"
                rows={4}
                value={newSeries.notes}
                onChange={(e) =>
                  setNewSeries((prev) => ({ ...prev, notes: e.target.value }))
                }
                style={{
                  ...inputStyle,
                  gridColumn: "1 / -1",
                  resize: "vertical",
                }}
              />

              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={saveSeries}
                  style={{
                    ...buttonStyle,
                    background: appStyles.accent2,
                    color: "#06203a",
                  }}
                >
                  Save Series
                </button>

                <button
                  type="button"
                  onClick={resetSeriesForm}
                  style={{
                    ...buttonStyle,
                    background: "rgba(255,255,255,0.12)",
                    color: appStyles.text,
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: `1px solid ${appStyles.cardBorder}`,
              borderRadius: 18,
              padding: 18,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            }}
          >
            <SectionTitle
              title="Recent Series"
              subtitle="Latest saved house and score data"
            />

            {sortedSeries.length === 0 ? (
              <div style={{ color: appStyles.muted, textAlign: "center" }}>
                No series yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {sortedSeries.slice(0, 10).map((series) => (
                  <div
                    key={series.id}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${appStyles.cardBorder}`,
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{series.house}</div>
                      <div style={{ color: appStyles.muted }}>{series.date}</div>
                    </div>

                    <div style={{ marginTop: 6, color: appStyles.muted }}>
                      {series.type}
                    </div>

                    <div style={{ marginTop: 8 }}>
                      Games: {(series.games || []).join(" / ")}
                    </div>

                    <div style={{ marginTop: 8 }}>
                      Total: <strong>{series.total}</strong> · Avg:{" "}
                      <strong>{series.average}</strong> · High Game:{" "}
                      <strong>{series.highGame}</strong>
                    </div>

                    {series.notes ? (
                      <div style={{ marginTop: 8, color: appStyles.muted }}>
                        {series.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {toast ? (
          <div
            style={{
              position: "fixed",
              bottom: 18,
              left: "50%",
              transform: "translateX(-50%)",
              background:
                toast.type === "error" ? "#c62828" : "rgba(0,0,0,0.75)",
              color: "#fff",
              padding: "12px 18px",
              borderRadius: 14,
              zIndex: 50,
              fontWeight: 700,
            }}
          >
            {toast.message}
          </div>
        ) : null}
      </div>
    );
  }

  if (activeView === "receipts") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: appStyles.background,
          color: appStyles.text,
          padding: 20,
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 42, fontWeight: 900 }}>Receipts</div>
            <div style={{ color: appStyles.muted, marginTop: 6 }}>
              Receipt gallery and quick preview
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveView("dashboard")}
              style={{
                ...buttonStyle,
                background: appStyles.accent,
                color: "#1a1633",
              }}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveView("performance")}
              style={{
                ...buttonStyle,
                background: "rgba(255,255,255,0.12)",
                color: appStyles.text,
              }}
            >
              Performance
            </button>
            <button
              onClick={() => signOut(auth)}
              style={{
                ...buttonStyle,
                background: "rgba(255,255,255,0.12)",
                color: appStyles.text,
              }}
            >
              Log Out
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isPhone ? "1fr" : "repeat(2, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          {receiptItems.length === 0 ? (
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${appStyles.cardBorder}`,
                borderRadius: 18,
                padding: 18,
              }}
            >
              No receipts yet.
            </div>
          ) : (
            receiptItems.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${appStyles.cardBorder}`,
                  borderRadius: 18,
                  padding: 18,
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <img
                  src={item.receipt}
                  alt="Receipt"
                  style={{
                    width: 80,
                    height: 80,
                    objectFit: "cover",
                    borderRadius: 10,
                    background: "#fff",
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{item.category}</div>
                  <div style={{ color: appStyles.muted, marginTop: 4 }}>
                    {item.date}
                  </div>
                  <div style={{ marginTop: 4 }}>{currency(item.amount)}</div>
                </div>
                <button
                  onClick={() => setSelectedReceipt(item.receipt)}
                  style={{
                    ...buttonStyle,
                    background: appStyles.accent2,
                    color: "#06203a",
                  }}
                >
                  View
                </button>
              </div>
            ))
          )}
        </div>

        {selectedReceipt ? (
          <div
            onClick={() => setSelectedReceipt(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 100,
            }}
          >
            <img
              src={selectedReceipt}
              alt="Receipt full"
              style={{
                maxWidth: "90vw",
                maxHeight: "90vh",
                borderRadius: 14,
                background: "#fff",
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: appStyles.background,
        color: appStyles.text,
        padding: 20,
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ fontSize: isPhone ? 34 : 52, fontWeight: 900, lineHeight: 1 }}>
            🎳 TEN BACK PRECISION {APP_VERSION}
          </div>
          <div style={{ color: appStyles.muted, marginTop: 8, fontSize: 16 }}>
            Bowling LLC tracker for expenses, income, receipts, and reports.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveView("dashboard")}
            style={{
              ...buttonStyle,
              background: activeView === "dashboard" ? appStyles.accent : "rgba(255,255,255,0.12)",
              color: activeView === "dashboard" ? "#1a1633" : appStyles.text,
            }}
          >
            Dashboard
          </button>

          <button
            onClick={() => setActiveView("receipts")}
            style={{
              ...buttonStyle,
              background: "rgba(255,255,255,0.12)",
              color: appStyles.text,
            }}
          >
            Receipts
          </button>

          <button
            onClick={() => setActiveView("performance")}
            style={{
              ...buttonStyle,
              background: "rgba(255,255,255,0.12)",
              color: appStyles.text,
            }}
          >
            Performance
          </button>

          <button
            onClick={() => signOut(auth)}
            style={{
              ...buttonStyle,
              background: "rgba(255,255,255,0.12)",
              color: appStyles.text,
            }}
          >
            Log Out
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isPhone ? "1fr" : "repeat(4, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <StatCard
          label="Income"
          value={currency(totalIncome)}
          subValue={`${filteredIncome.length} income items`}
        />
        <StatCard
          label="Expenses"
          value={currency(totalExpenses)}
          subValue={`${filteredExpenses.length} expense items`}
        />
        <StatCard
          label="Net Profit"
          value={currency(profit)}
          subValue={profit >= 0 ? "Looking sharp." : "Lane fees are swinging heavy."}
          valueColor={profit >= 0 ? appStyles.success : appStyles.danger}
        />
        <StatCard
          label="Receipts Uploaded"
          value={String(receiptItems.length)}
          subValue="Tracked and ready"
        />
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${appStyles.cardBorder}`,
          borderRadius: 18,
          padding: 18,
          marginBottom: 18,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        }}
      >
        <SectionTitle
          title="Quick Actions"
          subtitle="Add income, expenses, receipts, and imports without hunting through menus."
        />

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            style={{ ...buttonStyle, background: appStyles.accent, color: "#1a1633" }}
            onClick={() => {
              document.getElementById("expense-form")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Add Expense
          </button>

          <button
            type="button"
            style={{ ...buttonStyle, background: appStyles.accent2, color: "#06203a" }}
            onClick={() => {
              document.getElementById("income-form")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Add Income
          </button>

          <label
            style={{
              ...buttonStyle,
              background: "rgba(255,255,255,0.12)",
              color: appStyles.text,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Upload Receipt
            <input
              type="file"
              accept="image/*"
              capture={false}
              style={{ display: "none" }}
              onChange={(e) => handleReceiptFile(e.target.files?.[0])}
            />
          </label>

          <button
            type="button"
            onClick={exportTransactionsCsv}
            style={{
              ...buttonStyle,
              background: "rgba(255,255,255,0.12)",
              color: appStyles.text,
            }}
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={exportTaxSummaryCsv}
            style={{
              ...buttonStyle,
              background: "rgba(255,255,255,0.12)",
              color: appStyles.text,
            }}
          >
            Tax Summary
          </button>

          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            style={{
              ...buttonStyle,
              background: appStyles.accent2,
              color: "#06203a",
            }}
          >
            Import Other Excel
          </button>

          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => handleImportFile(e.target.files?.[0])}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isPhone ? "1fr" : "repeat(5, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            style={inputStyle}
          >
            <option value="all">All Months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={inputStyle}
          >
            <option value="all">All Categories</option>
            {expenseCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <select
            value={yearMode}
            onChange={(e) => setYearMode(e.target.value)}
            style={inputStyle}
          >
            <option value="calendar">Calendar Year</option>
            <option value="tax">Tax Year</option>
          </select>

          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            style={inputStyle}
          >
            <option value="all">All Years</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>

          <input
            placeholder="Search notes, categories, amounts"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isPhone ? "1fr" : "repeat(2, minmax(0, 1fr))",
          gap: 18,
          marginBottom: 18,
        }}
      >
        <div
          id="expense-form"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: `1px solid ${appStyles.cardBorder}`,
            borderRadius: 18,
            padding: 18,
          }}
        >
          <SectionTitle title="Add Expense" subtitle={`Attach Receipt (${MAX_RECEIPT_SIZE_MB} MB max)`} />

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
              <input
                type="date"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))}
                style={inputStyle}
              />
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
                style={inputStyle}
              >
                {expenseCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
              <input
                type="number"
                placeholder="Amount"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                style={inputStyle}
              />

              <label
                style={{
                  ...inputStyle,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  background: "linear-gradient(135deg, #9ee7ff, #bdf5ff)",
                  color: "#18345a",
                  fontWeight: 800,
                }}
              >
                {expenseForm.receipt ? "Receipt Attached" : `Attach Receipt (${MAX_RECEIPT_SIZE_MB} MB max)`}
                <input
                  type="file"
                  accept="image/*"
                  capture={false}
                  style={{ display: "none" }}
                  onChange={(e) => handleReceiptFile(e.target.files?.[0])}
                />
              </label>
            </div>

            <textarea
              placeholder="Notes"
              rows={4}
              value={expenseForm.note}
              onChange={(e) => setExpenseForm((prev) => ({ ...prev, note: e.target.value }))}
              style={{ ...inputStyle, resize: "vertical" }}
            />

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={saveExpense}
                style={{
                  ...buttonStyle,
                  background: appStyles.accent,
                  color: "#1a1633",
                }}
              >
                {editingExpenseId ? "Update Expense" : "Save Expense"}
              </button>

              <button
                onClick={resetExpenseForm}
                style={{
                  ...buttonStyle,
                  background: "rgba(255,255,255,0.12)",
                  color: appStyles.text,
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div
          id="income-form"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: `1px solid ${appStyles.cardBorder}`,
            borderRadius: 18,
            padding: 18,
          }}
        >
          <SectionTitle title="Add Income" subtitle="Track winnings, sponsorships, sales, and side money" />

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
              <input
                type="date"
                value={incomeForm.date}
                onChange={(e) => setIncomeForm((prev) => ({ ...prev, date: e.target.value }))}
                style={inputStyle}
              />
              <select
                value={incomeForm.source}
                onChange={(e) => setIncomeForm((prev) => ({ ...prev, source: e.target.value }))}
                style={inputStyle}
              >
                {incomeSources.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <input
              type="number"
              placeholder="Amount"
              value={incomeForm.amount}
              onChange={(e) => setIncomeForm((prev) => ({ ...prev, amount: e.target.value }))}
              style={inputStyle}
            />

            <textarea
              placeholder="Notes"
              rows={4}
              value={incomeForm.note}
              onChange={(e) => setIncomeForm((prev) => ({ ...prev, note: e.target.value }))}
              style={{ ...inputStyle, resize: "vertical" }}
            />

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={saveIncome}
                style={{
                  ...buttonStyle,
                  background: appStyles.accent2,
                  color: "#06203a",
                }}
              >
                {editingIncomeId ? "Update Income" : "Save Income"}
              </button>

              <button
                onClick={resetIncomeForm}
                style={{
                  ...buttonStyle,
                  background: "rgba(255,255,255,0.12)",
                  color: appStyles.text,
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isPhone ? "1fr" : "repeat(2, minmax(0, 1fr))",
          gap: 18,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${appStyles.cardBorder}`,
            borderRadius: 18,
            padding: 18,
          }}
        >
          <SectionTitle
            title="Recent Activity"
            subtitle="Latest movement across income and expenses."
          />

          {activityItems.length === 0 ? (
            <div style={{ color: appStyles.muted, textAlign: "center" }}>
              No activity yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {activityItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${appStyles.cardBorder}`,
                    borderRadius: 14,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div style={{ color: appStyles.muted, fontSize: 14 }}>
                      {item.type} • {item.date}
                    </div>
                    {item.note ? <div style={{ marginTop: 6 }}>{item.note}</div> : null}
                  </div>
                  <div
                    style={{
                      fontWeight: 900,
                      color: item.amount >= 0 ? appStyles.success : "#ff8a8a",
                    }}
                  >
                    {currency(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${appStyles.cardBorder}`,
            borderRadius: 18,
            padding: 18,
          }}
        >
          <SectionTitle
            title="Receipts Snapshot"
            subtitle="Newest receipt-backed expenses."
          />

          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <button
              onClick={() => setActiveView("receipts")}
              style={{
                ...buttonStyle,
                background: "rgba(255,255,255,0.12)",
                color: appStyles.text,
              }}
            >
              Open Gallery
            </button>
          </div>

          {receiptItems.length === 0 ? (
            <div style={{ color: appStyles.muted, textAlign: "center" }}>
              No receipts yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {receiptItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${appStyles.cardBorder}`,
                    borderRadius: 14,
                    padding: 12,
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <img
                    src={item.receipt}
                    alt="Receipt"
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: "cover",
                      borderRadius: 10,
                      background: "#fff",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{item.category}</div>
                    <div style={{ color: appStyles.muted }}>{item.date}</div>
                  </div>
                  <button
                    onClick={() => setSelectedReceipt(item.receipt)}
                    style={{
                      ...buttonStyle,
                      background: appStyles.accent2,
                      color: "#06203a",
                    }}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isPhone ? "1fr" : "repeat(2, minmax(0, 1fr))",
          gap: 18,
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${appStyles.cardBorder}`,
            borderRadius: 18,
            padding: 18,
          }}
        >
          <SectionTitle
            title="Expense Entries"
            subtitle="Edit or delete while hunting through fewer menus."
          />

          {filteredExpenses.length === 0 ? (
            <div style={{ color: appStyles.muted, textAlign: "center" }}>
              No expenses found.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filteredExpenses.slice(0, 20).map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${appStyles.cardBorder}`,
                    borderRadius: 14,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800 }}>{item.category}</div>
                      <div style={{ color: appStyles.muted, fontSize: 14 }}>
                        {item.date}
                      </div>
                    </div>
                    <div style={{ fontWeight: 900 }}>{currency(item.amount)}</div>
                  </div>

                  {item.note ? <div style={{ marginTop: 8 }}>{item.note}</div> : null}

                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        setEditingExpenseId(item.id);
                        setExpenseForm({
                          date: item.date || todayString(),
                          category: item.category || "Tournament",
                          amount: String(item.amount || ""),
                          note: item.note || "",
                          receipt: item.receipt || "",
                        });
                        document.getElementById("expense-form")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      style={{
                        ...buttonStyle,
                        background: appStyles.accent,
                        color: "#1a1633",
                        padding: "8px 12px",
                      }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => removeExpense(item)}
                      style={{
                        ...buttonStyle,
                        background: "#ff6b6b",
                        color: "#fff",
                        padding: "8px 12px",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${appStyles.cardBorder}`,
            borderRadius: 18,
            padding: 18,
          }}
        >
          <SectionTitle
            title="Income Entries"
            subtitle="Track winnings, side money, and other incoming dollars."
          />

          {filteredIncome.length === 0 ? (
            <div style={{ color: appStyles.muted, textAlign: "center" }}>
              No income found.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filteredIncome.slice(0, 20).map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${appStyles.cardBorder}`,
                    borderRadius: 14,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800 }}>{item.source}</div>
                      <div style={{ color: appStyles.muted, fontSize: 14 }}>
                        {item.date}
                      </div>
                    </div>
                    <div style={{ fontWeight: 900, color: appStyles.success }}>
                      {currency(item.amount)}
                    </div>
                  </div>

                  {item.note ? <div style={{ marginTop: 8 }}>{item.note}</div> : null}

                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        setEditingIncomeId(item.id);
                        setIncomeForm({
                          date: item.date || todayString(),
                          source: item.source || "Tournament Winnings",
                          amount: String(item.amount || ""),
                          note: item.note || "",
                        });
                        document.getElementById("income-form")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      style={{
                        ...buttonStyle,
                        background: appStyles.accent2,
                        color: "#06203a",
                        padding: "8px 12px",
                      }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => removeIncome(item)}
                      style={{
                        ...buttonStyle,
                        background: "#ff6b6b",
                        color: "#fff",
                        padding: "8px 12px",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedReceipt ? (
        <div
          onClick={() => setSelectedReceipt(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 100,
          }}
        >
          <img
            src={selectedReceipt}
            alt="Receipt full"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              borderRadius: 14,
              background: "#fff",
            }}
          />
        </div>
      ) : null}

      {toast ? (
        <div
          style={{
            position: "fixed",
            bottom: 18,
            left: "50%",
            transform: "translateX(-50%)",
            background:
              toast.type === "error" ? "#c62828" : "rgba(0,0,0,0.75)",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 14,
            zIndex: 50,
            fontWeight: 700,
          }}
        >
          {toast.message}
        </div>
      ) : null}

      {dataLoading ? (
        <div
          style={{
            position: "fixed",
            top: 18,
            right: 18,
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 700,
          }}
        >
          Syncing data...
        </div>
      ) : null}
    </div>
  );
}