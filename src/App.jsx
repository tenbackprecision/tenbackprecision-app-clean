import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const APP_VERSION = "v1001";
const MAX_RECEIPT_SIZE_MB = 5;
const CHART_COLORS = ["#7dd3fc", "#38bdf8", "#60a5fa", "#818cf8", "#a78bfa", "#f472b6", "#f59e0b"];

const categories = [
  "Tournament",
  "League Fees",
  "Equipment",
  "Travel",
  "Food",
  "Practice",
  "Supplies",
  "Other",
];

const incomeSources = [
  "Tournament Winnings",
  "League Payout",
  "Side Pots",
  "Refund",
  "Other",
];

const todayString = () => new Date().toISOString().slice(0, 10);
const monthKey = (date) => (date ? String(date).slice(0, 7) : "No Date");
const currency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

async function compressImage(file, maxWidth = 1600, quality = 0.8) {
  if (!file || !file.type?.startsWith("image/")) return null;

  const imageBitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxWidth / imageBitmap.width);
  const width = Math.round(imageBitmap.width * ratio);
  const height = Math.round(imageBitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingIncomeId, setEditingIncomeId] = useState(null);

  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
  });

  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);

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

  const mobileStack = window.innerWidth < 900;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser || null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setExpenses([]);
      setIncome([]);
      return;
    }
    void loadData();
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (message, type = "success") => setToast({ message, type });

  async function loadData() {
    if (!user?.uid) return;
    setDataLoading(true);
    try {
      const expensesQuery = query(collection(db, "expenses"), where("uid", "==", user.uid));
      const incomeQuery = query(collection(db, "income"), where("uid", "==", user.uid));

      const [expenseSnap, incomeSnap] = await Promise.all([getDocs(expensesQuery), getDocs(incomeQuery)]);

      const loadedExpenses = expenseSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

      const loadedIncome = incomeSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

      setExpenses(loadedExpenses);
      setIncome(loadedIncome);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not load data", "error");
    } finally {
      setDataLoading(false);
    }
  }

  async function handleAuth(mode) {
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
        showToast("Welcome back.");
      } else {
        await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        showToast("Account created.");
      }
      setAuthForm({ email: "", password: "" });
    } catch (error) {
      console.error(error);
      showToast(error.message || "Authentication failed", "error");
    }
  }

  async function handleReceiptFile(file) {
    if (!file) return;
    const maxBytes = MAX_RECEIPT_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      showToast(`Receipt is too large. Keep it under ${MAX_RECEIPT_SIZE_MB} MB.`, "error");
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
        setExpenses((prev) =>
          prev.map((item) => (item.id === editingExpenseId ? { ...item, ...payload } : item))
        );
        showToast("Expense updated.");
      } else {
        const ref = await addDoc(collection(db, "expenses"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setExpenses((prev) => [{ id: ref.id, ...payload }, ...prev]);
        showToast("Expense saved.");
      }
      resetExpenseForm();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not save expense", "error");
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
        setIncome((prev) => prev.map((item) => (item.id === editingIncomeId ? { ...item, ...payload } : item)));
        showToast("Income updated.");
      } else {
        const ref = await addDoc(collection(db, "income"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setIncome((prev) => [{ id: ref.id, ...payload }, ...prev]);
        showToast("Income saved.");
      }
      resetIncomeForm();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not save income", "error");
    }
  }

  async function removeExpense(item) {
    const confirmed = window.confirm(`Delete expense for ${currency(item.amount)}?`);
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, "expenses", item.id));
      setExpenses((prev) => prev.filter((x) => x.id !== item.id));
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
      setIncome((prev) => prev.filter((x) => x.id !== item.id));
      showToast("Income deleted.");
    } catch (error) {
      console.error(error);
      showToast("Could not delete income.", "error");
    }
  }

  const months = useMemo(() => {
    const set = new Set([...expenses.map((e) => monthKey(e.date)), ...income.map((i) => monthKey(i.date))]);
    return Array.from(set).filter(Boolean).sort((a, b) => b.localeCompare(a));
  }, [expenses, income]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const matchesMonth = filterMonth === "all" || monthKey(item.date) === filterMonth;
      const matchesCategory = filterCategory === "all" || item.category === filterCategory;
      const text = `${item.category} ${item.note || ""} ${item.amount || ""}`.toLowerCase();
      const matchesSearch = !searchTerm || text.includes(searchTerm.toLowerCase());
      return matchesMonth && matchesCategory && matchesSearch;
    });
  }, [expenses, filterMonth, filterCategory, searchTerm]);

  const filteredIncome = useMemo(() => {
    return income.filter((item) => {
      const matchesMonth = filterMonth === "all" || monthKey(item.date) === filterMonth;
      const text = `${item.source} ${item.note || ""} ${item.amount || ""}`.toLowerCase();
      const matchesSearch = !searchTerm || text.includes(searchTerm.toLowerCase());
      return matchesMonth && matchesSearch;
    });
  }, [income, filterMonth, searchTerm]);

  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalIncome = filteredIncome.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const profit = totalIncome - totalExpenses;
  const receipts = filteredExpenses.filter((item) => item.receipt);

  const monthlyStats = useMemo(() => {
    const grouped = {};

    expenses.forEach((item) => {
      const key = monthKey(item.date);
      if (!grouped[key]) grouped[key] = { month: key, income: 0, expenses: 0, profit: 0 };
      grouped[key].expenses += Number(item.amount || 0);
    });

    income.forEach((item) => {
      const key = monthKey(item.date);
      if (!grouped[key]) grouped[key] = { month: key, income: 0, expenses: 0, profit: 0 };
      grouped[key].income += Number(item.amount || 0);
    });

    return Object.values(grouped)
      .map((item) => ({ ...item, profit: item.income - item.expenses }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [expenses, income]);

  const chartData = useMemo(() => {
    const grouped = filteredExpenses.reduce((acc, item) => {
      const key = item.category || "Other";
      acc[key] = (acc[key] || 0) + Number(item.amount || 0);
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value], index) => ({
      name,
      value,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [filteredExpenses]);

  const recentActivity = useMemo(() => {
    const expenseRows = filteredExpenses.map((item) => ({
      id: item.id,
      type: "Expense",
      title: item.category,
      date: item.date,
      amount: -Math.abs(Number(item.amount || 0)),
      note: item.note || "",
    }));

    const incomeRows = filteredIncome.map((item) => ({
      id: item.id,
      type: "Income",
      title: item.source,
      date: item.date,
      amount: Math.abs(Number(item.amount || 0)),
      note: item.note || "",
    }));

    return [...expenseRows, ...incomeRows]
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 8);
  }, [filteredExpenses, filteredIncome]);

  const cardStyle = {
    background: "rgba(28, 56, 140, 0.55)",
    border: "1px solid rgba(125, 211, 252, 0.15)",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
    backdropFilter: "blur(8px)",
  };

  const appStyles = {
    background: "radial-gradient(circle at center top, rgba(52, 120, 255, 0.25), rgba(7, 16, 45, 0.95) 52%, rgba(2, 8, 23, 1) 100%)",
    card: cardStyle,
    text: "#e5f0ff",
    muted: "#b8caef",
    accent: "#ff8e72",
    accent2: "#67e8f9",
    good: "#57f287",
    bad: "#ff6b6b",
  };

  const fieldStyle = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    background: "rgba(83, 128, 255, 0.20)",
    color: "#eef5ff",
    border: "1px solid rgba(160, 202, 255, 0.25)",
    outline: "none",
    fontSize: "16px",
    boxSizing: "border-box",
  };

const selectStyle = {
  ...fieldStyle,
  background: "#0f172a",
  color: "#e5f0ff",
  border: "1px solid rgba(160, 202, 255, 0.25)",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

const optionStyle = {
  background: "#0f172a",
  color: "#e5f0ff",
};

  const buttonStyle = {
    border: "none",
    borderRadius: "14px",
    padding: "14px 18px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: 700,
    color: "#fff",
  };

  function StatCard({ label, value, subValue, valueColor }) {
    return (
      <div style={appStyles.card}>
        <div style={{ color: appStyles.muted, fontSize: 13, marginBottom: 8 }}>{label}</div>
        <div style={{ color: valueColor || appStyles.text, fontSize: 28, fontWeight: 800 }}>{value}</div>
        {subValue ? <div style={{ color: appStyles.muted, marginTop: 6, fontSize: 13 }}>{subValue}</div> : null}
      </div>
    );
  }

return (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      textAlign: "center",
      marginBottom: 14,
      gap: 6,
    }}
  >
    <div style={{ fontSize: 22, fontWeight: 800 }}>{title}</div>
    {subtitle ? (
      <div style={{ color: appStyles.muted }}>{subtitle}</div>
    ) : null}
  </div>
);  }

  function ReceiptCard({ item }) {
    return (
      <div style={{ ...appStyles.card, padding: 12 }}>
        <button
          type="button"
          onClick={() => setSelectedReceipt(item.receipt)}
          style={{
            padding: 0,
            border: "none",
            background: "transparent",
            width: "100%",
            cursor: "pointer",
          }}
        >
          <img
            src={item.receipt}
            alt="Receipt"
            style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 14 }}
          />
        </button>
        <div style={{ marginTop: 10, fontWeight: 700 }}>{item.category}</div>
        <div style={{ color: appStyles.muted, fontSize: 14 }}>{item.date || "No date"}</div>
        <div style={{ color: appStyles.text, marginTop: 6 }}>{currency(item.amount)}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => setSelectedReceipt(item.receipt)}
            style={{ ...buttonStyle, background: appStyles.accent2, color: "#06203a", flex: 1 }}
          >
            View
          </button>
          <button
            type="button"
            onClick={() => removeExpense(item)}
            style={{ ...buttonStyle, background: appStyles.bad, flex: 1 }}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: appStyles.background,
          color: appStyles.text,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        Loading Ten Back Precision…
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: appStyles.background,
          display: "grid",
          placeItems: "center",
          padding: 20,
          color: appStyles.text,
        }}
      >
        <div style={{ ...appStyles.card, width: "100%", maxWidth: 640 }}>
          <h1
            style={{
              color: appStyles.accent,
              marginBottom: 6,
              marginTop: 0,
              fontSize: mobileStack ? 28 : 34,
            }}
          >
            🎳 TEN BACK PRECISION v 1.0
          </h1>
          <p style={{ color: appStyles.muted, marginTop: 0, marginBottom: 18, maxWidth: 700 }}>
            Bowling LLC tracker for expenses, income, receipts, and reports. BUILD {APP_VERSION}
          </p>

          <div style={{ display: "grid", gap: 8 }}>
            <input
              placeholder="Email"
              value={authForm.email}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
              style={fieldStyle}
            />
            <input
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
              style={fieldStyle}
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => handleAuth("login")} style={{ ...buttonStyle, background: appStyles.accent }}>
                Log In
              </button>
              <button type="button" onClick={() => handleAuth("signup")} style={{ ...buttonStyle, background: appStyles.accent2, color: "#06203a" }}>
                Need an account?
              </button>
            </div>
          </div>
        </div>
        {toast ? (
          <div
            style={{
              position: "fixed",
              bottom: 22,
              right: 22,
              background: toast.type === "error" ? "rgba(255,107,107,0.95)" : "rgba(34,197,94,0.95)",
              color: "#fff",
              padding: "12px 16px",
              borderRadius: 12,
              fontWeight: 700,
              zIndex: 9999,
            }}
          >
            {toast.message}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        background: appStyles.background,
        minHeight: "100vh",
        padding: mobileStack ? 14 : 20,
        color: "#fff",
      }}
    >
      <div style={{ maxWidth: 1300, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: mobileStack ? "flex-start" : "center",
            flexDirection: mobileStack ? "column" : "row",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div>
            <h1 style={{ color: appStyles.accent, marginBottom: 6, marginTop: 0, fontSize: mobileStack ? 28 : 34 }}>
              🎳 TEN BACK PRECISION {APP_VERSION}
            </h1>
            <p style={{ color: appStyles.muted, marginTop: 0, marginBottom: 0, maxWidth: 700 }}>
              Bowling LLC tracker for expenses, income, receipts, and reports. BUILD {APP_VERSION}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setActiveView("dashboard")} style={{ ...buttonStyle, background: activeView === "dashboard" ? appStyles.accent : "rgba(255,255,255,0.12)" }}>Dashboard</button>
            <button type="button" onClick={() => setActiveView("receipts")} style={{ ...buttonStyle, background: activeView === "receipts" ? appStyles.accent : "rgba(255,255,255,0.12)" }}>Receipts</button>
            <button type="button" onClick={() => signOut(auth)} style={{ ...buttonStyle, background: "rgba(255,255,255,0.12)" }}>Log Out</button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: mobileStack ? "1fr" : "repeat(4, minmax(0, 1fr))",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <StatCard label="Income" value={currency(totalIncome)} subValue={`${filteredIncome.length} income items`} />
          <StatCard label="Expenses" value={currency(totalExpenses)} subValue={`${filteredExpenses.length} expense items`} />
          <StatCard label="Net Profit" value={currency(profit)} subValue={profit >= 0 ? "Looking sharp." : "Lane fees are swinging heavy."} valueColor={profit >= 0 ? appStyles.good : appStyles.bad} />
          <StatCard label="Receipts Uploaded" value={String(receipts.length)} subValue="Tracked and ready" />
        </div>

        <div style={{ ...appStyles.card, marginBottom: 18 }}>
          <SectionTitle
            title="Quick Actions"
            subtitle="Add income, expenses, and receipts without hunting through menus."
            right={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setActiveView("dashboard")} style={{ ...buttonStyle, background: appStyles.accent }}>Add Expense</button>
                <button type="button" onClick={() => setActiveView("dashboard")} style={{ ...buttonStyle, background: appStyles.accent2, color: "#06203a" }}>Add Income</button>
                <button type="button" onClick={() => setActiveView("receipts")} style={{ ...buttonStyle, background: "rgba(255,255,255,0.12)" }}>Upload Receipt</button>
              </div>
            }
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: mobileStack ? "1fr" : "repeat(3, minmax(0, 1fr))",
              gap: 8,
              marginBottom: 14,
            }}
          >
<select
  value={filterMonth}
  onChange={(e) => setFilterMonth(e.target.value)}
  style={selectStyle}
>
  <option value="all" style={optionStyle}>All Months</option>
  {months.map((month) => (
    <option key={month} value={month} style={optionStyle}>
      {month}
    </option>
  ))}
</select>

<select
  value={filterCategory}
  onChange={(e) => setFilterCategory(e.target.value)}
  style={selectStyle}
>
  <option value="all" style={optionStyle}>All Categories</option>
  {categories.map((category) => (
    <option key={category} value={category} style={optionStyle}>
      {category}
    </option>
  ))}
</select>            

<input placeholder="Search notes, categories, amounts" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={fieldStyle} />
          </div>
        </div>

        {activeView === "dashboard" ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobileStack ? "1fr" : "1.3fr 0.9fr",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <div style={appStyles.card}>
                <SectionTitle title="Monthly Trend" subtitle="Income, expenses, and profit across the calendar." />
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={monthlyStats}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="month" stroke="#b8caef" />
                      <YAxis stroke="#b8caef" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="income" stroke="#67e8f9" strokeWidth={3} />
                      <Line type="monotone" dataKey="expenses" stroke="#ff8e72" strokeWidth={3} />
                      <Line type="monotone" dataKey="profit" stroke="#57f287" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={appStyles.card}>
                <SectionTitle title="Expense Breakdown" subtitle="Where your bowling dollars are sprinting off to." />
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100} innerRadius={55} paddingAngle={2}>
                        {chartData.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => currency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobileStack ? "1fr" : "1.05fr 0.95fr",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <div style={appStyles.card}>
                <SectionTitle title={editingExpenseId ? "Edit Expense" : "Add Expense"} subtitle="Receipt-ready expense entry." />
                <div style={{ display: "grid", gap: 8 }}>
                  <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))} style={fieldStyle} />
                  <select
  value={expenseForm.category}
  onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
  style={selectStyle}
>
  {categories.map((category) => (
    <option key={category} value={category} style={optionStyle}>
      {category}
    </option>
  ))}
</select>
                  <input type="number" step="0.01" placeholder="Amount" value={expenseForm.amount} onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))} style={fieldStyle} />
                  <input placeholder="Note" value={expenseForm.note} onChange={(e) => setExpenseForm((prev) => ({ ...prev, note: e.target.value }))} style={fieldStyle} />
                  <label style={{ ...fieldStyle, display: "grid", placeItems: "center", cursor: "pointer" }}>
                    {expenseForm.receipt ? "Receipt added ✓" : "Upload receipt"}
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => void handleReceiptFile(e.target.files?.[0])} />
                  </label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" onClick={saveExpense} style={{ ...buttonStyle, background: appStyles.accent }}>
                      {editingExpenseId ? "Update Expense" : "Save Expense"}
                    </button>
                    <button type="button" onClick={resetExpenseForm} style={{ ...buttonStyle, background: "rgba(255,255,255,0.12)" }}>
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              <div style={appStyles.card}>
                <SectionTitle title={editingIncomeId ? "Edit Income" : "Add Income"} subtitle="Track winnings, payouts, and side money." />
                <div style={{ display: "grid", gap: 8 }}>
                  <input type="date" value={incomeForm.date} onChange={(e) => setIncomeForm((prev) => ({ ...prev, date: e.target.value }))} style={fieldStyle} />
<select
  value={incomeForm.source}
  onChange={(e) => setIncomeForm((prev) => ({ ...prev, source: e.target.value }))}
  style={selectStyle}
>
  {incomeSources.map((source) => (
    <option key={source} value={source} style={optionStyle}>
      {source}
    </option>
  ))}
</select>
                  <input type="number" step="0.01" placeholder="Amount" value={incomeForm.amount} onChange={(e) => setIncomeForm((prev) => ({ ...prev, amount: e.target.value }))} style={fieldStyle} />
                  <input placeholder="Note" value={incomeForm.note} onChange={(e) => setIncomeForm((prev) => ({ ...prev, note: e.target.value }))} style={fieldStyle} />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" onClick={saveIncome} style={{ ...buttonStyle, background: appStyles.accent2, color: "#06203a" }}>
                      {editingIncomeId ? "Update Income" : "Save Income"}
                    </button>
                    <button type="button" onClick={resetIncomeForm} style={{ ...buttonStyle, background: "rgba(255,255,255,0.12)" }}>
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobileStack ? "1fr" : "1fr 1fr",
                gap: 10,
              }}
            >
              <div style={appStyles.card}>
                <SectionTitle title="Recent Activity" subtitle="Latest movement across income and expenses." />
                {recentActivity.length === 0 ? (
                  <div style={{ color: appStyles.muted }}>No activity yet. Feed the beast some data.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {recentActivity.map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "12px 14px",
                          borderRadius: 14,
                          background: "rgba(255,255,255,0.06)",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>{item.title}</div>
                          <div style={{ color: appStyles.muted, fontSize: 14 }}>{item.type} • {item.date || "No date"}</div>
                          {item.note ? <div style={{ color: appStyles.muted, fontSize: 13, marginTop: 4 }}>{item.note}</div> : null}
                        </div>
                        <div style={{ fontWeight: 800, color: item.amount >= 0 ? appStyles.good : appStyles.bad }}>
                          {item.amount >= 0 ? "+" : "-"}{currency(Math.abs(item.amount))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={appStyles.card}>
                <SectionTitle title="Receipts Snapshot" subtitle="Newest receipt-backed expenses." right={<button type="button" onClick={() => setActiveView("receipts")} style={{ ...buttonStyle, background: "rgba(255,255,255,0.12)" }}>Open Gallery</button>} />
                {receipts.length === 0 ? (
                  <div style={{ color: appStyles.muted }}>No receipts yet. Upload one and this section wakes right up.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {receipts.slice(0, 4).map((item) => (
                      <div key={item.id} style={{ display: "grid", gridTemplateColumns: "88px 1fr auto", gap: 8, alignItems: "center", background: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 10 }}>
                        <img src={item.receipt} alt="Receipt thumbnail" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 12 }} />
                        <div>
                          <div style={{ fontWeight: 700 }}>{item.category}</div>
                          <div style={{ color: appStyles.muted, fontSize: 14 }}>{item.date || "No date"}</div>
                        </div>
                        <button type="button" onClick={() => setSelectedReceipt(item.receipt)} style={{ ...buttonStyle, background: appStyles.accent2, color: "#06203a", padding: "10px 14px" }}>View</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={appStyles.card}>
            <SectionTitle title="Receipt Gallery" subtitle="Every receipt-backed expense in one place." />
            {receipts.length === 0 ? (
              <div style={{ color: appStyles.muted }}>No receipts uploaded yet. Add one from the expense form above.</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: mobileStack ? "1fr" : "repeat(3, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {receipts.map((item) => (
                  <ReceiptCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ ...appStyles.card, marginTop: 18 }}>
          <SectionTitle title="Manage Records" subtitle="Edit or delete entries without hunting through Firestore." />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: mobileStack ? "1fr" : "1fr 1fr",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Expenses</div>
              <div style={{ display: "grid", gap: 10 }}>
                {filteredExpenses.slice(0, 8).map((item) => (
                  <div key={item.id} style={{ padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{item.category}</div>
                        <div style={{ color: appStyles.muted, fontSize: 14 }}>{item.date || "No date"}</div>
                        {item.note ? <div style={{ color: appStyles.muted, fontSize: 13, marginTop: 4 }}>{item.note}</div> : null}
                      </div>
                      <div style={{ fontWeight: 800 }}>{currency(item.amount)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExpenseId(item.id);
                          setExpenseForm({
                            date: item.date || todayString(),
                            category: item.category || "Tournament",
                            amount: String(item.amount || ""),
                            note: item.note || "",
                            receipt: item.receipt || "",
                          });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        style={{ ...buttonStyle, background: appStyles.accent, padding: "10px 14px" }}
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => removeExpense(item)} style={{ ...buttonStyle, background: appStyles.bad, padding: "10px 14px" }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Income</div>
              <div style={{ display: "grid", gap: 10 }}>
                {filteredIncome.slice(0, 8).map((item) => (
                  <div key={item.id} style={{ padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{item.source}</div>
                        <div style={{ color: appStyles.muted, fontSize: 14 }}>{item.date || "No date"}</div>
                        {item.note ? <div style={{ color: appStyles.muted, fontSize: 13, marginTop: 4 }}>{item.note}</div> : null}
                      </div>
                      <div style={{ fontWeight: 800, color: appStyles.good }}>{currency(item.amount)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIncomeId(item.id);
                          setIncomeForm({
                            date: item.date || todayString(),
                            source: item.source || "Tournament Winnings",
                            amount: String(item.amount || ""),
                            note: item.note || "",
                          });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        style={{ ...buttonStyle, background: appStyles.accent2, color: "#06203a", padding: "10px 14px" }}
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => removeIncome(item)} style={{ ...buttonStyle, background: appStyles.bad, padding: "10px 14px" }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedReceipt ? (
        <div
          onClick={() => setSelectedReceipt(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            display: "grid",
            placeItems: "center",
            padding: 20,
            zIndex: 9999,
          }}
        >
          <div style={{ maxWidth: "92vw", maxHeight: "92vh" }}>
            <img src={selectedReceipt} alt="Full receipt" style={{ maxWidth: "100%", maxHeight: "84vh", borderRadius: 16 }} />
            <div style={{ color: "#d7e6ff", textAlign: "center", marginTop: 10 }}>Tap anywhere to close</div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          style={{
            position: "fixed",
            bottom: 18,
            right: 18,
            background: toast.type === "error" ? "rgba(255,107,107,0.96)" : "rgba(34,197,94,0.96)",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: 12,
            fontWeight: 700,
            zIndex: 10000,
            maxWidth: 340,
          }}
        >
          {toast.message}
        </div>
      ) : null}

      {dataLoading ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", display: "grid", placeItems: "center", zIndex: 9998 }}>
          <div style={{ ...appStyles.card, fontWeight: 800 }}>Loading your bowling business HQ…</div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
