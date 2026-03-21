"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { getWordsWithCache } from "@/lib/words-cache";

// ─── Types ───────────────────────────────────────────────────────────────────
type Player = { id: string; nickname: string }; // On utilise nickname comme dans ton setup
type Role = "Civil" | "Undercover" | "Mister White";
type Phase = "handoff" | "choosing" | "revealing" | "done";

type GameCard = {
  index: number;
  role: Role;
  word: string;
  takenBy: string | null;
};

const ROLE_CONFIG: Record<Role, {
  bg: string; emoji: string; label: string; desc: string;
}> = {
  Civil: {
    bg: "from-violet-500 to-purple-600",
    emoji: "👤", label: "Civil",
    desc: "Tu connais le mot. Décris-le sans le dire !",
  },
  Undercover: {
    bg: "from-violet-500 to-purple-600",
    emoji: "🕵️", label: "DA-COVERT",
    desc: "Tu as un mot similaire. Blende-toi parmi les civils !",
  },
  "Mister White": {
    bg: "from-violet-500 to-purple-600",
    emoji: "👻", label: "Mister White",
    desc: "Tu n'as aucun mot. Écoute et improvise !",
  },
};

// ─── Composant carte (inchangé mais nettoyé) ──────────────────────────────────
function CardTile({ card, phase, onClick }: { card: GameCard; phase: Phase; onClick: () => void }) {
  const taken = card.takenBy !== null;
  const selectable = phase === "choosing" && !taken;

  return (
    <button
      onClick={selectable ? onClick : undefined}
      className={`relative aspect-[2/3] rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-1
        ${taken ? "bg-gray-50 border-gray-100 opacity-50" 
        : "bg-gradient-to-br from-violet-500 to-purple-700 border-violet-400 shadow-lg active:scale-90"}`}
    >
      {taken ? <span className="text-2xl">🔒</span> : <span className="text-3xl">🃏</span>}
    </button>
  );
}

export default function CardsPage() {
  const router = useRouter();
  const [gameId, setGameId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [currentIdx, setCurrent] = useState(0);
  const [phase, setPhase] = useState<Phase>("handoff");
  const [selectedCard, setSelected] = useState<number | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [startingGame, setStartingGame] = useState(false);

  // 1. Initialisation : On récupère les mots et on génère les cartes
  useEffect(() => {
  const initGame = async () => {
    setInitLoading(true);
    const raw = localStorage.getItem("dacovert_setup");
    if (!raw) {
      router.replace("/game/setup/players");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      console.log("Données reçues du localStorage:", parsed);

      // FORCE les valeurs pour éviter le NaN ou le négatif
      const p = parsed.players || [];
      const totalPlayers = p.length;
      
      // On vérifie les clés exactes (on teste nbUndercover ET nbUnder au cas où)
      const uCount = Number(parsed.nbUndercover || parsed.nbUnder || 1);
      const mCount = Number(parsed.nbMisterWhite || parsed.nbMister || 0);

      // CALCUL SÉCURISÉ : On s'assure que la somme ne dépasse pas le total
      // Array() n'accepte que des entiers positifs
      const nbUndercover = Math.min(uCount, totalPlayers - 1); 
      const nbMisterWhite = Math.min(mCount, totalPlayers - nbUndercover - 1);
      const nbCivil = Math.max(0, totalPlayers - nbUndercover - nbMisterWhite);

      console.log(`Calcul final: Civils:${nbCivil}, Under:${nbUndercover}, White:${nbMisterWhite}`);

      // Si l'utilisateur revient sur /game/cards après /game/play,
      // on crée une NOUVELLE active_game (nouveaux mots + nouvelles attributions).
      const shouldRestart = localStorage.getItem("dacovert_play_started") === "true";
      let effectiveGameId = parsed.gameId as string;
      if (shouldRestart) {
        try {
          // Vider tout ce qui dépend de la distribution précédente.
          localStorage.removeItem("dacovert_roles");
          localStorage.removeItem("dacovert_gameover");

          setPhase("handoff");
          setCurrent(0);
          setSelected(null);
          setCards([]);

          // 1) Lire l'ancienne game pour récupérer creator_id et ancien mot
          const { data: oldGame } = await supabase
            .from("active_games")
            .select("id, creator_id, civil_word, undercover_word")
            .eq("id", parsed.gameId)
            .single();

          // 2) Nouveau duo de mots (si possible différent de l'ancien)
          const allWords = await getWordsWithCache();

          const filteredPairs = allWords.filter(
            (w) =>
              !oldGame ||
              w.civil_word !== oldGame.civil_word ||
              w.undercover_word !== oldGame.undercover_word
          );
          const sourcePairs = filteredPairs.length > 0 ? filteredPairs : allWords;
          const randomPair = sourcePairs[Math.floor(Math.random() * sourcePairs.length)];

          // 3) Créer une nouvelle active_game (au lieu d'écraser l'ancienne)
          const { data: newGame, error: insertGameError } = await supabase
            .from("active_games")
            .insert({
              creator_id: oldGame?.creator_id ?? null,
              civil_word: randomPair.civil_word,
              undercover_word: randomPair.undercover_word,
              current_round: 1,
              game_status: "playing",
              initial_civils_count: parsed.nbCivil ?? 0,
              initial_undercovers_count: parsed.nbUndercover ?? parsed.nbUnder ?? 0,
              initial_mister_whites_count: parsed.nbMisterWhite ?? parsed.nbMister ?? 0,
            })
            .select("id")
            .single();

          if (insertGameError || !newGame) throw insertGameError || new Error("Nouvelle game introuvable");
          effectiveGameId = newGame.id;

          // 4) On garde la même session et on trace la nouvelle game.
          const rawSession = localStorage.getItem("dacovert_session");
          if (rawSession) {
            const session = JSON.parse(rawSession);
            if (!Array.isArray(session.gameIds)) session.gameIds = [];
            if (!session.gameIds.includes(effectiveGameId)) {
              session.gameIds.push(effectiveGameId);
            }
            localStorage.setItem("dacovert_session", JSON.stringify(session));
          }

          // 5) Mettre à jour dacovert_setup avec la nouvelle gameId
          const setup = JSON.parse(localStorage.getItem("dacovert_setup") || "{}");
          setup.gameId = effectiveGameId;
          localStorage.setItem("dacovert_setup", JSON.stringify(setup));
        } finally {
          // On ne restart qu'une fois par retour
          localStorage.removeItem("dacovert_play_started");
        }
      }

      setGameId(effectiveGameId);
      // Réinitialise la map de rôles pour cette nouvelle partie
      localStorage.removeItem("dacovert_roles");
      // Ordre de passage entièrement aléatoire
      setPlayers([...p].sort(() => Math.random() - 0.5));

      const { data: gameData, error } = await supabase
        .from("active_games")
        .select("civil_word, undercover_word")
        .eq("id", effectiveGameId)
        .single();

      if (error || !gameData) {
        console.error("Erreur Supabase ou GameId introuvable:", error);
        return;
      }

      // CRÉATION DU POOL (C'est ici que ça plantait)
      const rolesPool: Role[] = [
        ...Array(nbCivil).fill("Civil"),
        ...Array(nbUndercover).fill("Undercover"),
        ...Array(nbMisterWhite).fill("Mister White"),
      ];

      // Mélange
      const shuffledRoles = rolesPool.sort(() => Math.random() - 0.5);

      setCards(shuffledRoles.map((role, i) => ({
        index: i,
        role,
        word: role === "Civil" ? gameData.civil_word : role === "Undercover" ? gameData.undercover_word : "",
        takenBy: null,
      })));

    } catch (e) {
      console.error("Crash dans initGame:", e);
    } finally {
      setInitLoading(false);
    }
  };

  initGame();
}, [router]);

  const currentPlayer = players[currentIdx];
  const revealedCard = selectedCard !== null ? cards[selectedCard] : null;

  // 2. Action : Valider son choix et enregistrer en BDD
  const handleConfirm = async () => {
    if (selectedCard === null || !currentPlayer || !gameId || confirming) return;

    try {
      setConfirming(true);
      const card = cards[selectedCard];

      // INSERTION dans active_game_players (On fige le rôle en BDD maintenant)
      const { error } = await supabase.from("active_game_players").insert({
        game_id: gameId,
        player_id: currentPlayer.id,
        role: card.role,
        assigned_word: card.word || null,
        speak_order: currentIdx + 1,
        is_alive: true,
      });

      if (error) {
        console.error("Erreur BDD:", error);
        return;
      }

      // Sauvegarde du rôle réellement tiré → source de vérité pour /game/play
      const savedRoles: Record<string, Role> = JSON.parse(
        localStorage.getItem("dacovert_roles") || "{}"
      );
      savedRoles[currentPlayer.id] = card.role;
      localStorage.setItem("dacovert_roles", JSON.stringify(savedRoles));

      // Mise à jour locale
      setCards(prev => prev.map(c => c.index === selectedCard ? { ...c, takenBy: currentPlayer.id } : c));
      setSelected(null);

      if (currentIdx + 1 >= players.length) {
        setPhase("done");
      } else {
        setCurrent(prev => prev + 1);
        setPhase("handoff");
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleStartGame = async () => {
    if (startingGame) return;
    setStartingGame(true);
    // Marque le fait qu'on a commencé la phase jeu : si l'utilisateur revient ensuite sur /game/cards,
    // on doit complètement relancer l'attribution (nouveaux mots + nouveaux tirages).
    localStorage.setItem("dacovert_play_started", "true");
    router.push("/game/play");
  };

  if (initLoading || !players.length || !cards.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="font-black text-xl">Chargement des cartes...</p>
        </div>
      </div>
    );
  }

  const cfg = revealedCard ? ROLE_CONFIG[revealedCard.role] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col">
      
      {/* Overlay RÉVÉLATION */}
      {phase === "revealing" && revealedCard && cfg && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md">
          <div className={`w-full max-w-sm p-8 rounded-3xl bg-gradient-to-br ${cfg.bg} text-center shadow-2xl border border-white/20`}>
            <span className="text-7xl mb-4 block">{cfg.emoji}</span>
            <h2 className="text-white font-black text-4xl mb-2">{cfg.label}</h2>
            
            <div className="bg-black/20 rounded-2xl p-4 my-6">
              <p className="text-white/60 text-xs font-bold uppercase mb-1">Ton mot secret</p>
              <p className="text-white text-3xl font-black">{revealedCard.word || "???"}</p>
            </div>

            <p className="text-white/80 text-sm mb-8 italic">{cfg.desc}</p>

            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full bg-white text-gray-900 font-black py-4 rounded-2xl active:scale-95 transition-all"
            >
              {confirming ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                  Validation...
                </span>
              ) : (
                "C'est noté !"
              )}
            </button>
          </div>
        </div>
      )}

      <div className="max-w-md w-full mx-auto px-4 py-8 flex flex-col h-screen">
        {/* Header simple */}
        <div className="flex justify-between items-center text-white mb-8">
            <h1 className="font-black text-2xl tracking-tight">Cartes 🃏</h1>
            <div className="flex items-center gap-3">
              <div className="bg-white/20 px-4 py-1 rounded-full text-sm font-bold">
                  {currentIdx + (phase === "done" ? 1 : 0)} / {players.length}
              </div>
              <button
                onClick={() => router.push("/lobby")}
                className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-lg transition-all"
                title="Accueil"
              >
                🏠
              </button>
            </div>
        </div>

        {/* PHASES */}
        {phase === "handoff" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
            <span className="text-8xl animate-pulse">📱</span>
            <h2 className="text-white text-3xl font-black">À ton tour, {currentPlayer.nickname} !</h2>
            <p className="text-purple-100">Prends le téléphone et choisis une carte.</p>
            <button onClick={() => setPhase("choosing")} className="w-full bg-white py-4 rounded-2xl font-black text-violet-700">
              Je suis prêt
            </button>
          </div>
        )}

        {phase === "choosing" && (
          <div className="grid grid-cols-3 gap-4">
            {cards.map(card => (
              <CardTile key={card.index} card={card} phase={phase} onClick={() => {
                setSelected(card.index);
                setPhase("revealing");
              }} />
            ))}
          </div>
        )}

        {phase === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
            <span className="text-8xl">🚀</span>
            <h2 className="text-white text-3xl font-black">Prêts pour le crime ?</h2>
            <button onClick={handleStartGame} disabled={startingGame} className="w-full bg-green-400 py-5 rounded-3xl font-black text-white text-xl shadow-lg disabled:opacity-70">
              {startingGame ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Lancement...
                </span>
              ) : (
                "Lancer la partie"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}