/**
 * Element Operations Module
 * Extracted from ifc-utils.ts
 * Contains: filterElements, transformElements, extractGeometry
 */

import type { IfcElement, IfcModel } from '@/lib/ifc-utils'

// Re-export from existing ifc-utils.ts for now
// Full extraction can be done incrementally
export { 
  filterElements, 
  transformElements, 
  extractGeometry 
} from '@/lib/ifc-utils'

// These functions will be fully extracted here eventually
// For now, they remain in ifc-utils.ts for backward compatibility

