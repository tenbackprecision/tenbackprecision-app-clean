import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
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
import heic2any from "heic2any";
import SessionIntelModal from "./components/SessionIntelModal";
import AddSeriesForm from "./components/AddSeriesForm";

const APP_VERSION = "v1131 - Floating action button";
const MAX_RECEIPT_SIZE_MB = 8;

const expenseCategories = [
  "Tournament",
  "League Fees",
  "Practice",
  "Food",
  "Travel",
  "Equipment",
  "Maintenance",
  "Merchandise",
  "Other",
];

const incomeSources = [
  "Tournament Winnings",
  "Side Hustle",
  "Sales",
  "Refund",
  "Other",
];

const performanceTypes = ["Practice", "League", "Tournament", "9 Pin"];

const appStyles = {
  background:
    "radial-gradient(circle at top left, #1e1b4b 0%, #0b1020 35%, #050816 100%)",

  text: "#f8fbff",

  card: "rgba(255,255,255,0.08)",

  cardBorder: "rgba(255,255,255,0.14)",

  panel: "rgba(255,255,255,0.05)",

  input: "rgba(15, 23, 42, 0.85)",

  accent: "#38bdf8",

  accent2: "#7c3aed",

  success: "#22c55e",

  danger: "#ff5c7a",

  muted: "#a9b8d4",

  glowBlue: "0 0 18px rgba(56,189,248,0.35)",

  glowPurple: "0 0 18px rgba(124,58,237,0.35)",

  glowOrange: "0 0 18px rgba(255,140,66,0.35)",
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

function normalizeBowlrDate(value) {
  if (!value) return todayString();

  const raw = String(value).trim();

  // Bowlr format: 2026-07-02 20:57:00.000
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  return normalizeDate(value);
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
        background: appStyles.card,
border: `1px solid ${appStyles.cardBorder}`,
borderRadius: 24,
backdropFilter: "blur(18px)",
WebkitBackdropFilter: "blur(18px)",
boxShadow: appStyles.glowBlue,
padding: 18,
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
        <div style={{ color: "#dbeafe", marginTop: 6 }}>{subtitle}</div>
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
  const [showHouseAverages, setShowHouseAverages] = useState(false);
  const [showAllHouseAverages, setShowAllHouseAverages] = useState(false);
  const [expandedSeriesScores, setExpandedSeriesScores] = useState({});
  const [showAllRecentSeries, setShowAllRecentSeries] = useState(false);
  const [expandedSeries, setExpandedSeries] = useState({});
const [showAllRecentActivity, setShowAllRecentActivity] = useState(false);
const [showAllExpenses, setShowAllExpenses] = useState(false);
const [showAllIncome, setShowAllIncome] = useState(false);
const [showAllReceipts, setShowAllReceipts] = useState(false);
const [selectedSessionIntel, setSelectedSessionIntel] = useState(null);
const [equipment, setEquipment] = useState([]);
const [showEquipmentManager, setShowEquipmentManager] = useState(false);
const [showQuickPerformanceStats, setShowQuickPerformanceStats] = useState(false);
const [showPersonalRecords, setShowPersonalRecords] = useState(false);
const [showAchievementTracker, setShowAchievementTracker] = useState(false);
const [showBowlrImport, setShowBowlrImport] = useState(false);
const [showFabMenu, setShowFabMenu] = useState(false);


const [chartRange, setChartRange] = useState("12m");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [yearMode, setYearMode] = useState("calendar");
  const [searchTerm, setSearchTerm] = useState("");
  const [receiptYear, setReceiptYear] = useState("all");
  const [receiptCategory, setReceiptCategory] = useState("all");
  const [receiptSearch, setReceiptSearch] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingIncomeId, setEditingIncomeId] = useState(null);

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const [editingSeriesId, setEditingSeriesId] = useState(null);
  const addSeriesRef = useRef(null);
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

const emptyEquipmentForm = {
  name: "",
  manufacturer: "",
  weight: "",
  core: "",
  coverstock: "",
  finish: "",
  surface: "",
  layout: "",
  purchaseDate: "",
  status: "Active",
  image: "",
};

const [equipmentForm, setEquipmentForm] = useState(emptyEquipmentForm);

const [editingEquipmentId, setEditingEquipmentId] = useState(null);

  const [perfFilters, setPerfFilters] = useState({
  house: "All",
  event: "All",
  year: String(new Date().getFullYear()),
  startDate: "",
  endDate: "",
});

const performanceHouses = [
  "All",
  ...new Set(seriesList.map((item) => item.house).filter(Boolean)),
];

const performanceEvents = [
  "All",
  ...new Set(seriesList.map((item) => item.type || item.event).filter(Boolean)),
];

const equipmentOptions = useMemo(
  () =>
    equipment
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name)),
  [equipment]
);

const filteredSeries = seriesList.filter((item) => {
  const itemEvent = item.type || item.event;

  const matchesHouse =
    perfFilters.house === "All" || item.house === perfFilters.house;

  const matchesEvent =
    perfFilters.event === "All" || itemEvent === perfFilters.event;

  const matchesStart =
    !perfFilters.startDate ||
    new Date(item.date) >= new Date(perfFilters.startDate);

  const matchesEnd =
    !perfFilters.endDate ||
    new Date(item.date) <= new Date(perfFilters.endDate);

const selectedYear = String(perfFilters.year || "").toLowerCase();
const itemYear = new Date(item.date).getFullYear().toString();

const matchesYear =
  selectedYear === "all" ||
  selectedYear === "all years" ||
  itemYear === String(perfFilters.year);

  return matchesHouse && matchesEvent && matchesStart && matchesEnd && matchesYear;
});

  const [newSeries, setNewSeries] = useState({
  date: todayString(),
  house: "",
  type: "Practice",
  games: ["", "", ""],
  gameLayouts: [
  { feet: "", target: "", breakpoint: "" },
  { feet: "", target: "", breakpoint: "" },
  { feet: "", target: "", breakpoint: "" },
],
  oilPattern: "",

  primaryBall: "",
  primaryBallId: "",

  secondaryBall: "",
  secondaryBallId: "",

  feet: "",
  target: "",
  breakpoint: "",
  surface: "",
  transitionNote: "",
  notes: "",
  pinLayout: [],
boardLayout: {
  feet: "",
  target: "",
  breakpoint: "",
},
});

  const importFileRef = useRef(null);

  const [bowlrPreview, setBowlrPreview] = useState(null);
  const bowlrImportRef = useRef(null);

  const isPhone = screenWidth < 700;

  const isFoldable = screenWidth >= 700 && screenWidth < 1100;


  const buttonStyle = {
  padding: "12px 18px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 16,
  boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
  transition: "all 0.2s ease",
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

const equipmentQ = query(
  collection(db, "equipment"),
  where("uid", "==", user.uid),
  orderBy("name", "asc")
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

const unsubEquipment = onSnapshot(
  equipmentQ,
  (snap) => {
    setEquipment(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  },
  (error) => {
    console.error("Equipment snapshot error:", error);
    showToast(`Equipment load failed: ${error.message}`, "error");
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
  unsubEquipment();
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

let receiptData = "";

try {
  if (
  file.type === "image/heic" ||
  file.type === "image/heif" ||
  file.name?.toLowerCase().endsWith(".heic") ||
  file.name?.toLowerCase().endsWith(".heif")
) {
  const convertedBlob = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.8,
  });

  file = new File(
    [Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob],
    "receipt.jpg",
    {
      type: "image/jpeg",
    }
  );
}

  receiptData = await compressImage(file);
} catch (compressError) {
  console.error("Compression failed:", compressError);
}

if (!receiptData) {
  receiptData = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

setExpenseForm((prev) => ({ ...prev, receipt: receiptData || "" }));
showToast("Receipt added.");

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
    games: ["", "", ""],
    gameLayouts: [
  { feet: "", target: "", breakpoint: "" },
  { feet: "", target: "", breakpoint: "" },
  { feet: "", target: "", breakpoint: "" },
],
    oilPattern: "",

    primaryBall: "",
    primaryBallId: "",

    secondaryBall: "",
    secondaryBallId: "",

    feet: "",
    target: "",
    breakpoint: "",
    surface: "",
    transitionNote: "",
    notes: "",
    pinLayout: [],
boardLayout: {
  feet: "",
  target: "",
  breakpoint: "",
},
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

async function saveEquipment() {
  if (!equipmentForm.name.trim()) {
    showToast("Please enter a ball name.", "error");
    return;
  }

 const payload = {
  uid: user.uid,

  name: equipmentForm.name.trim(),
  manufacturer: equipmentForm.manufacturer.trim(),

  weight: equipmentForm.weight.trim(),
  core: equipmentForm.core.trim(),

  coverstock: equipmentForm.coverstock.trim(),
  finish: equipmentForm.finish.trim(),
  surface: equipmentForm.surface.trim(),
  layout: equipmentForm.layout.trim(),

  purchaseDate: equipmentForm.purchaseDate,
  status: equipmentForm.status,

  image: equipmentForm.image || "",

  games: 0,
  average: 0,
  highGame: 0,
  bestSeries: 0,

  updatedAt: serverTimestamp(),
};

  try {
    if (editingEquipmentId) {
      await updateDoc(
        doc(db, "equipment", editingEquipmentId),
        payload
      );

      showToast("Equipment updated!");
    } else {
      payload.createdAt = serverTimestamp();

      await addDoc(
        collection(db, "equipment"),
        payload
      );

      showToast("Ball added!");
    }

    setEquipmentForm(emptyEquipmentForm);

    setEditingEquipmentId(null);
  } catch (err) {
    console.error(err);
    showToast(err.message, "error");
  }
}

function calculateBallStats(ball, allSeries) {
  const ballId = String(ball?.id || "").trim();
  const cleanBallName = String(ball?.name || "").trim().toLowerCase();

  if (!ballId && !cleanBallName) {
    return {
      games: 0,
      average: 0,
      highGame: 0,
      bestSeries: 0,
      favoriteHouse: "",
      favoritePattern: "",
      lastUsed: "",
    };
  }

  const matchingSeries = allSeries.filter((series) => {
    const primaryId = String(series.primaryBallId || "").trim();
    const secondaryId = String(series.secondaryBallId || "").trim();

    const primaryName = String(series.primaryBall || "").trim().toLowerCase();
    const secondaryName = String(series.secondaryBall || "").trim().toLowerCase();

    const matchesById =
      ballId && (primaryId === ballId || secondaryId === ballId);

    const matchesByName =
      cleanBallName &&
      !primaryId &&
      !secondaryId &&
      (primaryName === cleanBallName || secondaryName === cleanBallName);

    return matchesById || matchesByName;
  });

  const games = matchingSeries.flatMap((series) =>
    (series.games || []).map((game) => Number(game || 0)).filter((game) => game > 0)
  );

  const totalPins = games.reduce((sum, game) => sum + game, 0);

  const houseCounts = {};
  const patternCounts = {};

  matchingSeries.forEach((series) => {
    if (series.house) {
      houseCounts[series.house] = (houseCounts[series.house] || 0) + 1;
    }

    if (series.oilPattern) {
      patternCounts[series.oilPattern] = (patternCounts[series.oilPattern] || 0) + 1;
    }
  });

  const mostCommon = (counts) => {
    const entries = Object.entries(counts);
    if (!entries.length) return "";

    return entries.sort((a, b) => b[1] - a[1])[0][0];
  };

  const sortedByDate = [...matchingSeries].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || ""))
  );

  return {
    games: games.length,
    average: games.length ? Number((totalPins / games.length).toFixed(1)) : 0,
    highGame: games.length ? Math.max(...games) : 0,
    bestSeries: matchingSeries.length
      ? Math.max(...matchingSeries.map((series) => Number(series.total || 0)))
      : 0,
    favoriteHouse: mostCommon(houseCounts),
    favoritePattern: mostCommon(patternCounts),
    lastUsed: sortedByDate[0]?.date || "",
  };
}

async function refreshEquipmentStats(updatedSeriesList) {
  if (!equipment.length) return;

  for (const ball of equipment) {
    const stats = calculateBallStats(ball, updatedSeriesList);

    await updateDoc(doc(db, "equipment", ball.id), {
      games: stats.games,
      average: stats.average,
      highGame: stats.highGame,
      bestSeries: stats.bestSeries,
      favoriteHouse: stats.favoriteHouse,
      favoritePattern: stats.favoritePattern,
      lastUsed: stats.lastUsed,
      updatedAt: serverTimestamp(),
    });
  }
}

async function saveSeries() {
  const games = (newSeries.games || [])
    .map((g) => Number(g || 0))
    .filter((g) => g > 0);

  const total = games.reduce((sum, g) => sum + g, 0);
  const average = games.length ? Number((total / games.length).toFixed(1)) : 0;
  const highGame = games.length ? Math.max(...games) : 0;

  if (!newSeries.house.trim()) {
    showToast("Add a house first.", "error");
    return;
  }

  if (games.length < 1) {
    showToast("Add at least 1 game.", "error");
    return;
  }

  const payload = {
    uid: user.uid,
    date: newSeries.date,
    house: newSeries.house.trim(),
    type: newSeries.type || "Practice",

    oilPattern: String(newSeries.oilPattern || "").trim(),
    primaryBall: String(newSeries.primaryBall || "").trim(),
    secondaryBall: String(newSeries.secondaryBall || "").trim(),
    primaryBallId: newSeries.primaryBallId || "",
    secondaryBallId: newSeries.secondaryBallId || "",
    feet: String(newSeries.feet || "").trim(),
    target: String(newSeries.target || "").trim(),
    breakpoint: String(newSeries.breakpoint || "").trim(),
    surface: String(newSeries.surface || "").trim(),
    transitionNote: String(newSeries.transitionNote || "").trim(),
    notes: String(newSeries.notes || "").trim(),
    pinLayout: Array.isArray(newSeries.pinLayout)
      ? newSeries.pinLayout
      : [],
boardLayout: {
  feet: newSeries.boardLayout?.feet || "",
  target: newSeries.boardLayout?.target || "",
  breakpoint: newSeries.boardLayout?.breakpoint || "",
},
    games,
    total,
    average,
    highGame,

    updatedAt: serverTimestamp(),
  };

  try {
    let updatedSeriesList = [];

    if (editingSeriesId) {
      await updateDoc(doc(db, "series", editingSeriesId), payload);

      updatedSeriesList = seriesList.map((series) =>
        series.id === editingSeriesId
          ? { ...series, ...payload, id: editingSeriesId }
          : series
      );

      setEditingSeriesId(null);
      showToast("Series updated.");
    } else {
      const addedRef = await addDoc(collection(db, "series"), {
        ...payload,
        createdAt: serverTimestamp(),
      });

      updatedSeriesList = [
        { ...payload, id: addedRef.id },
        ...seriesList,
      ];

      showToast("Series saved.");
    }

    await refreshEquipmentStats(updatedSeriesList);

    resetSeriesForm();
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

function handleBowlrImportFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const workbook = XLSX.read(text, { type: "string" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      

      const unique = (field) =>
        [...new Set(rows.map((row) => row[field]).filter(Boolean))];

      const strikeBalls = [
        ...unique("firstLaneStrikeBallId"),
        ...unique("secondLaneStrikeBallId"),
      ];

      const spareBalls = [
        ...unique("firstLaneSpareBallId"),
        ...unique("secondLaneSpareBallId"),
      ];

      const patterns = [
        ...unique("firstLaneOilPattern"),
        ...unique("secondLaneOilPattern"),
      ];

      setBowlrPreview({
  rows,
  games: rows.length,
  houses: unique("house"),
  leagues: unique("league"),
  tournaments: unique("tournament"),
  balls: [...new Set([...strikeBalls, ...spareBalls])],
  patterns: [...new Set(patterns)],
});

      showToast("Bowlr file scanned.");
    } catch (err) {
      console.error(err);
      showToast("Could not read Bowlr file.", "error");
    }
  };

  reader.readAsText(file);
}

function convertBowlrRowToSeries(row) {
  console.log("Bowlr row sample:", row);
console.log("Bowlr date fields:", {
  dateTime: row.dateTime,
  date: row.date,
  startDate: row.startDate,
  createdAt: row.createdAt,
});

const score = Number(row.score || 0);

  const primaryBall =
    row.firstLaneStrikeBallId ||
    row.secondLaneStrikeBallId ||
    "";

  const secondaryBall =
    row.firstLaneSpareBallId ||
    row.secondLaneSpareBallId ||
    "";

  const oilPattern =
    row.firstLaneOilPattern ||
    row.secondLaneOilPattern ||
    "";

  const laneInfo =
    row.firstLane && row.secondLane
      ? `Lanes ${row.firstLane}/${row.secondLane}`
      : row.firstLane
        ? `Lane ${row.firstLane}`
        : "";

  const details = [
    row.league ? `League: ${row.league}` : "",
    row.leagueWeek ? `Week: ${row.leagueWeek}` : "",
    row.tournament ? `Tournament: ${row.tournament}` : "",
    laneInfo,
    row.notes ? `Bowlr Notes: ${row.notes}` : "",
    row.id ? `Bowlr ID: ${row.id}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    uid: user.uid,
    date: normalizeBowlrDate(row.dateTime),
    house: String(row.house || "Unknown House").trim(),
    type: row.type || "Practice",

    oilPattern: String(oilPattern || "").trim(),
    primaryBall: String(primaryBall || "").trim(),
    secondaryBall: String(secondaryBall || "").trim(),
    feet: "",
    target: "",
    breakpoint: "",
    surface: "",
    transitionNote: "",

    notes: details,
    games: score > 0 ? [score] : [],
    total: score,
    average: score,
    highGame: score,
    bowlrId: row.id || "",
    source: "Bowlr",
    updatedAt: serverTimestamp(),
  };
}

function convertBowlrRowsToGroupedSeries(rows) {
  const groups = {};

  rows.forEach((row) => {
    const date = normalizeBowlrDate(row.dateTime);
    const house = String(row.house || "Unknown House").trim();
    const sessionKey = [
  date,
  house,
  row.type || "",
  row.league || "",
].join("|");

const key = sessionKey;

    if (!groups[key]) {
      groups[key] = {
        rows: [],
        date,
        house,
        type: row.tournament ? "Tournament" : row.league ? "League" : "Practice",
        league: row.league || "",
        tournament: row.tournament || "",
        oilPattern:
          row.firstLaneOilPattern ||
          row.secondLaneOilPattern ||
          "",
        primaryBall:
          row.firstLaneStrikeBallId ||
          row.secondLaneStrikeBallId ||
          "",
        secondaryBall:
          row.firstLaneSpareBallId ||
          row.secondLaneSpareBallId ||
          "",
      };
    }

    groups[key].rows.push(row);
  });

  return Object.values(groups).map((group) => {
    const games = group.rows
      .map((row) => Number(row.score || 0))
      .filter((score) => score > 0);

    const total = games.reduce((sum, score) => sum + score, 0);
    const average = games.length ? Number((total / games.length).toFixed(1)) : 0;
    const highGame = games.length ? Math.max(...games) : 0;

    const bowlrIds = group.rows
      .map((row) => row.id)
      .filter(Boolean)
      .join(",");

    const notes = [
  group.league ? `League: ${group.league}` : "",
  group.tournament ? `Tournament: ${group.tournament}` : "",
]
      .filter(Boolean)
      .join(" | ");

    return {
      uid: user.uid,
      date: group.date,
      house: group.house,
      type: group.type,
      oilPattern: String(group.oilPattern || "").trim(),
      primaryBall: String(group.primaryBall || "").trim(),
      secondaryBall: String(group.secondaryBall || "").trim(),
      feet: "",
      target: "",
      breakpoint: "",
      surface: "",
      transitionNote: "",
      notes,
      games,
      total,
      average,
      highGame,
      bowlrId: bowlrIds,
      source: "Bowlr",
      updatedAt: serverTimestamp(),
    };
  });
}

async function importBowlrGames() {
  if (!bowlrPreview?.rows?.length) {
    showToast("Upload a Bowlr file first.", "error");
    return;
  }

  const groupedSeries = convertBowlrRowsToGroupedSeries(bowlrPreview.rows);

  const confirmed = window.confirm(
    `Import ${groupedSeries.length} grouped Bowlr series from ${bowlrPreview.rows.length} games?`
  );

  if (!confirmed) return;

  let added = 0;
  let skipped = 0;

  const existingBowlrIds = new Set(
    seriesList
      .map((series) => series.bowlrId)
      .filter(Boolean)
  );

  try {
    for (const payload of groupedSeries) {
      if (!payload.games.length) {
        skipped++;
        continue;
      }

      if (payload.bowlrId && existingBowlrIds.has(payload.bowlrId)) {
        skipped++;
        continue;
      }

      await addDoc(collection(db, "series"), {
        ...payload,
        createdAt: serverTimestamp(),
      });

      added++;
    }

    showToast(
      `Bowlr grouped import complete: ${added} added, ${skipped} skipped.`
    );
  } catch (err) {
    console.error(err);
    showToast("Bowlr import failed.", "error");
  }
}

async function deleteImportedBowlrGames() {
  const imported = seriesList.filter((series) => series.source === "Bowlr");

  if (!imported.length) {
    showToast("No Bowlr imported games found.", "error");
    return;
  }

  const confirmed = window.confirm(
    `Delete ${imported.length} Bowlr imported games? Your manual series will stay safe.`
  );

  if (!confirmed) return;

  try {
    for (const series of imported) {
      await deleteDoc(doc(db, "series", series.id));
    }

    showToast(`Deleted ${imported.length} Bowlr imported games.`);
  } catch (err) {
    console.error(err);
    showToast("Could not delete Bowlr imported games.", "error");
  }
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
  }, [expenses, income, filteredSeries, yearMode]);

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
const monthlyFinancialData = useMemo(() => {

  const months = {};

  expenses.forEach((e) => {
    const month = new Date(e.date).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });

    if (!months[month]) {
      months[month] = {
        month,
        expenses: 0,
        income: 0,
      };
    }

    months[month].expenses += Number(e.amount || 0);
  });

  income.forEach((i) => {
    const month = new Date(i.date).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });

    if (!months[month]) {
      months[month] = {
        month,
        expenses: 0,
        income: 0,
      };
    }

    months[month].income += Number(i.amount || 0);
  });

  return Object.values(months);
}, [expenses, income]);

const profitTrendData = useMemo(() => {
  return monthlyFinancialData.map((m) => ({
    month: m.month,
    profit: (m.income || 0) - (m.expenses || 0),
  }));
}, [monthlyFinancialData]);

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

const averageProgressionData = useMemo(() => {
  const months = {};

  filteredSeries.forEach((series) => {
    const date = new Date(series.date);

    if (Number.isNaN(date.getTime())) return;

    const sortKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    const label = date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });

    if (!months[sortKey]) {
      months[sortKey] = {
        sortKey,
        month: label,
        totalPins: 0,
        games: 0,
        series: 0,
      };
    }

    months[sortKey].series += 1;

    (series.games || []).forEach((game) => {
      const score = Number(game || 0);

      if (score > 0) {
        months[sortKey].totalPins += score;
        months[sortKey].games += 1;
      }
    });
  });

  return Object.values(months)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((m) => ({
      month: m.month,
      average:
        m.games > 0
          ? Number((m.totalPins / m.games).toFixed(1))
          : 0,
      games: m.games,
      series: m.series,
    }));
}, [filteredSeries]);


const thisMonthSummary = useMemo(() => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const monthSeries = filteredSeries.filter((series) => {
    const d = new Date(series.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const games = monthSeries.flatMap((s) =>
    (s.games || []).map(Number)
  );

  const average =
    games.length > 0
      ? (
          games.reduce((a, b) => a + b, 0) /
          games.length
        ).toFixed(1)
      : "0.0";

  const highGame = games.length
    ? Math.max(...games)
    : 0;

  const incomeThisMonth = income
    .filter((i) => {
      const d = new Date(i.date);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const expensesThisMonth = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return {
    games: games.length,
    series: monthSeries.length,
    average,
    highGame,
    profit: incomeThisMonth - expensesThisMonth,
  };
}, [filteredSeries, income, expenses]);

const displayedFinancialData = useMemo(() => {
  switch (chartRange) {
    case "3m":
      return monthlyFinancialData.slice(-3);

    case "6m":
      return monthlyFinancialData.slice(-6);

    case "12m":
      return monthlyFinancialData.slice(-12);

    default:
      return monthlyFinancialData;
  }
}, [monthlyFinancialData, chartRange]);

const displayedProfitData = useMemo(() => {
  return displayedFinancialData.map((m) => ({
    month: m.month,
    profit: (m.income || 0) - (m.expenses || 0),
  }));
}, [displayedFinancialData]);

  const receiptItems = useMemo(() => {
  return expenses
    .filter((e) => {
      if (!e.receipt) return false;

      const itemYear =
        yearMode === "tax" ? getTaxYear(e.date) : getCalendarYear(e.date);

      const matchesYear = receiptYear === "all" || itemYear === receiptYear;
      const matchesCategory =
        receiptCategory === "all" || e.category === receiptCategory;
      const matchesSearch =
        !receiptSearch ||
        `${e.category} ${e.note} ${e.amount}`
          .toLowerCase()
          .includes(receiptSearch.toLowerCase());

      return matchesYear && matchesCategory && matchesSearch;
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 24);
}, [expenses, receiptYear, receiptCategory, receiptSearch, yearMode]);

const performanceSummary = useMemo(() => {
  const sorted = [...filteredSeries].sort((a, b) =>
    String(b.date).localeCompare(String(a.date))
  );

  const allGames = filteredSeries.flatMap((s) => s.games || []);

  const last5 = sorted.slice(0, 5).flatMap((s) => s.games || []);
  const last10 = sorted.slice(0, 10).flatMap((s) => s.games || []);

  const avg = (games) =>
    games.length
      ? (
          games.reduce((sum, g) => sum + Number(g || 0), 0) / games.length
        ).toFixed(1)
      : "0.0";

  return {
    totalSeries: filteredSeries.length,
    bestSeries: filteredSeries.length
      ? Math.max(...filteredSeries.map((s) => Number(s.total || 0)))
      : 0,
    bestGame: allGames.length ? Math.max(...allGames) : 0,
    overallAverage: avg(allGames),
    last5Average: avg(last5),
    last10Average: avg(last10),
    trend:
  Number(avg(last5)) > Number(avg(last10))
    ? "Trending Up 🔥"
    : Number(avg(last5)) < Number(avg(last10))
      ? "Trending Down 🧊"
      : "Holding Steady 🎯",
trendColor:
  Number(avg(last5)) > Number(avg(last10))
    ? appStyles.success
    : Number(avg(last5)) < Number(avg(last10))
      ? appStyles.danger
      : appStyles.accent,
  };
}, [filteredSeries]);

const personalRecords = useMemo(() => {
  const games = filteredSeries.flatMap(
    (s) => (s.games || []).map((g) => Number(g || 0))
  );

  const highGame = games.length ? Math.max(...games) : 0;

  const highSeries = filteredSeries.length
    ? Math.max(...filteredSeries.map((s) => Number(s.total || 0)))
    : 0;

  const totalGames = games.length;

  const totalSeries = filteredSeries.length;

  const average = games.length
    ? (
        games.reduce((sum, g) => sum + g, 0) /
        games.length
      ).toFixed(1)
    : "0.0";

  const games200 = games.filter((g) => g >= 200).length;

  return {
    highGame,
    highSeries,
    totalGames,
    totalSeries,
    average,
    games200,
  };
}, [filteredSeries]);

const achievements = useMemo(() => {
  const games = filteredSeries.flatMap(
    (s) => (s.games || []).map((g) => Number(g || 0))
  );

  const seriesTotals = filteredSeries.map((s) => Number(s.total || 0));

  const games200 = games.filter((g) => g >= 200).length;
  const games250 = games.filter((g) => g >= 250).length;
  const games300 = games.filter((g) => g === 300).length;

  const has600Series = seriesTotals.some((total) => total >= 600);
  const has700Series = seriesTotals.some((total) => total >= 700);
  const has800Series = seriesTotals.some((total) => total >= 800);

  return [
    {
      label: "First 200 Game",
      icon: "🥉",
      unlocked: games200 > 0,
      detail: games200 > 0 ? `${games200} total` : "Not yet",
    },
    {
      label: "First 250 Game",
      icon: "🥈",
      unlocked: games250 > 0,
      detail: games250 > 0 ? `${games250} total` : "Not yet",
    },
    {
      label: "Perfect Game",
      icon: "💎",
      unlocked: games300 > 0,
      detail: games300 > 0 ? `${games300} total` : "Not yet",
    },
    {
      label: "600 Series",
      icon: "🎳",
      unlocked: has600Series,
      detail: has600Series ? "Unlocked" : "Keep pushing",
    },
    {
      label: "700 Series",
      icon: "🔥",
      unlocked: has700Series,
      detail: has700Series ? "Unlocked" : "In the hunt",
    },
    {
      label: "800 Series",
      icon: "👑",
      unlocked: has800Series,
      detail: has800Series ? "Unlocked" : "Boss battle",
    },
    {
      label: "100 Games Bowled",
      icon: "📚",
      unlocked: games.length >= 100,
      detail: `${games.length}/100 games`,
    },
    {
      label: "50 Series Logged",
      icon: "🧾",
      unlocked: filteredSeries.length >= 50,
      detail: `${filteredSeries.length}/50 series`,
    },
  ];
}, [filteredSeries]);

const houseAverages = useMemo(() => {
  const grouped = {};

  filteredSeries.forEach((series) => {
    const house = series.house || "Unknown House";
    const games = series.games || [];

    if (!grouped[house]) {
      grouped[house] = [];
    }

    grouped[house].push(...games.map((g) => Number(g || 0)).filter((g) => g > 0));
  });

  return Object.entries(grouped)
    .map(([house, games]) => ({
      house,
      average: games.length
        ? (
            games.reduce((sum, g) => sum + g, 0) / games.length
          ).toFixed(1)
        : "0.0",
      games: games.length,
    }))
    .sort((a, b) => Number(b.average) - Number(a.average));
}, [filteredSeries]);

const houseStats = useMemo(() => {
  return houseAverages.map((house) => {
    const houseSeries = filteredSeries.filter(
      (s) => s.house === house.house
    );

    const games = houseSeries.flatMap(
      (s) => (s.games || []).map(Number)
    );

    const totals = houseSeries.map((s) => Number(s.total || 0));

    const monthly = {};

    houseSeries.forEach((series) => {
      const month = new Date(series.date).toLocaleDateString(
        "en-US",
        {
          month: "long",
        }
      );

      if (!monthly[month]) {
        monthly[month] = [];
      }

      monthly[month].push(series.average);
    });

    let bestMonth = "-";
    let bestMonthAverage = 0;

    Object.entries(monthly).forEach(([month, avgs]) => {
      const avg =
        avgs.reduce((a, b) => a + b, 0) /
        avgs.length;

      if (avg > bestMonthAverage) {
        bestMonthAverage = avg;
        bestMonth = month;
      }
    });

    return {
      ...house,

      games: games.length,

      series: houseSeries.length,

      highGame: games.length
        ? Math.max(...games)
        : 0,

      highSeries: totals.length
        ? Math.max(...totals)
        : 0,

      games200: games.filter((g) => g >= 200)
        .length,

      bestMonth,
    };
  });
}, [houseAverages, filteredSeries]);

const miniPerformanceStats = useMemo(() => {
  const gamesThisYear = filteredSeries.reduce(
    (sum, series) => sum + (series.games || []).length,
    0
  );

  const houseCounts = {};
  const eventCounts = {};

  filteredSeries.forEach((series) => {
    const house = series.house || "Unknown House";
    const event = series.type || series.event || "Unknown Event";

    houseCounts[house] = (houseCounts[house] || 0) + 1;
    eventCounts[event] = (eventCounts[event] || 0) + 1;
  });

  const topFromCounts = (counts) => {
    const entries = Object.entries(counts);
    if (!entries.length) return "None yet";
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  };

const sortedByDate = [...filteredSeries].sort((a, b) =>
  String(b.date).localeCompare(String(a.date))
);

let currentStreak = 0;

for (const series of sortedByDate) {
  if (Number(series.average || 0) >= 180) {
    currentStreak += 1;
  } else {
    break;
  }
}

const bestHouse =
  houseAverages.length > 0
    ? houseAverages[0]
    : null;

  return {
    gamesThisYear,
    mostBowledHouse: topFromCounts(houseCounts),
    mostCommonEvent: topFromCounts(eventCounts),
    currentStreak,
    bestHouse,
  };
}, [filteredSeries]);

const lastUpdatedPerformance = useMemo(() => {
  const dates = filteredSeries
    .map((series) => series.updatedAt?.toDate?.() || series.createdAt?.toDate?.() || null)
    .filter(Boolean)
    .sort((a, b) => b - a);

  if (!dates.length) return "No updates yet";

  return dates[0].toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}, [filteredSeries]);

const pageTitleStyle = {
  fontSize: isPhone ? 34 : 52,
  fontWeight: 900,
  lineHeight: 1,
  textShadow: "0 0 28px rgba(80,180,255,0.55)",
};

const pageSubtitleStyle = {
  color: appStyles.muted,
  marginTop: 8,
  fontSize: 16,
};

  async function handleDelete(id) {
  const confirmed = window.confirm("Delete this series?");
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "series", id));
    showToast("Series deleted.");
  } catch (error) {
    console.error(error);
    showToast("Could not delete series.", "error");
  }
}

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
          <div style={pageTitleStyle}>
            🎳 TEN BACK PRECISION {APP_VERSION}
          </div>
          <div style={pageSubtitleStyle}>
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

const renderFab = () => (
  <>
{showFabMenu && (
  <button
    type="button"
    onClick={() => {
      setActiveView("performance");
      setShowFabMenu(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }}
    style={{
      position: "fixed",
      right: isPhone ? 20 : 30,
      bottom: isPhone ? 128 : 138,
      width: 42,
      height: 42,
      borderRadius: "50%",
      border: `1px solid ${appStyles.cardBorder}`,
      background: appStyles.card,
      color: appStyles.text,
      fontSize: 18,
      cursor: "pointer",
      zIndex: 44,
      transition: "all .2s ease",
    }}
  >
    📊
  </button>
)}

<button
  type="button"
  aria-label="Go to New Series"
  title="New Series"
  onClick={() => {
  setShowFabMenu((prev) => !prev);
}}



onMouseEnter={(e) => {
  e.currentTarget.style.transform = "scale(1.08)";
}}

onMouseLeave={(e) => {
  e.currentTarget.style.transform = "scale(1)";
}}

  style={{
    position: "fixed",
    right: isPhone ? 18 : 28,
    bottom: isPhone ? 18 : 28,
    width: 48,
    height: 48,
    borderRadius: "50%",
    border: `1px solid ${appStyles.cardBorder}`,
    background: appStyles.accent,
    color: "#1a1633",
    fontSize: 22,
    cursor: "pointer",
    transition: "transform 0.2s ease",
    zIndex: 45,
    boxShadow: "0 12px 30px rgba(0,0,0,0.38)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }}
>
  🎳
</button>
</>
);


if (activeView === "performance") {
  const sortedSeries = [...filteredSeries].sort((a, b) =>
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
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={pageTitleStyle}>🎳 Performance</div>
        <div style={pageSubtitleStyle}>
          Track houses, games, and series without junk-drawering the money side.
        </div>

        <div
          style={{
            color: appStyles.muted,
            fontSize: 13,
            marginTop: 6,
          }}
        >
          Last updated: {lastUpdatedPerformance}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveView("dashboard")}
            style={{ ...buttonStyle, background: appStyles.accent, color: "#1a1633" }}
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
            onClick={() => setShowHouseAverages((prev) => !prev)}
            style={{
              ...buttonStyle,
              background: showHouseAverages ? appStyles.accent2 : "rgba(255,255,255,0.12)",
              color: showHouseAverages ? "#06203a" : appStyles.text,
            }}
          >
            {showHouseAverages
  ? "Hide Performance Insights"
  : "Show Performance Insights"}
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
          gridTemplateColumns: isPhone
            ? "1fr"
            : isFoldable
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(3, minmax(0, 1fr))",
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
          label="Last 5 Avg"
          value={String(performanceSummary.last5Average)}
          subValue={performanceSummary.trend}
          valueColor={performanceSummary.trendColor}
        />
        <StatCard
          label="Last 10 Avg"
          value={String(performanceSummary.last10Average)}
          subValue="Recent performance window"
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
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 24,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: appStyles.glowBlue,
    padding: 18,
    marginBottom: 18,
  }}
>
  <button
  type="button"
  onClick={() => setShowAchievementTracker((prev) => !prev)}
  style={{
    width: "100%",
    border: "none",
    background: "transparent",
    color: appStyles.text,
    cursor: "pointer",
    padding: 0,
    marginBottom: showAchievementTracker ? 24 : 0,
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    }}
  >
    <div
  style={{
    flex: 1,
    textAlign: "center",
  }}
>
      <div style={{ fontSize: 24, fontWeight: 900 }}>
        🏅 Achievement Tracker
      </div>

      <div style={{ color: appStyles.muted, marginTop: 6 }}>
        Milestones unlocked from your bowling history
      </div>
    </div>

    <div
  style={{
    fontSize: 20,
    width: 32,
    textAlign: "right",
  }}
>
      {showAchievementTracker ? "▲" : "▼"}
    </div>
  </div>
</button>
{showAchievementTracker && (
  <>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: isPhone
        ? "1fr"
        : isFoldable
          ? "repeat(2, minmax(0, 1fr))"
          : "repeat(4, minmax(0, 1fr))",
      gap: 12,
    }}
  >
    {achievements.map((a) => (
      <div
        key={a.label}
        style={{
          background: a.unlocked
            ? "rgba(255,255,255,0.10)"
            : "rgba(255,255,255,0.04)",
          border: `1px solid ${
            a.unlocked
              ? appStyles.accent2
              : appStyles.cardBorder
          }`,
          borderRadius: 18,
          padding: 14,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>
          {a.icon}
        </div>

        <div
          style={{
            fontWeight: 700,
            marginBottom: 6,
            color: appStyles.text,
          }}
        >
          {a.label}
        </div>

        <div
          style={{
            fontSize: 13,
            color: appStyles.muted,
          }}
        >
          {a.detail}
         </div>
       </div>
    ))}
  </div>
</>
   )}
</div>

<div
  style={{
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 24,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: appStyles.glowPurple,
    padding: 18,
    marginBottom: 18,
  }}
>
  <button
  type="button"
  onClick={() => setShowPersonalRecords((prev) => !prev)}
  style={{
    width: "100%",
    border: "none",
    background: "transparent",
    color: appStyles.text,
    cursor: "pointer",
    padding: 0,
    marginBottom: showPersonalRecords ? 24 : 0,
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <div
  style={{
    flex: 1,
    textAlign: "center",
  }}
>
      <div style={{ fontSize: 24, fontWeight: 900 }}>
        🏆 Personal Records
      </div>

      <div style={{ color: appStyles.muted, marginTop: 6 }}>
        Your best bowling marks from the current filters
      </div>
    </div>

    <div
  style={{
    fontSize: 20,
    width: 32,
    textAlign: "right",
  }}
>
      {showPersonalRecords ? "▲" : "▼"}
    </div>
  </div>
</button>
{showPersonalRecords && (
  <>


  <div
    style={{
      display: "grid",
      gridTemplateColumns: isPhone
        ? "1fr"
        : isFoldable
          ? "repeat(2, minmax(0, 1fr))"
          : "repeat(3, minmax(0, 1fr))",
      gap: 12,
    }}
  >
    <StatCard
      label="Highest Game"
      value={String(personalRecords.highGame)}
      subValue="Best single game"
    />
    <StatCard
      label="Highest Series"
      value={String(personalRecords.highSeries)}
      subValue="Best total set"
    />
    <StatCard
      label="Overall Avg"
      value={String(personalRecords.average)}
      subValue="Across filtered games"
    />
    <StatCard
      label="Games Bowled"
      value={String(personalRecords.totalGames)}
      subValue="Games tracked"
    />
    <StatCard
      label="Series Bowled"
      value={String(personalRecords.totalSeries)}
      subValue="Series tracked"
    />
    <StatCard
      label="200+ Games"
      value={String(personalRecords.games200)}
      subValue="Games at 200 or better"
    />
    </div>

  </>
)}
</div>

<div
  style={{
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 24,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: appStyles.glowPurple,
    padding: 18,
    marginBottom: 18,
  }}
>
  <SectionTitle
    title="📈 Average Progression"
    subtitle="Monthly average based on saved games"
  />

  <div style={{ height: 300 }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={averageProgressionData}>
        <CartesianGrid strokeOpacity={0.2} />
        <XAxis dataKey="month" />
        <YAxis />
 <Tooltip
  content={({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    const data = payload[0]?.payload;

    return (
      <div
        style={{
          background: "#0f172a",
          border: `1px solid ${appStyles.cardBorder}`,
          borderRadius: 14,
          padding: "12px 14px",
          color: appStyles.text,
          boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>
          📅 {label}
        </div>

        <div>🎳 Average: {data?.average ?? 0}</div>
        <div>🎯 Games: {data?.games ?? 0}</div>
        <div>📚 Series: {data?.series ?? 0}</div>
      </div>
    );
  }}
/>       
        <Legend />

        <Line
          type="monotone"
          dataKey="average"
          stroke={appStyles.accent}
          strokeWidth={3}
          dot
          name="Average"
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isPhone
            ? "1fr"
            : isFoldable
              ? "repeat(2, minmax(0, 1fr))"
              : showHouseAverages
                ? "repeat(4, minmax(0, 1fr))"
                : "repeat(2, minmax(0, 1fr))",
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isPhone ? "1fr" : "repeat(3, 1fr)",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <select
              value={perfFilters.house}
              onChange={(e) => setPerfFilters({ ...perfFilters, house: e.target.value })}
              style={inputStyle}
            >
              <option value="All">All Houses</option>
              {[...new Set(seriesList.map((s) => s.house))]
                .filter(Boolean)
                .map((house) => (
                  <option key={house} value={house}>
                    {house}
                  </option>
                ))}
            </select>

            <select
              value={perfFilters.event}
              onChange={(e) => setPerfFilters({ ...perfFilters, event: e.target.value })}
              style={inputStyle}
            >
              <option value="All">All Events</option>
              {[...new Set([...performanceTypes, ...seriesList.map((s) => s.type || s.event)])]
                .filter(Boolean)
                .map((event) => (
                  <option key={event} value={event}>
                    {event}
                  </option>
                ))}
            </select>

            <select
              value={perfFilters.year}
              onChange={(e) => setPerfFilters({ ...perfFilters, year: e.target.value })}
              style={inputStyle}
            >
              <option value="All">All Years</option>
              {[...new Set(seriesList.map((s) => new Date(s.date).getFullYear().toString()))]
                .sort((a, b) => b.localeCompare(a))
                .map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
            </select>
          </div>

<div ref={addSeriesRef}>
  <AddSeriesForm
  editingSeriesId={editingSeriesId}
  newSeries={newSeries}
  setNewSeries={setNewSeries}
  performanceTypes={performanceTypes}
  inputStyle={inputStyle}
  isPhone={isPhone}
  isFoldable={isFoldable}
  equipment={equipment}
  equipmentOptions={equipmentOptions}
  buttonStyle={buttonStyle}
  appStyles={appStyles}
  saveSeries={saveSeries}
  resetSeriesForm={resetSeriesForm}
/>
</div>

        </div>

        {showHouseAverages ? (
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
              title="Quick Performance Stats"
              subtitle="Snapshot from current filters"
            />

            <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${appStyles.cardBorder}`,
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <div style={{ color: appStyles.muted, fontSize: 14 }}>Games This Year</div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>
                  {miniPerformanceStats.gamesThisYear}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${appStyles.cardBorder}`,
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <div style={{ color: appStyles.muted, fontSize: 14 }}>Top House</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {miniPerformanceStats.mostBowledHouse}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${appStyles.cardBorder}`,
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <div style={{ color: appStyles.muted, fontSize: 14 }}>Most Common Event</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {miniPerformanceStats.mostCommonEvent}
                </div>
              </div>
<div
  style={{
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 14,
    padding: 12,
  }}
>
  <div
  style={{
    fontSize: 20,
    fontWeight: 900,
    color:
      miniPerformanceStats.currentStreak > 0
        ? appStyles.accent
        : appStyles.muted,
  }}
>
  {miniPerformanceStats.currentStreak > 0
    ? `🔥 ${miniPerformanceStats.currentStreak} series`
    : "No streak"}
</div>
</div>

<div
  style={{
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 14,
    padding: 12,
  }}
>
  <div style={{ color: appStyles.muted, fontSize: 14 }}>
    Best House Avg
  </div>

  <div style={{ fontSize: 20, fontWeight: 900 }}>
    {miniPerformanceStats.bestHouse
      ? miniPerformanceStats.bestHouse.average
      : "--"}
  </div>

  <div style={{ color: appStyles.muted, marginTop: 4 }}>
    {miniPerformanceStats.bestHouse?.house || "No data"}
  </div>
</div>
            </div>

            <div style={{ marginTop: 24 }}>
              <SectionTitle
                title="House Averages"
                subtitle="Average score by bowling center based on current filters"
              />

              {perfFilters.house !== "All" ? (
                <button
                  type="button"
                  onClick={() =>
                    setPerfFilters((prev) => ({
                      ...prev,
                      house: "All",
                    }))
                  }
                  style={{
                    ...buttonStyle,
                    background: "rgba(255,255,255,0.12)",
                    color: appStyles.text,
                    marginTop: 10,
                  }}
                >
                  Clear House Filter
                </button>
              ) : null}
            </div>

{houseAverages.length > 3 ? (
  <button
    type="button"
    onClick={() => setShowAllHouseAverages((prev) => !prev)}
    style={{
      ...buttonStyle,
      background: "rgba(255,255,255,0.12)",
      color: appStyles.text,
      marginTop: 12,
      width: "100%",
    }}
  >
    {showAllHouseAverages ? "Show Top 3" : "Show All Houses"}
  </button>
) : null}

            {houseAverages.length === 0 ? (
              <div style={{ color: appStyles.muted, textAlign: "center" }}>
                No house averages yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {houseStats
  .slice(0, showAllHouseAverages ? houseStats.length : 3)
  .map((item) => (
                  <div
                    key={item.house}
                    onClick={() =>
                      setPerfFilters((prev) => ({
                        ...prev,
                        house: prev.house === item.house ? "All" : item.house,
                      }))
                    }
                    style={{
                      cursor: "pointer",
                      background:
                        perfFilters.house === item.house
                          ? "rgba(74,222,222,0.15)"
                          : "rgba(255,255,255,0.04)",
                      border:
                        perfFilters.house === item.house
                          ? "2px solid #4ADEDE"
                          : `1px solid ${appStyles.cardBorder}`,
                      boxShadow:
                        perfFilters.house === item.house
                          ? "0 0 18px rgba(74,222,222,.6)"
                          : "none",
                      transform: perfFilters.house === item.house ? "scale(1.02)" : "scale(1)",
                      transition: "all .25s ease",
                      borderRadius: 14,
                      padding: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ width: "100%" }}>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
    }}
  >
    <div>
      <div style={{ fontWeight: 900 }}>🏠 {item.house}</div>
      <div style={{ color: appStyles.muted, fontSize: 14 }}>
        {item.games} games · {item.series} series
      </div>
    </div>

    <div style={{ fontSize: 26, fontWeight: 900 }}>
      {item.average}
    </div>
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: isPhone
        ? "1fr"
        : "repeat(3, minmax(0, 1fr))",
      gap: 8,
      marginTop: 12,
      fontSize: 13,
      color: appStyles.muted,
    }}
  >
    <div>High Game: <strong style={{ color: appStyles.text }}>{item.highGame}</strong></div>
    <div>High Series: <strong style={{ color: appStyles.text }}>{item.highSeries}</strong></div>
    <div>200+ Games: <strong style={{ color: appStyles.text }}>{item.games200}</strong></div>
    <div>Best Month: <strong style={{ color: appStyles.text }}>{item.bestMonth}</strong></div>
  </div>
</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div
          style={{
  background: appStyles.card,
  border: `1px solid ${appStyles.cardBorder}`,
  borderRadius: 24,
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow: appStyles.glowBlue,
  padding: 18,
}}
 
      >


<div
  style={{
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 24,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: appStyles.glowPurple,
    padding: 18,
    marginBottom: 18,
  }}
>
  <button
  type="button"
  onClick={() => setShowEquipmentManager((prev) => !prev)}
  style={{
    width: "100%",
    border: "none",
    background: "transparent",
    color: appStyles.text,
    cursor: "pointer",
    padding: 0,
    marginBottom: showEquipmentManager ? 24 : 0,
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    }}
  >
    <div
  style={{
    flex: 1,
    textAlign: "center",
    paddingLeft: 26,
  }}
>
      <div style={{ fontSize: 24, fontWeight: 900 }}>
        🎒 Equipment Manager
      </div>
      <div style={{ color: appStyles.muted, marginTop: 6 }}>
        Build your digital bowling bag
      </div>
    </div>

    <div style={{ fontSize: 20 }}>
      {showEquipmentManager ? "▲" : "▼"}
    </div>
  </div>
</button>

{showEquipmentManager && (
  <>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: isPhone
        ? "1fr"
        : "repeat(2, minmax(0, 1fr))",
      gap: 10,
      marginBottom: 14,
    }}
  >
    <input
      placeholder="Ball Name"
      value={equipmentForm.name}
      onChange={(e) =>
        setEquipmentForm((prev) => ({ ...prev, name: e.target.value }))
      }
      style={inputStyle}
    />

    <input
      placeholder="Manufacturer"
      value={equipmentForm.manufacturer}
      onChange={(e) =>
        setEquipmentForm((prev) => ({
          ...prev,
          manufacturer: e.target.value,
        }))
      }
      style={inputStyle}
    />

    <input
      placeholder="Coverstock"
      value={equipmentForm.coverstock}
      onChange={(e) =>
        setEquipmentForm((prev) => ({ ...prev, coverstock: e.target.value }))
      }
      style={inputStyle}
    />

    <input
      placeholder="Surface"
      value={equipmentForm.surface}
      onChange={(e) =>
        setEquipmentForm((prev) => ({ ...prev, surface: e.target.value }))
      }
      style={inputStyle}
    />

    <input
      type="date"
      value={equipmentForm.purchaseDate}
      onChange={(e) =>
        setEquipmentForm((prev) => ({
          ...prev,
          purchaseDate: e.target.value,
        }))
      }
      style={inputStyle}
    />

    <select
      value={equipmentForm.status}
      onChange={(e) =>
        setEquipmentForm((prev) => ({ ...prev, status: e.target.value }))
      }
      style={inputStyle}
    >
      <option>Active</option>
      <option>Retired</option>
    </select>
  </div>

  <button
    type="button"
    onClick={saveEquipment}
    style={{
      ...buttonStyle,
      background: appStyles.accent,
      color: "#1a1633",
      width: "100%",
    }}
  >
    {editingEquipmentId ? "Update Ball" : "+ Add Ball"}
  </button>

{editingEquipmentId ? (
  <button
    type="button"
    onClick={() => {
      setEditingEquipmentId(null);
      setEquipmentForm(emptyEquipmentForm);
    }}
    style={{
      ...buttonStyle,
      background: "rgba(255,255,255,0.12)",
      color: appStyles.text,
      width: "100%",
      marginTop: 10,
    }}
  >
    Cancel Edit
  </button>
) : null}

  <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
    {equipment.length === 0 ? (
      <div style={{ color: appStyles.muted, textAlign: "center" }}>
        No equipment added yet.
      </div>
    ) : (
      equipment.map((ball) => (
        <div
          key={ball.id}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${appStyles.cardBorder}`,
            borderRadius: 18,
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            🎳 {ball.name}
          </div>
          <div style={{ color: appStyles.muted, marginTop: 4 }}>
            {[ball.manufacturer, ball.coverstock, ball.surface]
              .filter(Boolean)
              .join(" · ") || "No details yet"}
          </div>
          <div style={{ marginTop: 8, color: appStyles.accent }}>
            {ball.status || "Active"}
          </div>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
    marginTop: 14,
  }}
>
  <div>
    <strong>🎳 Games</strong>
    <br />
    {ball.games || 0}
  </div>

  <div>
    <strong>📈 Average</strong>
    <br />
    {ball.average || 0}
  </div>

  <div>
    <strong>🔥 High Game</strong>
    <br />
    {ball.highGame || 0}
  </div>

  <div>
    <strong>🏆 Best Series</strong>
    <br />
    {ball.bestSeries || 0}
  </div>

  <div>
    <strong>🏠 Favorite House</strong>
    <br />
    {ball.favoriteHouse || "—"}
  </div>

  <div>
    <strong>📅 Last Used</strong>
    <br />
    {ball.lastUsed || "—"}
  </div>
</div>

<div
  style={{
    display: "flex",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  }}
>
  <button
    type="button"
    onClick={() => {
      setEditingEquipmentId(ball.id);
      setEquipmentForm({
  ...emptyEquipmentForm,

  name: ball.name || "",
  manufacturer: ball.manufacturer || "",

  weight: ball.weight || "",
  core: ball.core || "",

  coverstock: ball.coverstock || "",
  finish: ball.finish || "",
  surface: ball.surface || "",
  layout: ball.layout || "",

  purchaseDate: ball.purchaseDate || "",
  status: ball.status || "Active",

  image: ball.image || "",

  games: ball.games || 0,
  average: ball.average || 0,
  highGame: ball.highGame || 0,
  bestSeries: ball.bestSeries || 0,
});
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
</div>

        </div>
      ))
    )}
  </div>
 </>
)}
</div>

<div
  style={{
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 24,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: appStyles.glowBlue,
    padding: 18,
    marginBottom: 18,
  }}
>
  <button
  type="button"
  onClick={() => setShowBowlrImport((prev) => !prev)}
  style={{
    width: "100%",
    border: "none",
    background: "transparent",
    color: appStyles.text,
    cursor: "pointer",
    padding: 0,
    marginBottom: showBowlrImport ? 24 : 0,
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    }}
  >
    <div
      style={{
        flex: 1,
        textAlign: "center",
        paddingLeft: 36,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 900 }}>
        📥 Bowlr Import Preview
      </div>

      <div style={{ color: appStyles.muted, marginTop: 6 }}>
        Scan your Bowlr export before importing
      </div>
    </div>

    <div style={{ fontSize: 20 }}>
      {showBowlrImport ? "▲" : "▼"}
    </div>
  </div>
</button>
{showBowlrImport && (
  <>

  <input
    ref={bowlrImportRef}
    type="file"
    accept=".csv"
    style={{ display: "none" }}
    onChange={(e) => handleBowlrImportFile(e.target.files?.[0])}
  />

  <button
    type="button"
    onClick={() => bowlrImportRef.current?.click()}
    style={{
      ...buttonStyle,
      background: appStyles.accent,
      color: "#1a1633",
      width: "100%",
    }}
  >
    Upload Bowlr CSV
  </button>

  {bowlrPreview ? (
    <div
      style={{
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: isPhone
          ? "1fr"
          : "repeat(3, minmax(0, 1fr))",
        gap: 10,
      }}
    >
      <StatCard
        label="Games Found"
        value={String(bowlrPreview.games)}
        subValue="From Bowlr export"
      />
      <StatCard
        label="Houses"
        value={String(bowlrPreview.houses.length)}
        subValue="Centers found"
      />
      <StatCard
        label="Balls"
        value={String(bowlrPreview.balls.length)}
        subValue="Ball IDs found"
      />
      <StatCard
        label="Leagues"
        value={String(bowlrPreview.leagues.length)}
        subValue="League names"
      />
      <StatCard
        label="Tournaments"
        value={String(bowlrPreview.tournaments.length)}
        subValue="Tournament names"
      />
      <StatCard
        label="Patterns"
        value={String(bowlrPreview.patterns.length)}
        subValue="Oil patterns found"
      />
    </div>
  ) : null}

{bowlrPreview ? (
  <div>
    <button
      type="button"
      onClick={importBowlrGames}
      style={{
        ...buttonStyle,
        background: appStyles.success,
        color: "#052e16",
        width: "100%",
        marginTop: 16,
      }}
    >
      Import {bowlrPreview.games} Bowlr Games
    </button>

    <button
      type="button"
      onClick={deleteImportedBowlrGames}
      style={{
        ...buttonStyle,
        background: appStyles.danger,
        color: "#fff",
        width: "100%",
        marginTop: 10,
      }}
    >
      Delete Previous Bowlr Import
    </button>
    </div>
) : null}

  </>
)}
</div>

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
              {sortedSeries
  .slice(0, showAllRecentSeries ? sortedSeries.length : 3)
  .map((series) => {
  const isExpanded = expandedSeries[series.id];

  return (

                <div
  key={series.id}
  style={{
  background:
    editingSeriesId === series.id
      ? "rgba(255, 200, 0, 0.16)"
      : appStyles.card,
  border: `1px solid ${
    editingSeriesId === series.id
      ? "rgba(255,215,0,0.45)"
      : appStyles.cardBorder
  }`,
  borderRadius: 24,
  padding: 18,
  marginBottom: 18,
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow:
    editingSeriesId === series.id
      ? "0 0 30px rgba(255,215,0,0.28)"
      : appStyles.glowBlue,
  transition: "all 0.22s ease",
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
  <strong>
    Games (
    {(series.games && series.games.length)
      ? series.games.length
      : [
          series.game1,
          series.game2,
          series.game3,
          series.game4,
          series.game5,
          series.game6,
        ].filter(Boolean).length}
    ):
  </strong>
</div>

{expandedSeriesScores[series.id] ? (
  <div
    style={{
      marginTop: 4,
      fontSize: 14,
      lineHeight: 1.5,
      wordBreak: "break-word",
    }}
  >
    {(
      series.games && series.games.length
        ? series.games
        : [
            series.game1,
            series.game2,
            series.game3,
            series.game4,
            series.game5,
            series.game6,
          ].filter(Boolean)
    ).join(" • ")}
  </div>
) : null}

<button
  type="button"
  onClick={() =>
    setExpandedSeriesScores((prev) => ({
      ...prev,
      [series.id]: !prev[series.id],
    }))
  }
  style={{
    ...buttonStyle,
    background: "rgba(255,255,255,0.10)",
    color: appStyles.text,
    marginTop: 8,
    padding: "8px 12px",
    fontSize: 13,
  }}
>
  {expandedSeriesScores[series.id] ? "Hide Scores" : "Show Scores"}
</button>


                  <div style={{ marginTop: 8 }}>
                    Total: <strong>{series.total}</strong> · Avg:{" "}
                    <strong>{series.average}</strong> · High Game:{" "}
                    <strong>{series.highGame}</strong>
                  </div>

{Array.isArray(series.pinLayout) && series.pinLayout.length > 0 && (
  <div
    style={{
      marginTop: 8,
      color: appStyles.muted,
      fontSize: 14,
    }}
  >
    🎳 Pin Layout:{" "}
    <strong style={{ color: appStyles.text }}>
      {series.pinLayout.join("-")}
    </strong>
  </div>
)}

{series.boardLayout &&
(
  series.boardLayout.feet ||
  series.boardLayout.target ||
  series.boardLayout.breakpoint
) && (
  <div
    style={{
      marginTop: 8,
      color: appStyles.muted,
      fontSize: 14,
    }}
  >
    🎯 Board Layout:{" "}
    <strong style={{ color: appStyles.text }}>
      Feet {series.boardLayout.feet || "-"} • Target{" "}
      {series.boardLayout.target || "-"} • Breakpoint{" "}
      {series.boardLayout.breakpoint || "-"}
    </strong>
  </div>
)}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: 12,
                      marginTop: 12,
                      flexWrap: "wrap",
                    }}
                  >

<button
  type="button"
  onClick={() => setSelectedSessionIntel(series)}
  style={{
    ...buttonStyle,
    width: "100%",
    background: appStyles.accent,
    color: "#1a1633",
  }}
>
  📋 Session Intel
</button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingSeriesId(series.id);
                        setNewSeries({
  date: series.date || todayString(),
  house: series.house || "",
  type: series.type || "Practice",
  games:
    series.games && series.games.length
      ? series.games.map(String)
      : [
          series.game1 || "",
          series.game2 || "",
          series.game3 || "",
          series.game4 || "",
          series.game5 || "",
          series.game6 || "",
        ].filter(Boolean).map(String),

oilPattern: series.oilPattern || "",
primaryBall: series.primaryBall || "",
secondaryBall: series.secondaryBall || "",
feet: series.feet || "",
target: series.target || "",
breakpoint: series.breakpoint || "",
surface: series.surface || "",
transitionNote: series.transitionNote || "",

  notes: series.notes || "",
 pinLayout: Array.isArray(series.pinLayout)
  ? series.pinLayout
  : [],

boardLayout: {
  feet: series.boardLayout?.feet || "",
  target: series.boardLayout?.target || "",
  breakpoint: series.boardLayout?.breakpoint || "",
},
});

                        setTimeout(() => {
                          addSeriesRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }, 100);
                      }}
                      style={buttonStyle}
                                        >

                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(series.id)}
                      style={{ ...buttonStyle, background: "#ff4d4f" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
			      );
                            })}

              {sortedSeries.length > 3 ? (
                <button
                  type="button"
                  onClick={() =>
                    setShowAllRecentSeries((prev) => !prev)
                  }
                  style={{
                    ...buttonStyle,
                    background: "rgba(255,255,255,0.12)",
                    color: appStyles.text,
                    marginTop: 12,
                    width: "100%",
                  }}
                >
                  {showAllRecentSeries
                    ? "Show Most Recent 3"
                    : "Show All Series"}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

<SessionIntelModal
  selectedSessionIntel={selectedSessionIntel}
  setSelectedSessionIntel={setSelectedSessionIntel}
  appStyles={appStyles}
  buttonStyle={buttonStyle}
/>

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
      {renderFab()}
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
            justifyContent: "center",
	    textAlign: "center",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <div style={pageTitleStyle}>Receipts</div>
            <div style={pageSubtitleStyle}>
              Receipt gallery and quick preview
            </div>
          </div>

          <div
  style={{
    display: "flex",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
    width: "100%",
    marginTop: 12,
  }}
>
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
    gridTemplateColumns: isPhone
  ? "1fr"
  : isFoldable
    ? "repeat(2, minmax(0, 1fr))"
    : "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 16,
  }}
>
  <select
    value={receiptYear}
    onChange={(e) => setReceiptYear(e.target.value)}
    style={inputStyle}
  >
    <option value="all">All Years</option>
    {years.map((year) => (
      <option key={year} value={year}>
        {year}
      </option>
    ))}
  </select>

  <select
    value={receiptCategory}
    onChange={(e) => setReceiptCategory(e.target.value)}
    style={inputStyle}
  >
    <option value="all">All Categories</option>
    {expenseCategories.map((category) => (
      <option key={category} value={category}>
        {category}
      </option>
    ))}
  </select>

  <input
    value={receiptSearch}
    onChange={(e) => setReceiptSearch(e.target.value)}
    placeholder="Search receipts"
    style={inputStyle}
  />
</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isPhone
  ? "1fr"
  : isFoldable
    ? "repeat(2, minmax(0, 1fr))"
    : "repeat(4, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          {receiptItems.length === 0 ? (
            <div
              style={{
  background: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: `1px solid ${appStyles.cardBorder}`,
  borderRadius: 18,
  padding: 18,
}}
                          >
              No receipts yet.
            </div>
          ) : (
  <>
    {receiptItems
      .slice(0, showAllReceipts ? receiptItems.length : 3)
      .map((item) => (
              <div
                key={item.id}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${appStyles.cardBorder}`,
                  borderRadius: 18,
                  padding: 18,
                  display: "grid",
		  gridTemplateColumns: "80px 1fr",
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
		    gridColumn: "1 / -1",
		    justifySelf: "center",
		    marginTop: 8,
                  }}
                >
                  View
                </button>
              </div>
            ))}
     </>
   )}

{receiptItems.length > 3 ? (
  <button
    type="button"
    onClick={() => setShowAllReceipts((prev) => !prev)}
    style={{
      ...buttonStyle,
      background: "rgba(255,255,255,0.12)",
      color: appStyles.text,
      marginTop: 12,
      width: "100%",
      gridColumn: "1 / -1",
    }}
  >
    {showAllReceipts
      ? "Show Most Recent 3"
      : "Show All Receipts"}
  </button>
) : null}

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
<div style={{ textAlign: "center", marginBottom: 18 }}>
  <div style={pageTitleStyle}>
    🎳 TEN BACK PRECISION {APP_VERSION}
  </div>

  <div style={pageSubtitleStyle}>
    Bowling LLC tracker for expenses, income, receipts, and reports.
  </div>

  <div
    style={{
      display: "flex",
      justifyContent: "center",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 14,
    }}
  >
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
          gridTemplateColumns: isPhone
  ? "1fr"
  : isFoldable
    ? "repeat(2, minmax(0, 1fr))"
    : "repeat(4, minmax(0, 1fr))",
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
          subValue={profit >= 0 ? "Looking sharp👌🏾" : "Lane fees are swinging heavy."}
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
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 24,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: appStyles.glowBlue,
    padding: 18,
    marginBottom: 18,
  }}
>
  <SectionTitle
    title="🎳 This Month"
    subtitle="Current month snapshot"
  />

  <div
    style={{
      display: "grid",
      gridTemplateColumns: isPhone
        ? "1fr"
        : isFoldable
          ? "repeat(2, minmax(0, 1fr))"
          : "repeat(5, minmax(0, 1fr))",
      gap: 12,
    }}
  >
    <StatCard
      label="Games"
      value={String(thisMonthSummary.games)}
      subValue="Bowled this month"
    />
    <StatCard
      label="Series"
      value={String(thisMonthSummary.series)}
      subValue="Logged this month"
    />
    <StatCard
      label="Average"
      value={String(thisMonthSummary.average)}
      subValue="This month"
    />
    <StatCard
      label="High Game"
      value={String(thisMonthSummary.highGame)}
      subValue="Best this month"
    />
    <StatCard
      label="Profit"
      value={currency(thisMonthSummary.profit)}
      subValue="Income minus expenses"
      valueColor={
        thisMonthSummary.profit >= 0
          ? appStyles.success
          : appStyles.danger
      }
    />
  </div>
</div>

<div
  style={{
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 24,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: appStyles.glowBlue,
    padding: 18,
    marginBottom: 18,
  }}
>
  <SectionTitle
    title="Income vs Expenses"
    subtitle="Monthly money flow"
  />

<div
  style={{
    display: "flex",
    gap: 8,
    marginBottom: 18,
    flexWrap: "wrap",
  }}
>
  {[
    ["3m", "3 Months"],
    ["6m", "6 Months"],
    ["12m", "12 Months"],
    ["all", "All"],
  ].map(([value, label]) => (
    <button
      key={value}
      type="button"
      onClick={() => setChartRange(value)}
      style={{
        ...buttonStyle,
        background:
          chartRange === value
            ? appStyles.accent2
            : "rgba(255,255,255,0.08)",
        color:
          chartRange === value
            ? "#06203a"
            : appStyles.text,
      }}
    >
      {label}
    </button>
  ))}
</div>

  <div style={{ height: 300 }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={displayedFinancialData}>
        <CartesianGrid strokeOpacity={0.2} />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="income" fill={appStyles.accent2} name="Income" />
        <Bar dataKey="expenses" fill="#ff6b6b" name="Expenses" />
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>

<div
  style={{
    background: appStyles.card,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 24,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: appStyles.glowPurple,
    padding: 18,
    marginBottom: 18,
  }}
>
  <SectionTitle
    title="Profit Trend"
    subtitle="How your bowling business is trending"
  />

  <div style={{ height: 300 }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={displayedProfitData}>
        <CartesianGrid strokeOpacity={0.2} />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Legend />

        <Line
          type="monotone"
          dataKey="profit"
          stroke={appStyles.success}
          strokeWidth={3}
          dot
          name="Profit"
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
</div>

      <div
        style={{
  background: appStyles.card,
  border: `1px solid ${appStyles.cardBorder}`,
  borderRadius: 24,
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow: appStyles.glowBlue,
  padding: 18,
  marginBottom: 18,
}}
      >
        <SectionTitle
          title="Quick Actions"
          subtitle="Add income, expenses, receipts, and imports without hunting through menus."
        />

<div
  style={{
    display: "grid",
    gridTemplateColumns:
      isPhone
        ? "repeat(2, minmax(0,1fr))"
        : "repeat(3, minmax(0,1fr))",
    gap: 12,
    alignItems: "stretch",
    width: "100%",
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
    gridTemplateColumns:
      isPhone
        ? "1fr"
        : isFoldable
        ? "repeat(2, minmax(0,1fr))"
        : "repeat(5, minmax(0,1fr))",
    gap: 12,
    width: "100%",
    alignItems: "stretch",
    marginTop: 12,
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

<textarea
  placeholder="Note"
  value={expenseForm.note}
  onChange={(e) =>
    setExpenseForm((prev) => ({ ...prev, note: e.target.value }))
  }
  style={{
    ...inputStyle,
    height: 116,
resize: "none",
  }}
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

<div
  style={{
    gridColumn: "1 / -1",
    marginTop: 8,
    padding: 14,
    border: `1px solid ${appStyles.cardBorder}`,
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
  }}
>
 
</div>

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

            <div
		style={{
		display: "flex",
		justifyContent: "center",
		gap: 12,
		flexWrap: "wrap",
		}}
		>

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
{activityItems
  .slice(0, showAllRecentActivity ? activityItems.length : 3)
  .map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  style={{
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${appStyles.cardBorder}`,
  borderRadius: 14,
  padding: 12,

  minHeight: 78,
  width: "95%",

  display: "flex",
  flexDirection: "column",
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
{activityItems.length > 3 ? (
  <button
    type="button"
    onClick={() => setShowAllRecentActivity((prev) => !prev)}
    style={{
      ...buttonStyle,
      background: "rgba(255,255,255,0.12)",
      color: appStyles.text,
      marginTop: 12,
      width: "100%",
    }}
  >
    {showAllRecentActivity ? "Show Most Recent 3" : "Show All Activity"}
  </button>
) : null}
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
    {filteredExpenses
      .slice(0, showAllExpenses ? filteredExpenses.length : 3)
      .map((item) => (
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

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
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
                document
                  .getElementById("expense-form")
                  ?.scrollIntoView({ behavior: "smooth" });
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

    {filteredExpenses.length > 3 ? (
      <button
        type="button"
        onClick={() => setShowAllExpenses((prev) => !prev)}
        style={{
          ...buttonStyle,
          background: "rgba(255,255,255,0.12)",
          color: appStyles.text,
          marginTop: 12,
          width: "100%",
        }}
      >
        {showAllExpenses ? "Show Most Recent 3" : "Show All Expenses"}
      </button>
    ) : null}
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
              {filteredIncome
  .slice(0, showAllIncome ? filteredIncome.length : 3)
  .map((item) => (
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

                  <div
  style={{
    display: "flex",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
    flexWrap: "wrap",
  }}
>
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
{filteredIncome.length > 3 ? (
  <button
    type="button"
    onClick={() => setShowAllIncome((prev) => !prev)}
    style={{
      ...buttonStyle,
      background: "rgba(255,255,255,0.12)",
      color: appStyles.text,
      marginTop: 12,
      width: "100%",
    }}
  >
    {showAllIncome ? "Show Most Recent 3" : "Show All Income"}
  </button>
) : null}
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