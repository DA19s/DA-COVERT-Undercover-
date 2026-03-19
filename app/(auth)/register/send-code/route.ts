import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email) return NextResponse.json({ success: false, error: "Email manquant" }, { status: 400 });

    // 1. Vérifier si l'utilisateur existe ET est déjà vérifié
    const { data: existingUser } = await supabase
      .from('app_users')
      .select('is_verified')
      .eq('email', email)
      .single();

    if (existingUser?.is_verified) {
      return NextResponse.json({ 
        success: false, 
        error: "Cet email est déjà utilisé. Connecte-toi !" 
      }, { status: 400 });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const tempUsername = email.split('@')[0];
    // 2. Upsert (crée ou met à jour le code si pas encore vérifié)
    const { error: dbError } = await supabase
      .from('app_users')
      .upsert({ 
        email, 
        code: verificationCode,
        is_verified: false,
        username: tempUsername,
        password: password
      }, { onConflict: 'email' });

    if (dbError) throw new Error(dbError.message);

    // 3. Configuration Nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"DA-COVERT" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Ton code de vérification 🎭",
      html: `<div style="text-align:center;"><h1>Code : ${verificationCode}</h1></div>`,
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Erreur:", error.message);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}