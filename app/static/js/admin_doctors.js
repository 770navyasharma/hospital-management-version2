document.addEventListener('DOMContentLoaded', (event) => {

    // === Doctor Row Expand/Collapse ===
    document.querySelectorAll('.doctor-main-row').forEach(row => {
        row.addEventListener('click', function () {
            const doctorId = this.dataset.doctorId;
            if (!doctorId) return;
            const detailRow = document.getElementById(`doctor-details-${doctorId}`);
            const isOpen = detailRow.style.display !== 'none';

            // Close all open rows first
            document.querySelectorAll('.doctor-details-row').forEach(r => r.style.display = 'none');
            document.querySelectorAll('.doctor-main-row').forEach(r => r.classList.remove('expanded'));

            // Toggle this one open
            if (!isOpen) {
                detailRow.style.display = 'table-row';
                this.classList.add('expanded');
                fetchDoctorStats(doctorId, detailRow);
            }
        });
    });

    const downloadBtn = document.getElementById('downloadDoctorCSV');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function () {
            const rows = document.querySelectorAll('#doctorTable .doctor-main-row');
            let csvContent = "Full Name,Degree,Department,Fees,Status\n";
            rows.forEach(row => {
                const name = row.querySelector('.doc-name')?.textContent.trim().replace(',', '') || '';
                const degree = row.querySelector('.doc-degree')?.textContent.trim().replace(',', '') || '';
                const dept = row.querySelector('.dept-badge')?.textContent.trim().replace(',', '') || '';
                const fees = row.querySelector('.fees-label')?.textContent.trim().replace(',', '') || '';
                const status = row.querySelector('.badge')?.textContent.trim() || '';
                csvContent += `${name},${degree},${dept},${fees},${status}\n`;
            });
            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Doctors_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    }

    
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

    document.querySelectorAll('.btn-edit-dept').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const item = this.closest('.dept-item');
            if (item) {
                const displayView = item.querySelector('.dept-display-view');
                const editView = item.querySelector('.dept-edit-view');
                const input = editView.querySelector('.dept-edit-input');
                displayView.style.display = 'none';
                editView.style.display = 'flex';
                // Auto-focus and select all text
                if (input) {
                    input.focus();
                    input.select();
                }
            }
        });
    });

    document.querySelectorAll('.btn-cancel-edit').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const item = this.closest('.dept-item');
            if (item) {
                const displayView = item.querySelector('.dept-display-view');
                const editView = item.querySelector('.dept-edit-view');
                const input = editView.querySelector('.dept-edit-input');
                const originalName = item.querySelector('.dept-item-name')?.textContent.trim();
                // Reset the input to original value so stale edits don't persist
                if (input && originalName) input.value = originalName;
                editView.style.display = 'none';
                displayView.style.display = 'flex';
            }
        });
    });

    
    
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

    
    // --- Performance Range Filter ---
    const perfFp = flatpickr("#doctorPerfRange", {
        mode: "range",
        defaultDate: [new Date(new Date().setDate(new Date().getDate() - 180)), new Date()],
        dateFormat: "Y-m-d",
        onChange: () => {
             // If any rows are already open, refresh their stats
             document.querySelectorAll('.doctor-details-row.show').forEach(row => {
                 const id = row.id.split('-').pop();
                 fetchDoctorStats(id, row);
             });
        }
    });

    async function fetchDoctorStats(id, containerRow) {
        const statsBox = containerRow.querySelector(`.perf-stats-container-${id}`);
        const earningsBox = containerRow.querySelector(`.earnings-label-${id}`);
        const datesLabel = containerRow.querySelector('.perf-dates-label');
        
        const dates = perfFp.selectedDates;
        let query = "";
        if (dates.length === 2) {
            query = `?start_date=${dates[0].toISOString().split('T')[0]}&end_date=${dates[1].toISOString().split('T')[0]}`;
            datesLabel.textContent = `(${dates[0].toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${dates[1].toLocaleDateString('en-US', {month:'short', day:'numeric'})})`;
        } else {
            datesLabel.textContent = "(Last 6 Months)";
        }

        try {
            const res = await fetch(`/api/admin/doctor-performance/${id}${query}`);
            const data = await res.json();
            
            earningsBox.textContent = `₹${data.revenue.toLocaleString()}`;
            
            statsBox.innerHTML = `
                <div class="row g-2">
                    <div class="col-6">
                        <div class="stat-mini-card">
                            <div class="val">${data.count}</div>
                            <div class="lbl">Visits</div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="stat-mini-card">
                            <div class="val" style="color:#10b981;">${data.status_dist.Completed || 0}</div>
                            <div class="lbl">Completed</div>
                        </div>
                    </div>
                    <div class="col-12 mt-1">
                        <div class="detail-section-label">Recent Patients</div>
                        <div class="d-flex flex-wrap">
                            ${data.recent_patients.length
                                ? data.recent_patients.map(p => `<span class="recent-patient-chip">${p}</span>`).join('')
                                : '<span class="text-muted" style="font-size:0.8rem;">No recent visits</span>'}
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            statsBox.innerHTML = `<div class="alert alert-danger smallest py-1 px-2">Failed to load stats</div>`;
        }
    }

    // Performance range filter - refresh any open row
    perfFp.config.onChange.push(() => {
        document.querySelectorAll('.doctor-details-row').forEach(row => {
            if (row.style.display !== 'none') {
                const id = row.id.replace('doctor-details-', '');
                fetchDoctorStats(id, row);
            }
        });
    });

});


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

        
        const sortedDates = [...dates].sort((a, b) => a - b);
        this.dateTitle.textContent = `Schedule for ${sortedDates.length} selected date${sortedDates.length > 1 ? 's' : ''}`;

        let hasAnySlots = false;

        sortedDates.forEach(date => {
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const displayDate = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

            const slots = this.data[dateStr] || [];

            if (slots.length > 0) {
                hasAnySlots = true;

                
                const header = document.createElement('div');
                header.className = 'date-group-header mt-3 mb-2 px-2 py-1 rounded bg-light-blue smallest fw-bold text-primary-emphasis';
                header.innerHTML = `<i class="bi bi-calendar-event me-2"></i>${displayDate}`;
                this.slotsWrapper.appendChild(header);

                
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