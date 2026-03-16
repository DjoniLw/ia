# Fluxo de Agendamento — Documentação Técnica

> Última atualização: 2026-03-15
> Versão: 2.0

---

## 1. Visão Geral

O fluxo de agendamento foi redesenhado para guiar o usuário de forma inteligente,
calculando disponibilidade real de profissionais e horários com base no serviço
selecionado, eliminando conflitos e reduzindo o esforço manual da recepção.

---

## 2. Ordem dos Campos na Tela

```
1. Cliente       (busca por nome / telefone / CPF)
2. Serviço       (lista de todos os serviços ativos da clínica)
3. Data          (date picker)
4. Profissional  (opcional — filtra os horários; ou é selecionado após escolher horário)
5. Horários disponíveis  (grade de botões — calculada dinamicamente)
6. Equipamentos  (aparece após selecionar o horário)
7. Observações
```

---

## 3. Lógica de Disponibilidade

### 3.1 Após selecionar Serviço + Data

O sistema chama `GET /appointments/available-slots?serviceId=&date=` e obtém:

```json
{
  "date": "2026-03-20",
  "slots": ["09:00", "09:15", "10:00", "11:30"],
  "professionals": [
    { "id": "...", "name": "Ana", "slots": ["09:00", "09:15"] },
    { "id": "...", "name": "Camila", "slots": ["09:00", "10:00", "11:30"] }
  ]
}
```

Os horários exibidos são a **união** dos horários livres de todos os profissionais
que podem realizar o serviço.

### 3.2 Filtro por profissional

Se o usuário pré-seleciona um profissional, o mesmo endpoint recebe `professionalId`:

```
GET /appointments/available-slots?serviceId=&date=&professionalId=
```

Os horários retornados são apenas os daquele profissional.

### 3.3 Filtro por horário selecionado → Profissionais disponíveis

Após o usuário clicar num horário, o sistema chama:

```
GET /appointments/available-professionals?serviceId=&date=&time=HH:MM
```

Retorna apenas os profissionais disponíveis naquele horário específico (respeitando
duração do serviço).

### 3.4 Regra de qualificação de profissional para um serviço

Um profissional é qualificado para realizar um serviço quando:
- possui uma linha em `ProfessionalService` vinculando-o ao serviço, **ou**
- o campo `Professional.allServices = true`

O campo `allServices = true` significa que **todos** os serviços cadastrados na
clínica (agora e no futuro) estão disponíveis para este profissional.

---

## 4. Endpoints Utilizados

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/appointments/available-slots` | Horários livres por serviço + data |
| `GET` | `/appointments/available-professionals` | Profissionais disponíveis por serviço + data + horário |
| `GET` | `/appointments/available-equipment` | Equipamentos disponíveis para um slot de tempo |
| `GET` | `/appointments/availability` | Horários de um profissional específico (legado) |
| `GET` | `/appointments/calendar` | Calendário visual (dia / semana) |
| `POST` | `/appointments` | Criar agendamento |

### Parâmetros de `/appointments/available-slots`

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `serviceId` | UUID | ✓ | ID do serviço |
| `date` | `YYYY-MM-DD` | ✓ | Data desejada |
| `professionalId` | UUID | — | Filtrar por profissional |

### Parâmetros de `/appointments/available-professionals`

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `serviceId` | UUID | ✓ | ID do serviço |
| `date` | `YYYY-MM-DD` | ✓ | Data desejada |
| `time` | `HH:MM` | — | Filtrar por horário |

---

## 5. Organização do Código

```
apps/api/src/modules/appointments/
├── appointments.dto.ts             # DTOs e schemas Zod
├── appointments.repository.ts      # Queries Prisma
├── appointments.routes.ts          # Fastify routes (registra AppointmentsService + ScheduleAvailabilityService)
├── appointments.service.ts         # CRUD, transições de estado, billing
└── scheduleAvailability.service.ts # Cálculo de disponibilidade (slots, profissionais, qualificação)

apps/web/lib/hooks/
└── use-appointments.ts             # useAvailableSlots, useAvailableProfessionals, useCalendar...

apps/web/app/(dashboard)/appointments/
└── page.tsx                        # UI: CreateAppointmentForm, AdvancedScheduleDialog
```

### `ScheduleAvailabilityService`

Responsabilidades:
- `getAvailableSlots(clinicId, serviceId, date, professionalId?)` — retorna slots e profissionais por slot
- `getAvailableProfessionals(clinicId, serviceId, date, time?)` — profissionais qualificados + disponíveis
- `getQualifyingProfessionals(clinicId, serviceId, specificId?)` — profissionais que podem fazer o serviço

---

## 6. Regras de Conflito

1. **Conflito de profissional**: um profissional não pode ter dois agendamentos
   sobrepostos (`status` em `['draft', 'confirmed', 'in_progress']`).

2. **Conflito de equipamento**: o mesmo equipamento não pode ser associado a dois
   agendamentos sobrepostos.

3. **Horário de trabalho**: só são gerados slots dentro do intervalo `startTime–endTime`
   do `ProfessionalWorkingHour` para o dia da semana correspondente.

4. **Slots bloqueados**: `BlockedSlot` com `recurrence = 'none'`, `'daily'` ou `'weekly'`
   são considerados ao calcular disponibilidade.

5. **Duração do serviço**: cada slot avança de 15 em 15 minutos, mas só é válido
   se `slot_start + service.durationMinutes ≤ working_hours_end`.

---

## 7. Agenda Avançada

O botão **"Agenda Avançada"** abre um modal com uma grade semanal:

- Linhas = horários (de hora em hora, das 07h às 21h)
- Colunas = Profissional × Dia da semana
- Células com agendamento mostram o nome do cliente
- Células livres são clicáveis → abre o formulário de novo agendamento pré-preenchido
  com data, hora e profissional

---

## 8. Notas de Migração

- A rota `GET /appointments/available-professionals?date=&time=` continua funcionando
  para compatibilidade retroativa (sem `serviceId`).
- O campo `professionalId` continua sendo **obrigatório** no `POST /appointments`.
  O fluxo de UI garante que sempre seja selecionado antes do envio.
