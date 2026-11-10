"use client";

import React from "react";

export interface StraightMoneyLogoProps {
  size?: number;
  className?: string;
  variant?: "badge" | "glyph";
  idPrefix?: string;
}

/**
 * StraightMoney Brand Logo & App Icon
 *
 * Embodies the StraightMoney mission: transparent, direct community fundraising
 * where funds flow straight to verified vendors through PayPal payment rails.
 *
 * Visual Motifs:
 * - Upper Stream: Donor giving flow in deep PayPal Navy (#001C64 - #0052B4)
 * - Lower Stream: Direct vendor payout flow in vibrant PayPal Cyan (#0070BA - #00D2FF)
 * - Interlocking Convergence: Cryptographic AI & PayPal verification blend (#00457C)
 * - Straight Horizontal Vector: Uncompromised direct payout path in PayPal Gold (#FFC439)
 * - Golden Node: Spark of completed and confirmed payout
 */
export default function StraightMoneyLogo({
  size = 32,
  className = "",
  variant = "badge",
  idPrefix = "sm-logo",
}: StraightMoneyLogoProps) {
  const isBadge = variant === "badge";
  const bgId = `${idPrefix}-bg`;
  const navyId = `${idPrefix}-navy`;
  const cyanId = `${idPrefix}-cyan`;
  const goldId = `${idPrefix}-gold`;
  const glowId = `${idPrefix}-glow`;

  return (
    <svg
      suppressHydrationWarning
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Background Tile Gradient */}
        <linearGradient id={bgId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#001C64" />
          <stop offset="45%" stopColor="#001435" />
          <stop offset="100%" stopColor="#000A1C" />
        </linearGradient>

        {/* Upper Stream Gradient: Donor Giving Path */}
        <linearGradient id={navyId} x1="8" y1="7" x2="24" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0052B4" />
          <stop offset="100%" stopColor="#001C64" />
        </linearGradient>

        {/* Lower Stream Gradient: Direct Vendor Payout Path */}
        <linearGradient id={cyanId} x1="10" y1="15" x2="26" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00D2FF" />
          <stop offset="100%" stopColor="#0070BA" />
        </linearGradient>

        {/* Straight Vector Beam (PayPal Gold Gradient) */}
        <linearGradient id={goldId} x1="6" y1="16" x2="25" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="60%" stopColor="#FFC439" />
          <stop offset="100%" stopColor="#FF9E1B" />
        </linearGradient>

        {/* Subtle Ambient Glow */}
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.8" floodColor="#0070BA" floodOpacity="0.38" />
        </filter>
      </defs>

      {isBadge && (
        <>
          <rect width="32" height="32" rx="8" fill={`url(#${bgId})`} />
          <rect
            x="0.5"
            y="0.5"
            width="31"
            height="31"
            rx="7.5"
            stroke="white"
            strokeOpacity="0.14"
            strokeWidth="0.75"
          />
        </>
      )}

      {/* Brand Glyph (centered at 16, 16 with -7.5 deg forward momentum) */}
      <g transform="translate(16, 16) skewX(-7.5) translate(-13.6, -16)" filter={`url(#${glowId})`}>
        {/* Upper Stream (Navy Blue) */}
        <path
          d="M19.5 7.5H10.5C7.5 7.5 5 9.8 5 12.8C5 15.6 7.2 17.5 10.2 17.5H17"
          stroke={`url(#${navyId})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Lower Stream (Electric Cyan) */}
        <path
          d="M6.5 24.5H15.5C18.5 24.5 21 22.2 21 19.2C21 16.4 18.8 14.5 15.8 14.5H9"
          stroke={`url(#${cyanId})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Overlap Blend (PayPal Multi-tone Translucency) */}
        <path
          d="M10.2 17.5H15.8"
          stroke="#00457C"
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity="0.95"
        />

        {/* The Straight Vector: Direct Horizontal Payout Arrow */}
        <path
          d="M3.5 16H22M22 16L17.5 11.5M22 16L17.5 20.5"
          stroke={`url(#${goldId})`}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Golden Verified Payout Node (Spark of Trust) */}
        <circle cx="22" cy="16" r="1.8" fill="#FFFFFF" />
        <circle cx="22" cy="16" r="1.0" fill={`url(#${goldId})`} />
      </g>
    </svg>
  );
}
