import { OpenAI } from 'openai'
import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
} from 'openai/resources'
import { z } from 'zod'

export const MessageRoleSchema = z.enum([
  'system',
  'user',
  'assistant',
  'function',
  'tool',
])

export const ChatMessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string().nullable(),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
})

export const ToolParameterSchema = z.record(z.any())

export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
})

export const ToolResponseSchema = z.object({
  toolCallId: z.string(),
  role: z.literal('tool'),
  content: z.string(),
})

export type MessageRole = z.infer<typeof MessageRoleSchema>
export type ChatMessage = z.infer<typeof ChatMessageSchema>
export type ToolCall = z.infer<typeof ToolCallSchema>
export type ToolResponse = z.infer<typeof ToolResponseSchema>

export interface OpenAiClientConfig {
  model: string
  temperature?: number
  maxTokens?: number
  tools?: ChatCompletionCreateParams['tools']
  toolChoice?: ChatCompletionCreateParams['tool_choice']
  apiKey?: string
  apiBase?: string
}

export interface OpenAiResponse {
  id: string
  choices: {
    index: number
    message: ChatCompletionMessageParam & {
      // biome-ignore lint/style/useNamingConvention: Matching the snake_case from the OpenAi lib
      tool_calls?: ToolCall[]
    }
    // biome-ignore lint/style/useNamingConvention: Matching the snake_case from the OpenAi lib
    finish_reason:
      | 'stop'
      | 'length'
      | 'tool_calls'
      | 'content_filter'
      | 'function_call'
  }[]
  usage: {
    // biome-ignore lint/style/useNamingConvention: Matching the snake_case from the OpenAi lib
    prompt_tokens: number
    // biome-ignore lint/style/useNamingConvention: Matching the snake_case from the OpenAi lib
    completion_tokens: number
    // biome-ignore lint/style/useNamingConvention: Matching the snake_case from the OpenAi lib
    total_tokens: number
  }
}

export class OpenAiClient {
  private model: string
  private temperature: number
  private maxTokens?: number
  private messages: ChatCompletionMessageParam[] = []
  private tools?: ChatCompletionCreateParams['tools']
  private toolChoice?: ChatCompletionCreateParams['tool_choice']
  private client: OpenAI

  constructor(config: OpenAiClientConfig) {
    this.model = config.model
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens
    this.tools = config.tools
    this.toolChoice = config.toolChoice

    this.client = new OpenAI({
      // biome-ignore lint/style/useNamingConvention: Matching the snake_case from the OpenAi lib
      baseURL: config.apiBase || process.env.OPENAI_API_BASE_URL,
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
    })
  }

  addSystemMessage(content: string): this {
    const message: ChatCompletionMessageParam = { role: 'system', content }

    const validationMsg = {
      role: message.role,
      content,
      toolCallId: undefined,
    }
    ChatMessageSchema.parse(validationMsg)

    this.messages.push(message)
    return this
  }

  addUserMessage(content: string): this {
    const message: ChatCompletionMessageParam = { role: 'user', content }

    const validationMsg = {
      role: message.role,
      content,
      toolCallId: undefined,
    }
    ChatMessageSchema.parse(validationMsg)

    this.messages.push(message)
    return this
  }

  addAssistantMessage(content: string): this {
    const message: ChatCompletionMessageParam = { role: 'assistant', content }

    const validationMsg = {
      role: message.role,
      content,
      toolCallId: undefined,
    }
    ChatMessageSchema.parse(validationMsg)

    this.messages.push(message)
    return this
  }

  addToolResponse(toolCallId: string, content: string): this {
    const message: ChatCompletionMessageParam = {
      role: 'tool',
      content,
      // biome-ignore lint/style/useNamingConvention: Matching the snake_case from the OpenAi lib
      tool_call_id: toolCallId,
    }

    const validationMsg = {
      role: message.role,
      content,
      toolCallId,
    }
    ChatMessageSchema.parse(validationMsg)

    this.messages.push(message)
    return this
  }

  addMessages(messages: ChatMessage[]): this {
    for (const message of messages) {
      ChatMessageSchema.parse(message)

      const messageContent = message.content ?? ''

      let openaiMessage: ChatCompletionMessageParam

      switch (message.role) {
        case 'function':
          if (!message.name) {
            throw new Error('Function messages require a name')
          }
          openaiMessage = {
            role: 'function',
            content: messageContent,
            name: message.name,
          }
          break

        case 'tool':
          if (!message.toolCallId) {
            throw new Error('Tool messages require a toolCallId')
          }
          openaiMessage = {
            role: 'tool',
            content: messageContent,
            // biome-ignore lint/style/useNamingConvention: Matching the snake_case from the OpenAi lib
            tool_call_id: message.toolCallId,
          }
          break

        case 'system':
          openaiMessage = {
            role: 'system',
            content: messageContent,
            ...(message.name && { name: message.name }),
          }
          break

        case 'user':
          openaiMessage = {
            role: 'user',
            content: messageContent,
            ...(message.name && { name: message.name }),
          }
          break

        case 'assistant':
          openaiMessage = {
            role: 'assistant',
            content: messageContent,
            ...(message.name && { name: message.name }),
          }
          break

        default:
          throw new Error(`Unsupported message role: ${message.role}`)
      }

      this.messages.push(openaiMessage)
    }

    return this
  }

  async send(): Promise<OpenAiResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.messages,
      temperature: this.temperature,
      // biome-ignore lint/style/useNamingConvention: Matching the snake_case from the OpenAi lib
      max_tokens: this.maxTokens,
      tools: this.tools,
      // biome-ignore lint/style/useNamingConvention: Matching the snake_case from the OpenAi lib
      tool_choice: this.toolChoice,
    })

    return response as unknown as OpenAiResponse
  }

  async stream() {
    return this.client.chat.completions.create({
      model: this.model,
      messages: this.messages,
      temperature: this.temperature,
      // biome-ignore lint/style/useNamingConvention: Matching the snake_case from the OpenAi lib
      max_tokens: this.maxTokens,
      tools: this.tools,
      // biome-ignore lint/style/useNamingConvention: Matching the snake_case from the OpenAi lib
      tool_choice: this.toolChoice,
      stream: true,
    })
  }

  static async handleToolCall<T extends z.ZodType, R>(
    toolCall: ToolCall,
    argsSchema: T,
    responseFn: (args: z.infer<T>) => Promise<R>
  ): Promise<ToolResponse> {
    const parsedArgs = argsSchema.parse(JSON.parse(toolCall.function.arguments))

    const result = await responseFn(parsedArgs)

    const response: ToolResponse = {
      toolCallId: toolCall.id,
      role: 'tool',
      content: JSON.stringify(result),
    }

    return ToolResponseSchema.parse(response)
  }

  getMessages(): ChatCompletionMessageParam[] {
    return [...this.messages]
  }

  resetMessages(): this {
    this.messages = []
    return this
  }

  setTools(tools: ChatCompletionCreateParams['tools']): this {
    this.tools = tools
    return this
  }

  getTools(): ChatCompletionCreateParams['tools'] {
    return this.tools
  }

  setToolChoice(toolChoice: ChatCompletionCreateParams['tool_choice']): this {
    this.toolChoice = toolChoice
    return this
  }

  getToolChoice(): ChatCompletionCreateParams['tool_choice'] {
    return this.toolChoice
  }
}

export function createOpenAiClient(config: OpenAiClientConfig): OpenAiClient {
  return new OpenAiClient(config)
}
