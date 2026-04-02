const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const yearTarget = document.querySelector("[data-year]");
const contactForms = document.querySelectorAll(".contact-form");

if (yearTarget) {
    yearTarget.textContent = new Date().getFullYear();
}

if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
        const isOpen = siteNav.classList.toggle("is-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
    });
}

contactForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const name = String(formData.get("name") || "").trim();
        const email = String(formData.get("email") || "").trim();
        const message = String(formData.get("message") || "").trim();
        const recipient = form.dataset.email || "";
        const subject = form.dataset.subject || "CodeTheCurrent Message";

        const body = [
            `Form Type: ${subject}`,
            `Name: ${name}`,
            `Email: ${email}`,
            "",
            "Message:",
            message
        ].join("\n");

        window.location.href =
            `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
});
