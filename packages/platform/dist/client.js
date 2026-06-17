let clientConfig = {
    credentials: "include",
};
export function configurePlatform(config) {
    clientConfig = Object.assign(Object.assign({}, clientConfig), config);
}
function getApiUrl() {
    var _a, _b;
    const apiUrl = (_b = (_a = clientConfig.apiUrl) !== null && _a !== void 0 ? _a : (typeof process !== "undefined"
        ? process.env.CHYSTY_API_URL
        : undefined)) !== null && _b !== void 0 ? _b : (typeof process !== "undefined"
        ? process.env.NEXT_PUBLIC_CHRYSTY_API_URL
        : undefined);
    if (!apiUrl) {
        throw new Error("CHRYSTY_API_URL is not configured. Call configurePlatform({ apiUrl }) first.");
    }
    return apiUrl.replace(/\/$/, "");
}
async function resolveAuthHeader() {
    if (!clientConfig.getAccessToken)
        return {};
    const token = await clientConfig.getAccessToken();
    if (!token)
        return {};
    return { Authorization: `Bearer ${token}` };
}
export async function platformFetch(path, init = {}) {
    var _a, _b;
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    const authHeader = await resolveAuthHeader();
    Object.entries(authHeader).forEach(([key, value]) => {
        headers.set(key, value);
    });
    const response = await fetch(`${getApiUrl()}${path}`, Object.assign(Object.assign({}, init), { headers, credentials: (_a = clientConfig.credentials) !== null && _a !== void 0 ? _a : "include" }));
    const data = await response.json();
    if (!response.ok) {
        const apiError = data;
        const message = ((_b = apiError.error) === null || _b === void 0 ? void 0 : _b.message)
            ? apiError.error.message
            : `Platform API error (${response.status})`;
        throw new Error(message);
    }
    return data;
}
