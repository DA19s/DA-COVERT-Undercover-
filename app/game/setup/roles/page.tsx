"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

type Player = { id: string; nickname: string; total_points?: number; isImported: boolean };
type Setup = { players: Player[]; nbUndercover: number; nbMisterWhite: number };

export default function RolesSetupPage() {
  const router = useRouter();

  const [setup, setSetup] = useState<Setup | null>(null);
  const [nbUndercover, setNbUnder] = useState(1);
  const [nbMisterWhite, setNbMisterWhite] = useState(0);

  useEffect(() => {
    const raw = localStorage.getItem("dacovert_setup");
    if (!raw) {
      router.replace("/game/setup/players");
      return;
    }
    const s: Setup = JSON.parse(raw);
    setSetup(s);
    setNbUnder(s.nbUndercover ?? 1);
    setNbMisterWhite(s.nbMisterWhite ?? 0);
  }, [router]);

  if (!setup) return null;

  const total = setup.players.length;

  // Contraintes:
  // - au moins 1 undercover
  // - au moins 1 civil
  const maxMister = Math.max(0, total - 2);
  const nbMister = Math.max(0, Math.min(nbMisterWhite, maxMister));

  const maxUnder = total - nbMister - 1; // au moins 1 civil
  const safeUnder = Math.max(1, Math.min(nbUndercover, maxUnder));

  const nbCivil = total - safeUnder - nbMister;

  const handleUnder = (delta: number) => {
    const next = safeUnder + delta;
    if (next < 1 || next > maxUnder) return;
    setNbUnder(next);
  };

  const handleMisterWhite = (delta: number) => {
    const next = nbMisterWhite + delta;
    if (next < 0 || next > maxMister) return;

    setNbMisterWhite(next);

    // Réajuste si plus assez de civils pour garder undercover >= 1
    const newMaxUnder = total - next - 1;
    setNbUnder((prev) => (prev > newMaxUnder ? newMaxUnder : prev));
  };

const handleLaunch = async () => {
  try {
    const raw = localStorage.getItem("dacovert_setup");
    if (!raw) return;
    
    // On récupère le gameId
    const { gameId } = JSON.parse(raw);

    // 1. Récupérer les mots depuis Supabase
    const { data: gameData, error: fetchError } = await supabase
      .from("active_games")
      .select("civil_word, undercover_word")
      .eq("id", gameId)
      .single();

    if (fetchError || !gameData) throw new Error("Partie introuvable en base");

    // 2. Préparation du pool de rôles (Utilise les états exacts de l'écran)
    // On s'assure que la somme est égale au total pour éviter l'erreur de tableau
    const rolesPool: string[] = [
      ...Array(nbMister).fill("Mister White"),
      ...Array(safeUnder).fill("Undercover"),
      ...Array(nbCivil).fill("Civil")
    ];

    // Mélange des joueurs
    const shuffledPlayers = [...setup.players].sort(() => Math.random() - 0.5);

    // Attribution des rôles
    const playersToInsert = shuffledPlayers.map((player, index) => {
      const role = rolesPool[index];
      return {
        game_id: gameId,
        player_id: player.id,
        role: role,
        assigned_word: role === "Civil" ? gameData.civil_word : (role === "Undercover" ? gameData.undercover_word : null),
        speak_order: index + 1,
        is_alive: true
      };
    });

    // 3. Mise à jour de la partie et insertion des joueurs
    // On fait tout en parallèle pour aller vite
    const [updateRes, insertRes] = await Promise.all([
      supabase
        .from("active_games")
        .update({
          initial_civils_count: nbCivil,
          initial_undercovers_count: safeUnder,
          initial_mister_whites_count: nbMister,
          game_status: 'playing' // On passe en mode jeu
        })
        .eq("id", gameId),
      
      supabase
        .from("active_game_players")
        .insert(playersToInsert)
    ]);

    if (updateRes.error) throw updateRes.error;
    if (insertRes.error) throw insertRes.error;

    // 4. SAUVEGARDE FINALE DANS LE LOCALSTORAGE
    // On écrase l'ancien setup avec les chiffres définitifs pour la page cards
    const finalSetup = {
      ...setup,
      gameId,
      nbUndercover: safeUnder,
      nbMisterWhite: nbMister,
      nbCivil: nbCivil
    };
    localStorage.setItem("dacovert_setup", JSON.stringify(finalSetup));

    router.push("/game/cards");

  } catch (err) {
    console.error("Détails de l'erreur:", err);
    alert("Erreur lors du lancement. Vérifie ta connexion.");
  }
};

  const ROLE_PILLS = [
    {
      label: "Civil",
      count: nbCivil,
      emoji: "👤",
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
    {
      label: "DA-COVERT",
      count: safeUnder,
      emoji: "🕵️",
      bg: "bg-rose-100",
      text: "text-rose-700",
      border: "border-rose-200",
    },
    {
      label: "Mister White",
      count: nbMister,
      emoji: "👻",
      bg: "bg-slate-100",
      text: "text-slate-600",
      border: "border-slate-200",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col">
      <div className="hidden sm:block absolute top-[-60px] right-[-60px] w-64 h-64 bg-pink-400 rounded-full opacity-25 blur-3xl pointer-events-none" />

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
            <h1 className="text-white font-black text-xl">Les rôles 🎭</h1>
            <p className="text-purple-200 text-xs font-medium">Étape 2 sur 3</p>
          </div>

          <button
            onClick={() => router.push("/lobby")}
            className="ml-auto w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-lg transition-all"
            title="Accueil"
          >
            🏠
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2">
          {["Joueurs", "Rôles", "Distribution"].map((label, idx) => (
            <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all
                  ${
                    idx === 0
                      ? "bg-green-400 text-white scale-90"
                      : idx === 1
                        ? "bg-white text-violet-600 shadow-lg scale-110"
                        : "bg-white/25 text-white/60"
                  }`}
                >
                  {idx === 0 ? "✓" : idx + 1}
                </div>
                <span className={`text-[10px] font-bold ${idx <= 1 ? "text-white" : "text-white/50"}`}>
                  {label}
                </span>
              </div>
              {idx < 2 && (
                <div
                  className={`flex-1 h-0.5 rounded-full mb-3 transition-all ${
                    idx === 0 ? "bg-green-400" : "bg-white/20"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Info joueurs */}
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">👥</span>
          <div>
            <p className="text-white font-black text-sm">{total} joueurs</p>
            <p className="text-purple-200 text-xs">
              {setup.players.map((p) => p.nickname).slice(0, 4).join(", ")}
              {total > 4 ? ` +${total - 4}` : ""}
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="ml-auto text-purple-200 text-xs hover:text-white transition-colors font-medium underline"
          >
            Modifier
          </button>
        </div>

        {/* Réglages */}
        <div className="bg-white rounded-3xl shadow-2xl p-5 space-y-5">
          <h2 className="font-black text-gray-800 text-base">Composition de la partie</h2>

          {/* DA-COVERT stepper */}
          <div className="flex items-center justify-between p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🕵️</span>
              <div>
                <p className="font-black text-gray-800 text-sm">DA-COVERT</p>
                <p className="text-gray-400 text-xs">Ils ont le mot caché</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleUnder(-1)}
                disabled={safeUnder <= 1}
                className="w-9 h-9 rounded-xl bg-white border-2 border-rose-200 hover:border-rose-400 active:scale-95 disabled:opacity-30 flex items-center justify-center text-rose-500 font-black text-lg transition-all"
              >
                −
              </button>
              <span className="text-rose-600 font-black text-xl w-5 text-center">{safeUnder}</span>
              <button
                onClick={() => handleUnder(+1)}
                disabled={safeUnder >= maxUnder}
                className="w-9 h-9 rounded-xl bg-white border-2 border-rose-200 hover:border-rose-400 active:scale-95 disabled:opacity-30 flex items-center justify-center text-rose-500 font-black text-lg transition-all"
              >
                +
              </button>
            </div>
          </div>

          {/* Mister White stepper (multiple possible) */}
          <div className="flex items-center justify-between p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👻</span>
              <div>
                <p className="font-black text-gray-800 text-sm">Mister White</p>
                <p className="text-gray-400 text-xs">Aucun mot, bluff total</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleMisterWhite(-1)}
                disabled={nbMisterWhite <= 0}
                className="w-9 h-9 rounded-xl bg-white border-2 border-slate-200 hover:border-slate-400 active:scale-95 disabled:opacity-30 flex items-center justify-center text-slate-500 font-black text-lg transition-all"
              >
                −
              </button>
              <span className="text-slate-600 font-black text-xl w-5 text-center">{nbMister}</span>
              <button
                onClick={() => handleMisterWhite(+1)}
                disabled={nbMisterWhite >= maxMister}
                className="w-9 h-9 rounded-xl bg-white border-2 border-slate-200 hover:border-slate-400 active:scale-95 disabled:opacity-30 flex items-center justify-center text-slate-500 font-black text-lg transition-all"
              >
                +
              </button>
            </div>
          </div>

          {/* Résumé visuel */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Résumé</p>
            <div className="flex flex-wrap gap-2">
              {ROLE_PILLS.filter((r) => r.count > 0).map((r) => (
                <div
                  key={r.label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 ${r.bg} ${r.border}`}
                >
                  <span className="text-base leading-none">{r.emoji}</span>
                  <span className={`text-sm font-black ${r.text}`}>{r.count}×</span>
                  <span className={`text-xs font-medium ${r.text}`}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Barre visuelle */}
          <div className="flex rounded-2xl overflow-hidden h-4 gap-0.5">
            {[
              { count: nbCivil, color: "bg-emerald-400" },
              { count: safeUnder, color: "bg-rose-400" },
              { count: nbMister, color: "bg-slate-400" },
            ]
              .filter((b) => b.count > 0)
              .map((bar, i) => (
                <div
                  key={i}
                  className={`${bar.color} transition-all duration-300`}
                  style={{ flex: bar.count }}
                />
              ))}
          </div>
        </div>

        {/* Lancer */}
        <button
          onClick={handleLaunch}
          className="w-full bg-white hover:bg-gray-50 active:scale-95 text-violet-700 font-black text-lg py-5 rounded-3xl transition-all shadow-xl shadow-purple-900/20 flex items-center justify-center gap-3"
        >
          <span className="text-2xl">🃏</span>
          Lancer la distribution !
        </button>
      </div>
    </div>
  );
}