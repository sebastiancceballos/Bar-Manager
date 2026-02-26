import { menu } from "../config.js";
import { saveMenu } from "../storage.js";

export function setupMenuManager() {

    const list = document.getElementById("productList");
    const nameInput = document.getElementById("productName");
    const priceInput = document.getElementById("productPrice");
    const addBtn = document.getElementById("addProduct");

    function renderProducts() {
        list.innerHTML = "";

        menu.forEach((product, index) => {
            const div = document.createElement("div");

            div.innerHTML = `
                ${product.name} - $${product.price}
                <button data-index="${index}" class="delete">❌</button>
            `;

            list.appendChild(div);
        });

        document.querySelectorAll(".delete").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const index = e.target.dataset.index;
                menu.splice(index, 1);
                saveMenu(menu);
                renderProducts();
            });
        });
    }

    addBtn.addEventListener("click", () => {
        const name = nameInput.value;
        const price = Number(priceInput.value);

        if (!name || !price) return;

        menu.push({ name, price });
        saveMenu(menu);

        nameInput.value = "";
        priceInput.value = "";

        renderProducts();
    });

    renderProducts();
}