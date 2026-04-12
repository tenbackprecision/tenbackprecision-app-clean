import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

/* ---------- FIREBASE ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyDXtklrqnwH7lisLkF2xg12bLS3fhKTdco",
  authDomain: "ten-back-tracker.firebaseapp.com",
  projectId: "ten-back-tracker",
  storageBucket: "ten-back-tracker.firebasestorage.app",
  messagingSenderId: "565303600694",
  appId: "1:565303600694:web:c6a21ad7decf1493ab5a97"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ---------- STYLES ---------- */
const appStyles = {
  background: "linear-gradient(135deg, #0a1f44 0%, #08162f 100%)",
  panel: "rgba(16, 42, 92, 0.9)",
  accent: "#fb4f14",
  accent2: "#2f6db5",
  text: "#f9fafb",
  muted: "#c7d2e3",
  border: "rgba(255,255,255,0.12)",
  shadow: "0 10px 30px rgba(0,0,0,0.35)"
};

const fieldStyle = {
  width: "100%",
  padding: "12px 14px",
  marginBottom: "10px",
  borderRadius: "12px",
  border: `1px solid ${appStyles.border}`,
  background: "rgba(255,255,255,0.08)",
  color: appStyles.text,
  boxSizing: "border-box",
  outline: "none"
};

const lightSelectStyle = {
  width: "100%",
  padding: "12px 14px",
  marginBottom: "10px",
  borderRadius: "12px",
  border: `1px solid ${appStyles.border}`,
  background: "#ffffff",
  color: "#000000",
  boxSizing: "border-box",
  outline: "none"
};

/* ---------- UI ---------- */
const Button = ({ children, onClick, style, type = "button", disabled = false }) => (
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
      ...style
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
      ...style
    }}
  >
    {children}
  </div>
);

/* ---------- APP ---------- */
export default function App() {
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
    receipt: ""
  });

  const [incomeForm, setIncomeForm] = useState({
    date: "",
    source: "",
    amount: ""
  });

  const mobileStack = typeof window !== "undefined" && window.innerWidth < 700;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
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

        const [expSnap, incSnap] = await Promise.all([
          getDocs(expenseQuery),
          getDocs(incomeQuery)
        ]);

        setExpenses(expSnap.docs.map((doc) => doc.data()));
        setIncome(incSnap.docs.map((doc) => doc.data()));
      } catch (error) {
        console.error("Load error:", error);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleAuth = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      } else {
        await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
      setAuthForm({ email: "", password: "" });
    } catch (error) {
      setAuthError(error.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const addExpense = async () => {
    if (!expenseForm.amount || !user) return;

    const newExpense = {
      ...expenseForm,
      uid: user.uid,
      amount: Number(expenseForm.amount),
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, "expenses"), newExpense);
    setExpenses((prev) => [...prev, newExpense]);
    setExpenseForm({ date: "", category: "", amount: "", receipt: "" });
  };

  const addIncome = async () => {
    if (!incomeForm.amount || !user) return;

    const newIncome = {
      ...incomeForm,
      uid: user.uid,
      amount: Number(incomeForm.amount),
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, "income"), newIncome);
    setIncome((prev) => [...prev, newIncome]);
    setIncomeForm({ date: "", source: "", amount: "" });
  };

  const exportCSV = () => {
    const rows = [
      ["Type", "Date", "Category/Source", "Amount"],
      ...expenses.map((e) => ["Expense", e.date, e.category, e.amount]),
      ...income.map((i) => ["Income", i.date, i.source, i.amount])
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
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

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalIncome = income.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const profit = totalIncome - totalExpenses;

  const chartData = useMemo(() => {
    const grouped = filteredExpenses.reduce((acc, item) => {
      const key = item.category || "Other";
      acc[key] = (acc[key] || 0) + Number(item.amount || 0);
      return acc;
    }, {});

    return Object.entries(grouped).map(([category, amount]) => ({
      category,
      amount
    }));
  }, [filteredExpenses]);

  if (!user) {
    return (
      <div
        style={{
          background: appStyles.background,
          minHeight: "100vh",
          padding: "20px",
          color: appStyles.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Card style={{ width: "100%", maxWidth: "420px" }}>
          <h1 style={{ color: appStyles.accent, marginTop: 0 }}>🎳 TEN BACK PRECISION</h1>
          <p style={{ color: appStyles.muted, marginBottom: "18px" }}>
            Sign in to keep your bowling LLC data synced across devices.
          </p>

          <input
            type="email"
            placeholder="Email"
            value={authForm.email}
            onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
            style={fieldStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={authForm.password}
            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
            style={fieldStyle}
          />

          {authError && (
            <p style={{ color: "#ffd2c2", fontSize: "14px", marginTop: 0 }}>{authError}</p>
          )}

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Button onClick={handleAuth} disabled={authLoading}>
              {authLoading ? "Working..." : authMode === "login" ? "Log In" : "Create Account"}
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
        padding: "20px",
        color: "#fff",
        maxWidth: "1100px",
        margin: "0 auto"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: mobileStack ? "flex-start" : "center",
          gap: "14px",
          flexDirection: mobileStack ? "column" : "row"
        }}
      >
        <div>
          <h1 style={{ color: appStyles.accent, marginBottom: "6px" }}>🎳 TEN BACK PRECISION</h1>
          <p style={{ color: appStyles.muted, marginTop: 0, marginBottom: "18px" }}>
            Bowling LLC tracker for expenses, income, receipts, and reports.
          </p>
        </div>

        <Button onClick={() => signOut(auth)} style={{ background: appStyles.accent2 }}>
          Log Out
        </Button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "20px"
        }}
      >
        <Button onClick={() => setView("simple")}>Simple</Button>
        <Button onClick={() => setView("dashboard")} style={{ background: appStyles.accent2 }}>
          Dashboard
        </Button>
        <Button onClick={exportCSV}>Export CSV</Button>
      </div>

      {view === "simple" && (
        <>
          <Card>
            <h2 style={{ marginTop: 0 }}>Quick Expense</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobileStack ? "1fr" : "1.1fr 1.1fr 1fr 1.2fr auto",
                gap: "10px",
                alignItems: "start"
              }}
            >
              <input
                type="date"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                style={fieldStyle}
              />

              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
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
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                style={fieldStyle}
              />

              <label
                style={{
                  ...fieldStyle,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  marginBottom: 0
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
                      setExpenseForm({ ...expenseForm, receipt: reader.result });
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>

              <Button onClick={addExpense} style={{ width: mobileStack ? "100%" : "auto", minHeight: "48px" }}>
                Add
              </Button>
            </div>

            {expenseForm.receipt && (
              <img
                src={expenseForm.receipt}
                alt="receipt preview"
                style={{ width: "220px", maxWidth: "100%", marginTop: "12px", borderRadius: "12px" }}
              />
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Add Income</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobileStack ? "1fr" : "1fr 1.3fr 1fr auto",
                gap: "10px",
                alignItems: "start"
              }}
            >
              <input
                type="date"
                value={incomeForm.date}
                onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
                style={fieldStyle}
              />
              <input
                placeholder="Source"
                value={incomeForm.source}
                onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })}
                style={fieldStyle}
              />
              <input
                placeholder="Amount"
                value={incomeForm.amount}
                onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                style={fieldStyle}
              />
              <Button onClick={addIncome} style={{ width: mobileStack ? "100%" : "auto", minHeight: "48px" }}>
                Add
              </Button>
            </div>
          </Card>
        </>
      )}

      {view === "dashboard" && (
        <>
          <Card>
            <h2 style={{ marginTop: 0 }}>Overview</h2>
            {dataLoading ? (
              <p>Loading...</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: mobileStack ? "1fr" : "repeat(3, 1fr)",
                  gap: "12px"
                }}
              >
                <div>
                  <p style={{ color: appStyles.muted, marginBottom: "6px" }}>Income</p>
                  <h3 style={{ marginTop: 0 }}>${totalIncome.toFixed(2)}</h3>
                </div>
                <div>
                  <p style={{ color: appStyles.muted, marginBottom: "6px" }}>Expenses</p>
                  <h3 style={{ marginTop: 0 }}>${totalExpenses.toFixed(2)}</h3>
                </div>
                <div>
                  <p style={{ color: appStyles.muted, marginBottom: "6px" }}>Profit</p>
                  <h3 style={{ marginTop: 0, color: appStyles.accent }}>${profit.toFixed(2)}</h3>
                </div>
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
            {filteredExpenses.length === 0 ? (
              <p style={{ color: appStyles.muted }}>No expenses yet.</p>
            ) : (
              filteredExpenses.map((e, i) => (
                <div
                  key={`${e.createdAt || e.date}-${i}`}
                  style={{
                    padding: "12px 0",
                    borderBottom: i === filteredExpenses.length - 1 ? "none" : `1px solid ${appStyles.border}`
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {e.date || "No date"} • {e.category || "Other"} • ${Number(e.amount || 0).toFixed(2)}
                  </div>

                  {e.receipt && (
                    <img
                      src={e.receipt}
                      alt="receipt"
                      style={{
                        width: "120px",
                        marginTop: "8px",
                        borderRadius: "10px",
                        cursor: "pointer"
                      }}
                      onClick={() => setSelectedReceipt(e.receipt)}
                    />
                  )}
                </div>
              ))
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Spending by Category</h2>
            <div style={{ width: "100%", height: mobileStack ? 260 : 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                  <XAxis dataKey="category" stroke="#ffffff" />
                  <YAxis stroke="#ffffff" />
                  <Tooltip />
                  <Bar dataKey="amount" fill={appStyles.accent} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
            padding: "20px"
          }}
        >
          <div style={{ textAlign: "center" }}>
            <img
              src={selectedReceipt}
              alt="full receipt"
              style={{
                maxWidth: "90vw",
                maxHeight: "80vh",
                borderRadius: "12px",
                boxShadow: "0 0 30px rgba(0,0,0,0.7)"
              }}
            />
            <p style={{ marginTop: "10px", color: "#ccc" }}>Tap anywhere to close</p>
          </div>
        </div>
      )}
    </div>
  );
}