export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-background to-brand-100 px-4 py-12">
      {/* Aesthera brand mark */}
      <div className="mb-8 select-none text-center">
        <h1 className="font-serif text-4xl font-light tracking-wide text-foreground">
          Aesthera
        </h1>
        <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
          Gestão para Clínicas de Estética
        </p>
      </div>

      <div className="w-full max-w-[420px]">{children}</div>
    </div>
  )
}
