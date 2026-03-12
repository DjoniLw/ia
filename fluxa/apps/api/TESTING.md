# 🚀 Fluxa API — Setup & Testing Guide

## Prerequisites

```bash
# Node 20+
node --version

# Docker + Docker Compose (for PostgreSQL + Redis)
docker --version
docker-compose --version
```

## 1️⃣ Setup Local Dev

### Start Databases
```bash
cd c:\Disco_D\Desenvolvimento\IA\fluxa\apps\api
docker-compose up -d

# Wait for containers to be healthy (15-20s)
docker ps
```

### Install & Run API
```bash
# Already installed, but if needed:
npm install

# Start development server (hot-reload)
npm run dev

# Or build + run production:
npm run build
npm run start
```

API will be running at: **http://localhost:3000**

### Verify Health
```bash
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2026-03-10T...",
#   "env": "development"
# }
```

---

## 2️⃣ Test the Full Flow

Use the **test-requests.http** file in this directory to test all endpoints.

### Option A: REST Client (VS Code)
Install extension: `REST Client` by Huachao Mao

Then open `test-requests.http` and click "Send Request" on each endpoint.

### Option B: cURL (Terminal)

```bash
# 1. Register a company
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "email": "admin@acme.test",
    "document": "12.345.678/0001-90",
    "password": "SecurePass123!"
  }'

# Copy the accessToken from response

# 2. Create a customer
TOKEN="your_access_token_here"
curl -X POST http://localhost:3000/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "document": "123.456.789-00",
    "phone": "+55 11 98765-4321"
  }'

# Copy the customer id

# 3. Create invoice
CUSTOMER_ID="..."
curl -X POST http://localhost:3000/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "'$CUSTOMER_ID'",
    "amount": 10000,
    "description": "Consulting Services",
    "dueDate": "2026-04-10",
    "paymentMethods": ["pix", "boleto"],
    "notify": true
  }'

# Copy the invoice id

# 4. Send to payment
INVOICE_ID="..."
curl -X POST http://localhost:3000/invoices/$INVOICE_ID/send-to-payment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# 5. List invoices
curl -X GET "http://localhost:3000/invoices?page=1&limit=10&status=pending" \
  -H "Authorization: Bearer $TOKEN"

# 6. Get notification logs
curl -X GET "http://localhost:3000/notifications/logs?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3️⃣ Database Inspection

### Access PostgreSQL
```bash
docker exec -it fluxa_postgres psql -U fluxa -d fluxa_dev

# Common queries:
\dt                           # List tables
SELECT * FROM companies;
SELECT * FROM customers;
SELECT * FROM invoices;
SELECT * FROM payments;
SELECT * FROM notification_logs;
```

### Access Redis
```bash
docker exec -it fluxa_redis redis-cli

# Check keys:
KEYS *
GET notifications:pending
LRANGE notifications:failed 0 -1
```

---

## 4️⃣ Logs & Debugging

### API Logs
```bash
# Terminal where npm run dev is running
# Look for:
# - Request logs (method, path, statusCode)
# - Database queries (if running in debug mode)
# - Event emissions (payment.succeeded, invoice.created, etc)
```

### Check TypeScript Errors
```bash
npm run lint        # ESLint
npx tsc --noEmit   # Type check
```

### Real-time Notification Simulation
The notifications service **automatically**:
- ✅ Subscribes to domain events
- ✅ Logs notifications (email + webhook)
- ✅ Simulates async sending (1-2s delay)
- ✅ Marks as sent/failed based on random success rate

Check logs in DB:
```bash
SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 10;
```

---

## 5️⃣ Manual Webhook Testing

### Simulate Stripe Webhook
```bash
curl -X POST http://localhost:3000/payments/webhooks/stripe \
  -H "stripe-signature: test_signature" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_test_12345",
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_test_stripe_123",
        "status": "succeeded",
        "metadata": {}
      }
    }
  }'
```

### Simulate MercadoPago Webhook
```bash
curl -X POST http://localhost:3000/payments/webhooks/mercadopago \
  -H "x-signature: test_signature" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_mp_12345",
    "type": "payment.updated",
    "data": {
      "id": 1234567890,
      "status": "approved",
      "external_reference": "invoice_uuid_here"
    }
  }'
```

---

## 6️⃣ Common Issues

### "DATABASE_URL not found"
- Check if `.env` file exists in `apps/api/`
- Should have: `DATABASE_URL="postgresql://fluxa:fluxa@localhost:5432/fluxa_dev?schema=public"`

### "Cannot connect to postgres"
```bash
# Make sure container is running:
docker ps | grep fluxa_postgres

# If not, restart:
docker-compose down
docker-compose up -d
```

### "Port 3000 already in use"
```bash
# Kill process on port 3000:
lsof -i :3000                    # macOS/Linux
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess  # Windows
```

### TypeScript compilation errors
```bash
npm run lint:fix   # Auto-fix ESLint issues
npx tsc --noEmit   # Check for type errors
```

---

## 7️⃣ What to Test

✅ **Authentication**
- Register company
- Login with wrong password (should fail)
- Login with correct password
- Use expired/invalid token (should be 401)

✅ **Customers**
- Create customer
- List customers (with pagination, search)
- Update customer
- Soft-delete customer
- Try to create duplicate email (should fail)

✅ **Invoices**
- Create invoice → status: `draft`
- Send to payment → status: `pending` (with paymentLink)
- List invoices with filters
- Try to cancel paid invoice (should fail — state machine)

✅ **Payments**
- Check payment was created when invoice sent to payment
- List payments
- Simulate webhook → should update payment status + invoice status

✅ **Notifications**
- View notification logs
- See emails + webhooks created automatically
- Retry failed notification

---

## 8️⃣ Next Steps

After validating locally:

1. **Run BullMQ workers** (background jobs for email/webhook delivery)
2. **Set up database migrations** (`prisma migrate dev`)
3. **Connect real Stripe/MercadoPago keys** (replace fake ones in .env)
4. **Configure Resend API** (email provider)
5. **Deploy to staging**

---

## 📖 API Documentation

See individual feature files in `features/` directory:
- `auth.md` — Authentication flows
- `customers.md` — Customer management
- `invoices.md` — Invoice state machine
- `payments.md` — Payment gateway integration
- `notifications.md` — Event-driven notifications
- `ledger.md` — Financial records (read-only)

---

**Happy testing! 🎉**
