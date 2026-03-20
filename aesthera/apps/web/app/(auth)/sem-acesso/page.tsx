import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SemAcessoPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Clínica não identificada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>
          O Aesthera usa <strong className="text-foreground">subdomínio</strong> para identificar
          cada clínica. Você acessou via <code className="rounded bg-muted px-1 py-0.5 text-xs">localhost</code> sem
          subdomain, por isso não foi possível determinar qual clínica carregar.
        </p>

        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
          <p className="font-medium text-foreground text-xs uppercase tracking-wide">
            Como acessar em desenvolvimento
          </p>
          <p>
            Substitua <code className="rounded bg-muted px-1 py-0.5 text-xs">localhost:3002</code> pelo
            subdomínio da sua clínica:
          </p>
          <code className="block rounded bg-background border px-3 py-2 text-xs text-foreground">
            http://sua-clinica.localhost:3002
          </code>
          <p className="text-xs">
            Onde <strong>sua-clinica</strong> é o slug cadastrado no momento do registro
            (ex: <code className="rounded bg-muted px-1 py-0.5 text-xs">clinica-ana</code>).
          </p>
        </div>

        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
          <p className="font-medium text-foreground text-xs uppercase tracking-wide">
            Alternativa — acesso por formulário
          </p>
          <p>
            Você também pode fazer login informando o slug da clínica no formulário de
            acesso. Neste caso, qualquer URL funciona (incluindo URLs planas do Railway/Vercel).
          </p>
        </div>

        <Button asChild className="w-full">
          <Link href="/login">Ir para o login</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
