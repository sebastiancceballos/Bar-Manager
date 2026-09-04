import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { resolveLocationId } from "@/lib/org";
import { toErrorResponse } from "@/lib/errors";
import {
  reportOrgSummary,
  reportByWaiter,
  reportTopProducts,
  reportByPaymentMethod,
  reportByOrderType,
  reportTimeseries,
} from "@/lib/services/reports-handlers";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "week";
    const type = searchParams.get("type") || "timeseries";

    const locId = await resolveLocationId(user.id, user.role);
    if (!locId) {
      return NextResponse.json({ error: "Sin bar asignado" }, { status: 400 });
    }

    if (type === "org_summary") {
      const result = await reportOrgSummary(locId, range);
      if ("error" in result && result.error) {
        return NextResponse.json({ error: result.error }, { status: result.status || 400 });
      }
      return NextResponse.json((result as { data: unknown }).data, { status: 200 });
    }

    if (type === "by-waiter") {
      return NextResponse.json(await reportByWaiter(locId, range), { status: 200 });
    }
    if (type === "top-products") {
      return NextResponse.json(await reportTopProducts(locId, range), { status: 200 });
    }
    if (type === "by-payment-method") {
      return NextResponse.json(await reportByPaymentMethod(locId, range), { status: 200 });
    }
    if (type === "by-order-type") {
      return NextResponse.json(await reportByOrderType(locId, range), { status: 200 });
    }

    // default timeseries
    return NextResponse.json(await reportTimeseries(locId, range), { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
