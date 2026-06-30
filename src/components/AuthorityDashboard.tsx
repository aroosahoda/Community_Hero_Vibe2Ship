import React, { useState, useMemo } from "react";
import { Issue, IssueStatus, Severity } from "../types";
import {
  Wrench,
  CheckCircle,
  Clock,
  ShieldAlert,
  SlidersHorizontal,
  ChevronRight,
  UserCheck,
  ClipboardList,
  AlertOctagon,
  TrendingUp,
  BarChart4
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { WORKERS_LIST } from "../mockData";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import MetricCard from "./MetricCard";

interface AuthorityDashboardProps {
  issues: Issue[];
  onUpdateStatus: (
    issueId: string,
    status: IssueStatus,
    worker: string | null,
    notes: string | null,
    photo: string | null
  ) => Promise<void>;
  selectedIssueId: string | null;
  onSelectIssue: (issueId: string) => void;
}

export default function AuthorityDashboard({
  issues,
  onUpdateStatus,
  selectedIssueId,
  onSelectIssue
}: AuthorityDashboardProps) {
  const [filterSeverity, setFilterSeverity] = useState<"All" | Severity>("All");
  const [filterStatus, setFilterStatus] = useState<"All" | IssueStatus>("All");

  // State for updating an active issue
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState("");
  const [statusUpdate, setStatusUpdate] = useState<IssueStatus>("Assigned");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionPhoto, setResolutionPhoto] = useState("");

  const selectedIssue = useMemo(() => {
    return issues.find((item) => item.id === selectedIssueId) || null;
  }, [issues, selectedIssueId]);

  // Executive Metrics Computations
  const stats = useMemo(() => {
    const total = issues.length;
    const resolved = issues.filter((i) => i.status === "Resolved").length;
    const inProgress = issues.filter((i) => i.status === "In Progress" || i.status === "Assigned").length;
    const criticalPending = issues.filter((i) => i.severity === "Critical" && i.status !== "Resolved").length;

    return { total, resolved, inProgress, criticalPending };
  }, [issues]);

  // Recharts Chart 1: Department Workloads
  const chartDepartmentData = useMemo(() => {
    const counts: { [dept: string]: number } = {};
    issues.forEach((issue) => {
      const dept = issue.department || "General Services";
      counts[dept] = (counts[dept] || 0) + 1;
    });

    return Object.keys(counts).map((key) => ({
      name: key.replace("Department", "Dept").replace("Bureau", ""),
      Complaints: counts[key]
    }));
  }, [issues]);

  // Recharts Chart 2: Severity distribution
  const chartSeverityData = useMemo(() => {
    const severityMap: { [key: string]: number } = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    issues.forEach((issue) => {
      severityMap[issue.severity]++;
    });

    return Object.keys(severityMap).map((key) => ({
      name: key,
      value: severityMap[key]
    }));
  }, [issues]);

  const COLORS = ["#818cf8", "#f59e0b", "#4f46e5", "#dc2626"];

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesSeverity = filterSeverity === "All" || issue.severity === filterSeverity;
      const matchesStatus = filterStatus === "All" || issue.status === filterStatus;
      return matchesSeverity && matchesStatus;
    });
  }, [issues, filterSeverity, filterStatus]);

  // Triggering the worker assignment and status change modal
  const handleOpenStatusModal = () => {
    if (!selectedIssue) return;

    // Enforce dispatch verification eligibility rule
    const verifyCount = selectedIssue.verifiedUsers?.length ?? selectedIssue.votes ?? 0;
    if (verifyCount < 2) {
      alert("This issue is locked and cannot be dispatched without a minimum of 2 community verifications.");
      return;
    }

    setStatusUpdate(selectedIssue.status);
    setSelectedCrew(selectedIssue.assignedWorker || WORKERS_LIST[0]);
    setResolutionNotes(selectedIssue.resolutionNotes || "");
    setResolutionPhoto(
      selectedIssue.resolutionPhoto ||
        "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&q=80&w=600"
    );
    setShowStatusModal(true);
  };

  const handleApplyStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssueId) return;

    await onUpdateStatus(
      selectedIssueId,
      statusUpdate,
      statusUpdate === "Reported" ? null : selectedCrew,
      statusUpdate === "Resolved" ? resolutionNotes : null,
      statusUpdate === "Resolved" ? resolutionPhoto : null
    );

    setShowStatusModal(false);
  };

  return (
    <div className="space-y-6" id="authority-dashboard-main">
      {/* EXECUTIVE SUMMARY STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="TOTAL REFORMS"
          value={stats.total}
          subtext="Seeded database counts"
          iconName="ClipboardList"
          colorClass="text-indigo-600 bg-indigo-50 border-indigo-100"
        />
        <MetricCard
          title="CRITICAL THREATS"
          value={stats.criticalPending}
          subtext="Unresolved immediate risks"
          iconName="AlertOctagon"
          colorClass="text-red-600 bg-red-50 border-red-100"
        />
        <MetricCard
          title="ACTIVE IN-REPAIR"
          value={stats.inProgress}
          subtext="Workers assigned"
          iconName="Wrench"
          colorClass="text-amber-600 bg-amber-50 border-amber-100"
        />
        <MetricCard
          title="RESOLVED CASES"
          value={stats.resolved}
          subtext="Total civic repairs completed"
          iconName="CheckCircle"
          colorClass="text-emerald-600 bg-emerald-50 border-emerald-100"
        />
      </div>

      {/* ANALYTICS CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Workloads (Bar Chart) */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-extrabold text-gray-800 flex items-center gap-1.5 uppercase font-mono tracking-wider">
              <TrendingUp className="w-4 h-4 text-indigo-500" /> Municipal Department Workloads
            </h3>
            <span className="text-[10px] text-gray-400 font-mono">Live dynamic distribution</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDepartmentData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "none",
                    borderRadius: "12px",
                    color: "#f8fafc",
                    fontSize: "11px"
                  }}
                />
                <Bar dataKey="Complaints" fill="#4f46e5" radius={[6, 6, 0, 0]}>
                  {chartDepartmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#6366f1" : "#4f46e5"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Metrics (Pie Chart) */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-gray-800 flex items-center gap-1.5 uppercase font-mono tracking-wider mb-4">
              <BarChart4 className="w-4 h-4 text-indigo-500" /> Hazard Severity Shares
            </h3>
            <div className="h-44 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartSeverityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartSeverityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "none",
                      borderRadius: "10px",
                      color: "#f8fafc",
                      fontSize: "10px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered overall label */}
              <div className="absolute text-center">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono">CRITICAL</span>
                <p className="text-xl font-extrabold text-red-600">{stats.criticalPending}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-gray-50 pt-3">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span> Low ({chartSeverityData[0]?.value || 0})
            </span>
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"></span> Medium ({chartSeverityData[1]?.value || 0})
            </span>
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> High ({chartSeverityData[2]?.value || 0})
            </span>
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span> Critical ({chartSeverityData[3]?.value || 0})
            </span>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <span className="text-xs font-extrabold text-gray-700 flex items-center gap-2 font-mono uppercase tracking-wider">
          <SlidersHorizontal className="w-4 h-4 text-indigo-500" /> Filter Work Orders
        </span>

        <div className="flex flex-wrap gap-2 justify-end w-full sm:w-auto">
          {/* Severity selector */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as "All" | Severity)}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-hidden"
          >
            <option value="All">All Severities</option>
            <option value="Low">Low Severity</option>
            <option value="Medium">Medium Severity</option>
            <option value="High">High Severity</option>
            <option value="Critical">Critical Severity</option>
          </select>

          {/* Status selector */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "All" | IssueStatus)}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-hidden"
          >
            <option value="All">All Statuses</option>
            <option value="Reported">Reported</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* LIST OF ACTION WORK ORDERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Issues List Side */}
        <div className="lg:col-span-2 space-y-3">
          {filteredIssues.length === 0 ? (
            <div className="p-12 text-center bg-white border border-dashed border-gray-200 rounded-3xl">
              <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-xs font-bold text-gray-700 mt-2">No active complaints found</h4>
              <p className="text-[11px] text-gray-400 mt-1">Try relaxing severity or status filtering constraints.</p>
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div
                key={issue.id}
                onClick={() => onSelectIssue(issue.id)}
                className={`p-4 rounded-2xl bg-white border cursor-pointer hover:border-indigo-400 transition flex justify-between items-center ${
                  selectedIssueId === issue.id
                    ? "border-indigo-500 shadow-md ring-2 ring-indigo-500/10"
                    : "border-gray-100"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                    <img src={issue.imageUrl} alt={issue.subcategory} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase font-mono">
                        {issue.category}
                      </span>
                      <span
                        className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                          issue.severity === "Critical"
                            ? "bg-red-100 text-red-800"
                            : issue.severity === "High"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-indigo-100 text-indigo-800"
                        }`}
                      >
                        {issue.severity}
                      </span>
                    </div>
                    <h4 className="text-xs font-extrabold text-gray-800 mt-1 truncate">{issue.subcategory}</h4>
                    <p className="text-[10px] text-gray-500 line-clamp-1">{issue.location.address}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                      issue.status === "Resolved"
                        ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                        : issue.status === "In Progress"
                        ? "bg-indigo-50 border-indigo-100 text-indigo-700 animate-pulse"
                        : "bg-slate-50 border-slate-100 text-slate-700"
                    }`}
                  >
                    {issue.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Issue Detail / Inspector Panel */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-white shadow-xl h-fit">
          {selectedIssue ? (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono">
                    {selectedIssue.category}
                  </span>
                  <h3 className="text-base font-extrabold mt-1 text-slate-100">{selectedIssue.subcategory}</h3>
                </div>
                <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded">
                  {selectedIssue.id.toUpperCase()}
                </span>
              </div>

              <div className="h-40 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 relative">
                <img src={selectedIssue.imageUrl} alt={selectedIssue.subcategory} className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-mono text-slate-400">
                  AI verified (Confidence: {Math.round(selectedIssue.confidence * 100)}%)
                </div>
              </div>

              <div className="space-y-3 text-xs border-b border-slate-800 pb-4">
                <div>
                  <strong className="text-slate-400 font-semibold font-mono text-[10px] uppercase">CIVIC DESCRIPTION</strong>
                  <p className="text-slate-200 mt-1 leading-relaxed">{selectedIssue.description}</p>
                </div>

                <div>
                  <strong className="text-slate-400 font-semibold font-mono text-[10px] uppercase">GPS POSITION & ADDRESS</strong>
                  <p className="text-slate-200 mt-1">{selectedIssue.location.address}</p>
                </div>

                <div>
                  <strong className="text-slate-400 font-semibold font-mono text-[10px] uppercase">COGNITIVE SAFETY RISK AUDIT (GEMINI AI)</strong>
                  <p className="text-red-300 mt-1 italic font-sans">"{selectedIssue.safetyRisk}"</p>
                </div>

                <div>
                  <strong className="text-slate-400 font-semibold font-mono text-[10px] uppercase">KEYWORDS EXCLUSIONS</strong>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {selectedIssue.keywords.map((tag) => (
                      <span key={tag} className="bg-slate-800 text-[9px] text-indigo-300 px-2 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* ACTION COMMAND CENTER BUTTONS */}
              {(() => {
                const verifyCount = selectedIssue.verifiedUsers?.length ?? selectedIssue.votes ?? 0;
                const isVerified = verifyCount >= 2;
                return (
                  <div className="space-y-3">
                    {!isVerified ? (
                      <div className="p-3.5 bg-red-950/40 border border-red-900/50 rounded-2xl text-[11px] text-red-200 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-red-400">
                          <AlertOctagon className="w-4 h-4 shrink-0" />
                          DISPATCH LOCKED: UNVERIFIED
                        </div>
                        <p className="leading-relaxed text-red-300">
                          This issue has a verification score of <strong className="font-extrabold text-white">{verifyCount}</strong>. A minimum score of <strong className="font-extrabold text-white">2</strong> from verified nearby citizens is required to dispatch field crews.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-2xl text-[11px] text-emerald-200 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>This issue is verified and eligible for authority dispatch! (Score: {verifyCount})</span>
                      </div>
                    )}

                    <button
                      onClick={handleOpenStatusModal}
                      disabled={!isVerified}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition ${
                        isVerified
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/40 cursor-pointer"
                          : "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed shadow-none"
                      }`}
                    >
                      {isVerified ? (
                        <>
                          <Wrench className="w-4 h-4" />
                          Dispatch Repair / Status Updates
                        </>
                      ) : (
                        <>
                          <span>🔒 Dispatch Locked (Unverified)</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-center p-12 space-y-3">
              <ClipboardList className="w-10 h-10 text-slate-700 mx-auto" />
              <h4 className="text-xs font-bold text-slate-400 uppercase font-mono">No Issue Selected</h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Select an issue from the telemetry list or map view to open the Action Command Center.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* DISPATCH ACTION / STATE MATRIX MODAL */}
      <AnimatePresence>
        {showStatusModal && selectedIssue && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-gray-100"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
                <h3 className="font-extrabold text-gray-800 text-base flex items-center gap-1.5 uppercase font-mono tracking-wider">
                  <Wrench className="w-5 h-5 text-indigo-600" /> Crew Dispatch & State Matrix
                </h3>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleApplyStatusUpdate} className="space-y-4 text-xs text-gray-600">
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider font-mono mb-1.5">
                    1. Select Municipal Field Crew
                  </label>
                  <select
                    value={selectedCrew}
                    onChange={(e) => setSelectedCrew(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl"
                  >
                    {WORKERS_LIST.map((worker) => (
                      <option key={worker} value={worker}>
                        {worker}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider font-mono mb-1.5">
                    2. Advance Reparation Status
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {["Reported", "Assigned", "In Progress", "Resolved"].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusUpdate(st as IssueStatus)}
                        className={`py-2 text-[10px] font-bold rounded-xl border cursor-pointer uppercase font-mono transition ${
                          statusUpdate === st
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-xs"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditional resolution notes and photo in resolved state */}
                {statusUpdate === "Resolved" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-3 pt-3 border-t border-dashed border-gray-100"
                  >
                    <div>
                      <label className="block font-bold text-gray-700 uppercase tracking-wider font-mono mb-1.5">
                        3. Post-Resolution Audit Notes
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Detail completed tasks, parts replaced, and long-term durability statements..."
                        className="w-full px-3 py-2 text-xs bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl"
                      ></textarea>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 uppercase tracking-wider font-mono mb-1.5">
                        4. Post-Resolution Audit Photo
                      </label>
                      <input
                        type="text"
                        required
                        value={resolutionPhoto}
                        onChange={(e) => setResolutionPhoto(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl font-mono"
                      />
                    </div>
                  </motion.div>
                )}

                <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowStatusModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 border border-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center gap-1 shadow-md cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    Commit Dispatch & Save State
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
