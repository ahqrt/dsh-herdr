export interface SocketRequestOptions {
    timeoutMs?: number;
    signal?: AbortSignal;
}
export declare class HerdrSocketClient {
    private readonly socketPath;
    constructor(socketPath: string);
    /** One request; resolves with the command's `result` object. */
    request<T = unknown>(method: string, params?: Record<string, unknown>, options?: SocketRequestOptions): Promise<T>;
    close(): void;
}
//# sourceMappingURL=socket-client.d.ts.map