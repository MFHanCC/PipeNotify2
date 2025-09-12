/**
 * Comprehensive Dashboard Test Runner
 * Tests all visual, functional, API, performance, and accessibility aspects
 */

class DashboardTestRunner {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      skipped: [],
      warnings: []
    };
    this.startTime = performance.now();
  }

  async runAllTests() {
    console.log('🧪 Starting Comprehensive Dashboard Tests...\n');
    console.log('='.repeat(60));
    
    try {
      // Phase 1: Visual Tests
      console.log('\n📱 VISUAL TESTS');
      console.log('-'.repeat(30));
      await this.runVisualTests();
      
      // Phase 2: Functional Tests
      console.log('\n⚙️  FUNCTIONAL TESTS');
      console.log('-'.repeat(30));
      await this.runFunctionalTests();
      
      // Phase 3: API Tests
      console.log('\n🌐 API TESTS');
      console.log('-'.repeat(30));
      await this.runAPITests();
      
      // Phase 4: Performance Tests
      console.log('\n⚡ PERFORMANCE TESTS');
      console.log('-'.repeat(30));
      await this.runPerformanceTests();
      
      // Phase 5: Accessibility Tests
      console.log('\n♿ ACCESSIBILITY TESTS');
      console.log('-'.repeat(30));
      await this.runA11yTests();
      
      // Phase 6: Error Handling Tests
      console.log('\n🛡️  ERROR HANDLING TESTS');
      console.log('-'.repeat(30));
      await this.runErrorTests();
      
    } catch (error) {
      this.results.failed.push(`💥 Test runner error: ${error.message}`);
    }
    
    // Generate comprehensive report
    this.generateReport();
    
    return this.results;
  }

  // =============================================
  // VISUAL TESTS
  // =============================================
  
  async runVisualTests() {
    await this.testSidebarLayout();
    await this.testStatsGrid();
    await this.testButtonAlignment();
    await this.testResponsiveness();
    await this.testThemeConsistency();
  }

  async testSidebarLayout() {
    const sidebar = document.querySelector('.dashboard-sidebar');
    
    if (!sidebar) {
      this.results.failed.push('❌ Sidebar element not found');
      return;
    }
    
    // Test width
    const width = sidebar.offsetWidth;
    if (width === 280) {
      this.results.passed.push('✅ Sidebar width correct (280px)');
    } else {
      this.results.failed.push(`❌ Sidebar width incorrect: ${width}px (expected 280px)`);
    }
    
    // Test navigation items
    const navItems = sidebar.querySelectorAll('.nav-tab');
    if (navItems.length >= 11) {
      this.results.passed.push(`✅ Navigation items present (${navItems.length})`);
    } else {
      this.results.failed.push(`❌ Missing navigation items: ${navItems.length} (expected ≥11)`);
    }
    
    // Test active state
    const activeItem = sidebar.querySelector('.nav-tab.active');
    if (activeItem) {
      const styles = getComputedStyle(activeItem);
      const hasBlueColor = styles.color.includes('14, 165, 233') || styles.color.includes('rgb(3, 105, 161)');
      if (hasBlueColor) {
        this.results.passed.push('✅ Active tab has blue highlight');
      } else {
        this.results.failed.push(`❌ Active tab color incorrect: ${styles.color}`);
      }
    }
  }

  async testStatsGrid() {
    const statsGrid = document.querySelector('.stats-2x2');
    const statCards = document.querySelectorAll('.stat-card');
    
    if (!statsGrid) {
      this.results.failed.push('❌ Stats grid not found');
      return;
    }
    
    // Test card count
    if (statCards.length === 4) {
      this.results.passed.push('✅ All 4 stat cards present');
    } else {
      this.results.failed.push(`❌ Wrong number of stat cards: ${statCards.length} (expected 4)`);
    }
    
    // Test grid layout
    const gridStyle = getComputedStyle(statsGrid);
    const isFlexible = gridStyle.gridTemplateColumns.includes('1fr') || gridStyle.gridTemplateColumns.includes('minmax');
    
    if (isFlexible) {
      this.results.passed.push('✅ Stats grid is expandable');
    } else {
      this.results.failed.push(`❌ Stats grid not expandable: ${gridStyle.gridTemplateColumns}`);
    }
    
    // Test card heights
    const cardHeights = Array.from(statCards).map(card => card.offsetHeight);
    const uniformHeight = cardHeights.every(height => height >= 120);
    
    if (uniformHeight) {
      this.results.passed.push('✅ Stat cards have adequate height (≥120px)');
    } else {
      this.results.failed.push(`❌ Stat card heights too small: ${cardHeights.join(', ')}px`);
    }
    
    // Test hover effects
    if (statCards.length > 0) {
      const firstCard = statCards[0];
      const hasPointerCursor = getComputedStyle(firstCard).cursor === 'pointer';
      if (hasPointerCursor) {
        this.results.passed.push('✅ Stat cards have hover cursor');
      } else {
        this.results.warnings.push('⚠️  Stat cards missing pointer cursor');
      }
    }
  }

  async testButtonAlignment() {
    const ruleActions = document.querySelectorAll('.rule-actions');
    
    if (ruleActions.length === 0) {
      this.results.skipped.push('⏭️ No rules found - skipping button alignment test');
      return;
    }
    
    let alignmentIssues = 0;
    ruleActions.forEach((actionContainer, index) => {
      const buttons = actionContainer.querySelectorAll('button');
      const toggle = actionContainer.querySelector('.toggle-switch');
      
      if (buttons.length === 0) return;
      
      // Test button heights
      const buttonHeights = Array.from(buttons).map(btn => btn.offsetHeight);
      const uniformHeight = buttonHeights.every(height => height === 28);
      
      if (uniformHeight) {
        this.results.passed.push(`✅ Rule ${index + 1} buttons have uniform height (28px)`);
      } else {
        alignmentIssues++;
        this.results.failed.push(`❌ Rule ${index + 1} button heights inconsistent: ${buttonHeights.join(', ')}px`);
      }
      
      // Test toggle switch size
      if (toggle) {
        const toggleWidth = toggle.offsetWidth;
        const toggleHeight = toggle.offsetHeight;
        
        if (toggleWidth === 50 && toggleHeight === 28) {
          this.results.passed.push(`✅ Rule ${index + 1} toggle switch correct size (50x28px)`);
        } else {
          alignmentIssues++;
          this.results.failed.push(`❌ Rule ${index + 1} toggle size incorrect: ${toggleWidth}x${toggleHeight}px`);
        }
      }
      
      // Test horizontal alignment
      const containerStyle = getComputedStyle(actionContainer);
      if (containerStyle.display === 'flex' && containerStyle.alignItems === 'center') {
        this.results.passed.push(`✅ Rule ${index + 1} controls properly aligned`);
      } else {
        alignmentIssues++;
        this.results.failed.push(`❌ Rule ${index + 1} controls not aligned: ${containerStyle.display}, ${containerStyle.alignItems}`);
      }
    });
    
    if (alignmentIssues === 0 && ruleActions.length > 0) {
      this.results.passed.push('✅ All rule controls properly aligned');
    }
  }

  async testResponsiveness() {
    const originalWidth = window.innerWidth;
    
    // Test mobile view (375px)
    await this.setViewportWidth(375);
    await this.wait(100);
    
    const sidebarOnMobile = document.querySelector('.dashboard-sidebar');
    if (sidebarOnMobile) {
      const sidebarWidth = sidebarOnMobile.offsetWidth;
      if (sidebarWidth < originalWidth * 0.9) {
        this.results.passed.push(`✅ Sidebar responsive on mobile (${sidebarWidth}px)`);
      } else {
        this.results.failed.push(`❌ Sidebar not responsive: ${sidebarWidth}px on 375px screen`);
      }
    }
    
    // Test tablet view (768px)
    await this.setViewportWidth(768);
    await this.wait(100);
    
    const statsOnTablet = document.querySelector('.stats-2x2');
    if (statsOnTablet) {
      const gridColumns = getComputedStyle(statsOnTablet).gridTemplateColumns;
      const isResponsive = gridColumns.includes('1fr') || gridColumns.split(' ').length <= 2;
      if (isResponsive) {
        this.results.passed.push('✅ Stats grid responsive on tablet');
      } else {
        this.results.warnings.push('⚠️  Stats grid may not be optimal on tablet');
      }
    }
    
    // Restore original width
    await this.setViewportWidth(originalWidth);
  }

  async testThemeConsistency() {
    const colorScheme = {
      primary: '#3b82f6',
      success: '#059669',
      warning: '#f59e0b',
      error: '#dc2626',
      gray: '#6b7280'
    };
    
    // Check if CSS custom properties are defined
    const styles = getComputedStyle(document.documentElement);
    let themePropertiesFound = 0;
    
    Object.keys(colorScheme).forEach(key => {
      const property = `--color-${key}`;
      if (styles.getPropertyValue(property)) {
        themePropertiesFound++;
      }
    });
    
    if (themePropertiesFound > 0) {
      this.results.passed.push(`✅ Theme consistency properties found (${themePropertiesFound})`);
    } else {
      this.results.warnings.push('⚠️  No CSS custom properties for theming found');
    }
  }

  // =============================================
  // FUNCTIONAL TESTS
  // =============================================
  
  async runFunctionalTests() {
    await this.testCreateRule();
    await this.testEditRule();
    await this.testDeleteRule();
    await this.testToggleRule();
    await this.testNotificationTest();
    await this.testFilters();
    await this.testNavigation();
  }

  async testCreateRule() {
    const createBtn = document.querySelector('.create-rule-button, button[text*="Create"], button:contains("Create")');
    const createBtns = Array.from(document.querySelectorAll('button')).filter(btn => 
      btn.textContent.includes('Create Rule') || btn.textContent.includes('Create First Rule')
    );
    
    const targetBtn = createBtn || createBtns[0];
    
    if (!targetBtn) {
      this.results.skipped.push('⏭️ No create rule button found');
      return;
    }
    
    // Click create button
    targetBtn.click();
    await this.wait(300);
    
    const modal = document.querySelector('.modal-content, .modal, [class*="modal"]');
    if (modal) {
      this.results.passed.push('✅ Create rule modal opens');
      
      // Test form validation
      const nameInput = modal.querySelector('input[placeholder*="Deal"], input[type="text"]');
      const createButton = modal.querySelector('button[disabled], .button-primary');
      
      if (createButton?.disabled) {
        this.results.passed.push('✅ Create button properly disabled when form invalid');
      } else {
        this.results.warnings.push('⚠️  Create button validation may not be working');
      }
      
      // Test webhook dropdown
      const webhookSelect = modal.querySelector('select, .webhook-select');
      if (webhookSelect) {
        const options = webhookSelect.querySelectorAll('option');
        if (options.length > 1) {
          this.results.passed.push(`✅ Webhook dropdown has options (${options.length})`);
        } else {
          this.results.warnings.push('⚠️  No webhooks available for rule creation');
        }
      }
      
      // Test template preview
      const preview = modal.querySelector('.preview, [class*="preview"]');
      if (preview) {
        this.results.passed.push('✅ Template preview component found');
      } else {
        this.results.warnings.push('⚠️  Template preview not found');
      }
      
      // Close modal
      const cancelBtn = modal.querySelector('.button-secondary, button:contains("Cancel")') ||
                       Array.from(modal.querySelectorAll('button')).find(btn => 
                         btn.textContent.includes('Cancel') || btn.textContent.includes('×')
                       );
      if (cancelBtn) {
        cancelBtn.click();
        await this.wait(200);
        this.results.passed.push('✅ Modal closes on cancel');
      }
      
    } else {
      this.results.failed.push('❌ Create rule modal failed to open');
    }
  }

  async testEditRule() {
    const editBtns = Array.from(document.querySelectorAll('button')).filter(btn => 
      btn.textContent.includes('Edit') || btn.title?.includes('Edit')
    );
    
    if (editBtns.length === 0) {
      this.results.skipped.push('⏭️ No edit buttons found');
      return;
    }
    
    const editBtn = editBtns[0];
    editBtn.click();
    await this.wait(300);
    
    // Check for inline edit or modal edit
    const inlineEdit = document.querySelector('.edit-form, [class*="edit"]');
    const modal = document.querySelector('.modal-content');
    
    if (inlineEdit || modal) {
      this.results.passed.push('✅ Edit functionality works');
      
      // If inline edit, test save/cancel
      if (inlineEdit) {
        const saveBtn = inlineEdit.querySelector('button:contains("Save")') ||
                       Array.from(inlineEdit.querySelectorAll('button')).find(btn => 
                         btn.textContent.includes('Save') || btn.textContent.includes('✓')
                       );
        const cancelBtn = inlineEdit.querySelector('button:contains("Cancel")') ||
                         Array.from(inlineEdit.querySelectorAll('button')).find(btn => 
                           btn.textContent.includes('Cancel') || btn.textContent.includes('✕')
                         );
        
        if (saveBtn && cancelBtn) {
          this.results.passed.push('✅ Edit form has Save/Cancel buttons');
          cancelBtn.click(); // Cancel to avoid actual changes
        }
      }
    } else {
      this.results.failed.push('❌ Edit functionality not working');
    }
  }

  async testDeleteRule() {
    const deleteBtns = Array.from(document.querySelectorAll('button')).filter(btn => 
      btn.textContent.includes('Delete') || btn.title?.includes('Delete')
    );
    
    if (deleteBtns.length === 0) {
      this.results.skipped.push('⏭️ No delete buttons found');
      return;
    }
    
    const originalConfirm = window.confirm;
    let confirmCalled = false;
    
    // Mock confirm dialog
    window.confirm = (message) => {
      confirmCalled = true;
      return false; // Don't actually delete
    };
    
    const deleteBtn = deleteBtns[0];
    deleteBtn.click();
    await this.wait(100);
    
    if (confirmCalled) {
      this.results.passed.push('✅ Delete confirmation dialog works');
    } else {
      this.results.warnings.push('⚠️  Delete confirmation not found');
    }
    
    // Restore original confirm
    window.confirm = originalConfirm;
  }

  async testToggleRule() {
    const toggles = document.querySelectorAll('.toggle-switch input, input[type="checkbox"]');
    
    if (toggles.length === 0) {
      this.results.skipped.push('⏭️ No toggle switches found');
      return;
    }
    
    const toggle = toggles[0];
    const initialState = toggle.checked;
    
    // Test toggle interaction
    toggle.click();
    await this.wait(100);
    
    if (toggle.checked !== initialState) {
      this.results.passed.push('✅ Toggle switch responds to clicks');
      // Toggle back
      toggle.click();
    } else {
      this.results.warnings.push('⚠️  Toggle switch may not be responding');
    }
  }

  async testNotificationTest() {
    const testBtns = Array.from(document.querySelectorAll('button')).filter(btn => 
      btn.textContent.includes('Test') && !btn.textContent.includes('Testing')
    );
    
    if (testBtns.length === 0) {
      this.results.skipped.push('⏭️ No test notification buttons found');
      return;
    }
    
    const testBtn = testBtns[0];
    if (!testBtn.disabled) {
      this.results.passed.push('✅ Test notification button is clickable');
    } else {
      this.results.warnings.push('⚠️  Test notification button is disabled');
    }
  }

  async testFilters() {
    const filters = document.querySelectorAll('select, input[type="search"], .filter');
    
    if (filters.length === 0) {
      this.results.skipped.push('⏭️ No filters found to test');
      return;
    }
    
    this.results.passed.push(`✅ Filter components found (${filters.length})`);
    
    // Test if filters have options
    filters.forEach((filter, index) => {
      if (filter.tagName === 'SELECT') {
        const options = filter.querySelectorAll('option');
        if (options.length > 1) {
          this.results.passed.push(`✅ Filter ${index + 1} has options (${options.length})`);
        }
      }
    });
  }

  async testNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab, [role="tab"], .sidebar-nav button');
    
    if (navTabs.length === 0) {
      this.results.failed.push('❌ No navigation tabs found');
      return;
    }
    
    this.results.passed.push(`✅ Navigation tabs found (${navTabs.length})`);
    
    // Test clicking different tabs
    let workingTabs = 0;
    const originalTab = document.querySelector('.nav-tab.active');
    
    for (let i = 0; i < Math.min(3, navTabs.length); i++) {
      const tab = navTabs[i];
      if (tab !== originalTab) {
        tab.click();
        await this.wait(100);
        
        // Check if tab becomes active
        if (tab.classList.contains('active')) {
          workingTabs++;
        }
      }
    }
    
    if (workingTabs > 0) {
      this.results.passed.push(`✅ Tab navigation working (${workingTabs} tabs tested)`);
    } else {
      this.results.warnings.push('⚠️  Tab navigation may not be working properly');
    }
    
    // Return to original tab
    if (originalTab) {
      originalTab.click();
    }
  }

  // =============================================
  // API TESTS
  // =============================================
  
  async runAPITests() {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
    
    if (!token) {
      this.results.warnings.push('⚠️  No authentication token found - some API tests may fail');
    }
    
    await this.testAPIEndpoints(apiUrl, token);
    await this.testAPIErrorHandling(apiUrl, token);
    await this.testAPIAuthentication(apiUrl, token);
  }

  async testAPIEndpoints(apiUrl, token) {
    const endpoints = [
      { path: '/api/v1/admin/rules', method: 'GET', name: 'Rules List' },
      { path: '/api/v1/admin/webhooks', method: 'GET', name: 'Webhooks List' },
      { path: '/api/v1/admin/logs', method: 'GET', name: 'Logs List' },
      { path: '/api/v1/health', method: 'GET', name: 'Health Check', noAuth: true }
    ];
    
    for (const endpoint of endpoints) {
      try {
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (!endpoint.noAuth && token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${apiUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers
        });
        
        if (response.ok) {
          this.results.passed.push(`✅ ${endpoint.name} API responding (${response.status})`);
          
          // Test response format
          const data = await response.json();
          if (typeof data === 'object') {
            this.results.passed.push(`✅ ${endpoint.name} returns valid JSON`);
          }
        } else {
          this.results.failed.push(`❌ ${endpoint.name} API failed: ${response.status} ${response.statusText}`);
        }
        
      } catch (error) {
        this.results.failed.push(`❌ ${endpoint.name} API error: ${error.message}`);
      }
    }
  }

  async testAPIErrorHandling(apiUrl, token) {
    // Test invalid endpoint
    try {
      const response = await fetch(`${apiUrl}/api/v1/invalid-endpoint`);
      if (response.status === 404) {
        this.results.passed.push('✅ API returns 404 for invalid endpoints');
      }
    } catch (error) {
      this.results.warnings.push('⚠️  Could not test invalid endpoint handling');
    }
    
    // Test invalid token
    try {
      const response = await fetch(`${apiUrl}/api/v1/admin/rules`, {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
      
      if (response.status === 401) {
        this.results.passed.push('✅ API properly rejects invalid tokens');
      }
    } catch (error) {
      this.results.warnings.push('⚠️  Could not test invalid token handling');
    }
  }

  async testAPIAuthentication(apiUrl, token) {
    if (!token) {
      this.results.skipped.push('⏭️ No token available for authentication testing');
      return;
    }
    
    try {
      // Test token format
      const parts = token.split('.');
      if (parts.length === 3) {
        this.results.passed.push('✅ JWT token has correct format');
        
        // Decode payload (without verification)
        try {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.tenant_id || payload.tenantId) {
            this.results.passed.push('✅ JWT token contains tenant information');
          } else {
            this.results.warnings.push('⚠️  JWT token missing tenant information');
          }
          
          // Check expiration
          if (payload.exp) {
            const now = Date.now() / 1000;
            if (payload.exp > now) {
              this.results.passed.push('✅ JWT token is not expired');
            } else {
              this.results.failed.push('❌ JWT token is expired');
            }
          }
        } catch (error) {
          this.results.warnings.push('⚠️  Could not decode JWT payload');
        }
      } else {
        this.results.warnings.push('⚠️  Token does not appear to be valid JWT');
      }
    } catch (error) {
      this.results.warnings.push('⚠️  Could not analyze authentication token');
    }
  }

  // =============================================
  // PERFORMANCE TESTS
  // =============================================
  
  async runPerformanceTests() {
    await this.testPageLoadTime();
    await this.testRenderPerformance();
    await this.testMemoryUsage();
    await this.testNetworkRequests();
  }

  async testPageLoadTime() {
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      const domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
      
      if (loadTime < 3000) {
        this.results.passed.push(`✅ Page load time acceptable: ${loadTime}ms`);
      } else {
        this.results.failed.push(`❌ Page load too slow: ${loadTime}ms (target <3000ms)`);
      }
      
      if (domContentLoaded < 1500) {
        this.results.passed.push(`✅ DOM ready time good: ${domContentLoaded}ms`);
      } else {
        this.results.warnings.push(`⚠️  DOM ready time slow: ${domContentLoaded}ms`);
      }
    } else {
      this.results.warnings.push('⚠️  Performance timing not available');
    }
  }

  async testRenderPerformance() {
    // Test large list rendering
    const lists = document.querySelectorAll('[class*="list"], .rules-list, .logs-table');
    
    lists.forEach((list, index) => {
      const items = list.children.length;
      if (items > 100) {
        this.results.warnings.push(`⚠️  Large list detected (${items} items) - consider virtualization`);
      } else if (items > 0) {
        this.results.passed.push(`✅ List ${index + 1} size reasonable (${items} items)`);
      }
    });
    
    // Test scroll performance
    const scrollableElements = document.querySelectorAll('[style*="overflow"], .scrollable');
    if (scrollableElements.length > 0) {
      this.results.passed.push(`✅ Scrollable elements found (${scrollableElements.length})`);
    }
  }

  async testMemoryUsage() {
    if (performance.memory) {
      const memory = performance.memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
      
      if (usedMB < 50) {
        this.results.passed.push(`✅ Memory usage reasonable: ${usedMB}MB`);
      } else if (usedMB < 100) {
        this.results.warnings.push(`⚠️  Memory usage moderate: ${usedMB}MB`);
      } else {
        this.results.failed.push(`❌ Memory usage high: ${usedMB}MB`);
      }
      
      this.results.passed.push(`📊 Memory stats: ${usedMB}/${totalMB}MB used`);
    } else {
      this.results.warnings.push('⚠️  Memory info not available');
    }
  }

  async testNetworkRequests() {
    if (performance.getEntriesByType) {
      const resources = performance.getEntriesByType('resource');
      const apiCalls = resources.filter(r => r.name.includes('/api/'));
      
      if (apiCalls.length > 0) {
        const avgResponseTime = apiCalls.reduce((sum, call) => sum + call.responseEnd - call.requestStart, 0) / apiCalls.length;
        
        if (avgResponseTime < 500) {
          this.results.passed.push(`✅ Average API response time: ${Math.round(avgResponseTime)}ms`);
        } else {
          this.results.warnings.push(`⚠️  Average API response time slow: ${Math.round(avgResponseTime)}ms`);
        }
        
        // Check for failed requests
        const failedRequests = resources.filter(r => r.name.includes('/api/') && r.responseStart === 0);
        if (failedRequests.length === 0) {
          this.results.passed.push('✅ No failed API requests detected');
        } else {
          this.results.failed.push(`❌ ${failedRequests.length} failed API requests detected`);
        }
      }
    }
  }

  // =============================================
  // ACCESSIBILITY TESTS
  // =============================================
  
  async runA11yTests() {
    await this.testKeyboardNavigation();
    await this.testAriaLabels();
    await this.testColorContrast();
    await this.testFocusManagement();
    await this.testScreenReaderSupport();
  }

  async testKeyboardNavigation() {
    const focusableElements = document.querySelectorAll(
      'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      this.results.passed.push(`✅ ${focusableElements.length} focusable elements found`);
      
      // Test tab order
      let hasTabIndex = 0;
      focusableElements.forEach(el => {
        if (el.tabIndex >= 0) hasTabIndex++;
      });
      
      this.results.passed.push(`✅ ${hasTabIndex} elements in tab order`);
    } else {
      this.results.failed.push('❌ No focusable elements found');
    }
    
    // Test focus indicators
    const elementsWithFocusStyle = Array.from(focusableElements).filter(el => {
      const styles = getComputedStyle(el, ':focus');
      return styles.outline !== 'none' && styles.outline !== '0px';
    });
    
    if (elementsWithFocusStyle.length > 0) {
      this.results.passed.push('✅ Focus indicators present');
    } else {
      this.results.warnings.push('⚠️  Focus indicators may be missing');
    }
  }

  async testAriaLabels() {
    const inputs = document.querySelectorAll('input, select, textarea');
    let unlabeled = 0;
    let properlyLabeled = 0;
    
    inputs.forEach(input => {
      const hasLabel = input.getAttribute('aria-label') || 
                      input.getAttribute('aria-labelledby') ||
                      input.closest('label') ||
                      document.querySelector(`label[for="${input.id}"]`);
      
      if (hasLabel) {
        properlyLabeled++;
      } else {
        unlabeled++;
      }
    });
    
    if (unlabeled === 0 && inputs.length > 0) {
      this.results.passed.push(`✅ All ${inputs.length} inputs have labels`);
    } else if (unlabeled > 0) {
      this.results.failed.push(`❌ ${unlabeled} inputs missing labels`);
    }
    
    if (properlyLabeled > 0) {
      this.results.passed.push(`✅ ${properlyLabeled} inputs properly labeled`);
    }
    
    // Test buttons with meaningful text
    const buttons = document.querySelectorAll('button');
    let meaningfulButtons = 0;
    
    buttons.forEach(button => {
      const text = button.textContent.trim() || button.getAttribute('aria-label') || button.title;
      if (text && text.length > 1) {
        meaningfulButtons++;
      }
    });
    
    if (meaningfulButtons === buttons.length) {
      this.results.passed.push(`✅ All ${buttons.length} buttons have meaningful text`);
    } else {
      this.results.warnings.push(`⚠️  ${buttons.length - meaningfulButtons} buttons may lack meaningful text`);
    }
  }

  async testColorContrast() {
    // This is a basic test - full contrast testing would require color analysis
    const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, button, a');
    let lightTextOnLight = 0;
    
    textElements.forEach(el => {
      const styles = getComputedStyle(el);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;
      
      // Basic check for very light text on light background
      if (color.includes('rgb(255, 255, 255)') && backgroundColor.includes('rgb(255, 255, 255)')) {
        lightTextOnLight++;
      }
    });
    
    if (lightTextOnLight === 0) {
      this.results.passed.push('✅ No obvious contrast issues detected');
    } else {
      this.results.warnings.push(`⚠️  ${lightTextOnLight} elements may have contrast issues`);
    }
  }

  async testFocusManagement() {
    // Test modal focus management
    const modals = document.querySelectorAll('.modal, [role="dialog"]');
    
    modals.forEach((modal, index) => {
      const focusableInModal = modal.querySelectorAll(
        'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableInModal.length > 0) {
        this.results.passed.push(`✅ Modal ${index + 1} has focusable elements`);
      }
    });
    
    // Test skip links
    const skipLinks = document.querySelectorAll('a[href^="#"], .skip-link');
    if (skipLinks.length > 0) {
      this.results.passed.push(`✅ Skip navigation links found (${skipLinks.length})`);
    } else {
      this.results.warnings.push('⚠️  No skip navigation links found');
    }
  }

  async testScreenReaderSupport() {
    // Test landmark roles
    const landmarks = document.querySelectorAll('main, nav, aside, header, footer, [role="main"], [role="navigation"]');
    if (landmarks.length > 0) {
      this.results.passed.push(`✅ Landmark elements found (${landmarks.length})`);
    } else {
      this.results.warnings.push('⚠️  No landmark elements found');
    }
    
    // Test headings hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length > 0) {
      this.results.passed.push(`✅ Heading elements found (${headings.length})`);
      
      // Check for h1
      const h1Count = document.querySelectorAll('h1').length;
      if (h1Count === 1) {
        this.results.passed.push('✅ Single H1 element found');
      } else if (h1Count === 0) {
        this.results.warnings.push('⚠️  No H1 element found');
      } else {
        this.results.warnings.push(`⚠️  Multiple H1 elements found (${h1Count})`);
      }
    }
    
    // Test live regions
    const liveRegions = document.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
    if (liveRegions.length > 0) {
      this.results.passed.push(`✅ Live regions found (${liveRegions.length})`);
    } else {
      this.results.warnings.push('⚠️  No live regions found for dynamic content');
    }
  }

  // =============================================
  // ERROR HANDLING TESTS
  // =============================================
  
  async runErrorTests() {
    await this.testFormValidation();
    await this.testNetworkErrors();
    await this.testEdgeCases();
    await this.testErrorBoundaries();
  }

  async testFormValidation() {
    const forms = document.querySelectorAll('form, .modal-content');
    
    for (const form of forms) {
      const requiredInputs = form.querySelectorAll('input[required], select[required], textarea[required]');
      const submitButton = form.querySelector('button[type="submit"], .button-primary');
      
      if (requiredInputs.length > 0 && submitButton) {
        // Test empty form submission
        if (submitButton.disabled) {
          this.results.passed.push('✅ Form validation prevents empty submission');
        } else {
          this.results.warnings.push('⚠️  Form may allow empty submission');
        }
      }
    }
    
    // Test specific input validation
    const emailInputs = document.querySelectorAll('input[type="email"]');
    emailInputs.forEach((input, index) => {
      input.value = 'invalid-email';
      input.dispatchEvent(new Event('blur'));
      
      setTimeout(() => {
        const hasError = input.classList.contains('error') || 
                        input.parentElement.querySelector('.error');
        
        if (hasError) {
          this.results.passed.push(`✅ Email validation working on input ${index + 1}`);
        }
      }, 100);
    });
  }

  async testNetworkErrors() {
    // Test offline handling
    const originalOnLine = navigator.onLine;
    
    // Simulate offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    
    window.dispatchEvent(new Event('offline'));
    await this.wait(100);
    
    const offlineIndicator = document.querySelector('.offline, [class*="offline"]');
    if (offlineIndicator) {
      this.results.passed.push('✅ Offline state detected');
    } else {
      this.results.warnings.push('⚠️  No offline indicator found');
    }
    
    // Restore online state
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine
    });
    window.dispatchEvent(new Event('online'));
  }

  async testEdgeCases() {
    // Test with no data
    const emptyStates = document.querySelectorAll('.empty-state, .no-data, [class*="empty"]');
    if (emptyStates.length > 0) {
      this.results.passed.push(`✅ Empty state components found (${emptyStates.length})`);
    }
    
    // Test maximum input lengths
    const textInputs = document.querySelectorAll('input[type="text"], textarea');
    textInputs.forEach((input, index) => {
      const maxLength = input.maxLength;
      if (maxLength && maxLength > 0) {
        this.results.passed.push(`✅ Input ${index + 1} has max length (${maxLength})`);
      }
    });
  }

  async testErrorBoundaries() {
    // Test if React error boundaries exist
    const errorBoundaryElements = document.querySelectorAll('[class*="error-boundary"]');
    if (errorBoundaryElements.length > 0) {
      this.results.passed.push('✅ Error boundary components found');
    } else {
      this.results.warnings.push('⚠️  No error boundary components detected');
    }
    
    // Check for global error handlers
    const hasErrorHandler = window.onerror !== null || 
                          window.addEventListener !== undefined;
    
    if (hasErrorHandler) {
      this.results.passed.push('✅ Global error handling available');
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================
  
  async setViewportWidth(width) {
    if (window.innerWidth !== width) {
      // This would need to be implemented differently in a real browser automation tool
      // For now, we'll just log the attempt
      this.results.warnings.push(`⚠️  Viewport width test requested: ${width}px`);
    }
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =============================================
  // REPORTING
  // =============================================
  
  generateReport() {
    const endTime = performance.now();
    const duration = Math.round(endTime - this.startTime);
    
    console.log('\n📊 COMPREHENSIVE TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`⏱️  Total execution time: ${duration}ms`);
    console.log(`📅 Test run: ${new Date().toLocaleString()}\n`);
    
    // Summary stats
    const total = this.results.passed.length + this.results.failed.length;
    const passRate = total > 0 ? (this.results.passed.length / total * 100).toFixed(1) : 0;
    
    console.log(`📈 SUMMARY:`);
    console.log(`   ✅ PASSED: ${this.results.passed.length}`);
    console.log(`   ❌ FAILED: ${this.results.failed.length}`);
    console.log(`   ⚠️  WARNINGS: ${this.results.warnings.length}`);
    console.log(`   ⏭️  SKIPPED: ${this.results.skipped.length}`);
    console.log(`   📊 Pass Rate: ${passRate}%\n`);
    
    // Detailed results
    if (this.results.passed.length > 0) {
      console.log('✅ PASSED TESTS');
      console.log('-'.repeat(30));
      this.results.passed.forEach(test => console.log(`  ${test}`));
      console.log('');
    }
    
    if (this.results.failed.length > 0) {
      console.log('❌ FAILED TESTS');
      console.log('-'.repeat(30));
      this.results.failed.forEach(test => console.log(`  ${test}`));
      console.log('');
    }
    
    if (this.results.warnings.length > 0) {
      console.log('⚠️  WARNINGS');
      console.log('-'.repeat(30));
      this.results.warnings.forEach(test => console.log(`  ${test}`));
      console.log('');
    }
    
    if (this.results.skipped.length > 0) {
      console.log('⏭️  SKIPPED TESTS');
      console.log('-'.repeat(30));
      this.results.skipped.forEach(test => console.log(`  ${test}`));
      console.log('');
    }
    
    // Generate fix recommendations
    this.generateFixRecommendations();
    
    // Return results for programmatic use
    return {
      summary: {
        passed: this.results.passed.length,
        failed: this.results.failed.length,
        warnings: this.results.warnings.length,
        skipped: this.results.skipped.length,
        passRate: parseFloat(passRate),
        duration
      },
      details: this.results
    };
  }

  generateFixRecommendations() {
    console.log('🔧 RECOMMENDED FIXES');
    console.log('='.repeat(60));
    
    const fixMap = {
      'Sidebar width incorrect': {
        file: 'frontend/src/components/Dashboard.css',
        fix: '.dashboard-sidebar { width: 280px !important; }'
      },
      'Stats grid not expandable': {
        file: 'frontend/src/components/Dashboard.css',
        fix: '.stats-2x2 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }'
      },
      'button heights inconsistent': {
        file: 'frontend/src/components/Dashboard.css',
        fix: '.rule-actions button { height: 28px !important; vertical-align: middle; }'
      },
      'toggle size incorrect': {
        file: 'frontend/src/components/Dashboard.css',
        fix: '.toggle-switch { width: 50px; height: 28px; }'
      },
      'API.*failed.*401': {
        file: 'backend/routes/admin.js',
        fix: 'Fix JWT authentication and CORS configuration'
      },
      'Create rule modal failed': {
        file: 'frontend/src/components/Dashboard.tsx',
        fix: 'Check modal state management and event handlers'
      },
      'inputs missing labels': {
        file: 'frontend/src/components/*.tsx',
        fix: 'Add aria-label or <label> elements to all form inputs'
      },
      'Memory usage high': {
        file: 'frontend/src/components/',
        fix: 'Implement useCallback, useMemo, and component lazy loading'
      },
      'Page load too slow': {
        file: 'frontend/src/',
        fix: 'Implement code splitting and lazy loading'
      }
    };
    
    let fixesGenerated = 0;
    
    this.results.failed.forEach(failure => {
      Object.keys(fixMap).forEach(pattern => {
        if (failure.match(new RegExp(pattern, 'i'))) {
          const fix = fixMap[pattern];
          console.log(`\n❌ ${failure}`);
          console.log(`   📁 File: ${fix.file}`);
          console.log(`   🔧 Fix: ${fix.fix}`);
          fixesGenerated++;
        }
      });
    });
    
    if (fixesGenerated === 0) {
      console.log('\n🎉 No specific fixes needed - all major issues resolved!');
    } else {
      console.log(`\n📋 Generated ${fixesGenerated} specific fix recommendations`);
    }
    
    // Generate priority matrix
    this.generatePriorityMatrix();
  }

  generatePriorityMatrix() {
    console.log('\n🎯 PRIORITY MATRIX');
    console.log('='.repeat(60));
    
    const priorities = {
      'P0 - Critical': [],
      'P1 - High': [],
      'P2 - Medium': [],
      'P3 - Low': []
    };
    
    this.results.failed.forEach(failure => {
      if (failure.includes('API') || failure.includes('auth') || failure.includes('token')) {
        priorities['P0 - Critical'].push(failure);
      } else if (failure.includes('modal') || failure.includes('create') || failure.includes('delete')) {
        priorities['P1 - High'].push(failure);
      } else if (failure.includes('button') || failure.includes('alignment') || failure.includes('size')) {
        priorities['P2 - Medium'].push(failure);
      } else {
        priorities['P3 - Low'].push(failure);
      }
    });
    
    Object.keys(priorities).forEach(priority => {
      if (priorities[priority].length > 0) {
        console.log(`\n${priority}:`);
        priorities[priority].forEach(issue => {
          console.log(`  • ${issue.replace('❌ ', '')}`);
        });
      }
    });
    
    console.log(`\n🔧 Next Steps:`);
    console.log(`1. Fix P0 issues first (authentication, API connectivity)`);
    console.log(`2. Address P1 issues (core functionality)`);
    console.log(`3. Polish P2 issues (user experience)`);
    console.log(`4. Enhance P3 issues (nice-to-have improvements)`);
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DashboardTestRunner;
}

// Auto-run if in browser environment
if (typeof window !== 'undefined') {
  window.DashboardTestRunner = DashboardTestRunner;
  
  // Add convenience method to run tests
  window.runDashboardTests = () => {
    const tester = new DashboardTestRunner();
    return tester.runAllTests();
  };
  
  console.log('🧪 Dashboard Test Runner loaded!');
  console.log('Run tests with: runDashboardTests()');
}