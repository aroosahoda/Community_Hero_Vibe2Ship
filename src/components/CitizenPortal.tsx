import React, { useState, useRef, useEffect } from "react";
import { AppUser, Issue, GeminiAnalysisResult, Severity, LocationInfo } from "../types";
import { compressImage } from "../utils/imageCompressor";
import { generateImageHash } from "../utils/imageHasher";
import {
  Award,
  Megaphone,
  ShieldCheck,
  Plus,
  X,
  Loader,
  Sparkles,
  MapPin,
  Camera,
  Search,
  CheckCircle2,
  AlertTriangle,
  Flame,
  UserCheck,
  Cpu,
  Trophy,
  Target,
  Users,
  MessageSquare,
  TrendingUp,
  History,
  Bell,
  Wifi,
  Terminal,
  Settings,
  Globe,
  RefreshCw,
  Sliders,
  Volume2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import IssueCard from "./IssueCard";
import AnimatedCounter from "./AnimatedCounter";

interface CitizenPortalProps {
  user: AppUser;
  issues: Issue[];
  onVote: (issueId: string) => void;
  onInspect: (issueId: string) => void;
  selectedIssueId: string | null;
  onAddIssue: (newIssue: Partial<Issue>) => void;
  onUpdatePoints: (points: number) => void;
  onVerify: (issueId: string) => void;
  onReject: (issueId: string) => void;
  onUploadPhoto: (issueId: string, imageUrl: string) => void;
  onPostComment?: (issueId: string, text: string) => void;
  onHelpfulCommentVote?: (issueId: string, commentId: string) => void;
  dailyMissions?: { id: string; title: string; description: string; type: string; rewardXp: number; rewardHero: number; progress: number; target: number; completed: boolean }[];
  weeklyChallenges?: { id: string; title: string; description: string; type: string; rewardXp: number; rewardHero: number; progress: number; target: number; completed: boolean }[];
}

export default function CitizenPortal({
  user,
  issues,
  onVote,
  onInspect,
  selectedIssueId,
  onAddIssue,
  onUpdatePoints,
  onVerify,
  onReject,
  onUploadPhoto,
  onPostComment,
  onHelpfulCommentVote,
  dailyMissions = [],
  weeklyChallenges = []
}: CitizenPortalProps) {
  const [activePortalTab, setActivePortalTab] = useState<"feed" | "achievements" | "notifications">("feed");

  // FCM & Notification State
  const [fcmToken, setFcmToken] = useState<string>(() => {
    return localStorage.getItem("civic_fcm_token") || `fcm_token_citizen_${Math.random().toString(36).substring(2, 10)}`;
  });
  const [fcmEnabled, setFcmEnabled] = useState<boolean>(true);
  const [fcmTopics, setFcmTopics] = useState<string[]>(["issue-verified", "issue-assigned", "issue-started", "issue-resolved", "nearby-reports"]);
  
  // Simulated Location for Nearby notifications
  const [simAddress, setSimAddress] = useState<string>("555 Golden Gate Ave, San Francisco, CA");
  const [simCoords, setSimCoords] = useState<{lat: number, lng: number}>({lat: 37.7812, lng: -122.4189});
  
  const [logs, setLogs] = useState<any[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSimulating, setIsSimulating] = useState<string | null>(null);
  const [simulationSuccess, setSimulationSuccess] = useState<string | null>(null);

  // Register token with backend on mount & whenever preferences change
  const registerFcmToken = async () => {
    setIsRegistering(true);
    try {
      await fetch("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: fcmToken,
          userId: user.uid,
          userName: user.displayName,
          lat: simCoords.lat,
          lng: simCoords.lng,
          address: simAddress,
          topics: fcmEnabled ? fcmTopics : []
        })
      });
      localStorage.setItem("civic_fcm_token", fcmToken);
    } catch (err) {
      console.error("Failed to register FCM token:", err);
    } finally {
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    registerFcmToken();
  }, [fcmToken, fcmEnabled, fcmTopics, simCoords]);

  const fetchFcmLogs = async () => {
    try {
      const res = await fetch("/api/notifications/logs");
      const data = await res.json();
      if (data.status === "success" && data.data) {
        setLogs(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch FCM logs:", err);
    }
  };

  useEffect(() => {
    fetchFcmLogs();
    const interval = setInterval(fetchFcmLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerSimulation = async (type: string) => {
    setIsSimulating(type);
    setSimulationSuccess(null);
    try {
      const sampleIssue = issues.length > 0 ? issues[0] : null;
      const res = await fetch("/api/notifications/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          issueId: sampleIssue?.id
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        setSimulationSuccess(`FCM message successfully dispatched for "${type}"!`);
        fetchFcmLogs();
        setTimeout(() => setSimulationSuccess(null), 4000);
      }
    } catch (err) {
      console.error("Simulation trigger failed:", err);
    } finally {
      setIsSimulating(null);
    }
  };

  const handleRotateToken = () => {
    const newToken = `fcm_token_citizen_${Math.random().toString(36).substring(2, 10)}`;
    setFcmToken(newToken);
  };

  const toggleTopic = (topic: string) => {
    setFcmTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  // Filter logs for this token/user or topic-subscribed
  const myNotifications = logs.filter(log => {
    if (!fcmEnabled) return false;
    if (log.token === fcmToken || log.userId === user.uid) return true;
    if (log.topic && fcmTopics.includes(log.topic)) return true;
    return false;
  });
  const [showReportForm, setShowReportForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  // Form Fields
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [formImage, setFormImage] = useState<string>("");
  const [formDescription, setFormDescription] = useState("");

  // Gemini Structured Output Results
  const [analysisResult, setAnalysisResult] = useState<GeminiAnalysisResult | null>(null);

  // Editable fields after analysis
  const [editedCategory, setEditedCategory] = useState("");
  const [editedSubcategory, setEditedSubcategory] = useState("");
  const [editedSeverity, setEditedSeverity] = useState<Severity>("Medium");
  const [editedDepartment, setEditedDepartment] = useState("");
  const [editedSafetyRisk, setEditedSafetyRisk] = useState("");
  const [editedImmediate, setEditedImmediate] = useState(false);
  const [editedKeywords, setEditedKeywords] = useState<string[]>([]);
  const [formAddress, setFormAddress] = useState("455 Golden Gate Ave, San Francisco, CA");
  const [formCoords, setFormCoords] = useState({ lat: 37.7812, lng: -122.4189 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);

  // Camera Capture State
  const [showCameraModal, setShowCameraModal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Dynamic user uploads list (Replacing hardcoded presets)
  const [userUploads, setUserUploads] = useState<{ name: string; url: string; date: string }[]>([]);

  // Fetch dynamic user uploads
  const fetchUserUploads = async () => {
    try {
      const res = await fetch("/api/uploads");
      const json = await res.json();
      if (json.status === "success" && json.data) {
        setUserUploads(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch user uploads:", err);
    }
  };

  useEffect(() => {
    fetchUserUploads();
  }, []);

  // Filter lists based on categories & search
  const filteredIssues = issues.filter((issue) => {
    const matchesCategory = filterCategory === "All" || issue.category === filterCategory;
    const matchesSearch =
      issue.subcategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.location.address.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Handle local image upload via File Input
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processAndUploadImage(file);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      await processAndUploadImage(file);
    } else {
      alert("Please drop a valid image file.");
    }
  };

  // Live Camera Handlers
  const startCamera = async () => {
    setShowCameraModal(true);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      } catch (err) {
        console.error("Failed to access camera:", err);
        alert("Could not access camera. Please check your browser permissions.");
        setShowCameraModal(false);
      }
    }, 150);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCameraModal(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const capturedFile = new File([blob], `camera_capture_${Date.now()}.jpg`, {
              type: "image/jpeg"
            });
            stopCamera();
            await processAndUploadImage(capturedFile);
          }
        }, "image/jpeg", 0.9);
      }
    }
  };

  // Convert File to base64, compress, upload to server, and analyze with Gemini
  const processAndUploadImage = async (file: File) => {
    setAnalyzing(true);
    try {
      // 1. Compress image client-side before sending to server or API
      const compressionResult = await compressImage(file, 1200, 1200, 0.82);

      // 2. Upload to backend
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: compressionResult.base64,
          mimeType: "image/jpeg",
          filename: file.name
        })
      });

      const uploadJson = await uploadRes.json();
      if (uploadJson.status === "success" && uploadJson.data) {
        const uploadedUrl = uploadJson.data.url;
        setFormImage(uploadedUrl);
        await fetchUserUploads(); // Refresh gallery

        // 3. Send to Gemini for parsing
        await analyzeImageWithGemini(compressionResult.base64, "image/jpeg");
      } else {
        throw new Error("Failed to upload image to backend");
      }
    } catch (err) {
      console.error("Image processing/upload failed:", err);
      alert("Image upload and analysis failed: " + (err instanceof Error ? err.message : String(err)));
      setAnalyzing(false);
    }
  };

  // Preset gallery item select / re-analysis trigger
  const handlePresetSelect = async (presetUrl: string) => {
    setFormImage(presetUrl);
    setAnalyzing(true);
    try {
      const response = await fetch(presetUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        await analyzeImageWithGemini(base64String, blob.type);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Conversion failed, falling back to basic trigger:", err);
      setAnalyzing(false);
    }
  };

  // Call server-side Gemini analysis endpoint
  const analyzeImageWithGemini = async (base64Data: string, mimeType: string) => {
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: mimeType,
          location: {
            lat: formCoords.lat,
            lng: formCoords.lng,
            address: formAddress
          }
        })
      });

      const json = await res.json();
      if (json.status === "success" && json.data) {
        const data = json.data as GeminiAnalysisResult;
        setAnalysisResult(data);

        // Pre-populate fields from Gemini structural scanning
        setEditedCategory(data.category);
        setEditedSubcategory(data.subcategory);
        setEditedSeverity(data.severity);
        setEditedDepartment(data.department);
        setEditedSafetyRisk(data.safety_risk);
        setEditedImmediate(data.requires_immediate_attention);
        setEditedKeywords(data.duplicate_keywords || data.visible_objects || []);
        // Trigger alert of high confidence
        onUpdatePoints(user.points + 25); // Award points for run analysis
      } else {
        alert("AI scanning fell back. Creating standard outline.");
        // Mock fallback default values
        setEditedCategory("Road & Pavement");
        setEditedSubcategory("Municipal Maintenance");
        setEditedSeverity("Medium");
        setEditedDepartment("Public Works");
        setEditedSafetyRisk("Pedestrian hazard under investigation.");
        setEditedImmediate(false);
      }
    } catch (err) {
      console.error(err);
      alert("Error analyzing image. Retrying on default categories.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Submitting the compiled report to the platform
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formImage) {
      alert("Please upload or select an issue image.");
      return;
    }

    if (!formDescription) {
      alert("Please add a description of what you observed.");
      return;
    }

    setUploading(true);
    try {
      let calculatedHash = "";
      try {
        calculatedHash = await generateImageHash(formImage);
      } catch (hashErr) {
        console.error("Failed to generate image hash:", hashErr);
      }

      const payload: Partial<Issue> = {
        category: editedCategory || "Public Infrastructure",
        subcategory: editedSubcategory || "Reported Issue",
        severity: editedSeverity,
        confidence: analysisResult ? analysisResult.confidence : 0.85,
        description: formDescription,
        location: {
          lat: formCoords.lat,
          lng: formCoords.lng,
          address: formAddress
        },
        imageUrl: formImage,
        department: editedDepartment || "General Municipal Services",
        safetyRisk: editedSafetyRisk || "Awaiting physical site audit.",
        requiresImmediateAttention: editedImmediate,
        keywords: editedKeywords.length > 0 ? editedKeywords : ["citizens", "civic-report"],
        assignedWorker: analysisResult?.pipeline?.routing?.assignedWorker || null,
        imageHash: calculatedHash
      };

      await onAddIssue(payload);
      onUpdatePoints(user.points + 100); // 100 points for reporting an issue!

      // Reset form
      setShowReportForm(false);
      setFormImage("");
      setFormDescription("");
      setAnalysisResult(null);
    } catch (err) {
      console.error(err);
      alert("Failed to submit civic report.");
    } finally {
      setUploading(false);
    }
  };

  // Set randomized coordinates in San Francisco area for demo purposes
  const randomizeLocation = () => {
    const lat = 37.750 + Math.random() * 0.05;
    const lng = -122.45 + Math.random() * 0.05;
    setFormCoords({ lat, lng });
    setFormAddress(`${Math.floor(Math.random() * 2000) + 100} Sutter St, San Francisco, CA`);
  };

  return (
    <div className="space-y-6" id="citizen-portal-main">
      {/* Citizen Profile & Gamification Dashboard Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
        {/* Decorative Grid Circles */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {(() => {
          const xpInCurrentLevel = user.xp % 250;
          const xpNeededForNextLevel = 250;
          const levelProgressPercent = Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100);

          return (
            <>
              <div className="flex items-center gap-5 relative z-10 w-full md:w-auto">
                <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg border border-indigo-500 flex items-center justify-center text-white flex-shrink-0">
                  <Award className="w-8 h-8 animate-pulse text-amber-300" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-extrabold tracking-tight">{user.displayName}</h2>
                    <span className="text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-900 px-2 py-0.5 rounded uppercase">
                      LEVEL {user.level || 4} CITIZEN
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-amber-400" />
                      Hero Score: {user.heroScore || 75}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">Supervising Mission & Dolores Street Neighborhoods</p>

                  {/* Micro Level Progress Bar */}
                  <div className="w-48 space-y-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate-400">
                      <span>Lvl Progress</span>
                      <span>{xpInCurrentLevel}/250 XP</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden border border-slate-700/50">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${levelProgressPercent}%` }}></div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 mt-3 flex-wrap pt-1">
                    {user.badges.map((badge) => (
                      <div
                        key={badge.id}
                        className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-slate-700/80 transition"
                        title={badge.description}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{badge.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center w-full md:w-auto relative z-10 border-t border-slate-800 md:border-t-0 pt-4 md:pt-0">
                <div className="text-left md:text-right">
                  <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider">TOTAL XP SCORE</span>
                  <div className="text-3xl font-black text-indigo-400 font-sans">
                    <AnimatedCounter value={user.xp} suffix=" XP" />
                  </div>
                </div>
                <button
                  onClick={() => setShowReportForm(true)}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 border border-indigo-400 shadow-md shadow-indigo-950/40 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Report Issue
                </button>
              </div>
            </>
          );
        })()}
      </div>

      {/* CITIZEN PORTAL SUB-NAV TABS */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-slate-800/80 pb-px">
        <button
          onClick={() => setActivePortalTab("feed")}
          className={`pb-3 px-4 font-bold text-xs tracking-wider uppercase transition-all duration-200 border-b-2 cursor-pointer flex items-center gap-2 ${
            activePortalTab === "feed"
              ? "border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-extrabold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Incidents Feed
        </button>
        <button
          onClick={() => setActivePortalTab("achievements")}
          className={`pb-3 px-4 font-bold text-xs tracking-wider uppercase transition-all duration-200 border-b-2 cursor-pointer flex items-center gap-2 relative ${
            activePortalTab === "achievements"
              ? "border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-extrabold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Trophy className="w-4 h-4" />
          Civic Achievements Hub
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
        </button>
        <button
          onClick={() => setActivePortalTab("notifications")}
          className={`pb-3 px-4 font-bold text-xs tracking-wider uppercase transition-all duration-200 border-b-2 cursor-pointer flex items-center gap-2 relative ${
            activePortalTab === "notifications"
              ? "border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-extrabold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Bell className="w-4 h-4" />
          FCM Alerts & Logs
          {myNotifications.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white font-mono animate-pulse">
              {myNotifications.length}
            </span>
          )}
        </button>
      </div>

      {activePortalTab === "achievements" ? (
        <div className="space-y-6">
          {/* Level Progress & Hero Score Bento Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Level Stats */}
            {(() => {
              const xpInCurrentLevel = user.xp % 250;
              const xpNeededForNextLevel = 250;
              const levelProgressPercent = Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100);

              return (
                <div className="glass-panel rounded-3xl p-5 shadow-xs relative overflow-hidden">
                  <h4 className="text-xs font-mono font-bold text-gray-400 dark:text-slate-400 uppercase tracking-widest block font-mono">Citizen Level Status</h4>
                  <div className="flex items-baseline justify-between mt-3">
                    <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Level {user.level || 4}</span>
                    <span className="text-xs font-mono text-gray-500 dark:text-slate-400 font-bold"><AnimatedCounter value={user.xp} /> Total XP</span>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-mono text-gray-400 dark:text-slate-400 mb-1.5 font-semibold">
                      <span>Progress to Level {(user.level || 4) + 1}</span>
                      <span><AnimatedCounter value={xpInCurrentLevel} /> / {xpNeededForNextLevel} XP ({levelProgressPercent}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-50 dark:border-slate-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${levelProgressPercent}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-3 leading-relaxed">
                    Unlock higher citizen levels to gain regional coordinator status, increased report routing priorities, and custom authority badges.
                  </p>
                </div>
              );
            })()}

            {/* Community Hero Score */}
            <div className="bg-gradient-to-br from-amber-50/50 to-amber-100/10 dark:from-amber-950/20 dark:to-amber-900/10 border border-amber-200/50 dark:border-amber-500/20 rounded-3xl p-5 shadow-xs relative overflow-hidden backdrop-blur-md">
              <div className="absolute right-4 top-4 bg-amber-500/10 p-2.5 rounded-2xl border border-amber-500/20 text-amber-600 dark:text-amber-400">
                <Trophy className="w-6 h-6 animate-pulse" />
              </div>
              <h4 className="text-xs font-mono font-bold text-amber-800 dark:text-amber-400 uppercase tracking-widest block font-mono">Community Hero Score</h4>
              <div className="flex items-baseline gap-1 mt-3">
                <span className="text-4xl font-black text-amber-950 dark:text-amber-200 tracking-tight">
                  <AnimatedCounter value={user.heroScore || 75} />
                </span>
                <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-500">HERO RATING</span>
              </div>
              
              <div className="mt-4 flex items-center gap-2 text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl w-fit">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Impact Multiplier: 1.5x Civic Weight</span>
              </div>
              <p className="text-[10px] text-amber-950/70 dark:text-amber-300/70 mt-3 leading-relaxed">
                Your Hero Score reflects real-world problem-solving influence. This score increases whenever reports are validated by crews or help community members.
              </p>
            </div>
          </div>

          {/* Missions & Challenges Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Daily Missions */}
            <div className="glass-panel rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                <h4 className="text-xs font-mono font-bold text-gray-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <Target className="w-4.5 h-4.5 text-indigo-500" />
                  Active Daily Missions
                </h4>
                <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
                  Resets in 16h
                </span>
              </div>

              <div className="space-y-3">
                {dailyMissions.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-2xl border transition flex items-center justify-between gap-4 ${
                      m.completed
                        ? "bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-100/30 dark:border-emerald-500/20"
                        : "bg-gray-50/50 dark:bg-slate-900/40 border-gray-200/50 dark:border-slate-800/50"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-extrabold ${m.completed ? "text-emerald-800 dark:text-emerald-400 line-through animate-pulse" : "text-slate-800 dark:text-white"}`}>
                          {m.title}
                        </span>
                        {m.completed && (
                          <span className="text-[8px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded uppercase">
                            Done
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-tight">{m.description}</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-[9px] font-bold block text-indigo-600 dark:text-indigo-400 font-mono">+{m.rewardXp} XP</span>
                      <span className="text-[9px] font-mono text-gray-400 dark:text-slate-400 block mt-0.5 font-bold">
                        Progress: {m.progress} / {m.target}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Challenges */}
            <div className="glass-panel rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                <h4 className="text-xs font-mono font-bold text-gray-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <Flame className="w-4.5 h-4.5 text-orange-500" />
                  Weekly Sprint Challenges
                </h4>
                <span className="bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
                  4 Days Left
                </span>
              </div>

              <div className="space-y-4">
                {weeklyChallenges.map((c) => {
                  const percent = Math.round((c.progress / c.target) * 100);
                  return (
                    <div key={c.id} className="space-y-1.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-extrabold text-slate-800 dark:text-white block">{c.title}</span>
                          <span className="text-[10px] text-gray-400 dark:text-slate-400 block -mt-0.5">{c.description}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono font-bold text-orange-600 dark:text-orange-400">+{c.rewardXp} XP</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden border border-gray-200/20">
                          <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full" style={{ width: `${percent}%` }}></div>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0">{c.progress}/{c.target}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Leaderboard & Badges room side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Leaderboard Panel */}
            <div className="glass-panel rounded-3xl p-5 shadow-xs space-y-4 lg:col-span-7">
              <h4 className="text-xs font-mono font-bold text-gray-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-100 dark:border-slate-800 pb-3">
                <Users className="w-4.5 h-4.5 text-indigo-500" />
                Bay Area Civic Leaderboard
              </h4>

              <div className="space-y-2">
                {(() => {
                  const competitors = [
                    { name: "Marcus Finch", level: 6, xp: 1420, hero: 142, isMe: false },
                    { name: "Clara Diaz", level: 5, xp: 1150, hero: 115, isMe: false },
                    { name: user.displayName, level: user.level || 4, xp: user.xp, hero: user.heroScore || 75, isMe: true },
                    { name: "Tyler Vance", level: 3, xp: 720, hero: 72, isMe: false },
                    { name: "Elena Rostova", level: 3, xp: 580, hero: 58, isMe: false },
                    { name: "Ryan Patel", level: 2, xp: 310, hero: 31, isMe: false },
                  ];

                  competitors.sort((a, b) => b.xp - a.xp);

                  return competitors.map((c, idx) => {
                    const rank = idx + 1;
                    return (
                      <div
                        key={c.name}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                          c.isMe
                            ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200/50 dark:border-indigo-800/40 shadow-xs scale-[1.01]"
                            : "bg-white/40 dark:bg-slate-900/40 border-gray-100 dark:border-slate-800/50 hover:border-gray-200/80 dark:hover:border-slate-700/80"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            rank === 1
                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60"
                              : rank === 2
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              : rank === 3
                              ? "bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-900/60"
                              : "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-400"
                          }`}>
                            {rank}
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-bold ${c.isMe ? "text-indigo-950 dark:text-indigo-300 font-black" : "text-slate-800 dark:text-slate-200"}`}>
                                {c.name}
                              </span>
                              {c.isMe && (
                                <span className="bg-indigo-600 dark:bg-indigo-500 text-white text-[7px] font-bold px-1 py-0.1 rounded uppercase tracking-wider font-mono">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] font-mono text-gray-400 dark:text-slate-400 uppercase font-bold">
                              Lvl {c.level} • Hero Score: {c.hero}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-xs font-black ${c.isMe ? "text-indigo-600 dark:text-indigo-400 font-extrabold" : "text-slate-700 dark:text-slate-300"}`}>
                            {c.xp}
                          </span>
                          <span className="text-[8px] font-mono text-gray-400 dark:text-slate-400 block uppercase font-bold">XP</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Badges Cabinet */}
            <div className="glass-panel rounded-3xl p-5 shadow-xs space-y-4 lg:col-span-5">
              <h4 className="text-xs font-mono font-bold text-gray-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-100 dark:border-slate-800 pb-3">
                <Trophy className="w-4.5 h-4.5 text-amber-500" />
                Citizen Badge Cabinet
              </h4>

              <div className="grid grid-cols-2 gap-3.5">
                {[
                  { id: "first_report", name: "Civic Pioneer", description: "Report your first issue", icon: "Megaphone", condition: "Create 1 Report" },
                  { id: "verifier", name: "Truth Seeker", description: "Verify 3 reported issues", icon: "ShieldCheck", condition: "Verify 3 Issues" },
                  { id: "clean_up", name: "Urban Guardian", description: "Successfully resolve an issue", icon: "Sparkles", condition: "Resolution dispatch" },
                  { id: "active_citizen", name: "Super Hero", description: "Earn 500 total civic XP", icon: "Award", condition: "Gain 500+ XP" },
                ].map((b) => {
                  const unlocked = user.badges.some((badge) => badge.id === b.id);
                  return (
                    <div
                      key={b.id}
                      className={`p-3 rounded-2xl border flex flex-col items-center text-center space-y-1.5 transition ${
                        unlocked
                          ? "bg-indigo-50/10 dark:bg-indigo-950/20 to-indigo-100/10 dark:to-indigo-900/10 border-indigo-200/50 dark:border-indigo-800/40 shadow-inner"
                          : "bg-gray-50/20 dark:bg-slate-900/20 border-gray-200/40 dark:border-slate-800/40 opacity-55"
                      }`}
                      title={b.description}
                    >
                      <div className={`p-2.5 rounded-xl border flex items-center justify-center ${
                        unlocked
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500"
                      }`}>
                        {b.id === "first_report" && <Megaphone className="w-5 h-5" />}
                        {b.id === "verifier" && <ShieldCheck className="w-5 h-5" />}
                        {b.id === "clean_up" && <Sparkles className="w-5 h-5" />}
                        {b.id === "active_citizen" && <Award className="w-5 h-5" />}
                      </div>
                      <div className="space-y-0.5">
                        <span className={`text-[10px] font-extrabold block leading-tight ${unlocked ? "text-slate-800 dark:text-white" : "text-gray-400 dark:text-slate-500"}`}>
                          {b.name}
                        </span>
                        <span className="text-[8px] font-mono text-gray-400 dark:text-slate-500 block uppercase font-bold tracking-tight">
                          {unlocked ? "Unlocked" : b.condition}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : activePortalTab === "notifications" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="fcm-notifications-bento">
          {/* LEFT PANEL - FCM Configuration & Simulated Triggers (Col span 5) */}
          <div className="lg:col-span-5 space-y-6">
            {/* FCM Service Status */}
            <div className="glass-panel rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                <h4 className="text-xs font-mono font-bold text-gray-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <Wifi className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                  FCM Push Server State
                </h4>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${fcmEnabled ? "bg-emerald-500 animate-ping" : "bg-gray-300 dark:bg-slate-700"}`}></span>
                  <span className="text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400 uppercase">
                    {fcmEnabled ? "Connected" : "Disabled"}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {/* Switch to enable/disable FCM */}
                <div className="flex items-center justify-between p-3 bg-gray-50/50 border border-gray-200/50 rounded-2xl">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Push Notifications (FCM)</span>
                    <span className="text-[10px] text-gray-400 block">Simulate physical device token alerts</span>
                  </div>
                  <button
                    onClick={() => setFcmEnabled(!fcmEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      fcmEnabled ? "bg-indigo-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        fcmEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* FCM Token Display with Rotate/Edit option */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">FCM Device Registration Token</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={fcmToken}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[10px] text-indigo-300 font-mono focus:outline-hidden"
                    />
                    <button
                      onClick={handleRotateToken}
                      className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded-xl transition cursor-pointer"
                      title="Rotate Simulated Token"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Standard Topic Subscriptions */}
            <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-xs space-y-4">
              <h4 className="text-xs font-mono font-bold text-gray-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-100 pb-3">
                <Sliders className="w-4.5 h-4.5 text-indigo-500" />
                FCM Topic Subscriptions (HTTP v1)
              </h4>

              <div className="space-y-2">
                {[
                  { id: "issue-verified", label: "🛡️ Issue Verified", desc: "Verifications of reports by other citizens" },
                  { id: "issue-assigned", label: "🛠️ Crew Assigned", desc: "Municipal dispatch & work crew schedule" },
                  { id: "issue-started", label: "🚧 Work Started", desc: "Crews arrive on site and start active repairs" },
                  { id: "issue-resolved", label: "✅ Issue Resolved", desc: "Successfully resolved and inspected alerts" },
                  { id: "nearby-reports", label: "📍 Nearby Issues", desc: "New reports created within 1.5 km check radius" },
                ].map((topic) => {
                  const subscribed = fcmTopics.includes(topic.id);
                  return (
                    <div
                      key={topic.id}
                      onClick={() => toggleTopic(topic.id)}
                      className={`p-2.5 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                        subscribed
                          ? "bg-indigo-50/20 border-indigo-200/50 hover:bg-indigo-50/40"
                          : "bg-gray-50/30 border-gray-200/20 hover:bg-gray-50/50 opacity-60"
                      }`}
                    >
                      <div>
                        <span className="text-xs font-extrabold text-slate-800 block">{topic.label}</span>
                        <span className="text-[10px] text-gray-400 block leading-tight">{topic.desc}</span>
                      </div>
                      <span className={`text-[8px] font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                        subscribed ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"
                      }`}>
                        {subscribed ? "Subscribed" : "Muted"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Simulated Device Location Settings */}
            <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-xs space-y-4">
              <h4 className="text-xs font-mono font-bold text-gray-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-100 pb-3">
                <MapPin className="w-4.5 h-4.5 text-indigo-500" />
                Simulated Device Coordinate
              </h4>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">Mock Home Address</span>
                  <input
                    type="text"
                    value={simAddress}
                    onChange={(e) => setSimAddress(e.target.value)}
                    className="w-full text-xs border border-gray-200 px-3 py-2 rounded-xl focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] font-mono text-gray-400 block">Latitude</span>
                    <input
                      type="number"
                      value={simCoords.lat}
                      onChange={(e) => setSimCoords(prev => ({ ...prev, lat: Number(e.target.value) }))}
                      className="w-full text-xs font-mono border border-gray-200 px-2 py-1.5 rounded-xl bg-gray-50"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-gray-400 block">Longitude</span>
                    <input
                      type="number"
                      value={simCoords.lng}
                      onChange={(e) => setSimCoords(prev => ({ ...prev, lng: Number(e.target.value) }))}
                      className="w-full text-xs font-mono border border-gray-200 px-2 py-1.5 rounded-xl bg-gray-50"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    const lat = 37.750 + Math.random() * 0.05;
                    const lng = -122.45 + Math.random() * 0.05;
                    setSimCoords({ lat, lng });
                    setSimAddress(`${Math.floor(Math.random() * 1900) + 100} Van Ness Ave, San Francisco, CA`);
                  }}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-xs font-bold border border-gray-200 rounded-xl transition cursor-pointer"
                >
                  Randomize Simulation Address
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL - Live FCM Console Transmission Terminal & Delivery Logs (Col span 7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Live FCM Transmission Terminal */}
            <div className="bg-slate-950 border border-slate-900 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col h-[340px]">
              {/* Terminal Title Bar */}
              <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-wider">
                    FCM-GATEWAY-SERVICE: LISTENING_
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500"></span>
                  <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                </div>
              </div>

              {/* Console logs terminal */}
              <div className="flex-1 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-2.5 scrollbar-none pr-1 select-text">
                <div className="text-slate-500">// Established secure mock socket registration to FCM server instance.</div>
                <div className="text-slate-400">
                  <span className="text-indigo-400">[info]</span> Device registered with token: <span className="text-amber-400">"{fcmToken}"</span>
                </div>
                <div className="text-slate-400">
                  <span className="text-indigo-400">[info]</span> Subscribed topics: <span className="text-emerald-400">[{fcmTopics.join(", ")}]</span>
                </div>
                
                {logs.length === 0 ? (
                  <div className="text-slate-600 mt-4 text-center">// Awaiting downstream HTTP v1 FCM message payloads...</div>
                ) : (
                  logs.slice(0, 10).map((log, idx) => (
                    <div key={log.id || idx} className="p-2.5 bg-slate-900/60 border border-slate-900 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-[9px] text-indigo-400">
                        <span>[DELIVERED_PUSH_SUCCESS]</span>
                        <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-emerald-300 font-bold">{log.title}</div>
                      <div className="text-slate-400 text-[9px]">{log.body}</div>
                      <details className="mt-1 cursor-pointer">
                        <summary className="text-[8px] text-slate-500 hover:text-slate-400">Show Google FCM HTTP v1 JSON Payload</summary>
                        <pre className="p-2 mt-1 bg-black rounded-lg text-[8px] text-emerald-400 overflow-x-auto whitespace-pre-wrap max-h-40 border border-slate-900 leading-normal">
                          {JSON.stringify(log.payload || log, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Instant Event Simulator Overrides */}
            <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-xs space-y-4">
              <div>
                <h4 className="text-xs font-mono font-bold text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
                  <Volume2 className="w-4.5 h-4.5 text-indigo-500" />
                  Instant FCM Broadcast Test Bed
                </h4>
                <p className="text-[10px] text-gray-400 mt-1">
                  Click any button to immediately broadcast an FCM payload for that specific event type.
                </p>
              </div>

              {simulationSuccess && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl text-center">
                  {simulationSuccess}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {[
                  { id: "verified", label: "🛡️ Verify", color: "hover:bg-indigo-50 border-indigo-200 text-indigo-700 bg-indigo-50/10" },
                  { id: "assigned", label: "🛠️ Assign", color: "hover:bg-amber-50 border-amber-200 text-amber-700 bg-amber-50/10" },
                  { id: "started", label: "🚧 Start", color: "hover:bg-orange-50 border-orange-200 text-orange-700 bg-orange-50/10" },
                  { id: "resolved", label: "✅ Resolve", color: "hover:bg-emerald-50 border-emerald-200 text-emerald-700 bg-emerald-50/10" },
                  { id: "nearby", label: "📍 Nearby", color: "hover:bg-rose-50 border-rose-200 text-rose-700 bg-rose-50/10" },
                ].map((trigger) => (
                  <button
                    key={trigger.id}
                    disabled={isSimulating !== null}
                    onClick={() => handleTriggerSimulation(trigger.id)}
                    className={`py-2 px-1 border rounded-xl text-[10px] font-extrabold flex flex-col items-center justify-center gap-1 transition cursor-pointer shrink-0 ${trigger.color}`}
                  >
                    {isSimulating === trigger.id ? (
                      <Loader className="w-4 h-4 animate-spin text-gray-500" />
                    ) : (
                      <span>{trigger.label}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* In-App push notifications history list */}
            <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-xs space-y-4">
              <h4 className="text-xs font-mono font-bold text-gray-700 uppercase tracking-widest flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="flex items-center gap-1.5">
                  <History className="w-4.5 h-4.5 text-indigo-500" />
                  Your Push Notifications History
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold font-mono">
                  {myNotifications.length} RECEIVED
                </span>
              </h4>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {myNotifications.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center p-8 bg-gray-50/40 dark:bg-slate-900/40 border border-dashed border-gray-200 dark:border-slate-800/80 rounded-2xl flex flex-col items-center justify-center"
                  >
                    <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 text-indigo-500 rounded-full mb-3 border border-indigo-100/50 dark:border-indigo-900/30">
                      <Bell className="w-6 h-6 animate-pulse" />
                    </div>
                    <h5 className="text-xs font-bold text-gray-700 dark:text-slate-300">Notification Center Empty</h5>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
                      No push notifications have been routed to this device yet. Use the simulation buttons above to trigger a mock physical push payload.
                    </p>
                  </motion.div>
                ) : (
                  myNotifications.map((log) => (
                    <div key={log.id} className="p-3 bg-white border border-gray-100 hover:border-gray-200 rounded-2xl transition flex items-start gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl mt-0.5 shrink-0">
                        {log.type === "verified" && <ShieldCheck className="w-4.5 h-4.5" />}
                        {log.type === "assigned" && <Sliders className="w-4.5 h-4.5" />}
                        {log.type === "started" && <Terminal className="w-4.5 h-4.5" />}
                        {log.type === "resolved" && <CheckCircle2 className="w-4.5 h-4.5" />}
                        {log.type === "nearby" && <MapPin className="w-4.5 h-4.5" />}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-extrabold text-slate-800">{log.title}</span>
                          <span className="text-[8px] font-mono font-bold text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-normal">{log.body}</p>
                        <div className="flex gap-2 pt-1 flex-wrap">
                          <span className="text-[8px] font-mono font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.2 rounded">
                            {log.issueCategory}
                          </span>
                          <span className="text-[8px] font-mono font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <span className="h-1 w-1 bg-emerald-500 rounded-full"></span>
                            FCM PUSH DELIVERED
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* SEARCH AND FILTERING SYSTEM */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search neighborhood issues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 hover:bg-gray-100 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl focus:outline-hidden transition"
          />
        </div>

        {/* Category filtering tags */}
        <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {["All", "Road & Pavement", "Garbage & Waste", "Water & Drainage", "Lighting & Power", "Public Infrastructure"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0 transition cursor-pointer border ${
                filterCategory === cat
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* NEIGHBORHOOD COMPLAINTS FEED */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-extrabold text-gray-800 flex items-center gap-1.5">
            <Megaphone className="w-5 h-5 text-indigo-500" /> Nearby Civic Complaints
          </h3>
          <span className="text-xs font-mono text-gray-500">Showing {filteredIssues.length} issues</span>
        </div>

        {filteredIssues.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center p-12 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl border border-dashed border-gray-200 dark:border-slate-800/80 max-w-2xl mx-auto shadow-xs"
          >
            <div className="relative inline-flex items-center justify-center p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-full mb-4 border border-amber-100 dark:border-amber-900/40">
              <AlertTriangle className="w-8 h-8" />
              <div className="absolute inset-0 bg-amber-400/10 rounded-full animate-ping" />
            </div>
            <h4 className="text-base font-extrabold text-gray-800 dark:text-white uppercase font-display tracking-tight">No Civic Complaints Found</h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
              There are no reports matching your filters. You can clear your search keywords or category selection to see nearby incidents.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {(searchTerm || filterCategory !== "All") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterCategory("All");
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer border border-gray-200 dark:border-slate-700"
                >
                  Clear Filters & Search
                </button>
              )}
              <button
                onClick={() => setShowReportForm(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs border border-indigo-500"
              >
                Report New Incident
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredIssues.map((issue) => (
              <div key={issue.id}>
                <IssueCard
                  issue={issue}
                  currentUserId={user.uid}
                  onVote={onVote}
                  onInspect={onInspect}
                  isSelected={selectedIssueId === issue.id}
                  onVerify={onVerify}
                  onReject={onReject}
                  onUploadPhoto={onUploadPhoto}
                  onPostComment={onPostComment}
                  onHelpfulCommentVote={onHelpfulCommentVote}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {/* COMPREHENSIVE CITIZEN INCIDENT REPORT MODAL DIALOG */}
      <AnimatePresence>
        {showReportForm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 flex flex-col md:flex-row"
            >
              {/* Left Column: Image uploading and quick tester controls */}
              <div className="md:w-5/12 bg-slate-50 p-6 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4 md:hidden">
                    <h3 className="font-extrabold text-gray-800 text-lg">Report New Problem</h3>
                    <button onClick={() => setShowReportForm(false)} className="p-1 text-gray-400 hover:text-gray-600">✕</button>
                  </div>

                  <h4 className="text-xs font-extrabold text-slate-500 tracking-wider uppercase font-mono mb-3">1. Upload Civic Media</h4>

                  {/* Drag/Drop Image box */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`h-52 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-4 cursor-pointer text-center group transition duration-200 transform ${
                      isDragging
                        ? "border-indigo-600 bg-indigo-50/70 scale-[0.99]"
                        : "border-gray-300 bg-white/80 hover:border-indigo-500 hover:bg-slate-50"
                    }`}
                  >
                    {formImage ? (
                      <div className="w-full h-full relative group">
                        <img src={formImage} alt="Civic preview" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center">
                          <Camera className="w-8 h-8 text-white" />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-2.5 border border-indigo-100 group-hover:scale-105 transition">
                          <Camera className="w-6 h-6 animate-pulse" />
                        </div>
                        <span className="text-xs font-bold text-gray-700">Drag & Drop or Browse files</span>
                        <span className="text-[10px] text-gray-400 mt-1">PNG, JPG or WEBP (Large images are compressed automatically)</span>
                      </>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  {/* Media source selectors */}
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startCamera();
                      }}
                      className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200/50 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Capture Camera
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200/50 active:scale-95"
                    >
                      Browse Files
                    </button>
                  </div>

                  {/* Quick Preset Testers / User Uploads History */}
                  <div className="mt-5 bg-white p-4 rounded-2xl border border-gray-200">
                    <h5 className="text-[11px] font-bold text-gray-500 font-mono tracking-wider mb-2">DYNAMIC USER UPLOADS GALLERY</h5>
                    <p className="text-[10px] text-gray-400 mb-3">Select any recently uploaded civic image or use the default pre-loaded samples to analyze with Gemini:</p>
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {userUploads.map((img, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handlePresetSelect(img.url)}
                          className="flex flex-col items-center bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-xl p-1.5 transition cursor-pointer relative group/item"
                        >
                          <div className="h-10 w-full rounded-md overflow-hidden bg-slate-200">
                            <img src={img.url} alt={img.name} className="w-full h-full object-cover group-hover/item:scale-105 transition duration-300" referrerPolicy="no-referrer" />
                          </div>
                          <span className="text-[9px] font-bold text-gray-600 mt-1 text-center truncate w-full" title={img.name}>{img.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="hidden md:block text-[11px] text-gray-400 font-mono">
                  🔒 Gemini parses this visual layout with real-time JSON schema strict parsing on our isolated, secure server.
                </div>
              </div>

              {/* Right Column: Complete editable form */}
              <form onSubmit={handleSubmitReport} className="md:w-7/12 p-6 flex flex-col justify-between overflow-y-auto max-h-[80vh] md:max-h-full">
                <div>
                  <div className="hidden md:flex justify-between items-center mb-6">
                    <h3 className="font-extrabold text-gray-800 text-lg flex items-center gap-1.5">
                      <Megaphone className="w-5 h-5 text-indigo-600" /> File Hyperlocal Citizen Report
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowReportForm(false)}
                      className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Real-time Gemini loading screen inside form */}
                  {analyzing && (
                    <div className="p-8 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col items-center justify-center text-center space-y-3 mb-6">
                      <Loader className="w-8 h-8 text-indigo-600 animate-spin" />
                      <h4 className="text-xs font-bold text-indigo-800 font-mono tracking-wider">GEMINI AI SCANNING COGNITIVE HAZARDS</h4>
                      <p className="text-[11px] text-indigo-600/80 max-w-xs">
                        Reading physical outlines, extracting key attributes, recommending responsible municipal department, and determining urgency scores...
                      </p>
                    </div>
                  )}

                  {/* AI Scan Success Indicator */}
                  {analysisResult && !analyzing && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col gap-2.5 mb-6">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-emerald-800">AI Scanning Completed successfully (+25 XP)</h4>
                          <p className="text-[11px] text-emerald-700/90 mt-0.5">
                            Gemini automatically resolved the category as <strong className="font-extrabold">{analysisResult.category}</strong> with a confidence of {Math.round(analysisResult.confidence * 100)}%. Please review and tweak details below:
                          </p>
                        </div>
                      </div>

                      <div className="bg-white/80 border border-emerald-200/50 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-emerald-800">
                        {analysisResult.estimated_area && (
                          <div>
                            <span className="font-bold text-emerald-950 font-mono block uppercase text-[9px] tracking-wider">Estimated Area</span>
                            <span className="text-gray-700">{analysisResult.estimated_area}</span>
                          </div>
                        )}
                        {analysisResult.visible_objects && analysisResult.visible_objects.length > 0 && (
                          <div>
                            <span className="font-bold text-emerald-950 font-mono block uppercase text-[9px] tracking-wider">Detected Objects</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {analysisResult.visible_objects.map((obj, i) => (
                                <span key={i} className="bg-emerald-100/70 text-emerald-800 px-1.5 py-0.5 rounded text-[10px]">
                                  {obj}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Multi-Agent Pipeline Visualization Dashboard */}
                  {analysisResult?.pipeline && !analyzing && (
                    <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 mb-6 shadow-lg">
                      <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2.5">
                        <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg shrink-0">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-[11px] font-bold tracking-wider uppercase font-mono text-indigo-400">
                            🤖 Multi-Agent Backend Pipeline
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Autonomous backend agent federation successfully parsed, routed, alerted, and verified this incident.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        {analysisResult.pipeline.pipelineLogs.map((step, idx) => {
                          const getAgentIcon = (name: string) => {
                            switch (name) {
                              case "VisionAgent": return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
                              case "DuplicateDetectionAgent": return <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />;
                              case "RoutingAgent": return <MapPin className="w-3.5 h-3.5 text-rose-400" />;
                              case "NotificationAgent": return <Megaphone className="w-3.5 h-3.5 text-emerald-400" />;
                              case "AnalyticsAgent": return <Award className="w-3.5 h-3.5 text-indigo-400" />;
                              default: return <Cpu className="w-3.5 h-3.5" />;
                            }
                          };

                          const getAgentHeading = (name: string) => {
                            switch (name) {
                              case "VisionAgent": return "Vision Agent (Gemini Cognitive Model)";
                              case "DuplicateDetectionAgent": return "Duplicate Detection Agent";
                              case "RoutingAgent": return "Routing Agent";
                              case "NotificationAgent": return "Notification Agent";
                              case "AnalyticsAgent": return "Analytics Agent";
                              default: return name;
                            }
                          };

                          return (
                            <div key={idx} className="bg-slate-950/60 rounded-xl border border-slate-800 p-2.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {getAgentIcon(step.agentName)}
                                  <span className="font-mono text-[11px] font-bold text-slate-200">
                                    {getAgentHeading(step.agentName)}
                                  </span>
                                </div>
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                                  Active
                                </span>
                              </div>

                              {/* Log Messages */}
                              <div className="mt-2 pl-4 space-y-1 font-mono text-[10px] text-slate-400 border-l border-slate-800">
                                {step.logMessages.map((msg, mIdx) => (
                                  <div key={mIdx} className="flex items-start gap-1">
                                    <span className="text-slate-600 shrink-0">›</span>
                                    <span>{msg}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Structured JSON Output Preview */}
                              <div className="mt-2.5 pl-4">
                                <details className="group cursor-pointer">
                                  <summary className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider select-none list-none flex items-center gap-1 group-open:text-slate-300">
                                    <span>[+] View Communicated JSON Object</span>
                                  </summary>
                                  <pre className="mt-1.5 p-2 bg-slate-900 rounded-lg border border-slate-800 text-[9px] text-indigo-300 overflow-x-auto font-mono max-h-32">
                                    {JSON.stringify(step.output, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Input description of observations */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider font-mono mb-1.5">
                        2. Write Description & Observations
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="State clearly what is broken, size, hazard constraints, and visible impact on neighborhood life..."
                        className="w-full px-3.5 py-2.5 text-xs bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl focus:outline-hidden transition"
                      ></textarea>
                    </div>

                    {/* Geolocation selector panel */}
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-700 font-mono flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-indigo-500" /> 3. Set GPS Coordinates
                        </span>
                        <button
                          type="button"
                          onClick={randomizeLocation}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline font-mono bg-transparent border-0 cursor-pointer"
                        >
                          GPS Randomizer Pin
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 font-mono uppercase">Coordinates</label>
                          <p className="text-xs font-mono text-gray-700 mt-0.5">
                            {formCoords.lat.toFixed(5)}, {formCoords.lng.toFixed(5)}
                          </p>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 font-mono uppercase">Full Street Address</label>
                          <input
                            type="text"
                            required
                            value={formAddress}
                            onChange={(e) => setFormAddress(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 focus:border-indigo-500 rounded-lg focus:outline-hidden transition mt-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Meta Fields (Autofilled by Gemini or manually typed) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 font-mono uppercase mb-1">Category Area</label>
                        <select
                          required
                          value={editedCategory}
                          onChange={(e) => setEditedCategory(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl"
                        >
                          <option value="">-- Choose Category --</option>
                          <option value="Road & Pavement">Road & Pavement</option>
                          <option value="Garbage & Waste">Garbage & Waste</option>
                          <option value="Water & Drainage">Water & Drainage</option>
                          <option value="Lighting & Power">Lighting & Power</option>
                          <option value="Public Infrastructure">Public Infrastructure</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 font-mono uppercase mb-1">Issue Subtype</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Deep pothole, Garbage overflow"
                          value={editedSubcategory}
                          onChange={(e) => setEditedSubcategory(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 font-mono uppercase mb-1">Severity Hazard Level</label>
                        <select
                          required
                          value={editedSeverity}
                          onChange={(e) => setEditedSeverity(e.target.value as Severity)}
                          className="w-full px-3 py-2 text-xs bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 font-mono uppercase mb-1">Recommended Department</label>
                        <input
                          type="text"
                          placeholder="e.g. Dept of Public Works"
                          value={editedDepartment}
                          onChange={(e) => setEditedDepartment(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Safety risks and Urgent checklist */}
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 font-mono uppercase mb-1">Safety Risk / Vulnerability Analysis</label>
                        <input
                          type="text"
                          placeholder="Detail physical threats to local pedestrians or structures"
                          value={editedSafetyRisk}
                          onChange={(e) => setEditedSafetyRisk(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl"
                        />
                      </div>

                      <div className="flex items-center gap-2 bg-red-50 p-3 rounded-xl border border-red-100">
                        <input
                          type="checkbox"
                          id="immediate_attention"
                          checked={editedImmediate}
                          onChange={(e) => setEditedImmediate(e.target.checked)}
                          className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                        />
                        <label htmlFor="immediate_attention" className="text-xs font-bold text-red-800 cursor-pointer flex items-center gap-1.5 selection:bg-transparent">
                          <Flame className="w-4 h-4 text-red-600" />
                          This issue represents an urgent emergency and requires immediate attention!
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReportForm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 border border-gray-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || analyzing}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-md shadow-indigo-100 disabled:bg-gray-300 disabled:shadow-none cursor-pointer"
                  >
                    {uploading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Filing complaint...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Submit Report (+100 XP)
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Live Camera Modal */}
      <AnimatePresence>
        {showCameraModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-lg z-51 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 text-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-800 flex flex-col"
            >
              <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                <h4 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-400" />
                  Live Camera Frame Capture
                </h4>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex flex-col items-center justify-center bg-black/40 min-h-[300px] relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-2xl object-cover bg-black border border-slate-800 shadow-inner max-h-[55vh]"
                />
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
                  <div className="text-[10px] font-mono text-slate-400 bg-slate-950/70 border border-slate-800 px-2.5 py-1 rounded-full backdrop-blur-xs flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    WEBCAM CAMERA ACTIVE
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-md shadow-indigo-950/50 cursor-pointer active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  Capture Photo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING ACTION BUTTON (FAB) FOR INSTANT REPORT CREATION */}
      <div className="fixed bottom-6 right-6 z-30 md:hidden">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowReportForm(true)}
          className="p-4 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white shadow-2xl flex items-center justify-center border border-indigo-400 hover:bg-indigo-500 cursor-pointer"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      </div>

      <div className="fixed bottom-8 right-8 z-30 hidden md:block">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowReportForm(true)}
          className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white shadow-2xl border border-indigo-400/40 cursor-pointer font-bold text-xs tracking-wide uppercase hover:bg-indigo-500 group"
        >
          <Plus className="w-4.5 h-4.5 transition-transform duration-300 group-hover:rotate-90" />
          <span>Report Civic Issue</span>
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-400"></span>
          </span>
        </motion.button>
      </div>
    </div>
  );
}
