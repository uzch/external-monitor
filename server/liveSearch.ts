export interface LiveSearchResult {
  title: string;
  url: string;
  publisher?: string;
  publicationDate?: string;
  snippet: string;
}

export interface LiveSearchProvider {
  isConfigured(): boolean;
  search(query: string): Promise<LiveSearchResult[]>;
  unavailableMessage(): string;
}

export class UnconfiguredLiveSearchProvider implements LiveSearchProvider {
  isConfigured(): boolean {
    return false;
  }

  async search(): Promise<LiveSearchResult[]> {
    throw new Error(this.unavailableMessage());
  }

  unavailableMessage(): string {
    return "Live public-web search is not configured. An approved search service must provide public URLs, publisher and date metadata, citations, authentication, quota, and outbound-access approval.";
  }
}
