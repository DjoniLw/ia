export function buildTransferEmailHtml(params: {
  sourceClinicName: string
  targetClinicName: string
  confirmUrl: string
  rejectUrl: string
}) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:32px 16px;color:#111">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h1 style="font-size:22px;font-weight:600;margin-bottom:8px">Confirmação de transferência de acesso</h1>
    <p style="color:#4b5563;line-height:1.6">
      Recebemos uma solicitação para transferir seu acesso da empresa
      <strong>${params.sourceClinicName}</strong> para <strong>${params.targetClinicName}</strong>.
    </p>
    <p style="color:#4b5563;line-height:1.6">
      Ao confirmar, seu acesso na empresa de origem será marcado como inativo, mas todo o seu histórico será preservado.
    </p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin:24px 0">
      <a href="${params.confirmUrl}" style="display:inline-block;background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Confirmar transferência</a>
      <a href="${params.rejectUrl}" style="display:inline-block;background:#fff;color:#111827;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;border:1px solid #d1d5db">Recusar</a>
    </div>
    <p style="font-size:12px;color:#6b7280;line-height:1.5">
      Se os botões não funcionarem, copie e cole os links abaixo no navegador:<br />
      Confirmar: <a href="${params.confirmUrl}" style="color:#111827">${params.confirmUrl}</a><br />
      Recusar: <a href="${params.rejectUrl}" style="color:#111827">${params.rejectUrl}</a>
    </p>
    <p style="font-size:12px;color:#9ca3af;margin-top:24px">Este link expira em 48 horas.</p>
  </div>
</body>
</html>`
}