// orders.js

import { menu } from "./config.js";
import { saveTables } from "./storage.js";
import { addIncome, renderIncome } from "./modules/incomeManager.js";

export function setupOrdersUI(tables, getCurrentTable, renderTables) {

    const modal = document.getElementById("orderModal");
    const modalTitle = document.getElementById("modalTitle");
    const orderList = document.getElementById("orderList");
    const productSelect = document.getElementById("productSelect");
    const unitsTotal = document.getElementById("unitsTotal");
    const moneyTotal = document.getElementById("moneyTotal");

    const addBtn = document.getElementById("addProductBtn");
    const closeModalBtn = document.getElementById("closeModalBtn");
    const closeTableBtn = document.getElementById("closeTableBtn");

    // ===============================
    // Llenar select
    // ===============================
    menu.forEach(product => {
        const option = document.createElement("option");
        option.value = product.name;
        option.textContent = `${product.name} - $${product.price}`;
        productSelect.appendChild(option);
    });

    // ===============================
    // Renderizar pedidos
    // ===============================
    function renderOrders(table) {

        orderList.innerHTML = "";

        let totalUnits = 0;
        let totalMoney = 0;

        table.pedidos.forEach((item, index) => {

            const div = document.createElement("div");
            div.classList.add("order-item");

            div.innerHTML = `
                ${item.name} x${item.quantity}
                <button class="remove-btn" data-index="${index}">❌</button>
            `;

            orderList.appendChild(div);

            totalUnits += item.quantity;
            totalMoney += item.quantity * item.price;
        });

        unitsTotal.textContent = `Total unidades: ${totalUnits}`;
        moneyTotal.textContent = `Total cuenta: $${totalMoney}`;

        table.total = totalMoney;

        document.querySelectorAll(".remove-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const index = e.target.dataset.index;
                table.pedidos.splice(index, 1);

                renderOrders(table);
                renderTables();
                saveTables(tables);
            });
        });
    }

    // ===============================
    // 🔥 Actualizar precios desde menú
    // ===============================
    function updatePricesFromMenu() {

        const table = getCurrentTable();
        if (!table) return;

        table.pedidos.forEach(item => {
            const productFromMenu = menu.find(p => p.name === item.name);
            if (productFromMenu) {
                item.price = productFromMenu.price;
            }
        });

        renderOrders(table);
        renderTables();
        saveTables(tables);

        const feedback = document.getElementById("update-feedback");
        if (feedback) {
            feedback.textContent = "💲 Precios actualizados";
            feedback.style.opacity = "1";
            setTimeout(() => feedback.style.opacity = "0", 1500);
        }
    }

    // ===============================
    // Botón actualizar precios
    // ===============================
    const updateBtn = document.getElementById("updatePricesBtn");
    if (updateBtn) {
        updateBtn.addEventListener("click", updatePricesFromMenu);
    }

    // ===============================
    // Agregar producto
    // ===============================
    addBtn.addEventListener("click", () => {

        const table = getCurrentTable();
        if (!table) return;

        const productName = productSelect.value;
        const product = menu.find(p => p.name === productName);

        const existing = table.pedidos.find(p => p.name === product.name);

        if (existing) {
            existing.quantity += 1;
        } else {
            table.pedidos.push({
                name: product.name,
                price: product.price,
                quantity: 1
            });
        }

        table.status = "ocupada";

        renderOrders(table);
        renderTables();
        saveTables(tables);
    });

    // ===============================
    // Cerrar modal
    // ===============================
    closeModalBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
        saveTables(tables);
    });

    // ===============================
    // Cerrar mesa
    // ===============================
    closeTableBtn.addEventListener("click", () => {

        const table = getCurrentTable();
        if (!table) return;

        const total = table.pedidos.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);

        addIncome(total);
        renderIncome();

        table.status = "libre";
        table.pedidos = [];
        table.total = 0;

        modal.classList.add("hidden");

        renderTables();
        saveTables(tables);
    });

    // ===============================
    // Exportar funciones
    // ===============================
    return {
        openModal: (table) => {
            modal.classList.remove("hidden");
            modalTitle.textContent = `Mesa ${table.id}`;
            renderOrders(table);
        }
    };
}