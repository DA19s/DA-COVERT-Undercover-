"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
function VerifyPageContent() {
  const router       = useRouter();
  const params       = useSearchParams();
  const email        = params.get("email") ?? "";

  const [code, setCode]       = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [resent, setResent]   = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Compte à rebours pour renvoyer le code
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (idx: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1); // chiffres seulement
    const next = [...code];
    next[idx] = char;
    setCode(next);
    setError("");
    if (char && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      inputs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.join("").length < 6) { setError("Entre les 6 chiffres du code 😊"); return; }
    setLoading(true);

    try {
      const res = await fetch("/register/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.join("") }),
      });

      const result: { success: boolean; error?: string; alreadyVerified?: boolean } = await res.json();

      if (!res.ok || !result.success) {
        setError(result.error || "Une erreur est survenue lors de la vérification.");
        return;
      }

      // déjà vérifié ou validation OK -> étape suivante
      if (result.success) {
        router.push(`/register/setup?email=${encodeURIComponent(email)}`);
      }
    }
    catch (err: any) {
    setError(err?.message || "Une erreur est survenue lors de la vérification.");
  } finally {
    setLoading(false);
  }
  };

  const handleResend = async () => {

  setError("");
  setLoading(true);

  try {
    // Appel serveur via route handler Next (évite d'importer du code "use server" côté client)
    const res = await fetch("/register/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const result: { success: boolean; error?: string } = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || "Erreur serveur");

  } catch (err: any) {
    setError("Erreur lors de l'envoi du code.");
  } finally {
    setLoading(false);
  }
}

  const filled = code.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex flex-col">
      <div className="hidden sm:block absolute top-[-80px] left-[-80px] w-64 h-64 bg-cyan-400 rounded-full opacity-25 blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute bottom-[-60px] right-[-60px] w-56 h-56 bg-pink-400 rounded-full opacity-20 blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-16">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="text-6xl sm:text-7xl mb-3 inline-block animate-bounce" style={{ animationDuration: "2s" }}>
            📨
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none">
            DA-<span className="text-yellow-300">COVERT</span>
          </h1>
          <p className="text-purple-200 mt-2 text-base sm:text-lg font-medium">
            Vérifie ton email !
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { n: 1, label: "Email", done: true },
            { n: 2, label: "Code",  done: false, active: true },
            { n: 3, label: "Profil", done: false },
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
        <div className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">

          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-gray-800">
              Code secret 🔐
            </h2>
            <p className="text-gray-400 text-sm">
              On a envoyé un code à
            </p>
            <p className="text-violet-600 font-black text-sm break-all">{email}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Inputs OTP */}
            <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
              {code.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className={`w-11 h-14 sm:w-13 sm:h-16 text-center text-2xl font-black border-2 rounded-2xl outline-none transition-all
                    ${digit
                      ? "border-violet-400 bg-violet-50 text-violet-700 scale-105"
                      : "border-gray-100 bg-gray-50 text-gray-800"
                    }
                    focus:border-violet-400 focus:bg-violet-50 focus:scale-105`}
                  style={{ fontSize: "1.5rem" }}
                />
              ))}
            </div>

            {/* Barre de progression */}
            <div className="flex gap-1">
              {[0,1,2,3,4,5].map((i) => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-full transition-all duration-300 ${i < filled ? "bg-violet-500" : "bg-gray-100"}`}
                />
              ))}
            </div>

            {error && (
              <p className="text-center text-xs text-red-500 font-medium">{error}</p>
            )}

            {resent && (
              <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-2xl py-2.5 px-4">
                <span>✅</span>
                <span className="text-green-700 text-sm font-bold">Code renvoyé !</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || filled < 6}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 active:scale-95 text-white font-black text-base sm:text-lg py-4 rounded-2xl transition-all shadow-lg shadow-purple-200 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin text-xl">🎲</span>
                  Vérification…
                </>
              ) : (
                "Valider le code ✅"
              )}
            </button>
          </form>

          {/* Renvoyer */}
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-gray-400 text-sm">
                Renvoyer le code dans{" "}
                <span className="font-black text-violet-500">{countdown}s</span>
              </p>
            ) : (
              <button
                onClick={handleResend}
                className="text-violet-600 font-black text-sm hover:text-purple-700 transition-colors"
              >
                Renvoyer le code 🔄
              </button>
            )}
          </div>

          <button
            onClick={() => router.push("/register")}
            className="w-full text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors text-center"
          >
            ← Changer d'email
          </button>
        </div>

        <p className="text-purple-200/70 text-xs mt-6 text-center px-4">
          🕵️ Vérifie aussi tes spams, les agents sont partout !
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="text-6xl mb-4 animate-pulse">📨</div>
            <p className="font-black text-xl">Chargement…</p>
          </div>
        </div>
      }
    >
      <VerifyPageContent />
    </Suspense>
  );
}