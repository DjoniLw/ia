/**
 * Migration 2 — Script de migração de dados
 *
 * Migra dados do modelo legado (BodyMeasurementField/Record/Value) para o novo
 * modelo de fichas configuráveis (MeasurementSheet/Field/Session).
 *
 * Execução:
 *   npx tsx prisma/seed-migrate-body-measurements.ts
 *
 * ⚠️ Rodar em uma transação com rollback habilitado.
 * ⚠️ Executar SOMENTE após validatear a Migration 1 em produção.
 * ⚠️ Migration 3 (drop das tabelas legadas) DEVE ser executada separadamente,
 *    após validar que todas as contagens batem.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Iniciando migração de medidas corporais ===')

  // ── 1. Coletar contagens antes ──────────────────────────────────────────────
  const [legacyFieldCount, legacyRecordCount, legacyValueCount, legacyFileCount] =
    await Promise.all([
      prisma.bodyMeasurementField.count(),
      prisma.bodyMeasurementRecord.count(),
      prisma.bodyMeasurementValue.count(),
      prisma.customerFile.count({ where: { bodyMeasurementRecordId: { not: null } } }),
    ])

  console.log('Contagens ANTES:')
  console.log(`  BodyMeasurementField: ${legacyFieldCount}`)
  console.log(`  BodyMeasurementRecord: ${legacyRecordCount}`)
  console.log(`  BodyMeasurementValue: ${legacyValueCount}`)
  console.log(`  CustomerFile com recordId: ${legacyFileCount}`)

  // ── 2. Mapas de correspondência ─────────────────────────────────────────────
  // legacyFieldId → novo MeasurementField.id
  const fieldIdMap = new Map<string, string>()
  // legacyRecordId → novo MeasurementSession.id
  const recordToSessionMap = new Map<string, string>()

  await prisma.$transaction(
    async (tx) => {
      // ── 3. Migrar campos e fichas por clínica ───────────────────────────────
      const clinicsWithFields = await tx.bodyMeasurementField.groupBy({
        by: ['clinicId'],
      })

      console.log(`\nMigrando campos para ${clinicsWithFields.length} clínica(s)...`)

      for (const { clinicId } of clinicsWithFields) {
        const legacyFields = await tx.bodyMeasurementField.findMany({
          where: { clinicId },
          orderBy: { order: 'asc' },
        })

        // Criar uma ficha "Medidas" padrão para a clínica
        const sheet = await tx.measurementSheet.create({
          data: {
            clinicId,
            name: 'Medidas',
            active: true,
            order: 0,
          },
        })

        console.log(`  Clínica ${clinicId}: ficha "${sheet.name}" criada (${legacyFields.length} campos)`)

        for (const legacyField of legacyFields) {
          const newField = await tx.measurementField.create({
            data: {
              sheetId: sheet.id,
              clinicId,
              name: legacyField.name,
              unit: legacyField.unit,
              type: 'SIMPLE',
              order: legacyField.order,
              active: legacyField.active,
            },
          })
          fieldIdMap.set(legacyField.id, newField.id)
        }
      }

      // ── 4. Migrar registros (records → sessions) ────────────────────────────
      const legacyRecords = await tx.bodyMeasurementRecord.findMany({
        orderBy: { recordedAt: 'asc' },
      })

      console.log(`\nMigrando ${legacyRecords.length} registros para sessões...`)

      for (const record of legacyRecords) {
        // Encontrar a sheet padrão criada para esta clínica
        const sheet = await tx.measurementSheet.findFirst({
          where: { clinicId: record.clinicId, name: 'Medidas' },
        })

        if (!sheet) {
          console.warn(
            `  ⚠️ Sheet padrão não encontrada para clínica ${record.clinicId} — pulando record ${record.id}`,
          )
          continue
        }

        const session = await tx.measurementSession.create({
          data: {
            clinicId: record.clinicId,
            customerId: record.customerId,
            recordedAt: record.recordedAt,
            notes: record.notes,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            createdById: record.createdById,
          },
        })

        recordToSessionMap.set(record.id, session.id)

        // Criar o SheetRecord vinculando sessão à ficha padrão
        const sheetRecord = await tx.measurementSheetRecord.create({
          data: {
            sessionId: session.id,
            sheetId: sheet.id,
          },
        })

        // Migrar valores do record legado
        const legacyValues = await tx.bodyMeasurementValue.findMany({
          where: { recordId: record.id },
        })

        for (const legacyValue of legacyValues) {
          const newFieldId = fieldIdMap.get(legacyValue.fieldId)
          if (!newFieldId) {
            console.warn(
              `  ⚠️ Campo ${legacyValue.fieldId} não mapeado — pulando valor`,
            )
            continue
          }

          await tx.measurementValue.create({
            data: {
              sheetRecordId: sheetRecord.id,
              fieldId: newFieldId,
              value: legacyValue.value,
            },
          })
        }
      }

      // ── 5. Migrar CustomerFile.bodyMeasurementRecordId → measurementSessionId ──
      const filesWithRecord = await tx.customerFile.findMany({
        where: { bodyMeasurementRecordId: { not: null } },
        select: { id: true, bodyMeasurementRecordId: true },
      })

      console.log(`\nMigrando ${filesWithRecord.length} arquivo(s) vinculados a records...`)

      for (const file of filesWithRecord) {
        const sessionId = recordToSessionMap.get(file.bodyMeasurementRecordId!)
        if (!sessionId) {
          console.warn(`  ⚠️ Record ${file.bodyMeasurementRecordId} sem sessão correspondente — arquivo ${file.id} não migrado`)
          continue
        }

        await tx.customerFile.update({
          where: { id: file.id },
          data: { measurementSessionId: sessionId },
        })
      }

      // ── 6. Validação de contagens ─────────────────────────────────────────────
      const [newSheetCount, newFieldCount, newSessionCount, newValueCount, newFileMigrated] =
        await Promise.all([
          tx.measurementSheet.count(),
          tx.measurementField.count(),
          tx.measurementSession.count(),
          tx.measurementValue.count(),
          tx.customerFile.count({ where: { measurementSessionId: { not: null } } }),
        ])

      console.log('\nContagens DEPOIS:')
      console.log(`  MeasurementSheet: ${newSheetCount}`)
      console.log(`  MeasurementField: ${newFieldCount} (esperado: ${legacyFieldCount})`)
      console.log(`  MeasurementSession: ${newSessionCount} (esperado: ${legacyRecordCount})`)
      console.log(`  MeasurementValue: ${newValueCount} (esperado: ${legacyValueCount})`)
      console.log(`  CustomerFile migrado: ${newFileMigrated} (esperado: ${legacyFileCount})`)

      const errors: string[] = []
      if (newFieldCount !== legacyFieldCount) errors.push(`Campos divergem: ${newFieldCount} vs ${legacyFieldCount}`)
      if (newSessionCount !== legacyRecordCount) errors.push(`Sessões divergem: ${newSessionCount} vs ${legacyRecordCount}`)
      if (newValueCount !== legacyValueCount) errors.push(`Valores divergem: ${newValueCount} vs ${legacyValueCount}`)
      if (newFileMigrated !== legacyFileCount) errors.push(`Arquivos migrados divergem: ${newFileMigrated} vs ${legacyFileCount}`)

      if (errors.length > 0) {
        console.error('\n❌ Erros de validação encontrados:')
        for (const err of errors) console.error(`  - ${err}`)
        throw new Error('Migração abortada: contagens divergentes. Fazendo rollback.')
      }

      console.log('\n✅ Todas as contagens batem. Commit da transação.')
    },
    {
      maxWait: 60_000,
      timeout: 120_000,
    },
  )

  console.log('\n=== Migração concluída com sucesso ===')
  console.log('⚠️  Migration 3 (drop das tabelas legadas) deve ser executada SEPARADAMENTE,')
  console.log('   após validar os dados em produção.')
}

main()
  .catch((err) => {
    console.error('\n❌ Migração falhou:', err.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
