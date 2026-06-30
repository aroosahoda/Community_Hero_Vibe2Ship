import React from "react";
import * as LucideIcons from "lucide-react";
import { motion } from "motion/react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext: string;
  iconName: keyof typeof LucideIcons;
  colorClass: string; // e.g. 'text-indigo-600 bg-indigo-50 border-indigo-100'
}

export default function MetricCard({ title, value, subtext, iconName, colorClass }: MetricCardProps) {
  // Dynamically resolve icon from lucide-react
  const IconComponent = (LucideIcons[iconName] as any) || LucideIcons.HelpCircle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3 }}
      className="p-5 bg-white rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between"
      id={`metric-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div>
        <span className="text-xs font-semibold tracking-wider uppercase text-gray-400">{title}</span>
        <h3 className="text-3xl font-bold font-sans text-gray-800 mt-1">{value}</h3>
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 font-mono">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {subtext}
        </p>
      </div>
      <div className={`p-3 rounded-xl ${colorClass} border`}>
        <IconComponent className="w-6 h-6" />
      </div>
    </motion.div>
  );
}
