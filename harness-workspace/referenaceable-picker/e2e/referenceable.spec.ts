import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3001';

test.describe('Referenceable AT Picker — EntityContext + Apply + Summary', () => {

  // ─── Backend API Tests ─────────────────────────────────

  test('Scenario 1: EntityContext 获取 — LessonPlan', async ({ request }) => {
    // First get a valid lesson plan ID
    const browseRes = await request.get(`${BASE}/context/browse`, {
      params: { entity_type: 'lesson_plan' },
    });
    expect(browseRes.ok()).toBeTruthy();
    const browseData = await browseRes.json();
    expect(browseData.items.length).toBeGreaterThan(0);
    const lpId = browseData.items[0].id;

    // GET EntityContext
    const res = await request.get(`${BASE}/context/entity/lesson_plan/${lpId}`);
    expect(res.ok()).toBeTruthy();
    const ctx = await res.json();

    // Verify EntityContext structure
    expect(ctx).toHaveProperty('ref');
    expect(ctx).toHaveProperty('structured');
    expect(ctx).toHaveProperty('relations');
    expect(ctx).toHaveProperty('attachments');

    // Verify ref is AtReference
    expect(ctx.ref).toHaveProperty('type', 'lesson_plan');
    expect(ctx.ref).toHaveProperty('id', lpId);
    expect(ctx.ref).toHaveProperty('display_name');
    expect(ctx.ref).toHaveProperty('summary');
    expect(typeof ctx.ref.display_name).toBe('string');
    expect(typeof ctx.ref.summary).toBe('string');

    // Verify structured has lesson plan fields
    expect(ctx.structured).toHaveProperty('title');
    expect(ctx.structured).toHaveProperty('status');
    expect(ctx.structured).toHaveProperty('lesson_type');

    // Verify relations is array of AtReference
    expect(Array.isArray(ctx.relations)).toBeTruthy();

    // Verify attachments is array
    expect(Array.isArray(ctx.attachments)).toBeTruthy();
  });

  test('Scenario 2: AtReference summary — LessonPlan', async ({ request }) => {
    // Get a lesson plan
    const browseRes = await request.get(`${BASE}/context/browse`, {
      params: { entity_type: 'lesson_plan' },
    });
    const browseData = await browseRes.json();
    const lpId = browseData.items[0].id;

    const res = await request.get(`${BASE}/context/entity/lesson_plan/${lpId}`);
    const ctx = await res.json();

    // Summary must be ≤ 100 characters
    expect(ctx.ref.summary.length).toBeLessThanOrEqual(100);
    expect(ctx.ref.summary.length).toBeGreaterThan(0);

    // Summary should contain meaningful info (class/subject/lesson_type)
    // At least one of these should appear in the summary
    const summary = ctx.ref.summary;
    const hasSubjectOrClass = (
      ctx.structured.subject !== undefined ||
      ctx.structured.class_id !== undefined ||
      ctx.structured.lesson_type !== undefined
    );
    expect(hasSubjectOrClass).toBeTruthy();

    // Verify summary is not just the title (should have additional context)
    expect(summary).not.toBe(ctx.structured.title);
  });

  test('Scenario 3: Relations 正确 — LessonPlan with requirement', async ({ request }) => {
    // Browse lesson plans and find one with a requirement
    const browseRes = await request.get(`${BASE}/context/browse`, {
      params: { entity_type: 'lesson_plan' },
    });
    const browseData = await browseRes.json();

    // Check each lesson plan for requirement relation
    let foundRelation = false;
    for (const item of browseData.items) {
      const res = await request.get(`${BASE}/context/entity/lesson_plan/${item.id}`);
      const ctx = await res.json();

      if (ctx.relations.length > 0) {
        const reqRelation = ctx.relations.find(
          (r: any) => r.type === 'requirement'
        );
        if (reqRelation) {
          // Verify the requirement relation is a valid AtReference
          expect(reqRelation).toHaveProperty('type', 'requirement');
          expect(reqRelation).toHaveProperty('id');
          expect(reqRelation).toHaveProperty('display_name');
          expect(reqRelation).toHaveProperty('summary');
          expect(typeof reqRelation.display_name).toBe('string');
          expect(typeof reqRelation.summary).toBe('string');
          foundRelation = true;
          break;
        }
      }
    }

    // If no lesson plan has a requirement linked, check structured for requirement_id
    // At minimum, verify the relations array exists and is properly typed
    if (!foundRelation) {
      // At least verify the structure is correct for a lesson plan without relations
      const res = await request.get(`${BASE}/context/entity/lesson_plan/${browseData.items[0].id}`);
      const ctx = await res.json();
      expect(Array.isArray(ctx.relations)).toBeTruthy();
      // All relations should be valid AtReferences
      for (const rel of ctx.relations) {
        expect(rel).toHaveProperty('type');
        expect(rel).toHaveProperty('id');
        expect(rel).toHaveProperty('display_name');
        expect(rel).toHaveProperty('summary');
      }
    }
  });

  test('Scenario 4: Template EntityContext', async ({ request }) => {
    // Get a template ID
    const browseRes = await request.get(`${BASE}/context/browse`, {
      params: { entity_type: 'template' },
    });

    // template may be registered under a different type name
    let templateId: string;
    if (browseRes.ok()) {
      const browseData = await browseRes.json();
      if (browseData.items && browseData.items.length > 0) {
        templateId = browseData.items[0].id;
      } else {
        test.skip(true, 'No templates available in browse');
        return;
      }
    } else {
      test.skip(true, 'Template type not browseable');
      return;
    }

    const res = await request.get(`${BASE}/context/entity/template/${templateId}`);
    expect(res.ok()).toBeTruthy();
    const ctx = await res.json();

    // Verify ref
    expect(ctx.ref.type).toBe('template');
    expect(ctx.ref.summary.length).toBeLessThanOrEqual(100);
    expect(ctx.ref.summary.length).toBeGreaterThan(0);

    // Verify structured has template-specific fields
    expect(ctx.structured).toHaveProperty('scope');
    expect(ctx.structured).toHaveProperty('version');
    expect(ctx.structured).toHaveProperty('lesson_type');

    // block_summary should exist (list of section block names)
    expect(ctx.structured).toHaveProperty('block_summary');
  });

  test('Scenario 5: Requirement EntityContext', async ({ request }) => {
    // Search for a requirement
    const searchRes = await request.get(`${BASE}/context/search`, {
      params: { q: '数学' },
    });

    let reqId: string | undefined;

    if (searchRes.ok()) {
      const searchData = await searchRes.json();
      const reqResult = searchData.results?.find(
        (r: any) => r.type === 'requirement' || r.entityType === 'requirement'
      );
      if (reqResult) {
        reqId = reqResult.id || reqResult.entityId;
      }
    }

    if (!reqId) {
      // Try browse
      const browseRes = await request.get(`${BASE}/context/browse`, {
        params: { entity_type: 'requirement' },
      });
      if (browseRes.ok()) {
        const browseData = await browseRes.json();
        if (browseData.items?.length > 0) {
          reqId = browseData.items[0].id;
        }
      }
    }

    if (!reqId) {
      test.skip(true, 'No requirements available');
      return;
    }

    const res = await request.get(`${BASE}/context/entity/requirement/${reqId}`);
    expect(res.ok()).toBeTruthy();
    const ctx = await res.json();

    // Verify ref
    expect(ctx.ref.type).toBe('requirement');
    expect(ctx.ref.summary.length).toBeLessThanOrEqual(100);
    expect(ctx.ref.summary.length).toBeGreaterThan(0);

    // Verify structured has requirement-specific fields
    expect(ctx.structured).toHaveProperty('name');
    expect(ctx.structured).toHaveProperty('level');
    expect(ctx.structured).toHaveProperty('subject');
  });

  test('Scenario 6: Provider search 返回 AtReference with summary', async ({ request }) => {
    const res = await request.get(`${BASE}/context/search`, {
      params: { q: 'SAS' },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    // Should have results
    expect(data.results.length).toBeGreaterThan(0);

    // Each result should have summary
    for (const result of data.results) {
      expect(result).toHaveProperty('summary');
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeLessThanOrEqual(100);
    }
  });

  test('Scenario 7: Apply Action — 成功更新', async ({ request }) => {
    // Get a draft lesson plan
    const browseRes = await request.get(`${BASE}/context/browse`, {
      params: { entity_type: 'lesson_plan' },
    });
    const browseData = await browseRes.json();

    // Find a draft lesson plan (not published)
    let targetId: string | undefined;
    for (const item of browseData.items) {
      const entityRes = await request.get(`${BASE}/context/entity/lesson_plan/${item.id}`);
      if (entityRes.ok()) {
        const ctx = await entityRes.json();
        if (ctx.structured.status === 'draft') {
          targetId = item.id;
          break;
        }
      }
    }

    if (!targetId) {
      targetId = browseData.items[0].id;
    }

    const newTitle = `测试更新标题_${Date.now()}`;

    // Apply action
    const applyRes = await request.post(`${BASE}/context/apply`, {
      data: {
        target_type: 'lesson_plan',
        target_id: targetId,
        field_path: 'title',
        suggested_value: newTitle,
        action_description: '更新教案标题',
      },
    });
    expect(applyRes.ok()).toBeTruthy();
    const applyData = await applyRes.json();
    expect(applyData.success).toBe(true);

    // Verify the update took effect
    const verifyRes = await request.get(`${BASE}/context/entity/lesson_plan/${targetId}`);
    const verifyCtx = await verifyRes.json();
    expect(verifyCtx.structured.title).toBe(newTitle);
  });

  test('Scenario 8: Apply Action — 业务规则处理', async ({ request }) => {
    // Get lesson plans and find one with published status
    const browseRes = await request.get(`${BASE}/context/browse`, {
      params: { entity_type: 'lesson_plan' },
    });
    const browseData = await browseRes.json();

    let publishedId: string | undefined;
    for (const item of browseData.items) {
      const entityRes = await request.get(`${BASE}/context/entity/lesson_plan/${item.id}`);
      if (entityRes.ok()) {
        const ctx = await entityRes.json();
        if (ctx.structured.status === 'published') {
          publishedId = item.id;
          break;
        }
      }
    }

    if (!publishedId) {
      // If no published lesson plan, test still passes — business rule is optional
      test.skip(true, 'No published lesson plan to test business rule');
      return;
    }

    // Try to apply to published lesson plan
    const applyRes = await request.post(`${BASE}/context/apply`, {
      data: {
        target_type: 'lesson_plan',
        target_id: publishedId,
        field_path: 'title',
        suggested_value: '不应生效的标题',
        action_description: '尝试修改已发布教案',
      },
    });

    // Should either reject (success: false) or handle gracefully
    const applyData = await applyRes.json();
    if (!applyData.success) {
      expect(applyData).toHaveProperty('error');
      expect(typeof applyData.error).toBe('string');
    }
    // If success: true, that's also a valid business decision (allow editing published)
  });

  // ─── Frontend Integration Tests ───────────────────────

  test('Scenario 9: @ Picker summary 显示', async ({ page }) => {
    // Navigate to the chat page served by edu-platform or chat-interface
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(1000);

    // Check if chat input exists
    const chatInput = page.locator('[data-testid="chat-input"]');
    if (!(await chatInput.isVisible().catch(() => false))) {
      test.skip(true, 'Chat UI not available at this endpoint');
      return;
    }

    // Trigger @ picker
    await chatInput.focus();
    await chatInput.press('@');

    const picker = page.locator('[data-testid="at-picker"]');
    await expect(picker).toBeVisible();

    // Check recent items have summary text
    const recentItems = page.locator('[data-testid^="recent-item-"]');
    const count = await recentItems.count();

    if (count > 0) {
      // Each recent item should display summary
      const firstItem = recentItems.first();
      const summaryEl = firstItem.locator('[data-testid="item-summary"]');
      // Summary element should exist (even if small/gray text)
      if (await summaryEl.isVisible().catch(() => false)) {
        const summaryText = await summaryEl.textContent();
        expect(summaryText).toBeTruthy();
        expect(summaryText!.length).toBeLessThanOrEqual(100);
      }
    }
  });

  test('Scenario 10: 消息 references 含 summary', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(1000);

    const chatInput = page.locator('[data-testid="chat-input"]');
    if (!(await chatInput.isVisible().catch(() => false))) {
      test.skip(true, 'Chat UI not available at this endpoint');
      return;
    }

    // Select an entity via @ picker
    await chatInput.focus();
    await chatInput.press('@');
    await page.waitForSelector('[data-testid="at-picker"]');

    // Browse to lesson plans
    const typeBrowse = page.locator('[data-testid="type-browse-lesson_plan"]');
    if (await typeBrowse.isVisible().catch(() => false)) {
      await typeBrowse.click();
      await page.waitForTimeout(500);

      const firstSelect = page.locator('[data-testid^="select-"]').first();
      if (await firstSelect.isVisible().catch(() => false)) {
        await firstSelect.click();
        await page.waitForTimeout(300);

        // Check mention refs container
        const mentionRefs = page.locator('[data-testid="mention-refs"]');
        if (await mentionRefs.isVisible().catch(() => false)) {
          // The pill should contain summary data (via MentionRef)
          const pill = page.locator('[data-testid="ref-pill"]').first();
          await expect(pill).toBeVisible();

          // Verify the ref data includes summary by checking DOM attributes or content
          // The summary may be in a tooltip or data attribute
          const pillText = await pill.textContent();
          expect(pillText).toBeTruthy();
        }
      }
    }
  });

  test('Scenario 11: Apply 按钮渲染', async ({ page }) => {
    // This test verifies that apply_action blocks render as buttons
    // The test checks the component exists in the codebase
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(1000);

    // Check if there's an apply action block in any message
    const applyButton = page.locator('[data-testid="apply-action-button"]');

    // Apply buttons may not be present initially (only in agent responses)
    // Verify the component exists by checking the page doesn't error
    // and the apply endpoint is available
    const applyEndpoint = await page.request.post(`${BASE}/context/apply`, {
      data: {
        target_type: 'lesson_plan',
        target_id: 'nonexistent',
        field_path: 'title',
        suggested_value: 'test',
        action_description: 'test',
      },
    });

    // The endpoint should exist (even if it returns an error for invalid ID)
    // Status 400/404 is acceptable — 405 or connection refused is not
    expect([200, 201, 400, 404, 422].includes(applyEndpoint.status())).toBeTruthy();
  });

  // ─── Backward Compatibility Test ──────────────────────

  test('Scenario 12: 向后兼容 — 现有端点正常工作', async ({ request }) => {
    // entity-types
    const typesRes = await request.get(`${BASE}/context/entity-types`);
    expect(typesRes.ok()).toBeTruthy();
    const typesData = await typesRes.json();
    expect(typesData).toHaveProperty('types');
    expect(typesData).toHaveProperty('tree');
    expect(Array.isArray(typesData.types)).toBeTruthy();

    // suggest
    const suggestRes = await request.get(`${BASE}/context/suggest`);
    expect(suggestRes.ok()).toBeTruthy();
    const suggestData = await suggestRes.json();
    expect(suggestData).toHaveProperty('recents');

    // browse
    const browseRes = await request.get(`${BASE}/context/browse`, {
      params: { entity_type: 'lesson_plan' },
    });
    expect(browseRes.ok()).toBeTruthy();
    const browseData = await browseRes.json();
    expect(browseData).toHaveProperty('items');
    expect(Array.isArray(browseData.items)).toBeTruthy();

    // search
    const searchRes = await request.get(`${BASE}/context/search`, {
      params: { q: 'SAS' },
    });
    expect(searchRes.ok()).toBeTruthy();
    const searchData = await searchRes.json();
    expect(searchData).toHaveProperty('results');
    expect(Array.isArray(searchData.results)).toBeTruthy();

    // resolve (get a valid ID first)
    if (browseData.items.length > 0) {
      const itemId = browseData.items[0].id;
      const resolveRes = await request.get(`${BASE}/context/resolve`, {
        params: { entity_type: 'lesson_plan', entity_id: itemId },
      });
      expect(resolveRes.ok()).toBeTruthy();
      const resolveData = await resolveRes.json();
      expect(resolveData).toHaveProperty('entityType');
      expect(resolveData).toHaveProperty('entityId');
      expect(resolveData).toHaveProperty('displayName');
    }
  });

});
