"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/context/authContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = "Civil" | "Undercover" | "Mister White";
type Phase = "round" | "voting" | "reveal" | "mw_guess" | "gameover";
type Winner = "civil" | "undercover" | "misterwhite";

type GamePlayer = {
  id: string;           // active_game_players.id (PK)
  player_id: string;    // players.id (FK)
  nickname: string;
  role: Role;
  assigned_word: string | null;
  speak_order: number;
  is_alive: boolean;
};
type SessionPlayer = {
  player_id: string;
  nickname: string;
  totalPoints: number;
  wins: number;
  gamesPlayed: number;
};
type SessionData = {
  sessionId?: string;
  creator_id?: string;
  startedAt?: number;
  gamesPlayed: number;
  gameIds?: string[];
  players: SessionPlayer[];
};

// ─── Config visuelle des rôles ────────────────────────────────────────────────
const ROLE_CFG: Record<
  Role,
  { emoji: string; label: string; textColor: string; bg: string; border: string; gradient: string }
> = {
  Civil: {
    emoji: "👤", label: "Civil",
    textColor: "text-emerald-700", bg: "bg-emerald-100", border: "border-emerald-200",
    gradient: "from-emerald-500 to-teal-600",
  },
  Undercover: {
    emoji: "🕵️", label: "DA-COVERT",
    textColor: "text-rose-700", bg: "bg-rose-100", border: "border-rose-200",
    gradient: "from-rose-500 to-pink-600",
  },
  "Mister White": {
    emoji: "👻", label: "Mister White",
    textColor: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200",
    gradient: "from-slate-500 to-gray-700",
  },
};

// ─── Rôle gagnant par type de victoire ───────────────────────────────────────
const WINNER_ROLE: Record<Winner, Role> = {
  civil:       "Civil",
  undercover:  "Undercover",
  misterwhite: "Mister White",
};

const POINTS_WIN  = 3;
const POINTS_LOSE = 0;

// ─── Config visuelle des victoires ────────────────────────────────────────────
const WIN_CFG: Record<Winner, { emoji: string; title: string; desc: string; gradient: string }> = {
  civil: {
    emoji: "👤",
    title: "Victoire des Civils !",
    desc: "Tous les imposteurs ont été démasqués. La vérité triomphe !",
    gradient: "from-emerald-500 to-teal-600",
  },
  undercover: {
    emoji: "🕵️",
    title: "Victoire des DA-COVERT !",
    desc: "Les espions ont semé la confusion. Les civils sont trop isolés pour résister...",
    gradient: "from-rose-500 to-pink-600",
  },
  misterwhite: {
    emoji: "👻",
    title: "Victoire de Mister White !",
    desc: "Le fantôme a su survivre dans l'ombre… ou a deviné le mot !",
    gradient: "from-slate-500 to-gray-700",
  },
};

// ─── Page principale ──────────────────────────────────────────────────────────
export default function GamePlayPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [gameId, setGameId]                       = useState<string | null>(null);
  const [civilWord, setCivilWord]                 = useState("");
  const [allPlayers, setAllPlayers]               = useState<GamePlayer[]>([]);
  const [round, setRound]                         = useState(1);
  const [phase, setPhase]                         = useState<Phase>("round");
  const [selectedId, setSelectedId]               = useState<string | null>(null);
  const [eliminatedPlayer, setEliminatedPlayer]   = useState<GamePlayer | null>(null);
  const [guessInput, setGuessInput]               = useState("");
  const [guessResult, setGuessResult]             = useState<"wrong" | null>(null);
  const [winner, setWinner]                       = useState<Winner | null>(null);
  const [roundOrder, setRoundOrder]               = useState<string[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [terminating, setTerminating]             = useState(false);
  const [eliminating, setEliminating]             = useState(false);
  const [progressing, setProgressing]             = useState(false);
  const [replaying, setReplaying]                 = useState(false);

  // ── Helper mélange ────────────────────────────────────────────────────────────
  const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

  // ── Init : chargement des données ────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const raw = localStorage.getItem("dacovert_setup");
      if (!raw) { router.replace("/game/setup/players"); return; }

      const parsed = JSON.parse(raw);
      const gId = parsed.gameId;
      if (!gId) { router.replace("/game/setup/players"); return; }
      setGameId(gId);

      // Map nickname depuis localStorage (fallback si la jointure échoue)
      const nicknameMap: Record<string, string> = {};
      (parsed.players || []).forEach((p: any) => {
        nicknameMap[p.id] = p.nickname;
      });

      // Mots du jeu
      const { data: gameData } = await supabase
        .from("active_games")
        .select("civil_word, current_round, game_status")
        .eq("id", gId)
        .single();

      if (gameData) {
        setCivilWord(gameData.civil_word ?? "");
        setRound(gameData.current_round ?? 1);
      }

      // Joueurs de la partie
      const { data: gamePlayers, error } = await supabase
        .from("active_game_players")
        .select("id, player_id, role, assigned_word, speak_order, is_alive")
        .eq("game_id", gId)
        .order("speak_order");

      if (error || !gamePlayers) { setLoading(false); return; }

      // Dédoublonnage par player_id :
      // On prend la DERNIÈRE entrée (la plus récente = celle de cards/page,
      // qui contient le rôle que le joueur a réellement tiré).
      const seen = new Set<string>();
      const deduped = [...gamePlayers]
        .reverse()
        .filter((gp: any) => {
          if (seen.has(gp.player_id)) return false;
          seen.add(gp.player_id);
          return true;
        })
        .reverse();

      const VALID_ROLES: Role[] = ["Civil", "Undercover", "Mister White"];
      const isRole = (value: unknown): value is Role =>
        typeof value === "string" &&
        (VALID_ROLES as string[]).includes(value);

      // Source de vérité : rôles réellement tirés lors de la distribution des cartes
      const rolesOverride: Record<string, string> = JSON.parse(
        localStorage.getItem("dacovert_roles") || "{}"
      );

      const loaded: GamePlayer[] = deduped.map((gp: any) => {
        const overrideRole = rolesOverride[gp.player_id];
        const dbRole       = gp.role;
        const finalRole    = isRole(overrideRole)
          ? overrideRole
          : isRole(dbRole)
            ? dbRole
            : "Civil";
        return {
          id: gp.id,
          player_id: gp.player_id,
          nickname: nicknameMap[gp.player_id] ?? `Joueur ${gp.speak_order}`,
          role: finalRole,
          assigned_word: gp.assigned_word,
          speak_order: gp.speak_order,
          is_alive: gp.is_alive,
        };
      });

      setAllPlayers(loaded);
      // Ordre de passage du 1er round : mélange aléatoire des joueurs en vie
      setRoundOrder(shuffle(loaded.filter(p => p.is_alive).map(p => p.id)));

      // Si la partie est terminée (refresh), on doit retomber sur l'écran gameover.
      // On privilégie la source locale (utile pour le cas devinette),
      // sinon on recalcule à partir des alive.
      if (typeof gameData?.game_status === "string" && gameData.game_status.startsWith("finished")) {
        try {
          const rawOver = localStorage.getItem("dacovert_gameover");
          const over = rawOver ? JSON.parse(rawOver) : null;
          if (over?.gameId === gId && over?.winner) {
            setWinner(over.winner as Winner);
            setPhase("gameover");
          } else {
            const computed = checkWin(loaded);
            if (computed) {
              setWinner(computed);
              setPhase("gameover");
            }
          }
        } catch {
          // Fallback: rien à faire, on affichera l'écran "round" si on ne peut pas déterminer.
        }
      }

      setLoading(false);
    };

    init();
  }, [router]);

  // ── Dérivés ───────────────────────────────────────────────────────────────────
  const alivePlayers = allPlayers.filter(p => p.is_alive);
  const deadPlayers  = allPlayers.filter(p => !p.is_alive);
  const selectedPlayer = selectedId ? allPlayers.find(p => p.id === selectedId) : null;

  // Joueurs vivants dans l'ordre de parole du round (mélangé à chaque round)
  const orderedAlivePlayers = roundOrder
    .map(id => allPlayers.find(p => p.id === id && p.is_alive))
    .filter(Boolean) as GamePlayer[];

  // ── Vérification des conditions de victoire ───────────────────────────────────
  const checkWin = (players: GamePlayer[]): Winner | null => {
    const alive   = players.filter(p => p.is_alive);
    const uc      = alive.filter(p => p.role === "Undercover").length;
    const mw      = alive.filter(p => p.role === "Mister White").length;
    const civil   = alive.filter(p => p.role === "Civil").length;
    const total   = alive.length;

    // Mister White survie : il ne reste que 2 joueurs et l'un est MW
    if (total <= 2 && mw >= 1) return "misterwhite";
    // Civils : tous les UC et MW éliminés
    if (uc === 0 && mw === 0) return "civil";
    // Undercover : plus assez de civils pour voter (≤ 1 civil, pas de MW)
    if (civil <= 1 && mw === 0) return "undercover";

    return null;
  };

  // ── Actions ───────────────────────────────────────────────────────────────────
  const handleEliminate = async () => {
    if (!selectedId || !gameId || eliminating) return;
    const player = allPlayers.find(p => p.id === selectedId);
    if (!player) return;

    try {
      setEliminating(true);
      await supabase
        .from("active_game_players")
        .update({ is_alive: false })
        .eq("id", selectedId);

      const updated = allPlayers.map(p =>
        p.id === selectedId ? { ...p, is_alive: false } : p
      );
      setAllPlayers(updated);
      setEliminatedPlayer(player);
      setSelectedId(null);
      setPhase("reveal");
    } finally {
      setEliminating(false);
    }
  };

  const handleAfterReveal = async () => {
    if (progressing) return;
    if (!eliminatedPlayer) return;
    if (eliminatedPlayer.role === "Mister White") {
      setGuessInput("");
      setGuessResult(null);
      setPhase("mw_guess");
    } else {
      setProgressing(true);
      const w = checkWin(allPlayers);
      if (w) triggerGameOver(w);
      else   await goNextRound();
      setProgressing(false);
    }
  };

  const handleMWGuess = async () => {
    if (progressing) return;
    const guess  = guessInput.trim().toLowerCase();
    const target = civilWord.trim().toLowerCase();
    if (!guess) return;

    setProgressing(true);
    if (guess === target) {
      await triggerGameOver("misterwhite");
      setProgressing(false);
    } else {
      setGuessResult("wrong");
      const w = checkWin(allPlayers);
      setTimeout(async () => {
        if (w) await triggerGameOver(w);
        else   await goNextRound();
        setProgressing(false);
      }, 2000);
    }
  };

  const handleMWPass = async () => {
    if (progressing) return;
    setProgressing(true);
    const w = checkWin(allPlayers);
    if (w) await triggerGameOver(w);
    else   await goNextRound();
    setProgressing(false);
  };

  const goNextRound = async () => {
    const next = round + 1;
    setRound(next);
    setEliminatedPlayer(null);
    setGuessInput("");
    setGuessResult(null);
    // Recalcul de l'ordre pour le prochain round (allPlayers déjà mis à jour par handleEliminate)
    const aliveIds = allPlayers.filter(p => p.is_alive).map(p => p.id);
    setRoundOrder(shuffle(aliveIds));
    if (gameId) {
      await supabase
        .from("active_games")
        .update({ current_round: next })
        .eq("id", gameId);
    }
    setPhase("round");
  };

  const triggerGameOver = async (w: Winner) => {
    setWinner(w);
    setPhase("gameover");

    // Persist pour garder le même écran après refresh (cas devinette incluse).
    try {
      if (gameId) {
        localStorage.setItem(
          "dacovert_gameover",
          JSON.stringify({ gameId, winner: w, round })
        );
      }
    } catch {
      // ignore
    }

    if (gameId) {
      await supabase
        .from("active_games")
        .update({ game_status: `finished_${w}` })
        .eq("id", gameId);
    }

    // ── Cumul SESSION: plusieurs replays => un seul game_results à "Terminer" ──
    try {
      const rawSession = localStorage.getItem("dacovert_session");
      if (!rawSession) return;

      // Anti double-comptage de la même game (double clic / refresh)
      if (gameId) {
        const alreadyScored = localStorage.getItem(`dacovert_scored_${gameId}`);
        if (alreadyScored === "true") return;
      }

      const session = JSON.parse(rawSession) as SessionData;
      const winningRole = WINNER_ROLE[w];
      const winnerIds = new Set(
        allPlayers.filter((p) => p.role === winningRole).map((p) => p.player_id)
      );

      const playersArr: SessionPlayer[] = Array.isArray(session.players) ? session.players : [];
      const playersById = new Map<string, SessionPlayer>(
        playersArr.map((p) => [p.player_id, p])
      );

      const participantIds = Array.from(new Set(allPlayers.map((p) => p.player_id)));
      for (const pid of participantIds) {
        const sp = playersById.get(pid);
        if (!sp) continue;
        sp.gamesPlayed = Number(sp.gamesPlayed ?? 0) + 1;
        if (winnerIds.has(pid)) {
          sp.wins = Number(sp.wins ?? 0) + 1;
          sp.totalPoints = Number(sp.totalPoints ?? 0) + POINTS_WIN;
        } else {
          sp.totalPoints = Number(sp.totalPoints ?? 0) + POINTS_LOSE;
        }
      }

      session.gamesPlayed = Number(session.gamesPlayed ?? 0) + 1;

      if (!Array.isArray(session.gameIds)) session.gameIds = [];
      if (gameId && !session.gameIds.includes(gameId)) {
        session.gameIds.push(gameId);
      }

      localStorage.setItem("dacovert_session", JSON.stringify(session));

      if (gameId) {
        localStorage.setItem(`dacovert_scored_${gameId}`, "true");
      }
    } catch {
      // ignore
    }
  };

  const handleReplay = () => {
    if (replaying) return;
    setReplaying(true);
    try {
      localStorage.removeItem("dacovert_gameover");
      localStorage.setItem("dacovert_play_started", "true");
      if (gameId) {
        localStorage.removeItem(`dacovert_terminated_${gameId}`);
        localStorage.removeItem(`dacovert_scored_${gameId}`);
      }
    } catch {
      // ignore
    }
    router.push("/game/cards");
  };

  const handleTerminate = async () => {
    if (terminating) return;
    if (!user) {
      alert("Non connecté : impossible de terminer la session.");
      return;
    }

    if (gameId) {
      const already = localStorage.getItem(`dacovert_terminated_${gameId}`);
      if (already === "true") {
        alert("Cette partie a déjà été terminée (double clic détecté).");
        return;
      }
    }

    // Verrouillage optimiste : empêche les doubles inserts même si le réseau est lent.
    if (gameId) {
      try {
        localStorage.setItem(`dacovert_terminated_${gameId}`, "true");
      } catch {
        // ignore
      }
    }
    setTerminating(true);

    // On enregistre UNE SEULE session (plusieurs replays cumulés)
    const rawSession = localStorage.getItem("dacovert_session");
    if (!rawSession) {
      alert("Session introuvable : impossible de terminer.");
      setTerminating(false);
      return;
    }

    try {
      const session = JSON.parse(rawSession) as SessionData;
      const sessionPlayers: SessionPlayer[] = Array.isArray(session.players) ? session.players : [];
      const nbGames = Number(session.gamesPlayed ?? 0);

      // 1) Créer un résultat pour LA SESSION
      const { data: gr, error: grError } = await supabase
        .from("game_results")
        .insert({
          creator_id: user.id,
          nb_games: nbGames,
        })
        .select()
        .single();

      if (grError) throw grError;
      if (!gr) throw new Error("Impossible de créer game_results");

      // 2) Insérer les joueurs de la session (game_result_players)
      const toInsert = sessionPlayers.map((p: any) => ({
        game_result_id: gr.id,
        player_id: p.player_id,
        nickname: p.nickname,
        total_points: Number(p.totalPoints ?? 0),
        wins: Number(p.wins ?? 0),
        games_played: Number(p.gamesPlayed ?? 0),
      }));

      if (toInsert.length > 0) {
        const { error: grpError } = await supabase
          .from("game_result_players")
          .insert(toInsert);
        if (grpError) throw grpError;
      }

      // 3) Mettre à jour le classement global dans `players.total_points`
      const playerIds = sessionPlayers.map((p: any) => p.player_id);
      if (playerIds.length > 0) {
        const { data: currentPlayers } = await supabase
          .from("players")
          .select("id, total_points")
          .in("id", playerIds);

        const currentById = new Map(
          (currentPlayers ?? []).map((p: any) => [p.id, p.total_points ?? 0])
        );

        for (const p of sessionPlayers) {
          const prev = currentById.get(p.player_id) ?? 0;
          const add = Number(p.totalPoints ?? 0);
          await supabase
            .from("players")
            .update({ total_points: prev + add })
            .eq("id", p.player_id);
        }
      }

      // 4) Nettoyage + redirection
      localStorage.removeItem("dacovert_session");
      localStorage.removeItem("dacovert_gameover");
      localStorage.removeItem("dacovert_play_started");
      localStorage.removeItem("dacovert_roles");
      router.push("/game/history");
    } catch (e) {
      console.error("Erreur Terminer:", e);
      if (gameId) {
        try {
          localStorage.removeItem(`dacovert_terminated_${gameId}`);
        } catch {
          // ignore
        }
      }
      alert("Impossible de terminer la session. Vérifie la structure des tables Supabase.");
    } finally {
      setTerminating(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="font-black text-xl">Chargement de la partie...</p>
        </div>
      </div>
    );
  }

  // ── Game Over ─────────────────────────────────────────────────────────────────
  if (phase === "gameover" && winner) {
    const wcfg = WIN_CFG[winner];
    return (
      <div className={`min-h-screen bg-gradient-to-br ${wcfg.gradient} flex flex-col`}>
        <div className="flex-1 flex flex-col max-w-md w-full mx-auto px-4 py-8 gap-6">

          {/* En-tête victoire */}
          <div className="text-center pt-6">
            <div className="text-8xl mb-4 animate-bounce">{wcfg.emoji}</div>
            <h1 className="text-white font-black text-3xl mb-2">{wcfg.title}</h1>
            <p className="text-white/70 text-sm leading-relaxed">{wcfg.desc}</p>
          </div>

          {/* Récap des rounds */}
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-4 py-3 flex items-center justify-center gap-2">
            <span className="text-white/60 text-sm font-bold">Partie terminée en</span>
            <span className="text-white font-black text-lg">{round} round{round > 1 ? "s" : ""}</span>
          </div>

          {/* Révélation des rôles — gagnants puis perdants */}
          {(() => {
            const winningRole = WINNER_ROLE[winner];
            const winners = allPlayers.filter(p => p.role === winningRole);
            const losers  = allPlayers.filter(p => p.role !== winningRole);

            const PlayerRow = ({ p, isWinner }: { p: GamePlayer; isWinner: boolean }) => {
              const rc = ROLE_CFG[p.role];
              return (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${
                  isWinner ? "bg-white/25" : "bg-white/5"
                }`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                    isWinner ? "bg-white/30 text-white" : "bg-white/10 text-white/30"
                  }`}>
                    {isWinner ? "🏆" : p.nickname.charAt(0).toUpperCase()}
                  </div>
                  <span className={`flex-1 font-bold text-sm ${
                    isWinner ? "text-white" : "text-white/40 line-through"
                  }`}>
                    {p.nickname}
                  </span>
                  <span className={`text-xs font-black px-2 py-1 rounded-xl border ${rc.bg} ${rc.textColor} ${rc.border}`}>
                    {rc.emoji} {rc.label}
                  </span>
                  <span className={`text-xs font-black px-2 py-1 rounded-xl ${
                    isWinner
                      ? "bg-yellow-300 text-yellow-900"
                      : "bg-white/10 text-white/30"
                  }`}>
                    {isWinner ? `+${POINTS_WIN} pts` : `+${POINTS_LOSE} pt`}
                  </span>
                </div>
              );
            };

            return (
              <div className="space-y-3">
                {/* Gagnants */}
                <div className="bg-white/10 backdrop-blur border border-white/20 rounded-3xl p-5 space-y-2">
                  <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                    🏆 Gagnants
                  </p>
                  {winners.map(p => <PlayerRow key={p.id} p={p} isWinner={true} />)}
                </div>

                {/* Perdants */}
                {losers.length > 0 && (
                  <div className="bg-white/10 backdrop-blur border border-white/20 rounded-3xl p-5 space-y-2">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                      💀 Perdants
                    </p>
                    {losers.map(p => <PlayerRow key={p.id} p={p} isWinner={false} />)}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Boutons */}
          <div className="flex flex-col gap-3 pb-4 sm:flex-row">
            <button
              onClick={handleReplay}
              disabled={replaying}
              className="flex-1 bg-white text-gray-900 font-black py-4 rounded-2xl active:scale-95 transition-all shadow-lg disabled:opacity-70"
            >
              {replaying ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                  Rejouer...
                </span>
              ) : (
                "Rejouer 🔄"
              )}
            </button>
            <button
              onClick={handleTerminate}
              className="flex-1 bg-white/20 border border-white/30 text-white font-black py-4 rounded-2xl active:scale-95 transition-all"
              disabled={terminating}
            >
              {terminating ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Terminaison...
                </span>
              ) : (
                "Terminer 🏁"
              )}
            </button>
            <button
              onClick={() => router.push("/lobby")}
              className="flex-1 bg-white/20 border border-white/30 text-white font-black py-4 rounded-2xl active:scale-95 transition-all"
            >
              Accueil 🏠
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Jeu principal ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col">

      {/* ── Overlay RÉVÉLATION ──────────────────────────────────────── */}
      {phase === "reveal" && eliminatedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md">
          <div className={`w-full max-w-sm bg-gradient-to-br ${ROLE_CFG[eliminatedPlayer.role].gradient} rounded-3xl p-8 text-center shadow-2xl border border-white/20`}>
            <div className="text-7xl mb-3">{ROLE_CFG[eliminatedPlayer.role].emoji}</div>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Éliminé ce round !</p>
            <h2 className="text-white font-black text-3xl mb-5">{eliminatedPlayer.nickname}</h2>

            <div className="bg-black/20 rounded-2xl p-4">
              <p className="text-white/60 text-xs font-bold uppercase mb-1">Son rôle</p>
              <p className="text-white font-black text-xl">
                {ROLE_CFG[eliminatedPlayer.role].emoji} {ROLE_CFG[eliminatedPlayer.role].label}
              </p>
            </div>

            {eliminatedPlayer.role === "Mister White" && (
              <p className="text-white/80 text-sm italic mt-4 mb-2">
                Il peut tenter de deviner le mot des Civils...
              </p>
            )}

            <button
              onClick={handleAfterReveal}
              disabled={progressing}
              className="w-full bg-white text-gray-900 font-black py-4 rounded-2xl active:scale-95 transition-all mt-5"
            >
              {progressing ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                  Chargement...
                </span>
              ) : (
                eliminatedPlayer.role === "Mister White" ? "Passer à la devinette →" : "Continuer →"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Overlay DEVINETTE MISTER WHITE ──────────────────────────── */}
      {phase === "mw_guess" && eliminatedPlayer && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/90 backdrop-blur-md">
          <div className="relative bg-white rounded-t-3xl p-6 flex flex-col gap-4 shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1 mb-1" />

            {/* Header */}
            <div className="text-center">
              <span className="text-5xl">👻</span>
              <h3 className="font-black text-gray-800 text-xl mt-2">Chance de Mister White !</h3>
              <p className="text-gray-500 text-sm mt-1">
                <span className="font-bold text-gray-700">{eliminatedPlayer.nickname}</span>{" "}
                peut tenter de deviner le mot des Civils.
              </p>
            </div>

            {/* Résultat mauvaise réponse */}
            {guessResult === "wrong" ? (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 text-center">
                <p className="text-red-500 font-black text-2xl">❌</p>
                <p className="text-red-600 font-black text-lg mt-1">Mauvaise réponse !</p>
                <p className="text-red-400 text-sm mt-1">Les Civils continuent leur route...</p>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={guessInput}
                  onChange={e => setGuessInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleMWGuess()}
                  placeholder="Quel est le mot des Civils ?"
                  className="w-full border-2 border-gray-100 focus:border-slate-400 rounded-2xl px-4 py-4 text-gray-800 placeholder-gray-300 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-base"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleMWPass}
                    disabled={progressing}
                    className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-4 rounded-2xl active:scale-95 transition-all"
                  >
                    {progressing ? "..." : "Passer →"}
                  </button>
                  <button
                    onClick={handleMWGuess}
                    disabled={!guessInput.trim() || progressing}
                    className="flex-1 bg-gradient-to-r from-slate-500 to-gray-600 disabled:opacity-40 text-white font-black py-4 rounded-2xl active:scale-95 transition-all"
                  >
                    {progressing ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Verification...
                      </span>
                    ) : (
                      "Deviner ✅"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Overlay VOTE ────────────────────────────────────────────── */}
      {phase === "voting" && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => { setPhase("round"); setSelectedId(null); }}
          />
          <div className="relative bg-white rounded-t-3xl p-6 max-h-[82vh] flex flex-col gap-4 shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1 mb-1" />

            <div>
              <h3 className="font-black text-gray-800 text-lg">Qui est éliminé ? 🗳️</h3>
              <p className="text-gray-400 text-sm">Round {round} — Sélectionne un joueur à éliminer</p>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2">
              {alivePlayers.map(p => {
                const isSelected = selectedId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(isSelected ? null : p.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                      isSelected
                        ? "border-red-400 bg-red-50"
                        : "border-gray-100 hover:border-red-200 bg-white"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0 transition-all ${
                      isSelected ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"
                    }`}>
                      {isSelected ? "✕" : p.nickname.charAt(0).toUpperCase()}
                    </div>
                    <span className={`flex-1 font-bold text-sm ${isSelected ? "text-red-700" : "text-gray-800"}`}>
                      {p.nickname}
                    </span>
                    {isSelected && (
                      <span className="text-red-400 text-xs font-black uppercase tracking-wide">Sélectionné</span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleEliminate}
              disabled={!selectedId || eliminating}
              className="w-full bg-gradient-to-r from-red-500 to-rose-600 disabled:opacity-40 active:scale-95 text-white font-black py-4 rounded-2xl transition-all"
            >
              {eliminating ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Elimination...
                </span>
              ) : (
                selectedPlayer ? `Éliminer ${selectedPlayer.nickname} ✕` : "Sélectionne un joueur"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Écran ROUND ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col max-w-md w-full mx-auto px-4 py-6 sm:py-10 gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-lg transition-all"
            >
              ←
            </button>
            <div>
              <h1 className="text-white font-black text-xl">Round {round} 🎮</h1>
              <p className="text-purple-200 text-xs font-medium">
                {alivePlayers.length} joueur{alivePlayers.length > 1 ? "s" : ""} en vie
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Compteur total */}
            <div className="bg-white/10 border border-white/20 px-4 py-2 rounded-2xl">
              <p className="text-white font-black text-sm leading-none">{alivePlayers.length}</p>
              <p className="text-white/50 text-[10px]">en vie</p>
            </div>

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

        {/* Joueurs en vie */}
        <div className="bg-white rounded-3xl shadow-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-gray-800 text-base">Joueurs en vie 🟢</h2>
            <span className="text-sm font-black px-3 py-1 rounded-xl bg-violet-100 text-violet-700">
              {alivePlayers.length}
            </span>
          </div>

          <div className="space-y-2">
            {orderedAlivePlayers.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-black text-sm shrink-0">
                  {idx + 1}
                </div>
                <span className="flex-1 font-bold text-gray-800 text-sm">{p.nickname}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Joueurs éliminés */}
        {deadPlayers.length > 0 && (
          <div className="bg-white/10 border border-white/20 rounded-3xl p-5 space-y-3">
            <h2 className="font-bold text-white/60 text-sm">Éliminés 💀</h2>
            <div className="space-y-2">
              {deadPlayers.map(p => {
                const cfg = ROLE_CFG[p.role];
                return (
                  <div key={p.id} className="flex items-center gap-3 opacity-60">
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white/50 font-black text-sm shrink-0">
                      💀
                    </div>
                    <span className="flex-1 font-bold text-white/50 text-sm line-through">{p.nickname}</span>
                    <span className={`text-xs font-black px-2 py-1 rounded-xl border ${cfg.bg} ${cfg.textColor} ${cfg.border}`}>
                      {cfg.emoji} {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bouton vote */}
        <button
          onClick={() => setPhase("voting")}
          className="w-full bg-white hover:bg-gray-50 active:scale-95 text-violet-700 font-black text-lg py-4 rounded-3xl transition-all shadow-xl shadow-purple-900/20 flex items-center justify-center gap-2"
        >
          🗳️ Voter pour éliminer →
        </button>

        <p className="text-center text-purple-200/60 text-xs pb-2">
          Discutez, puis votez pour éliminer un suspect 🕵️
        </p>
      </div>
    </div>
  );
}
