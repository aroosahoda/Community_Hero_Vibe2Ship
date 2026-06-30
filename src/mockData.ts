import { Issue, Badge, AppUser } from "./types";

export const MOCK_BADGES: Badge[] = [
  {
    id: "first_report",
    name: "Civic Pioneer",
    description: "Reported your first community issue",
    icon: "Megaphone",
    unlockedAt: "2026-06-28T10:00:00Z"
  },
  {
    id: "verifier",
    name: "Truth Seeker",
    description: "Verified 3 reported issues in your neighborhood",
    icon: "ShieldCheck",
    unlockedAt: "2026-06-29T14:30:00Z"
  },
  {
    id: "clean_up",
    name: "Urban Guardian",
    description: "Successfully resolved a neighborhood issue",
    icon: "Sparkles",
    unlockedAt: ""
  },
  {
    id: "active_citizen",
    name: "Super Hero",
    description: "Earned 500 civic points",
    icon: "Award",
    unlockedAt: ""
  }
];

export const INITIAL_USER: AppUser = {
  uid: "user_citizen_123",
  email: "citizen@communityhero.org",
  displayName: "Alex Mercer",
  role: "Citizen",
  points: 150,
  xp: 750,
  level: 4,
  heroScore: 75,
  completedMissions: [],
  badges: [MOCK_BADGES[0], MOCK_BADGES[1]]
};

export const INITIAL_AUTHORITY_USER: AppUser = {
  uid: "user_auth_999",
  email: "authority@citygov.org",
  displayName: "Director Sarah Vance",
  role: "Authority",
  points: 0,
  xp: 0,
  level: 1,
  heroScore: 0,
  completedMissions: [],
  badges: []
};

export const WORKERS_LIST = [
  "Team A - Road Repair Crew",
  "Team B - City Sanitation",
  "Water Mains Emergency Squad",
  "Street Lighting Maintenance",
  "Parks & Recreation Custodial",
  "Code Enforcement Officer Davis"
];

// Seeded real-world issues in a tight urban radius (around San Francisco coordinates)
export const INITIAL_ISSUES: Issue[] = [
  {
    id: "issue_1",
    category: "Road & Pavement",
    subcategory: "Severe Pothole",
    severity: "High",
    confidence: 0.96,
    description: "Massive pothole in the middle of the right-most lane. Already saw two cars swerve dangerously to avoid it. About 3 feet wide and 6 inches deep.",
    location: {
      lat: 37.7833,
      lng: -122.4167,
      address: "835 Market St, San Francisco, CA"
    },
    imageUrl: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=600",
    status: "Assigned",
    createdAt: "2026-06-28T08:30:00-07:00",
    updatedAt: "2026-06-29T11:00:00-07:00",
    department: "Department of Public Works",
    safetyRisk: "Severe damage to car suspensions, potential steering loss, motorbiker crash hazard.",
    requiresImmediateAttention: true,
    keywords: ["pothole", "cracked asphalt", "road damage", "street repair"],
    votes: 12,
    votedUsers: ["user_citizen_99", "user_citizen_88"],
    assignedWorker: "Team A - Road Repair Crew",
    resolutionNotes: null,
    resolutionPhoto: null
  },
  {
    id: "issue_2",
    category: "Garbage & Waste",
    subcategory: "Illegal Dumping",
    severity: "Medium",
    confidence: 0.94,
    description: "Several bags of construction debris and broken furniture dumped next to the recycling bins in the park alleyway.",
    location: {
      lat: 37.7785,
      lng: -122.4220,
      address: "Grove St & Octavia Blvd, San Francisco, CA"
    },
    imageUrl: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=600",
    status: "Resolved",
    createdAt: "2026-06-27T14:15:00-07:00",
    updatedAt: "2026-06-29T16:45:00-07:00",
    department: "City Sanitation Bureau",
    safetyRisk: "Blockage of public walkways, rodent attractant, environmental hazard.",
    requiresImmediateAttention: false,
    keywords: ["dumping", "trash", "illegal dumping", "debris"],
    votes: 8,
    votedUsers: ["user_citizen_123", "user_citizen_99"],
    assignedWorker: "Team B - City Sanitation",
    resolutionNotes: "Dumpster debris cleared completely. Dispatched street sweeper to wash the asphalt. Warning notice sent to surrounding local sites.",
    resolutionPhoto: "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: "issue_3",
    category: "Water & Drainage",
    subcategory: "Water Main Burst",
    severity: "Critical",
    confidence: 0.98,
    description: "Water pouring out from underneath the sidewalk, causing substantial flooding across the sidewalk and into the gutter. Stream is quite strong.",
    location: {
      lat: 37.7699,
      lng: -122.4468,
      address: "1700 Haight St, San Francisco, CA"
    },
    imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=600",
    status: "In Progress",
    createdAt: "2026-06-30T01:10:00-07:00",
    updatedAt: "2026-06-30T02:00:00-07:00",
    department: "Municipal Water Authority",
    safetyRisk: "Slipping hazard, soil erosion leading to potential sidewalk collapse, waste of drinking water.",
    requiresImmediateAttention: true,
    keywords: ["flooding", "water burst", "leak", "sidewalk pipe"],
    votes: 24,
    votedUsers: ["user_citizen_123", "user_citizen_88", "user_citizen_77"],
    assignedWorker: "Water Mains Emergency Squad",
    resolutionNotes: null,
    resolutionPhoto: null
  },
  {
    id: "issue_4",
    category: "Lighting & Power",
    subcategory: "Flickering Streetlight",
    severity: "Low",
    confidence: 0.91,
    description: "The streetlight on the corner is completely dead or occasionally strobe-flickers. Street is extremely dark at night, making residents feel unsafe.",
    location: {
      lat: 37.7954,
      lng: -122.4028,
      address: "Columbus Ave & Vallejo St, San Francisco, CA"
    },
    imageUrl: "https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&q=80&w=600",
    status: "Reported",
    createdAt: "2026-06-29T21:40:00-07:00",
    updatedAt: "2026-06-29T21:40:00-07:00",
    department: "Electrical Grid Department",
    safetyRisk: "Decreased pedestrian safety, blindspot for turning vehicles, increased petty crime risk.",
    requiresImmediateAttention: false,
    keywords: ["dark", "light out", " streetlight", "electrical"],
    votes: 5,
    votedUsers: [],
    assignedWorker: null,
    resolutionNotes: null,
    resolutionPhoto: null
  },
  {
    id: "issue_5",
    category: "Public Infrastructure",
    subcategory: "Damaged Park Bench & Fence",
    severity: "Medium",
    confidence: 0.89,
    description: "The safety fence bordering the children's playground is broken, leaving jagged metal wires exposed. One bench is also split in half.",
    location: {
      lat: 37.7599,
      lng: -122.4350,
      address: "Mission Dolores Park, San Francisco, CA"
    },
    imageUrl: "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&q=80&w=600",
    status: "Reported",
    createdAt: "2026-06-30T04:30:00-07:00",
    updatedAt: "2026-06-30T04:30:00-07:00",
    department: "Parks & Recreation Department",
    safetyRisk: "Children could scrape themselves on jagged metal wire, fence fail could let kids wander onto street.",
    requiresImmediateAttention: false,
    keywords: ["playground", "broken fence", "park bench", "hazard"],
    votes: 2,
    votedUsers: [],
    assignedWorker: null,
    resolutionNotes: null,
    resolutionPhoto: null
  }
];
