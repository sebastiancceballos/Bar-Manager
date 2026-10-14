import { NextResponse } from "next/server";
import { apiTAsync, type ApiParams } from "@/lib/api-i18n";

/** Errores de negocio → HTTP (Fase 6) */
export class AppError extends Error {
  status: number;
  code: string;
  /** i18n key resolved against the requester's locale in toErrorResponse */
  key?: string;
  params?: ApiParams;
  constructor(
    message: string,
    status = 400,
    code = "APP_ERROR",
    key?: string,
    params?: ApiParams
  ) {
    super(message);
    this.key = key;
    this.params = params;
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export class InsufficientStockError extends AppError {
  constructor(
    message = "Stock insuficiente",
    public productName?: string,
    key = "apiInsufficientStock",
    params?: ApiParams
  ) {
    super(message, 400, "INSUFFICIENT_STOCK", key, params);
    this.name = "InsufficientStockError";
  }
}

export class TenantMismatchError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404, "TENANT_MISMATCH", "apiResourceNotFound");
    this.name = "TenantMismatchError";
  }
}

export class InvalidDiscountError extends AppError {
  constructor(message = "Descuento inválido", key = "apiInvalidDiscount") {
    super(message, 400, "INVALID_DISCOUNT", key);
    this.name = "InvalidDiscountError";
  }
}

export class ForbiddenActionError extends AppError {
  constructor(message = "Sin permiso", key = "apiNoPermission", params?: ApiParams) {
    super(message, 403, "FORBIDDEN", key, params);
    this.name = "ForbiddenActionError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, key?: string, params?: ApiParams) {
    super(message, 409, "CONFLICT", key, params);
    this.name = "ConflictError";
  }
}

export async function toErrorResponse(error: unknown): Promise<NextResponse> {
  if (error instanceof AppError) {
    const message = error.key
      ? await apiTAsync(error.key, error.params)
      : error.message;
    return NextResponse.json(
      { error: message, code: error.code },
      { status: error.status }
    );
  }
  console.error("Unhandled error:", error);
  return NextResponse.json(
    { error: await apiTAsync("internalServerError") },
    { status: 500 }
  );
}
