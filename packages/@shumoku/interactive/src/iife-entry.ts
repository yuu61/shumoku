/**
 * IIFE entry point - exposes API to window.ShumokuInteractive
 */

import { initInteractive } from './runtime.js'
import {
  destroyBottomSheet,
  destroyModal,
  destroyTooltip,
  hideBottomSheet,
  hideModal,
  hideTooltip,
  showBottomSheet,
  showModal,
  showTooltip,
} from './components/index.js'

// Expose to global scope
const ShumokuInteractive = {
  initInteractive,
  showModal,
  hideModal,
  destroyModal,
  showTooltip,
  hideTooltip,
  destroyTooltip,
  showBottomSheet,
  hideBottomSheet,
  destroyBottomSheet,
}

// Assign to window
;(window as unknown as { ShumokuInteractive: typeof ShumokuInteractive }).ShumokuInteractive =
  ShumokuInteractive

export { ShumokuInteractive }
