/**
 * Pyodide Manager
 * Handles Pyodide initialization and IfcOpenShell setup
 */

declare global {
  interface Window {
    loadPyodide: any
  }
}

declare const loadPyodide: any

export interface PyodideInstance {
  FS: any
  globals: any
  runPythonAsync: (code: string, options?: any) => Promise<void>
  loadPackage: (packages: string[]) => Promise<void>
  [key: string]: any
}

export type ProgressCallback = (percentage: number, message: string) => void

export class PyodideManager {
  private static instance: PyodideManager | null = null
  private pyodide: PyodideInstance | null = null
  private pySqliteReady = false
  private isInitializing = false
  private initializationPromise: Promise<PyodideInstance> | null = null

  private constructor() {}

  static getInstance(): PyodideManager {
    if (!PyodideManager.instance) {
      PyodideManager.instance = new PyodideManager()
    }
    return PyodideManager.instance
  }

  /**
   * Get current Pyodide instance
   */
  getInstance(): PyodideInstance | null {
    return this.pyodide
  }

  /**
   * Check if Pyodide is initialized
   */
  isInitialized(): boolean {
    return this.pyodide !== null
  }

  /**
   * Check if Python sqlite3 is available
   */
  isPySqliteReady(): boolean {
    return this.pySqliteReady
  }

  /**
   * Initialize Pyodide with IfcOpenShell
   */
  async initialize(
    onProgress?: ProgressCallback,
    ensureIfc2sqlPyCode?: () => Promise<string | null>
  ): Promise<PyodideInstance> {
    if (this.pyodide) {
      return this.pyodide
    }

    // If already initializing, return the promise
    if (this.isInitializing && this.initializationPromise) {
      return this.initializationPromise
    }

    this.isInitializing = true
    this.initializationPromise = this._doInitialize(onProgress, ensureIfc2sqlPyCode)

    try {
      this.pyodide = await this.initializationPromise
      return this.pyodide
    } finally {
      this.isInitializing = false
      this.initializationPromise = null
    }
  }

  private async _doInitialize(
    onProgress?: ProgressCallback,
    ensureIfc2sqlPyCode?: () => Promise<string | null>
  ): Promise<PyodideInstance> {
    onProgress?.(5, 'Loading Pyodide...')

    try {
      console.log('initPyodide: Starting Pyodide initialization')
      // Load Pyodide v0.28.0 (optimal compatibility with ifcopenshell-0.8.4 wheel)
      const pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.28.0/full/',
      })
      console.log('initPyodide: Pyodide loaded successfully')

      onProgress?.(30, 'Installing required packages...')

      console.log('initPyodide: Loading micropip, numpy, typing-extensions')
      // Load micropip for package installation and numpy for computations
      await pyodide.loadPackage(['micropip', 'numpy', 'typing-extensions'])
      console.log('initPyodide: Basic packages loaded')

      // Simple bypass - just patch the core compatibility function
      await pyodide.runPythonAsync(`
        import sys

        # SIMPLE BYPASS: Just replace the core check function
        def simple_bypass(filename):
            print(f"🚫 BYPASSED: Allowing wheel {filename}")
            return None

        # Import micropip first
        import micropip
        print("Micropip imported successfully")

        # Only patch the essential compatibility check
        import micropip._utils
        micropip._utils.check_compatible = simple_bypass
        print("✅ Disabled micropip._utils.check_compatible")

        # Verify the patch worked
        try:
            result = micropip._utils.check_compatible("test.whl")
            print(f"🧪 Compatibility check result: {result}")
        except Exception as e:
            print(f"❌ Error testing compatibility check: {e}")

        print("🎯 SIMPLE BYPASS COMPLETE")
      `)

      // Install IfcOpenShell
      onProgress?.(50, 'Installing IfcOpenShell...')

      await pyodide.runPythonAsync(`
        import micropip, importlib

        # SIMPLE BYPASS RE-APPLICATION FOR INSTALLATIONS
        def simple_bypass(filename):
            print(f"🚫 BYPASSED: Allowing wheel {filename}")
            return None

        # Ensure bypass is active before installations
        import micropip._utils
        micropip._utils.check_compatible = simple_bypass
        print("✅ Bypass ready for installations")

        # Install lark for stream support
        print("📦 Installing lark...")
        await micropip.install('lark')
        print("✅ Lark installed successfully")

        # Use local 0.8.4 wheel - supports IFC4X3_ADD2 schema
        wheel_urls = [
            '/wasm/ifcopenshell-0.8.4+b1b95ec-cp313-cp313-emscripten_4_0_9_wasm32.whl'
        ]
        last_exc = None
        installed = False
        for url in wheel_urls:
            try:
                print(f"🎯 Installing ifcopenshell 0.8.4: {url}")

                # Ensure bypass is active before each install
                micropip._utils.check_compatible = simple_bypass

                await micropip.install(url, keep_going=True, deps=False)

                # Verify import works
                import ifcopenshell
                print('✅ IfcOpenShell 0.8.4 import OK:', getattr(ifcopenshell, 'version', 'unknown'))

                print("✅ SUCCESS: IfcOpenShell 0.8.4 loaded and ready for IFC processing!")

                installed = True
                break
            except Exception as e:
                last_exc = e
                print(f"❌ Install/import failed for ifcopenshell 0.8.4: {e}")
                # Clean up failed installation
                try:
                    import sys
                    if 'ifcopenshell' in sys.modules:
                        del sys.modules['ifcopenshell']
                    import importlib
                    importlib.invalidate_caches()
                    print("🧹 Cleaned up failed ifcopenshell 0.8.4 installation")
                except Exception as cleanup_e:
                    print(f"❌ Cleanup failed: {cleanup_e}")

        if not installed:
            if last_exc:
                raise last_exc
            else:
                raise RuntimeError('Failed to install IfcOpenShell 0.8.4')
      `)

      // Try to enable Python sqlite3
      try {
        await pyodide.loadPackage(['sqlite3'])
        await pyodide.runPythonAsync(`import sqlite3\nprint('sqlite3 available')`)
        this.pySqliteReady = true
      } catch (e) {
        this.pySqliteReady = false
      }

      // Ensure shapely is available
      onProgress?.(62, 'Loading shapely...')
      try {
        await pyodide.loadPackage(['shapely'])
        await pyodide.runPythonAsync(`import shapely\nprint('shapely available')`)
      } catch (e) {
        // Proceed; if ifc2sql.py needs shapely it will error with clear message
      }

      // Initialize SQLite support
      onProgress?.(60, 'Installing SQLite and Ifc2Sql support...')

      await pyodide.runPythonAsync(`
        import sys
        import ifcopenshell
        import ifcopenshell.sql
        import json

        # Global variables for storing SQLite databases
        sqlite_databases = {}
      `)

      // Best-effort install of ifcpatch
      try {
        await pyodide.runPythonAsync(`
          import micropip
          try:
              await micropip.install('ifcpatch', keep_going=True)
              print('ifcpatch installed')
          except Exception as e:
              print('ifcpatch install warning:', e)

          # Install additional dependencies
          try:
              await micropip.install(['numpy', 'shapely'], keep_going=True)
              print('Additional dependencies installed')
          except Exception as e:
              print('Additional dependencies install warning:', e)

          # Also install ifcopenshell dependencies
          try:
              await micropip.install(['ifcopenshell'], keep_going=True)
              print('ifcopenshell installed for ifc2sql.py')
          except Exception as e:
              print('ifcopenshell install warning:', e)
        `)
      } catch {
        // Ignore errors
      }

      // Load ifc2sql.py if available
      if (ensureIfc2sqlPyCode) {
        const ifc2sqlText = await ensureIfc2sqlPyCode()
        if (ifc2sqlText) {
          const encoded = btoa(unescape(encodeURIComponent(ifc2sqlText)))
          await pyodide.runPythonAsync(`
            import base64
            import sys
            import importlib

            # First ensure ifcopenshell is available
            try:
                import ifcopenshell
                print('ifcopenshell available for ifc2sql.py')
            except ImportError as e:
                print('ifcopenshell not available:', e)

            try:
                import ifcpatch
                print('ifcpatch available for ifc2sql.py')
            except ImportError as e:
                print('ifcpatch not available:', e)

            # Decode and execute the ifc2sql.py code
            src = base64.b64decode('${encoded}').decode('utf-8')

            # Create a new module and execute the code in it
            import types
            ifc2sql_module = types.ModuleType('ifc2sql')
            sys.modules['ifc2sql'] = ifc2sql_module

            try:
                exec(src, ifc2sql_module.__dict__)
                Patcher = getattr(ifc2sql_module, 'Patcher', None)
                print('official ifc2sql.py loaded successfully:', bool(Patcher))
                if Patcher:
                    print('Patcher class found:', Patcher.__name__)
                    # Make Patcher available globally for later use
                    globals()['Patcher'] = Patcher
                    print('Patcher class added to globals')
                else:
                    print('Patcher class not found in ifc2sql.py')
            except Exception as e:
                print('Error loading ifc2sql.py:', e)
                import traceback
                print(traceback.format_exc())
                Patcher = None
          `)
        }
      }

      onProgress?.(100, 'IfcOpenShell loaded successfully')

      return pyodide
    } catch (error: any) {
      throw new Error(`Failed to load Pyodide: ${error.message}`)
    }
  }

  /**
   * Ensure ifc2sql.py code is loaded (helper function)
   */
  private async ensureIfc2sqlPyCode(): Promise<string | null> {
    try {
      const res = await fetch('/ifc2sql.py')
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      return await res.text()
    } catch (e) {
      console.warn('Failed to load ifc2sql.py:', e)
      return null
    }
  }
}

