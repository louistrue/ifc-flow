/**
 * Mock File objects for testing IFC file operations
 */
export function createMockFile(
  name: string,
  size: number = 1024,
  type: string = 'application/octet-stream'
): File {
  const content = new ArrayBuffer(size)
  // Fill with some mock data
  const view = new Uint8Array(content)
  for (let i = 0; i < Math.min(size, 100); i++) {
    view[i] = i % 256
  }
  return new File([content], name, { type })
}

export const mockIfcFile = createMockFile('test-model.ifc', 1024 * 100) // 100KB
export const mockSmallIfcFile = createMockFile('small-test.ifc', 1024 * 50) // 50KB
export const mockLargeIfcFile = createMockFile('large-test.ifc', 1024 * 1024 * 100) // 100MB

export const mockInvalidFile = createMockFile('invalid.txt', 1024, 'text/plain')

/**
 * Creates a File object from a string content (for testing file reading)
 */
export function createFileFromString(
  name: string,
  content: string,
  type: string = 'application/octet-stream'
): File {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  return new File([data], name, { type })
}

/**
 * Creates a mock IFC file content (minimal valid IFC header)
 */
export function createMockIfcContent(): string {
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('IFC Test File'),'2;1');
FILE_NAME('test-model.ifc','2024-01-01T00:00:00',('Test User'),('Test System'),'IFC4','Test','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#100=IFCPROJECT('test-guid','Test Project','Test Description',$,$,$,$,$,#200);
#200=IFCOWNERHISTORY(#300,#400,$,.NOTDEFINED.,$,$,$,1535572800);
#300=IFCPERSON('User','Test',$,($),($),$,($),$);
#400=IFCORGANIZATION($,'Test Organization',$,$,$);
ENDSEC;
END-ISO-10303-21;`
}

export const mockIfcFileFromContent = createFileFromString(
  'test-model.ifc',
  createMockIfcContent()
)

