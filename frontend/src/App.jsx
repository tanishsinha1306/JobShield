
import { useEffect, useState } from "react";

const API_BASE = "https://jobshield-ai-backend-1cuw.onrender.com";

const initialForm = {
  title: "",
  company_profile: "",
  description: "",
  requirements: "",
  benefits: "",
};

function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("jobshield-theme") || "light"
  );

  const [page, setPage] = useState("analyze");
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [error, setError] = useState("");

  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);

  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem("jobshield-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (page === "dashboard") { fetchAnalytics(); fetchHistory(); }
    if (page === "history") fetchHistory();
  }, [page]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const fillSample = () => {
    setForm({
      title: "Work From Home Data Entry Job",
      company_profile: "ABC Technologies is a growing company.",
      description:
        "Earn huge money from home. No experience required. Pay a registration fee to get your job immediately.",
      requirements: "Basic computer knowledge.",
      benefits: "High salary and flexible working hours.",
    });
    setResult(null);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to analyze job.");
      }

      setResult(data);
    } catch (err) {
      setError(
        err.message.includes("Failed to fetch")
          ? "Backend connection failed. Start your FastAPI server."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };


  const downloadReport = async () => {
    if (!result?.id) {
      setReportError("Report ID is missing. Please analyze the job again.");
      return;
    }

    setReportLoading(true);
    setReportError("");

    try {
      const response = await fetch(
        `${API_BASE}/reports/${encodeURIComponent(result.id)}/pdf`
      );

      if (!response.ok) {
        let message = "Unable to generate PDF report.";
        try {
          const data = await response.json();
          message = data.detail || message;
        } catch {
          // Keep the default error when the response is not JSON.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `JobShield_AI_Report_${result.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setReportError(
        err.message.includes("Failed to fetch")
          ? "Backend connection failed. Please check the FastAPI server."
          : err.message
      );
    } finally {
      setReportLoading(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setResult(null);
    setError("");
  };

  // --------------------------------
  // DASHBOARD ANALYTICS
  // --------------------------------

  const fetchAnalytics = async () => {
    setDashboardLoading(true);

    try {
      const response = await fetch(`${API_BASE}/analytics`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load analytics.");
      }

      setAnalytics(data);
    } catch (err) {
      setAnalytics(null);
      setError(err.message);
    } finally {
      setDashboardLoading(false);
    }
  };

  // --------------------------------
  // PREDICTION HISTORY
  // --------------------------------

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await fetch(`${API_BASE}/history?limit=100&skip=0`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load history.");
      }

      setHistory(data.history || []);
      setHistoryTotal(data.total || 0);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteHistory = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/history/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to delete record.");
      }

      await fetchHistory();
    } catch (err) {
      setHistoryError(err.message);
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.company_profile?.toLowerCase().includes(search.toLowerCase());

    const matchesFilter =
      filter === "all" ||
      (filter === "fraud" && item.prediction === 1) ||
      (filter === "genuine" && item.prediction === 0);

    return matchesSearch && matchesFilter;
  });

  const dashboardRecords = history;
  const riskValues = dashboardRecords.map((item) => Number(item.risk_assessment?.risk_score)).filter(Number.isFinite);
  const qualityValues = dashboardRecords.map((item) => Number(item.advanced_job_analysis?.job_quality_score)).filter(Number.isFinite);
  const average = (values) => values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "—";
  const riskBuckets = [
    { label: "Low", min: 0, max: 24.99, color: "bg-emerald-500" },
    { label: "Moderate", min: 25, max: 49.99, color: "bg-amber-400" },
    { label: "High", min: 50, max: 74.99, color: "bg-orange-500" },
    { label: "Critical", min: 75, max: 100, color: "bg-red-500" },
  ].map((b) => ({ ...b, count: riskValues.filter((v) => v >= b.min && v <= b.max).length }));
  const qualityBuckets = [
    { label: "Excellent", min: 90, max: 100, color: "bg-emerald-500" },
    { label: "Good", min: 75, max: 89.99, color: "bg-blue-500" },
    { label: "Fair", min: 50, max: 74.99, color: "bg-amber-400" },
    { label: "Needs review", min: 0, max: 49.99, color: "bg-rose-500" },
  ].map((b) => ({ ...b, count: qualityValues.filter((v) => v >= b.min && v <= b.max).length }));
  const highRiskCount = riskValues.filter((v) => v >= 50).length;
  const averageCompany = average(dashboardRecords.map((item) => Number(item.company_credibility?.credibility_score)).filter(Number.isFinite));

  const probability = result
    ? (result.fraud_probability * 100).toFixed(2)
    : "0.00";

  const isFraud = result?.prediction === 1;

  // --------------------------------
  // STYLING
  // --------------------------------

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20";

  const labelClass =
    "mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300";

  const cardClass =
    "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#141b2d]";

  const headingClass =
    "text-2xl font-extrabold text-slate-900 dark:text-white";

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "analyze", label: "Analyze Job", icon: "⌕" },
    { id: "history", label: "Prediction History", icon: "◷" },
  ];

  // --------------------------------
  // REUSABLE STAT CARD
  // --------------------------------

  const StatCard = ({ title, value, icon, description }) => (
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <h3 className="mt-3 text-2xl font-extrabold sm:text-3xl">{value ?? "—"}</h3>
          <p className="mt-2 text-xs text-slate-400">{description}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-2xl text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
          {icon}
        </div>
      </div>
    </div>
  );

  // --------------------------------
  // MAIN UI
  // --------------------------------

  return (
    <div className={`${isDark ? "dark" : ""} w-full min-w-0 overflow-x-hidden`}>
      <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0b1020] dark:text-white">

        {/* NAVBAR */}

        <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-[#111827]/95">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-stretch gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 lg:px-8">

            <button
              onClick={() => setPage("dashboard")}
              className="flex items-center gap-3 text-left"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-700 text-2xl font-extrabold text-white shadow-lg">
                J
              </div>
              <div>
                <h1 className="text-xl font-extrabold">
                  JobShield <span className="text-indigo-600 dark:text-indigo-400">AI</span>
                </h1>
                <p className="text-[9px] font-bold tracking-[2px] text-slate-400">
                  INTELLIGENT JOB PROTECTION
                </p>
              </div>
            </button>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setPage(item.id);
                    setError("");
                  }}
                  className={`min-w-0 rounded-xl px-2 py-2.5 text-[11px] font-bold transition sm:px-4 sm:text-sm ${
                    page === item.id
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                </button>
              ))}

              <button
                onClick={toggleTheme}
                className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800"
              >
                {isDark ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
        </nav>

        <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">

          {/* ================================== */}
          {/* DASHBOARD */}
          {/* ================================== */}

          {page === "dashboard" && (
            <section className="space-y-7">
              <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-2xl sm:p-9">
                <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
                <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-indigo-100"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Live screening overview</span>
                    <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Analytics Dashboard</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100/75">A clear view of analyzed jobs, fraud predictions and screening quality.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { fetchAnalytics(); fetchHistory(); }} disabled={dashboardLoading || historyLoading} className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20 disabled:opacity-50">{dashboardLoading || historyLoading ? "Refreshing..." : "↻ Refresh dashboard"}</button>
                    <button onClick={() => setPage("analyze")} className="rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-indigo-900 shadow-lg">+ Analyze new job</button>
                  </div>
                </div>
                <div className="relative mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-5 text-xs text-indigo-100/70">
                  <span>Total records: <strong className="text-white">{analytics?.total_analyzed ?? "—"}</strong></span>
                  <span>History loaded: <strong className="text-white">{dashboardRecords.length}</strong></span>
                  <span>Model: <strong className="text-white">Logistic Regression</strong></span>
                </div>
              </div>

              {dashboardLoading && !analytics ? (
                <div className={cardClass + " py-16 text-center text-slate-500"}>Loading dashboard data...</div>
              ) : analytics ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { title: "Total jobs analyzed", value: analytics.total_analyzed ?? 0, detail: "All saved predictions", icon: "▤", tone: "indigo" },
                      { title: "Potentially fraudulent", value: analytics.fraudulent_jobs ?? 0, detail: `${analytics.fraud_percentage ?? 0}% of predictions`, icon: "⚠", tone: "rose" },
                      { title: "Likely genuine", value: analytics.genuine_jobs ?? 0, detail: "Not flagged by model", icon: "✓", tone: "emerald" },
                      { title: "High / critical risk", value: highRiskCount, detail: "Latest loaded records", icon: "◉", tone: "amber" },
                    ].map((item) => (
                      <div key={item.title} className={`${cardClass} group relative overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl`}>
                        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{item.title}</p><p className="mt-3 text-3xl font-black tabular-nums">{item.value}</p><p className="mt-2 text-xs text-slate-400">{item.detail}</p></div><span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl ${item.tone === "rose" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10" : item.tone === "emerald" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : item.tone === "amber" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10"}`}>{item.icon}</span></div>
                        <div className={`absolute bottom-0 left-0 h-1 w-full ${item.tone === "rose" ? "bg-rose-500" : item.tone === "emerald" ? "bg-emerald-500" : item.tone === "amber" ? "bg-amber-500" : "bg-indigo-500"}`} />
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      ["Average risk score", average(riskValues), "Based on available risk assessments"],
                      ["Average job quality", average(qualityValues), "Based on available job quality scores"],
                      ["Average company indicators", averageCompany, "Submitted-information indicators only"],
                    ].map(([label, value, detail]) => <div key={label} className={cardClass}><p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p><p className="mt-3 text-3xl font-black">{value}<span className="ml-1 text-sm font-semibold text-slate-400">/ 100</span></p><p className="mt-2 text-xs text-slate-400">{detail}</p></div>)}
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className={cardClass}>
                      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-extrabold">Prediction distribution</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Overall model classification</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{analytics.total_analyzed ?? 0} records</span></div>
                      <div className="mt-7 flex flex-col items-center gap-7 sm:flex-row">
                        <div className="relative h-44 w-44 shrink-0 rounded-full" style={{ background: `conic-gradient(#f43f5e 0 ${Number(analytics.fraud_percentage) || 0}%, #10b981 ${Number(analytics.fraud_percentage) || 0}% 100%)` }}><div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white dark:bg-[#141b2d]"><span className="text-3xl font-black">{analytics.fraud_percentage ?? 0}%</span><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fraud share</span></div></div>
                        <div className="w-full space-y-4">
                          <div><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">🔴 Potentially fraudulent</span><strong>{analytics.fraudulent_jobs ?? 0}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-rose-500" style={{ width: `${analytics.total_analyzed ? (analytics.fraudulent_jobs / analytics.total_analyzed) * 100 : 0}%` }} /></div></div>
                          <div><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">🟢 Likely genuine</span><strong>{analytics.genuine_jobs ?? 0}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${analytics.total_analyzed ? (analytics.genuine_jobs / analytics.total_analyzed) * 100 : 0}%` }} /></div></div>
                        </div>
                      </div>
                    </div>
                    <div className={cardClass}>
                      <h3 className="text-lg font-extrabold">Risk level distribution</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Latest history records with risk scores</p>
                      <div className="mt-7 space-y-5">{riskBuckets.map((b) => <div key={b.label}><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">{b.label}</span><strong>{b.count}</strong></div><div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${b.color}`} style={{ width: `${riskValues.length ? (b.count / riskValues.length) * 100 : 0}%` }} /></div></div>)}{!riskValues.length && <p className="text-sm text-slate-400">No risk assessment records available yet.</p>}</div>
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className={cardClass}><div className="flex items-start justify-between"><div><h3 className="text-lg font-extrabold">Job quality overview</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Advanced job analysis scores</p></div><span className="text-xs font-bold text-indigo-500">{qualityValues.length} scored</span></div><div className="mt-6 grid grid-cols-2 gap-3">{qualityBuckets.map((b) => <div key={b.label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/70"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${b.color}`} /><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{b.label}</span></div><p className="mt-2 text-2xl font-black">{b.count}</p></div>)}</div></div>
                    <div className={cardClass}><h3 className="text-lg font-extrabold">Recent screening activity</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Latest 7 prediction records</p><div className="mt-6 space-y-3">{dashboardRecords.slice(0, 7).length ? dashboardRecords.slice(0, 7).map((item) => <div key={item.id} className="flex items-center gap-3"><span className="w-16 shrink-0 text-[10px] text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full w-full rounded-full ${item.prediction === 1 ? "bg-rose-500" : "bg-emerald-500"}`} /></div><span className={`w-20 shrink-0 text-right text-[10px] font-bold ${item.prediction === 1 ? "text-rose-500" : "text-emerald-500"}`}>{item.prediction === 1 ? "Fraud flag" : "Genuine"}</span></div>) : <p className="text-sm text-slate-400">Analyze jobs to see recent activity.</p>}</div></div>
                  </div>

                  <div className={cardClass}>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-extrabold">Recent analyzed jobs</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Latest saved prediction records</p></div><button onClick={() => setPage("history")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">View all history →</button></div>
                    {historyLoading ? <p className="py-8 text-center text-sm text-slate-400">Loading recent jobs...</p> : dashboardRecords.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400 dark:border-slate-700"><th className="px-3 py-3">Job / Company</th><th className="px-3 py-3">Prediction</th><th className="px-3 py-3">Risk score</th><th className="px-3 py-3">Date</th></tr></thead><tbody>{dashboardRecords.slice(0, 5).map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="max-w-[260px] px-3 py-4"><p className="truncate font-bold">{item.title || "Untitled job"}</p><p className="mt-1 truncate text-xs text-slate-400">{item.company_profile || "Company not provided"}</p></td><td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.prediction === 1 ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>{item.prediction === 1 ? "Potentially fraudulent" : "Likely genuine"}</span></td><td className="px-3 py-4 font-bold">{item.risk_assessment?.risk_score != null ? `${Number(item.risk_assessment.risk_score).toFixed(1)}/100` : "—"}</td><td className="px-3 py-4 text-xs text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div> : <div className="py-10 text-center text-sm text-slate-400">No saved predictions yet. Analyze a job to populate analytics.</div>}
                  </div>
                  <p className="text-center text-[11px] leading-5 text-slate-400">Overall prediction totals use the existing analytics API. Risk, quality and company averages use the latest {dashboardRecords.length} records returned by the existing history API (maximum 100).</p>
                </>
              ) : <div className={cardClass + " py-12 text-center"}><p className="font-bold text-red-500">Unable to load analytics.</p><button onClick={fetchAnalytics} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Try Again</button></div>}
            </section>
          )}

                    {/* ANALYZE JOB */}
          {/* ================================== */}

          {page === "analyze" && (
            <>
              <section className="px-1 py-10 text-center sm:px-4 sm:py-16">
                <div className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-extrabold tracking-widest text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
                  ✦ AI-POWERED JOB SECURITY
                </div>

                <h2 className="mx-auto mt-6 max-w-4xl break-words text-3xl font-extrabold leading-tight sm:mt-7 sm:text-5xl lg:text-6xl">
                  Your Career Deserves
                  <br />
                  <span className="bg-gradient-to-r from-indigo-600 via-violet-500 to-blue-500 bg-clip-text text-transparent">
                    Authentic Opportunities.
                  </span>
                </h2>

                <p className="mx-auto mt-5 max-w-2xl px-2 text-sm leading-7 text-slate-500 dark:text-slate-400 sm:mt-6 sm:px-0 sm:text-base sm:leading-8">
                  Identify suspicious job postings using Machine Learning
                  and Natural Language Processing.
                </p>
              </section>

              <section className="mx-auto mb-12 w-full min-w-0 max-w-4xl sm:mb-16">
                <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold tracking-[2px] text-indigo-600 dark:text-indigo-400">
                      INTELLIGENT SCREENING
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
                      Analyze a Job Posting
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Enter job details to check their authenticity.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={fillSample}
                    className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                  >
                    ↗ Load Sample
                  </button>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-[#141b2d] dark:shadow-black/20 sm:rounded-3xl sm:p-6 md:p-9"
                >
                  <div className="mb-7 border-b border-slate-100 pb-6 dark:border-slate-800">
                    <h3 className="font-extrabold">Job Information</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Fields marked with * are required.
                    </p>
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                    <div className="sm:col-span-2">
                      <label className={labelClass} htmlFor="title">
                        Job Title *
                      </label>
                      <input
                        id="title"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        placeholder="e.g. Software Engineer"
                        required
                        maxLength={300}
                        className={inputClass}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelClass} htmlFor="company_profile">
                        Company Profile
                      </label>
                      <textarea
                        id="company_profile"
                        name="company_profile"
                        value={form.company_profile}
                        onChange={handleChange}
                        placeholder="Describe the hiring company..."
                        rows={3}
                        maxLength={10000}
                        className={inputClass}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelClass} htmlFor="description">
                        Job Description *
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        placeholder="Paste the complete job description..."
                        rows={5}
                        required
                        maxLength={30000}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass} htmlFor="requirements">
                        Requirements
                      </label>
                      <textarea
                        id="requirements"
                        name="requirements"
                        value={form.requirements}
                        onChange={handleChange}
                        placeholder="Skills, qualifications, experience..."
                        rows={4}
                        maxLength={15000}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass} htmlFor="benefits">
                        Benefits
                      </label>
                      <textarea
                        id="benefits"
                        name="benefits"
                        value={form.benefits}
                        onChange={handleChange}
                        placeholder="Salary, incentives, benefits..."
                        rows={4}
                        maxLength={10000}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                      ⚠ {error}
                    </div>
                  )}

                  <div className="mt-8 flex min-w-0 flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-4 text-center text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60 sm:px-6"
                    >
                      {loading ? "Analyzing Job..." : "✦ Analyze Job Posting →"}
                    </button>

                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-xl border border-slate-200 px-6 py-4 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      Clear Form
                    </button>
                  </div>

                  <p className="mt-5 text-center text-xs text-slate-400">
                    Powered by your trained Machine Learning model.
                  </p>
                </form>
              </section>

              {/* PREDICTION RESULT */}

              {result && (
                <section className="mx-auto mb-20 max-w-4xl">
                  <div className="mb-6">
                    <p className="text-xs font-extrabold tracking-[2px] text-indigo-600 dark:text-indigo-400">
                      ANALYSIS COMPLETE
                    </p>
                    <h2 className="mt-2 text-3xl font-extrabold">
                      Screening Results
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Download a detailed report containing prediction results, risk indicators and model explanations.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={downloadReport}
                        disabled={reportLoading}
                        className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reportLoading ? "Generating PDF..." : "↓ Download Detailed PDF Report"}
                      </button>
                      <span className="text-xs text-slate-400">
                        PDF · Prediction · Risk · Company · Job Analysis · Explainable AI
                      </span>
                    </div>
                    {reportError && (
                      <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                        {reportError}
                      </p>
                    )}
                  </div>

                  <div
                    className={`rounded-3xl border p-6 sm:p-8 ${
                      isFraud
                        ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
                        : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20"
                    }`}
                  >
                    <p className="text-xs font-extrabold tracking-widest text-slate-500 dark:text-slate-400">
                      {isFraud ? "POTENTIAL RISK DETECTED" : "NO RISK FLAGGED"}
                    </p>

                    <h3 className="mt-2 text-2xl font-extrabold">
                      {result.label}
                    </h3>

                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {isFraud
                        ? "The model identified patterns associated with potentially fraudulent job postings."
                        : "The model did not flag this posting as potentially fraudulent."}
                    </p>

                    <div className="mt-8 border-t border-slate-200/70 pt-6 dark:border-slate-700">
                      <div className="flex justify-between">
                        <span className="text-sm font-bold">
                          Fraud Probability
                        </span>
                        <strong className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                          {probability}%
                        </strong>
                      </div>

                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${
                            isFraud ? "bg-red-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${probability}%` }}
                        />
                      </div>

                      <div className="mt-3 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>0%</span>
                        <span>
                          Threshold: {(result.threshold * 100).toFixed(2)}%
                        </span>
                        <span>100%</span>
                      </div>
                    </div>

                    <div className="mt-6 grid min-w-0 grid-cols-1 gap-3 border-t border-slate-200/70 pt-6 sm:grid-cols-2 sm:gap-4">
                      <div className="rounded-xl bg-white/80 p-4 dark:bg-slate-900/60">
                        <p className="text-xs text-slate-500">Prediction Class</p>
                        <strong className="mt-2 block text-sm">
                          {result.prediction === 1
                            ? "Class 1 · Fraudulent"
                            : "Class 0 · Genuine"}
                        </strong>
                      </div>

                      <div className="rounded-xl bg-white/80 p-4 dark:bg-slate-900/60">
                        <p className="text-xs text-slate-500">ML Algorithm</p>
                        <strong className="mt-2 block text-sm">
                          {result.model}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* INTELLIGENT FRAUD RISK ASSESSMENT */}

                  {result.risk_assessment && (
                    <RiskAssessmentCard assessment={result.risk_assessment} />
                  )}

                  {/* JOB INTELLIGENCE REPORT */}

                  {result.extracted_data && (
                    <JobIntelligenceCard data={result.extracted_data} />
                  )}

                  {/* COMPANY CREDIBILITY ANALYSIS */}

                  {result.company_credibility && (
                    <CompanyCredibilityCard assessment={result.company_credibility} />
                  )}

                  {/* PHASE 4 - ADVANCED JOB ANALYSIS */}

                  {result.advanced_job_analysis && (
                    <AdvancedJobAnalysisCard
                      analysis={result.advanced_job_analysis}
                    />
                  )}

                  {/* EXPLAINABLE AI */}

                  {result.explanation && (
                    <div className="mt-10">
                      <h3 className="text-xl font-extrabold">
                        ✦ Explainable AI
                      </h3>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Words and phrases that influenced the model's prediction.
                      </p>

                      <div className="mt-6 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                        <SignalCard
                          title="Risk Signals"
                          items={result.explanation.risk_signals}
                          positive
                        />

                        <SignalCard
                          title="Signals Lowering Fraud Score"
                          items={result.explanation.genuine_signals}
                        />
                      </div>

                      <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-xs leading-6 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
                        Positive contributions increase fraud log-odds.
                        Negative contributions decrease fraud log-odds.
                        These are feature contributions, not percentages or
                        proof of fraud.
                        <p className="mt-2">
                          Method: {result.explanation.explanation_method}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                    ⓘ {result.disclaimer}
                  </div>

                  <button
                    onClick={() => {
                      setResult(null);
                      setForm(initialForm);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white"
                  >
                    Analyze Another Job
                  </button>
                </section>
              )}
            </>
          )}

          {/* ================================== */}
          {/* PREDICTION HISTORY */}
          {/* ================================== */}

          {page === "history" && (
            <section>
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold tracking-[2px] text-indigo-600 dark:text-indigo-400">
                    DATABASE RECORDS
                  </p>
                  <h2 className="mt-2 text-3xl font-extrabold">
                    Prediction History
                  </h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    All previously analyzed jobs saved in MongoDB Atlas.
                  </p>
                </div>

                <button
                  onClick={fetchHistory}
                  disabled={historyLoading}
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {historyLoading ? "Refreshing..." : "↻ Refresh History"}
                </button>
              </div>

              <div className={cardClass}>
                <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div>
                    <h3 className="text-lg font-extrabold">Saved Predictions</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {historyTotal} total records
                    </p>
                  </div>

                  <span className="rounded-full bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                    MongoDB Atlas
                  </span>
                </div>

                <div className="mb-5 grid gap-3 sm:grid-cols-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search job title or company..."
                    className={inputClass}
                  />

                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className={inputClass}
                  >
                    <option value="all">All Predictions</option>
                    <option value="fraud">Potentially Fraudulent</option>
                    <option value="genuine">Likely Genuine</option>
                  </select>
                </div>

                {historyError && (
                  <div className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">
                    {historyError}
                  </div>
                )}

                {historyLoading ? (
                  <div className="py-12 text-center text-sm text-slate-500">
                    Loading prediction history...
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-4xl">◷</div>
                    <h3 className="mt-4 font-bold">No records found</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Analyze a job to create your first history record.
                    </p>
                    <button
                      onClick={() => setPage("analyze")}
                      className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white"
                    >
                      Analyze a Job
                    </button>
                  </div>
                ) : (
                  <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-xl">
                    <table className="w-full min-w-[900px] text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-700">
                          <th className="px-4 py-4">Job Title</th>
                          <th className="px-4 py-4">Company</th>
                          <th className="px-4 py-4">Prediction</th>
                          <th className="px-4 py-4">Probability</th>
                          <th className="px-4 py-4">Risk Score</th>
                          <th className="px-4 py-4">Company Score</th>
                          <th className="px-4 py-4">Date</th>
                          <th className="px-4 py-4">Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredHistory.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-4 py-5 font-bold">
                              {item.title || "Untitled"}
                            </td>

                            <td className="px-4 py-5 text-slate-500 dark:text-slate-400">
                              {item.company_profile || "Not provided"}
                            </td>

                            <td className="px-4 py-5">
                              <span
                                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                                  item.prediction === 1
                                    ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                }`}
                              >
                                {item.prediction === 1
                                  ? "Potentially Fraudulent"
                                  : "Likely Genuine"}
                              </span>
                            </td>

                            <td className="px-4 py-5 font-bold">
                              {(item.fraud_probability * 100).toFixed(2)}%
                            </td>

                            <td className="px-4 py-5">
                              {item.risk_assessment?.risk_score != null ? (
                                <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                                  {Number(item.risk_assessment.risk_score).toFixed(1)}/100
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="px-4 py-5">
                              {item.company_credibility?.credibility_score != null ? (
                                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                  {Number(item.company_credibility.credibility_score)}/100
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="px-4 py-5 text-xs text-slate-500 dark:text-slate-400">
                              {new Date(item.created_at).toLocaleDateString()}
                            </td>

                            <td className="px-4 py-5">
                              <button
                                onClick={() => deleteHistory(item.id)}
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>

        {/* FOOTER */}

        <footer className="mt-12 border-t border-slate-200 bg-white px-4 py-8 text-center dark:border-slate-800 dark:bg-[#080d19] sm:mt-16 sm:px-5 sm:py-10">
          <h2 className="text-xl font-extrabold">
            JobShield <span className="text-indigo-600 dark:text-indigo-400">AI</span>
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Intelligent Fake Job Posting Detection System
          </p>
          <p className="mt-4 text-xs text-slate-400">
            React · Tailwind CSS · FastAPI · MongoDB · Machine Learning
          </p>
        </footer>
      </div>
    </div>
  );
}



// --------------------------------
// INTELLIGENT FRAUD RISK ASSESSMENT
// --------------------------------

function RiskAssessmentCard({ assessment }) {
  if (!assessment) return null;

  const score = Math.min(100, Math.max(0, Number(assessment.risk_score) || 0));
  const level = assessment.risk_level || "Unknown";

  const levelStyles = {
    Low: {
      badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
      bar: "bg-emerald-500",
    },
    Moderate: {
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
      bar: "bg-amber-500",
    },
    High: {
      badge: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
      bar: "bg-orange-500",
    },
    Critical: {
      badge: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
      bar: "bg-red-500",
    },
  };

  const style = levelStyles[level] || {
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    bar: "bg-indigo-500",
  };

  const riskSignals = Array.isArray(assessment.risk_signals)
    ? assessment.risk_signals
    : [];
  const positiveSignals = Array.isArray(assessment.positive_signals)
    ? assessment.positive_signals
    : [];

  const formatSignal = (item) => {
    if (typeof item === "string") return item;
    return item?.signal || item?.description || item?.name || "Risk indicator";
  };

  const formatPoints = (item) => {
    if (typeof item !== "object" || item === null) return null;
    const points = item.points ?? item.score ?? item.weight;
    return points == null ? null : `${points > 0 ? "+" : ""}${points} pts`;
  };

  const mlProbability =
    assessment.ml_probability == null
      ? null
      : (Number(assessment.ml_probability) * 100).toFixed(2);

  return (
    <section className="mt-10">
      <div className="mb-5">
        <p className="text-xs font-extrabold tracking-[2px] text-indigo-600 dark:text-indigo-400">
          MULTI-LAYER FRAUD SCREENING
        </p>
        <h3 className="mt-2 text-2xl font-extrabold">
          Intelligent Risk Assessment
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Combined assessment using the trained ML model and rule-based risk indicators.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#141b2d] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              Overall Fraud Risk Score
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="text-5xl font-black tracking-tight">
                {score.toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-slate-400">/ 100</span>
            </div>
          </div>
          <span className={`rounded-full px-4 py-2 text-sm font-extrabold ${style.badge}`}>
            {level} Risk
          </span>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${style.bar}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-400">
          <span>0 · Low</span>
          <span>100 · Critical</span>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/70">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Rule-Based Score
            </p>
            <p className="mt-2 text-2xl font-extrabold">
              {Number(assessment.rule_based_score ?? 0).toFixed(1)}
              <span className="ml-1 text-sm font-semibold text-slate-400">/ 100</span>
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/70">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              ML Fraud Probability
            </p>
            <p className="mt-2 text-2xl font-extrabold">
              {mlProbability == null ? "—" : `${mlProbability}%`}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="font-extrabold text-red-600 dark:text-red-400">
                Detected Risk Signals
              </h4>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">
                {riskSignals.length} detected
              </span>
            </div>
            {riskSignals.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900/70">
                No rule-based risk indicators detected.
              </p>
            ) : (
              <ul className="space-y-2">
                {riskSignals.map((item, index) => (
                  <li
                    key={`${formatSignal(item)}-${index}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50/70 p-3 dark:border-red-900/50 dark:bg-red-950/20"
                  >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      <span className="mr-2 text-red-500">●</span>
                      {formatSignal(item)}
                    </span>
                    {formatPoints(item) && (
                      <span className="shrink-0 text-xs font-extrabold text-red-600 dark:text-red-400">
                        {formatPoints(item)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="font-extrabold text-emerald-600 dark:text-emerald-400">
                Positive Signals
              </h4>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {positiveSignals.length} found
              </span>
            </div>
            {positiveSignals.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900/70">
                No positive indicators detected.
              </p>
            ) : (
              <ul className="space-y-2">
                {positiveSignals.map((item, index) => (
                  <li
                    key={`${formatSignal(item)}-${index}`}
                    className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm font-medium text-slate-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-slate-200"
                  >
                    <span className="mr-2 text-emerald-500">●</span>
                    {formatSignal(item)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {assessment.disclaimer && (
          <p className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            {assessment.disclaimer}
          </p>
        )}
      </div>
    </section>
  );
}


// --------------------------------
// COMPANY CREDIBILITY ANALYSIS
// --------------------------------

function CompanyCredibilityCard({ assessment }) {
  if (!assessment) return null;

  const score = Math.max(0, Math.min(100, Number(assessment.credibility_score) || 0));
  const level = assessment.credibility_level || "Not assessed";
  const positiveSignals = Array.isArray(assessment.positive_signals)
    ? assessment.positive_signals
    : [];
  const cautionSignals = Array.isArray(assessment.caution_signals)
    ? assessment.caution_signals
    : [];
  const checks = assessment.checks || {};

  const levelStyle = score >= 75
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
    : score >= 50
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
      : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300";

  const CheckItem = ({ label, value }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-900/70">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        value === true
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          : value === false
            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}>
        {value === true ? "Found" : value === false ? "Not found" : "Not assessed"}
      </span>
    </div>
  );

  const SignalList = ({ title, items, positive = false }) => (
    <div className="min-w-0">
      <h4 className="mb-3 font-extrabold">{title}</h4>
      {items.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900/70">
          No {positive ? "positive" : "caution"} indicators recorded.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${item.signal || title}-${index}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{item.signal || "Company indicator"}</p>
                {item.points != null && (
                  <span className={`text-xs font-extrabold ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {item.points > 0 ? "+" : ""}{item.points} pts
                  </span>
                )}
              </div>
              {item.explanation && (
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.explanation}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section className="mt-10">
      <div className="mb-5">
        <p className="text-xs font-extrabold tracking-[2px] text-indigo-600 dark:text-indigo-400">
          PHASE 3 · COMPANY INTELLIGENCE
        </p>
        <h3 className="mt-2 text-2xl font-extrabold">Company Credibility Analysis</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          A screening summary of the company information supplied in this job posting.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#141b2d] sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/70">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Credibility indicators</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-black tracking-tight">{score}</span>
              <span className="pb-1 text-sm font-semibold text-slate-500">/100</span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className={`h-full rounded-full ${score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${score}%` }} />
            </div>
            <span className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${levelStyle}`}>{level}</span>
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              This score reflects submitted-information indicators only; it is not a verified company rating.
            </p>
          </div>

          <div>
            <h4 className="mb-3 font-extrabold">Company Information Checks</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <CheckItem label="Company profile" value={checks.company_profile_provided} />
              <CheckItem label="Website URL" value={checks.website_found} />
              <CheckItem label="HTTPS website" value={checks.https_website_found} />
              <CheckItem label="Business email" value={checks.business_email_found} />
              <CheckItem label="Email / website domain match" value={checks.email_website_domain_match} />
              <CheckItem label="Contact phone" value={checks.phone_number_found} />
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <SignalList title="Positive Indicators" items={positiveSignals} positive />
          <SignalList title="Caution Indicators" items={cautionSignals} />
        </div>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {assessment.disclaimer || "This analysis does not independently verify company registration, website ownership, domain age, address, or employer legitimacy. A higher score is not proof that a company is genuine."}
        </div>
      </div>
    </section>
  );
}

// --------------------------------
// JOB INTELLIGENCE REPORT
// --------------------------------

function JobIntelligenceCard({ data }) {
  if (!data) return null;

  const emails = Array.isArray(data.emails) ? data.emails : [];
  const urls = Array.isArray(data.urls) ? data.urls : [];
  const phones = Array.isArray(data.phone_numbers) ? data.phone_numbers : [];
  const summary = data.summary || {};

  const count = (value) => Number(value || 0);

  const StatusTag = ({ children, tone = "slate" }) => {
    const styles = {
      green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
      amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
      red: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
      slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    };

    return (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[tone] || styles.slate}`}>
        {children}
      </span>
    );
  };

  return (
    <section className="mt-10">
      <div className="mb-5">
        <p className="text-xs font-extrabold tracking-[2px] text-indigo-600 dark:text-indigo-400">
          AUTOMATED CONTACT & LINK EXTRACTION
        </p>
        <h3 className="mt-2 text-2xl font-extrabold">
          Job Intelligence Report
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Contact details and website links extracted from the submitted job posting.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#141b2d] sm:p-7">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Emails", value: count(summary.total_emails), icon: "✉" },
            { label: "Public Emails", value: count(summary.public_email_count), icon: "@" },
            { label: "URLs", value: count(summary.total_urls), icon: "↗" },
            { label: "Shortened URLs", value: count(summary.shortened_url_count), icon: "⚠" },
            { label: "Phone Numbers", value: count(summary.total_phone_numbers), icon: "☎" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {item.label}
                </span>
                <span className="text-lg text-indigo-500">{item.icon}</span>
              </div>
              <p className="mt-2 text-2xl font-extrabold">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <h4 className="mb-3 font-extrabold">Email Addresses</h4>
            {emails.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900/70">
                No email address detected.
              </p>
            ) : (
              <ul className="space-y-2">
                {emails.map((item, index) => (
                  <li key={`${item.email}-${index}`} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-semibold">{item.email}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Domain: {item.domain}
                      </p>
                    </div>
                    <StatusTag tone={item.is_public_email ? "amber" : "green"}>
                      {item.is_public_email ? "Public provider" : "Custom domain"}
                    </StatusTag>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0">
            <h4 className="mb-3 font-extrabold">Website & URLs</h4>
            {urls.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900/70">
                No website URL detected.
              </p>
            ) : (
              <ul className="space-y-2">
                {urls.map((item, index) => (
                  <li key={`${item.url}-${index}`} className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <p className="break-all text-sm font-semibold">{item.url}</p>
                    <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                      Domain: {item.domain || "Unknown"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.is_https && <StatusTag tone="green">HTTPS</StatusTag>}
                      {item.is_http && <StatusTag tone="red">Non-HTTPS</StatusTag>}
                      {item.is_shortened && <StatusTag tone="amber">Shortened URL</StatusTag>}
                      {!item.is_https && !item.is_http && (
                        <StatusTag>Scheme unknown</StatusTag>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-7">
          <h4 className="mb-3 font-extrabold">Contact Phone Numbers</h4>
          {phones.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900/70">
              No phone number detected.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {phones.map((phone, index) => (
                <span key={`${phone}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900/70">
                  ☎ {phone}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-xs leading-6 text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
          Extraction identifies contact details and URL characteristics only. A public email address, HTTP link, or shortened URL is a screening indicator—not confirmation that a job or company is fraudulent.
        </div>
      </div>
    </section>
  );
}



// --------------------------------
// PHASE 4 - ADVANCED JOB POSTING ANALYSIS
// --------------------------------

function AdvancedJobAnalysisCard({ analysis }) {
  if (!analysis) return null;

  const score = Math.max(
    0,
    Math.min(100, Number(analysis.job_quality_score) || 0)
  );

  const level = analysis.job_quality_level || "Not assessed";
  const priority = analysis.review_priority || "Not specified";
  const salary = analysis.salary_analysis || {};
  const completeness = analysis.completeness_checks || {};
  const missing = Array.isArray(analysis.missing_information)
    ? analysis.missing_information
    : [];
  const cautions = Array.isArray(analysis.caution_signals)
    ? analysis.caution_signals
    : [];
  const positives = Array.isArray(analysis.positive_signals)
    ? analysis.positive_signals
    : [];
  const salaryMentions = Array.isArray(salary.salary_mentions)
    ? salary.salary_mentions
    : [];

  const qualityStyle =
    score >= 75
      ? {
          badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
          bar: "bg-emerald-500",
        }
      : score >= 50
        ? {
            badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
            bar: "bg-amber-500",
          }
        : {
            badge: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
            bar: "bg-red-500",
          };

  const priorityStyle = /high|urgent/i.test(priority)
    ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
    : /medium/i.test(priority)
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

  const checkLabels = {
    job_responsibilities: "Job responsibilities",
    qualifications: "Qualifications",
    experience_expectations: "Experience expectations",
    work_location_or_mode: "Work location / mode",
    employment_type: "Employment type",
  };

  const formatLabel = (value) =>
    String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const formatCurrency = (amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value)) return String(amount ?? "—");
    return `₹${value.toLocaleString("en-IN")}`;
  };

  const SignalList = ({ title, items, positive = false }) => (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="font-extrabold">{title}</h4>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            positive
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
          }`}
        >
          {items.length} {positive ? "found" : "to review"}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900/70">
          No {positive ? "positive" : "caution"} indicators reported.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={`${item.signal || title}-${index}`}
              className={`rounded-xl border p-3 ${
                positive
                  ? "border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                  : "border-amber-100 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">
                  {item.signal || "Job indicator"}
                </p>
                {item.severity && (
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {item.severity}
                  </span>
                )}
              </div>
              {item.points != null && (
                <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                  {item.points > 0 ? "+" : ""}
                  {item.points} points
                </p>
              )}
              {item.explanation && (
                <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
                  {item.explanation}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section className="mt-10">
      <div className="mb-5">
        <p className="text-xs font-extrabold tracking-[2px] text-indigo-600 dark:text-indigo-400">
          PHASE 4 · ADVANCED JOB INTELLIGENCE
        </p>
        <h3 className="mt-2 text-2xl font-extrabold">
          Advanced Job Analysis
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Reviews salary claims, job information completeness and hiring
          patterns in the submitted posting.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#141b2d] sm:p-7">
        {/* Score and review priority */}
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Job Quality Score
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-black">{score}</span>
                  <span className="text-sm font-semibold text-slate-500">
                    / 100
                  </span>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${qualityStyle.badge}`}
              >
                {level}
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${qualityStyle.bar}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Higher score indicates that more expected job details are present.
            </p>
          </div>

          <div className="flex min-w-[180px] flex-col justify-center rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Review Priority
            </p>
            <span
              className={`mt-3 inline-flex w-fit rounded-full px-3 py-2 text-sm font-extrabold ${priorityStyle}`}
            >
              {priority}
            </span>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Based on the indicators returned by the analysis engine.
            </p>
          </div>
        </div>

        {/* Salary analysis */}
        <div className="mt-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-extrabold">Salary Analysis</h4>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                /review|unusual|high/i.test(salary.assessment || "")
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {salary.assessment || "Not assessed"}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {salary.salary_found
                ? "Compensation figures were detected in the submitted text."
                : "No salary figure was detected in the submitted text."}
            </p>

            {salaryMentions.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {salaryMentions.map((item, index) => (
                  <div
                    key={`${item.amount_inr}-${item.period}-${index}`}
                    className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70"
                  >
                    <p className="text-lg font-extrabold">
                      {formatCurrency(item.amount_inr)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Detected period: {item.period || "Not specified"}
                    </p>
                    {item.text_context && (
                      <p className="mt-2 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Context: {item.text_context}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {salary.disclaimer && (
              <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {salary.disclaimer}
              </p>
            )}
          </div>
        </div>

        {/* Completeness */}
        <div className="mt-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-extrabold">Job Information Completeness</h4>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {Object.values(completeness).filter(Boolean).length} of{" "}
              {Object.keys(checkLabels).length} details found
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(checkLabels).map(([key, label]) => {
              const found = completeness[key] === true;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-900/70"
                >
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {label}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      found
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                    }`}
                  >
                    {found ? "Present" : "Missing"}
                  </span>
                </div>
              );
            })}
          </div>

          {missing.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Missing information
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {missing.map((item, index) => (
                  <span
                    key={`${item}-${index}`}
                    className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 dark:bg-slate-900 dark:text-amber-200"
                  >
                    {formatLabel(item)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Signals */}
        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <SignalList title="Caution Signals" items={cautions} />
          <SignalList
            title="Positive Indicators"
            items={positives}
            positive
          />
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/20">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              Caution indicators
            </p>
            <p className="mt-1 text-2xl font-extrabold">
              {analysis.total_caution_signals ?? cautions.length}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Positive indicators
            </p>
            <p className="mt-1 text-2xl font-extrabold">
              {analysis.total_positive_signals ?? positives.length}
            </p>
          </div>
        </div>

        {analysis.disclaimer && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            {analysis.disclaimer}
          </div>
        )}
      </div>
    </section>
  );
}

// --------------------------------
// EXPLAINABLE AI SIGNAL CARD
// --------------------------------

function SignalCard({ title, items = [], positive = false }) {
  const maxContribution = Math.max(
    ...items.map((item) => Math.abs(item.contribution)),
    0.00001
  );

  return (
    <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#141b2d] sm:p-6">
      <h4 className="text-lg font-extrabold">{title}</h4>

      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {positive ? "Increases fraud log-odds" : "Decreases fraud log-odds"}
      </p>

      <div className="mt-6 space-y-5">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            No feature contributions found.
          </p>
        ) : (
          items.map((item) => {
            const width =
              (Math.abs(item.contribution) / maxContribution) * 100;

            return (
              <div key={item.term}>
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2 text-sm">
                  <span className="font-semibold">{item.term}</span>
                  <span
                    className={`font-bold ${
                      positive ? "text-red-500" : "text-emerald-500"
                    }`}
                  >
                    {item.contribution > 0 ? "+" : ""}
                    {item.contribution.toFixed(5)}
                  </span>
                </div>

                <div
                  className={`h-2 overflow-hidden rounded-full ${
                    positive
                      ? "bg-red-100 dark:bg-red-950/50"
                      : "bg-emerald-100 dark:bg-emerald-950/50"
                  }`}
                >
                  <div
                    className={`h-full rounded-full ${
                      positive ? "bg-red-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default App;
