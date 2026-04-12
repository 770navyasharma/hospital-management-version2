document.addEventListener('DOMContentLoaded', () => {
    let currentVisitData = null;
    let trendChart, statusChart;
    const chartEl1 = document.getElementById('trendChart');
    const chartEl2 = document.getElementById('statusChart');
    const ctxTrend = chartEl1 ? chartEl1.getContext('2d') : null;
    const ctxStatus = chartEl2 ? chartEl2.getContext('2d') : null;
    const tableBody = document.getElementById('apptTableBody');
    const patientSearch = document.getElementById('patientSearch');
    
    
    let currentData = []; 
    let filteredData = []; 
    let currentPage = 1;
    const entriesPerPage = 10;

    
    const fp = flatpickr("#dateRangePicker", {
        mode: "range",
        dateFormat: "Y-m-d",
        defaultDate: [new Date(new Date().setDate(new Date().getDate() - 180)), new Date()],
        onClose: (selectedDates) => {
            if (selectedDates.length === 2) {
                const start = selectedDates[0].toISOString().split('T')[0];
                const end = selectedDates[1].toISOString().split('T')[0];
                document.getElementById('presetFilters').value = "";
                refreshData(null, start, end);
            }
        }
    });

    document.getElementById('presetFilters').addEventListener('change', (e) => {
        if (e.target.value) {
            fp.clear();
            refreshData(e.target.value);
        }
    });

    
    async function refreshData(days = 180, start = null, end = null) {
        let url = `/api/admin/appointment-stats?days=${days}`;
        if (start && end) {
            url = `/api/admin/appointment-stats?start_date=${start}&end_date=${end}`;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();
            
            currentData = data.appointments || [];
            filteredData = [...currentData]; 
            currentPage = 1;
            
            renderCharts(data);
            displayTablePage();
        } catch (error) {
            console.error("Error loading analytics data:", error);
        }
    }

    
    function displayTablePage() {
        tableBody.innerHTML = '';
        const startIndex = (currentPage - 1) * entriesPerPage;
        const endIndex = startIndex + entriesPerPage;
        const pageItems = filteredData.slice(startIndex, endIndex);

        if (pageItems.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No records found.</td></tr>';
            updatePaginationControls(0);
            return;
        }

        pageItems.forEach(appt => {
            const row = `
                <tr class="align-middle">
                    <td class="ps-4">
                        <div class="fw-black text-dark">${appt.date.split(' ')[0]}</div>
                        <div class="smallest fw-bold text-muted text-uppercase ls-1">${appt.date.split(' ').slice(1).join(' ')}</div>
                    </td>
                    <td>
                        <div class="d-flex align-items-center gap-3">
                            <div class="bg-primary bg-opacity-10 text-primary rounded-pill p-2" style="width: 35px; height: 35px; display: flex; align-items: center; justify-content: center;">
                                <i class="bi bi-person-fill"></i>
                            </div>
                            <div class="fw-black text-dark text-uppercase smallest ls-1">${appt.patient}</div>
                        </div>
                    </td>
                    <td>
                        <div class="d-flex align-items-center gap-3">
                            <div class="bg-info bg-opacity-10 text-info rounded-pill p-2" style="width: 35px; height: 35px; display: flex; align-items: center; justify-content: center;">
                                <i class="bi bi-hospital-fill"></i>
                            </div>
                            <div class="fw-black text-dark text-uppercase smallest ls-1">Dr. ${appt.doctor}</div>
                        </div>
                    </td>
                    <td class="text-center">
                        <span class="status-badge status-${appt.status.toLowerCase()}">${appt.status}</span>
                    </td>
                    <td class="text-end pe-4">
                        <a href="javascript:void(0)" class="view-link justify-content-end" onclick="viewDetails(${appt.id})">
                            VIEW RECORD <i class="bi bi-arrow-right"></i>
                        </a>
                    </td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });

        updatePaginationControls(filteredData.length);
    }

    function updatePaginationControls(totalItems) {
        const totalPages = Math.ceil(totalItems / entriesPerPage);
        const controls = document.getElementById('paginationControls');
        const info = document.getElementById('paginationInfo');
        
        controls.innerHTML = '';
        const start = totalItems === 0 ? 0 : (currentPage - 1) * entriesPerPage + 1;
        const end = Math.min(currentPage * entriesPerPage, totalItems);
        info.textContent = `Showing ${start} to ${end} of ${totalItems} entries`;

        if (totalPages <= 1) return;

        
        controls.insertAdjacentHTML('beforeend', `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Prev</a>
            </li>
        `);

        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                controls.insertAdjacentHTML('beforeend', `
                    <li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
                    </li>
                `);
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                controls.insertAdjacentHTML('beforeend', `<li class="page-item disabled"><span class="page-link">...</span></li>`);
            }
        }

        
        controls.insertAdjacentHTML('beforeend', `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Next</a>
            </li>
        `);
    }

    window.changePage = (page) => {
        const totalPages = Math.ceil(filteredData.length / entriesPerPage);
        if (page < 1 || page > totalPages) return;
        currentPage = page;
        displayTablePage();
    };

    
    patientSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        filteredData = currentData.filter(appt => 
            appt.patient.toLowerCase().includes(term) || 
            appt.doctor.toLowerCase().includes(term)
        );
        currentPage = 1;
        displayTablePage();
    });

    
    document.getElementById('downloadCSV').addEventListener('click', () => {
        if (filteredData.length === 0) {
            alert("No data available to export.");
            return;
        }

        const headers = ["Date & Time", "Patient Name", "Doctor Name", "Status"];
        const rows = filteredData.map(appt => [
            `"${appt.date}"`,
            `"${appt.patient}"`,
            `"${appt.doctor}"`,
            `"${appt.status}"`
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `HMS_Appointments_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    
    function renderCharts(data) {
        if (!ctxTrend || !ctxStatus) return;
        if (trendChart) trendChart.destroy();
        if (statusChart) statusChart.destroy();

        // --- 1. Trend Chart with Zero-filling ---
        const start = fp.selectedDates.length === 2 ? fp.selectedDates[0] : new Date(new Date().setDate(new Date().getDate() - 30));
        const end = fp.selectedDates.length === 2 ? fp.selectedDates[1] : new Date();
        
        const dateLabels = [];
        const appointmentCounts = [];
        let curr = new Date(start);
        const dataMap = {};
        data.line_chart.forEach(d => { dataMap[d.date] = d.count; });

        while (curr <= end) {
            const dateStr = curr.toISOString().split('T')[0];
            dateLabels.push(new Date(curr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            appointmentCounts.push(dataMap[dateStr] || 0);
            curr.setDate(curr.getDate() + 1);
        }

        const trendGrad = ctxTrend.createLinearGradient(0, 0, 0, 300);
        trendGrad.addColorStop(0, 'rgba(78, 115, 223, 0.2)');
        trendGrad.addColorStop(1, 'rgba(78, 115, 223, 0)');

        trendChart = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: dateLabels,
                datasets: [{
                    label: 'Appointments',
                    data: appointmentCounts,
                    borderColor: '#4e73df',
                    backgroundColor: trendGrad,
                    fill: true,
                    tension: 0.4,
                    pointRadius: dateLabels.length > 31 ? 0 : 4,
                    pointHoverRadius: 8,
                    borderWidth: 3
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        grid: { color: '#f1f5f9' },
                        ticks: { stepSize: 1, color: '#94a3b8' } 
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', maxRotation: 0 }
                    }
                }
            }
        });

        // --- 2. Status Chart ---
        const statusLabels = Object.keys(data.status_pie);
        const statusValues = Object.values(data.status_pie);
        const hasData = statusValues.length > 0 && statusValues.some(v => v > 0);

        const colorMap = {
            'Booked': '#4e73df',    
            'Completed': '#1cc88a', 
            'Cancelled': '#e74a3b',
            'Ongoing': '#f6c23e',
            'Requested': '#36b9cc'
        };
        const backgroundColors = statusLabels.map(label => colorMap[label] || '#858796');

        statusChart = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: hasData ? statusLabels : ['No Activity'],
                datasets: [{
                    data: hasData ? statusValues : [1],
                    backgroundColor: hasData ? backgroundColors : ['#f1f5f9'],
                    borderWidth: 0,
                    hoverOffset: 15
                }]
            },
            options: { 
                maintainAspectRatio: false, 
                cutout: '75%',
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        labels: { usePointStyle: true, padding: 20, font: { weight: 'bold' } } 
                    }
                }
            }
        });
    }


    window.viewDetails = async (id) => {
        const modalEl = document.getElementById('apptDetailModal');
        if (!modalEl) {
            console.error("Modal element #apptDetailModal not found");
            return;
        }
        
        const allOpenModals = document.querySelectorAll('.modal.show');
        allOpenModals.forEach(m => {
            if (m.id !== 'apptDetailModal') {
                const bsModal = bootstrap.Modal.getInstance(m);
                if (bsModal) bsModal.hide();
            }
        });

        const loader = document.getElementById('visitLoader');
        const content = document.getElementById('visitContent');
        
        if (loader) {
            loader.classList.remove('d-none');
            loader.classList.add('d-flex');
        }
        if (content) content.style.display = 'none';
        
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: true });
        modal.show();

        try {
            const res = await fetch(`/api/admin/appointment-details/${id}`);
            if (!res.ok) throw new Error("API request failed");
            const data = await res.json(); 
            currentVisitData = data;
            
            // Header: Doctor info + date
            document.getElementById('visitDoctorPic').src = data.doctor.pic;
            document.getElementById('visitDoctorName').innerText = 'Dr. ' + data.doctor.name;
            document.getElementById('visitDoctorDept').innerText = data.doctor.degree ? `${data.doctor.degree} · ${data.doctor.dept}` : data.doctor.dept;
            document.getElementById('visitDateDisplay').innerText = data.date;

            // Header: Patient strip
            document.getElementById('visitPatientPic').src = data.patient.pic;
            document.getElementById('visitPatientName').innerText = data.patient.name;

            // Status badge
            const statusBadge = document.getElementById('visitStatusBadge');
            statusBadge.innerText = data.status;
            statusBadge.className = `badge ms-auto rounded-pill px-3 py-2 fw-bold text-uppercase smallest ${
                data.status === 'Completed' ? 'bg-success text-white' :
                data.status === 'Cancelled' ? 'bg-danger text-white' : 'bg-warning text-dark'
            }`;

            // Body: Reason for visit + medical history
            document.getElementById('visitInternalNotes').innerText =
                data.urgent_note ? `"${data.urgent_note}"` : 'No reason recorded.';
            document.getElementById('visitPatientHistory').innerText =
                data.patient.medical_history || 'No medical history on record.';

            // Doctor's assessment
            document.getElementById('visitDiagnosisDisplay').innerText =
                data.treatment.diagnosis || 'No diagnosis recorded';
            document.getElementById('visitClinicalNotesDisplay').innerText =
                data.treatment.clinical_notes || 'No notes recorded.';

            // Medications
            const medList = document.getElementById('medicationList');
            const noMed = document.getElementById('noMedication');
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
            const attList = document.getElementById('attachmentList');
            const noAtt = document.getElementById('noAttachments');

            attList.innerHTML = '';
            if (data.treatment.attachments && data.treatment.attachments.length > 0) {
                noAtt.style.display = 'none';
                data.treatment.attachments.forEach(file => {
                    const icon = file.type === 'image' ? 'bi-image text-info' : (file.type === 'pdf' ? 'bi-file-pdf text-danger' : 'bi-file-earmark text-muted');
                    const card = `
                        <div class="bg-white rounded-4 d-flex align-items-center p-3 border cursor-pointer gap-3" onclick="openPreview('${file.name}', '${file.type}', '${file.path}')" style="cursor:pointer; transition: background 0.2s;">
                            <div class="bg-light rounded-3 p-2 text-center" style="min-width:44px;">
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

            // Hook up PDF export
            document.getElementById('exportVisitPDFBtn').onclick = () => exportAppointmentPDF();

            // Show content, hide loader
            if (loader) {
                loader.classList.remove('d-flex');
                loader.classList.add('d-none');
            }
            if (content) content.style.display = 'block';

        } catch (err) { 
            console.error(err);
            if (loader) loader.innerHTML = `<div class="p-5 text-danger"><i class="bi bi-exclamation-circle fs-1 d-block mb-3"></i><h5>Failed to load data</h5><p class="small text-muted">${err.message}</p></div>`;
        }
    };

    window.openPreview = (name, type, path) => {
        document.getElementById('previewTitle').innerText = name;
        document.getElementById('previewSubtitle').innerText = `${type.toUpperCase()} DOCUMENT PREVIEW`;
        document.getElementById('previewDownloadBtn').href = path;
        
        const container = document.getElementById('previewContainer');
        container.innerHTML = '';
        
        if (type === 'image') {
            container.innerHTML = `<img src="${path}" class="img-fluid h-100 w-100 object-fit-contain">`;
        } else if (type === 'pdf') {
            container.innerHTML = `<iframe src="${path}" class="w-100 h-100 border-0"></iframe>`;
        } else {
            container.innerHTML = `<div class="text-center text-white p-5"><i class="bi bi-file-earmark-arrow-down-fill fs-1 mb-3 opacity-50"></i><h4 class="fw-bold">Preview Not Available</h4><a href="${path}" target="_blank" class="btn btn-primary rounded-pill px-5">DOWNLOAD FILE</a></div>`;
        }
        
        new bootstrap.Modal(document.getElementById('previewModal')).show();
    };

    const toBase64 = url => fetch(url)
        .then(res => res.blob())
        .then(blob => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        })).catch(() => "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

    window.exportAppointmentPDF = async (data) => {
        data = data || currentVisitData;
        if (!data) return alert("Report data not loaded.");
        const element = document.getElementById('pdfExportTemplate');
        const toast = document.createElement('div');
        toast.innerHTML = '<div style="position:fixed;top:20px;right:20px;padding:15px;background:#333;color:white;border-radius:8px;z-index:10000;">Generating Sharp PDF...</div>';
        document.body.appendChild(toast);

        try {
            document.getElementById('pdfApptId').innerText = data.id;
            document.getElementById('pdfDate').innerText = data.date;
            document.getElementById('pdfGeneratedDate').innerText = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            
            document.getElementById('pdfStatus').innerText = data.status.toUpperCase();
            document.getElementById('pdfStatus').style.color = (data.status === 'Completed') ? '#1cc88a' : '#f6c23e';
            
            document.getElementById('pdfPatientName').innerText = data.patient.name;
            document.getElementById('pdfPatientEmail').innerText = data.patient.email;
            document.getElementById('pdfPatientContact').innerText = data.patient.contact;

            document.getElementById('pdfDocName').innerText = "Dr. " + data.doctor.name;
            document.getElementById('pdfDocEmail').innerText = data.doctor.email;
            document.getElementById('pdfDocDept').innerText = data.doctor.dept;
            
            document.getElementById('pdfDiagnosis').innerText = data.treatment.diagnosis;
            document.getElementById('pdfPrescription').innerText = data.treatment.prescription;
            document.getElementById('pdfClinicalNotes').innerText = data.treatment.clinical_notes || "No detailed observations provided.";

            
            const [pBase64, dBase64] = await Promise.all([toBase64(data.patient.pic), toBase64(data.doctor.pic)]);
            document.getElementById('pdfPatientImg').src = pBase64;
            document.getElementById('pdfDocImg').src = dBase64;

            element.style.display = 'block';

            const opt = {
                margin: 0,
                filename: `HMS_Report_${data.patient.name.replace(/\s+/g, '_')}.pdf`,
                image: { type: 'jpeg', quality: 1.0 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true, width: 794 },
                jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait', hotfixes: ['px_scaling'] }
            };

            await html2pdf().set(opt).from(element).save();
        } finally {
            element.style.display = 'none';
            document.body.removeChild(toast);
        }
    };

    refreshData(180);
});