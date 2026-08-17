import { getAuth } from "../../../../lib/auth/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

function unavailable(): Response {
  return Response.json(
    { error: "Authentication is temporarily unavailable." },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}

async function isSelfRegistration(context: RouteContext) {
  const { path } = await context.params;
  return path[0] === "sign-up";
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await getAuth();
  return auth ? auth.handler().GET(request, context) : unavailable();
}

export async function POST(request: Request, context: RouteContext) {
  if (await isSelfRegistration(context)) {
    return Response.json(
      { error: "Self-registration is currently disabled." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
  const auth = await getAuth();
  return auth ? auth.handler().POST(request, context) : unavailable();
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await getAuth();
  return auth ? auth.handler().PUT(request, context) : unavailable();
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getAuth();
  return auth ? auth.handler().PATCH(request, context) : unavailable();
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await getAuth();
  return auth ? auth.handler().DELETE(request, context) : unavailable();
}
