-- AlterEnum
-- IF NOT EXISTS evita erro caso o db push já tenha aplicado este valor anteriormente
ALTER TYPE "MeasurementFieldType" ADD VALUE IF NOT EXISTS 'CHECK';
