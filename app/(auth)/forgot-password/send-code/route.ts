import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { identifier } = (await req.json()) as { identifier?: string };
    const ident = (identifier ?? "").trim();
    if (!ident) {
      return NextResponse.json({ success: false, error: "Identifiant manquant" }, { status: 400 });
    }

    const { data: user, error: userErr } = await supabase
      .from("app_users")
      .select("id, email, username, is_verified")
      .or(`email.eq.${ident},username.eq.${ident}`)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ success: false, error: "Compte introuvable" }, { status: 404 });
    }

    if (!user.is_verified) {
      return NextResponse.json({ success: false, error: "Compte non verifie" }, { status: 400 });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const { error: updateErr } = await supabase
      .from("app_users")
      .update({ code: resetCode })
      .eq("id", user.id);

    if (updateErr) throw updateErr;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"DA-COVERT" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "Code de reinitialisation DA-COVERT",
      html: `<div style="text-align:center;"><h1>Code : ${resetCode}</h1><p>Utilise ce code pour changer ton mot de passe.</p></div>`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("forgot-password/send-code:", error?.message ?? error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
