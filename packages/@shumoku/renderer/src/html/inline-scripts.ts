/**
 * Shared inline scripts and HTML templates for HTML renderers
 *
 * Provides composable JS generators parameterized by mode ('simple' | 'hierarchical')
 * to eliminate pan/zoom code duplication between generateHtml() and generateHierarchicalHtml().
 *
 * ViewBox access pattern difference:
 * - simple: `vb` and `origVb` are local variables (origVb.w, origVb.x, etc.)
 * - hierarchical: `sheetViewBoxes[currentSheet]` lookup (vb.origW, vb.origX, etc.)
 */

import { BRANDING_ICON_SVG } from '../brand.js'
import { escapeHtml } from './utils.js'
import { getZoomNavigationScript } from './zoom-navigation.js'

// ============================================
// Types
// ============================================

type PanZoomMode = 'simple' | 'hierarchical'

interface ToolbarHtmlOptions {
  titleId?: string
}

// ============================================
// SVG Icon Constants (toolbar buttons)
// ============================================

const ZOOM_OUT_SVG =
  '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M20 12H4"/></svg>'
const ZOOM_IN_SVG =
  '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>'
const FIT_SVG =
  '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>'
const RESET_SVG =
  '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>'

// ============================================
// HTML Generators
// ============================================

/**
 * Generate toolbar HTML with zoom controls
 */
export function getToolbarHtml(title: string, opts?: ToolbarHtmlOptions): string {
  const titleId = opts?.titleId ? ` id="${opts.titleId}"` : ''
  return `<div class="toolbar">
    <span class="toolbar-title"${titleId}>${escapeHtml(title)}</span>
    <div class="toolbar-buttons">
      <button id="btn-out" title="Zoom Out">${ZOOM_OUT_SVG}</button>
      <span class="zoom-text" id="zoom">100%</span>
      <button id="btn-in" title="Zoom In">${ZOOM_IN_SVG}</button>
      <button id="btn-fit" title="Fit">${FIT_SVG}</button>
      <button id="btn-reset" title="Reset">${RESET_SVG}</button>
    </div>
  </div>`
}

/**
 * Generate branding HTML badge
 */
export function getBrandingHtml(): string {
  return `<a class="branding" href="https://shumoku.packof.me" target="_blank" rel="noopener">
      ${BRANDING_ICON_SVG}
      <span>Made with Shumoku</span>
    </a>`
}

// ============================================
// Shared JS Snippets (identical in both modes)
// ============================================

function getTouchHelpers(): string {
  return `
      function getTouchDist(t) {
        if (t.length < 2) return 0;
        return Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
      }

      function getTouchCenter(t) {
        return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
      }`
}

function getToolbarListeners(): string {
  return `
      var btnIn = document.getElementById('btn-in');
      var btnOut = document.getElementById('btn-out');
      var btnFit = document.getElementById('btn-fit');
      var btnReset = document.getElementById('btn-reset');
      if (btnIn) btnIn.addEventListener('click', function() { zoom(1.2); });
      if (btnOut) btnOut.addEventListener('click', function() { zoom(1/1.2); });
      if (btnFit) btnFit.addEventListener('click', fitView);
      if (btnReset) btnReset.addEventListener('click', resetView);`
}

// ============================================
// Mode-parameterized JS Generators
// ============================================

function getZoomFunctions(mode: PanZoomMode): string {
  const vbLookup =
    mode === 'hierarchical'
      ? `var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;
        `
      : ''
  const origW = mode === 'simple' ? 'origVb.w' : 'vb.origW'
  const origH = mode === 'simple' ? 'origVb.h' : 'vb.origH'
  const origX = mode === 'simple' ? 'origVb.x' : 'vb.origX'
  const origY = mode === 'simple' ? 'origVb.y' : 'vb.origY'

  return `
      function zoom(f) {
        ${vbLookup}var cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
        var nw = vb.w / f, nh = vb.h / f;
        var scale = ${origW} / nw;
        if (scale < 0.1 || scale > 10) return;
        vb.w = nw; vb.h = nh; vb.x = cx - nw / 2; vb.y = cy - nh / 2;
        updateViewBox();
      }

      function fitView() {
        ${vbLookup}var cw = container.clientWidth || 800;
        var ch = container.clientHeight || 600;
        var scale = Math.min(cw / ${origW}, ch / ${origH}) * 0.9;
        vb.w = cw / scale;
        vb.h = ch / scale;
        vb.x = ${origX} + (${origW} - vb.w) / 2;
        vb.y = ${origY} + (${origH} - vb.h) / 2;
        updateViewBox();
      }

      function resetView() {
        ${vbLookup}vb.x = ${origX}; vb.y = ${origY}; vb.w = ${origW}; vb.h = ${origH};
        updateViewBox();
      }`
}

function getWheelHandler(mode: PanZoomMode): string {
  const animGuard =
    mode === 'hierarchical'
      ? `if (zoomNavState.isAnimating) {
          e.preventDefault();
          return;
        }

        `
      : ''
  const vbLookup =
    mode === 'hierarchical'
      ? `var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;
        `
      : ''
  const origW = mode === 'simple' ? 'origVb.w' : 'vb.origW'
  const tracking =
    mode === 'hierarchical'
      ? `

        // Track wheel position for transition detection
        lastWheelX = e.clientX;
        lastWheelY = e.clientY;

        // Debounce wheel end detection
        if (wheelEndTimeout) {
          clearTimeout(wheelEndTimeout);
        }
        wheelEndTimeout = setTimeout(handleWheelEnd, 150);`
      : ''

  return `
      container.addEventListener('wheel', function(e) {
        ${animGuard}e.preventDefault();
        ${vbLookup}var rect = container.getBoundingClientRect();
        var mx = (e.clientX - rect.left) / rect.width;
        var my = (e.clientY - rect.top) / rect.height;
        var px = vb.x + vb.w * mx, py = vb.y + vb.h * my;
        var f = e.deltaY > 0 ? 1/1.2 : 1.2;
        var nw = vb.w / f, nh = vb.h / f;
        var scale = ${origW} / nw;
        if (scale < 0.1 || scale > 10) return;
        vb.w = nw; vb.h = nh; vb.x = px - nw * mx; vb.y = py - nh * my;
        updateViewBox();${tracking}
      }, { passive: false });`
}

function getMouseDragHandler(mode: PanZoomMode): string {
  const animGuard = mode === 'hierarchical' ? ' && !zoomNavState.isAnimating' : ''
  const mousedownVb =
    mode === 'hierarchical'
      ? `var vb = sheetViewBoxes[currentSheet];
          if (!vb) return;
          drag = { active: true, x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y };`
      : 'drag = { active: true, x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y };'
  const mousemoveVb =
    mode === 'hierarchical'
      ? `var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;
        `
      : ''

  return `
      container.addEventListener('mousedown', function(e) {
        if (e.button === 0${animGuard}) {
          ${mousedownVb}
          container.classList.add('dragging');
        }
      });

      document.addEventListener('mousemove', function(e) {
        if (!drag.active) return;
        ${mousemoveVb}var sx = vb.w / container.clientWidth;
        var sy = vb.h / container.clientHeight;
        vb.x = drag.vx - (e.clientX - drag.x) * sx;
        vb.y = drag.vy - (e.clientY - drag.y) * sy;
        updateViewBox();
      });

      document.addEventListener('mouseup', function() {
        drag.active = false;
        container.classList.remove('dragging');
      });`
}

function getTouchEventHandlers(mode: PanZoomMode): string {
  const touchstartAnimGuard =
    mode === 'hierarchical'
      ? `if (zoomNavState.isAnimating) {
          e.preventDefault();
          return;
        }

        `
      : ''
  const touchmoveAnimGuard =
    mode === 'hierarchical'
      ? `if (zoomNavState.isAnimating) {
          e.preventDefault();
          return;
        }

        `
      : ''

  // touchstart - single finger vb access
  const touchstartSingle =
    mode === 'hierarchical'
      ? `var vb = sheetViewBoxes[currentSheet];
          if (vb) {
            touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY, vx: vb.x, vy: vb.y };
            hasMoved = false;
          }`
      : `touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY, vx: vb.x, vy: vb.y };
          hasMoved = false;`

  // touchstart - pinch vb access
  const touchstartPinchVb =
    mode === 'hierarchical'
      ? `var vb = sheetViewBoxes[currentSheet];
          if (!vb) return;
          `
      : ''
  const touchstartPinchTracking =
    mode === 'hierarchical'
      ? `
          lastPinchCenterX = center.x;
          lastPinchCenterY = center.y;`
      : ''

  // touchmove - single finger vb access
  const touchmoveSingleVb =
    mode === 'hierarchical'
      ? `var vb = sheetViewBoxes[currentSheet];
          if (!vb) return;
          `
      : ''

  // touchmove - pinch vb access
  const touchmovePinchVb =
    mode === 'hierarchical'
      ? `var vb = sheetViewBoxes[currentSheet];
          if (!vb) return;
          `
      : ''
  const origW = mode === 'simple' ? 'origVb.w' : 'vb.origW'
  const touchmovePinchTracking =
    mode === 'hierarchical'
      ? `

          lastPinchCenterX = center.x;
          lastPinchCenterY = center.y;`
      : ''

  // touchend - pinch end handling
  const touchendPinchEnd =
    mode === 'hierarchical'
      ? `if (pinch) {
            // Pinch ended - check for navigation transition
            if (pinchEndTimeout) clearTimeout(pinchEndTimeout);
            pinchEndTimeout = setTimeout(handlePinchEnd, 150);
          }
          `
      : ''

  // touchend - single finger remaining vb access
  const touchendSingleVb =
    mode === 'hierarchical'
      ? `pinch = null;
          var vb = sheetViewBoxes[currentSheet];
          if (vb) {
            touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY, vx: vb.x, vy: vb.y };
          }`
      : `pinch = null;
          touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY, vx: vb.x, vy: vb.y };`
  const touchendComment = mode === 'simple' ? ' // Already moving' : ''

  return `
      container.addEventListener('touchstart', function(e) {
        // Skip if touching branding link
        if (e.target.closest && e.target.closest('.branding')) return;

        ${touchstartAnimGuard}if (e.touches.length === 1) {
          ${touchstartSingle}
        } else if (e.touches.length >= 2) {
          e.preventDefault();
          touch1 = null;
          hasMoved = true;
          ${touchstartPinchVb}var dist = getTouchDist(e.touches);
          var center = getTouchCenter(e.touches);
          var rect = container.getBoundingClientRect();
          pinch = {
            dist: dist,
            vb: { x: vb.x, y: vb.y, w: vb.w, h: vb.h },
            cx: vb.x + vb.w * ((center.x - rect.left) / rect.width),
            cy: vb.y + vb.h * ((center.y - rect.top) / rect.height),
            lastCenter: center
          };${touchstartPinchTracking}
        }
      }, { passive: false });

      container.addEventListener('touchmove', function(e) {
        // Skip if touching branding link
        if (e.target.closest && e.target.closest('.branding')) return;

        ${touchmoveAnimGuard}if (e.touches.length === 1 && touch1) {
          ${touchmoveSingleVb}var dx = e.touches[0].clientX - touch1.x;
          var dy = e.touches[0].clientY - touch1.y;

          // Check if moved beyond threshold
          if (!hasMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            hasMoved = true;
          }

          if (hasMoved) {
            e.preventDefault();
            var sx = vb.w / container.clientWidth;
            var sy = vb.h / container.clientHeight;
            vb.x = touch1.vx - dx * sx;
            vb.y = touch1.vy - dy * sy;
            updateViewBox();
          }
        } else if (e.touches.length >= 2 && pinch) {
          e.preventDefault();
          ${touchmovePinchVb}var dist = getTouchDist(e.touches);
          var center = getTouchCenter(e.touches);
          if (dist === 0 || pinch.dist === 0) return;

          var scale = dist / pinch.dist;
          var nw = pinch.vb.w / scale;
          var nh = pinch.vb.h / scale;
          var newScale = ${origW} / nw;
          if (newScale < 0.1 || newScale > 10) return;

          var rect = container.getBoundingClientRect();
          var sx = nw / rect.width;
          var sy = nh / rect.height;
          var panX = (center.x - pinch.lastCenter.x) * sx;
          var panY = (center.y - pinch.lastCenter.y) * sy;

          var mx = (center.x - rect.left) / rect.width;
          var my = (center.y - rect.top) / rect.height;
          vb.x = pinch.cx - nw * mx - panX;
          vb.y = pinch.cy - nh * my - panY;
          vb.w = nw;
          vb.h = nh;
          updateViewBox();${touchmovePinchTracking}
        }
      }, { passive: false });

      container.addEventListener('touchend', function(e) {
        if (e.touches.length === 0) {
          ${touchendPinchEnd}touch1 = null;
          pinch = null;
          hasMoved = false;
        } else if (e.touches.length === 1) {
          ${touchendSingleVb}
          hasMoved = true;${touchendComment}
        }
      });

      container.addEventListener('touchcancel', function() {
        touch1 = null;
        pinch = null;
        hasMoved = false;
      });`
}

// ============================================
// Assembly Functions
// ============================================

/**
 * Generate complete pan/zoom script for simple (single-sheet) mode
 */
export function getSimplePanZoomScript(): string {
  return `(function() {
      var svg = document.querySelector('#container > svg');
      var container = document.getElementById('container');
      if (!svg || !container) { console.error('SVG or container not found'); return; }

      var vb = { x: 0, y: 0, w: 0, h: 0 };
      var origVb = { x: 0, y: 0, w: 0, h: 0 };
      var drag = { active: false, x: 0, y: 0, vx: 0, vy: 0 };

      function init() {
        var w = parseFloat(svg.getAttribute('width')) || 800;
        var h = parseFloat(svg.getAttribute('height')) || 600;
        var existing = svg.getAttribute('viewBox');
        if (existing) {
          var p = existing.split(/\\s+|,/).map(Number);
          origVb = { x: p[0] || 0, y: p[1] || 0, w: p[2] || w, h: p[3] || h };
        } else {
          origVb = { x: 0, y: 0, w: w, h: h };
        }
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = '100%';
        fitView();

        if (window.ShumokuInteractive) {
          window.ShumokuInteractive.initInteractive({ target: svg, modal: { enabled: true }, tooltip: { enabled: true }, panZoom: { enabled: false } });
        }
      }

      function updateViewBox() {
        svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
        var zoomEl = document.getElementById('zoom');
        if (zoomEl) zoomEl.textContent = Math.round(origVb.w / vb.w * 100) + '%';
      }
${getZoomFunctions('simple')}
${getToolbarListeners()}
${getWheelHandler('simple')}
${getMouseDragHandler('simple')}

      // Touch events for pan/zoom
      var pinch = null;
      var touch1 = null;
      var hasMoved = false;
      var DRAG_THRESHOLD = 8;
${getTouchHelpers()}
${getTouchEventHandlers('simple')}

      // Listen for hierarchical navigation events
      document.addEventListener('shumoku:navigate', function(e) {
        var sheetId = e.detail && e.detail.sheetId;
        if (sheetId) {
          console.log('[Shumoku] Navigate to sheet:', sheetId);
          alert('Navigate to: ' + sheetId + '\\n\\nThis sheet would show the detailed view of this subgraph.');
        }
      });

      init();
    })();`
}

/**
 * Generate complete pan/zoom script for hierarchical (multi-sheet) mode
 */
export function getHierarchicalPanZoomScript(sheetInfoJson: string): string {
  return `(function() {
      // Zoom Navigation State and Functions
      ${getZoomNavigationScript()}

      var sheetInfo = ${sheetInfoJson};
      var currentSheet = 'root';
      var breadcrumb = ['root'];
      var sheetViewBoxes = {};
      var container = document.getElementById('container');
      var pendingZoomTarget = null;

      function getActiveSheet() {
        return container.querySelector('.sheet-container[data-sheet-id="' + currentSheet + '"]');
      }

      function getActiveSvg() {
        var sheet = getActiveSheet();
        return sheet ? sheet.querySelector('svg') : null;
      }

      function initSheet(sheetId) {
        var sheet = container.querySelector('.sheet-container[data-sheet-id="' + sheetId + '"]');
        if (!sheet) return;
        var svg = sheet.querySelector('svg');
        if (!svg) return;

        var w = parseFloat(svg.getAttribute('width')) || 800;
        var h = parseFloat(svg.getAttribute('height')) || 600;
        var existing = svg.getAttribute('viewBox');
        var vb;
        if (existing) {
          var p = existing.split(/\\s+|,/).map(Number);
          vb = { x: p[0] || 0, y: p[1] || 0, w: p[2] || w, h: p[3] || h, origX: p[0] || 0, origY: p[1] || 0, origW: p[2] || w, origH: p[3] || h };
        } else {
          vb = { x: 0, y: 0, w: w, h: h, origX: 0, origY: 0, origW: w, origH: h };
        }
        sheetViewBoxes[sheetId] = vb;

        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = '100%';

        // Fit view
        var cw = container.clientWidth || 800;
        var ch = container.clientHeight || 600;
        var scale = Math.min(cw / vb.origW, ch / vb.origH) * 0.9;
        vb.w = cw / scale;
        vb.h = ch / scale;
        vb.x = vb.origX + (vb.origW - vb.w) / 2;
        vb.y = vb.origY + (vb.origH - vb.h) / 2;
        svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);

        if (window.ShumokuInteractive) {
          window.ShumokuInteractive.initInteractive({ target: svg, modal: { enabled: true }, tooltip: { enabled: true }, panZoom: { enabled: false } });
        }
      }

      function updateViewBox() {
        var svg = getActiveSvg();
        var vb = sheetViewBoxes[currentSheet];
        if (!svg || !vb) return;
        svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
        var zoomEl = document.getElementById('zoom');
        if (zoomEl) zoomEl.textContent = Math.round(vb.origW / vb.w * 100) + '%';
      }

      function updateTitle() {
        var titleEl = document.getElementById('sheet-title');
        if (!titleEl) return;
        var info = sheetInfo[currentSheet];
        var label = info ? info.label : currentSheet;

        if (currentSheet === 'root') {
          titleEl.textContent = label;
        } else {
          titleEl.textContent = '';
          var backBtn = document.createElement('button');
          backBtn.className = 'back-btn';
          backBtn.id = 'back-btn';
          backBtn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>';
          backBtn.addEventListener('click', function() {
            navigateToSheet('root');
          });
          titleEl.appendChild(backBtn);
          titleEl.appendChild(document.createTextNode(label));
        }
      }

      function navigateToSheet(sheetId) {
        if (sheetId === currentSheet) return;
        if (!container.querySelector('.sheet-container[data-sheet-id="' + sheetId + '"]')) {
          console.warn('[Shumoku] Sheet not found:', sheetId);
          return;
        }

        // Hide current
        var current = getActiveSheet();
        if (current) current.style.display = 'none';

        // Show new
        currentSheet = sheetId;
        var newSheet = getActiveSheet();
        if (newSheet) {
          newSheet.style.display = 'block';
          if (!sheetViewBoxes[sheetId]) {
            initSheet(sheetId);
          }
        }

        // Update breadcrumb
        if (sheetId === 'root') {
          breadcrumb = ['root'];
        } else {
          breadcrumb = ['root', sheetId];
        }

        updateTitle();
        updateViewBox();
      }

      // Zoom functions
${getZoomFunctions('hierarchical')}

      // Toolbar buttons
${getToolbarListeners()}

      // Mouse drag
      var drag = { active: false, x: 0, y: 0 };
${getMouseDragHandler('hierarchical')}

      // Wheel zoom with navigation detection
      var lastWheelX = 0;
      var lastWheelY = 0;
      var wheelEndTimeout = null;

      function checkZoomInTransition() {
        if (zoomNavState.isAnimating) return;

        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;

        var scale = calculateScale(vb);
        var target = pickSubgraphTarget(lastWheelX, lastWheelY);

        if (target && shouldTriggerZoomIn(vb, target.bounds, scale)) {
          pendingZoomTarget = target;

          animateZoomToBounds(
            vb,
            target.bounds,
            function(newVb) {
              vb.x = newVb.x;
              vb.y = newVb.y;
              vb.w = newVb.w;
              vb.h = newVb.h;
              updateViewBox();
            },
            function() {
              // Sheet switch at 80%
              if (pendingZoomTarget) {
                if (!sheetViewBoxes[pendingZoomTarget.sheetId]) {
                  initSheet(pendingZoomTarget.sheetId);
                }
                var cw = container.clientWidth || 800;
                var ch = container.clientHeight || 600;
                initChildViewBox(pendingZoomTarget.sheetId, cw, ch);
                navigateToSheet(pendingZoomTarget.sheetId);
              }
            },
            function() {
              pendingZoomTarget = null;
            }
          );
        }
      }

      function checkZoomOutTransition() {
        if (zoomNavState.isAnimating) return;
        if (currentSheet === 'root') return;

        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;

        var scale = calculateScale(vb);
        var info = sheetInfo[currentSheet];
        var parentId = info && info.parentId ? info.parentId : 'root';

        if (shouldTriggerZoomOut(vb, scale, currentSheet)) {
          animateZoomOut(
            vb,
            function(newVb) {
              vb.x = newVb.x;
              vb.y = newVb.y;
              vb.w = newVb.w;
              vb.h = newVb.h;
              updateViewBox();
            },
            function() {
              // Sheet switch at 80%
              navigateToSheet(parentId);
            },
            function() {
              // Animation complete
            }
          );
        }
      }

      function handleWheelEnd() {
        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;

        var scale = calculateScale(vb);

        if (scale >= ZOOM_IN_SCALE_THRESHOLD) {
          checkZoomInTransition();
        } else if (scale <= ZOOM_OUT_SCALE_THRESHOLD) {
          checkZoomOutTransition();
        }
      }
${getWheelHandler('hierarchical')}

      // Navigation event listener
      document.addEventListener('shumoku:navigate', function(e) {
        var sheetId = e.detail && e.detail.sheetId;
        if (sheetId) {
          navigateToSheet(sheetId);
        }
      });

      // Double-click navigation (supplementary to zoom-based navigation)
      var lastClickTime = 0;
      var lastClickTarget = null;

      container.addEventListener('click', function(e) {
        if (zoomNavState.isAnimating) return;

        var now = Date.now();
        var target = e.target.closest ? e.target.closest('.subgraph[data-has-sheet]') : null;

        if (target && target === lastClickTarget && now - lastClickTime < 300) {
          // Double-click detected - trigger animated navigation
          e.preventDefault();
          e.stopPropagation();

          var sheetId = target.getAttribute('data-sheet-id');
          var boundsStr = target.getAttribute('data-bounds');

          if (sheetId && boundsStr) {
            try {
              var bounds = JSON.parse(boundsStr.replace(/&quot;/g, '"'));
              var vb = sheetViewBoxes[currentSheet];

              if (vb) {
                pendingZoomTarget = { sheetId: sheetId, bounds: bounds };

                animateZoomToBounds(
                  vb,
                  bounds,
                  function(newVb) {
                    vb.x = newVb.x;
                    vb.y = newVb.y;
                    vb.w = newVb.w;
                    vb.h = newVb.h;
                    updateViewBox();
                  },
                  function() {
                    if (pendingZoomTarget) {
                      if (!sheetViewBoxes[pendingZoomTarget.sheetId]) {
                        initSheet(pendingZoomTarget.sheetId);
                      }
                      var cw = container.clientWidth || 800;
                      var ch = container.clientHeight || 600;
                      initChildViewBox(pendingZoomTarget.sheetId, cw, ch);
                      navigateToSheet(pendingZoomTarget.sheetId);
                    }
                  },
                  function() {
                    pendingZoomTarget = null;
                  }
                );
              }
            } catch (err) {
              console.warn('[Shumoku] Failed to parse bounds:', err);
            }
          }

          lastClickTarget = null;
        } else {
          // Single click - record for potential double-click
          lastClickTarget = target;
          lastClickTime = now;
        }
      });

      // Touch support with pinch zoom and navigation detection
      var touch1 = null;
      var pinch = null;
      var hasMoved = false;
      var DRAG_THRESHOLD = 8;
      var pinchEndTimeout = null;
      var lastPinchCenterX = 0;
      var lastPinchCenterY = 0;
${getTouchHelpers()}

      function handlePinchEnd() {
        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;

        var scale = calculateScale(vb);

        if (scale >= ZOOM_IN_SCALE_THRESHOLD) {
          // Check for zoom-in transition using last pinch center
          if (zoomNavState.isAnimating) return;

          var target = pickSubgraphTarget(lastPinchCenterX, lastPinchCenterY);
          if (target && shouldTriggerZoomIn(vb, target.bounds, scale)) {
            pendingZoomTarget = target;

            animateZoomToBounds(
              vb,
              target.bounds,
              function(newVb) {
                vb.x = newVb.x;
                vb.y = newVb.y;
                vb.w = newVb.w;
                vb.h = newVb.h;
                updateViewBox();
              },
              function() {
                if (pendingZoomTarget) {
                  if (!sheetViewBoxes[pendingZoomTarget.sheetId]) {
                    initSheet(pendingZoomTarget.sheetId);
                  }
                  var cw = container.clientWidth || 800;
                  var ch = container.clientHeight || 600;
                  initChildViewBox(pendingZoomTarget.sheetId, cw, ch);
                  navigateToSheet(pendingZoomTarget.sheetId);
                }
              },
              function() {
                pendingZoomTarget = null;
              }
            );
          }
        } else if (scale <= ZOOM_OUT_SCALE_THRESHOLD) {
          checkZoomOutTransition();
        }
      }
${getTouchEventHandlers('hierarchical')}

      // Initialize root sheet
      initSheet('root');
      updateTitle();
    })();`
}
