import { loadProtectedProfile } from "../utils/auth-guard.js";
import { qs } from "../utils/dom.js";

const statusElement = qs("[data-info-status]");

async function initializeInfoPage() {
    const profile = await loadProtectedProfile({ statusElement });

    if (!profile) {
        return;
    }

    statusElement.textContent = "";
}

initializeInfoPage();
