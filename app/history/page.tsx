"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/context/authContext";

type Session = {
  id: string;
  played_at: string;
  nb_games: number;
  details: Array<{
    player_id: string;
    nickname: string;
    total_points: number;
    wins: number;
    games_played: number;
  }>;
};

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        const { data: rows, error: sessErr } = await supabase
          .from("game_results")
          .select("id, played_at, nb_games")
          .eq("creator_id", user.id)
          .order("played_at", { ascending: false });

        if (sessErr) throw sessErr;
        const base = (rows as any[] | null) ?? [];
        const full: Session[] = [];

        for (const s of base) {
          const { data: det, error: detErr } = await supabase
            .from("game_result_players")
            .select("player_id, nickname, total_points, wins, games_played")
            .eq("game_result_id", s.id)
            .order("total_points", { ascending: false });

          if (detErr) throw detErr;

          full.push({
            id: s.id,
            played_at: s.played_at,
            nb_games: s.nb_games ?? 1,
            details: (det as any) ?? [],
          });
        }

        setSessions(full);
      } catch (e: any) {
        setError(e?.message ?? "Erreur chargement historique.");
      } finally {
        setIsLoading(false);
      }
    };

    if (!loading) {
      if (!user) {
        router.replace("/login");
        return;
      }
      load();
    }
  }, [loading, user, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col">
      <div className="flex-1 flex flex-col max-w-md w-full mx-auto px-4 py-6 sm:py-10 gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-lg transition-all"
            >
              ←
            </button>
            <div>
              <h1 className="text-white font-black text-xl">Historique 📜</h1>
              <p className="text-purple-200 text-xs font-medium">
                Toutes tes sessions avec details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/lobby")}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-lg transition-all"
              title="Accueil"
            >
              🏠
            </button>
            <button
              onClick={logout}
              className="px-3 h-10 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-xs font-black transition-all"
              title="Se deconnecter"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="bg-white/10 border border-white/20 rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest">
              Sessions
            </p>
            <span className="text-white/50 text-xs font-bold">{sessions.length}</span>
          </div>

          {error && (
            <p className="text-red-200 text-sm bg-red-500/10 border border-red-500/30 rounded-2xl px-3 py-2">
              {error}
            </p>
          )}

          {isLoading ? (
            <p className="text-white/60 text-sm">Chargement...</p>
          ) : sessions.length === 0 ? (
            <p className="text-white/50 text-sm">Aucune session terminee.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => {
                const top = s.details[0];
                const isExpanded = expandedId === s.id;

                return (
                  <div
                    key={s.id}
                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      className="w-full text-left flex items-center gap-3"
                    >
                      <span className="text-2xl">🎲</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-black text-sm truncate">
                          {new Date(s.played_at).toLocaleDateString()} · {s.nb_games} game
                          {s.nb_games > 1 ? "s" : ""}
                        </p>
                        <p className="text-purple-200 text-xs">
                          Top:{" "}
                          <span className="font-bold">
                            {top?.nickname ?? "—"} ({top?.total_points ?? 0} pts)
                          </span>
                        </p>
                      </div>
                      <span className="text-white/60 text-xs font-black">
                        {isExpanded ? "Masquer" : "Details"}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                        {s.details.map((d, idx) => (
                          <div
                            key={`${s.id}-${d.player_id}`}
                            className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2"
                          >
                            <span className="text-white/60 text-xs font-black w-5">{idx + 1}</span>
                            <span className="flex-1 text-white font-bold text-sm truncate">
                              {d.nickname}
                            </span>
                            <span className="text-white/70 text-xs font-black whitespace-nowrap">
                              {d.total_points} pts
                            </span>
                            <span className="text-emerald-300 text-[10px] font-bold whitespace-nowrap">
                              {d.wins}W
                            </span>
                            <span className="text-white/50 text-[10px] font-bold whitespace-nowrap">
                              / {d.games_played}G
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

