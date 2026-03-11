

let currentVisitData = null; 

document.addEventListener('DOMContentLoaded', () => {

    
    const csvBtn = document.getElementById('downloadPatientCSV');
    if (csvBtn) {
        csvBtn.onclick = () => {
            const cards = document.querySelectorAll('.patient-card');
            if (cards.length === 0) return alert("No records found.");

            let csv = "Full Name,Email,Status\n";
            cards.forEach(card => {
                const name = card.querySelector('strong')?.innerText || "N/A";
                const email = card.querySelector('.small')?.innerText || "N/A";
                const status = card.querySelector('.badge')?.innerText.trim() || "N/A";
                csv += `"${name.replace(/"/g, '""')}","${email}","${status}"\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Patients_Records.csv`;
            a.click();
        };
    }

    
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
        const patientChart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'New Patients', data: [], borderColor: '#4e73df', backgroundColor: 'rgba(78, 115, 223, 0.05)', fill: true, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: false }
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



window.openVisitDetails = async (apptId) => {
    const modalElement = document.getElementById('visitDetailModal');
    const modal = new bootstrap.Modal(modalElement);
    const loader = document.getElementById('visitLoader');
    const content = document.getElementById('visitContent');

    loader.style.display = 'block';
    content.style.display = 'none';
    modal.show();

    try {
        const response = await fetch(`/api/admin/appointment-details/${apptId}`);
        const data = await response.json();
        currentVisitData = data; 

        document.getElementById('visitDoc').innerText = data.doctor.name;
        document.getElementById('visitDate').innerText = data.date;
        document.getElementById('visitDiagnosis').innerText = data.treatment.diagnosis;
        document.getElementById('visitPrescription').innerText = data.treatment.prescription;
        
        const badge = document.getElementById('visitStatus');
        badge.innerText = data.status;
        badge.className = 'badge rounded-pill ' + (data.status === 'Completed' ? 'bg-success' : 'bg-warning text-dark');

        loader.style.display = 'none';
        content.style.display = 'block';
    } catch (err) {
        loader.innerHTML = '<p class="text-danger p-4">Error loading record.</p>';
    }
};


document.addEventListener('click', async function(e) {
    const btn = e.target.closest('#exportVisitPDFBtn');
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
            
            const statusEl = document.getElementById('pdfStatus');
            statusEl.textContent = data.status.toUpperCase();
            statusEl.style.color = (data.status === 'Cancelled') ? '#e74a3b' : '#1cc88a';
            
            document.getElementById('pdfPatientName').textContent = data.patient.name;
            document.getElementById('pdfPatientEmail').textContent = data.patient.email;
            document.getElementById('pdfPatientContact').textContent = data.patient.contact;
            document.getElementById('pdfClinicalNotes').textContent = data.patient.clinical_notes;

            document.getElementById('pdfDocName').textContent = "Dr. " + data.doctor.name;
            document.getElementById('pdfDocEmail').textContent = data.doctor.email;
            document.getElementById('pdfDocDept').textContent = data.doctor.dept;

            document.getElementById('pdfDiagnosis').textContent = data.treatment.diagnosis;
            document.getElementById('pdfPrescription').textContent = data.treatment.prescription;

            
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