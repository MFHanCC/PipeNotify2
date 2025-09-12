# Claude Code Full Setup Configuration

Complete Claude Code configuration for the Pipenotify2 project with autonomous monitoring, testing, and deployment capabilities.

## 🚀 Quick Start

```bash
make claude-full-setup
```

## 📁 Configuration Files

| File | Purpose |
|------|---------|
| `settings.json` | Core Claude permissions, MCP servers, project settings |
| `browser-config.json` | Multi-browser testing, performance monitoring |
| `monitoring.json` | Comprehensive monitoring, alerting, autonomous actions |
| `hooks.json` | Git hooks, deployment validation, error recovery |
| `project-context.json` | Project architecture, known issues, workflows |
| `workspace.json` | Directory structure, conventions, common commands |
| `setup-validation.json` | Setup validation checklist and troubleshooting |

## 🔧 Features Enabled

### MCP Server Integration
- **Context7**: Official documentation and framework patterns
- **Sequential Thinking**: Complex debugging and multi-step analysis  
- **Magic**: UI component generation from 21st.dev patterns
- **Morphllm**: Bulk code transformations and pattern enforcement
- **Playwright**: Browser automation and E2E testing

### Autonomous Capabilities
- ✅ Automatic error detection and fixing
- ✅ Performance optimization
- ✅ Build failure resolution
- ✅ Database query optimization
- ✅ Security vulnerability patching
- ✅ Service restart on critical errors

### Monitoring Coverage
- 🔍 Multi-browser testing (Chrome, Firefox, Safari)
- 🔍 Railway backend monitoring (CPU, memory, database)
- 🔍 Vercel frontend monitoring (console errors, performance)
- 🔍 Business metrics (webhook success, notification delivery)
- 🔍 Critical issue tracking (tenant rule validation)

### Quality Gates
- 📊 Test coverage threshold: 80%
- 📊 Performance budget: 3000ms
- 📊 Bundle size limit: 5MB
- 📊 Accessibility score: 90+
- 📊 Lighthouse performance: 85+

## 🎯 Critical Issue Tracking

The configuration automatically monitors and fixes:

1. **Tenant Rule Validation**: Detects tenants with zero notification rules
2. **Webhook Delivery Failures**: Tracks consecutive delivery failures
3. **Stalled Queue Jobs**: Monitors Redis queue health
4. **Performance Degradation**: Alerts on response time increases
5. **Error Rate Spikes**: Automated investigation and recovery

## 📊 Monitoring Dashboard

Access real-time monitoring at:
```bash
make claude-dashboard
# Opens: http://localhost:8080
```

## 🔒 Security & Permissions

Claude has autonomous permissions for:
- ✅ Code analysis and editing
- ✅ Test execution and validation  
- ✅ Build and deployment operations
- ✅ Performance optimization
- ✅ Error investigation and fixing
- ❌ System-level operations (blocked)
- ❌ Destructive file operations (blocked)

## 🚨 Emergency Controls

If autonomous actions need to be disabled:

```bash
# Edit .claude/settings.json
{
  "permissions": {
    "autonomous": false,
    "auto_fix": false
  }
}
```

## 📈 Usage Patterns

### Development Workflow
1. `make claude-full-setup` - Initial configuration
2. `make claude-autonomous` - Start monitoring
3. Develop with automatic error detection/fixing
4. Automated testing and deployment validation

### Production Monitoring  
- Continuous health checks every 30 minutes
- Automatic issue detection and resolution
- Performance baseline tracking
- Business metric monitoring

## 🔧 Customization

Key configuration points:

- **Monitoring intervals**: `.claude/monitoring.json` → `global_settings.aggregation_interval_minutes`
- **Error thresholds**: `.claude/monitoring.json` → `thresholds`
- **Browser tests**: `.claude/browser-config.json` → `test_scenarios`
- **MCP servers**: `.claude/settings.json` → `mcp_servers`

## 📞 Support

For issues with Claude Code configuration:
1. Check setup validation: `cat .claude/setup-validation.json`
2. Validate JSON syntax: `find .claude -name "*.json" -exec jq empty {} \;`
3. Review troubleshooting guide in `setup-validation.json`

---

**Ready for Marketplace Approval**: This configuration provides production-grade monitoring, testing, and reliability required for Pipedrive Marketplace approval.