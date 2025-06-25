import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenAiClient, createOpenAiClient, ChatMessageSchema, type ChatMessage } from '../../src/core/openai-client'

describe('OpenAI Client Unit Tests', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('Constructor environment variable fallbacks', () => {
    it('should use environment variables when config values are not provided', () => {
      // Set environment variables
      process.env.OPENAI_API_KEY = 'env-api-key'
      process.env.OPENAI_API_BASE_URL = 'https://env-base-url.com/v1'

      const client = createOpenAiClient({
        model: 'test-model',
        // Don't provide apiKey or apiBase to trigger env fallback
      })

      // We can't directly test the internal client config, but we can verify
      // the client was created successfully with env variables
      expect(client).toBeInstanceOf(OpenAiClient)
      expect(client.getMessages()).toEqual([])
    })

    it('should use config values over environment variables when provided', () => {
      // Set environment variables
      process.env.OPENAI_API_KEY = 'env-api-key'
      process.env.OPENAI_API_BASE_URL = 'https://env-base-url.com/v1'

      const client = createOpenAiClient({
        model: 'test-model',
        apiKey: 'config-api-key',
        apiBase: 'https://config-base-url.com/v1',
      })

      expect(client).toBeInstanceOf(OpenAiClient)
    })
  })

  describe('Messages with optional name field', () => {
    it('should handle system messages with name field in addMessages', () => {
      const client = createOpenAiClient({
        model: 'test-model',
        apiKey: 'test-key',
      })

      const messageWithName: ChatMessage = {
        role: 'system',
        content: 'You are a helpful assistant',
        name: 'system_assistant',
      }

      client.addMessages([messageWithName])
      const messages = client.getMessages()

      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant',
        name: 'system_assistant',
      })
    })

    it('should handle user messages with name field in addMessages', () => {
      const client = createOpenAiClient({
        model: 'test-model',
        apiKey: 'test-key',
      })

      const messageWithName: ChatMessage = {
        role: 'user',
        content: 'Hello, assistant!',
        name: 'john_doe',
      }

      client.addMessages([messageWithName])
      const messages = client.getMessages()

      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: 'user',
        content: 'Hello, assistant!',
        name: 'john_doe',
      })
    })

    it('should handle assistant messages with name field in addMessages', () => {
      const client = createOpenAiClient({
        model: 'test-model',
        apiKey: 'test-key',
      })

      const messageWithName: ChatMessage = {
        role: 'assistant',
        content: 'Hello, how can I help?',
        name: 'assistant_bot',
      }

      client.addMessages([messageWithName])
      const messages = client.getMessages()

      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: 'assistant',
        content: 'Hello, how can I help?',
        name: 'assistant_bot',
      })
    })

    it('should handle messages without name field (not include name property)', () => {
      const client = createOpenAiClient({
        model: 'test-model',
        apiKey: 'test-key',
      })

      const messagesWithoutName: ChatMessage[] = [
        { role: 'system', content: 'System message' },
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant message' },
      ]

      client.addMessages(messagesWithoutName)
      const messages = client.getMessages()

      expect(messages).toHaveLength(3)
      expect(messages[0]).toEqual({ role: 'system', content: 'System message' })
      expect(messages[1]).toEqual({ role: 'user', content: 'User message' })
      expect(messages[2]).toEqual({ role: 'assistant', content: 'Assistant message' })
      
      // Verify none of the messages have a name property
      for (const message of messages) {
        expect(message).not.toHaveProperty('name')
      }
    })

    it('should handle messages with null content', () => {
      const client = createOpenAiClient({
        model: 'test-model',
        apiKey: 'test-key',
      })

      const messageWithNullContent: ChatMessage = {
        role: 'user',
        content: null,
      }

      client.addMessages([messageWithNullContent])
      const messages = client.getMessages()

      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: 'user',
        content: '',
      })
    })
  })

  describe('addMessages error handling', () => {
    it('should throw error for unsupported message role in switch default case', () => {
      const client = createOpenAiClient({
        model: 'test-model',
        apiKey: 'test-key',
      })

      // Mock ChatMessageSchema.parse to allow an unsupported role through validation
      const mockParse = vi.fn().mockReturnValue({
        role: 'unsupported_role',
        content: 'test content',
      })
      
      const originalParse = ChatMessageSchema.parse
      ChatMessageSchema.parse = mockParse

      try {
        expect(() => {
          client.addMessages([
            {
              // biome-ignore lint/suspicious/noExplicitAny: Testing unsupported role
              role: 'unsupported_role' as any,
              content: 'test content',
            }
          ])
        }).toThrow('Unsupported message role: unsupported_role')
        
        expect(mockParse).toHaveBeenCalled()
      } finally {
        // Restore original parse function
        ChatMessageSchema.parse = originalParse
      }
    })
  })
})