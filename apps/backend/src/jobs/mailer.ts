import nodemailer from 'nodemailer';
import config from '../config/env';

const port = config.SMTP_PORT ?? 587;

const transport = config.SMTP_HOST
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port,
      secure: port === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS ?? '' } : undefined
    })
  : null;

/** Alamat pengirim harus terverifikasi di Brevo; SMTP_USER hanya akun relay. */
export const alamatPengirim = (): string =>
  config.SENDER_EMAIL ?? config.SMTP_USER ?? 'no-reply@localhost';

export const isMailerEnabled = (): boolean => transport !== null;

/** Cek kredensial SMTP saat startup tanpa menggagalkan server. */
export const verifyMailer = async (): Promise<boolean> => {
  if (!transport) {
    return false;
  }
  try {
    await transport.verify();
    return true;
  } catch (err) {
    console.error('[mailer] verifikasi SMTP gagal:', err instanceof Error ? err.message : err);
    return false;
  }
};

export const sendMail = async (to: string, subject: string, text: string): Promise<boolean> => {
  if (!transport) {
    return false;
  }
  try {
    await transport.sendMail({
      from: { name: 'Klinik Bidan Ria', address: alamatPengirim() },
      to,
      subject,
      text
    });
    return true;
  } catch (err) {
    console.error('[mailer] gagal kirim ke', to, err instanceof Error ? err.message : err);
    return false;
  }
};
