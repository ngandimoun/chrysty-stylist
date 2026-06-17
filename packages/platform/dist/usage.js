import { platformFetch } from "./client.js";
export const usage = {
    track: (event) => platformFetch("/usage/track", {
        method: "POST",
        body: JSON.stringify(event),
    }),
    getSummary: (params) => {
        const search = new URLSearchParams();
        if (params === null || params === void 0 ? void 0 : params.workerSlug)
            search.set("workerSlug", params.workerSlug);
        if (params === null || params === void 0 ? void 0 : params.period)
            search.set("period", params.period);
        const query = search.toString();
        return platformFetch(`/usage${query ? `?${query}` : ""}`);
    },
};
