-- CreateIndex
-- Índice composto para suportar filtros por data de criação na tela global de Carteira.
-- DEVE ser aplicado em produção antes de ativar o filtro de data na UI.
CREATE INDEX "wallet_entries_clinic_id_created_at_idx" ON "wallet_entries"("clinic_id", "created_at");
