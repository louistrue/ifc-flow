"use client";

import type React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, ChevronRight, Github, Info, Link } from "lucide-react";

interface AboutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl bg-background">
                <DialogHeader className="pb-2 border-b">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Info className="h-5 w-5 text-primary" />
                        About Grasshopper for IFC
                    </DialogTitle>
                    <DialogDescription>
                        Information about the application, its features, and technology.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    <div className="flex items-start gap-4">
                        <div className="bg-primary/10 p-3 rounded-full">
                            <Building className="h-8 w-8 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-medium">Grasshopper for IFC</h3>
                            <p className="text-muted-foreground">
                                A visual scripting environment for working with IFC (Industry
                                Foundation Classes) files. Create, manipulate, and analyze
                                building information models using a node-based interface.
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
                                        <span className="text-muted-foreground">
                                            Grasshopper for IFC
                                        </span>
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
                                        <div>Shadcn UI</div>
                                        <div>Tailwind CSS</div>
                                    </div>
                                </div>

                                <div>
                                    <div className="text-sm font-medium">License</div>
                                    <div className="text-muted-foreground">AGPL-3.0</div>
                                </div>

                                <div>
                                    <div className="text-sm font-medium">Source Code</div>
                                    <Button
                                        variant="link"
                                        className="p-0 h-auto text-muted-foreground hover:text-primary"
                                        asChild
                                    >
                                        <a
                                            href="https://github.com/louistrue/ifc-flow"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1"
                                        >
                                            <Github className="h-4 w-4" />
                                            GitHub Repository
                                            <Link className="h-3 w-3 ml-0.5" />
                                        </a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
} 