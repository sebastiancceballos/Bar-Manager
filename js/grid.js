// grid.js
import { checkCollision } from "./modules/tableManager.js";
import { config } from "./config.js";

export function createGrid(container) {
    container.innerHTML = "";

    container.style.gridTemplateRows = `repeat(${config.rows}, 1fr)`;
    container.style.gridTemplateColumns = `repeat(${config.columns}, 1fr)`;

    for (let i = 0; i < config.rows * config.columns; i++) {
        const cell = document.createElement("div");
        cell.classList.add("grid-cell");
        container.appendChild(cell);
    }
}