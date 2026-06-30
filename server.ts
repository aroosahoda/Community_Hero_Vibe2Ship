import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_ISSUES } from "./src/mockData.js";
import { Issue, GeminiAnalysisResult, Severity } from "./src/types.js";
import {
  compareHashes,
  getDistanceInMeters,
  fallbackHash
} from "./src/utils/imageHasher.js";
import {
  VisionAgent,
  DuplicateDetectionAgent,
  RoutingAgent,
  NotificationAgent,
  AnalyticsAgent,
  AgentPipelineStep,
  CompletePipelineResult
} from "./src/server/agents.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser with size limits for uploading images
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// In-memory data store seeded with mock issues
let issues: Issue[] = INITIAL_ISSUES.map(issue => ({
  ...issue,
  verifiedUsers: issue.votedUsers || [],
  rejectedUsers: [],
  updatedPhotos: [],
  lastVerifiedTime: issue.updatedAt || issue.createdAt,
  comments: issue.id === "issue_1" ? [
    {
      id: "comment_1",
      userId: "user_citizen_99",
      userName: "Marcus Finch",
      text: "Passed by this morning, the lane is very tight. Swerving is common here. Please drive slowly!",
      createdAt: "2026-06-28T09:45:00-07:00",
      helpfulVotes: 4,
      votedUsers: ["user_citizen_88", "user_citizen_123"]
    },
    {
      id: "comment_2",
      userId: "user_citizen_88",
      userName: "Clara Diaz",
      text: "Reported this to the city directly too. Good to see it listed here so we can coordinate verifications.",
      createdAt: "2026-06-28T10:12:00-07:00",
      helpfulVotes: 2,
      votedUsers: ["user_citizen_99"]
    }
  ] : []
}));

// ==========================================
// FIREBASE CLOUD MESSAGING (FCM) SIMULATION
// ==========================================

export interface FCMRegistration {
  token: string;
  userId: string;
  userName: string;
  lat: number;
  lng: number;
  address: string;
  topics: string[];
  createdAt: string;
}

export interface FCMPushMessage {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  type: "verified" | "assigned" | "started" | "resolved" | "nearby";
  issueId: string;
  issueCategory: string;
  userId?: string;
  topic?: string;
  token?: string;
  payload: any;
  status: "delivered" | "failed";
}

let fcmRegistrations: FCMRegistration[] = [
  {
    token: "fcm_token_demo_1",
    userId: "user_citizen_99",
    userName: "Marcus Finch",
    lat: 37.7749,
    lng: -122.4194,
    address: "Civic Center, San Francisco, CA",
    topics: ["issue-verified", "issue-assigned", "issue-started", "issue-resolved", "nearby-reports"],
    createdAt: new Date().toISOString()
  }
];

let fcmNotificationsLog: FCMPushMessage[] = [];

export function dispatchFCMNotification(
  type: "verified" | "assigned" | "started" | "resolved" | "nearby",
  issue: any,
  title: string,
  body: string,
  targetUserId?: string
) {
  const messageId = `fcm_msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  let recipients = fcmRegistrations;
  if (targetUserId) {
    recipients = recipients.filter(r => r.userId === targetUserId);
  }

  const topicName = type === "verified" ? "issue-verified" :
                    type === "assigned" ? "issue-assigned" :
                    type === "started" ? "issue-started" :
                    type === "resolved" ? "issue-resolved" :
                    "nearby-reports";

  let topicRecipients = recipients.filter(r => r.topics.includes(topicName));

  if (type === "nearby") {
    topicRecipients = topicRecipients.filter(r => {
      const dist = getDistanceInMeters(r.lat, r.lng, issue.location.lat, issue.location.lng);
      return dist <= 1500; // within 1.5 km
    });
  }

  topicRecipients.forEach(r => {
    const fcmPayload = {
      message: {
        token: r.token,
        notification: {
          title,
          body
        },
        data: {
          issueId: issue.id,
          category: issue.category,
          subcategory: issue.subcategory,
          type,
          click_action: "FLUTTER_NOTIFICATION_CLICK"
        },
        android: {
          priority: type === "nearby" ? "high" : "normal",
          notification: {
            sound: "default",
            color: "#4f46e5"
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title,
                body
              },
              sound: "default"
            }
          }
        }
      }
    };

    const pushLog: FCMPushMessage = {
      id: `${messageId}_${r.userId}`,
      title,
      body,
      timestamp: new Date().toISOString(),
      type,
      issueId: issue.id,
      issueCategory: issue.category,
      userId: r.userId,
      token: r.token,
      payload: fcmPayload,
      status: "delivered"
    };

    fcmNotificationsLog.unshift(pushLog);
  });

  if (topicRecipients.length === 0) {
    const fcmTopicPayload = {
      message: {
        topic: topicName,
        notification: {
          title,
          body
        },
        data: {
          issueId: issue.id,
          category: issue.category,
          subcategory: issue.subcategory,
          type
        }
      }
    };

    const pushLog: FCMPushMessage = {
      id: `${messageId}_topic`,
      title,
      body,
      timestamp: new Date().toISOString(),
      type,
      issueId: issue.id,
      issueCategory: issue.category,
      topic: topicName,
      payload: fcmTopicPayload,
      status: "delivered"
    };

    fcmNotificationsLog.unshift(pushLog);
  }
}

// Initialize Gemini Client Lazily
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (geminiClient) {
    return geminiClient;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "") {
    try {
      geminiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      console.log("Gemini API Client successfully lazily initialized.");
      return geminiClient;
    } catch (err) {
      console.error("Failed to lazily initialize Gemini Client:", err);
    }
  }
  return null;
}

// ==========================================
// API ROUTES
// ==========================================

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: getGeminiClient() ? "live" : "simulation" });
});

// Get all reported issues
app.get("/api/issues", (req, res) => {
  res.json({ status: "success", data: issues });
});

// Create a new reported issue
app.post("/api/issues", (req, res) => {
  const {
    category,
    subcategory,
    severity,
    confidence,
    description,
    location,
    imageUrl,
    department,
    safetyRisk,
    requiresImmediateAttention,
    keywords,
    assignedWorker,
    imageHash,
  } = req.body;

  if (!category || !description || !location || !imageUrl) {
    return res.status(400).json({
      status: "error",
      message: "Missing required fields (category, description, location, imageUrl)",
    });
  }

  const newHash = imageHash || fallbackHash(imageUrl);

  // Check if this is a duplicate (similarity > 90% and location within 50 meters)
  const duplicate = issues.find((issue) => {
    const dist = getDistanceInMeters(
      location.lat,
      location.lng,
      issue.location.lat,
      issue.location.lng
    );

    // Filter location within 50 meters
    if (dist > 50) return false;

    // Compare image hashes
    const existingHash = issue.imageHash || fallbackHash(issue.imageUrl);
    const similarity = compareHashes(newHash, existingHash);

    return similarity > 0.90;
  });

  if (duplicate) {
    // Merge the reports!
    duplicate.votes = (duplicate.votes || 0) + 1;
    duplicate.updatedAt = new Date().toISOString();

    const dist = getDistanceInMeters(
      location.lat,
      location.lng,
      duplicate.location.lat,
      duplicate.location.lng
    );

    console.log(`\n🚨 [DUPLICATE DETECTED] Identical issue within 50m (${dist.toFixed(1)}m away). Merging with existing Issue ID: ${duplicate.id}\n`);

    return res.status(200).json({
      status: "success",
      merged: true,
      data: duplicate,
      message: "This issue already exists. Your report has been added as a community verification."
    });
  }

  const newIssue: Issue = {
    id: `issue_${Date.now()}`,
    category,
    subcategory: subcategory || "General",
    severity: (severity as Severity) || "Medium",
    confidence: confidence || 1.0,
    description,
    location,
    imageUrl,
    status: assignedWorker ? "Assigned" : "Reported",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    department: department || "General Administration",
    safetyRisk: safetyRisk || "Under review by municipal officers.",
    requiresImmediateAttention: requiresImmediateAttention || false,
    keywords: keywords || [],
    votes: 0,
    votedUsers: [],
    verifiedUsers: [],
    rejectedUsers: [],
    updatedPhotos: [],
    lastVerifiedTime: new Date().toISOString(),
    assignedWorker: assignedWorker || null,
    resolutionNotes: null,
    resolutionPhoto: null,
    imageHash: newHash,
  };

  issues.unshift(newIssue);
  dispatchFCMNotification(
    "nearby",
    newIssue,
    `📍 Nearby Issue Reported`,
    `A new "${newIssue.category}" has been reported at ${newIssue.location.address}.`
  );
  res.status(201).json({ status: "success", data: newIssue });
});

// Verification/Vote on an issue
app.post("/api/issues/:id/vote", (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ status: "error", message: "User ID is required" });
  }

  const issueIndex = issues.findIndex((item) => item.id === id);
  if (issueIndex === -1) {
    return res.status(404).json({ status: "error", message: "Issue not found" });
  }

  const issue = issues[issueIndex];

  // Toggle upvote/verification
  const voterIndex = issue.votedUsers.indexOf(userId);
  if (voterIndex > -1) {
    // Already voted, remove vote
    issue.votedUsers.splice(voterIndex, 1);
    issue.votes = Math.max(0, issue.votes - 1);
  } else {
    // Add vote
    issue.votedUsers.push(userId);
    issue.votes += 1;
  }

  issue.updatedAt = new Date().toISOString();
  res.json({ status: "success", data: issue });
});

// Community Verification of an issue
app.post("/api/issues/:id/verify", (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ status: "error", message: "User ID is required" });
  }

  const issueIndex = issues.findIndex((item) => item.id === id);
  if (issueIndex === -1) {
    return res.status(404).json({ status: "error", message: "Issue not found" });
  }

  const issue = issues[issueIndex];
  if (!issue.verifiedUsers) issue.verifiedUsers = [];
  if (!issue.rejectedUsers) issue.rejectedUsers = [];

  // Remove from rejected if they are switching to verify
  const rejectIdx = issue.rejectedUsers.indexOf(userId);
  if (rejectIdx > -1) {
    issue.rejectedUsers.splice(rejectIdx, 1);
  }

  // Toggle verification
  const verifyIdx = issue.verifiedUsers.indexOf(userId);
  if (verifyIdx > -1) {
    // Already verified, undo verification
    issue.verifiedUsers.splice(verifyIdx, 1);
    // Also remove from votedUsers/votes if present
    const votedIdx = issue.votedUsers.indexOf(userId);
    if (votedIdx > -1) {
      issue.votedUsers.splice(votedIdx, 1);
    }
    issue.votes = Math.max(0, (issue.votes || 0) - 1);
  } else {
    // Verify
    issue.verifiedUsers.push(userId);
    // Also add to votedUsers if not present
    if (issue.votedUsers.indexOf(userId) === -1) {
      issue.votedUsers.push(userId);
    }
    issue.votes = (issue.votes || 0) + 1;
    issue.lastVerifiedTime = new Date().toISOString();
    
    // Trigger FCM Notification for community verification!
    dispatchFCMNotification(
      "verified",
      issue,
      `🛡️ Issue Verified by Community`,
      `The reported "${issue.category}" at ${issue.location.address} has been verified as active by local citizens.`
    );
  }

  issue.updatedAt = new Date().toISOString();
  res.json({ status: "success", data: issue });
});

// Community Rejection / Dispute of an issue
app.post("/api/issues/:id/reject", (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ status: "error", message: "User ID is required" });
  }

  const issueIndex = issues.findIndex((item) => item.id === id);
  if (issueIndex === -1) {
    return res.status(404).json({ status: "error", message: "Issue not found" });
  }

  const issue = issues[issueIndex];
  if (!issue.verifiedUsers) issue.verifiedUsers = [];
  if (!issue.rejectedUsers) issue.rejectedUsers = [];

  // Remove from verified if switching to reject
  const verifyIdx = issue.verifiedUsers.indexOf(userId);
  if (verifyIdx > -1) {
    issue.verifiedUsers.splice(verifyIdx, 1);
    // Also remove from votedUsers
    const votedIdx = issue.votedUsers.indexOf(userId);
    if (votedIdx > -1) {
      issue.votedUsers.splice(votedIdx, 1);
    }
    issue.votes = Math.max(0, (issue.votes || 0) - 1);
  }

  // Toggle rejection
  const rejectIdx = issue.rejectedUsers.indexOf(userId);
  if (rejectIdx > -1) {
    // Undo rejection
    issue.rejectedUsers.splice(rejectIdx, 1);
  } else {
    // Reject
    issue.rejectedUsers.push(userId);
    issue.lastVerifiedTime = new Date().toISOString();
  }

  issue.updatedAt = new Date().toISOString();
  res.json({ status: "success", data: issue });
});

// Upload community-updated status photo for community verification
app.post("/api/issues/:id/photo", (req, res) => {
  const { id } = req.params;
  const { imageUrl, userId } = req.body;

  if (!imageUrl || !userId) {
    return res.status(400).json({ status: "error", message: "imageUrl and userId are required" });
  }

  const issueIndex = issues.findIndex((item) => item.id === id);
  if (issueIndex === -1) {
    return res.status(404).json({ status: "error", message: "Issue not found" });
  }

  const issue = issues[issueIndex];
  if (!issue.updatedPhotos) issue.updatedPhotos = [];

  issue.updatedPhotos.push({
    url: imageUrl,
    uploadedAt: new Date().toISOString(),
    uploadedBy: userId,
  });

  // Uploading an updated photo acts as verification too
  if (!issue.verifiedUsers) issue.verifiedUsers = [];
  if (issue.verifiedUsers.indexOf(userId) === -1) {
    issue.verifiedUsers.push(userId);
    if (issue.votedUsers.indexOf(userId) === -1) {
      issue.votedUsers.push(userId);
    }
    issue.votes = (issue.votes || 0) + 1;
  }

  // Remove from rejections if they upload a photo
  if (!issue.rejectedUsers) issue.rejectedUsers = [];
  const rejectIdx = issue.rejectedUsers.indexOf(userId);
  if (rejectIdx > -1) {
    issue.rejectedUsers.splice(rejectIdx, 1);
  }

  issue.lastVerifiedTime = new Date().toISOString();
  issue.updatedAt = new Date().toISOString();

  res.json({ status: "success", data: issue });
});

// Create a comment for an issue
app.post("/api/issues/:id/comments", (req, res) => {
  const { id } = req.params;
  const { userId, userName, text } = req.body;

  if (!userId || !userName || !text) {
    return res.status(400).json({ status: "error", message: "userId, userName, and text are required" });
  }

  const issueIndex = issues.findIndex((item) => item.id === id);
  if (issueIndex === -1) {
    return res.status(404).json({ status: "error", message: "Issue not found" });
  }

  const issue = issues[issueIndex];
  if (!issue.comments) issue.comments = [];

  const newComment = {
    id: `comment_${Date.now()}`,
    userId,
    userName,
    text,
    createdAt: new Date().toISOString(),
    helpfulVotes: 0,
    votedUsers: []
  };

  issue.comments.push(newComment);
  issue.updatedAt = new Date().toISOString();

  res.json({ status: "success", data: issue });
});

// Upvote comment as helpful
app.post("/api/issues/:id/comments/:commentId/helpful", (req, res) => {
  const { id, commentId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ status: "error", message: "userId is required" });
  }

  const issueIndex = issues.findIndex((item) => item.id === id);
  if (issueIndex === -1) {
    return res.status(404).json({ status: "error", message: "Issue not found" });
  }

  const issue = issues[issueIndex];
  if (!issue.comments) issue.comments = [];

  const comment = issue.comments.find((c) => c.id === commentId);
  if (!comment) {
    return res.status(404).json({ status: "error", message: "Comment not found" });
  }

  const voteIndex = comment.votedUsers.indexOf(userId);
  if (voteIndex > -1) {
    // Undo vote
    comment.votedUsers.splice(voteIndex, 1);
    comment.helpfulVotes = Math.max(0, comment.helpfulVotes - 1);
  } else {
    // Upvote
    comment.votedUsers.push(userId);
    comment.helpfulVotes += 1;
  }

  res.json({ status: "success", data: issue });
});

// Update an issue status/worker assignment (Authority Dashboard)
app.patch("/api/issues/:id/status", (req, res) => {
  const { id } = req.params;
  const { status, assignedWorker, resolutionNotes, resolutionPhoto } = req.body;

  const issueIndex = issues.findIndex((item) => item.id === id);
  if (issueIndex === -1) {
    return res.status(404).json({ status: "error", message: "Issue not found" });
  }

  const issue = issues[issueIndex];
  const oldStatus = issue.status;

  if (status) issue.status = status;
  if (assignedWorker !== undefined) issue.assignedWorker = assignedWorker;
  if (resolutionNotes !== undefined) issue.resolutionNotes = resolutionNotes;
  if (resolutionPhoto !== undefined) issue.resolutionPhoto = resolutionPhoto;

  issue.updatedAt = new Date().toISOString();

  // Trigger Notifications
  if (status && status !== oldStatus) {
    if (status === "Assigned") {
      dispatchFCMNotification(
        "assigned",
        issue,
        `🛠️ Crew Dispatched & Assigned`,
        `Specialist "${issue.assignedWorker || 'Municipal Crew'}" has been assigned to fix your reported ${issue.category}.`
      );
    } else if (status === "In Progress") {
      dispatchFCMNotification(
        "started",
        issue,
        `🚧 Work Started on Repair`,
        `Active work on-site has begun for the reported ${issue.category} at ${issue.location.address}.`
      );
    } else if (status === "Resolved") {
      dispatchFCMNotification(
        "resolved",
        issue,
        `✅ Issue Resolved Successfully`,
        `Good news! The reported "${issue.category}" has been resolved and closed.`
      );
    }
  }

  res.json({ status: "success", data: issue });
});

// ==========================================
// FCM NOTIFICATION ROUTING ENDPOINTS
// ==========================================

// Get list of active FCM simulated device registrations
app.get("/api/notifications/registrations", (req, res) => {
  res.json({ status: "success", data: fcmRegistrations });
});

// Get FCM delivery log/payload terminal console output
app.get("/api/notifications/logs", (req, res) => {
  res.json({ status: "success", data: fcmNotificationsLog });
});

// Register or update an FCM token subscription profile
app.post("/api/notifications/register", (req, res) => {
  const { token, userId, userName, lat, lng, address, topics } = req.body;

  if (!token || !userId) {
    return res.status(400).json({ status: "error", message: "Token and User ID are required" });
  }

  const existingIdx = fcmRegistrations.findIndex(r => r.token === token);
  const registration: FCMRegistration = {
    token,
    userId,
    userName: userName || "Citizen User",
    lat: Number(lat) || 37.7749,
    lng: Number(lng) || -122.4194,
    address: address || "Civic Center, San Francisco, CA",
    topics: Array.isArray(topics) ? topics : ["issue-verified", "issue-assigned", "issue-started", "issue-resolved", "nearby-reports"],
    createdAt: new Date().toISOString()
  };

  if (existingIdx > -1) {
    fcmRegistrations[existingIdx] = registration;
  } else {
    fcmRegistrations.push(registration);
  }

  res.json({ status: "success", data: registration });
});

// Direct simulator endpoint to test specific FCM scenarios
app.post("/api/notifications/simulate", (req, res) => {
  const { type, issueId } = req.body;

  const issue = issues.find(i => i.id === issueId) || issues[0];
  if (!issue) {
    return res.status(404).json({ status: "error", message: "No issues available to simulate against." });
  }

  let title = "";
  let body = "";

  switch (type) {
    case "verified":
      title = `🛡️ FCM PUSH: Issue Verified`;
      body = `The community verified "${issue.category}" at ${issue.location.address}. Verification audit succeeded.`;
      break;
    case "assigned":
      title = `🛠️ FCM PUSH: Crew Assigned`;
      body = `Maintenance specialist has been dispatched to fix "${issue.subcategory}" under ${issue.department}.`;
      break;
    case "started":
      title = `🚧 FCM PUSH: Work Started`;
      body = `Municipal crews have arrived on site at ${issue.location.address} and initiated physical repairs.`;
      break;
    case "resolved":
      title = `✅ FCM PUSH: Issue Resolved`;
      body = `A repair audit has marked "${issue.category}" as Resolved. Thank you for your reporting!`;
      break;
    case "nearby":
      title = `📍 FCM PUSH: Nearby Report Reported`;
      body = `ALERT: A new "${issue.category}" has been reported 180m from your registered home sector.`;
      break;
    default:
      return res.status(400).json({ status: "error", message: "Invalid FCM trigger type requested." });
  }

  dispatchFCMNotification(type, issue, title, body);
  res.json({ status: "success", message: `FCM push event "${type}" dispatched successfully.` });
});

// ==========================================
// USER UPLOADS & MEDIA SYSTEM
// ==========================================

interface UserUpload {
  name: string;
  url: string;
  date: string;
  size?: number;
}

let uploadedImages: UserUpload[] = [
  {
    name: "Road Pothole (Demo)",
    url: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=600",
    date: new Date().toISOString(),
  },
  {
    name: "Garbage Pile (Demo)",
    url: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=600",
    date: new Date().toISOString(),
  },
  {
    name: "Broken Water Pipe (Demo)",
    url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=600",
    date: new Date().toISOString(),
  }
];

// Get all uploaded images
app.get("/api/uploads", (req, res) => {
  res.json({ status: "success", data: uploadedImages });
});

// Upload image endpoint
app.post("/api/upload", (req, res) => {
  const { imageBase64, mimeType, filename } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ status: "error", message: "imageBase64 is required" });
  }

  try {
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Clean base64 data
    const cleanedBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanedBase64, "base64");

    // Determine extension
    let extension = "jpg";
    if (mimeType) {
      const parts = mimeType.split("/");
      if (parts.length === 2) {
        extension = parts[1];
      }
    }

    const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const safeFilename = `upload_${uniqueId}.${extension}`;
    const filePath = path.join(uploadsDir, safeFilename);

    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/${safeFilename}`;
    const newUpload: UserUpload = {
      name: filename || `Upload ${new Date().toLocaleTimeString()}`,
      url: relativeUrl,
      date: new Date().toISOString(),
      size: buffer.length
    };

    uploadedImages.unshift(newUpload);

    res.json({ status: "success", data: newUpload });
  } catch (err) {
    console.error("File upload error:", err);
    res.status(500).json({ status: "error", message: err instanceof Error ? err.message : String(err) });
  }
});

// AI analysis endpoint (image understanding using Agent-Based Architecture)
app.post("/api/analyze-image", async (req, res) => {
  const { imageBase64, mimeType, location } = req.body;

  if (!imageBase64) {
    return res.status(400).json({
      status: "error",
      message: "Base64 image string is required in the imageBase64 body parameter.",
    });
  }

  const imageMimeType = mimeType || "image/jpeg";
  const targetLocation = location || { lat: 34.0522, lng: -118.2437, address: "Civic Center, Los Angeles, CA" };

  try {
    const pipelineLogs: AgentPipelineStep[] = [];
    const client = getGeminiClient();

    // 1. VISION AGENT (Calls Gemini cognitive model)
    const { output: visionOutput, logs: visionLogs } = await VisionAgent.process(
      imageBase64,
      imageMimeType,
      client
    );
    pipelineLogs.push({
      agentName: "VisionAgent",
      status: "success",
      timestamp: new Date().toISOString(),
      input: { imageMimeType, imageSizeBase64: imageBase64.length },
      output: visionOutput,
      logMessages: visionLogs
    });

    // 2. DUPLICATE DETECTION AGENT (Non-Gemini, structured logic)
    const newHash = fallbackHash(imageBase64);
    const { output: duplicateOutput, logs: duplicateLogs } = await DuplicateDetectionAgent.process(
      visionOutput,
      issues,
      newHash,
      targetLocation
    );
    pipelineLogs.push({
      agentName: "DuplicateDetectionAgent",
      status: "success",
      timestamp: new Date().toISOString(),
      input: { visionCategory: visionOutput.category, duplicateKeywords: visionOutput.duplicate_keywords },
      output: duplicateOutput,
      logMessages: duplicateLogs
    });

    // 3. ROUTING AGENT (Non-Gemini, structured logic)
    const { output: routingOutput, logs: routingLogs } = await RoutingAgent.process(
      visionOutput,
      targetLocation
    );
    pipelineLogs.push({
      agentName: "RoutingAgent",
      status: "success",
      timestamp: new Date().toISOString(),
      input: { visionDepartment: visionOutput.department, severity: visionOutput.severity, targetLocation },
      output: routingOutput,
      logMessages: routingLogs
    });

    // 4. NOTIFICATION AGENT (Non-Gemini, structured logic)
    const { output: notificationOutput, logs: notificationLogs } = await NotificationAgent.process(
      visionOutput,
      duplicateOutput,
      routingOutput
    );
    pipelineLogs.push({
      agentName: "NotificationAgent",
      status: "success",
      timestamp: new Date().toISOString(),
      input: { severity: visionOutput.severity, isDuplicate: duplicateOutput.isDuplicate },
      output: notificationOutput,
      logMessages: notificationLogs
    });

    // 5. ANALYTICS AGENT (Non-Gemini, structured logic)
    const { output: analyticsOutput, logs: analyticsLogs } = await AnalyticsAgent.process(
      visionOutput,
      routingOutput
    );
    pipelineLogs.push({
      agentName: "AnalyticsAgent",
      status: "success",
      timestamp: new Date().toISOString(),
      input: { severity: visionOutput.severity, requiresImmediate: visionOutput.requires_immediate_attention },
      output: analyticsOutput,
      logMessages: analyticsLogs
    });

    // --- PIPELINE LOGGING TO SYSTEM CONSOLE ---
    console.log("\n=======================================================");
    console.log(`🤖 MULTI-AGENT CIVIC AGENT PIPELINE - [${new Date().toLocaleTimeString()}]`);
    console.log("=======================================================");
    pipelineLogs.forEach(step => {
      console.log(`\n▶ [${step.agentName}] [${step.status.toUpperCase()}]`);
      step.logMessages.forEach(msg => console.log(`   ${msg}`));
    });
    console.log("=======================================================\n");

    const completePipelineResult: CompletePipelineResult = {
      vision: visionOutput,
      duplicate: duplicateOutput,
      routing: routingOutput,
      notification: notificationOutput,
      analytics: analyticsOutput,
      pipelineLogs
    };

    // Synthesize the final backwards-compatible result with pipeline telemetry attached
    const combinedResult: GeminiAnalysisResult = {
      ...visionOutput,
      department: routingOutput.assignedDepartment,
      severity: routingOutput.priorityLevel,
      pipeline: completePipelineResult
    };

    res.json({
      status: "success",
      data: combinedResult,
      simulated: !client
    });

  } catch (error) {
    console.error("Multi-Agent Processing Pipeline Failure:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Agent Processing Error: " + (error instanceof Error ? error.message : String(error))
    });
  }
});

// Get AI Insights and Analytics
app.get("/api/insights", async (req, res) => {
  try {
    // 1. Complaint Trends: group by date
    const trends: { [date: string]: number } = {};
    issues.forEach((issue) => {
      if (issue.createdAt) {
        const dateStr = issue.createdAt.split("T")[0];
        trends[dateStr] = (trends[dateStr] || 0) + 1;
      }
    });
    const trendData = Object.keys(trends)
      .sort()
      .map((date) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        Complaints: trends[date]
      }));

    // 2. Most Affected Zones
    const getZone = (address: string) => {
      const addr = (address || "").toLowerCase();
      if (addr.includes("market st") || addr.includes("soma") || addr.includes("financial")) return "Downtown / SOMA";
      if (addr.includes("grove st") || addr.includes("octavia") || addr.includes("hayes")) return "Hayes Valley";
      if (addr.includes("haight")) return "Haight-Ashbury";
      if (addr.includes("columbus") || addr.includes("vallejo") || addr.includes("north beach")) return "North Beach";
      if (addr.includes("mission") || addr.includes("dolores")) return "Mission District";
      return "Civic Center / Richmond";
    };

    const zoneCounts: { [zone: string]: number } = {};
    issues.forEach((issue) => {
      const zone = getZone(issue.location.address);
      zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
    });
    const zoneData = Object.keys(zoneCounts).map((zone) => ({
      zone,
      Complaints: zoneCounts[zone]
    })).sort((a, b) => b.Complaints - a.Complaints);

    // 3. Department Workload
    const deptCounts: { [dept: string]: { total: number; resolved: number; pending: number } } = {};
    issues.forEach((issue) => {
      const dept = issue.department || "General Services";
      if (!deptCounts[dept]) {
        deptCounts[dept] = { total: 0, resolved: 0, pending: 0 };
      }
      deptCounts[dept].total++;
      if (issue.status === "Resolved") {
        deptCounts[dept].resolved++;
      } else {
        deptCounts[dept].pending++;
      }
    });
    const deptData = Object.keys(deptCounts).map((dept) => ({
      department: dept.replace("Department", "Dept").replace("Bureau", ""),
      Complaints: deptCounts[dept].total,
      Resolved: deptCounts[dept].resolved,
      Pending: deptCounts[dept].pending
    })).sort((a, b) => b.Complaints - a.Complaints);

    // 4. Average Resolution Time
    let totalHours = 0;
    let resolvedCount = 0;
    issues.forEach((issue) => {
      if (issue.status === "Resolved" && issue.updatedAt && issue.createdAt) {
        const created = new Date(issue.createdAt).getTime();
        const updated = new Date(issue.updatedAt).getTime();
        const diffHours = (updated - created) / (1000 * 60 * 60);
        if (diffHours > 0) {
          totalHours += diffHours;
          resolvedCount++;
        }
      }
    });
    const avgResolutionTimeHours = resolvedCount > 0 ? Number((totalHours / resolvedCount).toFixed(1)) : 24.5;

    // 5. AI Generated Weekly Insights and Hotspot Predictions
    const client = getGeminiClient();
    let weeklyInsights = "";
    let predictedHotspots: { zone: string; riskLevel: string; reason: string }[] = [];

    const limitWords = (text: string, maxWords: number): string => {
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length <= maxWords) return text;
      return words.slice(0, maxWords).join(" ") + "...";
    };

    if (client) {
      try {
        const issuesSummary = issues.map(i => ({
          category: i.category,
          subcategory: i.subcategory,
          severity: i.severity,
          status: i.status,
          address: i.location.address,
          description: i.description
        }));

        const prompt = `You are a municipal AI coordinator. Analyze these reported civic issues for our city:
${JSON.stringify(issuesSummary)}

Output a JSON object containing:
{
  "weeklyInsights": "A concise, highly professional summary of active issues, community focus, and suggested operations. Limit this text to strictly under 80 words.",
  "predictedHotspots": [
    {
      "zone": "A real neighborhood name based on the data",
      "riskLevel": "Low" | "Medium" | "High" | "Critical",
      "reason": "Explain why this zone is an infrastructure hotspot based on complaints. Limit this explanation to strictly under 80 words."
    }
  ]
}`;

        const response = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                weeklyInsights: { type: Type.STRING },
                predictedHotspots: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      zone: { type: Type.STRING },
                      riskLevel: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ["zone", "riskLevel", "reason"]
                  }
                }
              },
              required: ["weeklyInsights", "predictedHotspots"]
            }
          }
        });

        const parsed = JSON.parse(response.text || "{}");
        if (parsed.weeklyInsights) {
          weeklyInsights = limitWords(parsed.weeklyInsights, 75);
        }
        if (parsed.predictedHotspots && Array.isArray(parsed.predictedHotspots)) {
          predictedHotspots = parsed.predictedHotspots.map((h: any) => ({
            zone: h.zone,
            riskLevel: h.riskLevel,
            reason: limitWords(h.reason, 75)
          }));
        }
      } catch (err) {
        console.error("Gemini failed to generate insights:", err);
      }
    }

    if (!weeklyInsights) {
      const activeCount = issues.filter(i => i.status !== "Resolved").length;
      const criticalCount = issues.filter(i => i.severity === "Critical").length;
      const categoriesCount = issues.reduce((acc, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc; }, {} as any);
      const topCategory = Object.keys(categoriesCount).sort((a,b) => categoriesCount[b] - categoriesCount[a])[0] || "Infrastructure Issues";

      weeklyInsights = `Active complaints currently stand at ${activeCount} cases, with ${criticalCount} critical incidents. Focus heavily on ${topCategory} hazards. Public safety indicators suggest immediate resource deployment to clear water-related hazards and pavement swerve-hazards before commute hours. Field crews should prioritize high-density zones to maximize civic recovery rates.`;
    }

    if (!predictedHotspots || predictedHotspots.length === 0) {
      predictedHotspots = [
        {
          zone: "Haight-Ashbury",
          riskLevel: "Critical",
          reason: "High concentration of water utility failures and flooding risk. Immediate pipe inspections required to prevent sub-surface soil erosion and sidewalk collapses."
        },
        {
          zone: "Downtown / SOMA",
          riskLevel: "High",
          reason: "Rising pavement degradation swerve hazards reported on heavy transit lanes. Potholes are deep enough to cause significant vehicular damage and steering instability."
        },
        {
          zone: "Mission District",
          riskLevel: "Medium",
          reason: "A steady increase in parks maintenance backlog. Exposed wire fences pose contact risks for families; prompt park inspections and structural refits recommended."
        }
      ];
    }

    res.json({
      status: "success",
      data: {
        trendData,
        zoneData,
        deptData,
        avgResolutionTimeHours,
        weeklyInsights,
        predictedHotspots
      },
      simulated: !client
    });

  } catch (error) {
    console.error("Failed to compute Insights:", error);
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// ==========================================
// VITE CLIENT INTEGRATION
// ==========================================

async function startServer() {
  // Serve uploaded images statically
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`==================================================`);
    console.log(`🚀 COMMUNITY HERO FULL-STACK SERVER RUNNING 🚀`);
    console.log(`Server Address: http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`==================================================`);
  });
}

startServer();
