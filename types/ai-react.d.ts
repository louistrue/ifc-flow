declare module 'ai/react' {
  export interface UseChatOptions {
    api?: string;
    body?: any;
    initialMessages?: { id: string; role: string; content: string }[];
  }
  export interface UseChatReturn {
    messages: { id: string; role: string; content: string }[];
    input: string;
    handleInputChange: (event: any) => void;
    handleSubmit: (event: any) => void;
    isLoading: boolean;
  }
  export function useChat(options?: UseChatOptions): UseChatReturn;
}
