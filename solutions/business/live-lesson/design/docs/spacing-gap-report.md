# Spacing System · Gap Report

> 背景：在 `board.html` 的 Step 1 "图式激活" 区块中，"现象 / 对照 / 悬念" 三个列标题紧贴父容器顶部边缘，视觉上"顶破了框"。追因发现是 `.column { padding: 0 18px }` —— 顶部内边距为 0。这不是单点 bug，而是 design system 里 spacing 这一层**从未成形**导致的系统性问题。本文给到 design system owner 作为补全依据。

---

## 1. 现状诊断

### 1.1 已存在的 design tokens

| 类别 | 落位 | 情况 |
|---|---|---|
| **颜色** | `colors_and_type.css` · `:root` | ✅ 有 token (`--t1/t2/t3`, `--blue/green/amber/red/purple/teal`, `--*-bg`, `--border/border-strong`) |
| **字体 family** | `colors_and_type.css` | ✅ 有 (`--hand` 粉笔体、Plus Jakarta Sans 主栈) |
| **字号** | 各 component 文件自定义 | ❌ 无 token，全是魔数 |
| **行高** | 同上 | ❌ 无 token |
| **Spacing / Radius / Shadow** | 完全没有 | ❌ **缺失** |

### 1.2 "没有 spacing token" 的直接证据

抽样 `board.html` 中出现的 padding/gap/margin 值：

```
.step-section       padding: 20px 22px 26px
.step-banner        padding-bottom: 10px; margin-bottom: 2px
.column             padding: 0 18px          ← 本次 bug 源头
.col-hd             margin-bottom: 14px; padding-bottom: 6px
.col-body           gap: 12px 10px
.bk                 padding: 16px 20px; gap: 8px
.bk-heading         padding: 18px 22px
.bk-quote           padding: 14px 18px 14px 20px
.bk-chiprow         padding: 14px 18px; gap: 8px
.bk-compare         padding: 0 (overflow hidden, inner sides 16px 20px)
.bk-cmp-side        padding: 16px 20px; gap: 10px
.bk-anno            padding: 12px 16px; gap: 10px
.bk-mindmap         padding: 18px 20px
.bk-formula         padding: 16px 20px
```

观察：
- 上下 padding 用过 `0 / 6 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 26` —— **每个开发者凭手感取值**
- 左右 padding 用过 `16 / 18 / 20 / 22` —— 同样发散
- gap 用过 `2 / 4 / 6 / 8 / 10 / 12 / 14` —— 同样发散
- 同一层级的容器（`bk-heading` 18/22 vs `bk-quote` 14/18/20 vs `bk-compare` 内侧 16/20）节奏不一致，导致整板视觉不齐

### 1.3 为什么 `.column { padding: 0 18px }` 会被写出来

因为没有任何一条强制性 principle 说："**任何带 border / background 的容器都必须有对称的上下 padding**"。开发者当时的心智是："列之间用左右 padding 分开就行，上下由子块自己处理" —— 在没有 system 约束下，这是合理的局部判断，但会在外层父容器（`.step-section`）自身有 border/bg 时把标题顶到边缘。

**结论：这不是写错，是 system 缺口。**

---

## 2. 需要补全的三层 (从最紧急到最彻底)

### Layer 1 · Spacing Scale token (**必须**)

建议引入 4px-grid 的 scale，覆盖 95% 场景：

```css
:root {
  --sp-0: 0;
  --sp-1: 4px;    /* hairline — icon gap / inline chip */
  --sp-2: 8px;    /* tight — within a block */
  --sp-3: 12px;   /* default intra-block gap */
  --sp-4: 16px;   /* block padding X / Y */
  --sp-5: 20px;   /* container inner padding */
  --sp-6: 24px;   /* section padding */
  --sp-7: 32px;   /* section gap */
  --sp-8: 48px;   /* page-level */
}
```

**约定**：任何 `padding / gap / margin` 数值都必须引用 token；code review 时命中魔数直接打回。

### Layer 2 · Container padding principle (**必须，防此次 bug 再发生**)

写入 design system 文档，成为硬规则：

> **规则 C-1：任何同时具有 `border` 或 `background` 的容器，上下 padding 不得为 0，且上下对称（上 ≥ 下 × 0.8）。**
>
> 理由：容器的视觉边界是一个"房间的墙"，其中的元素必须有呼吸空间，否则标题会顶到墙面、尾部会贴到地板，视觉上破框。
>
> 最小值：`--sp-3` (12px)。建议值：`--sp-4` / `--sp-5`。

对应修复 `.column`：
```css
.column { padding: var(--sp-3) var(--sp-5); }   /* 之前是 0 18px */
```

### Layer 3 · Nested container rhythm (**推荐**)

引入 "父 - 子 - 孙" 三层 padding 递减节奏，避免嵌套容器 padding 冲突：

| 层级 | 例子 | 内侧 padding |
|---|---|---|
| L1 Section | `.step-section` | `--sp-5 --sp-6` (20 / 24) |
| L2 Column / Region | `.column` / `.fullbleed-row` | `--sp-3 --sp-5` (12 / 20) |
| L3 Block | `.bk / .bk-heading / .bk-quote …` | `--sp-4 --sp-5` (16 / 20) |
| L4 Block-inner | `.bk-cmp-side`, `.bk-anno` | `--sp-3 --sp-4` (12 / 16) |

**Gap (子元素之间距离)** 同样按层级：

| 层级 | 典型 gap |
|---|---|
| Section 间 | `--sp-7` (32) |
| Column-body 内 block 间 | `--sp-3` (12) |
| Block 内 atom 间 | `--sp-2` (8) |
| Inline / chip | `--sp-1` / `--sp-2` (4 / 8) |

---

## 3. 同时顺手做掉的两件事 (强烈推荐)

### 3.1 Type scale token

字号也是魔数（11 / 13 / 15 / 17 / 22 / 26 px 等）。建议：

```css
:root {
  --fs-xs: 10px;  --lh-xs: 1.4;   /* eyebrow / meta */
  --fs-sm: 12px;  --lh-sm: 1.5;   /* label / caption */
  --fs-md: 14px;  --lh-md: 1.55;  /* body */
  --fs-lg: 17px;  --lh-lg: 1.45;  /* block title */
  --fs-xl: 22px;  --lh-xl: 1.2;   /* column / section title */
  --fs-2xl:28px;  --lh-2xl:1.15;  /* hero */
  --fs-hand-md: 18px; --fs-hand-lg: 24px;   /* 粉笔体专用 (有 ascender 溢出) */
}
```

**粉笔体特别说明**：`Caveat` 这类手写体 x-height / ascender 不同于无衬线，需要**额外 4–6px 的 top-space**，或在 principle 里写"凡用 `var(--hand)` 的标题，其容器 top padding ≥ 字号 × 0.3"。本次 bug 的另一半原因在这里。

### 3.2 Radius & Shadow token

也都是魔数（`border-radius: 6/8/10/12/14/16/20` 随便写）。建议：

```css
:root {
  --rad-sm: 4px;    /* pill / tag */
  --rad-md: 8px;    /* chip / small button */
  --rad-lg: 12px;   /* block */
  --rad-xl: 16px;   /* section */
  --rad-full: 9999px;
  --shadow-sm: 0 1px 2px rgba(28,28,26,.06);
  --shadow-md: 0 4px 12px -4px rgba(28,28,26,.12);
  --shadow-lg: 0 20px 40px -20px rgba(28,28,26,.25);
}
```

---

## 4. 迁移成本估算

| 动作 | 工作量 | 风险 |
|---|---|---|
| 引入 token (layer 1) | 0.5 天 | 无 |
| Spacing 魔数替换（`board.html`/`student.html`/`teacher.html`） | 1 天 | 低 — 视觉几乎不变，数值会收敛 |
| 写规则文档 + review checklist | 0.5 天 | 无 |
| Type / Radius / Shadow token 顺手做 | 0.5 天 | 无 |
| **合计** | **约 2.5 天** | |

---

## 5. 本次 bug 的临时修复（已在 codebase 内）

```css
/* surfaces/board.html 第 73 行 */
.column { padding: 10px 18px 4px; }   /* was: 0 18px */
```

这是 hotfix，**不替代** system 层补全。若 system 不补，类似 bug 还会在未来的 block 类型 / 新页面上反复出现。

---

## 6. 给 design system owner 的最小行动项

- [ ] 在 `colors_and_type.css` (或新建 `tokens.css`) 加入 `--sp-*` token
- [ ] 在 design system 文档里写死 **规则 C-1**（容器 padding 不为 0 且对称）
- [ ] 把现有 board/student/teacher 三个文件的 padding / gap / margin 魔数替换为 token（可分批）
- [ ] 顺带补 `--fs-*` / `--rad-*` / `--shadow-*` token
- [ ] Review checklist 增加一条："本 PR 是否使用了未 token 化的 spacing / font-size / radius 数值？"
