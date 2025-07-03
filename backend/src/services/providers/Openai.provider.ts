import { LLMProvider, LLMProviderName } from "./LLMProvider.interface";
import { OpenAI, OpenAIEmbedding } from '@llamaindex/openai'

class OpenAIProvider implements LLMProvider {
  name: LLMProviderName = LLMProviderName.OPENAI;
  private llm: OpenAI;
  private embedding: OpenAIEmbedding;

  constructor() {
    this.llm = new OpenAI({
      model: process.env.OPENAI_MODEL!,
      apiKey: process.env.OPENAI_API_KEY!,
    });
    this.embedding = new OpenAIEmbedding({
        model: process.env.OPENAI_EMBEDDING_MODEL!,
        apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  getLLM() {
    return this.llm;
  }

  getEmbedding() {
    return this.embedding;
  }
}

export default OpenAIProvider;
