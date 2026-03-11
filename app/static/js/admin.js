
document.addEventListener('DOMContentLoaded', (event) => {
    
    
    const toastElList = [].slice.call(document.querySelectorAll('.toast'));
    const toastList = toastElList.map(function (toastEl) {
        const delay = toastEl.getAttribute('data-bs-delay') || 5000;
        const toast = new bootstrap.Toast(toastEl, { delay: parseInt(delay) });
        toast.show(); 
        
        
        setTimeout(() => {
            toast.dispose();
        }, parseInt(delay));

        return toast;
    });

    
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});