"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authContext";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: user, error: dbError } = await supabase
        .from("app_users")
        .select("id, email, username")
        .or(`email.eq.${identifier},username.eq.${identifier}`)
        .eq("password", password)
        .single();

      if (user && !dbError) {
        // SUCCÈS : On stocke l'ID et on redirige
      await login(user.id);
        router.push("/lobby");
        return;
      }

      // 2. ÉCHEC : Diagnostic précis pour l'utilisateur
      const { data: userExists } = await supabase
        .from("app_users")
        .select("id")
        .or(`email.eq.${identifier},username.eq.${identifier}`)
        .single();

      if (!userExists) {
        throw new Error("Identifiant inconnu (email ou pseudo) 🕵️");
      } else {
        throw new Error("Mot de passe incorrect 😬");
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col relative overflow-hidden">
      
      {/* Blobs décoratifs */}
      <div className="hidden sm:block absolute top-[-80px] left-[-80px] w-64 h-64 bg-pink-400 rounded-full opacity-30 blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute bottom-[-60px] right-[-60px] w-56 h-56 bg-yellow-300 rounded-full opacity-25 blur-3xl pointer-events-none" />

      {/* Emojis décoratifs */}
      {["🕵️", "🎭", "👀", "🤫"].map((e, i) => (
        <span
          key={i}
          aria-hidden
          className="hidden md:block absolute text-4xl opacity-15 select-none pointer-events-none animate-bounce"
          style={{
            top: `${15 + i * 18}%`,
            left: i % 2 === 0 ? "3%" : undefined,
            right: i % 2 !== 0 ? "3%" : undefined,
            animationDelay: `${i * 0.4}s`,
            animationDuration: `${2.5 + i * 0.3}s`,
          }}
        >
          {e}
        </span>
      ))}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-16 relative z-10">
        {/* Header */}
        <div className="text-center mb-7">
          <div className="text-6xl sm:text-7xl mb-3 inline-block animate-bounce" style={{ animationDuration: "2s" }}>
            🕵️
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none">
            Under<span className="text-yellow-300">cover</span>
          </h1>
          <p className="text-purple-200 mt-2 text-base sm:text-lg font-medium">
            T'es qui toi ?&nbsp;👀
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-black text-gray-800">
              Bon retour !&nbsp;👋
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Connecte-toi pour rejoindre la partie
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifiant (Email ou Pseudo) */}
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-600">
                👤 Identifiant
              </label>
              <input
                type="text" // ✅ Changé en text pour accepter les pseudos
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Pseudo ou email..."
                required
                className="w-full border-2 border-gray-100 focus:border-violet-400 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-300 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-base"
              />
            </div>

            {/* Mot de passe */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-600">
                  🔑 Mot de passe
                </label>
                <a href="#" className="text-xs text-violet-500 hover:text-violet-700 font-medium transition-colors">
                  Oublié ? 😅
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border-2 border-gray-100 focus:border-violet-400 rounded-2xl px-4 py-3 pr-12 text-gray-800 placeholder-gray-300 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xl leading-none"
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Message d'erreur */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold px-4 py-3 rounded-xl text-center animate-pulse">
                ⚠️ {error}
              </div>
            )}

            {/* Bouton Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 active:scale-95 text-white font-black text-base sm:text-lg py-4 rounded-2xl transition-all shadow-lg shadow-purple-200 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin text-xl">🎲</span>
                  Vérification…
                </>
              ) : (
                "Entrer dans la partie 🚀"
              )}
            </button>
          </form>

          {/* Lien inscription */}
          <p className="text-center text-gray-500 text-sm">
            Pas encore de compte ?{" "}
            <Link
              href="/register"
              className="text-violet-600 font-black hover:text-purple-700 transition-colors"
            >
              Rejoins-nous !&nbsp;🎉
            </Link>
          </p>
        </div>

        <p className="text-purple-200/70 text-xs mt-6 text-center px-4">
          🤫 Tout le monde ment. Sauf toi, bien sûr.
        </p>
      </div>
    </div>
  );
}