import { NextResponse } from "next/server";

/** Errores de negocio → HTTP (Fase 6) */
export class AppError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export class InsufficientStockError extends AppError {
  constructor(message = "Stock insuficiente", public productName?: string) {
    super(message, 400, "INSUFFICIENT_STOCK");
    this.name = "InsufficientStockError";
  }
}

export class TenantMismatchError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404, "TENANT_MISMATCH");
    this.name = "TenantMismatchError";
  }
}

export class InvalidDiscountError extends AppError {
  constructor(message = "Descuento inválido") {
    super(message, 400, "INVALID_DISCOUNT");
    this.name = "InvalidDiscountError";
  }
}

export class ForbiddenActionError extends AppError {
  constructor(message = "Sin permiso") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenActionError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }
  console.error("Unhandled error:", error);
  return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
}
