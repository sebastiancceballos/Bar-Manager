// tableManager.js

export function checkCollision(movingTable, tables) {
  return tables.some(table => {
    if (table.id === movingTable.id) return false;

    return !(
      movingTable.x + movingTable.width <= table.x ||
      table.x + table.width <= movingTable.x ||
      movingTable.y + movingTable.height <= table.y ||
      table.y + table.height <= movingTable.y
    );
  });
}

export function addTable(tables) {
  const newId = tables.length
    ? Math.max(...tables.map(t => t.id)) + 1
    : 1;

  const newTable = {
    id: newId, // 🔥 SIEMPRE número
    name: `Mesa ${newId}`,
    x: 2,
    y: 2,
    width: 2,
    height: 2,
    status: "libre", // 🔥 mismo idioma que CSS
    pedidos: [],
    total: 0
  };

  return [...tables, newTable];
}

export function removeTable(tables, id) {
  return tables.filter(table => table.id !== id);
}