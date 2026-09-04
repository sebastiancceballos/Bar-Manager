-- Crear la base de datos
CREATE DATABASE WebBarDB;

-- Usar la base de datos
USE WebBarDB;

-- ==============================
-- TABLA: Bares
-- ==============================
CREATE TABLE Bares (
    IdBar INT AUTO_INCREMENT PRIMARY KEY,   -- Identificador único del bar
    Nombre VARCHAR(100) NOT NULL,           -- Nombre del bar
    Direccion VARCHAR(200) NOT NULL,        -- Dirección física
    Telefono VARCHAR(20) NOT NULL,          -- Teléfono de contacto
    FechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP, -- Fecha automática
    Estado BOOLEAN DEFAULT TRUE             -- TRUE = Activo, FALSE = Inactivo
);

-- ==============================
-- TABLA: Usuarios
-- ==============================
CREATE TABLE Usuarios (
    IdUsuario INT AUTO_INCREMENT PRIMARY KEY,
    IdBar INT NOT NULL,
    Nombre VARCHAR(100) NOT NULL,
    Correo VARCHAR(100) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Rol ENUM('Admin','Mesero','Cajero') NOT NULL, -- ENUM en lugar de CHECK
    Activo BOOLEAN DEFAULT TRUE,

    CONSTRAINT FK_Usuarios_Bares 
        FOREIGN KEY (IdBar) 
        REFERENCES Bares(IdBar)
        ON DELETE CASCADE
);

-- ==============================
-- TABLA: Productos
-- ==============================
CREATE TABLE Productos (
    IdProducto INT AUTO_INCREMENT PRIMARY KEY,
    IdBar INT NOT NULL,
    Nombre VARCHAR(100) NOT NULL,
    Descripcion VARCHAR(200),
    Precio DECIMAL(10,2) NOT NULL,
    Stock INT DEFAULT 0,
    Activo BOOLEAN DEFAULT TRUE,

    CONSTRAINT FK_Productos_Bares 
        FOREIGN KEY (IdBar)
        REFERENCES Bares(IdBar)
        ON DELETE CASCADE,

    CONSTRAINT CHK_Precio CHECK (Precio >= 0),
    CONSTRAINT CHK_Stock CHECK (Stock >= 0)
);

-- ==============================
-- TABLA: Mesas
-- ==============================
CREATE TABLE Mesas (
    IdMesa INT AUTO_INCREMENT PRIMARY KEY,
    IdBar INT NOT NULL,
    Numero INT NOT NULL,
    Estado ENUM('Libre','Ocupada') DEFAULT 'Libre',
    Capacidad INT NOT NULL,

    CONSTRAINT UQ_Mesa_Numero UNIQUE (IdBar, Numero),

    CONSTRAINT FK_Mesas_Bares 
        FOREIGN KEY (IdBar)
        REFERENCES Bares(IdBar)
        ON DELETE CASCADE,

    CONSTRAINT CHK_Capacidad CHECK (Capacidad > 0)
);

-- ==============================
-- TABLA: Ordenes
-- ==============================
CREATE TABLE Ordenes (
    IdOrden INT AUTO_INCREMENT PRIMARY KEY,
    IdBar INT NOT NULL,
    IdMesa INT NOT NULL,
    IdMesero INT NOT NULL,
    FechaHora DATETIME DEFAULT CURRENT_TIMESTAMP,
    Estado ENUM('Abierta','Cerrada','Cancelada') DEFAULT 'Abierta',
    Total DECIMAL(10,2) DEFAULT 0,

    CONSTRAINT FK_Ordenes_Bares 
        FOREIGN KEY (IdBar)
        REFERENCES Bares(IdBar),

    CONSTRAINT FK_Ordenes_Mesas 
        FOREIGN KEY (IdMesa)
        REFERENCES Mesas(IdMesa),

    CONSTRAINT FK_Ordenes_Usuarios 
        FOREIGN KEY (IdMesero)
        REFERENCES Usuarios(IdUsuario),

    CONSTRAINT CHK_Total CHECK (Total >= 0)
);

-- ==============================
-- TABLA: DetalleOrden
-- ==============================
CREATE TABLE DetalleOrden (
    IdDetalle INT AUTO_INCREMENT PRIMARY KEY,
    IdOrden INT NOT NULL,
    IdProducto INT NOT NULL,
    Cantidad INT NOT NULL,
    PrecioUnitario DECIMAL(10,2) NOT NULL,
    Subtotal DECIMAL(10,2) GENERATED ALWAYS AS (Cantidad * PrecioUnitario) STORED,

    CONSTRAINT FK_Detalle_Orden 
        FOREIGN KEY (IdOrden)
        REFERENCES Ordenes(IdOrden)
        ON DELETE CASCADE,

    CONSTRAINT FK_Detalle_Producto 
        FOREIGN KEY (IdProducto)
        REFERENCES Productos(IdProducto),

    CONSTRAINT CHK_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CHK_PrecioUnitario CHECK (PrecioUnitario >= 0)
);
