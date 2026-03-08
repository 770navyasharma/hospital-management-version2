document.addEventListener('DOMContentLoaded', (event) => {

    // --- 1. CSV EXPORT LOGIC ---
    const downloadBtn = document.getElementById('downloadDoctorCSV');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function () {
            const table = document.getElementById('doctorTable');
            const rows = table.querySelectorAll('tr');
            let csvContent = "Full Name,Email,Department,Status\n";

            for (let i = 1; i < rows.length; i++) {
                const name = rows[i].querySelector('strong').textContent.replace(',', '');
                const email = rows[i].querySelector('.text-muted').textContent.replace(',', '');
                const dept = rows[i].querySelectorAll('td')[1].textContent.trim().replace(',', '');
                const status = rows[i].querySelector('.badge').textContent.trim();
                csvContent += `${name},${email},${dept},${status}\n`;
            }

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `HMS_Doctor_List_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // --- 2. IMAGE PREVIEWS ---
    function setupImagePreview(inputId, previewId) {
        const inputElement = document.getElementById(inputId);
        const previewElement = document.getElementById(previewId);
        if (inputElement && previewElement) {
            inputElement.addEventListener('change', function (e) {
                if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (event) => previewElement.src = event.target.result;
                    reader.readAsDataURL(e.target.files[0]);
                }
            });
        }
    }

    document.querySelectorAll('input[type="file"]').forEach(inputEl => {
        let previewId = null;
        if (inputEl.id === 'add-profile-pic-input') previewId = 'add-pic-preview';
        else if (inputEl.id.startsWith('edit_profile_pic_')) previewId = inputEl.id.replace('edit_profile_pic_', 'edit-pic-preview-');
        if (previewId) setupImagePreview(inputEl.id, previewId);
    });

    // --- 3. REMOVE PIC LOGIC ---
    document.querySelectorAll('.remove-pic-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const previewId = this.getAttribute('data-preview-id');
            const hiddenId = this.getAttribute('data-hidden-id');
            const previewImg = document.getElementById(previewId);
            const hiddenInput = document.getElementById(hiddenId);

            if (previewImg && hiddenInput) {
                previewImg.src = '/static/images/default-profile.svg';
                hiddenInput.value = 'true';
            }
        });
    });

    // --- 3. CONFIRMATION MODAL ---
    const confModal = document.getElementById('confirmationModal');
    if (confModal) {
        const confirmBtn = document.getElementById('confirmActionButton');
        let formToSubmit = null;

        confModal.addEventListener('show.bs.modal', function (event) {
            const btn = event.relatedTarget;
            const type = btn.getAttribute('data-action-type');
            formToSubmit = btn.getAttribute('data-form-id');
            confirmBtn.className = 'btn ' + (type === 'Delete' ? 'btn-danger' : type === 'Blacklist' ? 'btn-warning' : 'btn-success');
            document.getElementById('confirmationModalText').innerHTML = `Are you sure you want to <strong>${type}</strong> this item?`;
        });

        confirmBtn.addEventListener('click', () => {
            if (formToSubmit) document.getElementById(formToSubmit).submit();
        });
    }

    // --- 4. DEPT INLINE EDIT ---
    document.querySelectorAll('.btn-edit-dept').forEach(btn => {
        btn.addEventListener('click', function () {
            const li = this.closest('li');
            li.querySelector('.dept-display-view').style.display = 'none';
            li.querySelector('.dept-edit-view').style.display = 'flex';
        });
    });

    document.querySelectorAll('.btn-cancel-edit').forEach(btn => {
        btn.addEventListener('click', function () {
            const li = this.closest('li');
            li.querySelector('.dept-display-view').style.display = 'flex';
            li.querySelector('.dept-edit-view').style.display = 'none';
        });
    });

    // --- 5. INITIALIZE VIEWERS ---
    // Edit Doctor Viewers
    document.querySelectorAll('[id^="editDoctorModal-"]').forEach(modal => {
        const doctorId = modal.id.split('-').pop();

        modal.addEventListener('shown.bs.modal', function () {
            const selector = `.admin-view-calendar-inline-${doctorId}`;
            const container = modal.querySelector(selector);

            if (container && !modal.viewerInitialized) {
                modal.viewerInitialized = true;
                new AvailabilityViewer(modal, doctorId);
            }
        });
    });

    // --- 6. STRICT ACCORDION INTERCEPTOR ---
    document.querySelectorAll('.doctor-main-row').forEach(row => {
        row.addEventListener('click', function (e) {
            if (e.target.closest('.table-actions') || e.target.closest('.modal')) return;

            e.preventDefault();
            e.stopPropagation();

            const targetId = this.getAttribute('data-bs-target');
            const targetEl = document.querySelector(targetId);
            const isOpening = !targetEl.classList.contains('show');

            if (isOpening) {
                // 1. Instantly rotate this arrow and reset others
                document.querySelectorAll('.doctor-main-row').forEach(r => r.setAttribute('aria-expanded', 'false'));
                this.setAttribute('aria-expanded', 'true');

                // 2. Hide any currently open row
                const openDetails = document.querySelector('.doctor-details-row.collapse.show');
                if (openDetails && openDetails !== targetEl) {
                    bootstrap.Collapse.getOrCreateInstance(openDetails).hide();
                    // Small delay to ensure "closing" starts before "opening"
                    setTimeout(() => {
                        bootstrap.Collapse.getOrCreateInstance(targetEl).show();
                    }, 50);
                } else {
                    bootstrap.Collapse.getOrCreateInstance(targetEl).show();
                }
            } else {
                // Closing itself
                this.setAttribute('aria-expanded', 'false');
                bootstrap.Collapse.getOrCreateInstance(targetEl).hide();
            }
        });
    });

    // Cleanup: Sync aria-expanded if Bootstrap hides it via other means (unlikely but safe)
    document.querySelectorAll('.doctor-details-row').forEach(detail => {
        detail.addEventListener('hidden.bs.collapse', () => {
            const row = document.querySelector(`[data-bs-target="#${detail.id}"]`);
            if (row) row.setAttribute('aria-expanded', 'false');
        });
        detail.addEventListener('shown.bs.collapse', () => {
            const row = document.querySelector(`[data-bs-target="#${detail.id}"]`);
            if (row) row.setAttribute('aria-expanded', 'true');
        });
    });

});

// --- CLASS: Schedule Viewer (READ-ONLY) ---
class AvailabilityViewer {
    constructor(modal, doctorId) {
        this.doctorId = doctorId;
        this.modal = modal;
        this.dataInput = modal.querySelector(`.doctor-availability-data-${doctorId}`);
        this.data = this.dataInput && this.dataInput.value ? JSON.parse(this.dataInput.value) : {};

        this.calendarEl = modal.querySelector(`.admin-view-calendar-inline-${doctorId}`);
        this.slotsWrapper = modal.querySelector(`.view-slots-wrapper-${doctorId}`);
        this.dateTitle = modal.querySelector(`.selected-date-title`);

        this.init();
    }

    init() {
        if (!this.calendarEl) return;

        // Clean up any existing instances
        if (this.calendarEl._flatpickr) {
            this.calendarEl._flatpickr.destroy();
        }

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        this.fp = flatpickr(this.calendarEl, {
            inline: true,
            mode: "multiple",
            dateFormat: "Y-m-d",
            defaultDate: [todayStr],
            onChange: (dates) => {
                this.renderSlots(dates);
            }
        });

        // Initial render for default date (today)
        this.renderSlots(this.fp.selectedDates);
    }

    renderSlots(dates) {
        if (!this.slotsWrapper || !this.dateTitle) return;

        this.slotsWrapper.innerHTML = '';

        if (!dates || dates.length === 0) {
            this.dateTitle.textContent = 'Select dates to view schedule';
            this.slotsWrapper.innerHTML = '<div class="alert alert-light py-2 px-3 small text-muted border-0">Click dates in the calendar to see the schedule.</div>';
            return;
        }

        // Sort dates chronologically
        const sortedDates = [...dates].sort((a, b) => a - b);
        this.dateTitle.textContent = `Schedule for ${sortedDates.length} selected date${sortedDates.length > 1 ? 's' : ''}`;

        let hasAnySlots = false;

        sortedDates.forEach(date => {
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const displayDate = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

            const slots = this.data[dateStr] || [];

            if (slots.length > 0) {
                hasAnySlots = true;

                // Create Date Header
                const header = document.createElement('div');
                header.className = 'date-group-header mt-3 mb-2 px-2 py-1 rounded bg-light-blue smallest fw-bold text-primary-emphasis';
                header.innerHTML = `<i class="bi bi-calendar-event me-2"></i>${displayDate}`;
                this.slotsWrapper.appendChild(header);

                // Add Slots
                slots.forEach(range => {
                    const div = document.createElement('div');
                    div.className = 'd-flex align-items-center gap-2 p-2 bg-white rounded-3 shadow-sm border-left-blue mb-2';
                    div.innerHTML = `<i class="bi bi-clock small text-primary"></i> <span class="small fw-bold">${range}</span>`;
                    this.slotsWrapper.appendChild(div);
                });
            }
        });

        if (!hasAnySlots) {
            this.slotsWrapper.innerHTML = '<div class="alert alert-warning py-2 px-3 small border-0 text-center mt-3"><i class="bi bi-info-circle d-block fs-4 mb-2"></i> No availability set for the selected dates.</div>';
        }
    }
}