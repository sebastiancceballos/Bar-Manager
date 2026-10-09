import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { apiT } from "@/lib/api-i18n";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "owner") {
      return NextResponse.json({ error: apiT(request, "apiOnlySuperadmin") }, { status: 403 });
    }
    const { id } = await params;
    const orgId = parseInt(id, 10);
    const body = await request.json();
    const { name, status } = body;

    if (status && !["active", "suspended"].includes(status)) {
      return NextResponse.json({ error: apiT(request, "apiInvalidStatusActiveSuspended") }, { status: 400 });
    }

    if (name != null && String(name).trim()) {
      await sql`
        UPDATE organizations SET name = ${String(name).trim()}, updated_at = NOW()
        WHERE id = ${orgId}
      `;
    }
    if (status) {
      await sql`
        UPDATE organizations SET status = ${status}, updated_at = NOW()
        WHERE id = ${orgId}
      `;
      if (status === "suspended") {
        try {
          await sql`UPDATE locations SET active = false WHERE organization_id = ${orgId}`;
        } catch { /* active column may not exist */ }
      } else if (status === "active") {
        try {
          await sql`UPDATE locations SET active = true WHERE organization_id = ${orgId}`;
        } catch { /* ignore */ }
      }
    }

    const rows = await sql`SELECT * FROM organizations WHERE id = ${orgId}`;
    if (!rows[0]) return NextResponse.json({ error: apiT(request, "apiNotFoundFem") }, { status: 404 });
    return NextResponse.json({ organization: rows[0] }, { status: 200 });
  } catch (error) {
    console.error("PATCH org:", error);
    return NextResponse.json({ error: apiT(request, "apiInternalError") }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "owner") {
      return NextResponse.json({ error: apiT(request, "apiOnlySuperadmin") }, { status: 403 });
    }
    const { id } = await params;
    const orgId = parseInt(id, 10);

    const locs = await sql`SELECT COUNT(*)::int AS c FROM locations WHERE organization_id = ${orgId}`;
    if ((locs[0]?.c || 0) > 0) {
      return NextResponse.json(
        { error: apiT(request, "apiHasLocationsSuspendFirst") },
        { status: 409 }
      );
    }

    await sql`DELETE FROM organizations WHERE id = ${orgId}`;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE org:", error);
    return NextResponse.json({ error: apiT(request, "apiInternalError") }, { status: 500 });
  }
}
