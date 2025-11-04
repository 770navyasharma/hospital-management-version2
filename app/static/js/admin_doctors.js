// app/static/js/admin_doctors.js
document.addEventListener('DOMContentLoaded', (event) => {

    // --- 3. Activate Image Previews (DOCTOR-PAGE-SPECIFIC) ---
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

    // --- 4. Automatically find and attach all image previews (DOCTOR-PAGE-SPECIFIC) ---
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


    // --- 5. Handle Confirmation Modal (NOW WITH DEPT LOGIC) ---
    const confirmationModal = document.getElementById('confirmationModal');
    if (confirmationModal) {
        const modalTitle = document.getElementById('confirmationModalLabel');
        const modalBody = document.getElementById('confirmationModalText');
        const confirmButton = document.getElementById('confirmActionButton');
        let formToSubmit = null; // Holds the ID of the form to submit

        // When the modal is about to be shown
        confirmationModal.addEventListener('show.bs.modal', function (event) {
            const button = event.relatedTarget; // The button that triggered the modal
            
            // Get data from the button's data-* attributes
            const actionType = button.getAttribute('data-action-type');
            
            // Reset button to be enabled and clear old form
            confirmButton.disabled = false;
            confirmButton.className = 'btn';
            formToSubmit = button.getAttribute('data-form-id');

            // --- DOCTOR ACTIONS ---
            if (actionType === 'Delete') {
                const doctorName = button.getAttribute('data-doctor-name');
                modalTitle.textContent = 'Confirm Deletion';
                modalBody.innerHTML = `Are you sure you want to <strong>permanently delete</strong> Dr. ${doctorName}? This action cannot be undone.`;
                confirmButton.classList.add('btn-danger');
                confirmButton.textContent = 'Yes, Delete';
            } else if (actionType === 'Blacklist') {
                const doctorName = button.getAttribute('data-doctor-name');
                modalTitle.textContent = 'Confirm Blacklist';
                modalBody.innerHTML = `Are you sure you want to <strong>blacklist</strong> Dr. ${doctorName}? They will not be able to log in.`;
                confirmButton.classList.add('btn-warning');
                confirmButton.textContent = 'Yes, Blacklist';
            } else if (actionType === 'Activate') {
                const doctorName = button.getAttribute('data-doctor-name');
                modalTitle.textContent = 'Confirm Activation';
                modalBody.innerHTML = `Are you sure you want to <strong>re-activate</strong> Dr. ${doctorName}? They will regain system access.`;
                confirmButton.classList.add('btn-success');
                confirmButton.textContent = 'Yes, Activate';

            // --- NEW DEPARTMENT DELETE ACTION ---
            } else if (actionType === 'DeleteDept') {
                const deptName = button.getAttribute('data-dept-name');
                const doctorCount = parseInt(button.getAttribute('data-doctor-count') || 0);

                if (doctorCount > 0) {
                    // CANNOT DELETE - Show error message
                    modalTitle.textContent = 'Cannot Delete Department';
                    modalBody.innerHTML = `Cannot delete <strong>${deptName}</strong>. <br><br>This department is assigned to <strong>${doctorCount}</strong> doctor(s). Please re-assign them first.`;
                    confirmButton.classList.add('btn-secondary');
                    confirmButton.textContent = 'Understood';
                    // confirmButton.disabled = true; // <-- THIS WAS THE BUG. REMOVED.
                    formToSubmit = null; // Prevent any submission
                } else {
                    // CAN DELETE - Show confirmation
                    modalTitle.textContent = 'Confirm Deletion';
                    modalBody.innerHTML = `Are you sure you want to permanently delete the <strong>${deptName}</strong> department? This action cannot be undone.`;
                    confirmButton.classList.add('btn-danger');
                    confirmButton.textContent = 'Yes, Delete';
                }
            }
        });

        // Add a click listener to the (single) confirm button in the modal
        confirmButton.addEventListener('click', function() {
            if (formToSubmit) {
                const form = document.getElementById(formToSubmit);
                if (form) {
                    form.submit(); // Submit the stored form
                }
            } else if (!confirmButton.disabled) {
                // If no form (e.g., "Understood" button), just close the modal
                bootstrap.Modal.getInstance(confirmationModal).hide();
            }
        });
    }

    // --- 6. NEW: Handle Department Inline Edit ---
    document.querySelectorAll('.btn-edit-dept').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const listItem = this.closest('.list-group-item');
            listItem.querySelector('.dept-display-view').style.display = 'none';
            listItem.querySelector('.dept-actions').style.display = 'none';
            
            const editView = listItem.querySelector('.dept-edit-view');
            editView.style.display = 'flex';
            editView.querySelector('input').focus();
        });
    });

    document.querySelectorAll('.btn-cancel-edit').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const listItem = this.closest('.list-group-item');
            const editView = listItem.querySelector('.dept-edit-view');
            const displayView = listItem.querySelector('.dept-display-view');
            
            // Reset value in input to original
            const originalName = displayView.querySelector('.dept-name').textContent;
            editView.querySelector('input').value = originalName;

            // Toggle visibility
            editView.style.display = 'none';
            displayView.style.display = 'flex';
            listItem.querySelector('.dept-actions').style.display = 'block';
        });
    });

});