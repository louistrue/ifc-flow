/**
 * Hook for managing node execution state
 */

import { useState, useCallback } from 'react'

export interface ExecutionState {
  isLoading: boolean
  error: string | null
  result: any
  progress: { percentage: number; message?: string } | null
}

export function useNodeExecution(initialState?: Partial<ExecutionState>) {
  const [state, setState] = useState<ExecutionState>({
    isLoading: false,
    error: null,
    result: null,
    progress: null,
    ...initialState,
  })

  const startExecution = useCallback(() => {
    setState({
      isLoading: true,
      error: null,
      result: null,
      progress: { percentage: 0, message: 'Starting...' },
    })
  }, [])

  const updateProgress = useCallback((percentage: number, message?: string) => {
    setState((prev) => ({
      ...prev,
      progress: { percentage, message },
    }))
  }, [])

  const completeExecution = useCallback((result: any) => {
    setState({
      isLoading: false,
      error: null,
      result,
      progress: { percentage: 100, message: 'Complete' },
    })
  }, [])

  const failExecution = useCallback((error: string) => {
    setState({
      isLoading: false,
      error,
      result: null,
      progress: null,
    })
  }, [])

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      result: null,
      progress: null,
    })
  }, [])

  return {
    ...state,
    startExecution,
    updateProgress,
    completeExecution,
    failExecution,
    reset,
  }
}

