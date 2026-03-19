"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 1. Au chargement, on vérifie le localStorage
  useEffect(() => {
    async function loadUser() {
      const storedId = localStorage.getItem("agent_id");
      if (storedId) {
        const { data, error } = await supabase
          .from("app_users")
          .select("id, username, email")
          .eq("id", storedId)
          .single();

        if (data && !error) {
          setUser(data);
        } else {
          localStorage.removeItem("agent_id");
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  // 2. Fonction pour se connecter
  const login = async (userId: string) => {
    localStorage.setItem("agent_id", userId);
    const { data } = await supabase
      .from("app_users")
      .select("id, username, email")
      .eq("id", userId)
      .single();
    if (data) setUser(data);
  };

  // 3. Déconnexion
  const logout = () => {
    localStorage.removeItem("agent_id");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook personnalisé pour l'utiliser partout
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être dans un AuthProvider");
  return context;
};