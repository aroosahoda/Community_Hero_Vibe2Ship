import React, { useState } from "react";
import { Issue } from "../types";
import { compressImage } from "../utils/imageCompressor";
import {
  MapPin,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  User,
  CheckCircle,
  HelpCircle,
  Construction,
  Trash2,
  Droplets,
  Lightbulb,
  Trees,
  AlertTriangle,
  Camera,
  Image,
  Loader,
  History
} from "lucide-react";
import { motion } from "motion/react";

interface IssueCardProps {
  issue: Issue;
  currentUserId: string;
  onVote: (issueId: string) => void;
  onInspect: (issueId: string) => void;
  isSelected?: boolean;
  onVerify?: (issueId: string) => void;
  onReject?: (issueId: string) => void;
  onUploadPhoto?: (issueId: string, imageUrl: string) => void;
  onPostComment?: (issueId: string, text: string) => void;
  onHelpfulCommentVote?: (issueId: string, commentId: string) => void;
}

export default function IssueCard({
  issue,
  currentUserId,
  onVote,
  onInspect,
  isSelected,
  onVerify,
  onReject,
  onUploadPhoto,
  onPostComment,
  onHelpfulCommentVote
}: IssueCardProps) {
  const hasVoted = issue.votedUsers.includes(currentUserId);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [commentText, setCommentText] = useState("");

  const handlePostCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !onPostComment) return;
    onPostComment(issue.id, commentText.trim());
    setCommentText("");
  };

  const handlePhotoUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);
    try {
      // 1. Compress image client-side
      const compressed = await compressImage(file, 1200, 1200, 0.82);

      // 2. Upload to backend
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: compressed.base64,
          mimeType: "image/jpeg",
          filename: file.name
        })
      });

      const json = await res.json();
      if (json.status === "success" && json.data?.url) {
        // 3. Associate photo with issue
        await onUploadPhoto?.(issue.id, json.data.url);
      } else {
        alert("Photo upload failed");
      }
    } catch (err) {
      console.error("Failed to upload community verification photo:", err);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  };

  // Get category specific icon and colors
  const getCategoryTheme = (category: string) => {
    switch (category) {
      case "Road & Pavement":
        return { icon: Construction, bg: "bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-900/30" };
      case "Garbage & Waste":
        return { icon: Trash2, bg: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" };
      case "Water & Drainage":
        return { icon: Droplets, bg: "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30" };
      case "Lighting & Power":
        return { icon: Lightbulb, bg: "bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400 border-yellow-100 dark:border-yellow-900/30" };
      case "Public Infrastructure":
        return { icon: Trees, bg: "bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border-teal-100 dark:border-teal-900/30" };
      default:
        return { icon: AlertTriangle, bg: "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900/30" };
    }
  };

  const { icon: IconComponent, bg: bgClass } = getCategoryTheme(issue.category);

  // Status Badge classes
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Resolved":
        return "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80";
      case "In Progress":
        return "bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80 animate-pulse";
      case "Assigned":
        return "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/80";
      case "Reported":
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700";
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-400 border-red-200 dark:border-red-900/80 font-bold";
      case "High":
        return "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900/80 font-semibold";
      case "Medium":
        return "bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/80";
      case "Low":
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const verifyCount = issue.verifiedUsers?.length ?? issue.votes ?? 0;
  const rejectCount = issue.rejectedUsers?.length ?? 0;
  const totalVotes = verifyCount + rejectCount;
  const confidencePercent = totalVotes > 0 ? Math.round((verifyCount / totalVotes) * 100) : 100;
  const isVerified = verifyCount >= 2;

  let confidenceColor = "text-emerald-600";
  let confidenceBg = "bg-emerald-500";
  if (confidencePercent < 50) {
    confidenceColor = "text-red-600";
    confidenceBg = "bg-red-500";
  } else if (confidencePercent < 80) {
    confidenceColor = "text-amber-600";
    confidenceBg = "bg-amber-500";
  }

  const isUserVerified = issue.verifiedUsers?.includes(currentUserId) ?? false;
  const isUserRejected = issue.rejectedUsers?.includes(currentUserId) ?? false;

  const friendlyLastVerifiedTime = issue.lastVerifiedTime
    ? new Date(issue.lastVerifiedTime).toLocaleString()
    : new Date(issue.updatedAt || issue.createdAt).toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={`bg-white dark:bg-slate-900 rounded-2xl border ${
        isSelected ? "border-indigo-500 dark:border-indigo-400 shadow-md ring-2 ring-indigo-500/15" : "border-gray-100 dark:border-slate-800/80 shadow-xs"
      } overflow-hidden transition-all duration-300`}
      id={`issue-card-${issue.id}`}
    >
      {/* Top Card Section: Image & Basic Tags */}
      <div className="relative h-44 bg-slate-100 dark:bg-slate-950 cursor-pointer overflow-hidden" onClick={() => onInspect(issue.id)}>
        <img
          src={issue.imageUrl}
          alt={issue.subcategory}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          referrerPolicy="no-referrer"
        />
        {/* Absolute Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 uppercase backdrop-blur-sm bg-white/95 dark:bg-slate-900/95 ${getSeverityStyle(issue.severity)}`}>
            {issue.severity}
          </span>
          {issue.requiresImmediateAttention && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-red-600 text-white border-red-500 animate-pulse flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> URGENT
            </span>
          )}
        </div>

        <span className={`absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold border shadow-md flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm ${getStatusStyle(issue.status)}`}>
          {issue.status}
        </span>
      </div>

      {/* Main Content Area */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className={`p-1.5 rounded-lg border flex items-center justify-center ${bgClass}`}>
            <IconComponent className="w-4 h-4" />
          </span>
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">{issue.category}</span>
        </div>

        <h3
          onClick={() => onInspect(issue.id)}
          className="text-base font-bold text-gray-800 dark:text-white cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition line-clamp-1"
        >
          {issue.subcategory}
        </h3>

        <p className="text-xs text-gray-600 dark:text-slate-300 mt-2 line-clamp-2 leading-relaxed h-8">
          {issue.description}
        </p>

        {/* Location & Time Indicators */}
        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-800/60 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 font-medium">
            <MapPin className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
            <span className="truncate text-gray-700 dark:text-slate-300">{issue.location.address}</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-slate-500 font-mono">
            <Calendar className="w-3.5 h-3.5" />
            <span>Reported: {new Date(issue.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Progress Tracker Horizontal Pipeline Bar */}
        <div className="mt-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
          <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2 font-mono">
            <span className={issue.status !== "Reported" ? "text-indigo-600" : "text-indigo-500 font-extrabold"}>Report</span>
            <span className={issue.status === "Assigned" || issue.status === "In Progress" || issue.status === "Resolved" ? "text-indigo-600" : ""}>Assign</span>
            <span className={issue.status === "In Progress" || issue.status === "Resolved" ? "text-indigo-600" : ""}>Repair</span>
            <span className={issue.status === "Resolved" ? "text-emerald-600" : ""}>Fixed</span>
          </div>
          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden flex">
            <div
              className={`h-full transition-all duration-500 ${
                issue.status === "Resolved"
                  ? "w-full bg-emerald-500"
                  : issue.status === "In Progress"
                  ? "w-[75%] bg-indigo-500 animate-pulse"
                  : issue.status === "Assigned"
                  ? "w-[50%] bg-amber-500"
                  : "w-[25%] bg-slate-400"
              }`}
            ></div>
          </div>
        </div>

        {/* Assigned Worker Info Block */}
        {issue.assignedWorker && (
          <div className="mt-3 flex items-center justify-between text-xs bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
            <span className="text-gray-500 font-medium flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-indigo-500" /> Crew Assigned:
            </span>
            <strong className="text-slate-800 font-bold max-w-[160px] truncate">{issue.assignedWorker}</strong>
          </div>
        )}

        {/* Resolution Notes Block */}
        {issue.status === "Resolved" && issue.resolutionNotes && (
          <div className="mt-3 bg-emerald-50/50 border border-emerald-100/80 p-3 rounded-xl text-xs">
            <h4 className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-600" /> Action Completed
            </h4>
            <p className="text-emerald-700 italic">"{issue.resolutionNotes}"</p>
            {issue.resolutionPhoto && (
              <div className="mt-2 h-20 rounded-lg overflow-hidden border border-emerald-100">
                <img src={issue.resolutionPhoto} alt="Resolution" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
          </div>
        )}

        {/* Interactive Action Buttons */}
        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
          {/* Community Verification (Upvote) Button */}
          <button
            onClick={() => onVote(issue.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border ${
              hasVoted
                ? "bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-200"
                : "bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100"
            }`}
          >
            <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? "fill-white" : ""}`} />
            <span>{hasVoted ? "Verified ✅" : "Verify Issue"}</span>
            <span className={`px-1.5 py-0.5 text-[10px] rounded-md ${hasVoted ? "bg-emerald-700 text-emerald-100" : "bg-indigo-100 text-indigo-700"}`}>
              {issue.votes}
            </span>
          </button>

          {/* Inspect Button */}
          <button
            onClick={() => onInspect(issue.id)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-indigo-600 hover:bg-gray-50 border border-gray-200 hover:border-indigo-100 transition cursor-pointer"
          >
            View Specs
          </button>
        </div>

        {/* Selected/Inspected Community Verification Workspace */}
        {isSelected && (
          <div className="border-t border-indigo-100 bg-indigo-50/10 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-50 pb-3">
              <h4 className="text-xs font-extrabold text-indigo-950 font-mono tracking-wider uppercase flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Community Verification Hub
              </h4>
              {/* Dispatch Eligibility Badge */}
              {isVerified ? (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Eligible for dispatch
                </span>
              ) : (
                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Needs {Math.max(1, 2 - verifyCount)} more votes
                </span>
              )}
            </div>

            {/* Verification Metrics Panel */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-xl border border-indigo-100/30">
                <span className="text-[10px] font-bold text-gray-400 font-mono block uppercase">Verification Score</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-base font-black text-slate-800">{verifyCount}</span>
                  <span className="text-[10px] font-semibold text-gray-400">voted yes</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-100/30">
                <span className="text-[10px] font-bold text-gray-400 font-mono block uppercase">Community Confidence</span>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`text-xs font-extrabold ${confidenceColor}`}>{confidencePercent}%</span>
                  <div className="flex-1 bg-gray-100 h-1 rounded-full overflow-hidden">
                    <div className={`h-full ${confidenceBg}`} style={{ width: `${confidencePercent}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Last Verified Time */}
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500">
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span>Last verified status update: {friendlyLastVerifiedTime}</span>
            </div>

            {/* Verification / Rejection Controls */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              {/* Verify Toggle */}
              <button
                onClick={() => onVerify?.(issue.id)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                  isUserVerified
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-xs"
                    : "bg-white hover:bg-slate-50 text-slate-700 border-gray-200"
                }`}
              >
                <ThumbsUp className={`w-3.5 h-3.5 ${isUserVerified ? "fill-white" : ""}`} />
                <span>{isUserVerified ? "Verified (Undo)" : "Verify Asset"}</span>
              </button>

              {/* Reject Toggle */}
              <button
                onClick={() => onReject?.(issue.id)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                  isUserRejected
                    ? "bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-xs"
                    : "bg-white hover:bg-slate-50 text-slate-700 border-gray-200"
                }`}
              >
                <ThumbsDown className={`w-3.5 h-3.5 ${isUserRejected ? "fill-white" : ""}`} />
                <span>{isUserRejected ? "Disputed (Undo)" : "Dispute Report"}</span>
              </button>
            </div>

            {/* Photo Upload Panel */}
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-700 font-mono uppercase flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-500" />
                  Upload Updated Status Photo
                </label>
                <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">
                  +50 XP reward
                </span>
              </div>

              <p className="text-[10px] text-gray-400 leading-relaxed">
                Are you on-site? Capture or upload a fresh photo of this asset to update community logs and assist dispatches.
              </p>

              {/* Compact file selector input */}
              <div className="flex items-center gap-3">
                <label className="cursor-pointer bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200/50 hover:border-indigo-300 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs">
                  {photoUploading ? (
                    <Loader className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  ) : (
                    <Image className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span>{photoUploading ? "Uploading..." : "Select File / Camera"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={photoUploading}
                    onChange={handlePhotoUploadChange}
                    className="hidden"
                  />
                </label>
                {photoUploading && <span className="text-[10px] font-mono text-gray-400 animate-pulse">Processing image...</span>}
              </div>

              {/* Horizontally scrolling gallery of citizen updated photos */}
              {issue.updatedPhotos && issue.updatedPhotos.length > 0 && (
                <div className="pt-3 border-t border-slate-200/60">
                  <span className="text-[10px] font-bold text-gray-500 font-mono block mb-2 uppercase">Recent Citizen Logs</span>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
                    {issue.updatedPhotos.map((photo, i) => (
                      <div key={i} className="flex-shrink-0 w-20 bg-white border border-slate-200 rounded-lg p-1">
                        <div className="h-12 w-full rounded overflow-hidden bg-slate-100 relative group/pic">
                          <img src={photo.url} alt="User log" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className="text-[8px] font-mono text-gray-400 mt-1 truncate">
                          {new Date(photo.uploadedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Neighborhood Discussion Board / Advisory Notes Panel */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-700 font-mono uppercase flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                  Neighborhood Advisory Panel ({issue.comments?.length || 0})
                </label>
                <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                  +30 XP per advice
                </span>
              </div>

              {/* Comments list */}
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {!issue.comments || issue.comments.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic py-2">
                    No neighborhood recommendations filed yet. Be the first to share advisory notes or safety recommendations!
                  </p>
                ) : (
                  issue.comments.map((comment) => {
                    const isCommentHelpfulVoted = comment.votedUsers?.includes(currentUserId);
                    return (
                      <div key={comment.id} className="bg-slate-50/55 border border-slate-100 p-3 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-indigo-950">{comment.userName}</span>
                            <span className="text-[8px] font-bold bg-slate-200 text-slate-600 px-1 py-0.2 rounded font-mono uppercase">
                              Citizen
                            </span>
                          </div>
                          <span className="text-[9px] font-mono text-gray-400">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-normal">{comment.text}</p>
                        
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => onHelpfulCommentVote?.(issue.id, comment.id)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold border transition ${
                              isCommentHelpfulVoted
                                ? "bg-amber-100 border-amber-200 text-amber-800"
                                : "bg-white hover:bg-slate-50 border-gray-200 text-gray-500 cursor-pointer"
                            }`}
                          >
                            <ThumbsUp className="w-2.5 h-2.5" />
                            <span>
                              {isCommentHelpfulVoted ? `Endorsed (${comment.helpfulVotes})` : `Helpful (${comment.helpfulVotes})`}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Comment submit form */}
              <form onSubmit={handlePostCommentSubmit} className="space-y-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a helpful recommendation, safety tip, or advisory note..."
                  rows={2}
                  maxLength={250}
                  className="w-full p-2.5 text-xs bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl focus:outline-hidden transition resize-none placeholder:text-gray-400"
                />
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-mono text-gray-400">Max 250 characters</span>
                  <button
                    type="submit"
                    disabled={!commentText.trim()}
                    className="px-3.5 py-1.5 rounded-lg text-[10px] font-extrabold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:bg-gray-100 disabled:text-gray-400 cursor-pointer shadow-xs active:scale-95"
                  >
                    File Advice (+30 XP)
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
