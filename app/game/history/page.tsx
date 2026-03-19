"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/context/authContext";

type SessionRow = {
  id: string;
  played_at: string;
  nb_games: number;
};

type SessionPlayerRow = {
  player_id: string;
  nickname: string;
  total_points: number;
  wins: number;
  games_played: number;
};
type Role = "Civil" | "Undercover" | "Mister White";
type PlayedGameRow = {
  id: string;
  civil_word: string | null;
  undercover_word: string | null;
  current_round: number | null;
  game_status: string | null;
  perGameScores: Array<{
    player_id: string;
    nickname: string;
    points: number;
  }>;
};
type SessionWithDetails = SessionRow & {
  topPlayers: SessionPlayerRow[];
  playedGames: PlayedGameRow[];
};

export default function GameHistoryPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const canLoad = !!user;

  useEffect(() => {
    if (!canLoad) return;

    const load = async () => {
      setLoading(true);
      try {
        // Historique des sessions de l'utilisateur (on prend uniquement la plus récente)
        const { data: sessionRows, error: sessError } = await supabase
          .from("game_results")
          .select("id, played_at, nb_games")
          .eq("creator_id", user!.id)
          .order("played_at", { ascending: false })
          .limit(1);

        if (sessError) throw sessError;

        const rows: SessionRow[] = (sessionRows as any) ?? [];

        const enriched: SessionWithDetails[] = [];
        for (const s of rows) {
          const { data: topPlayers } = await supabase
            .from("game_result_players")
            .select(
              "player_id, nickname, total_points, wins, games_played"
            )
            .eq("game_result_id", s.id)
            .order("total_points", { ascending: false })
            ;

          enriched.push({
            ...s,
            topPlayers: (topPlayers as any) ?? [],
            playedGames: [],
          });
        }

        // Toutes les active_games jouées dans ce game_results
        // Fallback sans game_result_id: on prend les dernières games finies du créateur
        // selon nb_games (page = session la plus récente).
        for (const s of enriched) {
          const { data: games } = await supabase
            .from("active_games")
            .select("id, civil_word, undercover_word, current_round, game_status")
            .eq("creator_id", user!.id)
            .ilike("game_status", "finished%")
            .order("created_at", { ascending: false })
            .limit(Math.max(1, Number(s.nb_games ?? 1)));

          const baseGames = ((games as any) ?? []) as Array<{
            id: string;
            civil_word: string | null;
            undercover_word: string | null;
            current_round: number | null;
            game_status: string | null;
          }>;

          const nickByPlayerId = new Map<string, string>(
            (s.topPlayers ?? []).map((p: SessionPlayerRow) => [p.player_id, p.nickname])
          );

          const checkWinFromRows = (rows: Array<{ role: Role; is_alive: boolean }>) => {
            const alive = rows.filter((r) => r.is_alive);
            const uc = alive.filter((r) => r.role === "Undercover").length;
            const mw = alive.filter((r) => r.role === "Mister White").length;
            const civil = alive.filter((r) => r.role === "Civil").length;
            const total = alive.length;

            if (total <= 2 && mw >= 1) return "Mister White";
            if (uc === 0 && mw === 0) return "Civil";
            if (civil <= 1 && mw === 0) return "Undercover";
            return null;
          };

          const winnerRoleFromStatus = (status: string | null): Role | null => {
            if (!status) return null;
            if (status === "finished_civil") return "Civil";
            if (status === "finished_undercover") return "Undercover";
            if (status === "finished_misterwhite") return "Mister White";
            return null;
          };

          const gamesWithScores: PlayedGameRow[] = [];
          for (const g of baseGames) {
            const { data: gpRows } = await supabase
              .from("active_game_players")
              .select("id, player_id, role, is_alive, speak_order")
              .eq("game_id", g.id);

            const rawRows = ((gpRows as any) ?? []) as Array<{
              id: string;
              player_id: string;
              role: Role;
              is_alive: boolean;
              speak_order?: number | null;
            }>;

            // Dédoublonnage robuste : on garde une seule ligne par player_id.
            // En cas de doublons, on garde la dernière occurrence (la plus "récente" renvoyée).
            const byPlayer = new Map<string, typeof rawRows[number]>();
            for (const r of rawRows) {
              byPlayer.set(r.player_id, r);
            }
            const rows = Array.from(byPlayer.values());

            const winnerRole = winnerRoleFromStatus(g.game_status) ?? checkWinFromRows(rows);
            const perGame: Array<{ player_id: string; nickname: string; points: number }> = rows
              .map((r) => ({
                player_id: r.player_id,
                nickname: nickByPlayerId.get(r.player_id) ?? "Joueur",
                points: winnerRole && r.role === winnerRole ? 3 : 0,
              }))
              .sort((a, b) => b.points - a.points || a.nickname.localeCompare(b.nickname, "fr", { sensitivity: "base" }));

            gamesWithScores.push({
              ...g,
              perGameScores: perGame,
            });
          }

          s.playedGames = gamesWithScores;
        }

        setSessions(enriched);
      } catch (e) {
        console.error("Erreur GameHistoryPage:", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [canLoad, user]);

  const RankBadge = ({ rank }: { rank: number }) => {
    if (rank === 1) {
      return (
        <span className="w-9 h-9 rounded-2xl bg-yellow-300/20 border border-yellow-200 flex items-center justify-center text-lg">
          🥇
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-9 h-9 rounded-2xl bg-slate-200/20 border border-slate-200 flex items-center justify-center text-lg">
          🥈
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-9 h-9 rounded-2xl bg-orange-200/20 border border-orange-200 flex items-center justify-center text-lg">
          🥉
        </span>
      );
    }
    return (
      <span className="w-9 h-9 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white/80 font-black">
        {rank}
      </span>
    );
  };

  if (!canLoad) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-6xl mb-4">🔐</div>
          <p className="font-black text-xl">Connecte-toi pour voir l’historique</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-6 w-full bg-white text-gray-900 font-black py-4 rounded-2xl active:scale-95 transition-all"
          >
            Aller au login →
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-6xl mb-4 animate-pulse">📚</div>
          <p className="font-black text-xl">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col">
      <div className="flex-1 flex flex-col max-w-md w-full mx-auto px-4 py-8 gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-lg transition-all"
            >
              ←
            </button>
            <h1 className="text-white font-black text-xl">Historique 🎲</h1>
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

        <div className="bg-white/10 border border-white/20 rounded-3xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white font-black text-sm">Top classement</p>
              <p className="text-white/50 text-xs mt-1">Meilleurs scores cumulés</p>
            </div>
            <span className="text-white/40 text-xs font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10">
              {sessions[0]?.topPlayers?.length ?? 0} joueurs
            </span>
          </div>

          <div className="space-y-2">
            {(sessions[0]?.topPlayers ?? []).map((p, i) => (
              <div
                key={`${sessions[0]?.id}-${p.player_id}`}
                className="flex items-center justify-between gap-3 bg-white/5 rounded-2xl px-4 py-3 border border-white/10"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <RankBadge rank={i + 1} />
                  <span className="text-white font-black text-sm truncate">
                    {p.nickname}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-white font-black text-base">
                    {p.total_points} pts
                  </span>
                </div>
              </div>
            ))}

            {(sessions[0]?.topPlayers ?? []).length === 0 && (
              <p className="text-white/50 text-sm">Pas encore de données.</p>
            )}
          </div>
        </div>

        <div className="pb-8">
          <button
            onClick={() => router.push("/game/setup/players")}
            className="w-full bg-white text-gray-900 font-black py-4 rounded-3xl active:scale-95 transition-all shadow-lg"
          >
            Nouvelle partie →
          </button>
        </div>
      </div>
    </div>
  );
}

