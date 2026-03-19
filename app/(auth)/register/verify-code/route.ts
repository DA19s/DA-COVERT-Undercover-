import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { success: false, error: "Server env missing: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    // Route serveur: utilise la clé SERVICE_ROLE pour bypasser le RLS pendant la vérification email
    const supabase = createClient(supabaseUrl, serviceKey);

    const { email, code } = (await req.json()) as { email?: string; code?: string };
    if (!email) return NextResponse.json({ success: false, error: "Email manquant" }, { status: 400 });
    if (!code) return NextResponse.json({ success: false, error: "Code manquant" }, { status: 400 });

    const { data: user, error: selectError } = await supabase
      .from("app_users")
      .select("code, is_verified")
      .eq("email", email)
      .single();

    if (selectError || !user) {
      return NextResponse.json({ success: false, error: "Utilisateur introuvable" }, { status: 404 });
    }

    if (user.is_verified) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    if (user.code !== code) {
      return NextResponse.json({ success: false, error: "Code incorrect" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("app_users")
      .update({ is_verified: true, code: null })
      .eq("email", email);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("verify-code error:", error?.message ?? error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}

