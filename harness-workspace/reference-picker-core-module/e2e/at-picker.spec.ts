import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3021';

test.describe('Context Layer @ Picker', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    // Wait for entity types to load
    await page.waitForSelector('[data-testid="shortcuts-toolbar"]');
    await page.waitForTimeout(500); // ensure data loaded
  });

  test('Scenario 1: 基本 @ 弹出 — picker shows recents + type browse', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');
    await input.focus();
    await input.press('@');

    // Picker should appear
    const picker = page.locator('[data-testid="at-picker"]');
    await expect(picker).toBeVisible();

    // Recents section
    const recents = page.locator('[data-testid="recents-section"]');
    await expect(recents).toBeVisible();

    // Should have recent items
    await expect(page.locator('[data-testid="recent-item-lp_1"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-item-hw_1"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-item-att_2"]')).toBeVisible();

    // Type browse section
    const typeBrowse = page.locator('[data-testid="type-browse-section"]');
    await expect(typeBrowse).toBeVisible();

    // Should show root types
    await expect(page.locator('[data-testid="type-browse-lesson_plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="type-browse-homework"]')).toBeVisible();
    await expect(page.locator('[data-testid="type-browse-requirement"]')).toBeVisible();

    // Shortcuts toolbar should show lesson-prep defaults
    await expect(page.locator('[data-testid="shortcut-lesson_plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="shortcut-requirement"]')).toBeVisible();
    await expect(page.locator('[data-testid="shortcut-question"]')).toBeVisible();
  });

  test('Scenario 2: 按类型浏览 → 教案列表', async ({ page }) => {
    await page.locator('[data-testid="chat-input"]').press('@');
    await page.waitForSelector('[data-testid="at-picker"]');

    // Click lesson_plan type
    await page.locator('[data-testid="type-browse-lesson_plan"]').click();

    // Should show browse view
    const browseView = page.locator('[data-testid="browse-view"]');
    await expect(browseView).toBeVisible();

    // Should show lesson plans
    await expect(page.locator('[data-testid="browse-item-lp_1"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-item-lp_2"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-item-lp_3"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-item-lp_4"]')).toBeVisible();

    // Each should have drill button (lesson_plan has children)
    await expect(page.locator('[data-testid="drill-lp_1"]')).toBeVisible();
    await expect(page.locator('[data-testid="drill-lp_2"]')).toBeVisible();

    // Each should have select button
    await expect(page.locator('[data-testid="select-lp_1"]')).toBeVisible();

    // Should have breadcrumb with back button
    await expect(page.locator('[data-testid="browse-breadcrumb"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-back"]')).toBeVisible();
  });

  test('Scenario 3: 钻入子资源 — block list under lesson_plan', async ({ page }) => {
    await page.locator('[data-testid="chat-input"]').press('@');
    await page.waitForSelector('[data-testid="at-picker"]');
    await page.locator('[data-testid="type-browse-lesson_plan"]').click();
    await page.waitForSelector('[data-testid="browse-item-lp_1"]');

    // Drill into lp_1
    await page.locator('[data-testid="drill-lp_1"]').click();

    // Should show blocks
    await expect(page.locator('[data-testid="browse-item-blk_1"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-item-blk_2"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-item-blk_3"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-item-blk_4"]')).toBeVisible();

    // blk_2 has children (attachments), should have drill button
    await expect(page.locator('[data-testid="drill-blk_2"]')).toBeVisible();

    // blk_3 and blk_4 don't have children
    await expect(page.locator('[data-testid="drill-blk_3"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="drill-blk_4"]')).not.toBeVisible();

    // Breadcrumb should show path
    const breadcrumb = page.locator('[data-testid="browse-breadcrumb"]');
    await expect(breadcrumb).toContainText('教案');
    await expect(breadcrumb).toContainText('SSS/SAS');
  });

  test('Scenario 4: 三级钻入 — attachments under block', async ({ page }) => {
    await page.locator('[data-testid="chat-input"]').press('@');
    await page.waitForSelector('[data-testid="at-picker"]');
    await page.locator('[data-testid="type-browse-lesson_plan"]').click();
    await page.waitForSelector('[data-testid="browse-item-lp_1"]');
    await page.locator('[data-testid="drill-lp_1"]').click();
    await page.waitForSelector('[data-testid="browse-item-blk_2"]');
    await page.locator('[data-testid="drill-blk_2"]').click();

    // Should show attachments
    await expect(page.locator('[data-testid="browse-item-att_1"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-item-att_2"]')).toBeVisible();

    // Attachments don't have children — no drill buttons
    await expect(page.locator('[data-testid="drill-att_1"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="drill-att_2"]')).not.toBeVisible();

    // Breadcrumb should show full path
    const breadcrumb = page.locator('[data-testid="browse-breadcrumb"]');
    await expect(breadcrumb).toContainText('内容块');
    await expect(breadcrumb).toContainText('SAS 概念讲解');
    await expect(breadcrumb).toContainText('附件');
  });

  test('Scenario 5: 选中实体 → pill 显示', async ({ page }) => {
    await page.locator('[data-testid="chat-input"]').press('@');
    await page.waitForSelector('[data-testid="at-picker"]');
    await page.locator('[data-testid="type-browse-lesson_plan"]').click();
    await page.waitForSelector('[data-testid="browse-item-lp_1"]');
    await page.locator('[data-testid="drill-lp_1"]').click();
    await page.waitForSelector('[data-testid="browse-item-blk_2"]');
    await page.locator('[data-testid="drill-blk_2"]').click();
    await page.waitForSelector('[data-testid="browse-item-att_2"]');

    // Select att_2
    await page.locator('[data-testid="select-att_2"]').click();

    // Picker should close
    await expect(page.locator('[data-testid="at-picker"]')).not.toBeVisible();

    // Pill should appear
    const pill = page.locator('[data-testid="ref-pill"]');
    await expect(pill).toBeVisible();
    await expect(pill).toContainText('SAS判定条件图.png');
    await expect(pill).toContainText('📎');

    // Remove button
    await expect(page.locator('[data-testid="ref-pill-remove"]')).toBeVisible();
  });

  test('Scenario 6: 多实体引用', async ({ page }) => {
    // Select att_2 first
    await page.locator('[data-testid="chat-input"]').press('@');
    await page.waitForSelector('[data-testid="at-picker"]');
    await page.locator('[data-testid="type-browse-lesson_plan"]').click();
    await page.waitForSelector('[data-testid="browse-item-lp_1"]');
    await page.locator('[data-testid="drill-lp_1"]').click();
    await page.waitForSelector('[data-testid="browse-item-blk_2"]');
    await page.locator('[data-testid="drill-blk_2"]').click();
    await page.waitForSelector('[data-testid="browse-item-att_2"]');
    await page.locator('[data-testid="select-att_2"]').click();

    // Wait for picker to close after selection
    await expect(page.locator('[data-testid="at-picker"]')).not.toBeVisible();
    await page.waitForTimeout(300);

    // Select lp_1
    await page.locator('[data-testid="chat-input"]').press('@');
    await expect(page.locator('[data-testid="at-picker"]')).toBeVisible();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="type-browse-lesson_plan"]').click();
    await page.waitForSelector('[data-testid="browse-item-lp_1"]');
    await page.locator('[data-testid="select-lp_1"]').click();

    // Should have two pills
    const pills = page.locator('[data-testid="ref-pill"]');
    await expect(pills).toHaveCount(2);

    // Both should have remove buttons
    const removeButtons = page.locator('[data-testid="ref-pill-remove"]');
    await expect(removeButtons).toHaveCount(2);

    // Verify content
    const mentionRefs = page.locator('[data-testid="mention-refs"]');
    await expect(mentionRefs).toContainText('SAS判定条件图.png');
    await expect(mentionRefs).toContainText('SSS/SAS');
    await expect(mentionRefs).toContainText('2 个实体已引用');
  });

  test('Scenario 7: 搜索', async ({ page }) => {
    await page.locator('[data-testid="chat-input"]').press('@');
    await page.waitForSelector('[data-testid="at-picker"]');

    // Type in search
    const searchInput = page.locator('[data-testid="at-picker-search"]');
    await searchInput.fill('SAS');

    // Wait for debounced search results
    await page.waitForTimeout(400);

    // Search results should appear
    const searchResults = page.locator('[data-testid="search-results"]');
    await expect(searchResults).toBeVisible();

    // Should have multiple result types
    const searchItems = page.locator('[data-testid^="search-item-"]');
    const count = await searchItems.count();
    expect(count).toBeGreaterThan(1);

    // Recents and type browse should not be visible
    await expect(page.locator('[data-testid="recents-section"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="type-browse-section"]')).not.toBeVisible();
  });

  test('Scenario 8: 搜索结果面包屑', async ({ page }) => {
    await page.locator('[data-testid="chat-input"]').press('@');
    await page.waitForSelector('[data-testid="at-picker"]');

    const searchInput = page.locator('[data-testid="at-picker-search"]');
    await searchInput.fill('SAS判定条件图');
    await page.waitForTimeout(400);

    // att_2 should be in results with breadcrumb
    const att2 = page.locator('[data-testid="search-item-att_2"]');
    await expect(att2).toBeVisible();

    // Breadcrumb should show path
    const breadcrumb = page.locator('[data-testid="search-breadcrumb-att_2"]');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText('SSS/SAS');
    await expect(breadcrumb).toContainText('SAS 概念讲解');
  });

  test('Scenario 9: 工具栏快捷入口', async ({ page }) => {
    // Click requirement shortcut
    await page.locator('[data-testid="shortcut-requirement"]').click();

    // Picker should open directly to requirement browse
    const picker = page.locator('[data-testid="at-picker"]');
    await expect(picker).toBeVisible();

    // Should be in browse mode showing requirements
    const browseView = page.locator('[data-testid="browse-view"]');
    await expect(browseView).toBeVisible();

    // Should show requirement items
    await expect(page.locator('[data-testid="browse-item-req_1"]')).toBeVisible();

    // Should NOT show recents or type browse
    await expect(page.locator('[data-testid="recents-section"]')).not.toBeVisible();
  });

  test('Scenario 10: 不同 session template 的 shortcuts', async ({ page }) => {
    // Navigate to grading template
    await page.goto(`${BASE}/index.html?sessionTemplate=grading`);
    await page.waitForSelector('[data-testid="shortcuts-toolbar"]');
    await page.waitForTimeout(500);

    // Should show grading shortcuts
    await expect(page.locator('[data-testid="shortcut-homework"]')).toBeVisible();
    await expect(page.locator('[data-testid="shortcut-analytics"]')).toBeVisible();
    await expect(page.locator('[data-testid="shortcut-question"]')).toBeVisible();

    // Should NOT show lesson-prep shortcuts
    await expect(page.locator('[data-testid="shortcut-lesson_plan"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="shortcut-requirement"]')).not.toBeVisible();
  });

  test('Scenario 11: 返回导航', async ({ page }) => {
    await page.locator('[data-testid="chat-input"]').press('@');
    await page.waitForSelector('[data-testid="at-picker"]');

    // Drill to attachments: lesson_plan → block → attachment
    await page.locator('[data-testid="type-browse-lesson_plan"]').click();
    await page.waitForSelector('[data-testid="browse-item-lp_1"]');
    await page.locator('[data-testid="drill-lp_1"]').click();
    await page.waitForSelector('[data-testid="browse-item-blk_2"]');
    await page.locator('[data-testid="drill-blk_2"]').click();
    await page.waitForSelector('[data-testid="browse-item-att_1"]');

    // Now navigate back: click back to blocks
    await page.locator('[data-testid="browse-back"]').click();
    await expect(page.locator('[data-testid="browse-item-blk_1"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-item-blk_2"]')).toBeVisible();

    // Back to lesson plans
    await page.locator('[data-testid="browse-back"]').click();
    await expect(page.locator('[data-testid="browse-item-lp_1"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-item-lp_2"]')).toBeVisible();

    // Back to home
    await page.locator('[data-testid="browse-back"]').click();
    await expect(page.locator('[data-testid="recents-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="type-browse-section"]')).toBeVisible();
  });

  test('Scenario 12: recents 更新 (activity tracking)', async ({ page }) => {
    // First, select att_2
    await page.locator('[data-testid="chat-input"]').press('@');
    await page.waitForSelector('[data-testid="at-picker"]');
    await page.locator('[data-testid="type-browse-lesson_plan"]').click();
    await page.waitForSelector('[data-testid="browse-item-lp_1"]');
    await page.locator('[data-testid="drill-lp_1"]').click();
    await page.waitForSelector('[data-testid="browse-item-blk_2"]');
    await page.locator('[data-testid="drill-blk_2"]').click();
    await page.waitForSelector('[data-testid="browse-item-att_2"]');
    await page.locator('[data-testid="select-att_2"]').click();

    // Wait for activity to be recorded
    await page.waitForTimeout(300);

    // Re-open picker
    await page.locator('[data-testid="chat-input"]').press('@');
    await page.waitForSelector('[data-testid="at-picker"]');
    await page.waitForTimeout(500);

    // att_2 should be in recents (was referenced)
    const recents = page.locator('[data-testid="recents-section"]');
    await expect(recents).toBeVisible();
    await expect(page.locator('[data-testid="recent-item-att_2"]')).toBeVisible();
  });

  test('Scenario 13: 自动注入 (autoInject URL param)', async ({ page }) => {
    await page.goto(`${BASE}/index.html?autoInject=lesson_plan:lp_1`);
    await page.waitForSelector('[data-testid="shortcuts-toolbar"]');
    await page.waitForTimeout(1000);

    // Pill should already be visible (auto-injected)
    const pills = page.locator('[data-testid="ref-pill"]');
    await expect(pills.first()).toBeVisible();
    await expect(pills).toHaveCount(1);
    await expect(pills.first()).toContainText('SSS/SAS');
    await expect(pills.first()).toContainText('📝');
  });

});
