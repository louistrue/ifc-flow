"use client"

import { useState } from "react"
import { AlertTriangle, X, Check, Info } from "lucide-react"

interface ClashResultsProps {
    results: any
    onHighlightClash?: (clash: any) => void
}

export function ClashResults({ results, onHighlightClash }: ClashResultsProps) {
    const [expanded, setExpanded] = useState(false)

    if (!results || results.error) {
        return (
            <div className="p-4 bg-red-50 rounded-md border border-red-200 text-red-700">
                <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    <h3 className="font-medium">Clash Detection Error</h3>
                </div>
                <p className="text-sm">{results?.error || "Unknown error occurred"}</p>
            </div>
        )
    }

    if (results.clashes === 0) {
        return (
            <div className="p-4 bg-green-50 rounded-md border border-green-200 text-green-700">
                <div className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    <h3 className="font-medium">No Clashes Detected</h3>
                </div>
                <p className="text-sm mt-1">All elements pass the clash detection test.</p>
            </div>
        )
    }

    return (
        <div className="border rounded-md overflow-hidden">
            <div
                className="bg-red-100 p-3 flex justify-between items-center cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <h3 className="font-medium text-red-700">
                        {results.clashes} Clash{results.clashes !== 1 ? "es" : ""} Detected
                    </h3>
                </div>
                <button className="text-red-700 hover:bg-red-200 p-1 rounded">
                    {expanded ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                </button>
            </div>

            {expanded && (
                <div className="p-4 bg-white">
                    <div className="text-sm mb-3">
                        Click on a clash to highlight it in the 3D view
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-2 text-left">ID</th>
                                    <th className="p-2 text-left">Element 1</th>
                                    <th className="p-2 text-left">Element 2</th>
                                    <th className="p-2 text-right">Distance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.details?.map((clash: any, index: number) => (
                                    <tr
                                        key={clash.id || index}
                                        className={`border-t hover:bg-blue-50 cursor-pointer ${index % 2 === 0 ? 'bg-gray-50' : ''}`}
                                        onClick={() => onHighlightClash && onHighlightClash(clash)}
                                    >
                                        <td className="p-2">{clash.id || `Clash ${index + 1}`}</td>
                                        <td className="p-2">
                                            <div className="font-medium">{clash.element1?.type}</div>
                                            <div className="text-xs text-gray-500">{clash.element1?.name}</div>
                                        </td>
                                        <td className="p-2">
                                            <div className="font-medium">{clash.element2?.type}</div>
                                            <div className="text-xs text-gray-500">{clash.element2?.name}</div>
                                        </td>
                                        <td className="p-2 text-right">
                                            <div className={`font-medium ${clash.distance < 1 ? 'text-red-600' : clash.distance < 5 ? 'text-orange-600' : 'text-yellow-600'}`}>
                                                {clash.distance.toFixed(2)} mm
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 text-xs text-gray-500">
                        Note: Clashes are visualized in the 3D viewer as red spheres
                    </div>
                </div>
            )}
        </div>
    )
}

export default ClashResults 