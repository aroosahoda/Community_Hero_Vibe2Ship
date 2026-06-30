import React, { useEffect, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number; // duration in milliseconds
  className?: string;
  suffix?: string;
}

export default function AnimatedCounter({
  value,
  duration = 800,
  className = "",
  suffix = ""
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const startValue = count;
    const diff = value - startValue;

    if (diff === 0) return;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);

      // Ease-out-quad function for a organic speed reduction
      const easePercentage = percentage * (2 - percentage);
      const nextCount = Math.round(startValue + diff * easePercentage);

      setCount(nextCount);

      if (progress < duration) {
        window.requestAnimationFrame(step);
      } else {
        setCount(value);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration]);

  return (
    <span className={className}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}
