# Phase 1 Setup Script for IPD Dashboard Authentication
# Run this script to install dependencies and prepare for authentication setup

Write-Host "`n==============================================`n" -ForegroundColor Cyan
Write-Host "  IPD DASHBOARD - PHASE 1 SETUP" -ForegroundColor Cyan
Write-Host "  Authentication & RBAC Implementation" -ForegroundColor Cyan
Write-Host "`n==============================================`n" -ForegroundColor Cyan

# Check if we're in the project root
if (!(Test-Path ".\server")) {
    Write-Host "❌ Error: Please run this script from the IPD26.10 project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found project structure`n" -ForegroundColor Green

# Step 1: Install Backend Dependencies
Write-Host "📦 Step 1: Installing backend dependencies..." -ForegroundColor Yellow
Set-Location server
Write-Host "   Installing bcryptjs and jsonwebtoken..." -ForegroundColor Gray
npm install bcryptjs jsonwebtoken --save
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Backend dependencies installed`n" -ForegroundColor Green
} else {
    Write-Host "   ❌ Failed to install backend dependencies`n" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..

# Step 2: Check PostgreSQL Connection
Write-Host "🗄️  Step 2: Checking database connection..." -ForegroundColor Yellow
$dbCheck = node -e "const {pool} = require('./server/database/config'); pool.query('SELECT 1').then(() => {console.log('OK'); process.exit(0)}).catch(() => {console.log('FAIL'); process.exit(1)})" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Database connection successful`n" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Warning: Cannot connect to database. Please check PostgreSQL is running.`n" -ForegroundColor Yellow
}

# Step 3: Generate JWT Secret
Write-Host "🔑 Step 3: Generating JWT secret..." -ForegroundColor Yellow
$jwtSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Write-Host "   Generated JWT Secret: $jwtSecret" -ForegroundColor Gray

# Step 4: Update .env file
Write-Host "`n⚙️  Step 4: Configuring environment variables..." -ForegroundColor Yellow
$envPath = ".\server\.env"

if (Test-Path $envPath) {
    # Check if JWT_SECRET already exists
    $envContent = Get-Content $envPath -Raw
    if ($envContent -notmatch "JWT_SECRET") {
        Add-Content -Path $envPath -Value "`n# Authentication Configuration (Added by setup script)"
        Add-Content -Path $envPath -Value "JWT_SECRET=$jwtSecret"
        Add-Content -Path $envPath -Value "JWT_EXPIRY=24h"
        Add-Content -Path $envPath -Value "CORS_ORIGIN=http://localhost:3000"
        Write-Host "   ✅ Environment variables added to server/.env`n" -ForegroundColor Green
    } else {
        Write-Host "   ℹ️  JWT_SECRET already exists in .env, skipping...`n" -ForegroundColor Cyan
    }
} else {
    Write-Host "   ⚠️  Warning: server/.env not found. Please create it manually.`n" -ForegroundColor Yellow
    Write-Host "   Add these lines to server/.env:" -ForegroundColor Gray
    Write-Host "   JWT_SECRET=$jwtSecret" -ForegroundColor Gray
    Write-Host "   JWT_EXPIRY=24h" -ForegroundColor Gray
    Write-Host "   CORS_ORIGIN=http://localhost:3000`n" -ForegroundColor Gray
}

# Step 5: Frontend .env
Write-Host "⚙️  Step 5: Configuring frontend environment..." -ForegroundColor Yellow
$frontendEnvPath = ".\.env"
if (!(Test-Path $frontendEnvPath)) {
    "REACT_APP_API_URL=http://localhost:3001" | Out-File -FilePath $frontendEnvPath -Encoding UTF8
    Write-Host "   ✅ Created .env file in project root`n" -ForegroundColor Green
} else {
    Write-Host "   ✅ Frontend .env already exists`n" -ForegroundColor Green
}

# Step 6: Database Migration Instructions
Write-Host "🗄️  Step 6: Database migration required..." -ForegroundColor Yellow
Write-Host "   Run this command to create authentication tables:" -ForegroundColor Gray
Write-Host "   psql -U postgres -d IPDashboard -f server\migrations\001_create_users_tables.sql`n" -ForegroundColor Cyan

Write-Host "`n==============================================`n" -ForegroundColor Cyan
Write-Host "  ✅ PHASE 1 SETUP COMPLETE!" -ForegroundColor Green
Write-Host "`n==============================================`n" -ForegroundColor Cyan

Write-Host "📋 NEXT STEPS:`n" -ForegroundColor Yellow
Write-Host "1. Run the database migration:" -ForegroundColor White
Write-Host "   cd server" -ForegroundColor Gray
Write-Host "   psql -U postgres -d IPDashboard -f migrations\001_create_users_tables.sql`n" -ForegroundColor Gray

Write-Host "2. Start the backend server:" -ForegroundColor White
Write-Host "   cd server" -ForegroundColor Gray
Write-Host "   npm start`n" -ForegroundColor Gray

Write-Host "3. Start the frontend (in new terminal):" -ForegroundColor White
Write-Host "   npm start`n" -ForegroundColor Gray

Write-Host "4. Open browser and go to:" -ForegroundColor White
Write-Host "   http://localhost:3000`n" -ForegroundColor Gray

Write-Host "5. Login with default admin credentials:" -ForegroundColor White
Write-Host "   Email: admin@interplast.com" -ForegroundColor Gray
Write-Host "   Password: Admin@123`n" -ForegroundColor Gray

Write-Host "⚠️  IMPORTANT: Change the default admin password after first login!`n" -ForegroundColor Yellow

Write-Host "📖 For detailed instructions, see: PHASE1_IMPLEMENTATION_GUIDE.md`n" -ForegroundColor Cyan

Write-Host "==============================================`n" -ForegroundColor Cyan
