import { Anthropic } from "@llamaindex/anthropic";
import { LLMProvider, LLMProviderName } from "./LLMProvider.interface";

class AnthropicProvider implements LLMProvider {
  name: LLMProviderName = LLMProviderName.ANTHROPIC;
  private llm: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.llm = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: "claude-3-opus-20240229",
      });
    }
  }

  getLLM() {
    if (!this.llm) {
      throw new Error("Anthropic provider not configured");
    }
    return this.llm;
  }

  getEmbedding() {
    throw new Error("Anthropic embeddings not yet implemented");
  }
}

export default AnthropicProvider;
