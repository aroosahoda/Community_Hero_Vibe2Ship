import React, { useState, useEffect, useCallback } from "react";
import { Issue } from "../types";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Building,
  Clock,
  MapPin,
  RefreshCw,
  Cpu,
  CheckCircle,
  BarChart4
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import SkeletonLoader from "./SkeletonLoader";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

interface Hotspot {
  zone: string;
  riskLevel: string;
  reason: string;
}

interface InsightsData {
  trendData: { date: string; Complaints: number }[];
  zoneData: { zone: string; Complaints: number }[];
  deptData: { department: string; Complaints: number; Resolved: number; Pending: number }[];
  avgResolutionTimeHours: number;
  weeklyInsights: string;
  predictedHotspots: Hotspot[];
}

interface AIInsightsDashboardProps {
  issues: Issue[];
}

export default function AIInsightsDashboard({ issues }: AIInsightsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/insights");
      const json = await res.json();
      if (json.status === "success" && json.data) {
        setData(json.data);
        setIsSimulated(!!json.simulated);
      } else {
        throw new Error(json.message || "Failed to retrieve insights data.");
      }
    } catch (err) {
      console.error("Error fetching AI insights:", err);
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights, issues]);

  // Count words helper
  const countWords = (text: string) => {
    return text.split(/\s+/).filter(Boolean).length;
  };

  // Severity style helper
  const getRiskBadgeStyles = (level: string) => {
    const l = level.toLowerCase();
    if (l === "critical" || l === "red") {
      return "bg-rose-50 border-rose-200 text-rose-700";
    }
    if (l === "high" || l === "orange") {
      return "bg-amber-50 border-amber-200 text-amber-700";
    }
    if (l === "medium" || l === "yellow") {
      return "bg-yellow-50 border-yellow-200 text-yellow-700";
    }
    return "bg-emerald-50 border-emerald-200 text-emerald-700";
  };

  return (
    <div className="space-y-6" id="ai-insights-dashboard-root">
      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 tracking-tight flex items-center gap-2 uppercase font-mono">
            <Cpu className="w-5 h-5 text-indigo-600 animate-pulse" /> AI Urban Intelligence
          </h2>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Real-time cognitive diagnostics, predictive hotspot indexing, and automated weekly operational forecasting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            {isSimulated ? "SIMULATED ANALYTICS" : "GEMINI LIVE ACTIVE"}
          </span>
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Regenerate Insights
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 space-y-6">
            <SkeletonLoader type="detail" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <SkeletonLoader type="list" count={2} />
            </div>
          </div>
          <div className="md:col-span-4 space-y-6">
            <SkeletonLoader type="chart" />
            <SkeletonLoader type="list" count={3} />
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center text-red-700 space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
          <p className="text-xs font-semibold">{error}</p>
          <button
            onClick={fetchInsights}
            className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 transition"
          >
            Retry Analysis
          </button>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* LEFT AREA: EXECUTIVE METRIC AND WEEKLY INSIGHTS SUMMARY (COL-12 or 8) */}
          <div className="md:col-span-8 space-y-6">
            
            {/* AI-GENERATED WEEKLY INSIGHTS */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm relative overflow-hidden"
            >
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-4 translate-y-4">
                <Cpu className="w-48 h-48" />
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono tracking-wider text-indigo-200 uppercase font-black">
                  Automated Weekly Digest
                </span>
                <span className="text-[10px] font-mono bg-indigo-850/80 border border-indigo-700 px-2 py-0.5 rounded text-indigo-300">
                  {countWords(data.weeklyInsights)} words / max 80
                </span>
              </div>

              <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-indigo-100 flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-4 h-4 text-amber-400" /> Executive Weekly Forecast
              </h3>
              
              <p className="text-xs text-indigo-50/90 leading-relaxed font-sans">
                {data.weeklyInsights}
              </p>

              <div className="mt-4 pt-3 border-t border-indigo-850 flex items-center justify-between text-[10px] font-mono text-indigo-300">
                <span>Model: Gemini 3.5 Flash</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle className="w-3 h-3" /> Grounded on current report list
                </span>
              </div>
            </motion.div>

            {/* CHARTS CONTAINER GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* COMPLAINT TRENDS CHART */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-gray-800">
                      Complaint Trends
                    </h4>
                    <p className="text-[10px] text-gray-400">Daily civic volume indexes</p>
                  </div>
                </div>
                
                <div className="h-56">
                  {data.trendData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-gray-400 font-mono">
                      Awaiting volume telemetry
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.trendData}>
                        <defs>
                          <linearGradient id="colorComplaints" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Area type="monotone" dataKey="Complaints" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorComplaints)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* DEPARTMENT WORKLOAD */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-gray-800">
                      Department Workload
                    </h4>
                    <p className="text-[10px] text-gray-400">Caseload status by bureau</p>
                  </div>
                </div>

                <div className="h-56">
                  {data.deptData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-gray-400 font-mono">
                      No workload recorded
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.deptData} margin={{ left: -15 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="department" stroke="#9ca3af" fontSize={9} tickLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                        <Bar dataKey="Pending" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Resolved" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

            </div>

            {/* MOST AFFECTED ZONES CHART */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                  <BarChart4 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-gray-800">
                    Most Affected Zones
                  </h4>
                  <p className="text-[10px] text-gray-400">Caseload breakdown by geographic neighborhoods</p>
                </div>
              </div>

              <div className="h-52">
                {data.zoneData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400 font-mono">
                    Awaiting coordinate telemetry
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.zoneData} layout="vertical" margin={{ left: 40, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                      <XAxis type="number" stroke="#9ca3af" fontSize={10} tickLine={false} />
                      <YAxis type="category" dataKey="zone" stroke="#4b5563" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="Complaints" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT AREA: PERFORMANCE INDICATORS & PREDICTED HOTSPOTS */}
          <div className="md:col-span-4 space-y-6">
            
            {/* AVERAGE RESOLUTION TIME */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs text-center flex flex-col justify-center items-center">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
                Average Resolution Speed
              </h4>
              <p className="text-4xl font-extrabold text-slate-900 tracking-tight mt-1.5">
                {data.avgResolutionTimeHours} <span className="text-sm font-semibold text-gray-400">hours</span>
              </p>
              <p className="text-[10px] text-gray-500 mt-2 leading-relaxed max-w-xs">
                Calculated dynamically from initial submittal to final verification photo upload.
              </p>
            </div>

            {/* PREDICTED INFRASTRUCTURE HOTSPOTS */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-gray-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-indigo-600" /> Hotspot Index
                </h4>
                <p className="text-[10px] text-gray-400">Risk assessments generated via Gemini</p>
              </div>

              <div className="space-y-3.5">
                {data.predictedHotspots.map((hotspot, index) => (
                  <div
                    key={index}
                    className="p-3.5 bg-gray-50/50 border border-gray-100 rounded-xl space-y-2 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                        {hotspot.zone}
                      </div>
                      <span className={`text-[9px] font-mono font-black border uppercase px-2 py-0.5 rounded-full ${getRiskBadgeStyles(hotspot.riskLevel)}`}>
                        {hotspot.riskLevel}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
                      {hotspot.reason}
                    </p>

                    <div className="flex items-center justify-between text-[8px] font-mono text-gray-400 pt-1.5 border-t border-gray-100">
                      <span>Predictive Analytics</span>
                      <span>{countWords(hotspot.reason)} words</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      ) : null}
    </div>
  );
}
