"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.includes("@")) {
      setError("Hmm, ça ressemble pas à un email ça 🤔");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/register/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email,
          password: "temp_password_123"
        }),
      });

      const result: { success: boolean; error?: string } = await res.json();
      
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Erreur serveur");
      }

      router.push(`/register/verify?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi du code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col relative overflow-hidden">
      {/* Blobs décoratifs */}
      <div className="hidden sm:block absolute top-[-80px] right-[-80px] w-64 h-64 bg-pink-400 rounded-full opacity-30 blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute bottom-[-60px] left-[-60px] w-56 h-56 bg-yellow-300 rounded-full opacity-25 blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-16 relative z-10">
        {/* Header */}
        <div className="text-center mb-7">
          <div className="text-6xl sm:text-7xl mb-3 inline-block animate-bounce" style={{ animationDuration: "2s" }}>
            🎭
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none">
            Under<span className="text-yellow-300">cover</span>
          </h1>
          <p className="text-purple-200 mt-2 text-base sm:text-lg font-medium">
            Crée ton identité secrète !
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { n: 1, label: "Email" },
            { n: 2, label: "Code" },
            { n: 3, label: "Profil" },
          ].map(({ n, label }, idx) => (
            <div key={n} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm transition-all
                  ${n === 1 ? "bg-white text-violet-600 shadow-lg scale-110" : "bg-white/25 text-white/60"}`}>
                  {n}
                </div>
                <span className={`text-[10px] font-bold ${n === 1 ? "text-white" : "text-white/50"}`}>{label}</span>
              </div>
              {idx < 2 && <div className="w-8 sm:w-12 h-0.5 rounded-full bg-white/25 mb-3" />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-black text-gray-800">
              C'est parti !&nbsp;🎉
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Entre ton email, on t'envoie un code de confirmation
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-600">
                📧 Ton email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="ton@email.com"
                required
                autoFocus
                className={`w-full border-2 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-300 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-base
                  ${error ? "border-red-300 focus:border-red-400" : "border-gray-100 focus:border-violet-400"}`}
              />
              {error && (
                <p className="text-xs text-red-500 font-medium pt-0.5">{error}</p>
              )}
            </div>

            <p className="text-xs text-gray-400 text-center px-2">
              🔒 Fais moi confiance le s tkt
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 active:scale-95 text-white font-black text-base sm:text-lg py-4 rounded-2xl transition-all shadow-lg shadow-purple-200 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin text-xl">📨</span>
                  Envoi du code…
                </>
              ) : (
                "Recevoir mon code 📨"
              )}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-violet-600 font-black hover:text-purple-700 transition-colors">
              Connecte-toi !
            </Link>
          </p>
        </div>

        <p className="text-purple-200/70 text-xs mt-6 text-center px-4">
          🎭 Bienvenue dans le monde du bluff et de la ruse !
        </p>
      </div>
    </div>
  );
}