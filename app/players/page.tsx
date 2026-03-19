"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/context/authContext";

type PlayerRow = {
  id: string;
  nickname: string;
  total_points: number;
};

export default function PlayersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newNickname, setNewNickname] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState("");

  const loadPlayers = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("players")
        .select("id, nickname, total_points")
        .eq("owner_id", user.id)
        .order("nickname");

      if (dbError) throw dbError;
      setPlayers((data as any) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Erreur chargement des joueurs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
        return;
      }
      loadPlayers();
    }
  }, [loading, user, router]);

  const addPlayer = async () => {
    if (!user) return;
    const nickname = newNickname.trim();
    if (!nickname) return;

    setError(null);
    try {
      const { data: existing, error: exErr } = await supabase
        .from("players")
        .select("id")
        .eq("owner_id", user.id)
        .ilike("nickname", nickname);

      if (exErr) throw exErr;
      if ((existing as any[] | null)?.length) {
        setError("Ce joueur existe deja.");
        return;
      }

      const { error: insErr } = await supabase
        .from("players")
        .insert({
          owner_id: user.id,
          nickname,
          total_points: 0,
        });

      if (insErr) throw insErr;
      setNewNickname("");
      await loadPlayers();
    } catch (e: any) {
      setError(e?.message ?? "Erreur ajout joueur.");
    }
  };

  const saveEdit = async () => {
    if (!user || !editingId) return;
    const nickname = editingNickname.trim();
    if (!nickname) return;

    setError(null);
    try {
      const { error: upErr } = await supabase
        .from("players")
        .update({ nickname })
        .eq("id", editingId)
        .eq("owner_id", user.id);

      if (upErr) throw upErr;
      setEditingId(null);
      setEditingNickname("");
      await loadPlayers();
    } catch (e: any) {
      setError(e?.message ?? "Erreur modification joueur.");
    }
  };

  const deletePlayer = async (id: string) => {
    if (!user) return;
    if (!confirm("Supprimer ce joueur ?")) return;

    setError(null);
    try {
      const { error: delErr } = await supabase
        .from("players")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id);

      if (delErr) throw delErr;
      await loadPlayers();
    } catch (e: any) {
      setError(e?.message ?? "Erreur suppression joueur.");
    }
  };

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
              <h1 className="text-white font-black text-xl">Mes joueurs 👥</h1>
              <p className="text-purple-200 text-xs font-medium">
                Ajoute, modifie ou supprime tes joueurs
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/lobby")}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-lg transition-all"
            title="Accueil"
          >
            🏠
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-gray-800 text-base">Liste des joueurs</h2>
            <span className="text-sm font-black px-3 py-1 rounded-xl bg-violet-100 text-violet-700">
              {players.length}
            </span>
          </div>

          <div className="flex gap-2">
            <input
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              placeholder="Nom du joueur..."
              className="flex-1 border-2 border-gray-100 focus:border-violet-400 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-300 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-base"
            />
            <button
              onClick={addPlayer}
              disabled={!newNickname.trim()}
              className="px-4 py-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 disabled:opacity-40 text-white font-black active:scale-95 transition-all"
            >
              + Ajouter
            </button>
          </div>

          {error && <p className="text-xs text-red-500 font-medium -mt-2">{error}</p>}

          {isLoading ? (
            <p className="text-sm text-gray-400">Chargement...</p>
          ) : players.length === 0 ? (
            <div className="text-center py-8 text-gray-300">
              <div className="text-5xl mb-2">👥</div>
              <p className="text-sm font-medium">Aucun joueur enregistre</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-black text-sm shrink-0">
                    {p.nickname.charAt(0).toUpperCase()}
                  </div>

                  {editingId === p.id ? (
                    <input
                      value={editingNickname}
                      onChange={(e) => setEditingNickname(e.target.value)}
                      className="flex-1 border-b border-gray-300 bg-transparent outline-none text-gray-800 font-bold text-sm"
                    />
                  ) : (
                    <span className="flex-1 font-bold text-gray-800 text-sm">{p.nickname}</span>
                  )}

                  <span className="text-xs bg-violet-100 text-violet-600 font-bold px-2 py-0.5 rounded-lg">
                    {p.total_points} pts
                  </span>

                  {editingId === p.id ? (
                    <button
                      onClick={saveEdit}
                      className="w-7 h-7 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:scale-95 flex items-center justify-center text-emerald-500 text-lg font-bold transition-all leading-none"
                    >
                      ✓
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(p.id);
                        setEditingNickname(p.nickname);
                      }}
                      className="w-7 h-7 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-95 flex items-center justify-center text-amber-500 text-sm font-bold transition-all"
                    >
                      ✎
                    </button>
                  )}

                  <button
                    onClick={() => deletePlayer(p.id)}
                    className="w-7 h-7 rounded-xl bg-red-50 hover:bg-red-100 active:scale-95 flex items-center justify-center text-red-400 text-lg font-bold transition-all leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

