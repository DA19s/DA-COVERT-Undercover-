"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/context/authContext";
import { useState, useEffect } from "react";
/*
// TODO: remplacer par SELECT * FROM players WHERE owner_id = auth.uid()
const MOCK_SAVED_PLAYERS = [
  { id: "p1", nickname: "Alice" },
  { id: "p2", nickname: "Bob" },
  { id: "p3", nickname: "Charlie" },
  { id: "p4", nickname: "Diana" },
  { id: "p5", nickname: "Ethan" },
  { id: "p6", nickname: "Fiona" },
  { id: "p7", nickname: "Gabriel" },
  { id: "p8", nickname: "Héloïse" },
];*/

type Player = { id: string; nickname: string; total_points?: number; isImported: boolean };
const STEP_LABELS = ["Joueurs", "Rôles", "Distribution"];

export default function PlayersSetupPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [savedPlayers, setSavedPlayers] = useState<Player[]>([]);
  const [players, setPlayers]       = useState<Player[]>([]);
  const [input, setInput]           = useState("");
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [error, setError]           = useState("");

  useEffect(() => {
    const fetchSavedPlayers = async () => {
      if (!user?.id) return;
      const {data, error} = await supabase
      .from("players")
      .select("id, nickname, total_points")
      .eq("owner_id", user?.id)
      .order("nickname", { ascending: true })

      if (!error && data) {
        setSavedPlayers(data.map(p => ({...p, isImported: true})))
      }
    } 
    if (!authLoading) fetchSavedPlayers();
    }, [user, authLoading]);

  const addPlayer = async () => {
    const nickname = input.trim();
    if (!nickname) return;
    if (players.some(p => p.nickname.toLowerCase() === nickname.toLowerCase())) {
        setError("Ce joueur est déjà ajouté !");
        return;
    }
    if (!user?.id) {
    setError("Vous devez être connecté pour ajouter un joueur.");
    return;
    }

    try {
      const { data, error: dbError } = await supabase
      .from("players")
      .select("id, nickname, total_points")
      .eq("owner_id", user?.id)
      .eq("nickname", nickname)
      .maybeSingle()

      if (dbError) throw new Error("Erreur en base de donnee")

      if (data) {
        const foundPlayer = {...data, isImported: true}
        setPlayers((prev) => [...prev, foundPlayer])
      }
      else {
        const { data: insertedData, error: dbError } = await supabase
        .from("players")
        .insert({
          nickname: nickname,
          total_points: 0,
          owner_id: user?.id
          })
        .select()
        .single();

        if (dbError) throw new Error("Erreur en base de donnee")

        const newPlayer = {
          id: insertedData.id,
          nickname: insertedData.nickname, 
          total_points: insertedData.total_points, 
          isImported:true}
        setPlayers((prev) => [...prev, newPlayer])

      }
      } catch (error: any) {
        // Remplace ta console.error par ceci pour voir le message de Postgres
        console.error("VRAIE ERREUR :", error); 
        setError(error.message || "Erreur en base de donnée");
      }
    setInput("");
    setError("");
  };

  const removePlayer = (id: string) =>
    setPlayers((prev) => prev.filter((p) => p.id !== id));

  const toggleSaved = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const importSelected = () => {
    const toAdd = savedPlayers.filter(
      (sp) =>
        selected.has(sp.id) &&
        !players.some((p) => p.nickname.toLowerCase() === sp.nickname.toLowerCase())
    ).map((sp) => ({ id: sp.id, nickname: sp.nickname, isImported: true }));
    setPlayers((prev) => [...prev, ...toAdd]);
    setSelected(new Set());
    setShowImport(false);
  };

const handleContinue = async () => {
    if (!canContinue || !user) return;

    try {

      const { data: allWords, error: wordError } = await supabase
        .from("words")
        .select("civil_word, undercover_word");

      if (wordError) throw wordError;
      if (!allWords || allWords.length === 0) {
        throw new Error("La table 'words' est vide ! Remplis-la d'abord.");
      }

      const randomPair = allWords[Math.floor(Math.random() * allWords.length)];

      const { data: game, error: gameError } = await supabase
        .from("active_games")
        .insert({
          creator_id: user.id,
          civil_word: randomPair.civil_word,
          undercover_word: randomPair.undercover_word,
          current_round: 1,
          initial_civils_count: 0, 
          initial_undercovers_count: 0,
          initial_mister_whites_count: 0,
          game_status: 'playing'
        })
        .select()
        .single();

      if (gameError) throw gameError;

      localStorage.setItem(
        "dacovert_setup",
        JSON.stringify({ 
          gameId: game.id, 
          players: players 
        })
      );

      // Session de plusieurs "Rejouer" : on cumule les points côté client
      // puis on flush en DB uniquement au moment de "Terminer".
      const sessionId =
        typeof crypto !== "undefined" && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `sess_${Date.now()}`;

      localStorage.setItem(
        "dacovert_session",
        JSON.stringify({
          sessionId,
          creator_id: user.id,
          startedAt: Date.now(),
          gamesPlayed: 0,
          gameIds: [game.id],
          players: players.map((p) => ({
            player_id: p.id,
            nickname: p.nickname,
            totalPoints: 0,
            wins: 0,
            gamesPlayed: 0,
          })),
        })
      );

      router.push("/game/setup/roles");

    } catch (err: any) {
      console.error("VRAIE ERREUR DETECTEE :", err);
      setError(err.message || "Erreur lors de l'initialisation.");
    }
  };

  const canContinue = players.length >= 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col">

      {/* Overlay import */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowImport(false)}
          />
          <div className="relative bg-white rounded-t-3xl p-6 max-h-[75vh] flex flex-col gap-4 shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1 mb-1" />
            <div className="flex items-center justify-between">
              <h3 className="font-black text-gray-800 text-lg">Mes joueurs sauvegardés 👥</h3>
              <button onClick={() => setShowImport(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>
            <p className="text-gray-400 text-sm -mt-2">
              {selected.size > 0
                ? `${selected.size} joueur${selected.size > 1 ? "s" : ""} sélectionné${selected.size > 1 ? "s" : ""}`
                : "Sélectionne les joueurs à importer"}
            </p>
            <div className="overflow-y-auto flex-1 space-y-2">
              {[...savedPlayers]
                .sort((a, b) => a.nickname.localeCompare(b.nickname, "fr", { sensitivity: "base" }))
                .map((sp) => {
                const alreadyAdded = players.some(
                  (p) => p.nickname.toLowerCase() === sp.nickname.toLowerCase()
                );
                const isSelected = selected.has(sp.id);
                return (
                  <button
                    key={sp.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => toggleSaved(sp.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left
                      ${alreadyAdded
                        ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                        : isSelected
                        ? "border-violet-400 bg-violet-50"
                        : "border-gray-100 hover:border-violet-200 bg-white"}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0
                      ${isSelected ? "bg-violet-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                      {isSelected ? "✓" : sp.nickname.charAt(0)}
                    </div>
                    <span className={`font-bold text-sm ${isSelected ? "text-violet-700" : "text-gray-800"}`}>
                      {sp.nickname}
                    </span>
                    {alreadyAdded && (
                      <span className="ml-auto text-xs text-gray-400 font-medium">Déjà ajouté</span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={importSelected}
              disabled={selected.size === 0}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-600 disabled:opacity-40 active:scale-95 text-white font-black py-4 rounded-2xl transition-all"
            >
              Importer {selected.size > 0 ? `${selected.size} joueur${selected.size > 1 ? "s" : ""}` : ""} ✅
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col max-w-md w-full mx-auto px-4 py-6 sm:py-10 gap-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-lg transition-all"
          >
            ←
          </button>
          <div>
            <h1 className="text-white font-black text-xl">Qui joue ? 👥</h1>
            <p className="text-purple-200 text-xs font-medium">Étape 1 sur 3</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
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

        {/* Stepper */}
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, idx) => (
            <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all
                  ${idx === 0 ? "bg-white text-violet-600 shadow-lg scale-110" : "bg-white/25 text-white/60"}`}>
                  {idx + 1}
                </div>
                <span className={`text-[10px] font-bold ${idx === 0 ? "text-white" : "text-white/50"}`}>{label}</span>
              </div>
              {idx < 2 && <div className="flex-1 h-0.5 rounded-full bg-white/20 mb-3" />}
            </div>
          ))}
        </div>

        {/* Card principale */}
        <div className="bg-white rounded-3xl shadow-2xl p-5 space-y-4">

          {/* Compteur */}
          <div className="flex items-center justify-between">
            <h2 className="font-black text-gray-800 text-base">
              Joueurs ajoutés
            </h2>
            <span className={`text-sm font-black px-3 py-1 rounded-xl ${
              players.length >= 3 ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500"
            }`}>
              {players.length} / min. 3
            </span>
          </div>

          {/* Input ajouter */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              placeholder="Prénom du joueur..."
              className="flex-1 border-2 border-gray-100 focus:border-violet-400 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-300 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-base"
            />
            <button
              type="button"
              onClick={addPlayer}
              className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 active:scale-95 rounded-2xl text-white text-2xl font-black flex items-center justify-center shadow-md transition-all"
            >
              +
            </button>
          </div>
          {error && <p className="text-xs text-red-500 font-medium -mt-2">{error}</p>}

          {/* Importer */}
          <button
            onClick={() => setShowImport(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-violet-200 hover:border-violet-400 hover:bg-violet-50 active:scale-95 rounded-2xl py-3 text-violet-600 font-bold text-sm transition-all"
          >
            <span className="text-lg">📥</span>
            Importer mes joueurs sauvegardés
          </button>

          {/* Liste */}
          {players.length === 0 ? (
            <div className="text-center py-8 text-gray-300">
              <div className="text-5xl mb-2">👥</div>
              <p className="text-sm font-medium">Ajoute au moins 3 joueurs pour commencer</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {players.map((player, idx) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-black text-sm shrink-0">
                    {idx + 1}
                  </div>
                  <span className="flex-1 font-bold text-gray-800 text-sm">{player.nickname}</span>
                  {player.isImported && (
                    <span className="text-xs bg-violet-100 text-violet-600 font-bold px-2 py-0.5 rounded-lg">
                      Importé
                    </span>
                  )}
                  <button
                    onClick={() => removePlayer(player.id)}
                    className="w-7 h-7 rounded-xl bg-red-50 hover:bg-red-100 active:scale-95 flex items-center justify-center text-red-400 text-lg font-bold transition-all leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Continuer */}
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full bg-white hover:bg-gray-50 active:scale-95 disabled:opacity-40 text-violet-700 font-black text-lg py-4 rounded-3xl transition-all shadow-xl shadow-purple-900/20 flex items-center justify-center gap-2"
        >
          Continuer →
        </button>

        {!canContinue && (
          <p className="text-center text-purple-200/70 text-xs">
            Il faut au moins 3 joueurs pour jouer 😊
          </p>
        )}
      </div>
    </div>
  );
}