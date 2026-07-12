@echo off
echo =========================================
echo  Starting AssetFlow Development Stack
echo =========================================

echo ^> [1/3] Setting up Database Schema ^& Seeding (SQLite)...
cd backend
echo DATABASE_URL="file:./dev.db" > .env
echo JWT_SECRET="supersecretkey" >> .env
echo Created/Updated backend/.env file.
call npx prisma generate
call npx prisma db push
call npx prisma db seed
echo Database ready!
cd ..

echo ^> [2/3] Starting Backend (NestJS on port 4000)...
cd backend
start "AssetFlow Backend" cmd /k "npm run start:dev"
cd ..

echo ^> [3/3] Starting Frontend (Next.js on port 3000)...
cd frontend
start "AssetFlow Frontend" cmd /k "npm run dev"
cd ..

echo =========================================
echo  All services are starting up!
echo  Frontend: http://localhost:3000
echo  Backend : http://localhost:4000
echo.
echo  Note: This opened two new terminal windows for the frontend and backend.
echo  To stop the services, simply close those terminal windows.
echo =========================================
pause
