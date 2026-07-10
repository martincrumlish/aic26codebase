// convex/http.ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { provisionWebhook } from "./provisionHttp";

const http = httpRouter();

// Registers /api/auth/* (magic-link verify, etc.)
auth.addHttpRoutes(http);

// Inbound provisioning webhook (Task 5).
http.route({ path: "/provision", method: "POST", handler: provisionWebhook });

export default http;
