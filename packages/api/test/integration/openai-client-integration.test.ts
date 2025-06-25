import { describe, it, expect, beforeAll } from 'vitest'
import { z } from 'zod'
import {
  OpenAiClient,
  createOpenAiClient,
  MessageRoleSchema,
  ChatMessageSchema,
  ToolCallSchema,
  ToolResponseSchema,
  type ChatMessage,
  type ToolCall,
  type OpenAiClientConfig,
} from '../../src/core/openai-client'

describe('OpenAI Client Integration Tests', () => {
  let client: OpenAiClient
  const testModel = 'meta-llama/llama-3.1-8b-instruct'

  beforeAll(() => {
    // Ensure we have the required environment variable
    if (!process.env.OPENROUTER_KEY) {
      throw new Error('OPENROUTER_KEY environment variable is required for integration tests')
    }

    const config: OpenAiClientConfig = {
      model: testModel,
      temperature: 0.3,
      maxTokens: 500,
      apiKey: process.env.OPENROUTER_KEY,
      apiBase: 'https://openrouter.ai/api/v1',
    }

    client = createOpenAiClient(config)
  })

  describe('Schema Validation', () => {
    it('should validate message roles correctly', () => {
      expect(() => MessageRoleSchema.parse('system')).not.toThrow()
      expect(() => MessageRoleSchema.parse('user')).not.toThrow()
      expect(() => MessageRoleSchema.parse('assistant')).not.toThrow()
      expect(() => MessageRoleSchema.parse('function')).not.toThrow()
      expect(() => MessageRoleSchema.parse('tool')).not.toThrow()
      expect(() => MessageRoleSchema.parse('invalid')).toThrow()
    })

    it('should validate chat messages correctly', () => {
      const validMessage = {
        role: 'user' as const,
        content: 'Hello, world!',
      }
      expect(() => ChatMessageSchema.parse(validMessage)).not.toThrow()

      const invalidMessage = {
        role: 'invalid',
        content: 'Hello, world!',
      }
      expect(() => ChatMessageSchema.parse(invalidMessage)).toThrow()
    })

    it('should validate tool calls correctly', () => {
      const validToolCall = {
        id: 'call_123',
        type: 'function' as const,
        function: {
          name: 'test_function',
          arguments: '{"param": "value"}',
        },
      }
      expect(() => ToolCallSchema.parse(validToolCall)).not.toThrow()

      const invalidToolCall = {
        id: 'call_123',
        type: 'invalid',
        function: {
          name: 'test_function',
          arguments: '{"param": "value"}',
        },
      }
      expect(() => ToolCallSchema.parse(invalidToolCall)).toThrow()
    })

    it('should validate tool responses correctly', () => {
      const validResponse = {
        toolCallId: 'call_123',
        role: 'tool' as const,
        content: '{"result": "success"}',
      }
      expect(() => ToolResponseSchema.parse(validResponse)).not.toThrow()

      const invalidResponse = {
        toolCallId: 'call_123',
        role: 'invalid',
        content: '{"result": "success"}',
      }
      expect(() => ToolResponseSchema.parse(invalidResponse)).toThrow()
    })
  })

  describe('Message Management', () => {
    it('should add system messages correctly', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      testClient.addSystemMessage('You are a helpful assistant.')
      const messages = testClient.getMessages()
      
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.',
      })
    })

    it('should add user messages correctly', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      testClient.addUserMessage('Hello, how are you?')
      const messages = testClient.getMessages()
      
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: 'user',
        content: 'Hello, how are you?',
      })
    })

    it('should add assistant messages correctly', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      testClient.addAssistantMessage('I am doing well, thank you!')
      const messages = testClient.getMessages()
      
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: 'assistant',
        content: 'I am doing well, thank you!',
      })
    })

    it('should add tool responses correctly', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      testClient.addToolResponse('call_123', '{"status": "completed"}')
      const messages = testClient.getMessages()
      
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: 'tool',
        content: '{"status": "completed"}',
        // biome-ignore lint/style/useNamingConvention: Matching OpenAI API format
        tool_call_id: 'call_123',
      })
    })

    it('should chain message additions fluently', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      testClient
        .addSystemMessage('You are a helpful assistant.')
        .addUserMessage('What is 2+2?')
        .addAssistantMessage('2+2 equals 4.')

      const messages = testClient.getMessages()
      expect(messages).toHaveLength(3)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
      expect(messages[2].role).toBe('assistant')
    })

    it('should add multiple messages at once', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      const messagesToAdd: ChatMessage[] = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ]

      testClient.addMessages(messagesToAdd)
      const messages = testClient.getMessages()
      
      expect(messages).toHaveLength(3)
      expect(messages[0].content).toBe('You are helpful.')
      expect(messages[1].content).toBe('Hello!')
      expect(messages[2].content).toBe('Hi there!')
    })

    it('should handle function messages with names', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      const functionMessage: ChatMessage = {
        role: 'function',
        content: '{"result": "processed"}',
        name: 'process_data',
      }

      testClient.addMessages([functionMessage])
      const messages = testClient.getMessages()
      
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: 'function',
        content: '{"result": "processed"}',
        name: 'process_data',
      })
    })

    it('should handle tool messages with toolCallId', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      const toolMessage: ChatMessage = {
        role: 'tool',
        content: '{"output": "done"}',
        toolCallId: 'call_456',
      }

      testClient.addMessages([toolMessage])
      const messages = testClient.getMessages()
      
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual({
        role: 'tool',
        content: '{"output": "done"}',
        // biome-ignore lint/style/useNamingConvention: Matching OpenAI API format
        tool_call_id: 'call_456',
      })
    })

    it('should throw error for function messages without name', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      const invalidFunctionMessage: ChatMessage = {
        role: 'function',
        content: '{"result": "processed"}',
      }

      expect(() => testClient.addMessages([invalidFunctionMessage])).toThrow(
        'Function messages require a name'
      )
    })

    it('should throw error for tool messages without toolCallId', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      const invalidToolMessage: ChatMessage = {
        role: 'tool',
        content: '{"output": "done"}',
      }

      expect(() => testClient.addMessages([invalidToolMessage])).toThrow(
        'Tool messages require a toolCallId'
      )
    })

    it('should reset messages correctly', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      testClient
        .addSystemMessage('System message')
        .addUserMessage('User message')

      expect(testClient.getMessages()).toHaveLength(2)
      
      testClient.resetMessages()
      expect(testClient.getMessages()).toHaveLength(0)
    })
  })

  describe('Tool Configuration', () => {
    it('should set and get tools correctly', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get weather information',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        },
      ]

      testClient.setTools(tools)
      expect(testClient.getTools()).toEqual(tools)
    })

    it('should set and get tool choice correctly', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      testClient.setToolChoice('auto')
      expect(testClient.getToolChoice()).toBe('auto')

      testClient.setToolChoice('none')
      expect(testClient.getToolChoice()).toBe('none')

      const specificChoice = {
        type: 'function' as const,
        function: { name: 'get_weather' },
      }
      testClient.setToolChoice(specificChoice)
      expect(testClient.getToolChoice()).toEqual(specificChoice)
    })
  })

  describe('Tool Call Handling', () => {
    it('should handle tool calls with schema validation', async () => {
      const mockToolCall: ToolCall = {
        id: 'call_test_123',
        type: 'function',
        function: {
          name: 'add_numbers',
          arguments: '{"a": 5, "b": 3}',
        },
      }

      const argsSchema = z.object({
        a: z.number(),
        b: z.number(),
      })

      const responseFn = async (args: { a: number; b: number }) => {
        return { result: args.a + args.b }
      }

      const toolResponse = await OpenAiClient.handleToolCall(
        mockToolCall,
        argsSchema,
        responseFn
      )

      expect(toolResponse).toEqual({
        toolCallId: 'call_test_123',
        role: 'tool',
        content: '{"result":8}',
      })
    })

    it('should validate tool call arguments against schema', async () => {
      const mockToolCall: ToolCall = {
        id: 'call_test_456',
        type: 'function',
        function: {
          name: 'add_numbers',
          arguments: '{"a": "not_a_number", "b": 3}', // Invalid: a should be number
        },
      }

      const argsSchema = z.object({
        a: z.number(),
        b: z.number(),
      })

      const responseFn = async (args: { a: number; b: number }) => {
        return { result: args.a + args.b }
      }

      await expect(
        OpenAiClient.handleToolCall(mockToolCall, argsSchema, responseFn)
      ).rejects.toThrow()
    })
  })

  describe('API Integration', () => {
    it('should successfully send a simple chat completion request', async () => {
      client
        .resetMessages()
        .addSystemMessage('You are a helpful assistant that responds concisely.')
        .addUserMessage('What is 2+2? Respond with just the number.')

      const response = await client.send()

      expect(response).toBeDefined()
      expect(response.id).toBeDefined()
      expect(response.choices).toBeDefined()
      expect(response.choices.length).toBeGreaterThan(0)
      expect(response.choices[0].message).toBeDefined()
      expect(response.choices[0].message.role).toBe('assistant')
      expect(response.choices[0].message.content).toBeDefined()
      expect(response.usage).toBeDefined()
      expect(response.usage.total_tokens).toBeGreaterThan(0)

      // Verify the response contains something about 4
      const content = response.choices[0].message.content as string
      expect(content.toLowerCase()).toMatch(/4/)
    }, 30000) // 30 second timeout for API calls

    it('should handle conversation context correctly', async () => {
      client
        .resetMessages()
        .addSystemMessage('You are a helpful assistant.')
        .addUserMessage('My name is John.')
        .addAssistantMessage('Nice to meet you, John!')
        .addUserMessage('What is my name?')

      const response = await client.send()

      expect(response.choices[0].message.content).toBeDefined()
      const content = response.choices[0].message.content as string
      expect(content.toLowerCase()).toMatch(/john/)
    }, 30000)

    it('should respect temperature and max_tokens settings', async () => {
      const lowTempClient = createOpenAiClient({
        model: testModel,
        temperature: 0.1,
        maxTokens: 50,
        apiKey: process.env.OPENROUTER_KEY || '',
        apiBase: 'https://openrouter.ai/api/v1',
      })

      lowTempClient
        .addSystemMessage('You are a helpful assistant.')
        .addUserMessage('Tell me about artificial intelligence in exactly 3 words.')

      const response = await lowTempClient.send()

      expect(response.choices[0].message.content).toBeDefined()
      expect(response.usage.total_tokens).toBeLessThanOrEqual(100) // Should be well under max_tokens + prompt
    }, 30000)

    it('should handle streaming responses', async () => {
      client
        .resetMessages()
        .addSystemMessage('You are a helpful assistant.')
        .addUserMessage('Count from 1 to 5.')

      const stream = await client.stream()

      expect(stream).toBeDefined()

      // Collect streaming chunks
      const chunks: string[] = []
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) {
          chunks.push(content)
        }
      }

      expect(chunks.length).toBeGreaterThan(0)
      const fullContent = chunks.join('')
      expect(fullContent).toBeTruthy()
    }, 30000)

    it('should work with tools/function calling', async () => {
      const weatherTool = {
        type: 'function' as const,
        function: {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA',
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'The temperature unit to use',
              },
            },
            required: ['location'],
          },
        },
      }

      const toolClient = createOpenAiClient({
        model: testModel,
        temperature: 0.3,
        tools: [weatherTool],
        toolChoice: 'auto',
        apiKey: process.env.OPENROUTER_KEY || '',
        apiBase: 'https://openrouter.ai/api/v1',
      })

      toolClient
        .addSystemMessage('You are a helpful assistant that can check weather.')
        .addUserMessage('What is the weather like in San Francisco?')

      const response = await toolClient.send()

      expect(response.choices[0]).toBeDefined()
      
      // The model might or might not use the tool, but the response should be valid
      if (response.choices[0].finish_reason === 'tool_calls') {
        expect(response.choices[0].message.tool_calls).toBeDefined()
        expect(response.choices[0].message.tool_calls?.length).toBeGreaterThan(0)
        
        const toolCall = response.choices[0].message.tool_calls?.[0]
        if (!toolCall) throw new Error('Expected tool call')
        expect(toolCall.function.name).toBe('get_weather')
        expect(toolCall.function.arguments).toBeDefined()
        
        // Parse arguments to ensure they're valid JSON
        const args = JSON.parse(toolCall.function.arguments)
        expect(args.location).toBeDefined()
      } else {
        // If no tool was called, should still have a valid response
        expect(response.choices[0].message.content).toBeDefined()
      }
    }, 30000)
  })

  describe('Error Handling', () => {
    it('should handle invalid API key gracefully', async () => {
      const invalidClient = createOpenAiClient({
        model: testModel,
        apiKey: 'invalid-key',
        apiBase: 'https://openrouter.ai/api/v1',
      })

      invalidClient.addUserMessage('Hello')

      await expect(invalidClient.send()).rejects.toThrow()
    }, 10000)

    it('should handle invalid model gracefully', async () => {
      const invalidModelClient = createOpenAiClient({
        model: 'non-existent-model',
        apiKey: process.env.OPENROUTER_KEY || '',
        apiBase: 'https://openrouter.ai/api/v1',
      })

      invalidModelClient.addUserMessage('Hello')

      await expect(invalidModelClient.send()).rejects.toThrow()
    }, 10000)

    it('should handle network errors gracefully', async () => {
      const unreachableClient = createOpenAiClient({
        model: testModel,
        apiKey: process.env.OPENROUTER_KEY || '',
        apiBase: 'https://invalid-endpoint-that-does-not-exist.com/v1',
      })

      unreachableClient.addUserMessage('Hello')

      await expect(unreachableClient.send()).rejects.toThrow()
    }, 10000)

    it('should validate message schema and throw on invalid data', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      expect(() => {
        testClient.addMessages([
          {
            // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input
        role: 'invalid_role' as any,
            content: 'This should fail',
          },
        ])
      }).toThrow()
    })

    it('should throw error for unsupported message role in addMessages switch default', () => {
      const testClient = createOpenAiClient({
        model: testModel,
        apiKey: 'test-key',
      })

      // Create a message that passes Zod validation but triggers the switch default case
      const messageWithUnsupportedRole = {
        // biome-ignore lint/suspicious/noExplicitAny: Testing unsupported role type
        role: 'unsupported' as any,
        content: 'This should trigger the default case',
      }

      // Temporarily mock ChatMessageSchema.parse to allow the unsupported role through
      const originalParse = ChatMessageSchema.parse
      // biome-ignore lint/suspicious/noExplicitAny: Mocking for test
      ChatMessageSchema.parse = () => messageWithUnsupportedRole as any

      try {
        expect(() => {
          testClient.addMessages([messageWithUnsupportedRole])
        }).toThrow('Unsupported message role: unsupported')
      } finally {
        // Restore original parse method
        ChatMessageSchema.parse = originalParse
      }
    })
  })
})