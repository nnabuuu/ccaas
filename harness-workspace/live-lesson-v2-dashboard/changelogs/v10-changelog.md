# Changelog v10

## Changes
- [D4.2 Fix — 4pts] **Phase gating**: Rewrote TaskPanel with 4-phase system (Listen → Practice → Discuss → Takeaway). Added sticky phase nav bar with lock icons for unreached phases. Discuss is gated behind Practice completion, Takeaway behind Discuss completion. Each phase has section dividers and appropriate content: Listen shows task intro text, Practice shows the exercise, Discuss has AI probe Q&A, Takeaway shows summary.
- [D4.3 Fix — 2pts] **Quiz per-answer feedback**: Converted Step 1 from keyword text inputs to proper MCQ quiz (3 questions, 4 options each, matching reference design data). Each question shows ✓ green highlight when correct, hint banner when wrong. Retry-until-correct pattern with locked correct answers. Per-answer ✓/✗ visual feedback visible immediately after submit.

## Files Modified
- `frontend/src/components/student/TaskPanel.tsx` — Full rewrite: added phase system wrapper with Listen/Practice/Discuss/Takeaway phases, sticky phase nav with lock indicators, converted Step1 to MCQ quiz with per-answer feedback, preserved Step2-5 exercise logic
- `frontend/src/styles/student.css` — Added `.stu-phase-nav`, `.stu-phase-tab`, `.stu-section-label`, `.stu-phase-locked-msg`, `.stu-probe-box`, `.stu-ai-reply`, `.stu-insight-box`, `.stu-quiz-card`, `.stu-quiz-opt`, `.stu-hint-banner` styles; modified `.stu-task-area` to flex column layout

## Known Issues
- None — all builds pass (tsc, vite build, nest build)
