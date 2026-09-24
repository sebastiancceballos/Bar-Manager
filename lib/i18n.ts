export type Locale = "es" | "en";

export const LOCALES: Locale[] = ["es", "en"];
export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_STORAGE_KEY = "bm_locale";

/** Claves de UI compartidas (ampliar según pantalla) */
export type MessageKey =
  | "appName"
  | "login"
  | "loggingIn"
  | "email"
  | "password"
  | "showPassword"
  | "hidePassword"
  | "requiredFields"
  | "loginFailed"
  | "logout"
  | "guide"
  | "loading"
  | "dashboard"
  | "products"
  | "tables"
  | "comandas"
  | "cash"
  | "orders"
  | "selfServiceOrders"
  | "reservations"
  | "reports"
  | "audit"
  | "myShift"
  | "history"
  | "panel"
  | "organizations"
  | "bars"
  | "users"
  | "language"
  | "langEs"
  | "langEn";

const es: Record<MessageKey, string> = {
  appName: "Bar Manager",
  login: "Iniciar sesión",
  loggingIn: "Iniciando sesión...",
  email: "Correo",
  password: "Contraseña",
  showPassword: "Mostrar",
  hidePassword: "Ocultar",
  requiredFields: "Correo y contraseña son obligatorios",
  loginFailed: "No se pudo iniciar sesión",
  logout: "Cerrar sesión",
  guide: "Ver guía",
  loading: "Cargando...",
  dashboard: "Dashboard",
  products: "Productos",
  tables: "Mesas",
  comandas: "Comandas",
  cash: "Caja",
  orders: "Pedidos",
  selfServiceOrders: "Pedidos autoservicio",
  reservations: "Reservas",
  reports: "Reportes",
  audit: "Auditoría",
  myShift: "Mi turno",
  history: "Historial",
  panel: "Panel",
  organizations: "Organizaciones",
  bars: "Bares",
  users: "Usuarios",
  language: "Idioma",
  langEs: "ES",
  langEn: "EN",
};

const en: Record<MessageKey, string> = {
  appName: "Bar Manager",
  login: "Sign in",
  loggingIn: "Signing in...",
  email: "Email",
  password: "Password",
  showPassword: "Show",
  hidePassword: "Hide",
  requiredFields: "Email and password are required",
  loginFailed: "Login failed",
  logout: "Log out",
  guide: "View guide",
  loading: "Loading...",
  dashboard: "Dashboard",
  products: "Products",
  tables: "Tables",
  comandas: "Tickets",
  cash: "Cash",
  orders: "Orders",
  selfServiceOrders: "Self-service orders",
  reservations: "Reservations",
  reports: "Reports",
  audit: "Audit log",
  myShift: "My shift",
  history: "History",
  panel: "Overview",
  organizations: "Organizations",
  bars: "Venues",
  users: "Users",
  language: "Language",
  langEs: "ES",
  langEn: "EN",
};

export const messages: Record<Locale, Record<MessageKey, string>> = { es, en };

export function translate(
  locale: Locale,
  key: MessageKey,
  fallback?: string
): string {
  return messages[locale]?.[key] ?? messages.es[key] ?? fallback ?? key;
}
