import { initAuthModule } from "./auth/index.js";
import { initDashboardModule } from "./dashboard/index.js";
import { initCoursesModule } from "./courses/index.js";
import { appendModuleStatus, qs } from "./utils/dom.js";

function bootstrapApp() {
    const statusList = qs("#module-status");

    if (!statusList) {
        console.error("Module status container was not found.");
        return;
    }

    const modules = [
        initAuthModule(),
        initDashboardModule(),
        initCoursesModule(),
    ];

    modules.forEach((moduleInfo) => appendModuleStatus(statusList, moduleInfo));

    console.log("CodeTheCurrent V2 loaded");
}

bootstrapApp();
