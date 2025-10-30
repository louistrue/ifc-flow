/**
 * Hook for managing node progress messages
 */

import { useState, useCallback } from 'react'

export function useNodeProgress() {
  const [messages, setMessages] = useState<string[]>([])
  const [percentage, setPercentage] = useState(0)

  const addMessage = useCallback((message: string) => {
    setMessages((prev) => [...prev, message].slice(-10)) // Keep last 10 messages
  }, [])

  const updatePercentage = useCallback((percent: number) => {
    setPercentage(percent)
  }, [])

  const clear = useCallback(() => {
    setMessages([])
    setPercentage(0)
  }, [])

  return {
    messages,
    percentage,
    addMessage,
    updatePercentage,
    clear,
  }
}

