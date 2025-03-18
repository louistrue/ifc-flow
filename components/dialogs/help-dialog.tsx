"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { formatKeyCombination, useKeyboardShortcuts } from "@/lib/keyboard-shortcuts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertCircle,
  Info,
  Keyboard,
  Search,
  ChevronRight,
  ArrowRight,
  Code,
  Layers,
  FileJson,
  Building,
  Copy,
  Check,
  Command,
  FileDown,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function HelpDialog({ open, onOpenChange }) {
  const [activeTab, setActiveTab] = useState("about")
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null)
  const [listeningForKeys, setListeningForKeys] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { shortcuts, updateShortcut, resetShortcut, resetAllShortcuts } = useKeyboardShortcuts()
  const dialogRef = useRef<HTMLDivElement>(null)

  // Group shortcuts by category
  const shortcutsByCategory = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {})

  // Filter shortcuts by search query
  const filteredShortcuts = searchQuery
    ? shortcuts.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.keys.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.category.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : null

  // Handle shortcut edit
  const handleShortcutClick = (id: string) => {
    setEditingShortcut(id)
    setListeningForKeys(true)
  }

  // Handle key press for shortcut editing
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!listeningForKeys || !editingShortcut) return

    e.preventDefault()

    // Build key combination
    const keys = []
    if (e.ctrlKey) keys.push("ctrl")
    if (e.altKey) keys.push("alt")
    if (e.shiftKey) keys.push("shift")
    if (e.metaKey) keys.push("meta")

    // Add the main key if it's not a modifier
    const key = e.key.toLowerCase()
    if (!["control", "alt", "shift", "meta"].includes(key)) {
      keys.push(key)
    }

    // Only update if we have at least one key
    if (keys.length > 0) {
      updateShortcut(editingShortcut, keys.join("+"))
      setListeningForKeys(false)
      setEditingShortcut(null)
    }
  }

  // Copy shortcut to clipboard
  const handleCopyShortcut = (id: string, keys: string) => {
    navigator.clipboard.writeText(keys)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Reset focus when tab changes
  useEffect(() => {
    if (dialogRef.current) {
      const focusableElement = dialogRef.current.querySelector('[tabindex="0"]') as HTMLElement
      if (focusableElement) focusableElement.focus()
    }
  }, [activeTab])

  // Tutorial steps
  const tutorialSteps = [
    {
      id: "loading",
      title: "Loading an IFC File",
      icon: <Building className="h-5 w-5" />,
      description: "Start by loading an IFC model to work with.",
      steps: [
        'Click the "Open File" button in the top menu or use <kbd>Ctrl+O</kbd>',
        "Select an IFC file from your device",
        "Alternatively, drag and drop an IFC file directly onto the canvas",
      ],
    },
    {
      id: "workflow",
      title: "Creating a Workflow",
      icon: <Layers className="h-5 w-5" />,
      description: "Build your workflow by connecting nodes to process IFC data.",
      steps: [
        "Drag nodes from the sidebar onto the canvas",
        "Connect nodes by clicking and dragging from an output handle to an input handle",
        "Configure node properties by selecting a node and using the properties panel",
        'Run the workflow by clicking the "Run" button or pressing <kbd>F5</kbd>',
      ],
    },
    {
      id: "saving",
      title: "Saving and Loading Workflows",
      icon: <FileJson className="h-5 w-5" />,
      description: "Save your work for later use or sharing.",
      steps: [
        'Save your workflow to the library by clicking "Save to Library" in the File menu or using <kbd>Ctrl+S</kbd>',
        'Download your workflow as a JSON file using "Save Locally" or <kbd>Ctrl+Shift+S</kbd>',
        "Load a saved workflow from the workflow library using <kbd>Ctrl+L</kbd>",
      ],
    },
    {
      id: "navigating",
      title: "Navigating the Canvas",
      icon: <Command className="h-5 w-5" />,
      description: "Move around and organize your workflow.",
      steps: [
        "Zoom in and out using the mouse wheel or <kbd>Ctrl+=</kbd> and <kbd>Ctrl+-</kbd>",
        "Pan by holding the middle mouse button or Space+drag",
        "Select multiple nodes by holding Shift while clicking or dragging a selection box",
        "Fit all nodes in view with <kbd>Ctrl+0</kbd>",
      ],
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogRef}
        className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-background"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Info className="h-5 w-5 text-primary" />
            Grasshopper for IFC Help
          </DialogTitle>
          <DialogDescription>
            Documentation and resources to help you use Grasshopper for IFC effectively
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col mt-2">
          <div className="flex justify-between items-center">
            <TabsList className="mb-2">
              <TabsTrigger value="about" data-tab="about" className="flex items-center gap-1">
                <Info className="h-4 w-4" />
                About
              </TabsTrigger>
              <TabsTrigger value="shortcuts" data-tab="shortcuts" className="flex items-center gap-1">
                <Keyboard className="h-4 w-4" />
                Keyboard Shortcuts
              </TabsTrigger>
              <TabsTrigger value="tutorial" data-tab="tutorial" className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Tutorial
              </TabsTrigger>
              <TabsTrigger value="examples" data-tab="examples" className="flex items-center gap-1">
                <Code className="h-4 w-4" />
                Examples
              </TabsTrigger>
            </TabsList>

            {activeTab === "shortcuts" && (
              <div className="flex gap-2">
                <div className="relative w-[200px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search shortcuts..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={resetAllShortcuts}>
                  Reset All
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="about" className="flex-1 overflow-auto mt-0 border rounded-md p-4">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Building className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium">Grasshopper for IFC</h3>
                  <p className="text-muted-foreground">
                    A visual scripting environment for working with IFC (Industry Foundation Classes) files. Create,
                    manipulate, and analyze building information models using a node-based interface.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Key Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      <li className="flex gap-2">
                        <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>Load and visualize IFC models</span>
                      </li>
                      <li className="flex gap-2">
                        <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>Extract geometry, properties, and relationships</span>
                      </li>
                      <li className="flex gap-2">
                        <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>Filter and transform model elements</span>
                      </li>
                      <li className="flex gap-2">
                        <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>Perform spatial and geometric analyses</span>
                      </li>
                      <li className="flex gap-2">
                        <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>Export results in various formats</span>
                      </li>
                      <li className="flex gap-2">
                        <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>Save and share workflows</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">System Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm font-medium">Version</div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Grasshopper for IFC</span>
                        <Badge variant="outline">v0.1.0</Badge>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium">Technologies</div>
                      <div className="grid grid-cols-2 gap-1 text-muted-foreground text-sm">
                        <div>Next.js Framework</div>
                        <div>React Flow</div>
                        <div>IfcOpenShell</div>
                        <div>Three.js</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium">License</div>
                      <div className="text-muted-foreground">MIT License</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="text-lg font-medium mb-3">Getting Started</h4>
                <p className="mb-4">
                  New to Grasshopper for IFC? Check out the tutorial section to learn how to create your first workflow
                  and process IFC models effectively.
                </p>
                <Button onClick={() => setActiveTab("tutorial")} className="gap-2">
                  <AlertCircle className="h-4 w-4" />
                  View Tutorial
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="shortcuts"
            className="flex-1 overflow-hidden flex flex-col mt-0 border rounded-md"
            tabIndex={0}
          >
            {listeningForKeys && (
              <Alert className="m-4 mb-0">
                <AlertTitle className="flex items-center gap-2">
                  <Keyboard className="h-4 w-4" />
                  Listening for key press
                </AlertTitle>
                <AlertDescription>Press the key combination you want to use for this shortcut</AlertDescription>
              </Alert>
            )}

            <ScrollArea className="flex-1 p-4">
              {filteredShortcuts ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Search Results</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Shortcut</TableHead>
                        <TableHead className="w-[140px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredShortcuts.map((shortcut) => (
                        <TableRow key={shortcut.id}>
                          <TableCell className="capitalize">{shortcut.category}</TableCell>
                          <TableCell>{shortcut.name}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`font-mono ${editingShortcut === shortcut.id ? "bg-primary/20" : ""}`}
                              onClick={() => handleShortcutClick(shortcut.id)}
                            >
                              {formatKeyCombination(shortcut.keys)}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCopyShortcut(shortcut.id, shortcut.keys)}
                                title="Copy shortcut"
                              >
                                {copiedId === shortcut.id ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => resetShortcut(shortcut.id)}
                                disabled={shortcut.keys === shortcut.defaultKeys}
                                title="Reset to default"
                              >
                                <FileDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                Object.entries(shortcutsByCategory).map(([category, categoryShortcuts]) => (
                  <div key={category} className="mb-8">
                    <h4 className="text-lg font-medium capitalize mb-3 flex items-center gap-2">
                      {category === "file" && <FileJson className="h-5 w-5 text-primary" />}
                      {category === "edit" && <Code className="h-5 w-5 text-primary" />}
                      {category === "view" && <Layers className="h-5 w-5 text-primary" />}
                      {category === "workflow" && <Building className="h-5 w-5 text-primary" />}
                      {category === "help" && <AlertCircle className="h-5 w-5 text-primary" />}
                      {category}
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Action</TableHead>
                          <TableHead>Shortcut</TableHead>
                          <TableHead className="w-[140px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryShortcuts.map((shortcut) => (
                          <TableRow key={shortcut.id}>
                            <TableCell>{shortcut.name}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`font-mono ${editingShortcut === shortcut.id ? "bg-primary/20" : ""}`}
                                onClick={() => handleShortcutClick(shortcut.id)}
                              >
                                {formatKeyCombination(shortcut.keys)}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleCopyShortcut(shortcut.id, shortcut.keys)}
                                  title="Copy shortcut"
                                >
                                  {copiedId === shortcut.id ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => resetShortcut(shortcut.id)}
                                  disabled={shortcut.keys === shortcut.defaultKeys}
                                  title="Reset to default"
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="tutorial" className="flex-1 overflow-auto mt-0 border rounded-md p-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-medium flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  Getting Started with Grasshopper for IFC
                </h3>
                <p className="text-muted-foreground mt-1">
                  Follow this step-by-step guide to learn how to use Grasshopper for IFC effectively.
                </p>
              </div>

              <div className="space-y-6 mt-4">
                {tutorialSteps.map((section, index) => (
                  <Card key={section.id} className="relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full w-1.5 bg-primary/70"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Badge variant="outline" className="mr-1 bg-primary/10">
                          {index + 1}
                        </Badge>
                        {section.icon}
                        {section.title}
                      </CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ol className="space-y-2 ml-6 list-decimal">
                        {section.steps.map((step, i) => (
                          <li key={i} dangerouslySetInnerHTML={{ __html: step }}></li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="bg-primary/5 p-4 rounded-md border border-primary/20">
                <h4 className="text-lg font-medium flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Pro Tips
                </h4>
                <ul className="mt-2 space-y-2">
                  <li className="flex gap-2 items-start">
                    <ArrowRight className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>
                      Use keyboard shortcuts to speed up your workflow. View them in the Shortcuts tab or press{" "}
                      <kbd>Shift+F1</kbd>.
                    </span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <ArrowRight className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>
                      Save your work regularly using <kbd>Ctrl+S</kbd> to avoid losing progress.
                    </span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <ArrowRight className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Organize your nodes by grouping related functionality together for better readability.</span>
                  </li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="examples" className="flex-1 overflow-auto mt-0 border rounded-md p-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-medium flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  Example Workflows
                </h3>
                <p className="text-muted-foreground mt-1">
                  Explore these example workflows to understand common use-cases and techniques.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Extract Wall Quantities</CardTitle>
                    <CardDescription>Get volume and area measurements for all walls</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>
                      This workflow demonstrates how to load an IFC file, filter for wall elements, and extract quantity
                      information.
                    </p>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button variant="outline" size="sm" className="w-full">
                      Load Example
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Space Analysis</CardTitle>
                    <CardDescription>Analyze room usage and spatial relationships</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>Learn how to extract spatial data from an IFC model and generate analytics about space usage.</p>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button variant="outline" size="sm" className="w-full">
                      Load Example
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Element Classification</CardTitle>
                    <CardDescription>Categorize building elements by type and properties</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>
                      This example shows how to classify and group elements based on their properties and relationships.
                    </p>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button variant="outline" size="sm" className="w-full">
                      Load Example
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Data Export</CardTitle>
                    <CardDescription>Export model data to various formats</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>Learn how to export IFC data to CSV, JSON, and other formats for further processing.</p>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button variant="outline" size="sm" className="w-full">
                      Load Example
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              <div className="flex justify-center mt-6">
                <Button className="gap-2">
                  <Code className="h-4 w-4" />
                  View More Examples
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

