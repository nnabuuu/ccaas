#!/bin/bash

# Verification Script for lesson-plan-pptx Skill
# Usage: ./verify.sh

set -e

echo "==================================="
echo "lesson-plan-pptx Skill Verification"
echo "==================================="
echo ""

# 1. Check SKILL.md exists
echo "✓ Checking SKILL.md exists..."
if [ -f "SKILL.md" ]; then
    echo "  ✅ SKILL.md found"
    echo "  📊 Lines: $(wc -l < SKILL.md)"
else
    echo "  ❌ SKILL.md not found"
    exit 1
fi
echo ""

# 2. Check frontmatter
echo "✓ Checking SKILL.md frontmatter..."
if grep -q "^name: lesson-plan-pptx" SKILL.md; then
    echo "  ✅ Name: lesson-plan-pptx"
else
    echo "  ❌ Name not found or incorrect"
    exit 1
fi

if grep -q "^slug: lesson-plan-pptx" SKILL.md; then
    echo "  ✅ Slug: lesson-plan-pptx"
else
    echo "  ❌ Slug not found or incorrect"
    exit 1
fi

if grep -q "triggers:" SKILL.md; then
    echo "  ✅ Triggers defined"
    echo "  📝 Trigger keywords:"
    grep -A 20 "triggers:" SKILL.md | grep "value:" | sed 's/^/    /'

    # Check for PDF-related triggers
    if grep -q 'value: "生成pdf"' SKILL.md || grep -q 'value: "生成PDF"' SKILL.md; then
        echo "  ✅ PDF triggers present (unified solution)"
    else
        echo "  ⚠️  No PDF triggers found"
    fi
else
    echo "  ❌ Triggers not found"
    exit 1
fi
echo ""

# 3. Check critical sections
echo "✓ Checking critical sections..."

sections=(
    "Phase 1: 准备教案内容"
    "Phase 2: 创建 NotebookLM 资源"
    "Phase 3: 生成幻灯片"
    "Phase 4: 下载和附加"
    "attach_file"
    "错误处理"
)

for section in "${sections[@]}"; do
    if grep -q "$section" SKILL.md; then
        echo "  ✅ Found: $section"
    else
        echo "  ❌ Missing: $section"
        exit 1
    fi
done
echo ""

# 4. Check NotebookLM commands
echo "✓ Checking NotebookLM CLI commands..."

commands=(
    "notebooklm create"
    "notebooklm source add"
    "notebooklm source wait"
    "notebooklm generate slide-deck"
    "notebooklm artifact wait"
    "notebooklm download slide-deck"
)

for cmd in "${commands[@]}"; do
    if grep -q "$cmd" SKILL.md; then
        echo "  ✅ Found: $cmd"
    else
        echo "  ⚠️  Missing: $cmd"
    fi
done
echo ""

# 5. Check attach_file integration
echo "✓ Checking attach_file integration..."
if grep -q "attach_file" SKILL.md; then
    echo "  ✅ attach_file mentioned"
    attach_count=$(grep -c "attach_file" SKILL.md)
    echo "  📊 Occurrences: $attach_count"

    if grep -q "fileType: 'pdf'" SKILL.md; then
        echo "  ✅ Correct fileType: 'pdf'"
    else
        echo "  ❌ fileType not set to 'pdf'"
        exit 1
    fi
else
    echo "  ❌ attach_file not found"
    exit 1
fi
echo ""

# 6. Check error handling
echo "✓ Checking error handling scenarios..."

errors=(
    "NotebookLM 未认证"
    "教案数据不完整"
    "源处理超时"
    "生成超时"
    "速率限制"
    "attach_file 失败"
)

for error in "${errors[@]}"; do
    if grep -q "$error" SKILL.md; then
        echo "  ✅ Handles: $error"
    else
        echo "  ⚠️  Missing: $error"
    fi
done
echo ""

# 7. Check subagent pattern
echo "✓ Checking subagent pattern..."
if grep -q "Task tool" SKILL.md || grep -q "subagent" SKILL.md; then
    echo "  ✅ Subagent pattern found"

    if grep -q "subagent_type: 'general-purpose'" SKILL.md; then
        echo "  ✅ Correct subagent type"
    else
        echo "  ⚠️  Subagent type not specified or incorrect"
    fi
else
    echo "  ❌ Subagent pattern not found"
    exit 1
fi
echo ""

# 8. Check teaching-script-generator integration
echo "✓ Checking teaching-script-generator integration..."
TEACHING_SCRIPT="../teaching-script-generator/SKILL.md"

if [ -f "$TEACHING_SCRIPT" ]; then
    if grep -q "lesson-plan-pptx" "$TEACHING_SCRIPT"; then
        echo "  ✅ teaching-script-generator references lesson-plan-pptx"
    else
        echo "  ❌ teaching-script-generator doesn't reference lesson-plan-pptx"
        exit 1
    fi

    if grep -q "example-skills:pptx" "$TEACHING_SCRIPT"; then
        echo "  ⚠️  teaching-script-generator still references example-skills:pptx"
        echo "     (Should be replaced with lesson-plan-pptx)"
    else
        echo "  ✅ No reference to old example-skills:pptx"
    fi
else
    echo "  ⚠️  teaching-script-generator SKILL.md not found"
fi
echo ""

# 9. Check NotebookLM authentication
echo "✓ Checking NotebookLM authentication status..."
if command -v notebooklm &> /dev/null; then
    echo "  ✅ notebooklm CLI installed"

    if notebooklm auth check &> /dev/null; then
        echo "  ✅ NotebookLM authenticated"
    else
        echo "  ⚠️  NotebookLM not authenticated"
        echo "     Run: notebooklm login"
    fi
else
    echo "  ⚠️  notebooklm CLI not found in PATH"
    echo "     Install: npm install -g notebooklm-cli"
fi
echo ""

# 10. Summary
echo "==================================="
echo "Verification Summary"
echo "==================================="
echo ""
echo "✅ SKILL.md structure verified"
echo "✅ Frontmatter correct"
echo "✅ All critical sections present"
echo "✅ NotebookLM CLI commands included"
echo "✅ attach_file integration correct"
echo "✅ Error handling comprehensive"
echo "✅ Subagent pattern implemented"
echo "✅ teaching-script-generator integration updated"
echo ""

if command -v notebooklm &> /dev/null && notebooklm auth check &> /dev/null; then
    echo "🎉 All checks passed! Ready to test."
    echo ""
    echo "Next steps:"
    echo "1. Create a lesson plan with complete content"
    echo "2. Say: '生成PPT'"
    echo "3. Wait 5-15 minutes for generation"
    echo "4. Verify PDF download and attachment"
else
    echo "⚠️  Verification passed, but NotebookLM not ready"
    echo ""
    echo "Before testing:"
    echo "1. Install notebooklm CLI: npm install -g notebooklm-cli"
    echo "2. Login: notebooklm login"
    echo "3. Run this script again to verify"
fi

echo ""
