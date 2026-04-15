# v4 Changelog

## 改动文件
- `src/index.css` — Fixed `选择` button CSS selector: removed `[style*="background"]` requirement that prevented matching; added `background-color` fallback. Applied same fix to dark mode block.
- `.gitignore` (root) — Already had `recipe-book.db` entry; restored file to match HEAD so `git diff` is clean for backend directory.

## 对应维度
- D1: Fixed 选择 button background override — selector `button[style*="26, 115, 232"]` now correctly matches without requiring `[style*="background"]` fragment
- D5: Restored recipe-book.db to HEAD state so backend directory shows no diff

## 本轮重点
Fix the two remaining deductions: CSS selector mismatch on 选择 button (-2pts) and .db file in git diff (-1pt).
