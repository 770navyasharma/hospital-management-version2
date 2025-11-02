// app/static/js/admin.js
document.addEventListener('DOMContentLoaded', (event) => {
    
    // --- 1. Activate Toasts ---
    const toastElList = [].slice.call(document.querySelectorAll('.toast'));
    const toastList = toastElList.map(function (toastEl) {
        const delay = toastEl.getAttribute('data-bs-delay') || 5000;
        const toast = new bootstrap.Toast(toastEl, { delay: parseInt(delay) });
        toast.show(); // Show the toast
        
        // --- TOAST AUTO-DISMISS FIX ---
        // Set a timeout to manually dispose of it after the delay
        setTimeout(() => {
            toast.dispose();
        }, parseInt(delay));

        return toast;
    });

    // --- 2. Activate Tooltips ---
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // --- 3. Activate Image Previews ---
    function setupImagePreview(inputId, previewId) {
        const inputElement = document.getElementById(inputId);
        const previewElement = document.getElementById(previewId);
        if (inputElement && previewElement) {
            inputElement.addEventListener('change', function(e) {
                if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        previewElement.src = event.target.result;
                    }
                    reader.readAsDataURL(e.target.files[0]);
                }
            });
        }
    }

    // --- 4. Automatically find and attach all image previews ---
    document.querySelectorAll('input[type="file"][name="profile_pic"]').forEach(inputEl => {
        let previewId;
        if (inputEl.id === 'add-profile-pic-input') {
            previewId = 'add-pic-preview';
        } else if (inputEl.id.startsWith('edit_profile_pic_')) {
            // This finds the matching preview ID for each edit modal
            previewId = inputEl.id.replace('edit_profile_pic_', 'edit-pic-preview-');
        }

        if (previewId) {
            setupImagePreview(inputEl.id, previewId);
        }
    });
});