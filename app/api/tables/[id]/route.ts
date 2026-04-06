import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { table_number, capacity, x_position, y_position } = await request.json();

    const tables = await sql`
      UPDATE tables 
      SET 
        table_number = COALESCE(${table_number}, table_number),
        capacity = COALESCE(${capacity}, capacity),
        x_position = COALESCE(${x_position}, x_position),
        y_position = COALESCE(${y_position}, y_position),
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json({ table: tables[0] }, { status: 200 });
  } catch (error) {
    console.error("Update table error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { id } = await params;

    await sql`DELETE FROM tables WHERE id = ${parseInt(id)}`;

    return NextResponse.json(
      { message: "Table deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete table error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
