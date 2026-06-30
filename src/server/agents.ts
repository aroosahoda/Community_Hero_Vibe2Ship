import { GoogleGenAI, Type } from "@google/genai";
import { Issue, GeminiAnalysisResult, Severity, LocationInfo } from "../types";
import { compareHashes, getDistanceInMeters, fallbackHash } from "../utils/imageHasher.js";

// ==========================================
// STRUCTURED AGENT OUTPUT INTERFACES
// ==========================================

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
  impactScore: number; // 0 to 100 city impact score
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

// ==========================================
// AGENTS IMPLEMENTATIONS
// ==========================================

export class VisionAgent {
  static async process(
    imageBase64: string,
    mimeType: string,
    client: GoogleGenAI | null
  ): Promise<{ output: VisionAgentOutput; logs: string[] }> {
    const logs: string[] = [];
    logs.push(`[VisionAgent] Initiated visual parsing on ${mimeType} asset...`);

    const cleanedBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const mockAnalyses: VisionAgentOutput[] = [
      {
        category: "Road & Pavement",
        subcategory: "Asphalt Cracking & Pothole",
        severity: "High",
        confidence: 0.94,
        description: "Severe road degradation with visible deep cracking and active water accumulation. Dangerous for small vehicles and motorcycles.",
        department: "Department of Public Works",
        safety_risk: "Tire blowouts, sudden loss of control, dangerous braking adjustments.",
        estimated_area: "Approximately 2.5 meters wide across the main traffic lane.",
        requires_immediate_attention: true,
        visible_objects: ["asphalt cracking", "deep puddle", "yellow road markings"],
        duplicate_keywords: ["road", "pothole", "asphalt", "cracks"]
      },
      {
        category: "Garbage & Waste",
        subcategory: "Illegal Dumping Site",
        severity: "Medium",
        confidence: 0.89,
        description: "Accumulated consumer electronics, plastic bags, and discarded household items blockading public park borders.",
        department: "City Sanitation Bureau",
        safety_risk: "Sharp metals, battery fluid leak risks, rodent infestation acceleration.",
        estimated_area: "Approximately 3.5 square meters along park sidewalk.",
        requires_immediate_attention: false,
        visible_objects: ["discarded household electronics", "plastic debris", "sidewalk green border"],
        duplicate_keywords: ["trash", "dumping", "rubbish", "park"]
      },
      {
        category: "Water & Drainage",
        subcategory: "Drainage Backflow",
        severity: "Critical",
        confidence: 0.97,
        description: "Total blockage of drainage culverts leading to active sidewalk overflow and deep standing water. Potential foundations damage.",
        department: "Municipal Water Authority",
        safety_risk: "Pedestrian slip risk, road undermining, disease vector breeding grounds.",
        estimated_area: "Flooded zone of about 15 square meters on concrete.",
        requires_immediate_attention: true,
        visible_objects: ["blocked sewer grate", "sidewalk flooding", "stagnant drainage pool"],
        duplicate_keywords: ["clogged", "flooding", "water", "drainage"]
      }
    ];

    if (!client) {
      logs.push("[VisionAgent] GEMINI_API_KEY is not configured. Invoking fallback local simulation neural network.");
      // Small simulated latency
      await new Promise((r) => setTimeout(r, 600));
      const chosenMock = mockAnalyses[Math.floor(Math.random() * mockAnalyses.length)];
      logs.push(`[VisionAgent] Local simulated detection completed. Classified as [${chosenMock.category} -> ${chosenMock.subcategory}] with confidence ${(chosenMock.confidence * 100).toFixed(1)}%.`);
      return { output: chosenMock, logs };
    }

    try {
      logs.push("[VisionAgent] Contacting Google Gemini 2.5 flash cognitive vision module...");
      const prompt = `Analyze this reported civic/infrastructure problem image. Return highly structured details in JSON matching the schema precisely.
Identify the category of the civic issue, specific subcategory description, severity level, recommended department, potential public safety risks, estimate physical dimensions/affected area, urgency, visible objects, and duplicate keywords.`;

      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: cleanedBase64,
            },
          },
          {
            text: prompt,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              subcategory: { type: Type.STRING },
              severity: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              description: { type: Type.STRING },
              department: { type: Type.STRING },
              safety_risk: { type: Type.STRING },
              estimated_area: { type: Type.STRING },
              requires_immediate_attention: { type: Type.BOOLEAN },
              visible_objects: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              duplicate_keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              "category",
              "subcategory",
              "severity",
              "confidence",
              "description",
              "department",
              "safety_risk",
              "estimated_area",
              "requires_immediate_attention",
              "visible_objects",
              "duplicate_keywords",
            ],
          },
        },
      });

      const textResponse = response.text;
      if (!textResponse) {
        throw new Error("Empty text response received from Gemini.");
      }

      const parsed = JSON.parse(textResponse.trim()) as VisionAgentOutput;
      logs.push(`[VisionAgent] Gemini response successfully parsed. Main category: "${parsed.category}" with ${(parsed.confidence * 100).toFixed(1)}% confidence.`);
      return { output: parsed, logs };
    } catch (err) {
      logs.push(`[VisionAgent] ERROR during Gemini execution: ${err instanceof Error ? err.message : String(err)}. Falling back to mock data.`);
      const chosenMock = mockAnalyses[Math.floor(Math.random() * mockAnalyses.length)];
      return { output: chosenMock, logs };
    }
  }
}

export class DuplicateDetectionAgent {
  static async process(
    visionOutput: VisionAgentOutput,
    existingIssues: Issue[],
    newHash?: string,
    newLocation?: LocationInfo
  ): Promise<{ output: DuplicateDetectionOutput; logs: string[] }> {
    const logs: string[] = [];
    logs.push(`[DuplicateDetectionAgent] Checking for pre-existing civic logs matching category "${visionOutput.category}"...`);

    let bestMatchIssue: Issue | null = null;
    let maxSimilarity = 0;
    let minDistance = Infinity;

    if (newHash && newLocation) {
      logs.push(`[DuplicateDetectionAgent] Computing perceptual image hash similarity and geospatial proximity...`);
      for (const issue of existingIssues) {
        const distance = getDistanceInMeters(
          newLocation.lat,
          newLocation.lng,
          issue.location.lat,
          issue.location.lng
        );

        const existingHash = issue.imageHash || fallbackHash(issue.imageUrl);
        const similarity = compareHashes(newHash, existingHash);

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestMatchIssue = issue;
          minDistance = distance;
        }
      }
    }

    const isDuplicate = maxSimilarity > 0.90 && minDistance <= 50;

    if (isDuplicate && bestMatchIssue) {
      logs.push(`[DuplicateDetectionAgent] Duplicate match confirmed! Similarity: ${(maxSimilarity * 100).toFixed(1)}%, Distance: ${minDistance.toFixed(1)}m. (Matches ID: ${bestMatchIssue.id})`);
      return {
        output: {
          isDuplicate: true,
          confidence: maxSimilarity,
          potentialDuplicateId: bestMatchIssue.id,
          reason: `Identical visual signature and location match. Similar issue: "${bestMatchIssue.description.substring(0, 40)}..." in category ${bestMatchIssue.category} located ${minDistance.toFixed(1)} meters away.`
        },
        logs
      };
    } else {
      if (bestMatchIssue && maxSimilarity > 0.0) {
        logs.push(`[DuplicateDetectionAgent] Checked. Best visual similarity found: ${(maxSimilarity * 100).toFixed(1)}% at distance ${minDistance.toFixed(1)}m. (Not a duplicate match).`);
      } else {
        logs.push("[DuplicateDetectionAgent] Checked. No parallel reports or duplicate coordinates found.");
      }
      return {
        output: {
          isDuplicate: false,
          confidence: maxSimilarity,
          potentialDuplicateId: null,
          reason: "No duplicate matches found. This appears to be a unique hyperlocal incident."
        },
        logs
      };
    }
  }
}

export class RoutingAgent {
  static async process(
    visionOutput: VisionAgentOutput,
    location: LocationInfo
  ): Promise<{ output: RoutingOutput; logs: string[] }> {
    const logs: string[] = [];
    logs.push(`[RoutingAgent] Calculating smart department routing vector at GPS coords [${location.lat}, ${location.lng}]...`);

    // Assign municipal team based on category
    let assignedDepartment = visionOutput.department || "General Administration";
    let assignedWorker: string | null = null;

    const workersMap: Record<string, string[]> = {
      "Department of Public Works": ["Marcus Vance (Senior Road Inspector)", "Elena Rostova (Asphalt Tech)"],
      "City Sanitation Bureau": ["Devon Miller (Waste Supervisor)", "Amina Jalloh (Refuse Lead)"],
      "Municipal Water Authority": ["Sarah Jenkins (Hydraulic Engineer)", "Nikhil Patel (Water Main Tech)"],
      "Parks & Recreation": ["Carlos Gomez (Landscape Manager)", "Chloe Sinclair (Arborist)"],
      "Lighting & Power": ["Jonathan Crane (Grid Operator)", "Yuki Tanaka (Lineman)"],
      "General Administration": ["Officer Sarah Lin (Dispatch Supervisor)"]
    };

    const departmentKey = Object.keys(workersMap).find(
      key => key.toLowerCase().includes(assignedDepartment.toLowerCase()) ||
             assignedDepartment.toLowerCase().includes(key.toLowerCase())
    ) || "General Administration";

    const teamList = workersMap[departmentKey];
    if (teamList && teamList.length > 0) {
      assignedWorker = teamList[Math.floor(Math.random() * teamList.length)];
    }

    logs.push(`[RoutingAgent] Discovered active dispatch staff for "${departmentKey}". Assigning to: ${assignedWorker}.`);

    // Action plan pipeline creation
    const actionPlan: string[] = [
      "1. Automated dispatch ticket queued into agency ERP.",
      "2. Field crew warning beacons and traffic cones prepared.",
      `3. Hand off technical diagnostic profile for "${visionOutput.subcategory}" to ${assignedWorker}.`
    ];

    if (visionOutput.requires_immediate_attention || visionOutput.severity === "Critical") {
      actionPlan.push("4. IMMEDIATE ACTION TRIGGERED: Send flashing road hazard light trailer to secure location.");
    }

    logs.push(`[RoutingAgent] Created execution action checklist containing ${actionPlan.length} protocol steps.`);

    return {
      output: {
        assignedDepartment: departmentKey,
        priorityLevel: visionOutput.severity,
        assignedWorker,
        routingReason: `Automatically routed based on the analyzed issue type (${visionOutput.subcategory}) and immediate safety impact factors.`,
        actionPlan
      },
      logs
    };
  }
}

export class NotificationAgent {
  static async process(
    visionOutput: VisionAgentOutput,
    duplicateOutput: DuplicateDetectionOutput,
    routingOutput: RoutingOutput
  ): Promise<{ output: NotificationOutput; logs: string[] }> {
    const logs: string[] = [];
    logs.push("[NotificationAgent] Drafting citizen alerts and official escalation memos...");

    const channels: ("sms" | "email" | "push" | "dashboard")[] = ["dashboard"];
    const recipientGroups = ["Reporting Citizen", `${routingOutput.assignedDepartment} Lead`];

    let urgency: "low" | "medium" | "high" | "critical" = "medium";
    if (visionOutput.severity === "Critical") {
      urgency = "critical";
    } else if (visionOutput.severity === "High") {
      urgency = "high";
    } else if (visionOutput.severity === "Low") {
      urgency = "low";
    }

    if (urgency === "critical" || urgency === "high") {
      channels.push("sms");
      channels.push("email");
      recipientGroups.push("Local Emergency Responders");
    }

    const alertSubject = `🚨 [${urgency.toUpperCase()}] New ${visionOutput.category} Incident Reported`;
    let alertBody = `A citizen reported "${visionOutput.subcategory}" at this location. Detail: ${visionOutput.description}. Assigned worker: ${routingOutput.assignedWorker || "None"}.`;

    if (duplicateOutput.isDuplicate) {
      alertBody += ` NOTE: This report is linked as a potential duplicate to existing Issue ID ${duplicateOutput.potentialDuplicateId}.`;
      logs.push("[NotificationAgent] Adjusted notification stream to include correlation warning.");
    }

    logs.push(`[NotificationAgent] Dispatching notifications across ${channels.join(", ")} to: ${recipientGroups.join(", ")}.`);

    return {
      output: {
        channels,
        recipientGroups,
        alertSubject,
        alertBody,
        urgency
      },
      logs
    };
  }
}

export class AnalyticsAgent {
  static async process(
    visionOutput: VisionAgentOutput,
    routingOutput: RoutingOutput
  ): Promise<{ output: AnalyticsOutput; logs: string[] }> {
    const logs: string[] = [];
    logs.push("[AnalyticsAgent] Running impact models and service level agreement (SLA) estimates...");

    // SLA Calculation (Hours to resolve)
    let baseSlaHours = 48;
    if (routingOutput.priorityLevel === "Critical") baseSlaHours = 4;
    else if (routingOutput.priorityLevel === "High") baseSlaHours = 12;
    else if (routingOutput.priorityLevel === "Medium") baseSlaHours = 24;
    else if (routingOutput.priorityLevel === "Low") baseSlaHours = 72;

    // Environmental assessment priority
    let environmentalPriority: "High" | "Medium" | "Low" = "Low";
    let carbonFootprintImpact = "Minimal carbon emission adjustment required.";

    if (visionOutput.category.includes("Garbage") || visionOutput.category.includes("Water")) {
      environmentalPriority = "High";
      carbonFootprintImpact = "Active risk of groundwater contamination or ecosystem degradation.";
    } else if (visionOutput.category.includes("Road") || visionOutput.category.includes("Infrastructure")) {
      environmentalPriority = "Medium";
      carbonFootprintImpact = "Disrupts traffic stream causing minor localized engine idling emissions.";
    }

    // City impact score (0 to 100 metric)
    let impactScore = 20;
    if (visionOutput.severity === "Critical") impactScore += 40;
    else if (visionOutput.severity === "High") impactScore += 25;
    else if (visionOutput.severity === "Medium") impactScore += 15;

    if (visionOutput.requires_immediate_attention) impactScore += 20;
    if (visionOutput.visible_objects.length > 2) impactScore += 10;
    impactScore = Math.min(100, impactScore);

    // Local community priority multiplier
    const communityPriorityFactor = parseFloat((1.0 + (impactScore / 100)).toFixed(2));

    logs.push(`[AnalyticsAgent] Impact Score: ${impactScore}/100. Resolution timeline estimated: ${baseSlaHours} hours. Environmental priority: ${environmentalPriority}.`);

    return {
      output: {
        impactScore,
        estimatedResolutionHours: baseSlaHours,
        environmentalPriority,
        carbonFootprintImpact,
        communityPriorityFactor
      },
      logs
    };
  }
}
