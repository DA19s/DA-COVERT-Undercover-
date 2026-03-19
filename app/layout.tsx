import { AuthProvider } from "@/context/authContext";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          {children}
          <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[9999] px-3 py-1 rounded-full bg-black/30 backdrop-blur border border-white/20 text-white/80 text-[11px] font-bold tracking-wide pointer-events-none">
            Powered by Ibrahim DAN AZOUMI
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}