// incomeManager.js

const INCOME_KEY = "daily_income";

export function getDailyIncome() {
    return Number(localStorage.getItem(INCOME_KEY)) || 0;
}

export function addIncome(amount) {
    const current = getDailyIncome();
    const updated = current + amount;

    localStorage.setItem(INCOME_KEY, updated);
    renderIncome();
}

export function resetDailyIncome() {
    localStorage.removeItem(INCOME_KEY);
    renderIncome();
}

export function renderIncome() {
    const incomeElement = document.getElementById("dailyIncome");
    if (!incomeElement) return;

    const total = getDailyIncome();

    incomeElement.textContent =
        `💰 Ingresos del día: $${total.toLocaleString("es-CO")}`;
}