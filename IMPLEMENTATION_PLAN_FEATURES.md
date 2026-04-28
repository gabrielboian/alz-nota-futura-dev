# ALZ Nota Futura — Feature Implementation Plan

> **Prerequisite**: scaffolding plan in [v1/IMPLEMENTATION_PLAN.md](v1/IMPLEMENTATION_PLAN.md) is complete and verified (backend running on :8001 with `/api/v1/health/`, `/api/v1/auth/*`, `/admin/`; frontend building clean with `/overview` placeholder + full auth flow).
> **Source of truth**: all docs in [docs/](docs/) — in particular [03-database-schema.md](docs/03-database-schema.md), [02-pages-and-ui.md](docs/02-pages-and-ui.md), [04-business-rules.md](docs/04-business-rules.md), [08-rpa-mappings.md](docs/08-rpa-mappings.md).

---

## 0. Global rules (apply to every phase below)

1. **Portal-only scope — RPA execution is OUT.** This repository delivers:
   - The **portal** (Django + DRF + Next.js) and
   - The **shared database schema** that both the portal and the RPA worker read/write.

   Concretely, for every RPA-adjacent table (`sales_order`, `rpa_execution`, NF validation result fields, …) we build:
   - Django models + migrations + admin (unfold) registrations.
   - REST endpoints / list pages so portal users can see the RPA's work.
   - Portal-side **writes** that seed work for the RPA (e.g., inserting `sales_order` rows with `rpa_status='awaiting_ov_creation'`).

   What we do **not** build in this repository:
   - The RPA worker itself (SAP GUI automation, `pyautogui`/`uiautomation` scripts, checkpoint/polling loops, `ZSDT0132` execution).
   - Any transition owned by the RPA: `rpa_status` → `executing` / `awaiting_approval` / `completed` / `rejected` / `error`.
   - SAP credentials, RPA vault, RPA logs.

   The RPA team consumes our tables; we never call them or their scripts.

2. **Never commit.** The agent does not run `git commit`, `git push`, `git add`, or draft commit messages. The human operator owns commits. Read-only git is fine.

3. **No redesign.** Follow [docs/02-pages-and-ui.md](docs/02-pages-and-ui.md) for every page; reuse components from `frontend/components/ui/` as-is.

4. **Naming rules.** Per [/memories/repo/naming-rules.md](/memories/repo/naming-rules.md): model/field names in English; keep `cnpj`, `cpf`, `inscricao_estadual` and other pt-BR fiscal terms verbatim where the docs use them.

5. **Admin-first for lookup tables.** Every lookup table (branch, participant, terminal, commercial responsible, corridor, transshipment location) is exposed only via django-unfold admin — no public API, no frontend page.

6. **Stop at checkpoints.** Each phase ends with ✅ acceptance. Run it, report, fix before moving on.

---

## Phase 4 — Lookup tables & admin

**Goal**: create all reference data models so domain models can FK to them.

### 4.1 Models (app `apps.lookups`)

From [docs/03-database-schema.md](docs/03-database-schema.md) §1-4:
- `branch` (BD-Filiais) — `sap_code`, `state`, `cnpj`, `description`, `type` (armazém/escritório).
- `terminal_destination` (BD-Terminais Destino) — `name`, `sap_client_code`, `sap_supplier_code`.
- `participant` (BD-Participantes) — `name`, `sap_code`, `inscricao_estadual`, `cnpj`.
- `commercial_responsible` (BD-Comercial Responsável) — `name`, `state`, `branch` FK, `corporate_phone`.
- `corridor` (BD-Corredor) — `code`, `name`, `description`.
- `transshipment_location` — name, optional FK to branch.

### 4.2 Unfold admin

Register each model with `ModelAdmin`, list_display, search_fields. Seed fixtures (JSON) with the data already in the xlsx reference sheets.

### 4.3 ✅ Phase 4 acceptance

- `python manage.py migrate` succeeds, `python manage.py loaddata` loads the seeded reference rows.
- Admin at `/admin/` lists all six models with the seeded rows visible.

---

## Phase 5 — Contracts app

### 5.1 Models (app `apps.contracts`)

From [docs/03-database-schema.md](docs/03-database-schema.md) §2-3:
- `contract_base_lot` — raw lot data from uploaded spreadsheet (immutable reference).
- `contract_managed_lot` — workable lot with `total_quantity_kg`, `delivered_quantity_kg`, `balance_kg` (computed), `status`, FKs to product/producer/branch.
- `contract_upload` — file, uploaded_by, uploaded_at, row_count, status.

### 5.2 Endpoints

- `POST /api/v1/contracts/uploads/` (multipart; xlsx parsing; creates `contract_upload` + `contract_base_lot` rows).
- `GET /api/v1/contracts/lots/` (paginated list with filters).
- `GET /api/v1/contracts/lots/<id>/`.

### 5.3 Frontend

- `/contracts` (list view with filter bar + upload button) — reuse patterns from `frontend/components/ui/data-table.tsx` (copied from alz-portal reference).
- Upload modal with progress bar + result summary (rows created / rows skipped / errors).

### 5.4 ✅ Phase 5 acceptance

- Upload the `v2/` xlsx (`Rascunho Banco de Dados - NF Entrega Futura.xlsx`) — contracts appear on `/contracts`.
- Delivered/balance columns compute correctly when a lot is consumed (unit test).

---

## Phase 6 — Invoices app (NF Entrega Futura)

### 6.1 Models (app `apps.invoices`)

From [docs/03-database-schema.md](docs/03-database-schema.md) §7 + [docs/06-nf-validation.md](docs/06-nf-validation.md):
- `nf_future_delivery` — mother NF metadata, qty, unit value, remaining balance, status, FK to producer/branch/product.
- `nf_upload` — upload batch tracking.
- NF validation result fields on child NFs (validation_level, validation_status, validation_error_code, validation_error_detail). **These are written by the RPA** — portal only reads them.

### 6.2 Endpoints

- `POST /api/v1/invoices/uploads/` (mother NF xlsx upload).
- `GET /api/v1/invoices/balances/` (list with remaining balances).
- Admin: `nf_future_delivery` full CRUD via unfold.

### 6.3 Frontend

- `/invoices/upload` — upload page with progress + row-level errors.
- `/invoices/balances` — grid of mother NFs with `qty`, `unit_value`, `remaining`, producer, IE, status. Filter by status/producer/branch.

### 6.4 ✅ Phase 6 acceptance

- Mother NFs visible; remaining balance updates when a child NF is linked (via admin, since RPA-validation is out of scope).

---

## Phase 7 — Shipments app (wizard)

### 7.1 Models (app `apps.shipments`)

From [docs/03-database-schema.md](docs/03-database-schema.md) §8 + form R1-R26 in xlsx:
- `shipment_request` — all 26 fields from the "Solicitar Embarque" form, FKs to `contract_managed_lot`, `branch`, `participant` (nullable), `terminal_destination`, `commercial_responsible`. `status` enum (draft, submitted, approved, in_logistics, released, cancelled).

### 7.2 Endpoints

- `POST /api/v1/shipments/` (draft + submit), `PATCH` (edit while draft), `GET` (list + detail).
- `POST /api/v1/shipments/<id>/release/` — releases the shipment, **creates a `sales_order` row with `rpa_status='awaiting_ov_creation'`** so the RPA can pick it up.

### 7.3 Frontend

- `/shipments` — list view.
- `/shipments/new` — 4-step wizard (producer/local → contract/product → logistics → review). Use `frontend/components/ui/wizard.tsx` from reference.

### 7.4 ✅ Phase 7 acceptance

- Create + submit a shipment request; on release, a `sales_order` row exists with `rpa_status='awaiting_ov_creation'` and `creation_event_datetime=now()`.

---

## Phase 8 — Sales orders (OV) read views

### 8.1 Models (app `apps.sales_orders`)

From [docs/03-database-schema.md](docs/03-database-schema.md) §5-6 (already expanded with the V2 RPA fields):
- `sales_order` — full schema including `rpa_status`, `rpa_error_message`, `creation_event_datetime`, `ov_solicitation_number`, `cadence`, `exit_freight_type`, `billing_branch`.
- `loading_order` (OC) — FK to `sales_order`.

> ⚠️ Per global rule 1, the portal only **inserts** rows with `rpa_status='awaiting_ov_creation'` (done in Phase 7.2) and **displays** whatever the RPA writes back. No status machine, no SAP call, no polling loop in this repo.

### 8.2 Endpoints

- `GET /api/v1/sales-orders/` with filters (`rpa_status`, `ov_status`, lot, branch, producer).
- `GET /api/v1/sales-orders/<id>/`.
- Admin: full CRUD on `sales_order` + `loading_order` via unfold for ops debugging.

### 8.3 Frontend

- `/logistics/shipments` — grid showing all OVs with `ov_number`, `rpa_status` (badge), `ov_status`, balance, terminal. Expand row to see `rpa_error_message` when `rpa_status='error'` or `'rejected'`.
- `/logistics/orders` — mass-adjust page (edit cadence, exit_freight_type, schedule).

### 8.4 ✅ Phase 8 acceptance

- Manually set an admin `sales_order.rpa_status='completed'` with a fake `ov_number` → it renders correctly on `/logistics/shipments`.

---

## Phase 9 — Fiscal instructions

### 9.1 Models (app `apps.fiscal`)

From [docs/03-database-schema.md](docs/03-database-schema.md) §10:
- `fiscal_instruction` — FK to `shipment_request`, content (text/attachments), sent_at, recipient_email.

### 9.2 Endpoints + page

- `GET/POST /api/v1/fiscal/instructions/`.
- `/fiscal` — list + send-instruction flow.

### 9.3 ✅ Phase 9 acceptance

- A fiscal user can issue instructions against a released shipment; the shipment detail shows the history.

---

## Phase 10 — Dashboard (`/` Home)

### 10.1 KPI endpoints (`apps.dashboard`)

- `GET /api/v1/dashboard/kpis/` — counts per status across shipment_request / sales_order / nf_future_delivery.
- `GET /api/v1/dashboard/charts/{throughput,rpa_backlog,nf_balance}/`.

### 10.2 Frontend

- `/` (home) — replace the placeholder `/overview` with the KPI dashboard (cards + charts). Use recharts or the chart lib already in the reference.

### 10.3 ✅ Phase 10 acceptance

- Home renders with live KPIs; numbers match what's in the admin.

---

## Out-of-scope reminders (not planned here, possibly ever in this repo)

- RPA worker implementation (SAP GUI automation). Lives in a separate RPA team repo.
- Celery / async background jobs beyond simple `on_commit` hooks.
- Email provider integration for fiscal instructions (stub `send_email()` logger is enough; production email is a separate ops concern).
- Migration from SQLite → SQL Server. Flagged in `backend/config/settings.py` but deferred.
- Mobile-first layout. Desktop-only for MVP.

---

## Feature order (summary)

| Phase | App | Unblocks |
|---|---|---|
| 4 | `lookups` | FKs everywhere |
| 5 | `contracts` | managed_lot FK for shipments + sales_orders |
| 6 | `invoices` | mother NF FK for sales_orders |
| 7 | `shipments` | wizard → feeds sales_order queue |
| 8 | `sales_orders` | RPA producer/consumer interface |
| 9 | `fiscal` | post-release workflow |
| 10 | `dashboard` | final KPI surface |

Phases 4–6 are independent and could be parallelized. Phases 7–10 are strictly sequential.
