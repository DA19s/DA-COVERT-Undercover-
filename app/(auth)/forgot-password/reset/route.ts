import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { identifier, code, newPassword } = (await req.json()) as {
      identifier?: string;
      code?: string;
      newPassword?: string;
    };

    const ident = (identifier ?? "").trim();
    const cleanCode = (code ?? "").trim();
    const nextPassword = newPassword ?? "";

    if (!ident || !cleanCode || !nextPassword) {
      return NextResponse.json({ success: false, error: "Champs manquants" }, { status: 400 });
    }

    if (nextPassword.length < 6) {
      return NextResponse.json({ success: false, error: "Mot de passe trop court" }, { status: 400 });
    }

    const { data: user, error: userErr } = await supabase
      .from("app_users")
      .select("id, code")
      .or(`email.eq.${ident},username.eq.${ident}`)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ success: false, error: "Compte introuvable" }, { status: 404 });
    }

    if (!user.code || user.code !== cleanCode) {
      return NextResponse.json({ success: false, error: "Code incorrect" }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from("app_users")
      .update({ password: nextPassword, code: null })
      .eq("id", user.id);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("forgot-password/reset:", error?.message ?? error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
