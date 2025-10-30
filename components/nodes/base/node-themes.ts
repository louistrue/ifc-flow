export const nodeThemes = {
    ifc: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-blue-500 dark:border-blue-400',
        borderSelected: 'border-blue-700',
        headerBg: 'bg-blue-500',
        headerText: 'text-white',
        handleStyle: { background: '#3b82f6', width: 10, height: 10 },
        handleOutputStyle: { background: '#3b82f6', width: 10, height: 10 }
    },
    cluster: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-purple-500 dark:border-purple-400',
        borderSelected: 'border-purple-700',
        headerBg: 'bg-purple-500',
        headerText: 'text-white',
        handleStyle: { background: '#a855f7', width: 10, height: 10 }
    },
    python: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-amber-500',
        borderSelected: 'border-amber-700',
        headerGradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
        headerText: 'text-white',
        handleStyle: {
            background: 'linear-gradient(45deg, #f59e0b, #d97706)',
            width: 10,
            height: 10,
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }
    },
    analysis: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-cyan-500 dark:border-cyan-400',
        borderSelected: 'border-cyan-700',
        headerBg: 'bg-cyan-500',
        headerText: 'text-white',
        handleStyle: { background: '#06b6d4', width: 10, height: 10 }
    },
    property: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-violet-500 dark:border-violet-400',
        borderSelected: 'border-violet-700',
        headerBg: 'bg-violet-500',
        headerText: 'text-white',
        handleStyle: { background: '#8b5cf6', width: 10, height: 10 }
    },
    export: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-green-500 dark:border-green-400',
        borderSelected: 'border-green-700',
        headerBg: 'bg-green-500',
        headerText: 'text-white',
        handleStyle: { background: '#22c55e', width: 10, height: 10 }
    },
    geometry: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-orange-500 dark:border-orange-400',
        borderSelected: 'border-orange-700',
        headerBg: 'bg-orange-500',
        headerText: 'text-white',
        handleStyle: { background: '#f97316', width: 10, height: 10 }
    },
    filter: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-rose-500 dark:border-rose-400',
        borderSelected: 'border-rose-700',
        headerBg: 'bg-rose-500',
        headerText: 'text-white',
        handleStyle: { background: '#f43f5e', width: 10, height: 10 }
    },
    transform: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-teal-500 dark:border-teal-400',
        borderSelected: 'border-teal-700',
        headerBg: 'bg-teal-500',
        headerText: 'text-white',
        handleStyle: { background: '#14b8a6', width: 10, height: 10 }
    },
    quantity: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-amber-500 dark:border-amber-400',
        borderSelected: 'border-amber-700',
        headerBg: 'bg-amber-500',
        headerText: 'text-white',
        handleStyle: { background: '#f59e0b', width: 10, height: 10 }
    },
    classification: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-fuchsia-500 dark:border-fuchsia-400',
        borderSelected: 'border-fuchsia-700',
        headerBg: 'bg-fuchsia-500',
        headerText: 'text-white',
        handleStyle: { background: '#d946ef', width: 10, height: 10 }
    },
    relationship: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-indigo-500 dark:border-indigo-400',
        borderSelected: 'border-indigo-700',
        headerBg: 'bg-indigo-500',
        headerText: 'text-white',
        handleStyle: { background: '#6366f1', width: 10, height: 10 }
    },
    spatial: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-purple-500 dark:border-purple-400',
        borderSelected: 'border-purple-700',
        headerBg: 'bg-purple-500',
        headerText: 'text-white',
        handleStyle: { background: '#a855f7', width: 10, height: 10 }
    },
    dataTransform: {
        background: 'bg-white dark:bg-gray-800',
        border: 'border-sky-500 dark:border-sky-400',
        borderSelected: 'border-sky-700',
        headerBg: 'bg-sky-500',
        headerText: 'text-white',
        handleStyle: { background: '#0ea5e9', width: 10, height: 10 }
    },
}

export type NodeThemeKey = keyof typeof nodeThemes

