# Feature: Reports

## Summary
Reporting module providing data visibility across three domains:
clients, product sales, and stock. Accessible at `/reports` in the dashboard.

---

## Report Tabs

### 1. Clients Report
- Total registered clients
- % with phone number (important for WhatsApp coverage)
- % with birth date (important for birthday widget)
- "New clients per month" bar chart (last 6 months)
- Full client list (name, phone, email, birth date, registration date)

### 2. Sales Report
Date-range filter (default: current month)
- Revenue from product sales in period
- Total ledger credits (revenue from services + products combined)
- Number of sales transactions
- Number of items sold
- Top 10 products by revenue (horizontal bar chart)
- Payment method breakdown (pie chart: cash/PIX/card/transfer)
- Top products table

### 3. Stock Report
- Total active products
- Low stock count (stock ≤ minStock)
- Out of stock count (stock = 0)
- Products by category (pie chart)
- "Reposição necessária" alert panel (critical items)
- Full stock table with status badge (OK / Baixo / Sem estoque)

---

## Data Sources
All data is fetched via existing API hooks — no dedicated report endpoints needed:
- `GET /customers?limit=200` → clients data
- `GET /products?limit=200` → stock data
- `GET /products/sales?from=&to=&limit=500` → sales data
- `GET /ledger/summary?from=&to=` → financial totals

---

## Frontend Page
```
/reports
  → ClientsTab   (useCustomers)
  → SalesTab     (useProductSales + useLedgerSummary)
  → StockTab     (useProducts)
```

Charts use `recharts` (already a project dependency):
- `BarChart` (new clients by month, top products by revenue)
- `PieChart` (payment methods, products by category)

---

## Status
[x] Done

## Changelog
| Date | Change |
|------|--------|
| 2026-03 | Initial implementation: clients, sales, stock reports with charts |
