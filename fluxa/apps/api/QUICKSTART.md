# 🚀 Quick Start — Fluxa API

## 1️⃣ Start Databases
```bash
cd fluxa/apps/api
docker-compose up -d
```

Wait for containers to be healthy (~15 seconds):
```bash
docker ps | grep fluxa
```

## 2️⃣ Start API Server
```bash
npm run dev
```

Should see:
```
✔ Generated Prisma Client
🚀 Fluxa API running on port 3000 [development]
```

## 3️⃣ Test It!

### Option A: Automatic Test (Easiest)
```bash
# In a new terminal, run the E2E test script
pwsh test-e2e.ps1
```

This will:
- ✅ Register a company
- ✅ Create a customer
- ✅ Create an invoice
- ✅ Send to payment
- ✅ Simulate webhook
- ✅ Check notifications

### Option B: Manual Testing with REST Client

1. Install VS Code extension: **REST Client** by Huachao Mao
2. Open `test-requests.http`
3. Click "Send Request" on each endpoint
4. Copy values (token, customerId, invoiceId) and paste into subsequent requests

### Option C: cURL (Terminal)

**Register:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company",
    "email": "admin@company.test",
    "document": "12.345.678/0001-90",
    "password": "SecurePass123!"
  }'
```

Copy the `accessToken` from response, then:

**Create Customer:**
```bash
TOKEN="<paste-token-here>"
curl -X POST http://localhost:3000/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "document": "123.456.789-00"
  }'
```

## 4️⃣ Check Results

**View logs in database:**
```bash
# Connect to PostgreSQL
docker exec -it fluxa_postgres psql -U fluxa -d fluxa_dev

# See notifications
SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 10;

# See invoices
SELECT id, status, customer_id FROM invoices;

# See payments
SELECT id, status, gateway FROM payments;
```

**View Redis cache:**
```bash
docker exec -it fluxa_redis redis-cli
KEYS *
```

## 5️⃣ What to Look For

✅ **Notifications created automatically:**
- Email sent when invoice created
- Webhook sent when payment received
- Check `notification_logs` table

✅ **State machine working:**
- Invoice flow: draft → pending → paid
- Payment flow: pending → paid/failed

✅ **Event-driven:**
- Create invoice → triggers email notification + webhook
- Webhook received → updates payment → triggers invoice update

## 📖 Full Documentation

See:
- `TESTING.md` — Detailed testing guide
- `test-requests.http` — All API examples
- `features/*.md` — Feature specifications

---

**All set! Start testing with `pwsh test-e2e.ps1`** 🎉
