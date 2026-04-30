// ui_kits/board/board-renderer.js
// Pure renderer: (board, pointer) → DOM. No state, no side effects.
//   pointer = { step, sub }   — only blocks at or before this point are drawn
// Structure:
//   .board-root
//     .step-section  (one per step reached)
//       .step-hd (step title + column headers)
//       .fullbleed-row (full-bleed blocks for this step)
//       .columns (grid of columns)
//         .column (each column)
//           .column-hd (chalk column header)
//           .column-body (stacked blocks in this column)
// Exposes window.BoardRenderer.{render, revealOrder, atOrBefore}.

(function () {
  'use strict';

  // ──────────────────────────── reveal ordering ─────────────────────────
  function key(r) { return r.step * 1000 + r.sub; }
  function atOrBefore(reveal, pointer) { return key(reveal) <= key(pointer); }
  function revealOrder(blocks) {
    return blocks.slice().sort(function (a, b) { return key(a.reveal) - key(b.reveal); });
  }

  // ──────────────────────────── tone → CSS class ────────────────────────
  function toneClass(t) { return 'tone-' + (t || 'neutral'); }

  // ──────────────────────────── tiny DOM helper ─────────────────────────
  function h(tag, props, children) {
    var el = document.createElement(tag);
    if (props) for (var k in props) {
      if (k === 'class') el.className = props[k];
      else if (k === 'style') el.setAttribute('style', props[k]);
      else if (k === 'html') el.innerHTML = props[k];
      else el.setAttribute(k, props[k]);
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    });
    return el;
  }

  // Highlight specific substrings inside a text node.
  function withHighlights(text, highlights) {
    if (!highlights || !highlights.length) return [document.createTextNode(text)];
    var parts = [text];
    highlights.forEach(function (term) {
      var next = [];
      parts.forEach(function (p) {
        if (typeof p !== 'string') { next.push(p); return; }
        var i = p.indexOf(term);
        while (i !== -1) {
          if (i > 0) next.push(p.slice(0, i));
          next.push(h('span', { class: 'sig' }, [term]));
          p = p.slice(i + term.length);
          i = p.indexOf(term);
        }
        if (p) next.push(p);
      });
      parts = next;
    });
    return parts.map(function (p) { return typeof p === 'string' ? document.createTextNode(p) : p; });
  }

  // ──────────────────────────── block kinds ─────────────────────────────
  var KINDS = {

    heading: function (b) {
      return h('div', { class: 'bk bk-heading ' + toneClass(b.style && b.style.tone) }, [
        b.data.eyebrow ? h('div', { class: 'bk-eyebrow' }, [b.data.eyebrow]) : null,
        h('div', { class: 'bk-h-text' }, [b.data.text]),
        b.data.accent ? h('div', { class: 'bk-h-accent' }, [b.data.accent]) : null,
      ]);
    },

    quote: function (b) {
      return h('div', { class: 'bk bk-quote ' + toneClass(b.style && b.style.tone) }, [
        b.data.paragraph ? h('div', { class: 'bk-q-para' }, [b.data.paragraph]) : null,
        h('div', { class: 'bk-q-text' }, withHighlights(b.data.text, b.data.highlights)),
      ]);
    },

    'chip-row': function (b) {
      return h('div', { class: 'bk bk-chiprow ' + toneClass(b.style && b.style.tone) },
        b.data.items.map(function (it) {
          return h('div', { class: 'bk-chip ' + toneClass(it.tone || (b.style && b.style.tone)) }, [
            h('span', { class: 'bk-chip-text' }, [it.text]),
            it.note ? h('span', { class: 'bk-chip-note' }, [it.note]) : null,
          ]);
        })
      );
    },

    flow: function (b) {
      var arr = [];
      b.data.steps.forEach(function (s, i) {
        arr.push(h('div', { class: 'bk-flow-card ' + toneClass(b.style && b.style.tone) }, [
          s.paragraph ? h('div', { class: 'bk-flow-para' }, [s.paragraph]) : null,
          h('div', { class: 'bk-flow-label' }, [s.label]),
          s.sub ? h('div', { class: 'bk-flow-sub' }, [s.sub]) : null,
        ]));
        if (i < b.data.steps.length - 1) {
          arr.push(h('div', { class: 'bk-flow-arrow', html: '→' }));
        }
      });
      return h('div', { class: 'bk bk-flow' }, arr);
    },

    matrix: function (b) {
      var thead = h('thead', null, [
        h('tr', null, b.data.headers.map(function (col) { return h('th', null, [col]); })),
      ]);
      var tbody = h('tbody', null, b.data.rows.map(function (r) {
        return h('tr', { class: 'bk-mx-row ' + (r.tone ? 'mx-' + r.tone : '') },
          r.cells.map(function (c) {
            var cls = 'bk-mx-cell';
            if (c.mark) cls += ' mark-' + c.mark;
            return h('td', { class: cls }, [
              c.text != null
                ? h('span', { class: 'bk-mx-val' }, [c.text])
                : h('span', { class: 'bk-mx-empty' }, [c.placeholder || '——']),
              c.note ? h('span', { class: 'bk-mx-note' }, [c.note]) : null,
            ]);
          })
        );
      }));
      return h('div', { class: 'bk bk-matrix ' + toneClass(b.style && b.style.tone) }, [
        h('table', { class: 'bk-mx' }, [thead, tbody]),
      ]);
    },

    mindmap: function (b) {
      var center = h('div', { class: 'bk-mm-center' }, [
        h('div', { class: 'bk-mm-c-label' }, [b.data.center.label]),
        b.data.center.note ? h('div', { class: 'bk-mm-c-note' }, [b.data.center.note]) : null,
      ]);
      var branches = b.data.branches.map(function (br) {
        return h('div', { class: 'bk-mm-branch' }, [
          h('div', { class: 'bk-mm-b-label' }, [br.label]),
          br.leaves ? h('ul', { class: 'bk-mm-leaves' },
            br.leaves.map(function (l) { return h('li', null, [l]); })
          ) : null,
        ]);
      });
      return h('div', { class: 'bk bk-mindmap ' + toneClass(b.style && b.style.tone) }, [
        h('div', { class: 'bk-mm-grid' }, [center].concat(branches)),
      ]);
    },

    compare: function (b) {
      function side(s) {
        return h('div', { class: 'bk-cmp-side ' + toneClass(s.tone) }, [
          h('div', { class: 'bk-cmp-label' }, [s.label]),
          h('ul', { class: 'bk-cmp-list' },
            s.items.map(function (i) { return h('li', null, [i]); })),
        ]);
      }
      return h('div', { class: 'bk bk-compare' }, [
        side(b.data.left),
        h('div', { class: 'bk-cmp-vs' }, [b.data.joiner || 'vs']),
        side(b.data.right),
      ]);
    },

    annotation: function (b) {
      var icon = { note: '✎', warning: '⚠', aha: '💡' }[b.data.kind || 'note'];
      return h('div', { class: 'bk bk-anno anno-' + (b.data.kind || 'note') + ' ' + toneClass(b.style && b.style.tone) }, [
        h('span', { class: 'bk-anno-ic' }, [icon]),
        h('span', { class: 'bk-anno-text' }, [b.data.text]),
      ]);
    },

    'student-work': function (b) {
      var statusLabel = { highlight: '⭐ 课堂亮点', redo: '↻ 待修订', celebrate: '✓ 满分参考' }[b.data.status] || '· 学生作品';
      return h('div', { class: 'bk bk-stu ' + toneClass(b.style && b.style.tone) + ' stu-' + (b.data.status || 'normal') }, [
        h('div', { class: 'bk-stu-hd' }, [
          h('span', { class: 'bk-stu-author' }, [b.data.author]),
          h('span', { class: 'bk-stu-status' }, [statusLabel]),
        ]),
        h('div', { class: 'bk-stu-text' }, ['"' + b.data.text + '"']),
      ]);
    },

    image: function (b) {
      if (b.data.src) {
        return h('div', { class: 'bk bk-image' }, [
          h('img', { src: b.data.src, alt: b.data.alt || '' }),
          b.data.caption ? h('div', { class: 'bk-img-cap' }, [b.data.caption]) : null,
        ]);
      }
      return h('div', { class: 'bk bk-image bk-image-ph' }, [
        h('div', { class: 'bk-img-ph-inner' }, [b.data.alt || 'Image placeholder']),
      ]);
    },

    formula: function (b) {
      return h('div', { class: 'bk bk-formula ' + toneClass(b.style && b.style.tone) }, [
        h('div', { class: 'bk-fm-expr' }, [b.data.expr]),
        b.data.caption ? h('div', { class: 'bk-fm-cap' }, [b.data.caption]) : null,
      ]);
    },

    divider: function (b) {
      return h('div', { class: 'bk bk-divider' }, [
        b.data.label ? h('span', { class: 'bk-div-label' }, [b.data.label]) : null,
      ]);
    },
  };

  function makeBlock(b) {
    var maker = KINDS[b.kind];
    if (!maker) return h('div', { class: 'bk bk-unknown' }, ['?? ' + b.kind]);
    return maker(b);
  }

  // ──────────────────────────── geometry (within a column) ──────────────
  function gridStyle(g) {
    if (!g) return '';
    var s = 'grid-column:' + (g.col || 1) + ' / span ' + (g.span || 12) + ';';
    if (g.row) s += 'grid-row:' + g.row + ' / span ' + (g.rowSpan || 1) + ';';
    return s;
  }

  function cellWrap(b, opts) {
    var wrap = h('div', {
      class: 'bk-cell' + (b.id === opts.justRevealedId ? ' just-revealed' : ''),
      style: gridStyle(b.geometry),
      'data-block-id': b.id,
    }, [makeBlock(b)]);
    return wrap;
  }

  // ──────────────────────────── render one step section ────────────────
  function renderStep(step, stepBlocks, pointer, opts) {
    var visible = stepBlocks.filter(function (b) { return atOrBefore(b.reveal, pointer); });
    if (!visible.length) return null;

    var hasReached = step.idx < pointer.step || (step.idx === pointer.step);
    var isCurrent = step.idx === pointer.step;

    var section = h('div', {
      class: 'step-section' + (isCurrent ? ' current' : '') + (hasReached ? '' : ' future'),
      'data-step': step.idx,
    });

    // step label banner
    var banner = h('div', { class: 'step-banner' }, [
      h('span', { class: 'step-banner-num' }, ['Step ' + step.idx]),
      h('span', { class: 'step-banner-label' }, [step.label]),
      h('span', { class: 'step-banner-sep' }),
    ]);
    section.appendChild(banner);

    var cols = (step.layout && step.layout.columns) || null;

    // partition blocks: full-bleed go up top, rest by region
    var fullBleed = visible.filter(function (b) { return b.fullBleed; });
    var regional = visible.filter(function (b) { return !b.fullBleed; });

    // full-bleed row (for section headings)
    if (fullBleed.length) {
      var fbGrid = h('div', { class: 'fullbleed-row' });
      fullBleed.forEach(function (b) { fbGrid.appendChild(cellWrap(b, opts)); });
      section.appendChild(fbGrid);
    }

    if (!cols) {
      // single 12-col grid (backwards compatible)
      var grid = h('div', { class: 'board-grid' });
      regional.forEach(function (b) { grid.appendChild(cellWrap(b, opts)); });
      if (regional.length) section.appendChild(grid);
      return section;
    }

    // ── columned layout ──
    var weights = cols.map(function (c) { return c.width || 1; });
    var template = weights.map(function (w) { return w + 'fr'; }).join(' ');
    var columnsEl = h('div', { class: 'columns cols-' + cols.length, style: 'grid-template-columns:' + template });

    cols.forEach(function (col) {
      var colBlocks = regional.filter(function (b) { return (b.region || cols[0].id) === col.id; });
      var colEl = h('div', { class: 'column ' + toneClass(col.tone) });

      // chalk column header
      var hdInner = [];
      if (col.title) hdInner.push(h('div', { class: 'col-title' }, [col.title]));
      if (col.subtitle) hdInner.push(h('div', { class: 'col-subtitle' }, [col.subtitle]));
      if (hdInner.length) colEl.appendChild(h('div', { class: 'col-hd' }, hdInner));

      // body
      var body = h('div', { class: 'col-body' });
      if (!colBlocks.length) {
        body.appendChild(h('div', { class: 'col-empty' }, ['（此栏待写…）']));
      } else {
        colBlocks.forEach(function (b) { body.appendChild(cellWrap(b, opts)); });
      }
      colEl.appendChild(body);
      columnsEl.appendChild(colEl);
    });

    section.appendChild(columnsEl);
    return section;
  }

  // ──────────────────────────── render whole board ──────────────────────
  function render(board, pointer, opts) {
    opts = opts || {};
    var root = h('div', { class: 'board-root' });

    // group blocks by step
    var byStep = {};
    board.blocks.forEach(function (b) { (byStep[b.reveal.step] = byStep[b.reveal.step] || []).push(b); });

    board.steps.forEach(function (step) {
      var stepBlocks = (byStep[step.idx] || []).sort(function (a, b) {
        return a.reveal.sub - b.reveal.sub;
      });
      // only render steps where at least one block is visible
      var anyVisible = stepBlocks.some(function (b) { return atOrBefore(b.reveal, pointer); });
      if (!anyVisible) return;
      var sec = renderStep(step, stepBlocks, pointer, opts);
      if (sec) root.appendChild(sec);
    });

    return root;
  }

  window.BoardRenderer = { render: render, revealOrder: revealOrder, atOrBefore: atOrBefore, key: key };
})();
