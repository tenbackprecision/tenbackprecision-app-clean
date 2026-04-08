import React, { useState, useEffect } from "react";
const Card = ({ children }) => <div style={{ border: "1px solid #ccc", padding: "10px", borderRadius: "10px" }}>{children}</div>;
const CardContent = ({ children }) => <div>{children}</div>;
const Button = ({ children, onClick }) => <button onClick={onClick} style={{ padding: "10px", marginTop: "5px" }}>{children}</button>;
const Input = (props) => <input {...props} style={{ padding: "8px", margin: "5px 0" }} />;

export default function BowlingLLCApp() {
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [view, setView] = useState("simple");

  const [expenseForm, setExpenseForm] = useState({ date: "", category: "", amount: "", note: "" });
  const [incomeForm, setIncomeForm] = useState({ date: "", source: "", amount: "", note: "" });

  // LOAD FROM LOCAL STORAGE
  useEffect(() => {
    const savedExpenses = JSON.parse(localStorage.getItem("expenses")) || [];
    const savedIncome = JSON.parse(localStorage.getItem("income")) || [];
    setExpenses(savedExpenses);
    setIncome(savedIncome);
  }, []);

  // SAVE TO LOCAL STORAGE
  useEffect(() => {
    localStorage.setItem("expenses", JSON.stringify(expenses));
    localStorage.setItem("income", JSON.stringify(income));
  }, [expenses, income]);

  const addExpense = () => {
    if (!expenseForm.date || !expenseForm.category || !expenseForm.amount) return;
    setExpenses([...expenses, { ...expenseForm, amount: parseFloat(expenseForm.amount) }]);
    setExpenseForm({ date: "", category: "", amount: "", note: "" });
  };

  const addIncome = () => {
    if (!incomeForm.date || !incomeForm.source || !incomeForm.amount) return;
    setIncome([...income, { ...incomeForm, amount: parseFloat(incomeForm.amount) }]);
    setIncomeForm({ date: "", source: "", amount: "", note: "" });
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const profit = totalIncome - totalExpenses;

  const exportCSV = () => {
    const rows = [
      ["Type","Date","Category/Source","Amount","Note"],
      ...expenses.map(e => ["Expense", e.date, e.category, e.amount, e.note]),
      ...income.map(i => ["Income", i.date, i.source, i.amount, i.note])
    ];

    const csvContent = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bowling_llc_finances.csv";
    a.click();
  };

  return (
    <div className="p-6 grid gap-6">
      <h1 className="text-2xl font-bold">🎳 Ten Back Precision Tracker</h1>

      <div className="flex gap-2">
        <Button onClick={() => setView("simple")}>Simple</Button>
        <Button onClick={() => setView("dashboard")}>Dashboard</Button>
      </div>

      {view === "simple" && (
        <>
          <Card>
            <CardContent className="p-4 grid gap-3">
              <h2 className="text-xl font-bold">Quick Expense</h2>
              <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
              <Input placeholder="Category" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} />
              <Input type="number" placeholder="Amount" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
              <Input placeholder="Note" value={expenseForm.note} onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })} />
              <Button onClick={addExpense}>Add Expense</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 grid gap-3">
              <h2 className="text-xl font-bold">Quick Income</h2>
              <Input type="date" value={incomeForm.date} onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })} />
              <Input placeholder="Source" value={incomeForm.source} onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })} />
              <Input type="number" placeholder="Amount" value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} />
              <Input placeholder="Note" value={incomeForm.note} onChange={(e) => setIncomeForm({ ...incomeForm, note: e.target.value })} />
              <Button onClick={addIncome}>Add Income</Button>
            </CardContent>
          </Card>
        </>
      )}

      {view === "dashboard" && (
        <>
          <Card>
            <CardContent className="p-4">
              <h2 className="text-xl font-bold">Overview</h2>
              <p>Total Income: ${totalIncome.toFixed(2)}</p>
              <p>Total Expenses: ${totalExpenses.toFixed(2)}</p>
              <p className="text-lg font-bold">Profit: ${profit.toFixed(2)}</p>
              <Button onClick={exportCSV} className="mt-3">Export CSV</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="text-xl font-bold">Expenses</h2>
              {expenses.map((e, i) => (
                <div key={i} className="border p-2 rounded-xl mb-2">
                  {e.date} | {e.category} | ${e.amount.toFixed(2)}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="text-xl font-bold">Income</h2>
              {income.map((i, idx) => (
                <div key={idx} className="border p-2 rounded-xl mb-2">
                  {i.date} | {i.source} | ${i.amount.toFixed(2)}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
