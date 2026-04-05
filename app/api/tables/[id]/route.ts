import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
    const { number, seats, x, y, active } = await request.json();

    const table = await prisma.table.update({
      where: { id },
      data: {
        ...(number !== undefined && { number }),
        ...(seats !== undefined && { seats }),
        ...(x !== undefined && { x }),
        ...(y !== undefined && { y }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json({ table }, { status: 200 });
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

    await prisma.table.delete({
      where: { id },
    });

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
