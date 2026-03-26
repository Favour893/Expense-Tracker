import React from "react";

export function CashLogo({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Expense Tracker logo"
      role="img"
    >
      <defs>
        <linearGradient id="cashGradA" x1="6" y1="10" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id="cashGradB" x1="14" y1="18" x2="52" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
      </defs>

      {/* Back note */}
      <rect x="8" y="16" width="42" height="30" rx="8" fill="url(#cashGradA)" opacity="0.22" />

      {/* Front note */}
      <rect x="14" y="12" width="42" height="30" rx="8" fill="url(#cashGradA)" />
      <rect x="16.5" y="14.5" width="37" height="25" rx="6" stroke="white" strokeOpacity="0.55" />

      {/* Center coin */}
      <circle cx="35" cy="27" r="7.5" fill="url(#cashGradB)" />
      <path
        d="M35 21.8V32.2M31.8 24.7C31.8 23.7 32.7 22.9 33.9 22.9H36.1C37.3 22.9 38.2 23.7 38.2 24.7C38.2 25.7 37.3 26.5 36.1 26.5H33.9C32.7 26.5 31.8 27.3 31.8 28.3C31.8 29.3 32.7 30.1 33.9 30.1H36.1C37.3 30.1 38.2 29.3 38.2 28.3"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Spark accents */}
      <path d="M50 9.5L51.4 12.2L54.1 13.6L51.4 15L50 17.7L48.6 15L45.9 13.6L48.6 12.2L50 9.5Z" fill="#FDE68A" />
      <circle cx="11" cy="50" r="2.2" fill="#A7F3D0" />
    </svg>
  );
}

