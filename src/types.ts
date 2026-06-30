export type Severity = "Low" | "Medium" | "High" | "Critical";
export type IssueStatus = "Reported" | "Assigned" | "In Progress" | "Resolved";
export type UserRole = "Citizen" | "Authority";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LocationInfo {
  lat: number;
  lng: number;
  address: string;
}

export interface Issue {
  id: string;
  category: string;
  subcategory: string;
  severity: Severity;
  confidence: number;
  description: string;
  location: LocationInfo;
  imageUrl: string;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
  department: string;
  safetyRisk: string;
  requiresImmediateAttention: boolean;
  keywords: string[];
  votes: number;
  votedUsers: string[]; // User IDs who upvoted to verify
  verifiedUsers?: string[]; // User IDs who verified the issue
  rejectedUsers?: string[]; // User IDs who rejected/disputed the issue
  lastVerifiedTime?: string; // ISO timestamp of last community verification action
  updatedPhotos?: { url: string; uploadedAt: string; uploadedBy: string }[]; // History of updated photos uploaded by users
  assignedWorker: string | null;
  resolutionNotes: string | null;
  resolutionPhoto: string | null;
  imageHash?: string;
  comments?: IssueComment[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  unlockedAt: string;
}

export interface IssueComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  helpfulVotes: number;
  votedUsers: string[]; // User IDs who upvoted this comment as helpful
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  points: number;
  xp: number;
  level: number;
  heroScore: number;
  completedMissions: string[];
  badges: Badge[];
}

export interface GeminiAnalysisResult {
  category: string;
  subcategory: string;
  severity: Severity;
  confidence: number;
  description: string;
  department: string;
  safety_risk: string;
  estimated_area: string;
  requires_immediate_attention: boolean;
  visible_objects: string[];
  duplicate_keywords: string[];
  pipeline?: CompletePipelineResult;
}

export interface VisionAgentOutput {
  category: string;
  subcategory: string;
  severity: Severity;
  confidence: number;
  description: string;
  department: string;
  safety_risk: string;
  estimated_area: string;
  requires_immediate_attention: boolean;
  visible_objects: string[];
  duplicate_keywords: string[];
}

export interface DuplicateDetectionOutput {
  isDuplicate: boolean;
  confidence: number;
  potentialDuplicateId: string | null;
  reason: string;
}

export interface RoutingOutput {
  assignedDepartment: string;
  priorityLevel: Severity;
  assignedWorker: string | null;
  routingReason: string;
  actionPlan: string[];
}

export interface NotificationOutput {
  channels: ("sms" | "email" | "push" | "dashboard")[];
  recipientGroups: string[];
  alertSubject: string;
  alertBody: string;
  urgency: "low" | "medium" | "high" | "critical";
}

export interface AnalyticsOutput {
  impactScore: number;
  estimatedResolutionHours: number;
  environmentalPriority: "High" | "Medium" | "Low";
  carbonFootprintImpact: string;
  communityPriorityFactor: number;
}

export interface AgentPipelineStep {
  agentName: string;
  status: "success" | "skipped" | "failed";
  timestamp: string;
  input: any;
  output: any;
  logMessages: string[];
}

export interface CompletePipelineResult {
  vision: VisionAgentOutput;
  duplicate: DuplicateDetectionOutput;
  routing: RoutingOutput;
  notification: NotificationOutput;
  analytics: AnalyticsOutput;
  pipelineLogs: AgentPipelineStep[];
}

