# Quiz Analyzer - Quick Start Guide

## 🚀 Start the App

```bash
cd solutions/quiz-analyzer/frontend
npm run dev
```

Open: http://localhost:5282

---

## 📝 How to Use

### 1. Input a Quiz
- **Left Panel** → Paste quiz content in textarea
- **(Optional)** Add reference answer in second textarea
- Press **Ctrl+Enter** or click **"分析题目"**

### 2. View Analysis
- **Right Panel** → See AI analysis results
- 10 dimensions: Overall, Knowledge Points, Solution Steps, Common Mistakes, etc.
- **Chat Section** → Ask follow-up questions (expandable)

### 3. Export Results
- Click **"导出分析"** button (top right)
- Choose format:
  - **JSON** - Machine-readable
  - **Markdown** - Human-readable
  - **Copy** - To clipboard

### 4. Access History
- **Left Panel** → Scroll to "分析历史"
- Click any previous analysis to view
- Max 50 records (oldest auto-deleted)

---

## ⌨️ Keyboard Shortcuts

- **Ctrl+Enter** - Analyze quiz
- **ESC** - (Future) Close modals

---

## 📂 Data Storage

- **Location**: Browser LocalStorage
- **Limit**: 50 analyses
- **Persistence**: Survives page refresh
- **Cross-device**: No (export JSON to transfer)

---

## 🐛 Troubleshooting

### Analysis not showing?
- Check browser console for errors
- Verify AI backend connection (footer status)
- Try refreshing the page

### History disappeared?
- Check browser didn't clear LocalStorage
- Export important analyses as JSON backups

### Export not working?
- Check browser download permissions
- Try copy to clipboard instead

---

## 📊 Build Status

**Frontend**: ✅ Built successfully (259KB)
**Backend**: ✅ Built successfully
**Errors**: 0

---

## 📖 Full Documentation

- `SIMPLIFICATION_IMPLEMENTATION_SUMMARY.md` - Complete implementation details
- `QUIZ_ANALYZER_SIMPLIFICATION_COMPLETE.md` - Architecture documentation

---

**Ready to test!** 🎉
