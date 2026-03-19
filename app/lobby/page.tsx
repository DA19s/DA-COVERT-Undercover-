"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/context/authContext";

export default function LobbyPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  type PlayerRow = { id: string; nickname: string; total_points: number };
  type HistoryRow = {
    id: string;
    played_at: string;
    nb_games: number;
    players_count: number;
    host_wins: number;
    top_player_name: string | null;
    top_total_points: number;
  };

  const [myPlayers, setMyPlayers] = useState<PlayerRow[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  const [newNickname, setNewNickname] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState("");

  const [hostPlayerId, setHostPlayerId] = useState<string | null>(null);
  const [stats, setStats] = useState({ gamesPlayed: 0, wins: 0, winRate: 0 });

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setError(null);
      setPlayersLoading(true);
      setHistoryLoading(true);

      try {
        // 1) Charger mes joueurs
        const { data: playersData, error: playersErr } = await supabase
          .from("players")
          .select("id, nickname, total_points")
          .eq("owner_id", user.id)
          .order("nickname");

        if (playersErr) throw playersErr;

        const rows = (playersData as any as PlayerRow[]) ?? [];
        setMyPlayers(rows);

        // On prend comme "host" le joueur dont le nickname = username (créé dans setup-account).
        const host = rows.find((p) => p.nickname === user.username) ?? rows[0] ?? null;
        setHostPlayerId(host?.id ?? null);

        const hostId = host?.id ?? null;

        // 2) Stats (Parties/Victoires/Win rate) via game_result_players
        if (hostId) {
          const { data: statRows, error: statErr } = await supabase
            .from("game_result_players")
            .select("wins, games_played")
            .eq("player_id", hostId);

          if (statErr) throw statErr;

          const wins = (statRows as any[] | null)?.reduce(
            (acc, r) => acc + Number(r.wins ?? 0),
            0
          ) ?? 0;

          const gamesPlayed = (statRows as any[] | null)?.reduce(
            (acc, r) => acc + Number(r.games_played ?? 0),
            0
          ) ?? 0;

          const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
          setStats({ gamesPlayed, wins, winRate });
        } else {
          setStats({ gamesPlayed: 0, wins: 0, winRate: 0 });
        }

        // 3) Historique (dernières sessions du user)
        const { data: sessionRows, error: sessionErr } = await supabase
          .from("game_results")
          .select("id, played_at, nb_games")
          .eq("creator_id", user.id)
          .order("played_at", { ascending: false })
          .limit(5);

        if (sessionErr) throw sessionErr;

        const sessions = (sessionRows as any[] | null) ?? [];
        const enriched: HistoryRow[] = [];

        for (const s of sessions) {
          const { data: grpRows, error: grpErr } = await supabase
            .from("game_result_players")
            .select("player_id, nickname, total_points, wins")
            .eq("game_result_id", s.id);

          if (grpErr) throw grpErr;

          const grp = (grpRows as any[] | null) ?? [];
          const playersCount = grp.length;

          const hostRow = hostId ? grp.find((r) => r.player_id === hostId) : null;
          const hostWins = Number(hostRow?.wins ?? 0);

          const top = [...grp].sort(
            (a, b) => Number(b.total_points ?? 0) - Number(a.total_points ?? 0)
          )[0];

          enriched.push({
            id: s.id,
            played_at: s.played_at,
            nb_games: s.nb_games ?? 1,
            players_count: playersCount,
            host_wins: hostWins,
            top_player_name: top?.nickname ?? null,
            top_total_points: Number(top?.total_points ?? 0),
          });
        }

        setHistory(enriched);
      } catch (e: any) {
        setError(e?.message ?? "Erreur chargement lobby");
      } finally {
        setPlayersLoading(false);
        setHistoryLoading(false);
      }
    };

    if (!loading) load();
  }, [user, loading]);

  const reloadAll = async () => {
    if (!user) return;
    setError(null);
    setPlayersLoading(true);
    setHistoryLoading(true);

    try {
      const { data: playersData, error: playersErr } = await supabase
        .from("players")
        .select("id, nickname, total_points")
        .eq("owner_id", user.id)
        .order("nickname");

      if (playersErr) throw playersErr;

      const rows = (playersData as any as PlayerRow[]) ?? [];
      setMyPlayers(rows);

      const host = rows.find((p) => p.nickname === user.username) ?? rows[0] ?? null;
      const hostId = host?.id ?? null;
      setHostPlayerId(hostId);

      // Stats
      if (hostId) {
        const { data: statRows, error: statErr } = await supabase
          .from("game_result_players")
          .select("wins, games_played")
          .eq("player_id", hostId);

        if (statErr) throw statErr;

        const wins = (statRows as any[] | null)?.reduce(
          (acc, r) => acc + Number(r.wins ?? 0),
          0
        ) ?? 0;

        const gamesPlayed = (statRows as any[] | null)?.reduce(
          (acc, r) => acc + Number(r.games_played ?? 0),
          0
        ) ?? 0;

        const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
        setStats({ gamesPlayed, wins, winRate });
      } else {
        setStats({ gamesPlayed: 0, wins: 0, winRate: 0 });
      }

      // Historique
      const { data: sessionRows, error: sessionErr } = await supabase
        .from("game_results")
        .select("id, played_at, nb_games")
        .eq("creator_id", user.id)
        .order("played_at", { ascending: false })
        .limit(5);

      if (sessionErr) throw sessionErr;

      const sessions = (sessionRows as any[] | null) ?? [];
      const enriched: HistoryRow[] = [];

      for (const s of sessions) {
        const { data: grpRows, error: grpErr } = await supabase
          .from("game_result_players")
          .select("player_id, nickname, total_points, wins")
          .eq("game_result_id", s.id);

        if (grpErr) throw grpErr;

        const grp = (grpRows as any[] | null) ?? [];
        const playersCount = grp.length;

        const hostRow = hostId ? grp.find((r) => r.player_id === hostId) : null;
        const hostWins = Number(hostRow?.wins ?? 0);

        const top = [...grp].sort(
          (a, b) => Number(b.total_points ?? 0) - Number(a.total_points ?? 0)
        )[0];

        enriched.push({
          id: s.id,
          played_at: s.played_at,
          nb_games: s.nb_games ?? 1,
          players_count: playersCount,
          host_wins: hostWins,
          top_player_name: top?.nickname ?? null,
          top_total_points: Number(top?.total_points ?? 0),
        });
      }

      setHistory(enriched);
    } catch (e: any) {
      setError(e?.message ?? "Erreur chargement lobby");
    } finally {
      setPlayersLoading(false);
      setHistoryLoading(false);
    }
  };

  const addPlayer = async () => {
    if (!user) return;
    const nickname = newNickname.trim();
    if (!nickname) return;

    setError(null);
    try {
      setPlayersLoading(true);

      const { data: existing, error: exErr } = await supabase
        .from("players")
        .select("id")
        .eq("owner_id", user.id)
        .ilike("nickname", nickname);

      if (exErr) throw exErr;
      if ((existing as any[] | null)?.length) {
        setError("Ce joueur existe déjà.");
        return;
      }

      const { data, error: insErr } = await supabase
        .from("players")
        .insert({
          owner_id: user.id,
          nickname,
          total_points: 0,
        })
        .select("id, nickname, total_points")
        .single();

      if (insErr) throw insErr;

      setNewNickname("");
      await reloadAll();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'ajout.");
    } finally {
      setPlayersLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!user || !editingId) return;
    const nickname = editingNickname.trim();
    if (!nickname) return;

    setError(null);
    try {
      setPlayersLoading(true);

      const { error: upErr } = await supabase
        .from("players")
        .update({ nickname })
        .eq("id", editingId)
        .eq("owner_id", user.id);

      if (upErr) throw upErr;

      setEditingId(null);
      setEditingNickname("");
      await reloadAll();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la modification.");
    } finally {
      setPlayersLoading(false);
    }
  };

  const deletePlayer = async (id: string) => {
    if (!user) return;
    if (!confirm("Supprimer ce joueur ?")) return;

    setError(null);
    try {
      setPlayersLoading(true);

      const { error: delErr } = await supabase
        .from("players")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id);

      if (delErr) throw delErr;

      if (id === hostPlayerId) setHostPlayerId(null);
      await reloadAll();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la suppression.");
    } finally {
      setPlayersLoading(false);
    }
  };

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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Parties", value: stats.gamesPlayed, emoji: "🎮" },
            { label: "Victoires", value: stats.wins, emoji: "🏆" },
            { label: "Win rate", value: `${stats.winRate}%`, emoji: "📈" },
          ].map(({ label, value, emoji }) => (
            <div key={label} className="bg-white/10 backdrop-blur rounded-2xl p-3 text-center">
              <div className="text-2xl mb-1">{emoji}</div>
              <div className="text-white font-black text-xl leading-none">{value}</div>
              <div className="text-purple-200 text-xs mt-0.5 font-medium">{label}</div>
            </div>
          ))}
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

        {/* Mes joueurs (CRUD) */}
        <div className="bg-white/10 backdrop-blur rounded-3xl p-5 border border-white/15 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-white font-black text-lg">👥 Mes joueurs</h2>
            <span className="text-white/60 text-xs font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10 whitespace-nowrap">
              {myPlayers.length} joueur{myPlayers.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex gap-3">
            <input
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              placeholder="Nom du joueur..."
              className="flex-1 border-2 border-white/10 focus:border-white/30 rounded-2xl px-4 py-3 text-white placeholder-white/40 bg-white/5 outline-none"
            />
            <button
              disabled={playersLoading || !newNickname.trim()}
              onClick={addPlayer}
              className="px-4 py-3 rounded-2xl bg-white text-violet-700 font-black active:scale-95 transition-all disabled:opacity-40"
            >
              {playersLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-700 rounded-full animate-spin" />
                  Chargement
                </span>
              ) : (
                "+ Ajouter"
              )}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-2xl px-4 py-3 text-sm font-bold">
              {error}
            </div>
          )}

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {myPlayers.length === 0 ? (
              <p className="text-white/50 text-sm">Aucun joueur pour l’instant.</p>
            ) : (
              myPlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3"
                >
                  {editingId === p.id ? (
                    <input
                      value={editingNickname}
                      onChange={(e) => setEditingNickname(e.target.value)}
                      className="flex-1 text-white font-black bg-transparent outline-none border-b border-white/20 pb-1"
                    />
                  ) : (
                    <span className="flex-1 text-white font-black truncate">{p.nickname}</span>
                  )}

                  <span className="text-white/60 text-xs font-black whitespace-nowrap">
                    {p.total_points} pts
                  </span>

                  {editingId === p.id ? (
                    <button
                      onClick={saveEdit}
                      disabled={playersLoading || !editingNickname.trim()}
                      className="w-10 h-10 rounded-xl bg-white text-violet-700 font-black active:scale-95 transition-all disabled:opacity-40"
                      title="Valider"
                    >
                      ✅
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(p.id);
                        setEditingNickname(p.nickname);
                      }}
                      className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-black active:scale-95 transition-all"
                      title="Modifier"
                    >
                      ⚙️
                    </button>
                  )}

                  <button
                    onClick={() => deletePlayer(p.id)}
                    disabled={playersLoading}
                    className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-200 font-black active:scale-95 transition-all disabled:opacity-40"
                    title="Supprimer"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Historique */}
        <div className="space-y-2">
          <h2 className="text-white/70 text-xs font-bold tracking-widest uppercase px-1">
            Historique
          </h2>
          {historyLoading ? (
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Chargement…</span>
            </div>
          ) : history.length === 0 ? (
            <p className="text-white/50 text-sm">Aucune session terminée.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const won = h.host_wins > 0;
                const dateLabel = new Date(h.played_at).toLocaleDateString();
                return (
                  <div
                    key={h.id}
                    className="bg-white/10 backdrop-blur border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3"
                  >
                    <span className="text-2xl">{won ? "🏆" : "💀"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">
                        {h.players_count} joueurs · {dateLabel}
                      </p>
                      <p className="text-purple-200 text-xs">
                        Top :{" "}
                        <span className="font-bold">
                          {h.top_player_name ?? "—"}
                        </span>{" "}
                        ({h.top_total_points} pts)
                      </p>
                    </div>
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-xl shrink-0 ${
                        won
                          ? "bg-green-400/20 text-green-300"
                          : "bg-white/10 text-white/50"
                      }`}
                    >
                      {won ? "Victoire 🏆" : "Défaite"}
                    </span>
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