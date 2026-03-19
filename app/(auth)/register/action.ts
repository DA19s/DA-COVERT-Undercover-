"use server" // Indispensable pour que ça tourne sur le serveur

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Utilise la clé de service pour bypasser le RLS ici
);

export async function registerAndSendEmail(email: string) {
  try {
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 1. Enregistrement en BD (dans le champ code de app_users)
    const { error: dbError } = await supabase
      .from('app_users')
      .upsert({ 
        email: email, 
        code: verificationCode,
        username: email.split('@')[0] 
      }, { onConflict: 'email' });

    if (dbError) throw dbError;

    // 2. Envoi du mail avec tes infos Gmail du .env
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"DA-COVERT" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Ton code DA-COVERT 🎭",
      html: `<b>Ton code est : ${verificationCode}</b>`,
    });

    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}