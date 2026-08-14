import React from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function AuthenticationLoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans select-none">
      <div className="flex flex-col items-center max-w-sm text-center space-y-6 animate-in fade-in duration-300">
        {/* Animated Brand Emblem */}
        <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-2xl shadow-emerald-950/60 ring-1 ring-emerald-400/30">
          <ShieldCheck className="w-10 h-10 text-white animate-pulse" />
          <div className="absolute -inset-1 rounded-2xl border border-emerald-500/20 animate-ping" />
        </div>

        {/* Product Identity */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-[11px] font-semibold text-emerald-400 uppercase tracking-widest">
            Tamil Nadu STAR 2.0 Ready
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">DeedOS 360</h1>
          <p className="text-xs text-slate-400 font-medium">Verifying Supabase cryptographic session token...</p>
        </div>

        {/* Loading Spinner Indicator */}
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/90 border border-slate-800 rounded-full shadow-inner">
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
          <span className="text-xs text-slate-300 font-medium">Initializing Security Context</span>
        </div>
      </div>
    </div>
  );
}
