// storage.js

import { currentLocation } from "./config.js";

export function saveTables(tables) {
    localStorage.setItem(
        `barTables_${currentLocation}`,
        JSON.stringify(tables)
    );
}

export function loadTables() {
    const saved = localStorage.getItem(
        `barTables_${currentLocation}`
    );

    return saved ? JSON.parse(saved) : null;
}