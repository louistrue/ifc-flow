// Common styling for all node types
export const nodeBaseStyle = {
  container: "bg-white dark:bg-gray-800 rounded-md shadow-md transition-all duration-200 hover:shadow-lg",
  header: "px-3 py-1.5 flex items-center gap-2 rounded-t-md",
  content: "p-3 text-xs",
  handle: {
    common: "w-2 h-2 rounded-full border-2 border-white",
    input: "bg-blue-500",
    output: "bg-green-500",
    special: "bg-purple-500",
  },
}

