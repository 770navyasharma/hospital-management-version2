
document.addEventListener('DOMContentLoaded', (event) => {

    // Remove globalToast immediately — admin pages have their own flash toast system.
    // Must find parent BEFORE removing child (detached nodes lose parent reference).
    const globalToast = document.getElementById('globalToast');
    if (globalToast) {
        const container = globalToast.closest('.toast-container');
        if (container && container.id !== 'adminToastContainer') container.remove();
        else globalToast.remove();
    }

    // Initialize ONLY admin-specific flash toasts (not globalToast)
    const toastElList = document.querySelectorAll('#adminToastContainer .toast');
    toastElList.forEach(function (toastEl) {
        const body = toastEl.querySelector('.toast-body');
        if (!body || body.textContent.trim().length === 0) {
            toastEl.remove();
            return;
        }
        const delay = toastEl.getAttribute('data-bs-delay') || 4000;
        const toast = new bootstrap.Toast(toastEl, { delay: parseInt(delay) });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => {
            toast.dispose();
            toastEl.remove();
        });
    });

    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});