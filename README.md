# College Fee Tracking — Local-first (Initial Setup)

This repository contains a local-first College Fee Tracking System skeleton.

Overview
- Backend: Node.js + Express + TypeScript + SQLite (better-sqlite3)
- Frontend: React + Vite + TypeScript + Tailwind CSS
- File uploads: Multer (local storage)

Quick start

1) Install dependencies

From repository root, run:

```bash
cd server
npm install

cd ../client
npm install
```

2) Configure environment

Create a `.env` in `server/` (copy from `.env.example`) and adjust values as needed.

3) Run backend

```bash
cd server
npm run dev
```

This starts the API on `0.0.0.0:5000` by default.

4) Run frontend

```bash
cd client
npm run dev
```

Open the UI in your browser. The frontend uses `VITE_API_BASE` (if set) or derives API host from the current hostname and `VITE_API_PORT`.

Notes
- The server creates `college.db` (SQLite) and enables WAL mode. This setup uses the `sqlite3` driver (no native build tools required on most systems).
- Uploads are served statically from `/uploads` and saved under `uploads/students`.
- For local network access, run the server on a machine with IP `192.168.x.x` and access from other devices via that IP.

What's included
- `server/` — Express API, DB setup, health and upload endpoints.
- `client/` — Vite React app with a nice landing page and Tailwind setup.

Next steps
- Implement student CRUD and fees module
- Authentication and admin UI
- Validation and tests
