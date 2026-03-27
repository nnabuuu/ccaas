/**
 * Preset student roster for PoC.
 * Students click their name to join — no manual input needed.
 */

export interface PresetStudent {
  id: string;
  name: string;
  avatar: string; // emoji avatar
}

export const PRESET_STUDENTS: PresetStudent[] = [
  { id: 's01', name: '张雨桐', avatar: '🌸' },
  { id: 's02', name: '王浩然', avatar: '🌊' },
  { id: 's03', name: '李思琪', avatar: '🌟' },
  { id: 's04', name: '陈思远', avatar: '🎯' },
  { id: 's05', name: '赵欣然', avatar: '🌈' },
  { id: 's06', name: '林嘉怡', avatar: '🍀' },
  { id: 's07', name: '吴佳琪', avatar: '🦋' },
  { id: 's08', name: '刘子涵', avatar: '🔥' },
  { id: 's09', name: '杨诗瑶', avatar: '🎵' },
  { id: 's10', name: '黄宇轩', avatar: '⚡' },
  { id: 's11', name: '周雨萱', avatar: '🌙' },
  { id: 's12', name: '徐浩宇', avatar: '🚀' },
  { id: 's13', name: '孙晓彤', avatar: '🌻' },
  { id: 's14', name: '马天翔', avatar: '🦅' },
  { id: 's15', name: '朱可欣', avatar: '💎' },
  { id: 's16', name: '胡明轩', avatar: '🎨' },
  { id: 's17', name: '郭雅琪', avatar: '🌺' },
  { id: 's18', name: '何俊杰', avatar: '🏆' },
];
