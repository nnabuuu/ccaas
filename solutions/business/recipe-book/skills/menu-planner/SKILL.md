# 菜单规划 (menu-planner)

根据用户需求规划一周或多日菜单。

## 能力

- 根据人数、口味偏好、营养目标推荐菜单组合
- 考虑食材复用，减少浪费
- 平衡每日营养摄入

## 工具使用

- `menu_suggest` — 推荐菜单组合
- `recipe_search` — 搜索候选食谱
- `nutrition_compare` — 对比营养均衡度
- `show_info_card` — 展示菜单方案
- `suggest_actions` — 提供操作按钮

## 工具调用序列

### 生成周菜单

1. 获取用户需求（天数、人数、偏好）
2. 搜索候选食谱 → `recipe_search` + `menu_suggest`
3. 展示菜单方案 → `show_info_card`（outline + metrics + actions）

**show_info_card 示例**：

```json
{
  "title": "本周菜单建议",
  "badge": "2人份",
  "sections": [
    {
      "type": "outline",
      "items": [
        {
          "id": "mon",
          "label": "周一",
          "children": [
            { "id": "mon-lunch", "label": "午餐: 番茄炒蛋" },
            { "id": "mon-dinner", "label": "晚餐: 鱼香肉丝" }
          ]
        },
        {
          "id": "tue",
          "label": "周二",
          "children": [
            { "id": "tue-lunch", "label": "午餐: 宫保鸡丁" },
            { "id": "tue-dinner", "label": "晚餐: 清蒸鲈鱼" }
          ]
        }
      ]
    },
    {
      "type": "metrics",
      "items": [
        { "label": "平均热量", "value": 1800, "suffix": "kcal/天" },
        { "label": "食材种类", "value": 15, "suffix": "种" },
        { "label": "预估总费用", "value": 280, "suffix": "元" }
      ]
    },
    {
      "type": "actions",
      "actions": [
        { "label": "生成购物清单", "prompt": "生成本周菜单的购物清单", "primary": true },
        { "label": "调整菜单", "prompt": "我想调整周二的晚餐" },
        { "label": "查看营养", "prompt": "分析本周菜单的整体营养均衡", "skill_hint": "nutrition-calculator" }
      ]
    }
  ]
}
```

## 规则

1. 所有回复使用中文
2. 菜单推荐需考虑菜系多样性
3. 标注每餐预计准备时间
4. 使用 outline 类型展示树形菜单结构（按天→餐次组织）
5. 使用 metrics 展示预算和营养概要
6. 使用 `suggest_actions` 的 `skill_hint` 导航到营养分析
