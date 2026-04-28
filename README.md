# ALZ Nota Futura

Portal ALZ Grãos para gestão de **Nota Fiscal de Entrega Futura** (NF-e EF).
Backend Django + DRF, frontend Next.js 16 + Tailwind 4, autenticação Microsoft OAuth + e-mail/senha.

> **Status**: scaffolding concluído. Apenas login + placeholder `/overview`. Páginas de feature ainda não implementadas — ver [docs/02-pages-and-ui.md](docs/02-pages-and-ui.md).

## Pré-requisitos

- Python 3.12
- Node.js 20+
- npm 10+

## Backend

```bash
cd backend
python3.12 -m venv env
source env/bin/activate
pip install -r requirements.txt
cp .env.example .env          # edite as variáveis
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8001
```

API disponível em `http://localhost:8001/api/v1/`. Admin (django-unfold) em `http://localhost:8001/admin/`.

Endpoints principais:
- `GET  /api/v1/health/` — healthcheck
- `POST /api/v1/auth/login/` — login e-mail/senha (retorna JWT)
- `POST /api/v1/auth/oauth/microsoft/` — login Microsoft (access token)
- `GET  /api/v1/auth/me/` — usuário autenticado
- `POST /api/v1/auth/token/refresh/` — renovar access token

Usuários são criados **apenas via Django admin**. A senha inicial é gerada automaticamente e enviada por e-mail; o usuário é forçado a trocar no primeiro login.

## Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local      # preencha as credenciais Microsoft
npm run dev
```

App disponível em `http://localhost:3000/`.

## Estrutura

```
alz-nota-futura/
├── backend/                 # Django + DRF + JWT + Microsoft OAuth + unfold
│   ├── apps/
│   │   ├── authentication/  # CustomUser, InternalUserRole, OAuth
│   │   └── core/            # health check
│   └── config/              # settings, urls, unfold config
├── frontend/                # Next.js 16 + Tailwind 4 + React Query + MSAL
│   ├── app/
│   │   ├── (auth)/          # login, forgot/reset-password, force-password-change
│   │   └── (dashboard)/     # layout com Sidebar + DashboardPageGuard
│   ├── components/
│   ├── lib/
│   └── types/
├── docs/                    # especificação funcional e técnica
└── IMPLEMENTATION_PLAN.md   # plano de scaffolding
```

## Regras arquiteturais

- **Apenas Microsoft OAuth + e-mail/senha** — Google OAuth não é suportado.
- **Papéis internos**: `COMERCIAL`, `LOGISTICS`, `FISCAL`, `ADMIN`.
- `PAGE_PERMISSION_RULES = {}` — todas as páginas liberadas para usuários autenticados até que regras sejam definidas.
- Todos os modelos de domínio devem ser registrados no admin do django-unfold.

## Regras para agentes de IA

- **Nunca fazer commit.** Agentes não devem executar `git commit`, `git push`, `git add` nem gerar mensagens de commit. O operador humano é responsável por todos os commits. Comandos git somente-leitura (`git status`, `git diff`, `git log`) são permitidos.

## Documentação

- [docs/01-project-overview.md](docs/01-project-overview.md)
- [docs/02-pages-and-ui.md](docs/02-pages-and-ui.md)
- [docs/03-database-schema.md](docs/03-database-schema.md)
- [docs/04-business-rules.md](docs/04-business-rules.md)
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
