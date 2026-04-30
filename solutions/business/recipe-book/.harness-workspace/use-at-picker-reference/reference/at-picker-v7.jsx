import { useState, useRef, useEffect, useCallback, useMemo } from "react";

/* ═══════════ DATA ═══════════ */
const CATEGORIES = [
  { id: "recipes", label: "Recipes 菜谱", icon: "🍳", color: "#ef6c4a", freq: 20,
    items: [
      { id: "r1", name: "鱼香肉丝", desc: "经典川菜", typeIcon: "🥘",
        children: [
          { id: "r1a", name: "食材准备", desc: "猪里脊、木耳、胡萝卜" },
          { id: "r1b", name: "调味汁配比", desc: "醋:糖:酱油 = 2:2:1" },
          { id: "r1c", name: "烹饪步骤", desc: "腌肉→炒香→调汁→翻炒" },
        ]},
      { id: "r2", name: "红烧牛腩", desc: "慢炖浓郁", typeIcon: "🥘",
        children: [
          { id: "r2a", name: "选材要点", desc: "牛腩切块、焯水去腥" },
          { id: "r2b", name: "炖煮时间", desc: "小火慢炖 90 分钟" },
        ]},
    ]},
  { id: "classes", label: "班级", icon: "🏫", color: "#3b82f6", freq: 15,
    items: [
      { id: "c1", name: "三年一班", desc: "35人", typeIcon: "🏫",
        children: [
          { id: "stu1", name: "张小明", desc: "学号 2024001", typeIcon: "👤", avatar: "ZX" },
          { id: "stu2", name: "李思思", desc: "学号 2024002", typeIcon: "👤", avatar: "LS" },
          { id: "stu3", name: "王大力", desc: "学号 2024003", typeIcon: "👤", avatar: "WD" },
        ]},
    ]},
  { id: "students", label: "学生", icon: "👤", color: "#8b5cf6", freq: 12,
    items: [
      { id: "stu1", name: "张小明", desc: "三年一班 · 2024001", typeIcon: "👤", avatar: "ZX" },
      { id: "stu2", name: "李思思", desc: "三年一班 · 2024002", typeIcon: "👤", avatar: "LS" },
      { id: "stu3", name: "王大力", desc: "三年一班 · 2024003", typeIcon: "👤", avatar: "WD" },
    ]},
  { id: "lesson-plans", label: "教案", icon: "📋", color: "#a87cf5", freq: 8,
    items: [
      { id: "lp3", name: "第三课教案", desc: "函数与变量",
        children: [
          { id: "lp3a", name: "教学目标", desc: "理解函数定义" },
          { id: "lp3b", name: "教学步骤", desc: "讲解→练习→总结" },
        ],
        refs: [
          { label: "关联课堂记录",
            target: { id: "cr1", name: "课堂记录-03-15", desc: "第三课实录",
              children: [{ id: "cr1a", name: "课前点名", desc: "出勤 32/35" }, { id: "cr1b", name: "视频片段: 小组讨论", desc: "15:20-22:40" }],
              refs: [{ label: "对应教案", target: { id: "lp3", name: "第三课教案", desc: "⟲ LOOP" }}],
            }},
        ],
      },
    ]},
  { id: "tools", label: "Tools 工具", icon: "🔧", color: "#34c77b", freq: 3,
    items: [{ id: "t1", name: "playwright-mcp", desc: "浏览器自动化" }, { id: "t2", name: "notion-mcp", desc: "Notion 读写" }],
  },
];
const SORTED_CATS = [...CATEGORIES].sort((a, b) => b.freq - a.freq);
const SKILLS = [
  { id: "sk1", name: "article-logic-analyzer", desc: "分析论证链", group: "分析", icon: "🔍" },
  { id: "sk2", name: "roundtable-discussion", desc: "多角色圆桌讨论", group: "工作流", icon: "🛠" },
  { id: "sk3", name: "smart-questions", desc: "引导高质量提问", group: "工作流", icon: "🛠" },
  { id: "sk4", name: "chibi-scene-generator", desc: "Q版插图 prompt", group: "创作", icon: "🎨" },
  { id: "sk5", name: "ux-user-story", desc: "用户故事生成", group: "工作流", icon: "🛠" },
];
const CONTEXT_ENTITY = { item: CATEGORIES[0].items[0], categoryId: "recipes" };
const RECENT_ITEMS = [
  { item: { id: "lp3", name: "第三课教案", desc: "函数与变量" }, categoryId: "lesson-plans", icon: "📋", color: "#a87cf5" },
  { item: { id: "stu1", name: "张小明", desc: "三年一班", avatar: "ZX" }, categoryId: "students", icon: "👤", color: "#8b5cf6" },
];
const buildIdx = () => { const r = []; const walk = (items, ci, cic, cl, cc, ch = []) => { items.forEach(i => { r.push({ ...i, categoryId: ci, categoryIcon: cic, categoryLabel: cl, categoryColor: cc, parentChain: ch }); if (i.children) walk(i.children, ci, cic, cl, cc, [...ch, i.name]); }); }; CATEGORIES.forEach(c => walk(c.items, c.id, c.icon, c.label, c.color)); return r; };
const SEARCH_IDX = buildIdx();

/* ═══════════ HELPERS ═══════════ */
function fmtLabel(s) { if (s.length <= 2) return s[s.length - 1]?.name || ""; const p = s[s.length - 2], l = s[s.length - 1]; return s.length === 3 ? `${p.name} › ${l.name}` : `…${p.name} › ${l.name}`; }
function fmtFull(s) { return s.map(x => x.type === "ref" ? `↗ ${x.name}` : x.name).join(" → "); }
function HL({ text, q }) { if (!q) return text; const i = text.toLowerCase().indexOf(q.toLowerCase()); if (i === -1) return text; return <>{text.slice(0, i)}<span style={{ color: "#f0f2f7", fontWeight: 700 }}>{text.slice(i, i + q.length)}</span>{text.slice(i + q.length)}</>; }

/* ═══════════ MICRO COMPONENTS ═══════════ */
const Kbd = ({ children, accent }) => <kbd style={{ background: accent ? "#34c77b20" : "#181c28", border: `1px solid ${accent ? "#34c77b40" : "#2a3048"}`, borderRadius: 3, padding: "1px 5px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", lineHeight: "16px", color: accent ? "#34c77b" : "#6d7590" }}>{children}</kbd>;
function Avatar({ letters, size = 20 }) { const c = ["#ef6c4a", "#3b82f6", "#8b5cf6", "#e8a830", "#34c77b"][letters.charCodeAt(0) % 5]; return <span style={{ width: size, height: size, borderRadius: "50%", background: c, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{letters}</span>; }
function EIcon({ item, size = 20 }) { if (item.avatar) return <Avatar letters={item.avatar} size={size} />; if (item.typeIcon) return <span style={{ fontSize: size * 0.75, width: size, textAlign: "center", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{item.typeIcon}</span>; return <span style={{ width: size }} />; }
function TokenPill({ token, onRemove, compact }) { const c = token.color || CATEGORIES.find(x => x.id === token.categoryId)?.color || "#888"; const [tip, setTip] = useState(false); return <span onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3, background: c + "14", border: `1px solid ${c}30`, borderRadius: 5, padding: compact ? "1px 6px" : "2px 8px 2px 5px", fontSize: compact ? 11 : 12, fontFamily: "'JetBrains Mono',monospace", color: c, fontWeight: 500, userSelect: "none", lineHeight: "20px", whiteSpace: "nowrap" }}>{token.avatar ? <Avatar letters={token.avatar} size={compact ? 14 : 16} /> : <span style={{ fontSize: compact ? 10 : 11 }}>{token.icon}</span>}{token.displayLabel || token.name}{onRemove && <span onClick={e => { e.stopPropagation(); onRemove(token.id) }} style={{ marginLeft: 1, cursor: "pointer", opacity: 0.4, fontSize: 9 }}>✕</span>}{tip && token.fullPath && <span style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 99, background: "#1e2230", border: "1px solid #2a3048", borderRadius: 6, padding: "5px 8px", fontSize: 10, color: "#c8ccd8", whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.4)", pointerEvents: "none", fontFamily: "'JetBrains Mono',monospace" }}>{token.fullPath}</span>}</span>; }
function SlashPill({ name }) { return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#e8a83014", border: "1px solid #e8a83030", borderRadius: 5, padding: "2px 8px 2px 5px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#e8a830", fontWeight: 500, userSelect: "none", lineHeight: "20px" }}><span style={{ fontSize: 11 }}>⚡</span>/{name}</span>; }
function PlusBtn({ added, onClick }) { return <button onClick={e => { e.stopPropagation(); onClick() }} style={{ width: 20, height: 20, borderRadius: 4, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 600, transition: "all 0.1s", background: added ? "#34c77b" : "#2a3048", color: added ? "#fff" : "#6d7590" }}>{added ? "✓" : "+"}</button>; }

/* ═══════════ MAIN ═══════════ */
export default function AtPickerV7() {
  const [inputParts, setInputParts] = useState([]);
  const [currentText, setCurrentText] = useState("");
  const [pickerMode, setPickerMode] = useState(null); // null | "@" | "/"
  const [focus, setFocus] = useState("search"); // "search" | "list"
  const [navStack, setNavStack] = useState([{ type: "landing" }]);
  const [hi, setHi] = useState(0);
  const [pickerSearch, setPickerSearch] = useState(""); // search text inside picker
  const [addedTokens, setAddedTokens] = useState([]);
  const [messages, setMessages] = useState([{ role: "assistant", text: "双焦点模型：@ 打开后搜索框自动聚焦。\n\n• 直接输入搜索 → Enter 选第一个结果\n• ↓ 跳入列表 → Space 多选 → Enter 确认\n• Esc 退一步（永不丢弃已选）\n• / 插入技能命令\n\n试试在 loop ref（⟲）上按 →" }]);
  const [log, setLog] = useState([]);
  const [shakeId, setShakeId] = useState(null); // item id currently shaking
  const [flashId, setFlashId] = useState(null); // item id flash green on add

  const inputRef = useRef(null), pickerSearchRef = useRef(null), chatEndRef = useRef(null), listRef = useRef(null);
  const currentNav = navStack[navStack.length - 1];
  const isLanding = currentNav.type === "landing";
  const isAt = pickerMode === "@", isSlash = pickerMode === "/";

  const addLog = useCallback((a, d) => setLog(p => [{ a, d }, ...p].slice(0, 40)), []);
  const isLoopRef = useCallback(tid => navStack.some(e => (e.type === "children" && e.parentId === tid) || (e.type === "ref" && e.refTarget?.id === tid)), [navStack]);
  const goLanding = useCallback(() => { setNavStack([{ type: "landing" }]); setHi(0); }, []);
  const closePicker = useCallback(() => { setPickerMode(null); setPickerSearch(""); setFocus("search"); goLanding(); }, [goLanding]);
  const isAdded = useCallback(id => addedTokens.some(t => t.itemId === id), [addedTokens]);

  // Focus picker search when opened
  useEffect(() => { if (pickerMode && pickerSearchRef.current) { pickerSearchRef.current.focus(); setFocus("search"); } }, [pickerMode]);

  // ═══ Build lists ═══
  const atList = useMemo(() => {
    if (!isAt) return [];
    const q = pickerSearch.toLowerCase();
    if (q) return SEARCH_IDX.filter(i => i.name.toLowerCase().includes(q) || (i.desc || "").toLowerCase().includes(q)).map(r => ({ ...r, _section: "search" }));
    if (currentNav.type === "landing") {
      const f = [];
      if (CONTEXT_ENTITY) { const cat = CATEGORIES.find(c => c.id === CONTEXT_ENTITY.categoryId); f.push({ ...CONTEXT_ENTITY.item, categoryId: CONTEXT_ENTITY.categoryId, categoryIcon: cat?.icon, categoryColor: cat?.color, _section: "ctx" }); }
      RECENT_ITEMS.forEach(r => f.push({ ...r.item, categoryId: r.categoryId, categoryIcon: r.icon, categoryColor: r.color, _section: "recent" }));
      SORTED_CATS.forEach(cat => f.push({ ...cat, _section: "browse", _isCat: true }));
      return f;
    }
    if (currentNav.type === "items") { const cat = CATEGORIES.find(c => c.id === currentNav.id); return (cat?.items || []).map(i => ({ ...i, categoryId: cat.id, categoryIcon: cat.icon, categoryColor: cat.color })); }
    let entity = null, cat = null;
    if (currentNav.type === "children") { cat = CATEGORIES.find(c => c.id === currentNav.catId); entity = cat?.items.find(i => i.id === currentNav.parentId); }
    else if (currentNav.type === "ref") { entity = currentNav.refTarget; cat = { icon: "↗", color: "#a87cf5" }; }
    const ch = (entity?.children || []).map(c => ({ ...c, _kind: "child", _section: "own", categoryId: currentNav.catId || currentNav.id }));
    const refs = (entity?.refs || []).map(r => ({ ...r.target, _kind: "ref", _section: "refs", _refLabel: r.label, _refTarget: r.target, _isLoop: isLoopRef(r.target?.id), _canDrill: !isLoopRef(r.target?.id) && ((r.target.children?.length || 0) + (r.target.refs?.length || 0)) > 0, categoryId: currentNav.catId || currentNav.id }));
    return [...ch, ...refs];
  }, [isAt, currentNav, pickerSearch, isLoopRef]);

  const slashList = useMemo(() => { if (!isSlash) return []; const q = pickerSearch.toLowerCase(); return q ? SKILLS.filter(s => s.name.includes(q) || (s.desc || "").includes(q)) : SKILLS; }, [isSlash, pickerSearch]);
  const activeList = isAt ? atList : slashList;

  // Sections for @ mode
  const atSections = useMemo(() => {
    if (!isAt) return [];
    if (pickerSearch) return [{ key: "search" }];
    if (isLanding) return [{ key: "ctx", label: "★ 当前上下文", color: "#ef6c4a" }, { key: "recent", label: "◷ 最近访问" }, { key: "browse", label: "📁 浏览全部" }];
    const ch = atList.filter(i => i._section === "own"), refs = atList.filter(i => i._section === "refs");
    const s = []; if (ch.length) s.push({ key: "own", label: "◆ 自身内容" }); if (refs.length) s.push({ key: "refs", label: "◇ 关联引用", color: "#a87cf5" });
    return s;
  }, [isAt, pickerSearch, isLanding, atList]);

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    if (!isAt || navStack.length <= 1) return [];
    const s = [{ label: "@", clickable: true, action: () => { goLanding(); setPickerSearch(""); } }];
    for (let i = 1; i < navStack.length; i++) { const n = navStack[i]; if (n.type === "items") { const c = CATEGORIES.find(x => x.id === n.id); s.push({ label: `${c?.icon} ${c?.label}`, clickable: true, action: () => { setNavStack(navStack.slice(0, i + 1)); setHi(0); } }); } else if (n.type === "children") { const c = CATEGORIES.find(x => x.id === n.catId); const p = c?.items.find(x => x.id === n.parentId); s.push({ label: `${c?.icon} ${c?.label}`, clickable: true, action: () => { setNavStack(navStack.slice(0, i)); setHi(0); } }); s.push({ label: p?.name, clickable: true, action: () => { setNavStack(navStack.slice(0, i + 1)); setHi(0); } }); } else if (n.type === "ref") { s.push({ label: `↗ ${n.refTarget?.name}`, clickable: true, isRef: true, action: () => { setNavStack(navStack.slice(0, i + 1)); setHi(0); } }); } }
    return s;
  }, [isAt, navStack, goLanding]);

  // Token building
  const buildPath = useCallback((item, catId) => { const s = []; for (const n of navStack) { if (n.type === "items") { const c = CATEGORIES.find(x => x.id === n.id); s.push({ type: "category", id: n.id, name: c?.label }); } else if (n.type === "children") { const c = CATEGORIES.find(x => x.id === n.catId); const p = c?.items.find(x => x.id === n.parentId); if (!s.find(x => x.id === n.catId)) s.push({ type: "category", id: n.catId, name: c?.label }); s.push({ type: "entity", id: n.parentId, name: p?.name }); } else if (n.type === "ref") s.push({ type: "ref", id: n.refTarget?.id, name: n.refTarget?.name }); } s.push({ type: item._kind === "ref" ? "ref" : s.length >= 2 ? "child" : "entity", id: item.id, name: item.name }); if (s.length > 0 && s[0].type !== "category" && catId) { const c = CATEGORIES.find(x => x.id === catId); if (c) s.unshift({ type: "category", id: catId, name: c.label }); } return s; }, [navStack]);
  const makeToken = useCallback((item, catId) => { const cid = catId || currentNav.id || currentNav.catId || ""; const cat = CATEGORIES.find(c => c.id === cid); const ps = buildPath(item, cid); return { id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, itemId: item.id, categoryId: cid, name: item.name, icon: cat?.icon || item.categoryIcon || "•", color: cat?.color || item.categoryColor, avatar: item.avatar, displayLabel: fmtLabel(ps), fullPath: fmtFull(ps) }; }, [currentNav, buildPath]);

  // ═══ Actions ═══
  const commitAndClose = useCallback((extraToken) => {
    const atIdx = currentText.lastIndexOf("@");
    const before = atIdx >= 0 ? currentText.slice(0, atIdx) : currentText;
    const all = [...addedTokens, ...(extraToken ? [extraToken] : [])];
    // Dedup
    const seen = new Set(); const deduped = all.filter(t => { if (seen.has(t.itemId)) return false; seen.add(t.itemId); return true; });
    setInputParts(p => [...p, ...(before ? [before] : []), ...deduped]);
    setCurrentText(""); setAddedTokens([]); closePicker();
    addLog("⏎ CONFIRM", `${deduped.length} tokens`); inputRef.current?.focus();
  }, [currentText, addedTokens, closePicker, addLog]);

  const selectClose = useCallback((item, catId) => { commitAndClose(makeToken(item, catId)); }, [commitAndClose, makeToken]);
  const addStay = useCallback((item, catId) => { if (isAdded(item.id)) { setAddedTokens(p => p.filter(t => t.itemId !== item.id)); addLog("−", item.name); } else { setFlashId(item.id); setTimeout(() => setFlashId(null), 600); setAddedTokens(p => [...p, makeToken(item, catId)]); addLog("＋", item.name); } }, [isAdded, makeToken, addLog]);
  const drillIn = useCallback(target => {
    if (target._isCat) { setNavStack(p => [...p, { type: "items", id: target.id }]); setHi(0); addLog("→", target.label); return; }
    if (isLanding && (target.children?.length || target.refs?.length)) { const catId = target.categoryId; setNavStack(p => [...p, { type: "items", id: catId }, { type: "children", catId, parentId: target.id }]); setHi(0); addLog("→ CTX", target.name); return; }
    if (currentNav.type === "items" && (target.children?.length || target.refs?.length)) { setNavStack(p => [...p, { type: "children", catId: currentNav.id, parentId: target.id }]); setHi(0); addLog("→", target.name); return; }
    if (target._kind === "ref" && target._canDrill) { setNavStack(p => [...p, { type: "ref", catId: currentNav.catId || currentNav.id, refTarget: target._refTarget || target }]); setHi(0); addLog("→ REF", target.name); }
  }, [currentNav, isLanding, addLog]);
  const goBack = useCallback(() => { if (navStack.length > 1) { setNavStack(p => p.slice(0, -1)); setHi(0); addLog("←", ""); } }, [navStack, addLog]);
  const selectSkill = useCallback(skill => { const atIdx = currentText.lastIndexOf("/"); const before = atIdx >= 0 ? currentText.slice(0, atIdx) : currentText; setInputParts(p => [...p, ...(before ? [before] : []), { _slash: true, name: skill.name, id: skill.id }]); setCurrentText(""); closePicker(); addLog("/ INSERT", skill.name); inputRef.current?.focus(); }, [currentText, closePicker, addLog]);

  // ═══ PICKER SEARCH INPUT handler ═══
  const handlePickerSearchKeyDown = useCallback(e => {
    // Focus is in the picker search box
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (activeList.length > 0) { setFocus("list"); setHi(0); addLog("↓ → LIST", ""); }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const first = activeList[0];
      if (!first) return;
      if (isSlash) { selectSkill(first); return; }
      if (first._isCat) { drillIn(first); setFocus("list"); }
      else selectClose(first, first.categoryId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Esc in search = close, preserve staging
      if (addedTokens.length) {
        const atIdx = currentText.lastIndexOf("@"); const before = atIdx >= 0 ? currentText.slice(0, atIdx) : currentText;
        setInputParts(p => [...p, ...(before ? [before] : []), ...addedTokens]); setCurrentText(""); setAddedTokens([]);
      }
      closePicker(); addLog("Esc", "close"); inputRef.current?.focus();
    }
    // All other keys (including Space) → normal text input behavior
  }, [activeList, isSlash, selectSkill, drillIn, selectClose, addedTokens, currentText, closePicker, addLog]);

  // ═══ LIST keyboard handler (when focus = "list") ═══
  const handleListKeyDown = useCallback(e => {
    const list = activeList; const len = list.length;
    if (!len && !["Escape"].includes(e.key)) return;
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setHi(p => (p + 1) % len); break;
      case "ArrowUp":
        e.preventDefault();
        if (hi === 0) { setFocus("search"); pickerSearchRef.current?.focus(); addLog("↑ → SEARCH", ""); }
        else setHi(p => p - 1);
        break;
      case "ArrowRight":
        if (isAt) {
          e.preventDefault();
          const t = list[hi];
          if (t) {
            if (t._isLoop) {
              // Loop ref → shake animation + log
              setShakeId(t.id); setTimeout(() => setShakeId(null), 450);
              addLog("⟲ BLOCKED", `${t.name} 已在路径中`);
            } else {
              drillIn(t);
            }
          }
        }
        break;
      case "ArrowLeft": if (isAt) { e.preventDefault(); goBack(); } break;
      case "Enter": {
        e.preventDefault(); const t = list[hi]; if (!t) break;
        if (isSlash) { selectSkill(t); break; }
        if (t._isCat) drillIn(t);
        else selectClose(t, t.categoryId);
        break;
      }
      case " ": // Space in list = toggle add
        if (isAt) {
          const t = list[hi];
          if (t && !t._isCat) { e.preventDefault(); addStay(t, t.categoryId); }
        }
        break;
      case "Escape":
        e.preventDefault();
        if (isSlash) { closePicker(); addLog("Esc", "/ closed"); }
        else if (!isLanding) { goLanding(); setPickerSearch(""); setFocus("search"); pickerSearchRef.current?.focus(); addLog("Esc→LAND", ""); }
        else { if (addedTokens.length) { const atIdx = currentText.lastIndexOf("@"); const before = atIdx >= 0 ? currentText.slice(0, atIdx) : currentText; setInputParts(p => [...p, ...(before ? [before] : []), ...addedTokens]); setCurrentText(""); setAddedTokens([]); } closePicker(); addLog("Esc", "close"); }
        inputRef.current?.focus(); break;
      case "Tab": { e.preventDefault(); const t = list[hi]; if (t) { if (isSlash) selectSkill(t); else if (t._isCat) drillIn(t); else selectClose(t, t.categoryId); } break; }
      default:
        // Any character key → jump back to search box and type
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setFocus("search"); setPickerSearch(p => p + e.key);
          pickerSearchRef.current?.focus(); addLog("→ SEARCH", `typed "${e.key}"`);
        }
        break;
    }
  }, [activeList, hi, isAt, isSlash, isLanding, addedTokens, drillIn, goBack, selectClose, addStay, selectSkill, closePicker, goLanding, currentText, addLog]);

  // ═══ Main input handler (chatbox) ═══
  const handleMainInputKeyDown = useCallback(e => {
    if (pickerMode) return; // handled by picker
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const disp = inputParts.map(p => typeof p === "string" ? p : p._slash ? `/${p.name}` : `@${p.displayLabel}`).join("") + currentText;
      const toks = inputParts.filter(p => typeof p !== "string" && !p._slash); const skills = inputParts.filter(p => p._slash);
      if (disp.trim()) { setMessages(p => [...p, { role: "user", text: disp }, { role: "assistant", text: `引用: ${toks.map(t => t.fullPath || t.name).join(", ") || "无"}\n技能: ${skills.map(s => s.name).join(", ") || "无"}` }]); setInputParts([]); setCurrentText(""); }
    }
    if (e.key === "Backspace" && currentText === "" && inputParts.length > 0) { const last = inputParts[inputParts.length - 1]; if (typeof last !== "string") { e.preventDefault(); setInputParts(p => p.slice(0, -1)); } }
  }, [pickerMode, inputParts, currentText]);

  const handleMainInputChange = e => {
    const v = e.target.value; setCurrentText(v);
    const atM = v.match(/(^|[\s])@$/); // Only trigger on bare @
    if (atM && pickerMode !== "@") { setPickerMode("@"); setPickerSearch(""); setFocus("search"); addLog("@ OPEN", ""); return; }
    const slM = v.match(/(^|[\s])\/$/);
    if (slM && pickerMode !== "/") { setPickerMode("/"); setPickerSearch(""); setFocus("search"); addLog("/ OPEN", ""); return; }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (pickerMode && listRef.current && focus === "list") { const el = listRef.current.querySelector(`[data-idx="${hi}"]`); el?.scrollIntoView({ block: "nearest" }); } }, [hi, pickerMode, focus]);
  useEffect(() => { if (hi >= activeList.length && activeList.length > 0) setHi(0); }, [activeList, hi]);

  // Entity banner
  const ctxEntity = useMemo(() => { if (!isAt) return null; if (currentNav.type === "children") { const c = CATEGORIES.find(x => x.id === currentNav.catId); return { entity: c?.items.find(i => i.id === currentNav.parentId), cat: c }; } if (currentNav.type === "ref") return { entity: currentNav.refTarget, cat: { icon: "↗", color: "#a87cf5" } }; return null; }, [isAt, currentNav]);

  // Hints
  const hints = useMemo(() => {
    const h = [];
    if (focus === "search") {
      h.push({ key: "↓", label: "进入列表" }); h.push({ key: "⏎", label: "选第一个" }); h.push({ key: "Esc", label: "关闭" });
    } else {
      h.push({ key: "↑↓", label: "导航" });
      const item = activeList[hi];
      if (isAt && (item?._isCat || item?.children?.length || item?.refs?.length || item?._canDrill)) h.push({ key: "→", label: item?._isCat ? "进入" : "子级" });
      if (item && !item._isCat) { h.push({ key: "Space", label: "添加+继续", accent: true }); h.push({ key: "⏎", label: isSlash ? "插入" : "确认" }); }
      else if (item?._isCat) h.push({ key: "⏎", label: "进入" });
      if (isAt && navStack.length > 1) h.push({ key: "←", label: "返回" });
      if (isAt && !isLanding) h.push({ key: "Esc", label: "回首页" });
      else h.push({ key: "Esc", label: "关闭" });
    }
    return h;
  }, [focus, activeList, hi, isAt, isSlash, navStack, isLanding]);

  /* ═══════════ RENDER ═══════════ */
  return (
    <div style={{ "--bg": "#0c0e14", "--s1": "#14171f", "--s2": "#1b1f2b", "--b1": "#1f2435", "--b2": "#2a3048", "--t0": "#f0f2f7", "--t1": "#c8ccd8", "--t2": "#6d7590", "--t3": "#454d68", "--accent": "#5b9cf5", fontFamily: "'DM Sans',-apple-system,sans-serif", color: "var(--t0)", background: "var(--bg)", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#2a3048;border-radius:2px}
@keyframes slideUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-4px)}30%{transform:translateX(4px)}45%{transform:translateX(-3px)}60%{transform:translateX(3px)}75%{transform:translateX(-1px)}90%{transform:translateX(1px)}}
@keyframes popIn{0%{transform:scale(0.8);opacity:0}50%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
@keyframes flashGreen{0%{background:rgba(52,199,123,0.25)}100%{background:rgba(52,199,123,0)}}
.shake-row{animation:shake 0.4s ease-in-out}
.pop-token{animation:popIn 0.25s ease-out}
.flash-add{animation:flashGreen 0.6s ease-out}
      `}</style>

      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", gap: 10, background: "var(--s1)" }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg,#e8a830,#ef5350)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>即</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>v7 — 双焦点模型 (Search ↔ List)</div></div>
        <div style={{ fontSize: 10, color: "var(--t3)" }}>焦点: {pickerMode ? (focus === "search" ? "🔍 搜索框" : "📋 列表") : "💬 输入框"}</div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflow: "auto", padding: "14px 18px" }}>
        {messages.map((msg, i) => <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}><div style={{ maxWidth: "80%", padding: "9px 14px", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px", background: msg.role === "user" ? "#2556b8" : "var(--s2)" }}>{msg.text}</div></div>)}
        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div style={{ position: "relative", borderTop: "1px solid var(--b1)", background: "var(--s1)" }}>
        {pickerMode && (
          <div style={{ position: "absolute", bottom: "100%", left: 12, right: 12, maxHeight: 440, background: "var(--s1)", border: `1px solid ${isSlash ? "#e8a83040" : "var(--b2)"}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 -6px 28px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", marginBottom: 6, animation: "slideUp 0.12s ease-out" }}>

            {/* ═══ PICKER SEARCH BOX ═══ */}
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, color: isSlash ? "#e8a830" : "var(--accent)", fontWeight: 600 }}>{isSlash ? "/" : "@"}</span>
              <input
                ref={pickerSearchRef}
                value={pickerSearch}
                onChange={e => { setPickerSearch(e.target.value); setHi(0); }}
                onKeyDown={handlePickerSearchKeyDown}
                onFocus={() => setFocus("search")}
                placeholder={isSlash ? "搜索技能..." : "搜索资源...   ↓ 浏览列表"}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--t0)", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", padding: 0 }}
              />
              {addedTokens.length > 0 && <span style={{ fontSize: 10, color: "#34c77b", fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", background: "#34c77b15", padding: "2px 6px", borderRadius: 4 }}>{addedTokens.length} 已选</span>}
            </div>

            {/* Breadcrumb (non-landing) */}
            {isAt && navStack.length > 1 && (
              <div style={{ padding: "4px 12px", borderBottom: "1px solid var(--b1)", fontSize: 11, color: "var(--t2)", display: "flex", alignItems: "center", fontFamily: "'JetBrains Mono',monospace" }}>
                {breadcrumb.map((seg, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>{i > 0 && <span style={{ opacity: 0.3, margin: "0 4px" }}>›</span>}<span onClick={seg.action} style={{ cursor: seg.clickable ? "pointer" : "default", color: seg.isRef ? "#a87cf5" : seg.clickable ? "var(--accent)" : "var(--t2)" }}>{seg.label}</span></span>)}
              </div>
            )}

            {/* Entity banner */}
            {isAt && ctxEntity && <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--b1)", background: (ctxEntity.cat?.color || "#888") + "08", display: "flex", alignItems: "center", gap: 8 }}><EIcon item={ctxEntity.entity || {}} size={22} /><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", color: ctxEntity.cat?.color }}>{ctxEntity.entity?.name}</div></div></div>}

            {/* Added tokens tray */}
            {addedTokens.length > 0 && <div style={{ padding: "5px 12px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", background: "#34c77b08" }}><span style={{ fontSize: 10, color: "#34c77b", fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>已选:</span>{addedTokens.map(t => <span key={t.id} className="pop-token"><TokenPill token={t} compact onRemove={id => setAddedTokens(p => p.filter(x => x.id !== id))} /></span>)}</div>}

            {/* ═══ LIST ═══ */}
            <div ref={listRef} style={{ overflow: "auto", flex: 1 }}
              tabIndex={-1}
              onKeyDown={focus === "list" ? handleListKeyDown : undefined}
              onFocus={() => setFocus("list")}
            >
              {isAt && (() => {
                let gIdx = -1, lastSec = null;
                return atList.map(item => {
                  gIdx++; const idx = gIdx; const hl = focus === "list" ? idx === hi : (idx === 0 && focus === "search"); // first item highlight preview when in search
                  const added = isAdded(item.id); const secChanged = item._section !== lastSec; lastSec = item._section;
                  const sec = secChanged ? atSections.find(s => s.key === item._section) : null;
                  const color = item.categoryColor || item.color || "var(--accent)";
                  if (item._isCat) return <div key={item.id}>{sec && <div style={{ padding: "6px 12px 3px", fontSize: 9, fontWeight: 600, color: sec.color || "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", borderTop: sec.key !== "ctx" ? "1px solid var(--b1)" : "none", marginTop: sec.key !== "ctx" ? 2 : 0 }}>{sec.label}</div>}<div data-idx={idx} style={{ padding: "7px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: hl ? "var(--accent)0c" : "transparent", borderLeft: hl ? "2px solid var(--accent)" : "2px solid transparent" }} onMouseEnter={() => { setFocus("list"); setHi(idx); }} onClick={() => drillIn(item)}><span style={{ fontSize: 15, width: 22, textAlign: "center" }}>{item.icon}</span><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}><HL text={item.label} q={pickerSearch} /></div><div style={{ fontSize: 10, color: "var(--t3)", marginTop: 1 }}>{item.items.length} 项</div></div><span style={{ color: "var(--t3)", fontSize: 12 }}>›</span></div></div>;
                  if (item._kind === "ref") return <div key={item.id + idx}>{sec && <div style={{ padding: "6px 12px 3px", fontSize: 9, fontWeight: 600, color: "#a87cf5", textTransform: "uppercase", letterSpacing: "0.05em", borderTop: "1px solid var(--b1)", marginTop: 2 }}>{sec.label}</div>}<div data-idx={idx} className={shakeId === item.id ? "shake-row" : ""} style={{ padding: "7px 10px 7px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: hl ? "#a87cf50c" : "transparent", borderLeft: hl ? "2px solid #a87cf5" : "2px solid transparent", position: "relative" }} onMouseEnter={() => { setFocus("list"); setHi(idx); }} onClick={() => selectClose(item, item.categoryId)}><PlusBtn added={added} onClick={() => addStay(item, item.categoryId)} /><span style={{ fontSize: 12, color: "#a87cf5" }}>↗</span><div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "var(--t3)" }}>{item._refLabel}</div><div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'JetBrains Mono',monospace" }}><HL text={item.name} q={pickerSearch} /></div></div>{item._canDrill && <span onClick={e => { e.stopPropagation(); drillIn(item); }} style={{ fontSize: 10, color: hl ? "#a87cf5" : "var(--t3)", cursor: "pointer", padding: "2px 4px", borderRadius: 3, fontFamily: "'JetBrains Mono',monospace" }}>{(item.children?.length || 0) + (item.refs?.length || 0)} ›</span>}{item._isLoop && <span style={{ fontSize: 9, color: "var(--t3)", display: "flex", alignItems: "center", gap: 3 }}><span style={{ fontSize: 11 }}>⟲</span>{shakeId === item.id && <span style={{ background: "#1e2230", border: "1px solid #2a3048", borderRadius: 5, padding: "3px 8px", fontSize: 10, color: "#ef6c4a", whiteSpace: "nowrap", animation: "popIn 0.2s ease-out" }}>已在路径中，无法展开</span>}</span>}</div></div>;
                  const hasKids = (item.children?.length || 0) + (item.refs?.length || 0) > 0;
                  return <div key={item.id + idx}>{sec && <div style={{ padding: "6px 12px 3px", fontSize: 9, fontWeight: 600, color: sec.color || "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", borderTop: gIdx > 0 ? "1px solid var(--b1)" : "none", marginTop: gIdx > 0 ? 2 : 0 }}>{sec.label}</div>}<div data-idx={idx} className={flashId === item.id ? "flash-add" : ""} style={{ padding: "7px 10px 7px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: hl ? color + "0c" : "transparent", borderLeft: hl ? `2px solid ${color}` : "2px solid transparent" }} onMouseEnter={() => { setFocus("list"); setHi(idx); }} onClick={() => selectClose(item, item.categoryId)}><PlusBtn added={added} onClick={() => addStay(item, item.categoryId)} /><EIcon item={item} size={20} /><div style={{ flex: 1, minWidth: 0 }}>{pickerSearch && item.parentChain?.length > 0 && <div style={{ fontSize: 9, color: "var(--t3)", marginBottom: 2 }}>{item.categoryIcon} {item.categoryLabel}{item.parentChain.length ? ` › ${item.parentChain.join(" › ")}` : ""}</div>}<div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'JetBrains Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><HL text={item.name} q={pickerSearch} /></div>{item.desc && <div style={{ fontSize: 10, color: hl ? "var(--t1)" : "var(--t2)", marginTop: 1 }}><HL text={item.desc} q={pickerSearch} /></div>}</div>{hasKids && <span onClick={e => { e.stopPropagation(); drillIn(item); }} style={{ fontSize: 10, color: hl ? color : "var(--t3)", cursor: "pointer", padding: "2px 4px", borderRadius: 3, background: hl ? color + "15" : "transparent", fontFamily: "'JetBrains Mono',monospace" }}>{(item.children?.length || 0) + (item.refs?.length || 0)} ›</span>}</div></div>;
                });
              })()}
              {isAt && pickerSearch && atList.length === 0 && <div style={{ padding: 28, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>未找到 "{pickerSearch}"</div>}

              {isSlash && (() => { let gIdx = -1; const groups = {}; slashList.forEach(s => { if (!groups[s.group]) groups[s.group] = []; groups[s.group].push(s); }); return Object.entries(groups).map(([group, skills]) => <div key={group}><div style={{ padding: "6px 12px 3px", fontSize: 9, fontWeight: 600, color: "#e8a830", textTransform: "uppercase", letterSpacing: "0.05em" }}>{skills[0]?.icon} {group}</div>{skills.map(skill => { gIdx++; const idx = gIdx; const hl = focus === "list" ? idx === hi : (idx === 0 && focus === "search"); return <div key={skill.id} data-idx={idx} style={{ padding: "7px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: hl ? "#e8a8300c" : "transparent", borderLeft: hl ? "2px solid #e8a830" : "2px solid transparent" }} onMouseEnter={() => { setFocus("list"); setHi(idx); }} onClick={() => selectSkill(skill)}><span style={{ fontSize: 14, width: 20, textAlign: "center" }}>⚡</span><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'JetBrains Mono',monospace" }}><HL text={skill.name} q={pickerSearch} /></div><div style={{ fontSize: 10, color: hl ? "var(--t1)" : "var(--t2)", marginTop: 1 }}><HL text={skill.desc} q={pickerSearch} /></div></div>{hl && focus === "list" && <span style={{ fontSize: 9, color: "var(--t3)", border: "1px solid var(--b2)", borderRadius: 3, padding: "1px 4px" }}>⏎ 插入</span>}</div>; })}</div>); })()}
              {isSlash && pickerSearch && slashList.length === 0 && <div style={{ padding: 28, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>未找到 "{pickerSearch}"</div>}
            </div>

            {/* Hints */}
            <div style={{ display: "flex", gap: 8, padding: "5px 12px", borderTop: "1px solid var(--b1)", background: "#181c28", fontSize: 10, color: "var(--t3)", fontFamily: "'JetBrains Mono',monospace", flexWrap: "wrap" }}>
              {hints.map((h, i) => <span key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}><Kbd accent={h.accent}>{h.key}</Kbd><span style={{ color: h.accent ? "#34c77b" : undefined }}>{h.label}</span></span>)}
              <span style={{ marginLeft: "auto", opacity: 0.5 }}>{focus === "search" ? "🔍 搜索" : "📋 列表"}</span>
            </div>
          </div>
        )}

        {/* Main input row */}
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div onClick={() => inputRef.current?.focus()} style={{ flex: 1, background: "var(--bg)", border: `1px solid ${pickerMode === "/" ? "#e8a83040" : pickerMode === "@" ? "var(--accent)" : "var(--b2)"}`, borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, minHeight: 42, cursor: "text", transition: "border-color 0.15s" }}>
            {inputParts.map((p, i) => typeof p === "string" ? <span key={`s${i}`} style={{ fontSize: 13, whiteSpace: "pre" }}>{p}</span> : p._slash ? <SlashPill key={`sl${i}`} name={p.name} /> : <TokenPill key={p.id} token={p} onRemove={id => setInputParts(prev => prev.filter(x => typeof x === "string" || x.id !== id || x._slash))} />)}
            <input ref={inputRef} value={currentText} onChange={handleMainInputChange} onKeyDown={handleMainInputKeyDown} placeholder={inputParts.length === 0 ? "键入 @ 引用，/ 技能..." : ""} style={{ flex: 1, minWidth: 100, border: "none", outline: "none", background: "transparent", color: "var(--t0)", fontSize: 13, fontFamily: "inherit", lineHeight: "20px", padding: 0 }} autoFocus />
          </div>
          <button onClick={() => { const d = inputParts.map(p => typeof p === "string" ? p : p._slash ? `/${p.name}` : `@${p.displayLabel}`).join("") + currentText; const t = inputParts.filter(p => typeof p !== "string" && !p._slash); const s = inputParts.filter(p => p._slash); if (d.trim()) { setMessages(p => [...p, { role: "user", text: d }, { role: "assistant", text: `引用: ${t.map(x => x.fullPath || x.name).join(", ") || "无"}\n技能: ${s.map(x => x.name).join(", ") || "无"}` }]); setInputParts([]); setCurrentText(""); setAddedTokens([]); closePicker(); } }} style={{ width: 36, height: 36, borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 600 }}>↑</button>
        </div>
      </div>

      {/* Log */}
      <div style={{ borderTop: "1px solid var(--b1)", background: "#181c28", padding: "5px 16px 6px", maxHeight: 80, overflow: "auto" }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "var(--t3)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Event Log</div>
        {log.length === 0 ? <div style={{ fontSize: 10, color: "var(--t3)" }}>@ 或 / ...</div>
          : log.slice(0, 6).map((ev, i) => <div key={i} style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: "var(--t2)", lineHeight: 1.5 }}><span style={{ color: ev.a.includes("＋") ? "#34c77b" : ev.a.includes("→") || ev.a.includes("/") ? "#e8a830" : ev.a.includes("SEARCH") ? "#a87cf5" : "var(--accent)", fontWeight: 600 }}>{ev.a}</span> <span style={{ opacity: 0.6 }}>{ev.d}</span></div>)}
      </div>
    </div>
  );
}
