import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

/* ---------- FIREBASE ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyDXtklrqnwH7lisLkF2xg12bLS3fhKTdco",
  authDomain: "ten-back-tracker.firebaseapp.com",
  projectId: "ten-back-tracker",
  storageBucket: "ten-back-tracker.firebasestorage.app",
  messagingSenderId: "565303600694",
  appId: "1:565303600694:web:c6a21ad7decf1493ab5a97",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- STYLES ---------- */
const appStyles = {
  background:
    "radial-gradient(circle at top, rgba(34,99,255,0.25), rgba(7,18,48,1) 45%, rgba(4,12,32,1) 100%)",
  panel: "rgba(34, 103, 255, 0.20)",
  border: "rgba(255,255,255,0.12)",
  text: "#ffffff",
  muted: "rgba(255,255,255,0.72)",
  accent: "#ff6b4a",
  accent2: "#52c7ff",
  success: "#4ade80",
  danger: "#f87171",
  warning: "#fbbf24",
  shadow: "0 14px 32px rgba(0,0,0,0.28)",
};

const fieldStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: `1px solid ${appStyles.border}`,
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

const lightSelectStyle = {
  ...fieldStyle,
  color: "#111827",
  background: "rgba(255,255,255,0.95)",
};

/* ---------- HELPERS ---------- */
const formatMonth = (monthKey) => {
  if (!monthKey || monthKey === "No Date") return "No Date";
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

/* ---------- UI ---------- */
const Button = ({
  children,
  onClick,
  style,
  type = "button",
  disabled = false,
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "12px 16px",
      borderRadius: "12px",
      border: "none",
      background: disabled ? "#7c7c7c" : appStyles.accent,
      color: "#fff",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 700,
      letterSpacing: "0.3px",
      boxShadow: appStyles.shadow,
      ...style,
    }}
  >
    {children}
  </button>
);

const Card = ({ children, style }) => (
  <div
    style={{
      background: appStyles.panel,
      padding: "20px",
      borderRadius: "18px",
      marginBottom: "18px",
      border: `1px solid ${appStyles.border}`,
      boxShadow: appStyles.shadow,
      backdropFilter: "blur(10px)",
      ...style,
    }}
  >
    {children}
  </div>
);

/* ---------- APP ---------- */
export default function App() {
  const isLocalDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  const [view, setView] = useState("simple");
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    date: "",
    category: "",
    amount: "",
    receipt: "",
  });

  const [incomeForm, setIncomeForm] = useState({
    date: "",
    source: "",
    amount: "",
  });

  const [editingExpense, setEditingExpense] = useState(null);
  const [editingIncome, setEditingIncome] = useState(null);

  const mobileStack =
    typeof window !== "undefined" && window.innerWidth < 700;

  useEffect(() => {
    if (isLocalDev) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
    });
    return () => unsubscribe();
  }, [isLocalDev]);

  useEffect(() => {
    if (isLocalDev) {
      setDataLoading(false);
      return;
    }

    if (!user) {
      setExpenses([]);
      setIncome([]);
      return;
    }

    const loadData = async () => {
      setDataLoading(true);
      try {
        const expenseQuery = query(
          collection(db, "expenses"),
          where("uid", "==", user.uid)
        );
        const incomeQuery = query(
          collection(db, "income"),
          where("uid", "==", user.uid)
        );

        const [expenseSnap, incomeSnap] = await Promise.all([
          getDocs(expenseQuery),
          getDocs(incomeQuery),
        ]);

        const loadedExpenses = expenseSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const loadedIncome = incomeSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        loadedExpenses.sort((a, b) =>
          (b.date || "").localeCompare(a.date || "")
        );
        loadedIncome.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        setExpenses(loadedExpenses);
        setIncome(loadedIncome);
      } catch (error) {
        console.error("Load error:", error);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [user, isLocalDev]);

  const handleAuth = async () => {
    setAuthLoading(true);
    setAuthError("");

    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(
          auth,
          authForm.email,
          authForm.password
        );
      } else {
        await createUserWithEmailAndPassword(
          auth,
          authForm.email,
          authForm.password
        );
      }

      setAuthForm({ email: "", password: "" });
    } catch (error) {
      setAuthError(error.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const addExpense = async () => {
    if (!expenseForm.amount) return;

    const localUid = user?.uid || "local-dev-user";

    try {
      const payload = {
        ...expenseForm,
        uid: localUid,
        amount: Number(expenseForm.amount),
        createdAt: new Date().toISOString(),
      };

      if (editingExpense) {
        if (!isLocalDev && editingExpense.id) {
          await updateDoc(doc(db, "expenses", editingExpense.id), payload);
        }

        setExpenses((prev) =>
          prev.map((e) =>
            e.id === editingExpense.id ? { ...e, ...payload } : e
          )
        );
        setEditingExpense(null);
      } else {
        if (!isLocalDev) {
          const ref = await addDoc(collection(db, "expenses"), payload);
          setExpenses((prev) => [{ id: ref.id, ...payload }, ...prev]);
        } else {
          setExpenses((prev) => [
            { id: `local-expense-${Date.now()}`, ...payload },
            ...prev,
          ]);
        }
      }

      setExpenseForm({
        date: "",
        category: "",
        amount: "",
        receipt: "",
      });
    } catch (error) {
      console.error("Expense error:", error);
      alert(error.message);
    }
  };

  const addIncome = async () => {
    if (!incomeForm.amount) return;

    const localUid = user?.uid || "local-dev-user";

    try {
      const payload = {
        ...incomeForm,
        uid: localUid,
        amount: Number(incomeForm.amount),
        createdAt: new Date().toISOString(),
      };

      if (editingIncome) {
        if (!isLocalDev && editingIncome.id) {
          await updateDoc(doc(db, "income", editingIncome.id), payload);
        }

        setIncome((prev) =>
          prev.map((i) =>
            i.id === editingIncome.id ? { ...i, ...payload } : i
          )
        );
        setEditingIncome(null);
      } else {
        if (!isLocalDev) {
          const ref = await addDoc(collection(db, "income"), payload);
          setIncome((prev) => [{ id: ref.id, ...payload }, ...prev]);
        } else {
          setIncome((prev) => [
            { id: `local-income-${Date.now()}`, ...payload },
            ...prev,
          ]);
        }
      }

      setIncomeForm({
        date: "",
        source: "",
        amount: "",
      });
    } catch (error) {
      console.error("Income error:", error);
      alert(error.message);
    }
  };

  const deleteExpense = async (id) => {
    if (!window.confirm("Delete this expense?")) return;

    try {
      if (!isLocalDev && id && !String(id).startsWith("local-")) {
        await deleteDoc(doc(db, "expenses", id));
      }
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (error) {
      console.error("Delete expense error:", error);
      alert(error.message);
    }
  };

  const deleteIncome = async (id) => {
    if (!window.confirm("Delete this income?")) return;

    try {
      if (!isLocalDev && id && !String(id).startsWith("local-")) {
        await deleteDoc(doc(db, "income", id));
      }
      setIncome((prev) => prev.filter((i) => i.id !== id));
    } catch (error) {
      console.error("Delete income error:", error);
      alert(error.message);
    }
  };

  const startEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      date: expense.date || "",
      category: expense.category || "",
      amount: expense.amount ? String(expense.amount) : "",
      receipt: expense.receipt || "",
    });
    setView("simple");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startEditIncome = (entry) => {
    setEditingIncome(entry);
    setIncomeForm({
      date: entry.date || "",
      source: entry.source || "",
      amount: entry.amount ? String(entry.amount) : "",
    });
    setView("simple");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const exportCSV = () => {
    const rows = [
      ["Type", "Date", "Category/Source", "Amount"],
      ...expenses.map((e) => [
        "Expense",
        e.date || "",
        e.category || "",
        Number(e.amount || 0).toFixed(2),
      ]),
      ...income.map((i) => [
        "Income",
        i.date || "",
        i.source || "",
        Number(i.amount || 0).toFixed(2),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ten-back-precision-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredExpenses = useMemo(() => {
    return filterCategory === "All"
      ? expenses
      : expenses.filter((e) => e.category === filterCategory);
  }, [expenses, filterCategory]);

  const totalExpenses = expenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );
  const totalIncome = income.reduce(
    (sum, i) => sum + Number(i.amount || 0),
    0
  );
  const profit = totalIncome - totalExpenses;

  const monthlyStats = useMemo(() => {
    const grouped = {};

    expenses.forEach((e) => {
      const key = e.date ? e.date.slice(0, 7) : "No Date";
      if (!grouped[key]) grouped[key] = { income: 0, expenses: 0 };
      grouped[key].expenses += Number(e.amount || 0);
    });

    income.forEach((i) => {
      const key = i.date ? i.date.slice(0, 7) : "No Date";
      if (!grouped[key]) grouped[key] = { income: 0, expenses: 0 };
      grouped[key].income += Number(i.amount || 0);
    });

    return Object.entries(grouped)
      .map(([month, values]) => ({
        month,
        income: values.income,
        expenses: values.expenses,
        profit: values.income - values.expenses,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [expenses, income]);

  const receipts = expenses.filter((e) => e.receipt);

  const chartData = useMemo(() => {
    const grouped = filteredExpenses.reduce((acc, item) => {
      const key = item.category || "Other";
      acc[key] = (acc[key] || 0) + Number(item.amount || 0);
      return acc;
    }, {});

    return Object.entries(grouped).map(([category, amount]) => ({
      category,
      amount,
    }));
  }, [filteredExpenses]);

  const maxChartValue = Math.max(...chartData.map((c) => c.amount), 1);

  if (!user && !isLocalDev) {
    return (
      <div
        style={{
          background: appStyles.background,
          minHeight: "100vh",
          padding: "20px",
          color: appStyles.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Card style={{ width: "100%", maxWidth: "420px" }}>
          <h1 style={{ color: appStyles.accent, marginTop: 0 }}>
            🎳 TEN BACK PRECISION
          </h1>
          <p style={{ color: appStyles.muted, marginBottom: "18px" }}>
            Sign in to keep your bowling LLC data synced across devices.
          </p>

          <input
            type="email"
            placeholder="Email"
            value={authForm.email}
            onChange={(e) =>
              setAuthForm({ ...authForm, email: e.target.value })
            }
            style={fieldStyle}
          />
          <div style={{ height: "10px" }} />
          <input
            type="password"
            placeholder="Password"
            value={authForm.password}
            onChange={(e) =>
              setAuthForm({ ...authForm, password: e.target.value })
            }
            style={fieldStyle}
          />

          {authError && (
            <p style={{ color: "#ffd2c2", fontSize: "14px" }}>{authError}</p>
          )}

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Button onClick={handleAuth} disabled={authLoading}>
              {authLoading
                ? "Working..."
                : authMode === "login"
                ? "Log In"
                : "Create Account"}
            </Button>

            <Button
              onClick={() => {
                setAuthMode(authMode === "login" ? "signup" : "login");
                setAuthError("");
              }}
              style={{ background: appStyles.accent2 }}
            >
              {authMode === "login" ? "Need an account?" : "Have an account?"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        background: appStyles.background,
        minHeight: "100vh",
        padding: mobileStack ? "16px" : "20px",
        color: "#fff",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: mobileStack ? "flex-start" : "center",
          gap: "14px",
          flexDirection: mobileStack ? "column" : "row",
          marginBottom: "8px",
        }}
      >
        <div>
<h1
  style={{
    color: appStyles.accent,
    marginBottom: "6px",
    marginTop: 0,
    fontSize: mobileStack ? "28px" : "34px",
  }}
>
  🎳 TEN BACK PRECISION v416
</h1>          <p
            style={{
              color: appStyles.muted,
              marginTop: 0,
              marginBottom: "18px",
              maxWidth: "700px",
            }}
          >
            Bowling LLC tracker for expenses, income, receipts, and reports. BUILD V416.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {!isLocalDev && (
            <Button
              onClick={() => signOut(auth)}
              style={{ background: appStyles.accent2 }}
            >
              Log Out
            </Button>
          )}
          <Button
            onClick={() => setView("simple")}
            style={{
              background:
                view === "simple" ? appStyles.accent : "rgba(255,255,255,0.08)",
            }}
          >
            Simple
          </Button>
          <Button
            onClick={() => setView("dashboard")}
            style={{
              background:
                view === "dashboard"
                  ? appStyles.accent
                  : "rgba(255,255,255,0.08)",
            }}
          >
            Dashboard
          </Button>
          <Button onClick={exportCSV}>Export CSV</Button>
        </div>
      </div>

      {view === "simple" && (
        <>
          <Card>
            <h2 style={{ marginTop: 0 }}>
              {editingExpense ? "Edit Expense" : "Quick Expense"}
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobileStack
                  ? "1fr"
                  : "1.1fr 1.1fr 1fr auto",
                gap: "10px",
                alignItems: "start",
              }}
            >
              <input
                type="date"
                value={expenseForm.date}
                onChange={(e) =>
                  setExpenseForm({ ...expenseForm, date: e.target.value })
                }
                style={fieldStyle}
              />

              <select
                value={expenseForm.category}
                onChange={(e) =>
                  setExpenseForm({ ...expenseForm, category: e.target.value })
                }
                style={lightSelectStyle}
              >
                <option value="">Category</option>
                <option value="Tournament">Tournament</option>
                <option value="Equipment">Equipment</option>
                <option value="Travel">Travel</option>
                <option value="Food">Food</option>
                <option value="Practice">Practice</option>
                <option value="Other">Other</option>
              </select>

              <input
                placeholder="Amount"
                value={expenseForm.amount}
                onChange={(e) =>
                  setExpenseForm({ ...expenseForm, amount: e.target.value })
                }
                style={fieldStyle}
              />

              <label
                style={{
                  ...fieldStyle,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  marginBottom: 0,
                }}
              >
                {expenseForm.receipt ? "Receipt Added" : "Upload Receipt"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setExpenseForm((prev) => ({
                        ...prev,
                        receipt: reader.result,
                      }));
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>

            {expenseForm.receipt && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    opacity: 0.7,
                    marginBottom: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  📸 Receipt Preview
                </p>

                <img
                  src={expenseForm.receipt}
                  alt="receipt preview"
                  style={{
                    width: "100%",
                    maxWidth: "240px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
              </div>
            )}

            <div
              style={{
                marginTop: "12px",
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <Button
                onClick={addExpense}
                style={{
                  width: mobileStack ? "100%" : "auto",
                  minHeight: "48px",
                }}
              >
                {editingExpense ? "Update Expense" : "Add Expense"}
              </Button>

              {editingExpense && (
                <Button
                  onClick={() => {
                    setEditingExpense(null);
                    setExpenseForm({
                      date: "",
                      category: "",
                      amount: "",
                      receipt: "",
                    });
                  }}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>
              {editingIncome ? "Edit Income" : "Add Income"}
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobileStack ? "1fr" : "1fr 1.3fr 1fr auto",
                gap: "10px",
                alignItems: "start",
              }}
            >
              <input
                type="date"
                value={incomeForm.date}
                onChange={(e) =>
                  setIncomeForm({ ...incomeForm, date: e.target.value })
                }
                style={fieldStyle}
              />

              <input
                placeholder="Source"
                value={incomeForm.source}
                onChange={(e) =>
                  setIncomeForm({ ...incomeForm, source: e.target.value })
                }
                style={fieldStyle}
              />

              <input
                placeholder="Amount"
                value={incomeForm.amount}
                onChange={(e) =>
                  setIncomeForm({ ...incomeForm, amount: e.target.value })
                }
                style={fieldStyle}
              />

              <Button
                onClick={addIncome}
                style={{
                  width: mobileStack ? "100%" : "auto",
                  minHeight: "48px",
                }}
              >
                {editingIncome ? "Update Income" : "Add Income"}
              </Button>
            </div>

            {editingIncome && (
              <div style={{ marginTop: "12px" }}>
                <Button
                  onClick={() => {
                    setEditingIncome(null);
                    setIncomeForm({
                      date: "",
                      source: "",
                      amount: "",
                    });
                  }}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </Card>
        </>
      )}

      {view === "dashboard" && (
        <>
          <Card>
            <h2 style={{ marginTop: 0 }}>Overview</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobileStack ? "1fr" : "repeat(3, 1fr)",
                gap: "12px",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.06)",
                  padding: "14px",
                  borderRadius: "14px",
                }}
              >
                <p style={{ color: appStyles.muted, marginBottom: "6px" }}>
                  Income
                </p>
                <h3 style={{ margin: 0 }}>${totalIncome.toFixed(2)}</h3>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.06)",
                  padding: "14px",
                  borderRadius: "14px",
                }}
              >
                <p style={{ color: appStyles.muted, marginBottom: "6px" }}>
                  Expenses
                </p>
                <h3 style={{ margin: 0 }}>${totalExpenses.toFixed(2)}</h3>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.06)",
                  padding: "14px",
                  borderRadius: "14px",
                }}
              >
                <p style={{ color: appStyles.muted, marginBottom: "6px" }}>
                  Profit
                </p>
                <h3
                  style={{
                    margin: 0,
                    color: profit >= 0 ? appStyles.success : appStyles.danger,
                  }}
                >
                  ${profit.toFixed(2)}
                </h3>
              </div>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Monthly Breakdown</h2>

            {monthlyStats.length === 0 ? (
              <p style={{ opacity: 0.6 }}>No data yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
                {monthlyStats.map((m) => (
                  <div
                    key={m.month}
                    style={{
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <strong>{formatMonth(m.month)}</strong>

                    <div
                      style={{
                        fontSize: "13px",
                        marginTop: "6px",
                        opacity: 0.85,
                      }}
                    >
                      Income: ${m.income.toFixed(2)}
                      <br />
                      Expenses: ${m.expenses.toFixed(2)}
                      <br />
                      Profit:{" "}
                      <span
                        style={{
                          color:
                            m.profit >= 0
                              ? appStyles.success
                              : appStyles.danger,
                        }}
                      >
                        ${m.profit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Receipt Gallery</h2>

            {receipts.length === 0 ? (
              <p style={{ opacity: 0.6 }}>No receipts uploaded yet.</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: mobileStack
                    ? "repeat(2, 1fr)"
                    : "repeat(4, 1fr)",
                  gap: "12px",
                }}
              >
                {receipts.map((e, idx) => (
                  <div
                    key={e.id || idx}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "12px",
                      padding: "8px",
                    }}
                  >
                    <img
                      src={e.receipt}
                      alt="receipt"
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedReceipt(e.receipt)}
                    />

                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "12px",
                        opacity: 0.8,
                      }}
                    >
                      <div>{e.date || "No date"}</div>
                      <div>{e.category || "No category"}</div>
                      <div>${Number(e.amount || 0).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Expense Filter</h2>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={lightSelectStyle}
            >
              <option value="All">All Categories</option>
              <option value="Tournament">Tournament</option>
              <option value="Equipment">Equipment</option>
              <option value="Travel">Travel</option>
              <option value="Food">Food</option>
              <option value="Practice">Practice</option>
              <option value="Other">Other</option>
            </select>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Expenses</h2>

            {dataLoading ? (
              <p>Loading...</p>
            ) : filteredExpenses.length === 0 ? (
              <p style={{ opacity: 0.7 }}>No expenses yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {filteredExpenses.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      padding: "12px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong>{e.category || "Uncategorized"}</strong>
                        <div style={{ fontSize: "13px", opacity: 0.8 }}>
                          {e.date || "No date"}
                        </div>
                        <div style={{ marginTop: "6px" }}>
                          ${Number(e.amount || 0).toFixed(2)}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <Button
                          onClick={() => startEditExpense(e)}
                          style={{
                            background: appStyles.warning,
                            color: "#111",
                            padding: "6px 10px",
                            fontSize: "12px",
                          }}
                        >
                          Edit
                        </Button>

                        <Button
                          onClick={() => deleteExpense(e.id)}
                          style={{
                            background: appStyles.danger,
                            padding: "6px 10px",
                            fontSize: "12px",
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    {e.receipt && (
                      <img
                        src={e.receipt}
                        alt="receipt"
                        style={{
                          width: "70px",
                          height: "70px",
                          objectFit: "cover",
                          borderRadius: "8px",
                          cursor: "pointer",
                          border: "1px solid rgba(255,255,255,0.12)",
                          marginTop: "10px",
                        }}
                        onClick={() => setSelectedReceipt(e.receipt)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Income</h2>

            {income.length === 0 ? (
              <p style={{ opacity: 0.7 }}>No income yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {income.map((i) => (
                  <div
                    key={i.id}
                    style={{
                      padding: "12px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong>{i.source || "No source"}</strong>
                        <div style={{ fontSize: "13px", opacity: 0.8 }}>
                          {i.date || "No date"}
                        </div>
                        <div style={{ marginTop: "6px" }}>
                          ${Number(i.amount || 0).toFixed(2)}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <Button
                          onClick={() => startEditIncome(i)}
                          style={{
                            background: appStyles.warning,
                            color: "#111",
                            padding: "6px 10px",
                            fontSize: "12px",
                          }}
                        >
                          Edit
                        </Button>

                        <Button
                          onClick={() => deleteIncome(i.id)}
                          style={{
                            background: appStyles.danger,
                            padding: "6px 10px",
                            fontSize: "12px",
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Spending by Category</h2>

            {chartData.length === 0 ? (
              <p style={{ opacity: 0.7 }}>No data to chart yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {chartData.map((item) => (
                  <div key={item.category}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                        fontSize: "13px",
                      }}
                    >
                      <span>{item.category}</span>
                      <span>${item.amount.toFixed(2)}</span>
                    </div>

                    <div
                      style={{
                        width: "100%",
                        height: "12px",
                        background: "rgba(255,255,255,0.08)",
                        borderRadius: "999px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${(item.amount / maxChartValue) * 100}%`,
                          height: "100%",
                          background: `linear-gradient(90deg, ${appStyles.accent2}, ${appStyles.accent})`,
                          borderRadius: "999px",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {selectedReceipt && (
        <div
          onClick={() => setSelectedReceipt(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            cursor: "pointer",
            padding: "20px",
          }}
        >
          <div style={{ position: "relative", textAlign: "center" }}>
            <button
              onClick={() => setSelectedReceipt(null)}
              style={{
                position: "absolute",
                top: "-12px",
                right: "-12px",
                width: "36px",
                height: "36px",
                borderRadius: "999px",
                border: "none",
                background: appStyles.danger,
                color: "#fff",
                fontSize: "20px",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: appStyles.shadow,
              }}
            >
              ×
            </button>

            <img
              src={selectedReceipt}
              alt="full receipt"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "90vw",
                maxHeight: "80vh",
                borderRadius: "12px",
                boxShadow: "0 0 30px rgba(0,0,0,0.7)",
              }}
            />
            <p style={{ marginTop: "10px", color: "#ccc" }}>
              Tap anywhere to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}