"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!identifier.trim()) {
      setError("Entre ton email ou pseudo.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/forgot-password/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const result: { success: boolean; error?: string } = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Impossible d'envoyer le code.");
      }
      setSuccess("Code envoye. Verifie ton email.");
      setStep(2);
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'envoi du code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (code.trim().length !== 6) {
      setError("Le code doit contenir 6 chiffres.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          code: code.trim(),
          newPassword,
        }),
      });
      const result: { success: boolean; error?: string } = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Impossible de reinitialiser le mot de passe.");
      }
      setSuccess("Mot de passe modifie avec succes.");
      setTimeout(() => router.push("/login"), 700);
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la reinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col relative overflow-hidden">
      <div className="hidden sm:block absolute top-[-80px] left-[-80px] w-64 h-64 bg-cyan-400 rounded-full opacity-25 blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute bottom-[-60px] right-[-60px] w-56 h-56 bg-pink-400 rounded-full opacity-20 blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-16 relative z-10">
        <div className="text-center mb-7">
          <div className="text-6xl sm:text-7xl mb-3 inline-block animate-bounce" style={{ animationDuration: "2s" }}>
            🔐
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none">
            DA-<span className="text-yellow-300">COVERT</span>
          </h1>
          <p className="text-purple-200 mt-2 text-base sm:text-lg font-medium">
            Mot de passe oublie
          </p>
        </div>

        <div className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-black text-gray-800">
              Recuperation du compte
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {step === 1
                ? "On t'envoie un code de reinitialisation."
                : "Entre le code recu et ton nouveau mot de passe."}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-600">Email ou pseudo</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Pseudo ou email..."
                  required
                  className="w-full border-2 border-gray-100 focus:border-violet-400 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-300 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-base"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 active:scale-95 text-white font-black text-base sm:text-lg py-4 rounded-2xl transition-all shadow-lg shadow-purple-200 disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Envoi...
                  </span>
                ) : (
                  "Envoyer le code"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-600">Code (6 chiffres)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  required
                  className="w-full border-2 border-gray-100 focus:border-violet-400 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-300 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-base"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-600">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border-2 border-gray-100 focus:border-violet-400 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-300 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-base"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-600">Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border-2 border-gray-100 focus:border-violet-400 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-300 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-base"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 active:scale-95 text-white font-black text-base sm:text-lg py-4 rounded-2xl transition-all shadow-lg shadow-purple-200 disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Verification...
                  </span>
                ) : (
                  "Reinitialiser le mot de passe"
                )}
              </button>
            </form>
          )}

          {error && (
            <p className="text-xs text-red-500 font-medium text-center">{error}</p>
          )}
          {success && (
            <p className="text-xs text-emerald-600 font-medium text-center">{success}</p>
          )}

          <p className="text-center text-gray-500 text-sm">
            Retour a{" "}
            <Link href="/login" className="text-violet-600 font-black hover:text-purple-700 transition-colors">
              la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
