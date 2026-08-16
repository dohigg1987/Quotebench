import { getAuth } from "../../../../lib/auth/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

function unavailable(): Response {
  return Response.json(
    { error: "Authentication is temporarily unavailable." },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: Request, context: RouteContext) {
  const auth = getAuth();
  return auth ? auth.handler().GET(request, context) : unavailable();
}

export async function POST(request: Request, context: RouteContext) {
  const auth = getAuth();
  return auth ? auth.handler().POST(request, context) : unavailable();
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = getAuth();
  return auth ? auth.handler().PUT(request, context) : unavailable();
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = getAuth();
  return auth ? auth.handler().PATCH(request, context) : unavailable();
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = getAuth();
  return auth ? auth.handler().DELETE(request, context) : unavailable();
}
