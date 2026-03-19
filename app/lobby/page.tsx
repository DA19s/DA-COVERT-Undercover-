"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authContext";

export default function LobbyPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col">

      {/* Blobs déco */}
      <div className="hidden sm:block absolute top-[-60px] left-[-60px] w-64 h-64 bg-pink-400 rounded-full opacity-25 blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute bottom-[-40px] right-[-40px] w-56 h-56 bg-yellow-300 rounded-full opacity-20 blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col max-w-md w-full mx-auto px-4 py-6 sm:py-10 gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-xl font-black text-white shadow">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white/60 text-xs font-medium">Bon retour,</p>
              <p className="text-white font-black text-sm">{user?.username}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="px-3 h-10 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-xs font-black transition-all"
            title="Se deconnecter"
          >
            Logout
          </button>
        </div>

        {/* Hero */}
        <div className="text-center py-4">
          <div
            className="text-7xl sm:text-8xl mb-3 inline-block animate-bounce"
            style={{ animationDuration: "2.5s" }}
          >
            🎭
          </div>
          <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight leading-none drop-shadow-lg">
            DA-<span className="text-yellow-300">COVERT</span>
          </h1>
          <p className="text-purple-200 mt-3 text-base font-medium">
            Qui bluffera le mieux ? 🤫
          </p>
        </div>

        {/* CTA Principal */}
        <button
          onClick={() => router.push("/game/setup/players")}
          className="w-full bg-white hover:bg-gray-50 active:scale-95 text-violet-700 font-black text-xl py-5 rounded-3xl transition-all shadow-2xl shadow-purple-900/30 flex items-center justify-center gap-3"
        >
          <span className="text-3xl">🚀</span>
          Nouvelle partie
        </button>

        {/* Navigation vers pages détaillées */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push("/players")}
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur border border-white/20 rounded-2xl py-4 text-white font-bold text-sm transition-all"
          >
            <span className="text-xl">👥</span> Page joueurs
          </button>
          <button
            onClick={() => router.push("/history")}
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur border border-white/20 rounded-2xl py-4 text-white font-bold text-sm transition-all"
          >
            <span className="text-xl">📜</span> Page historique
          </button>
        </div>
      </div>
    </div>
  );
}