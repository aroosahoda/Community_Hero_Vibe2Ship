import React, { useState, useEffect } from "react";
import { AppUser, Issue, IssueStatus, Severity } from "./types";
import { INITIAL_USER, INITIAL_AUTHORITY_USER, MOCK_BADGES } from "./mockData";
import CitizenPortal from "./components/CitizenPortal";
import AuthorityDashboard from "./components/AuthorityDashboard";
import AIInsightsDashboard from "./components/AIInsightsDashboard";
import IssueMap from "./components/IssueMap";
import SkeletonLoader from "./components/SkeletonLoader";
import {
  ShieldAlert,
  Users,
  Award,
  Building,
  Activity,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Cpu,
  Sparkles,
  Trophy,
  Sun,
  Moon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("civic_theme") === "dark";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("civic_theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("civic_theme", "light");
    }
  }, [darkMode]);

  // Application Roles Toggle for demo/eval purposes
  const [currentUser, setCurrentUser] = useState<AppUser>(INITIAL_USER);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"Citizen" | "Authority" | "Insights" >("Citizen");

  // Active Daily Missions & Weekly Challenges
  const [dailyMissions, setDailyMissions] = useState([
    { id: "mission_verify", title: "The Sentinel", description: "Verify 1 neighborhood issue", type: "daily", rewardXp: 50, rewardHero: 5, progress: 1, target: 1, completed: true },
    { id: "mission_photo", title: "On-the-Scene Reporter", description: "Upload a live photo update for any issue", type: "daily", rewardXp: 75, rewardHero: 8, progress: 0, target: 1, completed: false },
    { id: "mission_report", title: "First Responder", description: "Report a new civic hazard or complaint", type: "daily", rewardXp: 100, rewardHero: 10, progress: 0, target: 1, completed: false },
  ]);

  const [weeklyChallenges, setWeeklyChallenges] = useState([
    { id: "challenge_votes", title: "Community Shield", description: "Get 3 verifications on your reported issues", type: "weekly", rewardXp: 200, rewardHero: 25, progress: 1, target: 3, completed: false },
    { id: "challenge_audits", title: "Spotless Neighborhood", description: "Complete 3 community verification audits (Verify/Dispute)", type: "weekly", rewardXp: 300, rewardHero: 35, progress: 1, target: 3, completed: false },
    { id: "challenge_comments", title: "City Advisor", description: "Write 3 helpful comments or recommendations", type: "weekly", rewardXp: 150, rewardHero: 15, progress: 0, target: 3, completed: false },
  ]);

  // Sync with Express Backend API
  const fetchIssues = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/issues");
      const json = await res.json();
      if (json.status === "success" && json.data) {
        setIssues(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch issues from backend API:", err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  // Award XP and Hero Score
  const awardXpAndHeroScore = (xpAmount: number, heroAmount: number, actionLabel: string) => {
    setCurrentUser((prev) => {
      const newXp = prev.xp + xpAmount;
      const newHero = prev.heroScore + heroAmount;
      const newLevel = Math.floor(newXp / 250) + 1;
      const leveledUp = newLevel > prev.level;

      const updatedBadges = [...prev.badges];

      // Auto-unlock active_citizen (Super Hero badge at 500+ XP)
      const hasActiveCitizen = updatedBadges.some((b) => b.id === "active_citizen");
      if (newXp >= 500 && !hasActiveCitizen) {
        const activeCitizenBadge = MOCK_BADGES.find((b) => b.id === "active_citizen");
        if (activeCitizenBadge) {
          updatedBadges.push({
            ...activeCitizenBadge,
            unlockedAt: new Date().toISOString()
          });
          setToastMessage(`🏆 New Badge Unlocked: ${activeCitizenBadge.name}!`);
        }
      }

      if (leveledUp) {
        setToastMessage(`🌟 LEVEL UP! You are now a Level ${newLevel} Citizen!`);
      } else {
        setToastMessage(`✨ +${xpAmount} XP & +${heroAmount} Hero: ${actionLabel}`);
      }

      // Automatically hide the toast after 4 seconds
      setTimeout(() => {
        setToastMessage((cur) => {
          if (cur && (cur.includes(actionLabel) || (leveledUp && cur.includes("LEVEL UP")))) {
            return null;
          }
          return cur;
        });
      }, 4000);

      return {
        ...prev,
        xp: newXp,
        heroScore: newHero,
        level: newLevel,
        points: prev.points + xpAmount, // backwards compatibility
        badges: updatedBadges
      };
    });
  };

  // Trigger Mission Progress Helper
  const triggerMissionProgress = (missionId: string, amount: number = 1) => {
    setDailyMissions((prev) =>
      prev.map((m) => {
        if (m.id === missionId && !m.completed) {
          const newProgress = Math.min(m.target, m.progress + amount);
          const completedNow = newProgress >= m.target;
          if (completedNow) {
            awardXpAndHeroScore(m.rewardXp, m.rewardHero, `Completed Mission: "${m.title}"`);
          }
          return { ...m, progress: newProgress, completed: completedNow };
        }
        return m;
      })
    );

    setWeeklyChallenges((prev) =>
      prev.map((c) => {
        if (c.id === missionId && !c.completed) {
          const newProgress = Math.min(c.target, c.progress + amount);
          const completedNow = newProgress >= c.target;
          if (completedNow) {
            awardXpAndHeroScore(c.rewardXp, c.rewardHero, `Completed Challenge: "${c.title}"`);
          }
          return { ...c, progress: newProgress, completed: completedNow };
        }
        return c;
      })
    );
  };

  // Update user points locally (backward compatibility)
  const handleUpdatePoints = (points: number) => {
    setCurrentUser((prev) => ({ ...prev, points }));
  };

  // Upvote/Verification handler
  const handleVoteIssue = async (issueId: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.uid })
      });
      const json = await res.json();
      if (json.status === "success" && json.data) {
        const updatedIssue = json.data as Issue;
        setIssues((prev) => prev.map((item) => (item.id === issueId ? updatedIssue : item)));
        
        // Award XP for verifying
        const isNowVoted = updatedIssue.votedUsers?.includes(currentUser.uid);
        if (isNowVoted) {
          awardXpAndHeroScore(50, 5, "Verified neighborhood issue");
          triggerMissionProgress("mission_verify");
          triggerMissionProgress("challenge_audits");
        }
      }
    } catch (err) {
      console.error("Failed to register verification vote:", err);
    }
  };

  // Community Verify handler
  const handleVerifyIssue = async (issueId: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.uid })
      });
      const json = await res.json();
      if (json.status === "success" && json.data) {
        const updatedIssue = json.data as Issue;
        setIssues((prev) => prev.map((item) => (item.id === issueId ? updatedIssue : item)));

        const isNowVerified = updatedIssue.verifiedUsers?.includes(currentUser.uid);
        if (isNowVerified) {
          awardXpAndHeroScore(50, 5, "Verified neighborhood asset");
          triggerMissionProgress("mission_verify");
          triggerMissionProgress("challenge_audits");
        }
      }
    } catch (err) {
      console.error("Failed to verify issue:", err);
    }
  };

  // Community Reject handler
  const handleRejectIssue = async (issueId: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.uid })
      });
      const json = await res.json();
      if (json.status === "success" && json.data) {
        const updatedIssue = json.data as Issue;
        setIssues((prev) => prev.map((item) => (item.id === issueId ? updatedIssue : item)));

        const isNowRejected = updatedIssue.rejectedUsers?.includes(currentUser.uid);
        if (isNowRejected) {
          awardXpAndHeroScore(50, 5, "Disputed inaccurate community report");
          triggerMissionProgress("challenge_audits");
        }
      }
    } catch (err) {
      console.error("Failed to reject issue:", err);
    }
  };

  // Community Upload Photo handler
  const handleUploadCommunityPhoto = async (issueId: string, imageUrl: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, userId: currentUser.uid })
      });
      const json = await res.json();
      if (json.status === "success" && json.data) {
        const updatedIssue = json.data as Issue;
        setIssues((prev) => prev.map((item) => (item.id === issueId ? updatedIssue : item)));
        awardXpAndHeroScore(75, 8, "Uploaded on-site verification photo");
        triggerMissionProgress("mission_photo");
      }
    } catch (err) {
      console.error("Failed to upload community photo:", err);
    }
  };

  // Add issue handler (Citizen Portal)
  const handleAddIssue = async (issueData: Partial<Issue>) => {
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(issueData)
      });
      const json = await res.json();
      if (json.status === "success" && json.data) {
        if (json.merged) {
          const mergedIssue = json.data as Issue;
          setIssues((prev) => prev.map((item) => (item.id === mergedIssue.id ? mergedIssue : item)));
          setSelectedIssueId(mergedIssue.id);
          setDuplicateMessage(json.message || "This issue already exists. Your report has been added as a community verification.");
          awardXpAndHeroScore(50, 5, "Verified duplicate incident report");
        } else {
          const newIssue = json.data as Issue;
          setIssues((prev) => [newIssue, ...prev]);
          setSelectedIssueId(newIssue.id); // Highlight newly created issue on Map!
          awardXpAndHeroScore(100, 10, "Reported new community concern");
          triggerMissionProgress("mission_report");
        }
      }
    } catch (err) {
      console.error("Failed to report new civic incident:", err);
    }
  };

  // Helpful Comment handler
  const handlePostComment = async (issueId: string, text: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          userName: currentUser.displayName,
          text
        })
      });
      const json = await res.json();
      if (json.status === "success" && json.data) {
        const updatedIssue = json.data as Issue;
        setIssues((prev) => prev.map((item) => (item.id === issueId ? updatedIssue : item)));
        awardXpAndHeroScore(30, 3, "Posted advice on active issue");
        triggerMissionProgress("challenge_comments");
      }
    } catch (err) {
      console.error("Failed to post advisory comment:", err);
    }
  };

  // Help comment helpfulness vote
  const handleCommentHelpfulVote = async (issueId: string, commentId: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/comments/${commentId}/helpful`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.uid })
      });
      const json = await res.json();
      if (json.status === "success" && json.data) {
        const updatedIssue = json.data as Issue;
        setIssues((prev) => prev.map((item) => (item.id === issueId ? updatedIssue : item)));
        awardXpAndHeroScore(10, 1, "Voted comment as helpful");
      }
    } catch (err) {
      console.error("Failed to endorse comment:", err);
    }
  };

  // Update issue status handler (Authority Portal)
  const handleUpdateStatus = async (
    issueId: string,
    status: IssueStatus,
    worker: string | null,
    notes: string | null,
    photo: string | null
  ) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          assignedWorker: worker,
          resolutionNotes: notes,
          resolutionPhoto: photo
        })
      });
      const json = await res.json();
      if (json.status === "success" && json.data) {
        const updatedIssue = json.data as Issue;
        setIssues((prev) => prev.map((item) => (item.id === issueId ? updatedIssue : item)));

        // If solved, award 150 XP and 15 Hero points to original citizen reporter!
        if (status === "Resolved") {
          awardXpAndHeroScore(150, 15, "Report resolved by authority dispatch!");
          
          // Auto unlock 'clean_up' badge (Urban Guardian)
          setCurrentUser((prev) => {
            const updatedBadges = [...prev.badges];
            const hasCleanUp = updatedBadges.some(b => b.id === "clean_up");
            if (!hasCleanUp) {
              const cleanUpBadge = MOCK_BADGES.find(b => b.id === "clean_up");
              if (cleanUpBadge) {
                updatedBadges.push({
                  ...cleanUpBadge,
                  unlockedAt: new Date().toISOString()
                });
                setToastMessage(`🏆 New Badge Unlocked: ${cleanUpBadge.name}!`);
              }
            }
            return { ...prev, badges: updatedBadges };
          });
        }
      }
    } catch (err) {
      console.error("Failed to patch issue workorder:", err);
    }
  };

  // Select/Deselect pins
  const handleSelectIssue = (issueId: string) => {
    setSelectedIssueId(issueId === selectedIssueId ? null : issueId);
  };

  // Toggle citizen/authority roles
  const handleToggleRole = (role: "Citizen" | "Authority" | "Insights") => {
    if (role === "Citizen") {
      setCurrentUser(INITIAL_USER);
      setActiveTab("Citizen");
    } else if (role === "Authority") {
      setCurrentUser(INITIAL_AUTHORITY_USER);
      setActiveTab("Authority");
    } else {
      setActiveTab("Insights");
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-200 flex flex-col font-sans selection:bg-indigo-500 selection:text-white bg-slate-50 text-gray-800 dark:bg-slate-950 dark:text-slate-100" id="community-hero-app">
      {/* GLOBAL BANNER HEADER - Glassmorphic design */}
      <header className="glass-panel border-b sticky top-0 z-40 transition-all duration-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="p-2.5 bg-indigo-600 dark:bg-indigo-500 rounded-xl text-white shadow-sm flex items-center justify-center"
            >
              <ShieldAlert className="w-5 h-5" />
            </motion.div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-gray-900 dark:text-white uppercase font-display">Community Hero</h1>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase font-mono tracking-wider -mt-0.5">
                Hyperlocal Problem Solver
              </p>
            </div>
          </div>

          {/* TELEMETRY ENGINE SYNC INDICATOR */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 rounded-xl text-[10px] font-mono text-gray-500 dark:text-slate-400 backdrop-blur-xs">
            <Activity className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 animate-pulse" />
            <span>Database Status: <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold uppercase">Live Node</strong></span>
            <button
              onClick={fetchIssues}
              disabled={syncing}
              className="ml-1 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-transparent border-0 cursor-pointer p-0.5"
              title="Sync Database"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* ROLE & INSIGHTS SWITCHER + THEME TOGGLE */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-1 bg-slate-100/80 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl">
              <button
                onClick={() => handleToggleRole("Citizen")}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "Citizen"
                    ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs font-extrabold"
                    : "text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Citizen App</span>
              </button>
              <button
                onClick={() => handleToggleRole("Authority")}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "Authority"
                    ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs font-extrabold"
                    : "text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Authority Board</span>
              </button>
              <button
                onClick={() => handleToggleRole("Insights")}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "Insights"
                    ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs font-extrabold"
                    : "text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AI Insights</span>
              </button>
            </div>

            {/* DARK MODE SWITCHER */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-amber-400 border border-slate-200/80 dark:border-slate-800/85 rounded-xl cursor-pointer flex items-center justify-center transition"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </motion.button>
          </div>
        </div>
      </header>

      {loading ? (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Skeleton Column: Map */}
            <div className="w-full lg:w-5/12 space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-4 w-48 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-3 w-32 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              </div>
              <div className="w-full h-[450px] md:h-[550px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-3xl p-6 flex flex-col justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-slate-800 rounded-xl animate-pulse" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-1/3 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                    <div className="h-3 w-1/4 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                  </div>
                </div>
                <div className="h-[280px] md:h-[350px] bg-slate-50 dark:bg-slate-950/40 rounded-2xl w-full border border-gray-100 dark:border-slate-800/50 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 dark:via-white/5 to-transparent animate-shimmer -translate-x-full" />
                  <RefreshCw className="w-8 h-8 text-indigo-500/40 animate-spin" />
                </div>
                <div className="h-10 w-full bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              </div>
            </div>

            {/* Right Skeleton Column: Content feed list */}
            <div className="w-full lg:w-7/12 space-y-6">
              {/* User stats profile skeleton */}
              <div className="p-5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-3xl flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-gray-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                    <div className="h-3 w-24 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                  </div>
                </div>
                <div className="h-8 w-24 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              </div>

              {/* Feed tabs skeleton */}
              <div className="flex gap-4 border-b border-gray-200 dark:border-slate-800/80 pb-px">
                <div className="h-8 w-24 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-8 w-24 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-8 w-24 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              </div>

              {/* Filter tools skeleton */}
              <div className="p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-2xl flex justify-between items-center shadow-xs">
                <div className="h-8 w-40 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-8 w-32 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              </div>

              {/* Issue list skeleton */}
              <SkeletonLoader type="card" count={2} />
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === "Insights" ? (
            <AIInsightsDashboard issues={issues} />
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* LEFT COLUMN: INTERACTIVE SATELLITE GPS MAP */}
              <div className="w-full lg:w-5/12 h-fit lg:sticky lg:top-20 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-gray-800 flex items-center gap-1.5 uppercase font-mono tracking-wider">
                    <MapPin className="w-4.5 h-4.5 text-indigo-500" /> Neighborhood GPS Grid Telemetry
                  </h3>
                  <span className="text-[10px] font-mono text-gray-400">Centered: SF 37.7749° N, 122.4194° W</span>
                </div>
                <IssueMap
                  issues={issues}
                  selectedIssueId={selectedIssueId}
                  onSelectIssue={handleSelectIssue}
                />
              </div>

              {/* RIGHT COLUMN: CITIZEN APP vs AUTHORITY COMMAND CENTER */}
              <div className="w-full lg:w-7/12 space-y-6">
                {activeTab === "Citizen" ? (
                  <CitizenPortal
                    user={currentUser}
                    issues={issues}
                    onVote={handleVoteIssue}
                    onInspect={handleSelectIssue}
                    selectedIssueId={selectedIssueId}
                    onAddIssue={handleAddIssue}
                    onUpdatePoints={handleUpdatePoints}
                    onVerify={handleVerifyIssue}
                    onReject={handleRejectIssue}
                    onUploadPhoto={handleUploadCommunityPhoto}
                    onPostComment={handlePostComment}
                    onHelpfulCommentVote={handleCommentHelpfulVote}
                    dailyMissions={dailyMissions}
                    weeklyChallenges={weeklyChallenges}
                  />
                ) : (
                  <AuthorityDashboard
                    issues={issues}
                    onUpdateStatus={handleUpdateStatus}
                    selectedIssueId={selectedIssueId}
                    onSelectIssue={handleSelectIssue}
                  />
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* FOOTER */}
      <footer className="glass-panel border-t py-6 text-center text-xs text-gray-400 dark:text-slate-500 font-mono transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>Community Hero • Hyperlocal Problem Solver © 2026</span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Built on Enterprise Node Ingress Network
          </span>
        </div>
      </footer>

      {/* Beautiful Toast / Notification Modal for duplicate reports */}
      <AnimatePresence>
        {duplicateMessage && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-emerald-900 border border-emerald-700 text-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 bg-emerald-800 rounded-xl text-emerald-300 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight text-emerald-100 uppercase font-mono">Incident Verified</h3>
                  <p className="text-xs text-emerald-200 mt-2 leading-relaxed">
                    {duplicateMessage}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setDuplicateMessage(null)}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition shadow-inner cursor-pointer"
                >
                  Acknowledge & Sync
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification for XP and Level up */}
      <AnimatePresence>
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="bg-indigo-950/95 backdrop-blur-md border border-indigo-500/30 text-white rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-3 max-w-sm pointer-events-auto"
            >
              <div className="p-2 bg-indigo-600 rounded-xl text-white flex-shrink-0 animate-bounce">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div className="flex-1">
                <h4 className="text-[10px] font-bold font-mono tracking-widest text-indigo-300 uppercase">Civic Activity Logged</h4>
                <p className="text-xs text-white font-extrabold mt-0.5">{toastMessage}</p>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="text-indigo-300 hover:text-white transition text-xs font-bold p-1 bg-transparent border-none cursor-pointer"
              >
                ✕
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
