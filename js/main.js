// main.js

import { addTable, removeTable } from "./modules/tableManager.js";
import { createGrid } from "./grid.js";
import { renderTables } from "./tables.js";
import { setupOrdersUI } from "./orders.js";
import { loadTables, saveTables } from "./storage.js";
import { getDailyIncome, resetDailyIncome, renderIncome } from "./modules/incomeManager.js";





const gridContainer = document.getElementById("grid-container");
const editBtn = document.getElementById("editModeBtn");
const addBtn = document.getElementById("addTableBtn");
const deleteBtn = document.getElementById("deleteModeBtn");

let editMode = false;
let deleteMode = false;
let currentTable = null;




let tables = loadTables() || [
    {
        id: "M1",
        name: "Mesa 1",
        x: 2,
        y: 2,
        width: 2,
        height: 2,
        status: "libre",
        pedidos: [],
        total: 0
    }
];

createGrid(gridContainer);

function render() {
    renderTables(
        gridContainer,
        tables,
        editMode,
        deleteMode,
        (table) => {
            if (deleteMode) {
                tables = removeTable(tables, table.id);
                saveTables(tables);
                render();
                return;
            }

            currentTable = table;
            ordersUI.openModal(table);
        }
    );
}

// El arrastre ahora se maneja por pointer events desde `renderTables`

const ordersUI = setupOrdersUI(
    tables,
    () => currentTable,
    render
);


// BOTÓN EDITAR
editBtn.addEventListener("click", () => {
    editMode = !editMode;

    editBtn.textContent = `Modo Edición: ${editMode ? "ON" : "OFF"}`;

    const refreshBtn = document.getElementById("refresh-orders-btn");

    if (editMode) {
        refreshBtn.classList.remove("hidden");
    } else {
        refreshBtn.classList.add("hidden");
    }

    render();
});

// BOTÓN AGREGAR
addBtn.addEventListener("click", () => {
    tables = addTable(tables);
    saveTables(tables);
    render();
});

// BOTÓN ELIMINAR
deleteBtn.addEventListener("click", () => {
    deleteMode = !deleteMode;
    deleteBtn.style.background = deleteMode ? "red" : "";
    render();
});

render();

const incomeDisplay = document.getElementById("dailyIncome");
const resetIncomeBtn = document.getElementById("resetIncomeBtn");

resetIncomeBtn.addEventListener("click", () => {
    resetDailyIncome();
    updateIncomeUI();
});

document.addEventListener("DOMContentLoaded", () => {
    renderIncome();
});



document
  .getElementById("refresh-orders-btn")
  .addEventListener("click", () => {
      ordersUI.refreshOrders();
  });

document
  .getElementById("refresh-orders-btn")
  .addEventListener("click", () => {
      ordersUI.updatePricesFromMenu();
  });