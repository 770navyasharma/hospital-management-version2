// app/static/js/admin.js
document.addEventListener('DOMContentLoaded', (event) => {
    
    // --- 1. Activate Toasts (COMMON) ---
    const toastElList = [].slice.call(document.querySelectorAll('.toast'));
    const toastList = toastElList.map(function (toastEl) {
        const delay = toastEl.getAttribute('data-bs-delay') || 5000;
        const toast = new bootstrap.Toast(toastEl, { delay: parseInt(delay) });
        toast.show(); // Show the toast
        
        // --- TOAST AUTO-DISMISS FIX ---
        setTimeout(() => {
            toast.dispose();
        }, parseInt(delay));

        return toast;
    });

    // --- 2. Activate Tooltips (COMMON) ---
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});