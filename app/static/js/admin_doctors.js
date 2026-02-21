document.addEventListener('DOMContentLoaded', (event) => {

    // --- 1. CSV EXPORT LOGIC ---
    const downloadBtn = document.getElementById('downloadDoctorCSV');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
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
            inputElement.addEventListener('change', function(e) {
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
        btn.addEventListener('click', function() {
            const li = this.closest('li');
            li.querySelector('.dept-display-view').style.display = 'none';
            li.querySelector('.dept-edit-view').style.display = 'flex';
        });
    });

    document.querySelectorAll('.btn-cancel-edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const li = this.closest('li');
            li.querySelector('.dept-display-view').style.display = 'flex';
            li.querySelector('.dept-edit-view').style.display = 'none';
        });
    });

    // --- 5. INITIALIZE SCHEDULERS ---
    document.querySelectorAll('.scheduler-container').forEach(container => {
        new AvailabilityScheduler(container);
    });
});

// Class Logic for Scheduler
class AvailabilityScheduler {
    constructor(container) {
        this.container = container;
        this.hiddenInput = container.closest('.col-12').querySelector('.real-availability-input');
        this.data = this.hiddenInput.value ? JSON.parse(this.hiddenInput.value) : {};
        this.activeDate = null;

        this.dateInput = container.querySelector('.date-selector');
        this.dateDisplay = container.querySelector('.selected-date-display');
        this.slotsWrapper = container.querySelector('.slots-wrapper');
        this.addBtn = container.querySelector('.add-slot-btn');
        this.copyBtn = container.querySelector('.copy-btn');
        this.previewArea = container.querySelector('.schedule-preview');

        this.init();
    }

    init() {
        flatpickr(this.dateInput, {
            dateFormat: "Y-m-d",
            onChange: (dates, str) => {
                this.activeDate = str;
                this.dateDisplay.textContent = `Selected: ${str}`;
                this.addBtn.style.display = 'block';
                this.copyBtn.style.display = 'block';
                this.renderSlots();
            }
        });
        this.addBtn.addEventListener('click', () => {
            if (!this.data[this.activeDate]) this.data[this.activeDate] = [];
            this.data[this.activeDate].push("09:00-17:00");
            this.save();
        });
        this.copyBtn.addEventListener('click', () => this.copySchedule());
        this.updatePreview();
    }

    renderSlots() {
        this.slotsWrapper.innerHTML = '';
        const slots = this.data[this.activeDate] || [];
        slots.forEach((range, i) => {
            const [s, e] = range.split('-');
            const div = document.createElement('div');
            div.className = 'slot-entry';
            div.innerHTML = `<input type="time" class="form-control form-control-sm start-v" value="${s}"> to <input type="time" class="form-control form-control-sm end-v" value="${e}"> <button type="button" class="btn btn-sm text-danger remove-s"><i class="bi bi-x-circle"></i></button>`;
            div.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => this.syncSlots()));
            div.querySelector('.remove-s').addEventListener('click', () => {
                this.data[this.activeDate].splice(i, 1);
                if (!this.data[this.activeDate].length) delete this.data[this.activeDate];
                this.save();
            });
            this.slotsWrapper.appendChild(div);
        });
    }

    syncSlots() {
        this.data[this.activeDate] = Array.from(this.slotsWrapper.querySelectorAll('.slot-entry')).map(div => `${div.querySelector('.start-v').value}-${div.querySelector('.end-v').value}`);
        this.save();
    }

    save() {
        this.hiddenInput.value = JSON.stringify(this.data);
        this.renderSlots();
        this.updatePreview();
    }

    updatePreview() {
        this.previewArea.innerHTML = '';
        Object.keys(this.data).sort().forEach(d => {
            const tag = document.createElement('span');
            tag.className = 'schedule-tag';
            tag.innerHTML = `${d} (${this.data[d].length}) <i class="bi bi-x-circle-fill"></i>`;
            tag.querySelector('i').addEventListener('click', () => { delete this.data[d]; this.save(); });
            this.previewArea.appendChild(tag);
        });
    }

    copySchedule() {
        const dates = prompt("Target dates (YYYY-MM-DD), comma separated:");
        if (dates) {
            dates.split(',').forEach(d => this.data[d.trim()] = [...this.data[this.activeDate]]);
            this.save();
        }
    }
}