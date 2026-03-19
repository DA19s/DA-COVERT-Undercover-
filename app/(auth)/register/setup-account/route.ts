import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getJwtRole(jwt: string | undefined): string | null {
  if (!jwt) return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8")) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

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

    const role = getJwtRole(serviceKey);
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as {
      email?: string;
      username?: string;
      password?: string;
    };

    const email = body.email?.trim();
    const username = body.username?.trim();
    const password = body.password;

    if (!email) return NextResponse.json({ success: false, error: "Email manquant" }, { status: 400 });
    if (!username) return NextResponse.json({ success: false, error: "Username manquant" }, { status: 400 });
    if (!password) return NextResponse.json({ success: false, error: "Mot de passe manquant" }, { status: 400 });

    // 1) Récupérer l'utilisateur
    const { data: user, error: selectError } = await supabase
      .from("app_users")
      .select("id, is_verified")
      .eq("email", email)
      .single();

    if (selectError || !user) {
      return NextResponse.json({ success: false, error: "Utilisateur introuvable" }, { status: 404 });
    }

    if (!user.is_verified) {
      return NextResponse.json({ success: false, error: "Email non vérifié" }, { status: 400 });
    }

    // 2) Mettre à jour le profil
    const { error: updateError } = await supabase
      .from("app_users")
      .update({ username, password })
      .eq("id", user.id);

    if (updateError) {
      // 23505: unique violation (ex: username unique)
      return NextResponse.json(
        { success: false, error: updateError.message, code: updateError.code, role },
        { status: 400 }
      );
    }

    // 3) Créer player si pas déjà présent.
    // On évite ON CONFLICT ici: il nécessite une contrainte UNIQUE sur owner_id.
    const { data: existingPlayer, error: playerSelectError } = await supabase
      .from("players")
      .select("owner_id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (playerSelectError) {
      return NextResponse.json(
        { success: false, error: playerSelectError.message, code: playerSelectError.code, role },
        { status: 400 }
      );
    }

    if (!existingPlayer) {
      const { error: playerInsertError } = await supabase.from("players").insert({
        owner_id: user.id,
        nickname: username,
        total_points: 0,
      });

      if (playerInsertError) {
        return NextResponse.json(
          { success: false, error: playerInsertError.message, code: playerInsertError.code, role },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error: any) {
    console.error("setup-account error:", error?.message ?? error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}

