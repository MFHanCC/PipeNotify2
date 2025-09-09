# Pipedrive → Google Chat Integration - Development Commands
# Railway backend + Vercel frontend with Claude Code full-visibility monitoring

.PHONY: help setup dev dev-backend dev-frontend claude-autonomous claude-monitor claude-dashboard test build clean

# Default target
help:
	@echo "🚀 Pipedrive → Google Chat Integration - Development Commands"
	@echo ""
	@echo "📋 Available Commands:"
	@echo "  setup              - Initial project setup"
	@echo "  dev                - Start both backend and frontend development servers"
	@echo "  dev-backend        - Start backend development server only"
	@echo "  dev-frontend       - Start frontend development server only"
	@echo "  claude-autonomous  - Start Claude Code in autonomous monitoring mode"
	@echo "  claude-monitor     - Start monitoring systems only"
	@echo "  claude-dashboard   - Open monitoring dashboard"
	@echo "  test               - Run all tests"
	@echo "  build              - Build for production"
	@echo "  clean              - Clean node_modules and build files"
	@echo ""
	@echo "🎯 For marketplace approval, use: make claude-autonomous"

# Initial project setup
setup:
	@echo "🔧 Setting up Pipedrive → Google Chat Integration..."
	@echo "📦 Installing backend dependencies..."
	cd backend && npm install
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install
	@echo "📦 Installing monitoring dependencies..."
	mkdir -p monitoring && cd monitoring && npm init -y && npm install playwright ws
	@echo "✅ Setup complete!"

# Development commands
dev:
	@echo "🚀 Starting development servers..."
	@make dev-backend &
	@make dev-frontend &
	@echo "✅ Backend: http://localhost:3001"
	@echo "✅ Frontend: http://localhost:3000"

dev-backend:
	@echo "🔧 Starting backend development server..."
	cd backend && npm run dev

dev-frontend:
	@echo "🎨 Starting frontend development server..."
	cd frontend && npm start

# Claude Code autonomous monitoring
claude-autonomous:
	@echo "🚀 Starting Claude Code in AUTONOMOUS mode with full visibility..."
	@echo "⚠️  Claude will have complete monitoring and error-fixing capabilities"
	@echo "⚠️  This includes browser automation, deployment monitoring, and autonomous fixes"
	@echo "⚠️  All errors will be automatically detected and addressed"
	@echo ""
	@echo "📊 Monitoring includes:"
	@echo "   ✅ Real-time browser testing across Chrome, Firefox, Safari"
	@echo "   ✅ Railway backend logs and performance metrics"
	@echo "   ✅ Vercel deployment status and frontend errors"
	@echo "   ✅ GitHub Actions build status and failures"
	@echo "   ✅ Database query performance and API response times"
	@echo "   ✅ Console errors and network request failures"
	@echo ""
	@echo "🤖 Autonomous actions enabled:"
	@echo "   🔧 Automatic JavaScript error fixing"
	@echo "   🔧 Build failure resolution and redeployment"
	@echo "   🔧 Performance optimization"
	@echo "   🔧 CORS and networking issue resolution"
	@echo "   🔧 Security vulnerability patching"
	@echo ""
	@echo "Press Ctrl+C within 10 seconds to cancel..."
	@sleep 10
	./scripts/claude-autonomous.sh

# Monitoring only (without autonomous fixes)
claude-monitor:
	@echo "📊 Starting monitoring systems without autonomous fixes..."
	@echo "🔍 Error detection and logging enabled"
	@echo "⚠️  Manual intervention required for fixes"
	./scripts/claude-autonomous.sh

# Open monitoring dashboard
claude-dashboard:
	@echo "🎛️ Opening monitoring dashboard..."
	@echo "📊 Dashboard URL: http://localhost:8080"
	@echo "📁 Logs directory: ./logs/"
	@echo "🚨 Claude alerts: ./logs/claude-alerts/"
	open http://localhost:8080 || echo "Open http://localhost:8080 manually"

# Testing
test:
	@echo "🧪 Running all tests..."
	cd backend && npm test
	cd frontend && npm test

# Production build
build:
	@echo "🏗️ Building for production..."
	cd backend && npm run build
	cd frontend && npm run build
	@echo "✅ Production build complete!"

# Cleanup
clean:
	@echo "🧹 Cleaning up..."
	rm -rf backend/node_modules backend/dist backend/build
	rm -rf frontend/node_modules frontend/build frontend/dist
	rm -rf monitoring/node_modules
	rm -rf logs/
	@echo "✅ Cleanup complete!"

# Railway deployment
deploy-railway:
	@echo "🚂 Deploying backend to Railway..."
	cd backend && railway deploy

# Vercel deployment
deploy-vercel:
	@echo "🔼 Deploying frontend to Vercel..."
	cd frontend && vercel --prod

# Full deployment
deploy: build deploy-railway deploy-vercel
	@echo "🚀 Full deployment complete!"
	@echo "✅ Backend deployed to Railway"
	@echo "✅ Frontend deployed to Vercel"