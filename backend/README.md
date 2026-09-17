# Compliance Scanner Backend

Node.js REST API for the SIH26034 Legal Metrology Rules Compliance Scanner.

## Requirements
- Node.js 18+
- PostgreSQL

## Setup
1. Clone `RisaMand/inspection-app` (this backend lives in `/backend` on `master` — work directly on `master` or a feature branch off it).
2. `cd backend`
3. Run `npm install`
4. Copy `.env.example` to `.env` and configure your database connection string and JWT secret.
5. Ensure PostgreSQL is running and the database exists.

## Database Initialization
1. Run `npm run migrate` to create tables.
2. Run `npm run seed` to insert development users and mock rules.

### Seed Users
- `admin@compliance.local` / `password123`
- `official@compliance.local` / `password123`
- `inspector@compliance.local` / `password123`

## Running the Server
- Development: `npm run dev`
- Production: `npm start`
- Tests: `npm test`

## Documentation
- [API Documentation](./docs/API.md)
- [Integration Contracts](./docs/INTEGRATION_CONTRACTS.md)
