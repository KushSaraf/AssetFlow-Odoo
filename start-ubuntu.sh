#!/bin/bash

# Exit on error for initial setup
set -e

echo "========================================="
echo " Starting AssetFlow Development Stack"
echo "========================================="

# 1. Setup Backend & DB Schema
echo ">>> [1/3] Setting up Database Schema & Seeding (SQLite)..."
cd backend
echo 'DATABASE_URL="file:./dev.db"' > .env
echo "Created/Updated backend/.env file."

if [ ! -d "node_modules" ]; then
  echo "Installing backend dependencies..."
  npm install
fi

npx prisma generate
npx prisma db push
npx prisma db seed
echo "Database ready!"

# Turn off exit on error so that manual stopping doesn't immediately crash everything
set +e

# 2. Start Backend
echo ">>> [2/3] Starting Backend (NestJS on port 4000)..."
npm run start:dev &
BACKEND_PID=$!
cd ..

# 3. Start Frontend
echo ">>> [3/3] Starting Frontend (Next.js on port 3000)..."
cd frontend
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi
npm run dev &
FRONTEND_PID=$!
cd ..

echo "========================================="
echo " All services are starting up!"
echo " Frontend: http://localhost:3000"
echo " Backend : http://localhost:4000"
echo ""
echo " Press Ctrl+C to stop all services."
echo "========================================="

# Trap SIGINT to gracefully kill background processes
trap "echo -e '\nStopping all services...'; kill $BACKEND_PID $FRONTEND_PID; echo 'Done!'; exit 0" SIGINT SIGTERM

# Wait indefinitely for processes
wait $BACKEND_PID $FRONTEND_PID
