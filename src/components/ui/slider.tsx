"use client";

import React, { useRef, useState, useEffect } from "react";

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string; // Wrapper className
  riskStatus: {
    color: string;
    bgColor: string;
    progressColor: string;
  };
}

export const Slider = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  className,
  riskStatus,
}: SliderProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateValue = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const rawValue = min + percentage * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    return Math.max(min, Math.min(max, steppedValue));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    containerRef.current?.setPointerCapture(e.pointerId);
    const newValue = calculateValue(e.clientX);
    if (newValue !== undefined) onChange(newValue);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newValue = calculateValue(e.clientX);
    if (newValue !== undefined) onChange(newValue);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <span
      dir="ltr"
      data-orientation="horizontal"
      aria-disabled="false"
      className={`relative  flex h-5 w-full touch-none select-none items-center transition-none cursor-pointer ${className}`}
      style={{ filter: "drop-shadow(0px 0px 4px rgba(0, 0, 0, 0.5))" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={containerRef}
    >
      <span
        data-orientation="horizontal"
        className="relative h-1.5 bg-neutral-800 grow rounded-full overflow-hidden"
      >
        <span
          data-orientation="horizontal"
          className={`absolute h-full rounded-full ${riskStatus.progressColor}`}
          style={{ width: `${percentage}%` }}
        ></span>
      </span>
      <span
        style={{
          transform: `translateX(-50%)`,
          position: "absolute",
          left: `${percentage}%`,
        }}
      >
        <span
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          tabIndex={0}
          className={`flex size-5 items-center justify-center rounded-full focus:outline-none ${riskStatus.progressColor}`}
        >
          <div className="size-1.5 rounded-full bg-[#0C141D]"></div>
        </span>
      </span>
    </span>
  );
};
