export enum LLMProviderName {
    AZURE_OPENAI = "azure-openai",
    ANTHROPIC = "anthropic",
    OPENAI = "openai",
}
export interface LLMProvider {
  name: LLMProviderName;
  getLLM(): any;
  getEmbedding(): any;
}