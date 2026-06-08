// Welcome email for a new ReelHome partner/seller — shared by admin create and recruitment.
export function sellerWelcomeHtml(
  name: string,
  refUrl: string,
  discountUrl: string,
  portalUrl: string,
  discountPct: number,
): string {
  return `<!DOCTYPE html><html lang="no"><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td align="center" style="padding-bottom:28px;"><span style="font-size:24px;font-weight:800;color:#0f0f0f;letter-spacing:-0.02em;">ReelHome<span style="color:#2563eb;">.ai</span></span></td></tr>
    <tr><td style="background:#ffffff;border:1px solid #e5e5e5;border-radius:16px;padding:36px 32px;color:#0f0f0f;">
      <h1 style="margin:0 0 12px;font-size:21px;font-weight:700;">Velkommen som ReelHome-partner, ${name}!</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">Her er lenkene dine. Del en henvisningslenke — når noen registrerer seg via den og blir kunde, opptjener du provisjon. Lenger ned finner du portalen din der du følger med på provisjonen.</p>
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:1px;">Vanlig henvisningslenke</p>
      <p style="margin:0 0 22px;"><a href="${refUrl}" style="color:#2563eb;font-size:15px;word-break:break-all;">${refUrl}</a></p>
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:1px;">Rabatt-lenke (${discountPct}% til kunden)</p>
      <p style="margin:0 0 4px;"><a href="${discountUrl}" style="color:#2563eb;font-size:15px;word-break:break-all;">${discountUrl}</a></p>
      <p style="margin:0 0 22px;font-size:12px;color:#737373;line-height:1.5;">Gir kunden ${discountPct}% rabatt på abonnement, så lenge kunden er aktiv. Provisjonen din regnes av det kunden faktisk betaler.</p>
      <div style="text-align:center;margin-top:16px;"><a href="${portalUrl}" style="display:inline-block;background:#2563eb;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:13px 30px;border-radius:10px;">Åpne selger-portalen →</a></div>
      <p style="margin:22px 0 0;font-size:12px;color:#a3a3a3;line-height:1.5;">Behold portal-lenken privat — den gir tilgang til portalen din.</p>
    </td></tr>
  </table></td></tr></table></body></html>`;
}
