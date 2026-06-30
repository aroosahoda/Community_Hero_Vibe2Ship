import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Issue, Severity, LocationInfo, IssueStatus } from "../types";
import {
  MapPin,
  Layers,
  Flame,
  Eye,
  Navigation,
  Plus,
  Minus,
  RefreshCw,
  SlidersHorizontal,
  ShieldAlert,
  CheckCircle,
  Calendar,
  TrendingUp,
  X,
  Info,
  Compass,
  Map,
  Filter,
  EyeOff,
  Activity,
  Locate
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface IssueMapProps {
  issues: Issue[];
  selectedIssueId: string | null;
  onSelectIssue: (issueId: string) => void;
}

// Bounding box for the San Francisco urban area
const MAP_BOUNDS = {
  minLat: 37.75,
  maxLat: 37.80,
  minLng: -122.45,
  maxLng: -122.40
};

// Map lat/lng coordinates to our 1000x800 base SVG coordinate system
const getXY = (lat: number, lng: number) => {
  const clampedLat = Math.max(MAP_BOUNDS.minLat, Math.min(MAP_BOUNDS.maxLat, lat));
  const clampedLng = Math.max(MAP_BOUNDS.minLng, Math.min(MAP_BOUNDS.maxLng, lng));

  const pctX = (clampedLng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng);
  const pctY = 1 - (clampedLat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);

  const baseWidth = 1000;
  const baseHeight = 800;

  return {
    x: 50 + pctX * (baseWidth - 100),
    y: 50 + pctY * (baseHeight - 100)
  };
};

// Inverse function to get coordinates from X/Y on SVG
const getLatLngFromXY = (x: number, y: number) => {
  const baseWidth = 1000;
  const baseHeight = 800;

  const pctX = (x - 50) / (baseWidth - 100);
  const pctY = (y - 50) / (baseHeight - 100);

  const clampedPctX = Math.max(0, Math.min(1, pctX));
  const clampedPctY = Math.max(0, Math.min(1, pctY));

  const lng = MAP_BOUNDS.minLng + clampedPctX * (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng);
  const lat = MAP_BOUNDS.minLat + (1 - clampedPctY) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);

  return { lat, lng };
};

export default function IssueMap({ issues, selectedIssueId, onSelectIssue }: IssueMapProps) {
  // Navigation & Zoom State
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Map settings and view toggles
  const [layerMode, setLayerMode] = useState<"markers" | "heatmap" | "both">("both");
  const [showRoads, setShowRoads] = useState<boolean>(true);
  const [showParks, setShowParks] = useState<boolean>(true);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);

  // Filters State
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Extract unique categories from issues
  const categories = useMemo(() => {
    const list = new Set(issues.map((i) => i.category));
    return ["All", ...Array.from(list)];
  }, [issues]);

  // Apply filters to issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchCat = categoryFilter === "All" || issue.category === categoryFilter;
      const matchSev = severityFilter === "All" || issue.severity === severityFilter;
      const matchStat = statusFilter === "All" || issue.status === statusFilter;
      return matchCat && matchSev && matchStat;
    });
  }, [issues, categoryFilter, severityFilter, statusFilter]);

  // Calculate clusters based on proximity, zoom level, and pan
  const mapClusters = useMemo(() => {
    const result: Array<{
      id: string;
      isCluster: boolean;
      lat: number;
      lng: number;
      count: number;
      items: Issue[];
      primarySeverity: Severity;
    }> = [];

    // Zoom threshold for clustering
    if (zoom > 1.8) {
      return filteredIssues.map((issue) => ({
        id: issue.id,
        isCluster: false,
        lat: issue.location.lat,
        lng: issue.location.lng,
        count: 1,
        items: [issue],
        primarySeverity: issue.severity
      }));
    }

    const CLUSTER_DISTANCE = 65; // map pixels

    filteredIssues.forEach((issue) => {
      const { x, y } = getXY(issue.location.lat, issue.location.lng);

      // Find an existing cluster close to this issue
      const foundCluster = result.find((c) => {
        const cPos = getXY(c.lat, c.lng);
        const distance = Math.hypot(x - cPos.x, y - cPos.y);
        return distance < CLUSTER_DISTANCE;
      });

      if (foundCluster) {
        const total = foundCluster.count;
        foundCluster.lat = (foundCluster.lat * total + issue.location.lat) / (total + 1);
        foundCluster.lng = (foundCluster.lng * total + issue.location.lng) / (total + 1);
        foundCluster.count += 1;
        foundCluster.items.push(issue);

        const severityRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        const currentRank = severityRank[foundCluster.primarySeverity] || 0;
        const newRank = severityRank[issue.severity] || 0;
        if (newRank > currentRank) {
          foundCluster.primarySeverity = issue.severity;
        }
      } else {
        result.push({
          id: `cluster_${issue.id}`,
          isCluster: true,
          lat: issue.location.lat,
          lng: issue.location.lng,
          count: 1,
          items: [issue],
          primarySeverity: issue.severity
        });
      }
    });

    return result.map((c) => {
      if (c.count === 1) {
        return {
          ...c,
          id: c.items[0].id,
          isCluster: false
        };
      }
      return c;
    });
  }, [filteredIssues, zoom]);

  // Center on a specific coordinate
  const centerOnCoordinate = useCallback((lat: number, lng: number) => {
    if (!svgRef.current) return;
    const { x, y } = getXY(lat, lng);
    const viewWidth = 1000;
    const viewHeight = 800;

    const newZoom = 2.4;
    const newPanX = viewWidth / 2 - x * newZoom;
    const newPanY = viewHeight / 2 - y * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, []);

  // When selectedIssueId changes from parent, auto-pan to center it
  useEffect(() => {
    if (selectedIssueId) {
      const issue = issues.find((i) => i.id === selectedIssueId);
      if (issue && issue.location) {
        centerOnCoordinate(issue.location.lat, issue.location.lng);
      }
    }
  }, [selectedIssueId, issues, centerOnCoordinate]);

  // Handlers for click and drag panning
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).closest(".map-ui-layer")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse coordinates relative to current pan and zoom
    const localX = (mouseX * 1000 / rect.width - pan.x) / zoom;
    const localY = (mouseY * 800 / rect.height - pan.y) / zoom;

    const coords = getLatLngFromXY(localX, localY);
    setHoverCoords(coords);

    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom on wheel event at the cursor position
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomIntensity = 0.12;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mapX = (mouseX - pan.x) / zoom;
    const mapY = (mouseY - pan.y) / zoom;

    const zoomFactor = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
    const newZoom = Math.max(0.6, Math.min(5.0, zoom * zoomFactor));

    const newPanX = mouseX - mapX * newZoom;
    const newPanY = mouseY - mapY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const zoomIn = () => {
    setZoom((prev) => {
      const next = Math.min(5.0, prev + 0.3);
      setPan((p) => ({
        x: p.x - (500 * 0.3),
        y: p.y - (400 * 0.3)
      }));
      return next;
    });
  };

  const zoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(0.6, prev - 0.3);
      setPan((p) => ({
        x: p.x + (500 * 0.3),
        y: p.y + (400 * 0.3)
      }));
      return next;
    });
  };

  const resetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Colors based on severity
  const getSeverityColors = (severity: Severity) => {
    switch (severity) {
      case "Critical":
        return { bg: "bg-red-500", text: "text-red-400", hex: "#ef4444" };
      case "High":
        return { bg: "bg-orange-500", text: "text-orange-400", hex: "#f97316" };
      case "Medium":
        return { bg: "bg-amber-400", text: "text-amber-400", hex: "#fbbf24" };
      case "Low":
      default:
        return { bg: "bg-emerald-500", text: "text-emerald-400", hex: "#10b981" };
    }
  };

  const selectedIssue = useMemo(() => {
    return issues.find((i) => i.id === selectedIssueId) || null;
  }, [issues, selectedIssueId]);

  return (
    <div className="w-full bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col relative" id="gis-portal-container">
      {/* 1. FILTER CONTROLS PANEL */}
      <div className="p-4 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 map-ui-layer relative z-20">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <Compass className="w-5 h-5 text-indigo-400 animate-spin-slow" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-100 tracking-tight font-sans flex items-center gap-1.5">
              <span>GIS Hyperlocal Grid</span>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </h4>
            <p className="text-[10px] text-indigo-400 font-mono tracking-wider">OFFLINE VECTOR TELEMETRY OVERLAY</p>
          </div>
        </div>

        {/* Real-time Filters inside Map Header */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Category Dropdown */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs max-w-[120px] font-medium"
            >
              <option value="All" className="bg-slate-950 text-slate-200">All Categories</option>
              {categories.filter(c => c !== "All").map((cat) => (
                <option key={cat} value={cat} className="bg-slate-950 text-slate-200">{cat}</option>
              ))}
            </select>
          </div>

          {/* Severity Dropdown */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs font-medium"
            >
              <option value="All" className="bg-slate-950 text-slate-200">All Severities</option>
              <option value="Critical" className="bg-slate-950 text-red-400">Critical</option>
              <option value="High" className="bg-slate-950 text-orange-400">High</option>
              <option value="Medium" className="bg-slate-950 text-amber-400">Medium</option>
              <option value="Low" className="bg-slate-950 text-emerald-400">Low</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs font-medium"
            >
              <option value="All" className="bg-slate-950 text-slate-200">All Statuses</option>
              <option value="Reported" className="bg-slate-950 text-slate-400">Reported</option>
              <option value="Assigned" className="bg-slate-950 text-amber-400">Assigned</option>
              <option value="In Progress" className="bg-slate-950 text-indigo-400">In Progress</option>
              <option value="Resolved" className="bg-slate-950 text-emerald-400">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. MAP CANVAS CONTROLLER AREA */}
      <div className="relative w-full h-[450px] md:h-[550px] bg-slate-950 select-none overflow-hidden cursor-grab active:cursor-grabbing">
        {/* SVG Map Canvas */}
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox="0 0 1000 800"
          className="w-full h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* DEFINITIONS, BLUR FILTERS AND CUSTOM RADIAL GRADIENTS */}
          <defs>
            <filter id="gis-heatmap-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
            
            <radialGradient id="ocean-shimmer" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#080c14" />
              <stop offset="100%" stopColor="#020408" />
            </radialGradient>
            
            <radialGradient id="bay-gradient" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#09131e" />
              <stop offset="100%" stopColor="#04080e" />
            </radialGradient>

            <pattern id="gis-grid-mesh" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4f46e5" strokeWidth="0.5" strokeOpacity="0.08" />
            </pattern>

            {/* Shore waves shimmer pattern */}
            <pattern id="shore-waves" width="80" height="12" patternUnits="userSpaceOnUse">
              <path d="M 0,6 Q 20,1 40,6 T 80,6" fill="none" stroke="#1e293b" strokeWidth="0.8" strokeOpacity="0.25" />
            </pattern>
          </defs>

          {/* BACKGROUND SHIMMER OCEAN */}
          <rect width="1000" height="800" fill="url(#ocean-shimmer)" />

          {/* BAY WATER CONTOUR (SOMA & DOWNTOWN shoreline ocean fill) */}
          <rect x="750" y="0" width="250" height="800" fill="url(#bay-gradient)" />
          <path d="M 750,0 Q 820,150 780,350 T 890,650 L 1000,800 L 1000,0 Z" fill="url(#bay-gradient)" opacity="0.85" />

          {/* WAVY WATER PATTERNS */}
          <rect width="1000" height="800" fill="url(#shore-waves)" className="pointer-events-none" />

          {/* TELEMETRY COORDINATE MESH GRID */}
          <rect width="1000" height="800" fill="url(#gis-grid-mesh)" className="pointer-events-none" />

          {/* PAN & ZOOM WRAPPER */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ transition: isDragging ? "none" : "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            
            {/* GEOGRAPHIC LAND peninsula (San Francisco Peninsula) */}
            <path
              d="
                M -100,900
                L 50,750 
                L 32,430 
                L 50,190 
                C 100,160 120,150 140,142
                C 180,120 220,100 266,62
                C 300,45 340,30 374,50
                C 420,70 460,30 500,18
                C 580,2 660,10 734,8
                C 780,15 820,-5 860,13
                C 900,40 920,80 932,110
                C 950,180 930,280 896,366
                C 850,450 820,530 840,620
                L 850,900
                Z
              "
              fill="#090d16"
              stroke="#1e1b4b"
              strokeWidth="2.8"
            />

            {/* DISTRICT LIGHT SHADOWS */}
            <circle cx="820" cy="160" r="160" fill="#4f46e5" fillOpacity="0.04" /> {/* Downtown SOMA */}
            <circle cx="250" cy="450" r="200" fill="#059669" fillOpacity="0.035" /> {/* Golden Gate */}
            <circle cx="600" cy="620" r="170" fill="#d97706" fillOpacity="0.02" /> {/* Mission */}

            {/* WATER BODY: Lake Merced in Southwest */}
            <g opacity="0.85">
              <path
                d="
                  M 120,680
                  C 100,640 160,610 180,630
                  C 210,650 190,710 170,720
                  C 150,730 130,710 120,680
                  Z
                "
                fill="#0e1e2f"
                stroke="#1d4ed8"
                strokeWidth="1.2"
                className="transition duration-300 hover:fill-blue-950"
              />
              <text x="145" y="675" fill="#3b82f6" fontSize="7" fontFamily="monospace" opacity="0.6">LAKE MERCED</text>
            </g>

            {/* PARKS AND NATURE CONSERVANCY OVERLAYS */}
            {showParks && (
              <g>
                {/* Golden Gate Park */}
                <rect
                  x="50"
                  y="382"
                  width="576"
                  height="128"
                  rx="10"
                  fill="#022c22"
                  fillOpacity="0.8"
                  stroke="#047857"
                  strokeWidth="1.2"
                  className="transition duration-300 hover:fill-emerald-950/90"
                />
                
                {/* Presidio Reservation */}
                <path
                  d="
                    M 50,190 
                    L 140,142 
                    C 180,120 220,100 266,62
                    L 320,110
                    C 280,150 250,180 230,220
                    C 180,240 100,240 50,190
                    Z
                  "
                  fill="#022c22"
                  fillOpacity="0.75"
                  stroke="#047857"
                  strokeWidth="1.2"
                />

                {/* Mission Dolores Park */}
                <rect
                  x="540"
                  y="590"
                  width="55"
                  height="45"
                  rx="6"
                  fill="#022c22"
                  fillOpacity="0.8"
                  stroke="#047857"
                  strokeWidth="1"
                />

                {/* Lafayette Park */}
                <circle cx="560" cy="220" r="18" fill="#022c22" fillOpacity="0.8" stroke="#047857" strokeWidth="0.8" />
                
                {/* Buena Vista Park */}
                <circle cx="480" cy="340" r="16" fill="#022c22" fillOpacity="0.8" stroke="#047857" strokeWidth="0.8" />

                {/* Alamo Square */}
                <rect x="520" y="290" width="24" height="20" rx="3" fill="#022c22" fillOpacity="0.8" stroke="#047857" strokeWidth="0.8" />

                {/* Park labels */}
                <g opacity="0.5" fill="#10b981" className="pointer-events-none" fontSize="8" fontFamily="monospace" fontWeight="bold">
                  <text x="270" y="450">GOLDEN GATE PARK</text>
                  <text x="130" y="165">PRESIDIO WILDLIFE AREA</text>
                  <text x="541" y="615" fontSize="6">DOLORES</text>
                  <text x="548" y="223" fontSize="5">LAFAYETTE</text>
                  <text x="522" y="302" fontSize="5">ALAMO</text>
                </g>
              </g>
            )}

            {/* ROADS AND INFRASTRUCTURE NETWORK */}
            {showRoads && (
              <g className="pointer-events-none" opacity="0.85">
                {/* Hwy 101 Freeway */}
                <path
                  d="M 554,750 L 554,400 Q 554,200 480,140 L 480,50"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="4"
                  strokeOpacity="0.45"
                  strokeLinecap="round"
                />
                <path
                  d="M 554,750 L 554,400 Q 554,200 480,140 L 480,50"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeOpacity="0.7"
                  strokeDasharray="4,4"
                  strokeLinecap="round"
                />

                {/* I-80 Freeway & Bay Bridge hookup */}
                <path
                  d="M 680,750 Q 720,600 780,480 Q 840,430 950,400"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="4.5"
                  strokeOpacity="0.45"
                />
                <path
                  d="M 680,750 Q 720,600 780,480 Q 840,430 950,400"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeOpacity="0.8"
                  strokeDasharray="6,4"
                />

                {/* Market Street Diag Transit Line */}
                <path
                  d="M 280,680 L 914,130"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeOpacity="0.3"
                />
                <path
                  d="M 280,680 L 914,130"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.2"
                  strokeDasharray="8,4"
                  strokeOpacity="0.6"
                />

                {/* Geary Blvd */}
                <line x1="50" y1="210" x2="840" y2="210" stroke="#334155" strokeWidth="2.8" strokeOpacity="0.45" strokeLinecap="round" />
                <line x1="50" y1="210" x2="840" y2="210" stroke="#475569" strokeWidth="1" strokeOpacity="0.7" strokeDasharray="3,3" />
                
                {/* Van Ness Avenue */}
                <line x1="620" y1="50" x2="620" y2="750" stroke="#334155" strokeWidth="2.8" strokeOpacity="0.4" strokeLinecap="round" />

                {/* Haight Street */}
                <line x1="50" y1="446" x2="554" y2="446" stroke="#334155" strokeWidth="2.2" strokeOpacity="0.35" strokeLinecap="round" />

                {/* Broadway Tunnel road */}
                <line x1="480" y1="120" x2="880" y2="120" stroke="#334155" strokeWidth="1.8" strokeOpacity="0.3" strokeLinecap="round" />

                {/* Embarcadero Coastline Boulevard */}
                <path
                  d="M 860,13 Q 950,110 896,366"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="3.5"
                  strokeOpacity="0.4"
                  strokeLinecap="round"
                />

                {/* Secondary Grid Lines representing cross streets */}
                <line x1="300" y1="280" x2="900" y2="280" stroke="#1e293b" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1="300" y1="340" x2="900" y2="340" stroke="#1e293b" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1="450" y1="520" x2="950" y2="520" stroke="#1e293b" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1="450" y1="600" x2="950" y2="600" stroke="#1e293b" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1="450" y1="680" x2="950" y2="680" stroke="#1e293b" strokeWidth="0.8" strokeOpacity="0.3" />

                <line x1="400" y1="100" x2="400" y2="400" stroke="#1e293b" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1="480" y1="100" x2="480" y2="400" stroke="#1e293b" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1="680" y1="150" x2="680" y2="750" stroke="#1e293b" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1="750" y1="150" x2="750" y2="750" stroke="#1e293b" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1="820" y1="200" x2="820" y2="750" stroke="#1e293b" strokeWidth="0.8" strokeOpacity="0.3" />

                {/* Major Transit Labels */}
                <g fill="#94a3b8" fontSize="7" fontFamily="monospace" fontWeight="bold" opacity="0.7">
                  <text x="800" y="128" transform="rotate(-41, 800, 128)">MARKET ST</text>
                  <text x="120" y="204">GEARY BLVD</text>
                  <text x="632" y="320" transform="rotate(90, 632, 320)">VAN NESS AVE</text>
                  <text x="120" y="440">HAIGHT ST</text>
                  <text x="562" y="690" transform="rotate(90, 562, 690)">HWY 101</text>
                  <text x="735" y="650" transform="rotate(-60, 735, 650)">I-80</text>
                </g>
              </g>
            )}

            {/* NEIGHBORHOOD SECTOR TITLES */}
            <g fill="#475569" fontSize="9" fontFamily="monospace" fontWeight="800" opacity="0.65" className="pointer-events-none tracking-widest">
              <text x="130" y="300">RICHMOND</text>
              <text x="140" y="580">SUNSET DISTRICT</text>
              <text x="390" y="480">HAIGHT-ASHBURY</text>
              <text x="430" y="100">MARINA</text>
              <text x="440" y="260">PACIFIC HEIGHTS</text>
              <text x="800" y="180">DOWNTOWN</text>
              <text x="760" y="320">SOMA GRID</text>
              <text x="640" y="640">MISSION DISTRICT</text>
            </g>

            {/* LANDMARKS AND VECTOR MONUMENTS ICON OVERLAYS */}
            {showLandmarks && (
              <g className="pointer-events-none">
                {/* 1. GOLDEN GATE BRIDGE TOWER (Northwest, close to mouth of Bay) */}
                <g transform={`translate(${getXY(37.808, -122.445).x}, ${getXY(37.808, -122.445).y})`} opacity="0.9">
                  {/* Bridge cable curves */}
                  <path d="M -50,-10 Q 0,-35 50,-10" fill="none" stroke="#ea580c" strokeWidth="1.2" />
                  <line x1="0" y1="-35" x2="0" y2="10" stroke="#ea580c" strokeWidth="2.5" />
                  {/* Cross struts */}
                  <line x1="-5" y1="-25" x2="5" y2="-25" stroke="#ea580c" strokeWidth="1" />
                  <line x1="-5" y1="-15" x2="5" y2="-15" stroke="#ea580c" strokeWidth="1" />
                  <line x1="-5" y1="-5" x2="5" y2="-5" stroke="#ea580c" strokeWidth="1" />
                  {/* Base pillar */}
                  <rect x="-8" y="10" width="16" height="5" fill="#ea580c" />
                  {/* Text Label */}
                  <text x="12" y="-20" fill="#f97316" fontSize="7.5" fontWeight="bold" fontFamily="monospace">GG BRIDGE</text>
                </g>

                {/* 2. TRANSAMERICA PYRAMID (Downtown core) */}
                <g transform={`translate(${getXY(37.795, -122.402).x}, ${getXY(37.795, -122.402).y})`} opacity="0.9">
                  {/* Sharp elegant pyramid shape */}
                  <polygon points="0,-45 -12,15 12,15" fill="#1e293b" stroke="#e2e8f0" strokeWidth="1.2" />
                  {/* Wing accents */}
                  <line x1="-12" y1="5" x2="-20" y2="12" stroke="#e2e8f0" strokeWidth="1" />
                  <line x1="12" y1="5" x2="20" y2="12" stroke="#e2e8f0" strokeWidth="1" />
                  <line x1="0" y1="-45" x2="0" y2="15" stroke="#e2e8f0" strokeWidth="0.5" strokeOpacity="0.4" />
                  {/* Beacon point glow */}
                  <circle cx="0" cy="-45" r="2" fill="#fbbf24" />
                  <text x="16" y="5" fill="#94a3b8" fontSize="7.5" fontWeight="bold" fontFamily="monospace">TRANSAMERICA</text>
                </g>

                {/* 3. SALESFORCE TOWER (SOMA) */}
                <g transform={`translate(${getXY(37.789, -122.401).x}, ${getXY(37.789, -122.401).y})`} opacity="0.9">
                  {/* Tall monolith curved skyscraper */}
                  <path d="M -8,25 L -8,-25 Q -8,-35 0,-35 Q 8,-35 8,-25 L 8,25 Z" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                  {/* Horizontal grid bands */}
                  <line x1="-7" y1="-15" x2="7" y2="-15" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.5" />
                  <line x1="-8" y1="-5" x2="8" y2="-5" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.5" />
                  <line x1="-8" y1="5" x2="8" y2="5" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.5" />
                  <line x1="-8" y1="15" x2="8" y2="15" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.5" />
                  {/* Top LED crown glow */}
                  <path d="M -5,-32 Q 0,-36 5,-32" fill="none" stroke="#6366f1" strokeWidth="2.5" />
                  <text x="12" y="-12" fill="#38bdf8" fontSize="7.5" fontWeight="bold" fontFamily="monospace">SALESFORCE</text>
                </g>

                {/* 4. COIT TOWER (Telegraph Hill) */}
                <g transform={`translate(${getXY(37.802, -122.406).x}, ${getXY(37.802, -122.406).y})`} opacity="0.9">
                  {/* Firehose shaped fluted tower */}
                  <rect x="-4" y="-20" width="8" height="35" rx="1.5" fill="#334155" stroke="#94a3b8" strokeWidth="1" />
                  {/* Fluted top crown */}
                  <rect x="-6" y="-24" width="12" height="5" rx="1" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
                  {/* Dome point */}
                  <path d="M -3,-24 L 0,-29 L 3,-24 Z" fill="#94a3b8" />
                  <text x="10" y="-10" fill="#94a3b8" fontSize="7.5" fontWeight="bold" fontFamily="monospace">COIT TOWER</text>
                </g>

                {/* 5. CIVIC CENTER DOME / CITY HALL */}
                <g transform={`translate(${getXY(37.779, -122.417).x}, ${getXY(37.779, -122.417).y})`} opacity="0.9">
                  {/* Grand dome layout */}
                  <rect x="-18" y="5" width="36" height="10" fill="#1e293b" stroke="#f59e0b" strokeWidth="0.8" />
                  <path d="M -10,5 L -10,-4 Q -10,-14 0,-14 Q 10,-14 10,-4 L 10,5 Z" fill="#1e293b" stroke="#f59e0b" strokeWidth="1" />
                  {/* Gold dome spire */}
                  <line x1="0" y1="-14" x2="0" y2="-21" stroke="#f59e0b" strokeWidth="1.5" />
                  <circle cx="0" cy="-21" r="1.5" fill="#f59e0b" />
                  <text x="20" y="5" fill="#f59e0b" fontSize="7.5" fontWeight="bold" fontFamily="monospace">CITY HALL</text>
                </g>
              </g>
            )}

            {/* HIGH-FIDELITY HEATMAP DENSITY LAYER (USING SVG GAUSSIAN BLURS) */}
            {(layerMode === "heatmap" || layerMode === "both") && (
              <g filter="url(#gis-heatmap-blur)" opacity="0.75" className="pointer-events-none mix-blend-screen">
                {filteredIssues.map((issue) => {
                  const { x, y } = getXY(issue.location.lat, issue.location.lng);
                  const colors = getSeverityColors(issue.severity);
                  // Scale heatmap circles based on votes and gravity
                  const radius = Math.min(80, 35 + (issue.votes || 0) * 2.2);
                  return (
                    <circle
                      key={`heat-${issue.id}`}
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={colors.hex}
                      fillOpacity="0.45"
                    />
                  );
                })}
              </g>
            )}

            {/* ACTIVE INTERACTIVE COMPLAINT MARKERS & MARKER CLUSTERS */}
            {(layerMode === "markers" || layerMode === "both") && (
              <g>
                {mapClusters.map((node) => {
                  const { x, y } = getXY(node.lat, node.lng);

                  if (node.isCluster) {
                    // CLUSTER REPRESENTATION (Multiple coordinates grouped)
                    const isSelected = node.items.some(i => i.id === selectedIssueId);
                    const color = getSeverityColors(node.primarySeverity).hex;
                    const size = Math.min(50, 26 + Math.log10(node.count) * 11);

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${x}, ${y})`}
                        className="cursor-pointer"
                        onClick={() => {
                          // Dynamic zoom-in and center pan
                          const newZoomLevel = Math.min(4.5, zoom + 0.9);
                          setZoom(newZoomLevel);
                          setPan({
                            x: 500 - x * newZoomLevel,
                            y: 400 - y * newZoomLevel
                          });
                        }}
                      >
                        {/* Glow halo animation */}
                        <circle
                          r={size + 11}
                          fill="none"
                          stroke={color}
                          strokeWidth="1.8"
                          strokeOpacity="0.4"
                        >
                          <animate attributeName="r" values={`${size};${size + 14}`} dur="2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.45;0" dur="2s" repeatCount="indefinite" />
                        </circle>

                        {/* Solid background cluster */}
                        <circle
                          r={size}
                          fill="#0b0f19"
                          stroke={color}
                          strokeWidth={isSelected ? "3" : "1.8"}
                          className="transition duration-300 hover:scale-110"
                        />
                        <circle
                          r={size - 4}
                          fill={color}
                          fillOpacity="0.22"
                        />

                        {/* Numeric Badge counter */}
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="extrabold"
                          fontFamily="monospace"
                        >
                          {node.count}
                        </text>
                      </g>
                    );
                  } else {
                    // SINGLE ISSUE MARKER
                    const issue = node.items[0];
                    const isSelected = selectedIssueId === issue.id;
                    const colors = getSeverityColors(issue.severity);

                    // Newly reported issues pulse heavily
                    const isNew = issue.id.startsWith("new_") || issue.votes <= 1;

                    return (
                      <g
                        key={issue.id}
                        transform={`translate(${x}, ${y})`}
                        className="cursor-pointer group"
                        onClick={() => onSelectIssue(issue.id)}
                      >
                        {/* 1. Pulsing ring for newly reported/unvoted issues */}
                        {isNew && (
                          <circle r="20" fill="none" stroke={colors.hex} strokeWidth="1.8" opacity="0.8">
                            <animate attributeName="r" values="7;24" dur="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.9;0" dur="1.5s" repeatCount="indefinite" />
                          </circle>
                        )}

                        {/* 2. High-Tech Focus rings if selected */}
                        {isSelected && (
                          <g>
                            <circle r="28" fill="none" stroke="#6366f1" strokeWidth="1.2" strokeDasharray="4,4">
                              <animateTransform
                                attributeName="transform"
                                type="rotate"
                                from="0"
                                to="360"
                                dur="10s"
                                repeatCount="indefinite"
                              />
                            </circle>
                            <circle r="22" fill="none" stroke="#6366f1" strokeWidth="2.5" opacity="0.45" />
                          </g>
                        )}

                        {/* 3. Upgraded Custom SVG vector Pointer Pin */}
                        <g transform="translate(0, -6)" className="transition duration-300 group-hover:-translate-y-2.5">
                          {/* Pin Shadow drop */}
                          <ellipse cx="0" cy="5" rx="5" ry="1.8" fill="#000000" fillOpacity="0.5" />
                          
                          {/* The sleek Pin body */}
                          <path
                            d="M 0,0 C -7.5,-7.5 -11.5,-13.5 -11.5,-19.5 C -11.5,-26.5 -6,-31.5 0,-31.5 C 6,-31.5 11.5,-26.5 11.5,-19.5 C 11.5,-13.5 7.5,-7.5 0,0 Z"
                            fill={issue.status === "Resolved" ? "#10b981" : colors.hex}
                            stroke="#0b0f19"
                            strokeWidth="2"
                          />
                          {/* Core indicator dot */}
                          <circle
                            cx="0"
                            cy="-19.5"
                            r="4.2"
                            fill={isSelected ? "#000000" : "#ffffff"}
                          />
                        </g>

                        {/* Hover text label */}
                        <g className="opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none" transform="translate(0, -44)">
                          <rect
                            x="-65"
                            width="130"
                            height="18"
                            rx="5"
                            fill="#090d16"
                            stroke="#334155"
                            strokeWidth="1"
                          />
                          <text
                            x="0"
                            y="11"
                            textAnchor="middle"
                            fill="#f1f5f9"
                            fontSize="8.5"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {issue.subcategory.length > 18 ? `${issue.subcategory.substring(0, 16)}...` : issue.subcategory}
                          </text>
                        </g>
                      </g>
                    );
                  }
                })}
              </g>
            )}
          </g>
        </svg>

        {/* 3. FLOATING HUD TOOLS */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2.5 map-ui-layer">
          {/* Zoom widget */}
          <div className="bg-slate-950/85 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800/80 flex flex-col gap-1 shadow-2xl">
            <button
              onClick={zoomIn}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
              title="Zoom In"
            >
              <Plus className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={zoomOut}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
              title="Zoom Out"
            >
              <Minus className="w-4.5 h-4.5" />
            </button>
            <div className="h-px bg-slate-800/80 my-0.5" />
            <button
              onClick={resetView}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
              title="Reset View"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Layer toggle widget */}
          <div className="bg-slate-950/85 backdrop-blur-md p-1 rounded-2xl border border-slate-800/80 flex gap-0.5 shadow-2xl text-[10px] font-bold">
            <button
              onClick={() => setLayerMode("markers")}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
                layerMode === "markers" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Pins
            </button>
            <button
              onClick={() => setLayerMode("heatmap")}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
                layerMode === "heatmap" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Heatmap
            </button>
            <button
              onClick={() => setLayerMode("both")}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
                layerMode === "both" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Dual View
            </button>
          </div>
        </div>

        {/* Dynamic Layers selector */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2.5 map-ui-layer">
          {/* Coordinates tracker */}
          <AnimatePresence>
            {hoverCoords && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-indigo-950 text-[10px] font-mono text-slate-400 flex items-center gap-2 shadow-xl"
              >
                <Locate className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>
                  {hoverCoords.lat.toFixed(5)}° N, {Math.abs(hoverCoords.lng).toFixed(5)}° W
                </span>
                <span className="text-[8px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded font-bold">SF GRID</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-slate-950/85 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-800/80 flex gap-4.5 shadow-2xl">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showRoads}
                onChange={() => setShowRoads(!showRoads)}
                className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
              />
              Roads Grid
            </label>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showParks}
                onChange={() => setShowParks(!showParks)}
                className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
              />
              Green Parks
            </label>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showLandmarks}
                onChange={() => setShowLandmarks(!showLandmarks)}
                className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
              />
              Landmarks
            </label>
          </div>
        </div>

        {/* 4. FLOATING POPUP SELECTED ISSUE PANELS */}
        <AnimatePresence>
          {selectedIssue && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              className="absolute right-4 top-4 bottom-20 w-[315px] bg-slate-900/95 backdrop-blur-lg border border-slate-800/90 rounded-3xl p-4.5 shadow-2xl flex flex-col justify-between overflow-y-auto z-10 map-ui-layer"
            >
              <div>
                <div className="flex justify-between items-start border-b border-slate-800/85 pb-3">
                  <div className="pr-4">
                    <span className="text-[9px] font-extrabold tracking-wider text-indigo-400 bg-indigo-950/80 border border-indigo-900/60 px-2.5 py-0.5 rounded-full uppercase font-mono">
                      {selectedIssue.category}
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-100 mt-2 leading-tight">{selectedIssue.subcategory}</h3>
                  </div>
                  <button
                    onClick={() => onSelectIssue("")}
                    className="text-slate-400 hover:text-white hover:bg-slate-800/60 p-1.5 rounded-lg text-sm cursor-pointer transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3 relative h-28 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/60">
                  <img
                    src={selectedIssue.imageUrl}
                    alt={selectedIssue.subcategory}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2 right-2 bg-slate-900/90 backdrop-blur-sm border border-slate-700/60 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold text-slate-300 shadow-lg">
                    Confidence: {Math.round(selectedIssue.confidence * 100)}%
                  </div>
                </div>

                <div className="mt-4.5 space-y-3">
                  <div>
                    <span className="text-[9px] font-extrabold text-slate-400 font-mono tracking-wider">GEO-LOCATION</span>
                    <p className="text-xs text-slate-200 mt-0.5 leading-snug">{selectedIssue.location.address}</p>
                  </div>
                  
                  <div className="flex justify-between gap-4">
                    <div>
                      <span className="text-[9px] font-extrabold text-slate-400 font-mono tracking-wider">CIVIC STATUS</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            selectedIssue.status === "Resolved"
                              ? "bg-emerald-500"
                              : selectedIssue.status === "In Progress"
                              ? "bg-indigo-500 animate-pulse"
                              : selectedIssue.status === "Assigned"
                              ? "bg-amber-500"
                              : "bg-slate-500"
                          }`}
                        ></span>
                        <span className="text-xs font-bold text-slate-200">{selectedIssue.status}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-extrabold text-slate-400 font-mono tracking-wider">SEVERITY</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          selectedIssue.severity === "Critical" ? "bg-red-950/60 text-red-400 border border-red-900/40" :
                          selectedIssue.severity === "High" ? "bg-orange-950/60 text-orange-400 border border-orange-900/40" :
                          selectedIssue.severity === "Medium" ? "bg-amber-950/60 text-amber-300 border border-amber-900/40" :
                          "bg-emerald-950/60 text-emerald-400 border border-emerald-900/40"
                        }`}>
                          {selectedIssue.severity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedIssue.assignedWorker && (
                    <div>
                      <span className="text-[9px] font-extrabold text-slate-400 font-mono tracking-wider">DISPATCHER RESPONDING</span>
                      <p className="text-xs text-amber-300 font-medium mt-0.5">{selectedIssue.assignedWorker}</p>
                    </div>
                  )}

                  <div>
                    <span className="text-[9px] font-extrabold text-slate-400 font-mono tracking-wider">RESPONSIBLE DEPT</span>
                    <p className="text-xs text-indigo-300 font-semibold mt-0.5">{selectedIssue.department}</p>
                  </div>

                  <div>
                    <span className="text-[9px] font-extrabold text-slate-400 font-mono tracking-wider">IMPACT BRIEF</span>
                    <p className="text-xs text-slate-300 leading-relaxed mt-0.5 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                      {selectedIssue.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 mt-4 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  Votes: <strong className="text-slate-100">{selectedIssue.votes}</strong>
                </span>
                <span className="font-mono text-[9px] flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(selectedIssue.createdAt).toLocaleDateString()}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5. DYNAMIC MAP LEGEND & STATS PANEL */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Color Legend */}
        <div className="flex flex-wrap items-center gap-4.5 text-[10.5px] font-mono text-slate-400">
          <button
            onClick={() => setSeverityFilter(severityFilter === "Critical" ? "All" : "Critical")}
            className={`flex items-center gap-1.5 hover:text-slate-200 transition cursor-pointer px-2 py-1 rounded-md ${severityFilter === "Critical" ? "bg-red-950/40 text-red-400 border border-red-900/30" : "border border-transparent"}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50 inline-block"></span> Critical
          </button>
          <button
            onClick={() => setSeverityFilter(severityFilter === "High" ? "All" : "High")}
            className={`flex items-center gap-1.5 hover:text-slate-200 transition cursor-pointer px-2 py-1 rounded-md ${severityFilter === "High" ? "bg-orange-950/40 text-orange-400 border border-orange-900/30" : "border border-transparent"}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-lg shadow-orange-500/50 inline-block"></span> High
          </button>
          <button
            onClick={() => setSeverityFilter(severityFilter === "Medium" ? "All" : "Medium")}
            className={`flex items-center gap-1.5 hover:text-slate-200 transition cursor-pointer px-2 py-1 rounded-md ${severityFilter === "Medium" ? "bg-amber-950/40 text-amber-300 border border-amber-900/30" : "border border-transparent"}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50 inline-block"></span> Medium
          </button>
          <button
            onClick={() => setSeverityFilter(severityFilter === "Low" ? "All" : "Low")}
            className={`flex items-center gap-1.5 hover:text-slate-200 transition cursor-pointer px-2 py-1 rounded-md ${severityFilter === "Low" ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30" : "border border-transparent"}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 inline-block"></span> Low
          </button>
          <span className="flex items-center gap-1.5 text-slate-500 px-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block border border-emerald-600/50"></span> Resolved
          </span>
        </div>

        {/* Metric brief info */}
        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>Showing {filteredIssues.length} of {issues.length} incidents. Hover grid to track telemetry coordinates.</span>
        </div>
      </div>
    </div>
  );
}

