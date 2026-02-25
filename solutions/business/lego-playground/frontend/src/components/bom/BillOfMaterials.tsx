import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMosaicStore } from '../../hooks/useStore';
import { getColorHex, getColorName, formatBrickCount } from '../../utils/colors';
import { generateBrickLinkXml, generateCsv, downloadFile, getBrickLinkPartUrl } from '../../utils/export';

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const listItem = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 150, damping: 20 } },
};

export default function BillOfMaterials() {
  const bom = useMosaicStore((s) => s.billOfMaterials);
  const colors = useMosaicStore((s) => s.colors);
  const placements = useMosaicStore((s) => s.placements);
  const expanded = useMosaicStore((s) => s.bomExpanded);
  const setBomExpanded = useMosaicStore((s) => s.setBomExpanded);

  if (bom.length === 0) return null;

  const totalBricks = placements.length;

  return (
    <div className="border-t border-zinc-200 bg-white shrink-0">
      <button
        onClick={() => setBomExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-zinc-50 transition-colors"
      >
        <span className="text-xs font-medium text-zinc-700">
          Bill of Materials ({formatBrickCount(totalBricks)} bricks)
        </span>
        <span className="text-xs text-zinc-400">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring' as const, stiffness: 200, damping: 25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 max-h-48 overflow-y-auto">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => {
                    const csv = generateCsv(bom);
                    downloadFile(csv, 'lego-bom.csv', 'text/csv');
                  }}
                  className="text-[10px] px-2 py-1 bg-zinc-100 hover:bg-zinc-200 rounded text-zinc-600"
                >
                  CSV
                </button>
                <button
                  onClick={() => {
                    const xml = generateBrickLinkXml(bom);
                    downloadFile(xml, 'bricklink-wanted.xml', 'text/xml');
                  }}
                  className="text-[10px] px-2 py-1 bg-zinc-100 hover:bg-zinc-200 rounded text-zinc-600"
                >
                  BrickLink XML
                </button>
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-zinc-400 border-b">
                    <th className="pb-1 w-6"></th>
                    <th className="pb-1">Color</th>
                    <th className="pb-1">Brick</th>
                    <th className="pb-1 text-right">Qty</th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={listContainer}
                  initial="hidden"
                  animate="show"
                >
                  {bom.map((item) => (
                    <motion.tr
                      key={`${item.brickId}-${item.colorId}`}
                      variants={listItem}
                      className="border-b border-zinc-50"
                    >
                      <td className="py-1">
                        <div
                          className="w-4 h-4 rounded-sm border border-zinc-200"
                          style={{ backgroundColor: getColorHex(item.colorId, colors) }}
                        />
                      </td>
                      <td className="py-1 text-zinc-600">
                        {getColorName(item.colorId, colors)}
                      </td>
                      <td className="py-1">
                        <a
                          href={getBrickLinkPartUrl(item.brickId, item.colorId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {item.brickId}
                        </a>
                      </td>
                      <td className="py-1 text-right font-mono text-zinc-700">
                        {item.quantity}
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
