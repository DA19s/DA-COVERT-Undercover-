"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/authContext";

const PASS_RULES = [
  { label: "8 caractères minimum", test: (p: string) => p.length >= 8 },
  { label: "Une majuscule",         test: (p: string) => /[A-Z]/.test(p) },
  { label: "Un chiffre",            test: (p: string) => /\d/.test(p) },
];

function SetupPageContent() {
  const router  = useRouter();
  const params  = useSearchParams();
  const email   = params.get("email") ?? "";

  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const { login } = useAuth();
  const [confirm,  setConfirm]    = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [showConf, setShowConf]   = useState(false);
  const [loading,  setLoading]    = useState(false);
  const [errors,   setErrors]     = useState<{ username?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string>("");

  const passScore = PASS_RULES.filter((r) => r.test(password)).length;
  const strengthLabel = ["Trop faible 😬", "Pas mal 😐", "Bien ! 😊", "Parfait 💪"][passScore] ?? "";
  const strengthColor = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400"][passScore] ?? "bg-gray-100";

  const validate = () => {
    const e: typeof errors = {};
    if (username.length < 3) e.username = "Minimum 3 caractères 🙏";
    if (!/^[a-zA-Z0-9_]+$/.test(username)) e.username = "Lettres, chiffres et _ seulement 😊";
    if (confirm !== password) e.confirm = "Les mots de passe ne correspondent pas 😬";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!email) {
      setFormError("Email manquant dans l'URL. Reviens à l'étape précédente (vérification).");
      return;
    }
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/register/setup-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username: username.trim(), password }),
      });

      const result: { success: boolean; userId?: string; error?: string; code?: string } = await res.json();

      if (!res.ok || !result.success) {
        const message = result.error || "Erreur lors de la création de ton agent.";
        // cas classique: username unique
        if (result.code === "23505") {
          setErrors({ username: "Ce nom d'agent est déjà pris ! 🕵️" });
        } else {
          setFormError(message);
        }
        return;
      }

      if (result.userId) await login(result.userId);
      router.push("/lobby");

      } catch (err: any) {
        // Ceci va forcer l'affichage des détails (message, code d'erreur, etc.)
        console.error("❌ Erreur détaillée :", {
          message: err.message,
          details: err.details,
          hint: err.hint,
          code: err.code
        });
        
        if (err.code === '23505') {
          setErrors({ username: "Ce nom d'agent est déjà pris ! 🕵️" });
        } else {
          // Affiche le message à l'utilisateur pour le debug
          setFormError(err.message || "Problème de permission SQL");
        }
    } finally {
      setLoading(false);
    }
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col">
      <div className="hidden sm:block absolute top-[-80px] right-[-80px] w-64 h-64 bg-yellow-300 rounded-full opacity-25 blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute bottom-[-60px] left-[-60px] w-56 h-56 bg-pink-400 rounded-full opacity-20 blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-16">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="text-6xl sm:text-7xl mb-3 inline-block animate-bounce" style={{ animationDuration: "2s" }}>
            🎉
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none">
            Under<span className="text-yellow-300">cover</span>
          </h1>
          <p className="text-purple-200 mt-2 text-base sm:text-lg font-medium">
            Dernière étape, promis ! 🙏
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { n: 1, label: "Email",  done: true },
            { n: 2, label: "Code",   done: true },
            { n: 3, label: "Profil", done: false, active: true },
          ].map(({ n, label, done, active }, idx) => (
            <div key={n} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm transition-all
                  ${done   ? "bg-green-400 text-white scale-90" :
                    active ? "bg-white text-violet-600 shadow-lg scale-110" :
                             "bg-white/25 text-white/60"}`}>
                  {done ? "✓" : n}
                </div>
                <span className={`text-[10px] font-bold ${done || active ? "text-white" : "text-white/50"}`}>{label}</span>
              </div>
              {idx < 2 && (
                <div className={`w-8 sm:w-12 h-0.5 rounded-full mb-3 transition-all ${done ? "bg-green-400" : "bg-white/25"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5">

          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-black text-gray-800">
              Ton identité 🕵️
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Comment les autres agents vont-ils t'appeler ?
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <p className="text-center text-xs text-red-500 font-medium">{formError}</p>
            )}

            {/* Username */}
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-600">
                🎭 Nom d'agent (username)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-bold text-sm select-none">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setErrors((er) => ({ ...er, username: "" })); }}
                  placeholder="ShadowFox, Viper42…"
                  required
                  autoFocus
                  className={`w-full border-2 rounded-2xl pl-8 pr-4 py-3 text-gray-800 placeholder-gray-300 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-base
                    ${errors.username ? "border-red-300 focus:border-red-400" : "border-gray-100 focus:border-violet-400"}`}
                />
              </div>
              {errors.username
                ? <p className="text-xs text-red-500 font-medium">{errors.username}</p>
                : username.length >= 3 && (
                    <p className="text-xs text-green-500 font-medium">✅ Disponible !</p>
                  )
              }
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-600">
                🔑 Mot de passe
              </label>
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
                  aria-label={showPass ? "Masquer" : "Afficher"}
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>

              {/* Règles de sécurité */}
              {password.length > 0 && (
                <div className="space-y-2 pt-1">
                  {/* Barre force */}
                  <div className="flex gap-1">
                    {[0,1,2].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${i < passScore ? strengthColor : "bg-gray-100"}`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs font-bold ${["text-red-500","text-orange-500","text-yellow-600","text-green-500"][passScore] ?? ""}`}>
                    {strengthLabel}
                  </p>
                  {/* Checklist */}
                  <ul className="space-y-1">
                    {PASS_RULES.map((rule) => (
                      <li key={rule.label} className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${rule.test(password) ? "text-green-500" : "text-gray-300"}`}>
                        <span>{rule.test(password) ? "✅" : "⬜"}</span>
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-600">
                🔒 Confirme le mot de passe
              </label>
              <div className="relative">
                <input
                  type={showConf ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setErrors((er) => ({ ...er, confirm: "" })); }}
                  placeholder="••••••••"
                  required
                  className={`w-full border-2 rounded-2xl px-4 py-3 pr-12 text-gray-800 placeholder-gray-300 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-base
                    ${errors.confirm
                      ? "border-red-300 focus:border-red-400"
                      : confirm && confirm === password
                      ? "border-green-300 focus:border-green-400"
                      : "border-gray-100 focus:border-violet-400"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConf(!showConf)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xl leading-none"
                  aria-label={showConf ? "Masquer" : "Afficher"}
                >
                  {showConf ? "🙈" : "👁️"}
                </button>
              </div>
              {errors.confirm && (
                <p className="text-xs text-red-500 font-medium">{errors.confirm}</p>
              )}
              {!errors.confirm && confirm && confirm === password && (
                <p className="text-xs text-green-500 font-medium">✅ Parfait !</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 active:scale-95 text-white font-black text-base sm:text-lg py-4 rounded-2xl transition-all shadow-lg shadow-purple-200 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin text-xl">🎲</span>
                  Création de ton agent…
                </>
              ) : (
                "Créer mon agent 🎉"
              )}
            </button>
          </form>

          <p className="text-center text-gray-400 text-xs pt-1">
            En créant un compte tu acceptes les{" "}
            <a href="#" className="text-violet-500 font-bold hover:underline">CGU</a>
            {" "}et la{" "}
            <a href="#" className="text-violet-500 font-bold hover:underline">politique de confidentialité</a>.
          </p>
        </div>

        <p className="text-purple-200/70 text-xs mt-6 text-center px-4">
          🎭 Ton identité sera protégée. Enfin, on espère 😅
        </p>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="text-6xl mb-4 animate-pulse">🎉</div>
            <p className="font-black text-xl">Chargement…</p>
          </div>
        </div>
      }
    >
      <SetupPageContent />
    </Suspense>
  );
}