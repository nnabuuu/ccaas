import React from 'react';
import { useMosaicStore } from '../../hooks/useStore';
import { getColorHex, getColorName, formatBrickCount } from '../../utils/colors';
import { generateBrickLinkXml, generateCsv, downloadFile, getBrickLinkPartUrl } from '../../utils/export';

export default function BillOfMaterials() {
  const bom = useMosaicStore((s) => s.billOfMaterials);
  const colors = useMosaicStore((s) => s.colors);
  const placements = useMosaicStore((s) => s.placements);
  const expanded = useMosaicStore((s) => s.bomExpanded);
  const setBomExpanded = useMosaicStore((s) => s.setBomExpanded);

  if (bom.length === 0) return null;

  const totalBricks = placements.length;

  return (
    <div className="border-t border-gray-200 bg-white shrink-0">
      {/* Toggle bar */}
      <button
        onClick={() => setBomExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors"
      >
        <span className="text-xs font-medium text-gray-700">
          Bill of Materials ({formatBrickCount(totalBricks)} bricks)
        </span>
        <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 max-h-48 overflow-y-auto">
          {/* Export buttons */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => {
                const csv = generateCsv(bom);
                downloadFile(csv, 'lego-bom.csv', 'text/csv');
              }}
              className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
            >
              CSV
            </button>
            <button
              onClick={() => {
                const xml = generateBrickLinkXml(bom);
                downloadFile(xml, 'bricklink-wanted.xml', 'text/xml');
              }}
              className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
            >
              BrickLink XML
            </button>
          </div>

          {/* Table */}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b">
                <th className="pb-1 w-6"></th>
                <th className="pb-1">Color</th>
                <th className="pb-1">Brick</th>
                <th className="pb-1 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((item, i) => (
                <tr key={`${item.brickId}-${item.colorId}`} className="border-b border-gray-50">
                  <td className="py-1">
                    <div
                      className="w-4 h-4 rounded-sm border border-gray-200"
                      style={{ backgroundColor: getColorHex(item.colorId, colors) }}
                    />
                  </td>
                  <td className="py-1 text-gray-600">
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
                  <td className="py-1 text-right font-mono text-gray-700">
                    {item.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
