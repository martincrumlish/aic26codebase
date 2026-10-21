// convex/http.ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { provisionWebhook } from "./provisionHttp";

const http = httpRouter();

// Convex Auth's routes (JWKS and OpenID discovery used to verify session tokens).
auth.addHttpRoutes(http);

// Inbound provisioning webhook (see provisionHttp.ts).
http.route({ path: "/provision", method: "POST", handler: provisionWebhook });

export default http;
