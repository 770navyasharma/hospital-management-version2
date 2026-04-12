

let currentVisitData = null; 

document.addEventListener('DOMContentLoaded', () => {

    // --- Row Expansion Logic (Matching Doctors Section) ---
    document.querySelectorAll('.patient-main-row').forEach(row => {
        row.addEventListener('click', () => {
            const patientId = row.getAttribute('data-patient-id');
            const detailsRow = document.getElementById(`patient-details-${patientId}`);
            const isVisible = detailsRow.style.display === 'table-row';

            // Close all other rows
            document.querySelectorAll('.patient-details-row').forEach(dr => dr.style.display = 'none');
            document.querySelectorAll('.patient-main-row').forEach(mr => mr.classList.remove('active-row'));

            if (!isVisible) {
                detailsRow.style.display = 'table-row';
                row.classList.add('active-row');
            }
        });
    });

    // --- CSV Export Logic ---
    const csvBtn = document.getElementById('downloadPatientCSV');
    if (csvBtn) {
        csvBtn.onclick = () => {
            const rows = document.querySelectorAll('.patient-main-row');
            if (rows.length === 0) return alert("No records found.");

            let csv = "Full Name,Email,Account Status,Registry Status\n";
            rows.forEach(row => {
                const name = row.querySelector('.patient-name-field')?.innerText || "N/A";
                const email = row.querySelector('.patient-email-field')?.innerText || "N/A";
                const accStatus = row.classList.contains('blacklisted') ? "Offboarded" : "Active";
                const regStatus = row.querySelector('[class^="badge-status-"]')?.innerText.trim() || "N/A";
                
                csv += `"${name.replace(/"/g, '""')}","${email}","${accStatus}","${regStatus}"\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Patient_Directory_Registry.csv`;
            a.click();
        };
    }

    // --- Chart Logic ---
    const confModalEl = document.getElementById('confirmationModal');
    if (confModalEl) {
        confModalEl.addEventListener('show.bs.modal', function (event) {
            const button = event.relatedTarget;
            const action = button.getAttribute('data-action-type');
            const name = button.getAttribute('data-patient-name');
            document.getElementById('confirmationModalText').innerHTML = `Are you sure you want to <b>${action}</b> patient <b>${name}</b>?`;
            document.getElementById('confirmActionButton').onclick = () => button.closest('form').submit();
        });
    }

    const ctx = document.getElementById('patientChart');
    if (ctx && typeof Chart !== 'undefined') {
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.18)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

        const patientChart = new Chart(ctx, {
            type: 'line',
            data: { 
                labels: [], 
                datasets: [{ 
                    label: 'Unique Patient Registry', 
                    data: [], 
                    borderColor: '#6366f1', 
                    backgroundColor: gradient, 
                    fill: true, 
                    tension: 0.4,
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#6366f1',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleColor: '#94a3b8',
                        bodyColor: '#fff',
                        bodyFont: { weight: '700', size: 14 },
                        padding: 12,
                        cornerRadius: 10,
                        displayColors: false,
                        callbacks: {
                            title: (items) => {
                                const d = new Date(items[0].label);
                                return isNaN(d) ? items[0].label : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                            },
                            label: (item) => `  ${item.raw} patient${item.raw !== 1 ? 's' : ''}`
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
                        border: { display: false },
                        ticks: { 
                            stepSize: 1,
                            precision: 0,
                            font: { weight: '600', size: 11 },
                            color: '#94a3b8',
                            maxTicksLimit: 6
                        }
                    },
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { 
                            font: { weight: '500', size: 10 },
                            color: '#94a3b8',
                            maxTicksLimit: 8,
                            maxRotation: 0,
                            callback: function(val, index) {
                                // Show a shortened date label: "Mar 13"
                                const label = this.getLabelForValue(val);
                                const d = new Date(label);
                                if (isNaN(d)) return label;
                                return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                            }
                        }
                    }
                }
            }
        });

        async function refreshChart() {
            const start = document.getElementById('startDate').value;
            const end = document.getElementById('endDate').value;
            const res = await fetch(`/admin/api/patient_stats?start_date=${start}&end_date=${end}`);
            const data = await res.json();
            patientChart.data.labels = data.labels;
            patientChart.data.datasets[0].data = data.new_patients_data;
            patientChart.update();
        }

        flatpickr("#startDate", { dateFormat: "Y-m-d", onChange: refreshChart });
        flatpickr("#endDate", { dateFormat: "Y-m-d", onChange: refreshChart });
        refreshChart();
    }
});



window.openVisitDetailsInline = async (apptId, patientId) => {
    const historyPanel = document.getElementById(`historyPanel-${patientId}`);
    const detailPanel = document.getElementById(`detailPanel-${patientId}`);
    const loading = document.getElementById(`detailLoading-${patientId}`);
    const content = document.getElementById(`detailContent-${patientId}`);

    // Toggle panels
    historyPanel.style.display = 'none';
    detailPanel.style.display = 'block';
    loading.style.display = 'flex';
    content.style.display = 'none';

    try {
        const response = await fetch(`/api/admin/appointment-details/${apptId}`);
        const data = await response.json();
        currentVisitData = data; // Keep for PDF export

        // Populate header
        document.querySelector(`.vd-doc-pic-${patientId}`).src = data.doctor.pic;
        document.querySelector(`.vd-doc-name-${patientId}`).innerText = 'Dr. ' + data.doctor.name;
        document.querySelector(`.vd-doc-dept-${patientId}`).innerText = data.doctor.degree ? `${data.doctor.degree} · ${data.doctor.dept}` : data.doctor.dept;
        document.querySelector(`.vd-date-${patientId}`).innerText = data.date;

        // Status badge
        const statusBadge = document.querySelector(`.vd-status-${patientId}`);
        statusBadge.innerText = data.status;
        statusBadge.className = `vd-status-${patientId} badge rounded-pill px-3 py-2 fw-bold text-uppercase smallest ${
            data.status === 'Completed' ? 'bg-success text-white' :
            data.status === 'Cancelled' ? 'bg-danger text-white' : 'bg-warning text-dark'
        }`;

        // Body content
        document.querySelector(`.vd-reason-${patientId}`).innerText = data.urgent_note ? `"${data.urgent_note}"` : 'No reason recorded.';
        document.querySelector(`.vd-history-${patientId}`).innerText = data.patient.medical_history || 'No medical history on record.';
        document.querySelector(`.vd-diagnosis-${patientId}`).innerText = data.treatment.diagnosis || 'No diagnosis recorded';
        document.querySelector(`.vd-notes-${patientId}`).innerText = data.treatment.clinical_notes || 'No detailed observations provided.';

        // Medications
        const medList = document.querySelector(`.vd-meds-${patientId}`);
        const noMed = document.querySelector(`.vd-nomeds-${patientId}`);
        const meds = (data.treatment.prescription || '').split(',').map(m => m.trim()).filter(m => m);

        medList.innerHTML = '';
        if (meds.length > 0) {
            noMed.style.display = 'none';
            meds.forEach(m => {
                medList.insertAdjacentHTML('beforeend', `
                    <div class="d-flex align-items-center gap-2 small fw-bold text-dark">
                        <i class="bi bi-capsule text-success fs-5"></i> ${m}
                    </div>`);
            });
        } else {
            noMed.style.display = 'block';
        }

        // Attachments
        const attList = document.querySelector(`.vd-atts-${patientId}`);
        const noAtt = document.querySelector(`.vd-noatts-${patientId}`);

        attList.innerHTML = '';
        if (data.treatment.attachments && data.treatment.attachments.length > 0) {
            noAtt.style.display = 'none';
            data.treatment.attachments.forEach(file => {
                const icon = file.type === 'image' ? 'bi-image text-info' : (file.type === 'pdf' ? 'bi-file-pdf text-danger' : 'bi-file-earmark text-muted');
                const card = `
                    <div class="bg-light rounded-4 d-flex align-items-center p-3 border cursor-pointer gap-3" onclick="openPreview('${file.name}', '${file.type}', '${file.path}')" style="cursor:pointer; transition: background 0.2s;">
                        <div class="bg-white rounded-3 p-2 text-center" style="min-width:44px;">
                            <i class="bi ${icon} fs-4"></i>
                        </div>
                        <div class="overflow-hidden flex-grow-1">
                            <div class="small fw-bold text-dark text-truncate">${file.name}</div>
                            <div class="smallest text-muted text-uppercase">${file.type}</div>
                        </div>
                        <i class="bi bi-eye text-primary opacity-50 flex-shrink-0"></i>
                    </div>`;
                attList.insertAdjacentHTML('beforeend', card);
            });
        } else {
            noAtt.style.display = 'block';
        }

        loading.style.display = 'none';
        content.style.display = 'block';

    } catch (err) {
        console.error(err);
        loading.innerHTML = `
            <div class="text-center p-4">
                <i class="bi bi-exclamation-circle fs-1 text-danger d-block mb-3"></i>
                <p class="text-muted fw-bold mb-3">Could not load details.</p>
                <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="closeVisitDetail(${patientId})">Go Back</button>
            </div>`;
    }
};

window.closeVisitDetail = (patientId) => {
    document.getElementById(`historyPanel-${patientId}`).style.display = 'block';
    document.getElementById(`detailPanel-${patientId}`).style.display = 'none';
    currentVisitData = null;
};

window.openPreview = (name, type, path) => {
    document.getElementById('previewTitle').innerText = name;
    document.getElementById('previewSubtitle').innerText = `${type.toUpperCase()} DOCUMENT PREVIEW`;
    document.getElementById('previewDownloadBtn').href = path;
    
    const container = document.getElementById('previewContainer');
    container.innerHTML = '';
    
    if (type === 'image') {
        container.innerHTML = `<img src="${path}" class="img-fluid h-100 w-100 object-fit-contain animate-fade-in">`;
    } else if (type === 'pdf') {
        container.innerHTML = `<iframe src="${path}" class="w-100 h-100 border-0"></iframe>`;
    } else {
        container.innerHTML = `
            <div class="text-center text-white p-5">
                <i class="bi bi-file-earmark-arrow-down-fill fs-1 mb-3 opacity-50"></i>
                <h4 class="fw-bold">Preview Not Available</h4>
                <p class="small opacity-50 mb-4">This file type cannot be previewed directly.</p>
                <a href="${path}" target="_blank" class="btn btn-primary rounded-pill px-5">DOWNLOAD FILE</a>
            </div>`;
    }
    
    new bootstrap.Modal(document.getElementById('previewModal')).show();
};


document.addEventListener('click', async function(e) {
    const btn = e.target.closest('[class*="vd-export-btn-"]');
    if (btn) {
        if (typeof html2pdf === 'undefined') return alert("PDF Library not loaded.");
        if (!currentVisitData) return alert("Please wait for record to load.");

        
        const originalBtnText = btn.innerHTML;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Rendering...`;
        btn.style.pointerEvents = 'none';

        const data = currentVisitData;
        const container = document.getElementById('pdfExportTemplate');
        
        try {
            
            document.getElementById('pdfApptId').textContent = data.id;
            document.getElementById('pdfDate').textContent = data.date;
            document.getElementById('pdfGeneratedDate').textContent = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            
            document.getElementById('pdfStatus').textContent = data.status.toUpperCase();
            document.getElementById('pdfStatus').style.color = (data.status === 'Completed') ? '#1cc88a' : '#f6c23e';
            
            document.getElementById('pdfPatientName').textContent = data.patient.name;
            document.getElementById('pdfPatientEmail').textContent = data.patient.email;
            document.getElementById('pdfPatientContact').textContent = data.patient.contact;
            
            document.getElementById('pdfDocName').textContent = "Dr. " + data.doctor.name;
            document.getElementById('pdfDocEmail').textContent = data.doctor.email;
            document.getElementById('pdfDocDept').textContent = data.doctor.dept;

            document.getElementById('pdfDiagnosis').textContent = data.treatment.diagnosis;
            document.getElementById('pdfPrescription').textContent = data.treatment.prescription;
            document.getElementById('pdfClinicalNotes').textContent = data.treatment.clinical_notes || "No detailed observations provided.";

            
            container.style.display = 'block';
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.zIndex = '-9999';
            container.style.opacity = '1';

            const elementToCapture = document.getElementById('pdfInnerContent');

            const opt = {
                margin: 0,
                filename: `Medical_Report_${data.patient.name.replace(/\s+/g, '_')}.pdf`,
                image: { type: 'jpeg', quality: 1.0 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false, 
                    letterRendering: true,
                    backgroundColor: '#ffffff'
                },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            
            await new Promise(r => setTimeout(r, 1000));
            
            
            await html2pdf().set(opt).from(elementToCapture).save();

        } catch (err) {
            console.error("PDF Export Failed:", err);
            alert("Export error occurred.");
        } finally {
            container.style.display = 'none';
            btn.innerHTML = originalBtnText;
            btn.style.pointerEvents = 'auto';
        }
    }
});
// --- Full Case File PDF Export ---
document.addEventListener('click', async function(e) {
    const btn = e.target.closest('.download-case-file-btn');
    if (btn) {
        const patientId = btn.getAttribute('data-patient-id');
        const originalBtnText = btn.innerHTML;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Preparing Case File...`;
        btn.style.pointerEvents = 'none';

        try {
            const res = await fetch(`/api/admin/patient-case-file/${patientId}`);
            const data = await res.json();

            // Populate Template
            document.getElementById('casePatientName').textContent = data.info.name;
            document.getElementById('casePatientEmail').textContent = data.info.email;
            document.getElementById('caseReportDate').textContent = new Date().toLocaleDateString();
            
            document.getElementById('caseProfileName').textContent = data.info.name;
            document.getElementById('caseProfileContact').textContent = data.info.contact;
            document.getElementById('caseProfileStatus').textContent = data.info.status;
            document.getElementById('caseHistoryText').textContent = data.info.medical_history;

            const tableBody = document.getElementById('caseVisitTableBody');
            tableBody.innerHTML = data.history.map(v => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px; font-weight: 600;">${v.date}</td>
                    <td style="padding: 12px;">${v.doctor}</td>
                    <td style="padding: 12px; color: #666;">${v.diagnosis}</td>
                    <td style="padding: 12px;"><span style="color: ${v.status === 'Completed' ? '#198754' : '#f59e0b'}; font-weight: 700;">${v.status}</span></td>
                </tr>
            `).join('') || `<tr><td colspan="4" style="padding: 30px; text-align: center; color: #999;">No visit history found.</td></tr>`;

            const container = document.getElementById('fullCaseFileTemplate');
            container.style.display = 'block';
            container.style.position = 'fixed';
            container.style.left = '-10000px'; 
            
            const element = document.getElementById('fullCaseFileInner');
            const opt = {
                margin: 0,
                filename: `Case_File_${data.info.name.replace(/\s+/g, '_')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            await html2pdf().set(opt).from(element).save();
            container.style.display = 'none';

        } catch (err) {
            console.error(err);
            alert("Failed to generate Case File.");
        } finally {
            btn.innerHTML = originalBtnText;
            btn.style.pointerEvents = 'auto';
        }
    }
});
