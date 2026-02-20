import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════
// ANIMATION ENGINE (replaces manual lerp)
// ═══════════════════════════════════════════
const ease = t => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, t)))) / 2;

function jointPos(x, y, angleDeg, length) {
  const r = angleDeg * Math.PI / 180;
  return { x: x + Math.cos(r) * length, y: y + Math.sin(r) * length };
}

function interpolate(keyframes, progress) {
  // progress: 0 → keyframes.length-1 (continuous)
  const maxIdx = keyframes.length - 1;
  const clamped = Math.max(0, Math.min(progress, maxIdx));
  const i = Math.min(Math.floor(clamped), maxIdx - 1);
  const t = ease(clamped - i);
  const from = keyframes[i], to = keyframes[i + 1] || from;
  const result = {};
  for (const k of Object.keys(from)) {
    if (typeof from[k] === "number") {
      result[k] = from[k] + (to[k] - from[k]) * t;
    }
  }
  return result;
}

// ═══════════════════════════════════════════
// SKELETON RENDERER PRIMITIVES
// ═══════════════════════════════════════════
const Bone = ({ x1, y1, x2, y2, w = 14, color = "#8cb8d0", jointR }) => (
  <g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" />
    <circle cx={x1} cy={y1} r={jointR || w * 0.42} fill="#6a98b0" />
  </g>
);

const Head = ({ x, y, r = 20, color = "#8cb8d0", look = 0 }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={color} />
    <circle cx={x + look * 5} cy={y - 4} r={2.8} fill="#1e3a4e" />
    <ellipse cx={x + look * 2} cy={y + 6} rx={4.5} ry={2.2} fill="#1e3a4e" opacity=".25" />
  </g>
);

const Hand = ({ x, y, r = 8, color = "#e8d5c0" }) => (
  <circle cx={x} cy={y} r={r} fill={color} />
);

const Foot = ({ x, y, color = "#7a9fb5" }) => (
  <ellipse cx={x + 5} cy={y} rx={13} ry={7} fill={color} />
);

const Ground = ({ y }) => (
  <line x1={20} y1={y} x2={480} y2={y} stroke="#2a3a4a" strokeWidth={2} />
);

const Glow = ({ x, y, rx = 25, ry = 15, on, color = "#22d3ee" }) => !on ? null : (
  <g>
    <ellipse cx={x} cy={y} rx={rx + 8} ry={ry + 5} fill={color} opacity=".07" />
    <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="none" stroke={color}
      strokeWidth={2} opacity=".35" strokeDasharray="5,4" />
  </g>
);

// ═══════════════════════════════════════════
// EXERCISE DEFINITIONS (data-driven!)
// ═══════════════════════════════════════════
const EXERCISES = [
  {
    id: "pelvic-tilt", nameZh: "骨盆前倾", name: "Pelvic Tilt",
    sets: 3, reps: 12, restSec: 20, tempo: "5秒保持",
    muscles: "腹横肌 · 骨盆底肌 · 臀肌",
    howTo: [
      "仰卧屈膝，双脚平放地面，与髋同宽",
      "双手自然放在身体两侧",
      "呼气时收紧下腹，想象肚脐向脊柱方向靠拢",
      "轻轻将腰部压向地面（毛巾垫在腰下辅助感知）",
      "保持5秒，正常呼吸，然后缓慢放松",
    ],
    safety: ["不需要大幅度，微微收紧即可", "这是Dead Bug的基础动作，先熟练再进阶"],
    phases: ["仰卧放松", "收紧腹部", "骨盆后倾", "HOLD 保持", "缓慢放松"],
    phaseDur: [2, 1.5, 3, 2, 2],
    type: "lying",
    // Keyframes: joint angles at each phase boundary
    keyframes: [
      { rHip: -75, rKnee: 75, lHip: -72, lKnee: 72, rSh: 100, lSh: 105, tilt: 0 },
      { rHip: -75, rKnee: 75, lHip: -72, lKnee: 72, rSh: 100, lSh: 105, tilt: 0.3 },
      { rHip: -78, rKnee: 75, lHip: -75, lKnee: 72, rSh: 100, lSh: 105, tilt: 1 },
      { rHip: -78, rKnee: 75, lHip: -75, lKnee: 72, rSh: 100, lSh: 105, tilt: 1 },
      { rHip: -78, rKnee: 75, lHip: -75, lKnee: 72, rSh: 100, lSh: 105, tilt: 1 },
      { rHip: -75, rKnee: 75, lHip: -72, lKnee: 72, rSh: 100, lSh: 105, tilt: 0 },
    ],
  },
  {
    id: "dead-bug", nameZh: "死虫式", name: "Dead Bug",
    sets: 3, reps: 10, restSec: 30, tempo: "慢速 3秒下3秒回",
    muscles: "腹横肌 · 腹直肌 · 髂屈肌",
    howTo: [
      "仰卧，双臂伸向天花板，双腿抬起屈膝90°",
      "腰下垫毛巾当「传感器」，感知腰部是否离开地面",
      "呼气时，对侧手臂和腿同时缓慢伸出（右腿+左臂）",
      "全程腰部保持自然曲度，不要拱起——幅度以腰不离地为准",
      "吸气缓慢回收，换另一侧重复",
    ],
    safety: ["感到腰部不适立刻减小伸出幅度", "速度要慢，控制比幅度更重要"],
    phases: ["起始位", "右腿伸出+左臂", "回收", "左腿伸出+右臂", "回收"],
    phaseDur: [2, 3, 2, 3, 2],
    type: "lying",
    keyframes: [
      { rHip: -80, rKnee: 80, lHip: -77, lKnee: 77, rSh: -85, lSh: -80, tilt: 0 },
      { rHip: -80, rKnee: 80, lHip: -77, lKnee: 77, rSh: -85, lSh: -80, tilt: 0 },
      { rHip: -25, rKnee: 8,  lHip: -77, lKnee: 77, rSh: -85, lSh: -155, tilt: 0 },
      { rHip: -80, rKnee: 80, lHip: -77, lKnee: 77, rSh: -85, lSh: -80, tilt: 0 },
      { rHip: -80, rKnee: 80, lHip: -20, lKnee: 6,  rSh: -160, lSh: -80, tilt: 0 },
      { rHip: -80, rKnee: 80, lHip: -77, lKnee: 77, rSh: -85, lSh: -80, tilt: 0 },
    ],
  },
  {
    id: "cat-cow", nameZh: "猫式拉伸", name: "Cat Stretch",
    sets: 3, reps: 8, restSec: 20, tempo: "配合呼吸",
    muscles: "竖脊肌 · 腹肌 · 多裂肌",
    howTo: [
      "四点跪姿：双手在肩正下方，双膝在髋正下方",
      "呼气时收腹弓背，像猫一样把背拱到最高，头自然下垂",
      "保持2-3秒，感受脊柱一节一节打开",
      "吸气时缓慢回正，可以轻微塌腰但幅度减半",
      "全程动作缓慢，配合呼吸节奏",
    ],
    safety: ["弓背(猫式)充分做，椎管打开", "塌腰方向要轻柔，幅度减半"],
    phases: ["四点跪姿", "弓背(猫式)↑", "回正", "轻微塌腰↓", "回正"],
    phaseDur: [2, 3, 2, 2, 2],
    type: "cat",
    keyframes: [
      { spine: 0, headDrop: 0 },
      { spine: 0, headDrop: 0 },
      { spine: -1, headDrop: 18 },   // cat: spine curves up
      { spine: 0, headDrop: 0 },
      { spine: 0.3, headDrop: -8 },  // gentle cow
      { spine: 0, headDrop: 0 },
    ],
  },
  {
    id: "seated-boxing", nameZh: "坐姿拳击", name: "Seated Boxing",
    sets: 4, reps: 20, restSec: 30, tempo: "快节奏 30秒/组",
    muscles: "三角肌 · 肱三头肌 · 核心",
    howTo: [
      "坐稳椅子，双脚平放地面，背靠椅背",
      "双拳护在下巴两侧，肘部夹紧身体（防守姿势）",
      "左直拳Jab：左拳向前直线打出，拳心朝下，微曲不锁肘",
      "右直拳Cross：右拳发力穿过中线，带动躯干轻微旋转",
      "勾拳Hook/上勾Upper：手臂弯曲发力，核心收紧对抗旋转",
    ],
    safety: ["核心收紧，不要用腰代偿", "心率过高就休息"],
    phases: ["防守姿势", "左直拳 Jab", "右直拳 Cross", "左勾拳 Hook", "右上勾 Upper"],
    phaseDur: [1.5, 0.8, 0.8, 1, 1],
    type: "seated",
    keyframes: [
      { lArmX: 0, lArmY: 0, rArmX: 0, rArmY: 0 },
      { lArmX: 0, lArmY: 0, rArmX: 0, rArmY: 0 },
      { lArmX: 150, lArmY: -12, rArmX: 0, rArmY: 0 },    // jab
      { lArmX: 0, lArmY: 0, rArmX: 155, rArmY: -12 },     // cross
      { lArmX: 100, lArmY: -40, rArmX: 0, rArmY: 0 },     // hook
      { lArmX: 0, lArmY: 0, rArmX: 60, rArmY: -65 },      // uppercut
    ],
  },
];

// ═══════════════════════════════════════════
// FIGURE RENDERERS (compute from keyframes)
// ═══════════════════════════════════════════

function LyingFigure({ angles, exerciseId }) {
  const GY = 260;
  const hipX = 285, hipY = GY - 16;
  const shoulderX = 175, shoulderY = hipY;
  const tilt = angles.tilt || 0;
  const hipYAdj = hipY - tilt * 6;

  // Forward kinematics: legs
  const rKnee = jointPos(hipX, hipYAdj, angles.rHip, 50);
  const rFoot = jointPos(rKnee.x, rKnee.y, angles.rHip + angles.rKnee, 44);
  const lKnee = jointPos(hipX + 5, hipYAdj + 3, angles.lHip, 47);
  const lFoot = jointPos(lKnee.x, lKnee.y, angles.lHip + angles.lKnee, 42);

  // Arms from shoulder area
  const rElbow = jointPos(shoulderX + 30, shoulderY + 2, angles.rSh, 28);
  const rHand = jointPos(rElbow.x, rElbow.y, angles.rSh, 24);
  const lElbow = jointPos(shoulderX + 15, shoulderY - 2, angles.lSh, 30);
  const lHand = jointPos(lElbow.x, lElbow.y, angles.lSh, 26);

  const rLegActive = angles.rHip > -60;
  const lLegActive = angles.lHip > -55;
  const rArmActive = angles.rSh < -120;
  const lArmActive = angles.lSh < -120;
  const coreActive = rLegActive || lLegActive || tilt > 0.5;

  // Side view of supine figure: "far" side = lighter color, rendered first (behind)
  // "near" side = brighter, rendered last (in front)
  // Render order: ground → far arm → far leg → torso → head → near leg → near arm → labels

  return (
    <g>
      <Ground y={GY} />
      <text x={400} y={GY - 5} fill="#2a3a4a" fontSize="10" fontFamily="monospace">地面</text>

      {/* Towel (on ground, behind body) */}
      <rect x={210} y={hipY - 3} width={48} height={7} rx={3.5} fill="#f59e0b" opacity={.35} />

      {/* Back gap / contact indicator */}
      {exerciseId === "pelvic-tilt" && tilt < 0.6 && (
        <path d={`M 215 ${hipY - 8 * (1 - tilt)} Q 234 ${hipY - 14 * (1 - tilt)} 253 ${hipY - 8 * (1 - tilt)}`}
          fill="none" stroke="#f87171" strokeWidth={1.5} strokeDasharray="3,3" opacity={.5 * (1 - tilt)} />
      )}
      {exerciseId === "pelvic-tilt" && tilt > 0.7 && (
        <text x={215} y={hipY - 16} fill="#22d3ee" fontSize="10" fontFamily="monospace" fontWeight="bold">✓ 腰贴地面</text>
      )}

      <Glow x={235} y={hipYAdj - 10} rx={38} ry={18} on={coreActive} />

      {/* ── FAR SIDE (behind body) ── */}
      {/* Far arm (right arm = further from viewer) */}
      <Bone x1={shoulderX + 30} y1={shoulderY + 2} x2={rElbow.x} y2={rElbow.y} w={10}
        color={rArmActive ? "#9080cc" : "#6a98b0"} />
      <Hand x={rHand.x} y={rHand.y} r={7} color={rArmActive ? "#8a7acc" : "#d4c4aa"} />

      {/* Far leg (left leg = further from viewer) */}
      <Bone x1={hipX + 5} y1={hipYAdj + 3} x2={lKnee.x} y2={lKnee.y} w={14}
        color={lLegActive ? "#4aacbf" : "#6a98b0"} />
      <Bone x1={lKnee.x} y1={lKnee.y} x2={lFoot.x} y2={lFoot.y} w={12}
        color={lLegActive ? "#4aacbf" : "#6a98b0"} />
      <Foot x={lFoot.x} y={lFoot.y} color={lLegActive ? "#35a5bf" : "#6a98b0"} />

      {/* ── BODY CENTER ── */}
      {/* Torso */}
      <Bone x1={shoulderX + 10} y1={shoulderY} x2={hipX} y2={hipYAdj} w={22} color="#8cb8d0" />

      {/* Head (part of center body, rendered after torso, before near limbs) */}
      <Head x={shoulderX - 30} y={shoulderY - 8} r={20} look={0} />

      {/* ── NEAR SIDE (in front of body) ── */}
      {/* Near leg (right leg = closer to viewer) */}
      <Bone x1={hipX} y1={hipYAdj} x2={rKnee.x} y2={rKnee.y} w={16}
        color={rLegActive ? "#5ec4db" : "#8cb8d0"} />
      <Bone x1={rKnee.x} y1={rKnee.y} x2={rFoot.x} y2={rFoot.y} w={14}
        color={rLegActive ? "#5ec4db" : "#8cb8d0"} />
      <Foot x={rFoot.x} y={rFoot.y} color={rLegActive ? "#3db8d3" : "#7a9fb5"} />

      {/* Near arm (left arm = closer to viewer) */}
      <Bone x1={shoulderX + 15} y1={shoulderY - 2} x2={lElbow.x} y2={lElbow.y} w={12}
        color={lArmActive ? "#b49aed" : "#8cb8d0"} />
      <Hand x={lHand.x} y={lHand.y} r={8} color={lArmActive ? "#a78bfa" : "#e8d5c0"} />

      {/* ── LABELS (always on top) ── */}
      {exerciseId === "pelvic-tilt" && tilt > 0.9 && (
        <text x={230} y={hipYAdj - 42} fill="#22d3ee" fontSize="16" fontWeight="bold"
          fontFamily="monospace" textAnchor="middle">HOLD 保持</text>
      )}
      {rLegActive && (
        <text x={rFoot.x + 8} y={rFoot.y - 6} fill="#22d3ee" fontSize="15">→</text>
      )}
      {lLegActive && (
        <text x={lFoot.x + 8} y={lFoot.y - 6} fill="#22d3ee" fontSize="15">→</text>
      )}
      {rArmActive && (
        <text x={rHand.x - 18} y={rHand.y - 4} fill="#a78bfa" fontSize="15">←</text>
      )}
      {lArmActive && (
        <text x={lHand.x - 18} y={lHand.y - 4} fill="#a78bfa" fontSize="15">←</text>
      )}
    </g>
  );
}

function CatFigure({ angles }) {
  const GY = 270;
  const sp = angles.spine; // -1 (cat/up) to +0.3 (cow/down)
  const shoulderX = 150, hipX = 350;
  const spineY = 150 + sp * 40;
  const headY = spineY - 18 + angles.headDrop;
  const handY = GY - 10, kneeY = GY - 10;
  const isCat = sp < -0.3, isCow = sp > 0.15;

  // Render order: ground → far knee+leg → far hand+arm → spine → near knee+leg → near hand+arm → head → labels

  return (
    <g>
      <Ground y={GY} />

      {/* ── FAR SIDE (behind body) ── */}
      <circle cx={hipX + 28} cy={kneeY} r={6} fill="#5a8898" />
      <Bone x1={hipX + 28} y1={kneeY} x2={hipX - 3} y2={spineY + 16} w={13} color="#6a98b0" />
      <Bone x1={shoulderX} y1={handY} x2={shoulderX + 20} y2={spineY + 12} w={12} color="#6a98b0" />
      <Hand x={shoulderX} y={handY} r={8} color="#d0c0a5" />

      {/* ── SPINE (center body) ── */}
      <path
        d={`M ${shoulderX + 25} ${spineY + 8} Q ${250} ${spineY + sp * 28 - 14} ${hipX - 12} ${spineY + 10}`}
        fill="none"
        stroke={isCat ? "#5ec4db" : isCow ? "#f59e0b" : "#8cb8d0"}
        strokeWidth={24} strokeLinecap="round"
      />
      {isCat && (
        <path
          d={`M ${shoulderX + 25} ${spineY + 8} Q ${250} ${spineY + sp * 28 - 14} ${hipX - 12} ${spineY + 10}`}
          fill="none" stroke="#22d3ee" strokeWidth={36} strokeLinecap="round" opacity=".1"
        />
      )}

      {/* Tail hint */}
      <path d={`M ${hipX} ${spineY + 5} Q ${hipX + 15} ${spineY - 10} ${hipX + 5} ${spineY - 5}`}
        fill="none" stroke="#6a98b0" strokeWidth={4} strokeLinecap="round" opacity=".4" />

      {/* ── NEAR SIDE (in front of body) ── */}
      <circle cx={hipX + 15} cy={kneeY} r={7} fill="#6a98b0" />
      <Bone x1={hipX + 15} y1={kneeY} x2={hipX - 8} y2={spineY + 14} w={15} color="#8cb8d0" />
      <Bone x1={shoulderX - 15} y1={handY} x2={shoulderX + 15} y2={spineY + 10} w={14} color="#8cb8d0" />
      <Hand x={shoulderX - 15} y={handY} r={9} />

      {/* ── HEAD (always in front) ── */}
      <Head x={shoulderX - 10} y={headY} r={20}
        color={isCat ? "#5ec4db" : isCow ? "#d4a574" : "#8cb8d0"} look={-1} />

      {/* ── LABELS ── */}
      {isCat && (
        <>
          <text x={250} y={spineY - 38} fill="#22d3ee" fontSize="14" fontWeight="bold"
            fontFamily="monospace" textAnchor="middle">↑ 弓背 · 呼气</text>
          <text x={250} y={spineY - 22} fill="#22d3ee" fontSize="10"
            fontFamily="monospace" textAnchor="middle" opacity=".7">椎管空间打开</text>
        </>
      )}
      {isCow && (
        <text x={250} y={spineY - 28} fill="#f59e0b" fontSize="12" fontWeight="bold"
          fontFamily="monospace" textAnchor="middle">↓ 轻微塌腰 · 吸气 · 幅度减半!</text>
      )}
    </g>
  );
}

function SeatedFigure({ angles }) {
  const GY = 280;
  const seatY = 200, hipY = seatY - 8;
  const shoulderY = 125, headY = 82;
  const cx = 200;

  const lEndX = cx - 15 + angles.lArmX;
  const lEndY = shoulderY + 8 + angles.lArmY;
  const rEndX = cx + 15 + angles.rArmX;
  const rEndY = shoulderY + 8 + angles.rArmY;
  const lPunch = angles.lArmX > 30;
  const rPunch = angles.rArmX > 30;

  // Determine punch label
  let label = "", labelColor = "#8cb8d0";
  if (angles.lArmX > 100 && angles.lArmY > -20) { label = "JAB →"; labelColor = "#5ec4db"; }
  else if (angles.rArmX > 100 && angles.rArmY > -20) { label = "CROSS →"; labelColor = "#a78bfa"; }
  else if (angles.lArmX > 50 && angles.lArmY < -20) { label = "HOOK ↗"; labelColor = "#5ec4db"; }
  else if (angles.rArmY < -40) { label = "UPPERCUT ↑"; labelColor = "#a78bfa"; }

  return (
    <g>
      <Ground y={GY} />

      {/* ── CHAIR (background) ── */}
      <rect x={148} y={100} width={10} height={seatY - 95} rx={4} fill="#4a5568" />
      <rect x={155} y={seatY} width={90} height={8} rx={3} fill="#4a5568" />
      <rect x={155} y={seatY + 8} width={8} height={GY - seatY - 10} fill="#4a5568" />
      <rect x={237} y={seatY + 8} width={8} height={GY - seatY - 10} fill="#4a5568" />

      {/* ── FAR SIDE (behind body) ── */}
      {/* Far leg (right) */}
      <Bone x1={cx + 15} y1={hipY} x2={cx + 25} y2={hipY + 48} w={14} color="#6a98b0" />
      <Bone x1={cx + 25} y1={hipY + 48} x2={cx + 35} y2={GY - 12} w={12} color="#6a98b0" />
      <Foot x={cx + 35} y={GY - 8} color="#5a8898" />

      {/* Far arm (right) - behind torso when not punching */}
      <Bone x1={cx + 15} y1={shoulderY + 4} x2={rEndX} y2={rEndY} w={12}
        color={rPunch ? "#9080cc" : "#6a98b0"} />
      <Hand x={rEndX} y={rEndY} r={9} color={rPunch ? "#a78bfa" : "#d0c0a5"} />

      {/* ── BODY CENTER ── */}
      <Glow x={cx} y={hipY - 22} rx={20} ry={12} on={lPunch || rPunch} color="#f59e0b" />
      <Bone x1={cx} y1={hipY} x2={cx} y2={shoulderY} w={22} color="#8cb8d0" />

      {/* ── NEAR SIDE (in front of body) ── */}
      {/* Near leg (left) */}
      <Bone x1={cx - 15} y1={hipY} x2={cx - 25} y2={hipY + 48} w={16} color="#8cb8d0" />
      <Bone x1={cx - 25} y1={hipY + 48} x2={cx - 35} y2={GY - 12} w={14} color="#8cb8d0" />
      <Foot x={cx - 35} y={GY - 8} />

      {/* ── HEAD (in front of torso) ── */}
      <Head x={cx} y={headY} r={22} look={1} />

      {/* ── NEAR ARM (left, always in front) ── */}
      <Bone x1={cx - 15} y1={shoulderY + 4} x2={lEndX} y2={lEndY} w={13}
        color={lPunch ? "#5ec4db" : "#8cb8d0"} />
      <Hand x={lEndX} y={lEndY} r={10} color={lPunch ? "#22d3ee" : "#e8d5c0"} />

      {/* ── EFFECTS & LABELS ── */}
      {(lPunch || rPunch) && (
        <circle cx={lPunch ? lEndX : rEndX} cy={lPunch ? lEndY : rEndY}
          r={16} fill={labelColor} opacity=".12" />
      )}

      {label && (
        <text x={370} y={72} fill={labelColor} fontSize="15" fontWeight="bold" fontFamily="monospace">
          {label}
        </text>
      )}
    </g>
  );
}

const FIGURE_MAP = {
  lying: LyingFigure,
  cat: CatFigure,
  seated: SeatedFigure,
};

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function FitnessV3() {
  const [selIdx, setSelIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0 → numKeyframes-1
  const [playing, setPlaying] = useState(false);
  const [curSet, setCurSet] = useState(1);
  const [curRep, setCurRep] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [resting, setResting] = useState(false);
  const [restLeft, setRestLeft] = useState(0);
  const [done, setDone] = useState({});
  const [showCondition, setShowCondition] = useState(false);
  const rafRef = useRef(null);
  const lastRef = useRef(null);
  const stateRef = useRef({ curSet: 1, curRep: 1 });

  useEffect(() => { stateRef.current = { curSet, curRep }; }, [curSet, curRep]);

  const ex = EXERCISES[selIdx];
  const numKF = ex.keyframes.length;
  const totalDur = ex.phaseDur.reduce((a, b) => a + b, 0);

  const tick = useCallback(() => {
    const now = Date.now();
    if (!lastRef.current) lastRef.current = now;
    const dt = (now - lastRef.current) / 1000;
    lastRef.current = now;

    if (resting) {
      setRestLeft(p => {
        if (p - dt <= 0) {
          setResting(false);
          setCurSet(s => s + 1);
          setCurRep(1);
          return 0;
        }
        return p - dt;
      });
    } else {
      setElapsed(t => t + dt);
      setProgress(prev => {
        const speed = (numKF - 1) / totalDur;
        let next = prev + dt * speed;
        if (next >= numKF - 1) {
          next = 0;
          const { curSet: cs, curRep: cr } = stateRef.current;
          if (cr >= ex.reps) {
            if (cs >= ex.sets) {
              setPlaying(false);
              setDone(d => ({ ...d, [ex.id]: true }));
              setCurRep(1);
              return 0;
            }
            setResting(true);
            setRestLeft(ex.restSec);
          } else {
            setCurRep(r => r + 1);
          }
        }
        return next;
      });
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [resting, ex, numKF, totalDur]);

  useEffect(() => {
    if (playing) {
      lastRef.current = Date.now();
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, tick]);

  const reset = () => {
    setPlaying(false); setProgress(0); setCurSet(1); setCurRep(1);
    setElapsed(0); setResting(false); setRestLeft(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };
  const selectEx = i => { reset(); setSelIdx(i); };

  // Compute current joint angles
  const angles = interpolate(ex.keyframes, progress);

  // Current phase index (from progress mapped to phase durations)
  const progressRatio = progress / (numKF - 1);
  let cumDur = 0, phaseIdx = 0;
  for (let i = 0; i < ex.phaseDur.length; i++) {
    cumDur += ex.phaseDur[i];
    if (progressRatio <= cumDur / totalDur) { phaseIdx = i; break; }
    phaseIdx = i;
  }

  const Figure = FIGURE_MAP[ex.type];
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(Math.floor(elapsed % 60)).padStart(2, "0");

  return (
    <div style={{
      minHeight: "100vh", background: "#080d16", color: "#cbd5e1",
      fontFamily: "'SF Mono','Menlo','Consolas',monospace",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px", borderBottom: "1px solid #1a2332",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#0a1120",
      }}>
        <div>
          <div style={{ fontSize: 9, color: "#22d3ee", letterSpacing: 2.5 }}>LUMBAR SAFE</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginTop: 2 }}>脊柱友好训练</div>
        </div>
        <div style={{
          background: "#111a2e", borderRadius: 8, padding: "5px 12px",
          fontSize: 18, fontWeight: 700, color: "#e2e8f0", fontVariantNumeric: "tabular-nums",
        }}>{mm}:{ss}</div>
      </div>

      {/* Condition Description */}
      <div style={{
        margin: "0", padding: "12px 16px", background: "#0a1120",
        borderBottom: "1px solid #1a2332",
      }}>
        <button onClick={() => setShowCondition(p => !p)} style={{
          background: "none", border: "none", padding: 0, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          fontFamily: "inherit",
        }}>
          <div style={{
            background: "#1a0e0e", border: "1px solid #dc262633",
            borderRadius: 6, padding: "3px 8px", fontSize: 9, color: "#f87171",
            letterSpacing: 1.5, fontWeight: 600,
          }}>适应症</div>
          <div style={{ fontSize: 12, color: "#94a3b8", flex: 1, textAlign: "left" }}>
            腰椎管狭窄 · 间歇性跛行 · 核心康复
          </div>
          <div style={{ fontSize: 11, color: "#3a5060", transition: "transform .2s",
            transform: showCondition ? "rotate(180deg)" : "rotate(0)" }}>▾</div>
        </button>

        {showCondition && (
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {/* Problem */}
            <div style={{
              background: "#0c1525", borderRadius: 10, padding: "10px 14px",
              border: "1px solid #1a1015",
            }}>
              <div style={{ fontSize: 8, color: "#f87171", letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" }}>
                问题描述
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.7 }}>
                腰椎管狭窄伴间歇性跛行，久站/久走后出现腿部不适。椎管空间受限导致神经受压，需要通过训练增强核心稳定性、维持椎管空间。同时存在体重管理需求（BMI偏高），以及睡眠呼吸相关问题（OSA倾向+慢性鼻炎）。
              </div>
            </div>

            {/* Training principles */}
            <div style={{
              background: "#0c1525", borderRadius: 10, padding: "10px 14px",
              border: "1px solid #151f30",
            }}>
              <div style={{ fontSize: 8, color: "#22d3ee", letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" }}>
                训练原则
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                {[
                  ["✓", "腰椎保持中立位或轻度屈曲，避免过伸", "#22d3ee"],
                  ["✓", "优先核心抗伸展训练（Dead Bug > 平板支撑）", "#22d3ee"],
                  ["✓", "椅子辅助有氧代替站立负重训练", "#22d3ee"],
                  ["✗", "避免：小燕飞、仰卧起坐、深蹲负重、弯腰硬拉", "#f87171"],
                  ["✗", "避免：俯卧位、腰椎过伸、长时间站立", "#f87171"],
                ].map(([icon, text, color], i) => (
                  <div key={i} style={{
                    fontSize: 11, color: "#8a9aaa", lineHeight: 1.6,
                    paddingLeft: 10, borderLeft: `2px solid ${color}33`,
                    display: "flex", gap: 6,
                  }}>
                    <span style={{ color, fontWeight: 700, flexShrink: 0 }}>{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily plan */}
            <div style={{
              background: "#0c1525", borderRadius: 10, padding: "10px 14px",
              border: "1px solid #151f30",
            }}>
              <div style={{ fontSize: 8, color: "#a78bfa", letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" }}>
                建议频率
              </div>
              <div style={{ fontSize: 11, color: "#8a9aaa", lineHeight: 1.7 }}>
                每天5-10分钟完成骨盆前倾 + 死虫式 + 猫式基础训练。每周2-3次加入坐姿拳击做有氧。感到腿部不适立即停止，不要硬撑。以上为辅助康复手段，不替代MRI检查和脊柱外科专业评估。
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "10px 16px", overflowX: "auto", background: "#0a1120" }}>
        {EXERCISES.map((e, i) => (
          <button key={e.id} onClick={() => selectEx(i)} style={{
            background: i === selIdx ? "#162033" : "transparent",
            border: i === selIdx ? "1px solid #22d3ee44" : "1px solid transparent",
            borderRadius: 8, padding: "7px 14px", cursor: "pointer",
            color: i === selIdx ? "#22d3ee" : "#4a6070",
            fontSize: 12, fontFamily: "inherit", fontWeight: i === selIdx ? 700 : 400,
            whiteSpace: "nowrap", transition: "all .2s",
          }}>
            {done[e.id] ? "✓ " : ""}{e.nameZh}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div style={{
        margin: "12px 16px", background: "linear-gradient(160deg,#0c1525,#101d30)",
        borderRadius: 16, border: "1px solid #1a2a3c", overflow: "hidden", position: "relative",
      }}>
        {/* Phase badge */}
        <div style={{
          position: "absolute", top: 10, left: 14, zIndex: 5,
          background: resting ? "#78350f88" : "#0e454d88",
          border: `1px solid ${resting ? "#f59e0b66" : "#22d3ee55"}`,
          borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600,
          backdropFilter: "blur(4px)", color: resting ? "#fbbf24" : "#22d3ee",
        }}>
          {resting ? `休息 ${Math.ceil(restLeft)}s` : ex.phases[phaseIdx]}
        </div>

        {/* Rep counter */}
        <div style={{ position: "absolute", top: 10, right: 14, zIndex: 5, textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9" }}>
            {curRep}<span style={{ fontSize: 13, color: "#4a6070" }}>/{ex.reps}</span>
          </div>
          <div style={{ fontSize: 10, color: "#4a6070" }}>第{curSet}/{ex.sets}组</div>
        </div>

        <svg viewBox="0 0 500 300" style={{ width: "100%", display: "block" }}>
          <defs>
            <pattern id="g" width={25} height={25} patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#14202e" strokeWidth=".5" />
            </pattern>
          </defs>
          <rect width={500} height={300} fill="url(#g)" opacity=".6" />
          <Figure angles={angles} exerciseId={ex.id} />
        </svg>

        {/* Progress bar */}
        <div style={{ height: 4, background: "#111a2e" }}>
          <div style={{
            height: "100%", width: `${progressRatio * 100}%`,
            background: "linear-gradient(90deg,#22d3ee,#a78bfa)",
            transition: "width .08s linear", borderRadius: 2,
          }} />
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, padding: "0 16px 14px" }}>
        <button onClick={reset} style={{
          background: "#111a2e", border: "1px solid #1e2d40", borderRadius: 12,
          padding: "12px 22px", color: "#7a8fa0", fontSize: 13, fontFamily: "inherit", cursor: "pointer",
        }}>↺ 重置</button>
        <button onClick={() => setPlaying(p => !p)} style={{
          background: playing
            ? "linear-gradient(135deg,#dc2626,#991b1b)"
            : "linear-gradient(135deg,#0891b2,#06b6d4)",
          border: "none", borderRadius: 12, padding: "12px 44px",
          color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
          boxShadow: playing ? "0 4px 24px #dc262655" : "0 4px 24px #06b6d455",
        }}>
          {playing ? "⏸ 暂停" : "▶ 开始"}
        </button>
      </div>

      {/* Phase timeline */}
      <div style={{ padding: "0 16px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 3 }}>
          {ex.phases.map((name, i) => {
            const active = phaseIdx === i && playing;
            return (
              <div key={i} style={{
                flex: ex.phaseDur[i],
                background: active ? "#0e454d" : "#111a2e",
                border: active ? "1px solid #22d3ee55" : "1px solid #151f30",
                borderRadius: 6, padding: "6px 2px", textAlign: "center",
                transition: "all .25s",
              }}>
                <div style={{ fontSize: 9, color: active ? "#22d3ee" : "#3a5060", fontWeight: active ? 700 : 400 }}>
                  {name}
                </div>
                <div style={{ fontSize: 8, color: "#2a3a48", marginTop: 2 }}>{ex.phaseDur[i]}s</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How-to Instructions (primary focus) */}
      <div style={{
        margin: "0 16px 12px", background: "#0c1525", borderRadius: 10,
        border: "1px solid #152030", padding: "12px 14px",
      }}>
        <div style={{ fontSize: 9, color: "#22d3ee", letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" }}>
          动作要领 · {ex.nameZh}
        </div>
        {ex.howTo.map((step, i) => (
          <div key={i} style={{
            display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start",
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
              background: "#111d30", border: "1px solid #22d3ee33",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, color: "#22d3ee", fontWeight: 700,
            }}>{i + 1}</div>
            <div style={{ fontSize: 12, color: "#b0c4d4", lineHeight: 1.6 }}>{step}</div>
          </div>
        ))}
        {ex.safety.length > 0 && (
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: "1px solid #1a2332",
            display: "flex", gap: 6, flexWrap: "wrap",
          }}>
            {ex.safety.map((s, i) => (
              <div key={i} style={{
                fontSize: 10, color: "#f59e0b", background: "#1a150a",
                border: "1px solid #f59e0b22", borderRadius: 5, padding: "3px 8px",
              }}>⚠ {s}</div>
            ))}
          </div>
        )}
      </div>

      {/* Info cards */}
      <div style={{ margin: "0 16px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: "#0c1525", borderRadius: 10, padding: "10px 12px", border: "1px solid #151f30" }}>
          <div style={{ fontSize: 8, color: "#3a5060", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>训练量</div>
          <div style={{ fontSize: 12, color: "#b0c4d4" }}>{ex.sets}组 × {ex.reps}次</div>
          <div style={{ fontSize: 10, color: "#3a5060", marginTop: 2 }}>休息{ex.restSec}s · {ex.tempo}</div>
        </div>
        <div style={{ background: "#0c1525", borderRadius: 10, padding: "10px 12px", border: "1px solid #151f30" }}>
          <div style={{ fontSize: 8, color: "#3a5060", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>目标肌群</div>
          <div style={{ fontSize: 12, color: "#b0c4d4" }}>{ex.muscles}</div>
        </div>
      </div>

      {/* Plan */}
      <div style={{ margin: "0 16px 24px", background: "#0c1525", borderRadius: 10, border: "1px solid #151f30", padding: "12px 14px" }}>
        <div style={{ fontSize: 9, color: "#3a5060", letterSpacing: 1.5, marginBottom: 10 }}>训练计划</div>
        {EXERCISES.map((e, i) => (
          <div key={e.id} onClick={() => selectEx(i)} style={{
            display: "flex", alignItems: "center", padding: "8px 10px",
            borderRadius: 8, marginBottom: 3, cursor: "pointer",
            background: i === selIdx ? "#111d30" : "transparent", transition: "all .15s",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6, marginRight: 10,
              background: done[e.id] ? "#22d3ee22" : "#111a2e",
              border: `1px solid ${done[e.id] ? "#22d3ee" : "#1e2d40"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, color: done[e.id] ? "#22d3ee" : "#3a5060",
            }}>
              {done[e.id] ? "✓" : i + 1}
            </div>
            <div>
              <div style={{ fontSize: 12, color: done[e.id] ? "#22d3ee" : "#b0c4d4", fontWeight: 600 }}>{e.nameZh}</div>
              <div style={{ fontSize: 9, color: "#2a3a48" }}>{e.sets}×{e.reps} · {e.name}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "0 16px 20px", fontSize: 8, color: "#1a2a38", letterSpacing: 1 }}>
        DESIGNED FOR LUMBAR SPINAL STENOSIS · NOT MEDICAL ADVICE
      </div>
    </div>
  );
}
