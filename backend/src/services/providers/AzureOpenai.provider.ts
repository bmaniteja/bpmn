import { AzureOpenAI } from "@llamaindex/azure";
import { LLMProvider, LLMProviderName } from "./LLMProvider.interface";

class AzureOpenAIProvider implements LLMProvider {
  name: LLMProviderName = LLMProviderName.AZURE_OPENAI;
  private llm: AzureOpenAI;
  private embedding: any;

  constructor() {
    this.llm = new AzureOpenAI({
      model: process.env.MODEL!,
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION!
    });

    this.embedding = new AzureOpenAI({
      model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
    });
  }

  getLLM() {
    return this.llm;
  }

  getEmbedding() {
    return this.embedding;
  }
}

export default AzureOpenAIProvider;
