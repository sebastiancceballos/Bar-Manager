// tables.js

import { saveTables } from "./storage.js";
import { checkCollision } from "./modules/tableManager.js";
import { config } from "./config.js";



export function renderTables(
    container,
    tables,
    editMode,
    deleteMode,
    onClick
) {

    // Eliminar mesas anteriores
    document.querySelectorAll(".table").forEach(el => el.remove());

    tables.forEach(table => {

        const tableElement = document.createElement("div");

        tableElement.classList.add("table", table.status);

        // 🔥 Mostrar nombre si existe, si no el id
        tableElement.textContent = table.name || table.id;

        // POSICIONAMIENTO (en píxeles) sobre el contenedor
        const rect = container.getBoundingClientRect();
        const cellWidth = rect.width / config.columns;
        const cellHeight = rect.height / config.rows;

        tableElement.style.left = `${(table.x - 1) * cellWidth}px`;
        tableElement.style.top = `${(table.y - 1) * cellHeight}px`;
        tableElement.style.width = `${table.width * cellWidth}px`;
        tableElement.style.height = `${table.height * cellHeight}px`;

        // DRAG SOLO EN MODO EDICIÓN: arrastre por pointer con snap a la grilla
        if (editMode) {
            let offsetX = 0;
            let offsetY = 0;
            let isDragging = false;

            tableElement.addEventListener("pointerdown", (e) => {
                isDragging = true;
                tableElement.setPointerCapture(e.pointerId);

                const elRect = tableElement.getBoundingClientRect();
                offsetX = e.clientX - elRect.left;
                offsetY = e.clientY - elRect.top;

                tableElement.style.transition = "none";
            });

            tableElement.addEventListener("pointermove", (e) => {
                if (!isDragging) return;

                const containerRect = container.getBoundingClientRect();

                let newLeft = e.clientX - containerRect.left - offsetX;
                let newTop = e.clientY - containerRect.top - offsetY;

                // Limitar dentro del contenedor
                newLeft = Math.max(0, Math.min(newLeft, containerRect.width - tableElement.offsetWidth));
                newTop = Math.max(0, Math.min(newTop, containerRect.height - tableElement.offsetHeight));

                tableElement.style.left = `${newLeft}px`;
                tableElement.style.top = `${newTop}px`;
            });

            tableElement.addEventListener("pointerup", (e) => {
                if (!isDragging) return;
                isDragging = false;

                const containerRect = container.getBoundingClientRect();
                const left = tableElement.offsetLeft;
                const top = tableElement.offsetTop;

                // Calcular nueva posición en celdas (1-based)
                let newX = Math.round(left / cellWidth) + 1;
                let newY = Math.round(top / cellHeight) + 1;

                // Limitar que no salga del grid
                if (newX < 1) newX = 1;
                if (newY < 1) newY = 1;
                if (newX + table.width - 1 > config.columns) newX = config.columns - table.width + 1;
                if (newY + table.height - 1 > config.rows) newY = config.rows - table.height + 1;

                const simulatedTable = { ...table, x: newX, y: newY };

                // VALIDAR COLISIÓN
                if (!checkCollision(simulatedTable, tables)) {
                    table.x = newX;
                    table.y = newY;
                    saveTables(tables);
                    // Volver a renderizar para recalcular tamaños/posiciones
                    // y quitar los listeners temporales
                    renderTables(container, tables, editMode, deleteMode, onClick);
                    return;
                } else {
                    // Revertir a posición original (snap)
                    tableElement.style.transition = "all 0.2s ease";
                    tableElement.style.left = `${(table.x - 1) * cellWidth}px`;
                    tableElement.style.top = `${(table.y - 1) * cellHeight}px`;
                }
            });
        }

        // 🔥 CLICK CONTROLADO POR MAIN
        tableElement.addEventListener("click", () => {
            onClick(table);
        });

        container.appendChild(tableElement);
    });
}

export function changeTableStatus(tables, id) {
    const table = tables.find(t => t.id === id);

    if (!table) return;

    if (table.status === "libre") table.status = "ocupada";
    else if (table.status === "ocupada") table.status = "pagada";
    else table.status = "libre";

    saveTables(tables);
}