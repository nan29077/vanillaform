const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.EXTERNAL_INTEGRATIONS_ENABLED === "true") return;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input, init) => {
    const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    let url: URL;

    try {
      url = new URL(rawUrl, process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3026");
    } catch {
      throw new Error(`[바닐라폼 안전 차단] 해석할 수 없는 외부 요청: ${rawUrl}`);
    }

    if (!LOCAL_HOSTS.has(url.hostname)) {
      throw new Error(
        `[바닐라폼 안전 차단] EXTERNAL_INTEGRATIONS_ENABLED=false 상태에서는 외부 요청(${url.hostname})을 보낼 수 없습니다.`,
      );
    }

    return originalFetch(input, init);
  };
}
