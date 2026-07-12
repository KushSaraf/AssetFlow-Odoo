@echo off
echo ==============================================
echo  AssetFlow Dependency Installation Script
echo ==============================================
echo.

:: Force execution from the directory containing this batch file
cd /d "%~dp0"

:: 1. Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please download and install Node.js version 18 or higher from https://nodejs.org/
    pause
    exit /b %errorlevel%
)
echo [INFO] Node.js detected.

:: 2. Install Backend dependencies
echo.
echo [INFO] Installing backend dependencies...
cd /d "%~dp0backend"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies.
    cd /d "%~dp0"
    pause
    exit /b %errorlevel%
)

:: 3. Setup SQLite Database
echo.
echo [INFO] Generating Prisma Client and pushing database schema...
cd /d "%~dp0backend"
call npx prisma generate
call npx prisma db push
if %errorlevel% neq 0 (
    echo [ERROR] Failed to push database schema.
    cd /d "%~dp0"
    pause
    exit /b %errorlevel%
)

echo.
echo [INFO] Seeding demo database...
cd /d "%~dp0backend"
call npx ts-node -r dotenv/config prisma/seed.ts
if %errorlevel% neq 0 (
    echo [ERROR] Database seeding failed.
    cd /d "%~dp0"
    pause
    exit /b %errorlevel%
)

:: 4. Install Frontend dependencies
echo.
echo [INFO] Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies.
    cd /d "%~dp0"
    pause
    exit /b %errorlevel%
)

cd /d "%~dp0"

echo.
echo ==============================================
echo  Installation Completed Successfully!
echo ==============================================
echo  To run the application:
echo   - Start backend: cd backend ^&^& npm run start:dev
echo   - Start frontend: cd frontend ^&^& npm run dev
echo ==============================================
pause
