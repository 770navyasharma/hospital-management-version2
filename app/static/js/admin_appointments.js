

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
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        
        const loader = document.getElementById('modalContentLoader');
        const content = document.getElementById('modalActualContent');
        
        if (loader) loader.style.display = 'block';
        if (content) content.style.display = 'none';
        
        modal.show();

        try {
            const res = await fetch(`/api/admin/appointment-details/${id}`);
            if (!res.ok) throw new Error("API request failed");
            const d = await res.json(); 
            currentVisitData = d;
            
            if (loader) loader.style.display = 'none';
            if (content) {
                content.style.display = 'block';
            }

            const meds = (d.treatment.prescription || '').split(',').map(m => m.trim()).filter(m => m);
            const medChips = meds.map(m => `
                <span class="badge bg-success-soft text-success border border-success-subtle px-3 py-2 rounded-pill fw-bold">
                    <i class="bi bi-capsule me-2"></i>${m}
                </span>`).join('');

            const attachmentCards = (d.treatment.attachments || []).map(file => {
                const icon = file.type === 'image' ? 'bi-image text-info' : (file.type === 'pdf' ? 'bi-file-pdf text-danger' : 'bi-file-earmark text-muted');
                return `
                    <div class="bg-light rounded-4 d-flex align-items-center p-3 border cursor-pointer hover-lift gap-3 transition-all" onclick="openPreview('${file.name}', '${file.type}', '${file.path}')">
                        <div class="bg-white rounded-3 p-2 shadow-sm text-center" style="min-width:44px;">
                            <i class="bi ${icon} fs-4"></i>
                        </div>
                        <div class="overflow-hidden flex-grow-1 text-start">
                            <div class="small fw-bold text-dark text-truncate">${file.name}</div>
                            <div class="smallest text-muted">${file.type.toUpperCase()} DOCUMENT</div>
                        </div>
                        <i class="bi bi-eye text-primary opacity-50 flex-shrink-0"></i>
                    </div>`;
            }).join('');

            content.innerHTML = `
                <div class="row g-0 h-100">
                    <!-- Left Sidebar -->
                    <div class="col-md-3 bg-light border-end p-4 d-flex flex-column">
                        <div class="text-center mb-4">
                            <div class="position-relative d-inline-block mb-3">
                                <img src="${d.patient.pic}" class="rounded-circle border border-4 border-white shadow-sm" width="100" height="100" style="object-fit: cover;">
                            </div>
                            <h5 class="fw-black mb-1 text-dark">${d.patient.name}</h5>
                            <span class="smallest fw-bold text-muted text-uppercase ls-1">Appointment Record</span>
                        </div>

                        <div class="bg-white rounded-4 p-3 shadow-sm mb-4 text-start">
                            <label class="smallest fw-bold text-muted text-uppercase mb-2 d-block ls-1">Attending Specialist</label>
                            <div class="d-flex align-items-center gap-3">
                                <img src="${d.doctor.pic}" class="rounded-circle border" width="40" height="40" style="object-fit: cover;">
                                <div>
                                    <h6 class="fw-bold text-primary mb-0 smallest">${d.doctor.name}</h6>
                                    <div class="smallest text-muted fw-bold">${d.doctor.dept}</div>
                                </div>
                            </div>
                        </div>

                        <div class="bg-primary-soft rounded-4 p-3 mb-4 text-start">
                            <label class="smallest fw-bold text-primary text-uppercase mb-1 ls-1">Visit Date</label>
                            <div class="fw-black text-primary" style="font-size: 1.1rem;">${d.date}</div>
                        </div>

                        <div class="mt-auto">
                            <button class="btn btn-dark w-100 rounded-pill py-3 fw-bold shadow-sm" onclick="exportAppointmentPDF()">
                                <i class="bi bi-file-pdf me-2"></i> DOWNLOAD PDF
                            </button>
                            <button type="button" class="btn btn-outline-secondary w-100 rounded-pill py-2 mt-2 fw-bold" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>

                    <!-- Right Section -->
                    <div class="col-md-9 d-flex flex-column h-100 bg-white">
                        <div class="d-flex justify-content-between align-items-center p-4 px-5 border-bottom bg-white sticky-top">
                            <h5 class="fw-black m-0 text-uppercase ls-1"><i class="bi bi-file-earmark-medical me-2 text-primary"></i> Clinical Visit Summary</h5>
                            <span class="badge rounded-pill px-3 py-2 ${d.status === 'Completed' ? 'bg-success' : 'bg-warning text-dark'}">${d.status.toUpperCase()}</span>
                        </div>

                        <div class="flex-grow-1 p-5 overflow-auto custom-scroll text-start">
                            <div class="row g-5">
                                <div class="col-md-7">
                                    <section class="mb-5">
                                        <h6 class="fw-bold text-primary mb-3 text-uppercase smallest ls-1">Chief Complaint & Context</h6>
                                        <div class="p-4 bg-light-soft rounded-4 border-start border-4 border-primary shadow-sm">
                                            <p class="small text-dark fw-medium italic mb-0">${d.urgent_note || "No specific intake reason provided."}</p>
                                        </div>
                                    </section>

                                    <section class="mb-5">
                                        <h6 class="fw-bold text-primary mb-3 text-uppercase smallest ls-1">Final Diagnosis</h6>
                                        <div class="p-4 bg-primary-soft rounded-4 border border-primary-subtle shadow-sm">
                                            <h5 class="fw-black text-primary mb-0">${d.treatment.diagnosis}</h5>
                                        </div>
                                    </section>

                                    <section>
                                        <h6 class="fw-bold text-primary mb-3 text-uppercase smallest ls-1">Clinical Observations</h6>
                                        <div class="p-4 bg-white rounded-4 border shadow-sm">
                                            <p class="small text-secondary mb-0" style="white-space: pre-wrap;">${d.treatment.clinical_notes || "No detailed clinical observations recorded."}</p>
                                        </div>
                                    </section>
                                </div>

                                <div class="col-md-5">
                                    <section class="mb-5">
                                        <h6 class="fw-bold text-success mb-3 text-uppercase smallest ls-1">Prescribed Medication</h6>
                                        <div class="d-flex flex-wrap gap-2 pt-2">
                                            ${medChips || '<div class="smallest text-muted italic p-3 text-center border rounded-4 border-dashed w-100">No medication prescribed.</div>'}
                                        </div>
                                    </section>

                                    <section>
                                        <h6 class="fw-bold text-secondary mb-3 text-uppercase smallest ls-1">Consultation Attachments</h6>
                                        <div class="d-grid gap-2">
                                            ${attachmentCards || '<div class="text-center py-4 opacity-50 bg-light rounded-4 border border-dashed"><i class="bi bi-paperclip fs-2 mb-1 d-block"></i><span class="smallest fw-bold text-muted">No attachments.</span></div>'}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
        } catch (err) { console.error(err); }
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