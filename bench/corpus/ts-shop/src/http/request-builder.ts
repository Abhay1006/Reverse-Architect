export interface HttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
}

export class RequestBuilder {
  private url = '/';
  private method = 'GET';
  private headers: Record<string, string> = {};

  withUrl(url: string): this {
    this.url = url;
    return this;
  }
  withMethod(method: string): this {
    this.method = method;
    return this;
  }
  withHeader(name: string, value: string): this {
    this.headers[name] = value;
    return this;
  }
  build(): HttpRequest {
    return { url: this.url, method: this.method, headers: this.headers };
  }
}
