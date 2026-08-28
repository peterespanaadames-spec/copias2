import React from 'react';

export function AdminIsotype({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="brandGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#40E0D0" />
          <stop offset="100%" stopColor="#00BFFF" />
        </linearGradient>
        <linearGradient id="brandGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1D3557" />
          <stop offset="100%" stopColor="#00BFFF" />
        </linearGradient>
      </defs>      
      {/* Navy rounded container */}
      <rect x="2" y="2" width="96" height="96" rx="22" fill="#1D3557" />
      
      {/* F Stem and horizontal bars */}
      <path
        d="M 30 78 C 30 78, 30 24, 30 22 C 30 18, 34 16, 40 16 L 68 16 C 73 16, 76 19, 76 22 C 76 25, 73 28, 68 28 L 42 28 L 42 42 L 62 42 C 66 42, 69 45, 69 48 C 69 51, 66 54, 62 54 L 42 54 L 42 78 C 42 81, 39 83, 36 83 C 33 83, 30 81, 30 78 Z"
        fill="url(#brandGrad1)"
      />

      {/* Ascending Arrow at top right of F */}
      <path
        d="M 64 26 L 82 8 M 82 8 L 70 8 M 82 8 L 82 20"
        stroke="#40E0D0"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Intertwined curved accent line ending in ascending flow */}
      <path
        d="M 22 62 C 22 42, 36 32, 62 32"
        stroke="#00BFFF"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

export function AdminBrandHeader({ showTagline = true, compact = false }: { showTagline?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <AdminIsotype className={compact ? "w-8 h-8 shrink-0 shadow-sm" : "w-10 h-10 shrink-0 shadow-md"} />
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-montserrat font-extrabold text-base md:text-lg text-[#1D3557] tracking-tight leading-none">
            Panel <span className="text-[#00BFFF]">Administrativo</span>
          </span>
          <span className="bg-[#40E0D0]/20 text-[#1D3557] border border-[#40E0D0]/60 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider font-montserrat">
            PRO
          </span>
        </div>
        {showTagline && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 text-[11px] font-poppins text-[#2B2D42]/85 mt-0.5">
            <span className="font-bold text-[#1D3557]">Tu negocio en un solo lugar.</span>
            <span className="hidden sm:inline text-gray-300">•</span>
            <span className="text-[#00BFFF] font-semibold">Control total, decisiones inteligentes.</span>
          </div>
        )}
      </div>
    </div>
  );
}
