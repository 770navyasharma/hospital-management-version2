// doctor_shared.js v3.2 — Global logic, fixed saveSession + PDF generator
(function () {
    const { reactive } = Vue;

    const globalState = reactive({
        requests: [],
        urgentQueue: [],
        currentUrgent: null,
        alertAnimation: '',
        knownReqIds: new Set(),
        toasts: [],
        confirmModal: { show: false, title: '', message: '', onConfirm: null, onCancel: null },
        durationModal: { show: false, apptId: null, duration: 30 },
        showNotifications: false,
        doctorName: '',
        statusOverride: 'auto',
        currentStatus: 'offline',
        ongoingAppt: null,
        showCompleteModal: false,
        // Rejection Globals
        showRejectModal: false,
        rejectReason: '',
        selectedReqId: null,
        // Swipe States
        touchStart: 0,
        swipeOffset: 0,
        swipingId: null,
        // Attachment Preview
        activePreview: { show: false, path: '', type: '', name: '' },
        // Global Past Visit Detail
        showPastApptModal: false,
        selectedPastAppt: {}
    });

    const sharedMethods = {

        async setDoctorStatus(status) {
            try {
                const res = await fetch('/doctor/api/doctor/update-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status })
                });
                if (res.ok) {
                    sharedMethods.showToast(`Status updated to ${status}`);
                    await sharedMethods.fetchGlobalData();
                }
            } catch (e) { console.error("Status update error:", e); }
        },

        getStatusColor(status) {
            const colors = { 'available': '#1cc88a', 'busy': '#e74a3b', 'offline': '#858796', 'break': '#f6c23e' };
            return colors[status] || '#858796';
        },

        openDurationModal(id) {
            globalState.durationModal.apptId = id;
            globalState.durationModal.duration = 30;
            globalState.durationModal.show = true;
        },

        async submitDuration() {
            const id = globalState.durationModal.apptId;
            const duration = globalState.durationModal.duration;
            globalState.durationModal.show = false;
            await sharedMethods.processReq(id, 'Booked', { duration });
        },

        async fetchGlobalData() {
            try {
                const res = await fetch('/doctor/api/doctor/stats');
                if (!res.ok) { console.error("Global Fetch Failed:", res.status); return null; }
                const data = await res.json();

                globalState.doctorName = data.doctor_name;
                globalState.requests = data.requests || [];
                globalState.statusOverride = data.status_override;
                globalState.currentStatus = data.current_status;

                const activeUrgent = (data.requests || []).filter(r => r.is_urgent);
                activeUrgent.forEach(req => {
                    if (!globalState.knownReqIds.has(req.id)) {
                        globalState.urgentQueue.push(req);
                        if (!globalState.currentUrgent) globalState.currentUrgent = globalState.urgentQueue[0];
                        sharedMethods.playAlertSound();
                    }
                });
                globalState.knownReqIds = new Set((data.requests || []).map(r => r.id));

                const active = (data.appointments || []).find(a => a.status === 'Ongoing');
                if (active) {
                    if (!globalState.ongoingAppt || globalState.ongoingAppt.id !== active.id) {
                        await sharedMethods.fetchOngoingSession(active.id);
                    }
                } else {
                    globalState.ongoingAppt = null;
                }
                return data;
            } catch (e) { console.error("Global fetch error:", e); return null; }
        },

        async fetchOngoingSession(id) {
            try {
                const res = await fetch(`/doctor/api/doctor/appointment-detail/${id}`);
                if (res.ok) globalState.ongoingAppt = await res.json();
            } catch (e) { console.error("Failed to load session:", e); }
        },

        addPrescription() {
            if (globalState.ongoingAppt) {
                if (!globalState.ongoingAppt.prescriptions) globalState.ongoingAppt.prescriptions = [];
                globalState.ongoingAppt.prescriptions.push("");
            }
        },
        removePrescription(index) {
            if (globalState.ongoingAppt && globalState.ongoingAppt.prescriptions) {
                globalState.ongoingAppt.prescriptions.splice(index, 1);
            }
        },

        async uploadAttachment(event) {
            const file = event.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await fetch(`/doctor/api/appointment/upload-attachment/${globalState.ongoingAppt.id}`, { method: 'POST', body: formData });
                const result = await res.json();
                if (result.status === 'success') {
                    if (!globalState.ongoingAppt.attachments) globalState.ongoingAppt.attachments = [];
                    globalState.ongoingAppt.attachments.push(result.attachment);
                    sharedMethods.showToast("File uploaded!");
                }
            } catch (e) { sharedMethods.showToast("Upload failed", "error"); }
        },

        // ── FIXED: uses sharedMethods instead of 'this' to avoid context loss ──
        async saveSession() {
            if (!globalState.ongoingAppt) return;
            try {
                const res = await fetch(`/doctor/api/appointment/save-session/${globalState.ongoingAppt.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        medical_history: globalState.ongoingAppt.patient.medical_history,
                        problem_stated: globalState.ongoingAppt.problem_stated,
                        prescriptions: globalState.ongoingAppt.prescriptions,
                        diagnosis: globalState.ongoingAppt.diagnosis,
                        clinical_notes: globalState.ongoingAppt.clinical_notes
                    })
                });
                if (res.ok) {
                    sharedMethods.showToast("Session saved successfully!");
                } else {
                    const errData = await res.json().catch(() => ({}));
                    console.error("HMS_DEBUG: Save failed:", res.status, errData);
                    sharedMethods.showToast(`Server error: ${errData.message || res.status}`, "error");
                }
            } catch (e) {
                sharedMethods.showToast("Failed to save.", "error");
            }
        },

        async finalizeAppointment() {
            if (!globalState.ongoingAppt) return;
            try {
                // We send the final session data during the completion call as a safeguard
                const res = await fetch(`/doctor/api/appointment/complete/${globalState.ongoingAppt.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        medical_history: globalState.ongoingAppt.patient.medical_history,
                        problem_stated: globalState.ongoingAppt.problem_stated,
                        prescriptions: globalState.ongoingAppt.prescriptions,
                        diagnosis: globalState.ongoingAppt.diagnosis,
                        clinical_notes: globalState.ongoingAppt.clinical_notes
                    })
                });
                if (res.ok) {
                    globalState.showCompleteModal = false;
                    globalState.ongoingAppt = null;
                    sharedMethods.showToast("Appointment marked as Completed!");
                    await sharedMethods.fetchGlobalData();
                    // Redirect to dashboard or refresh list if on appointments page
                    if (window.location.pathname.includes('ongoing')) {
                        window.location.href = "/doctor/dashboard";
                    } else if (typeof app !== 'undefined' && app.fetchData) {
                        await app.fetchData();
                    }
                } else {
                    const err = await res.json();
                    sharedMethods.showToast("Could not complete: " + (err.message || "Server Error"), "error");
                }
            } catch (e) {
                sharedMethods.showToast("Failed to complete appointment.", "error");
            }
        },

        openPreview(file) {
            console.log("HMS_DEBUG: openPreview called with:", JSON.stringify(file));
            if (!file || !file.path) {
                console.error("HMS_DEBUG: Cannot preview - missing path in file:", file);
                sharedMethods.showToast("Attachment path missing.", "error");
                return;
            }

            sharedMethods.showToast("Opening document preview...");

            // Force reset then set to ensure absolute reactivity trigger
            globalState.activePreview.show = false;

            setTimeout(() => {
                globalState.activePreview.path = file.path;
                globalState.activePreview.type = file.type || 'image';
                globalState.activePreview.name = file.name || file.filename || 'Document';
                globalState.activePreview.show = true;
                console.log("HMS_DEBUG: activePreview set to:", JSON.stringify(globalState.activePreview));
            }, 50);
        },

        closePreview() {
            globalState.activePreview.show = false;
            globalState.activePreview.path = '';
            globalState.activePreview.type = '';
            globalState.activePreview.name = '';
        },

        async viewPastAppt(apptId) {
            console.log("HMS_DEBUG: viewPastAppt called with apptId:", apptId);
            if (!apptId) {
                console.error("HMS_DEBUG: viewPastAppt - No apptId provided.");
                sharedMethods.showToast("Invalid appointment record.", "warning");
                return;
            }

            sharedMethods.showToast("Retrieving medical record...");
            globalState.showPastApptModal = true;
            globalState.selectedPastAppt = { patient_name: 'Retrieving secure data...' };

            try {
                const res = await fetch(`/doctor/api/doctor/past-appointment-detail/${apptId}`);
                if (res.ok) {
                    globalState.selectedPastAppt = await res.json();
                    console.log("HMS_DEBUG: selectedPastAppt loaded:", globalState.selectedPastAppt);
                } else {
                    const err = await res.json().catch(() => ({}));
                    console.error("HMS_DEBUG: Failed to load past appt:", res.status, err);
                    sharedMethods.showToast("Record not found or access denied.", "error");
                    globalState.showPastApptModal = false;
                }
            } catch (e) {
                console.error("HMS_DEBUG: ViewPastAppt error:", e);
                sharedMethods.showToast("Connection error — try again.", "error");
                globalState.showPastApptModal = false;
            }
        },

        // ── PDF CLINICAL REPORT GENERATOR ────────────────────────────────
        async generatePDF(data) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const mg = 18;
            let y = 0;

            // Header band
            doc.setFillColor(26, 46, 100);
            doc.rect(0, 0, pageW, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('CLINICAL VISIT REPORT', mg, 18);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('HMS · Hospital Management System', mg, 26);
            doc.text('Generated: ' + new Date().toLocaleString('en-IN'), mg, 32);

            // ── PATIENT IDENTITY BLOCK: photo LEFT, details RIGHT ────────
            y = 50;
            const photoSize = 36;
            const photoX = mg;
            const textX = mg + photoSize + 6;

            // Collect patient info first
            const pName = data.patient_name || (data.patient && data.patient.name) || 'Unknown Patient';
            const pGender = data.patient_gender || (data.patient && data.patient.gender) || '';
            const pAge = data.patient_age || (data.patient && data.patient.age) || '';
            const pId = data.patient_id || (data.patient && data.patient.id) || 0;
            const visitDate = data.date ? (data.date + (data.time ? '  at  ' + data.time : '')) : (data.datetime || '');

            // Photo placeholder (light blue circle as fallback)
            doc.setFillColor(220, 230, 250);
            doc.roundedRect(photoX, y, photoSize, photoSize, 4, 4, 'F');
            doc.setFontSize(7);
            doc.setTextColor(100, 120, 180);
            doc.text('PHOTO', photoX + photoSize / 2, y + photoSize / 2, { align: 'center' });

            // Try embedding real photo
            try {
                const picSrc = data.patient_pic || (data.patient && data.patient.pic);
                if (picSrc && !picSrc.includes('default')) {
                    const abs = picSrc.startsWith('http') ? picSrc : (window.location.origin + picSrc);
                    const b64 = await sharedMethods._fetchImageAsBase64(abs);
                    if (b64) doc.addImage(b64, 'JPEG', photoX, y, photoSize, photoSize);
                }
            } catch (e) { /* keep placeholder */ }

            // Name
            doc.setTextColor(26, 46, 100);
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            doc.text(pName, textX, y + 8);

            // Meta line
            doc.setTextColor(80, 80, 110);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const metaParts = [pGender, pAge ? pAge + ' yrs' : '', 'Patient ID: #' + (pId + 5000)].filter(Boolean);
            doc.text(metaParts.join('   ·   '), textX, y + 16);

            // Visit date
            if (visitDate) {
                doc.setFontSize(8.5);
                doc.setTextColor(120, 120, 140);
                doc.text('Date of Visit: ' + visitDate, textX, y + 23);
            }

            // HMS badge top-right
            doc.setFillColor(26, 46, 100);
            doc.roundedRect(pageW - mg - 28, y, 28, 10, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('HMS · REPORT', pageW - mg - 14, y + 7, { align: 'center' });

            y = y + photoSize + 8;

            // Divider
            doc.setDrawColor(210, 215, 235);
            doc.setLineWidth(0.5);
            doc.line(mg, y, pageW - mg, y);
            y += 8;

            // Helpers
            const secHeader = (title, r, g, b) => {
                if (y > pageH - 30) { doc.addPage(); y = 20; }
                doc.setFillColor(r || 26, g || 46, b || 100);
                doc.roundedRect(mg, y, pageW - mg * 2, 8, 1.5, 1.5, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.text(title.toUpperCase(), mg + 4, y + 5.5);
                y += 13;
                doc.setTextColor(30, 30, 50);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
            };

            const txtBlock = (txt, bold = false) => {
                if (!txt || String(txt).trim() === '') return;
                doc.setFont('helvetica', bold ? 'bold' : 'normal');
                const lines = doc.splitTextToSize(String(txt), pageW - mg * 2);
                lines.forEach(ln => {
                    if (y > pageH - 22) { doc.addPage(); y = 20; }
                    doc.text(ln, mg, y);
                    y += 5.5;
                });
                y += 3;
                doc.setFont('helvetica', 'normal');
            };

            // Sections
            const complaint = data.complaint || data.urgent_note || data.problem_stated || '';
            if (complaint) { secHeader('Chief Complaint / Visit Notes', 70, 80, 160); doc.setFont('helvetica', 'italic'); txtBlock('"' + complaint + '"'); }

            const history = data.patient_history || (data.patient && data.patient.medical_history) || '';
            if (history) { secHeader('Known Medical History', 30, 110, 70); txtBlock(history); }

            const diagnosis = data.diagnosis || '';
            if (diagnosis) { secHeader('Final Diagnosis', 170, 50, 30); txtBlock(diagnosis, true); }

            const notes = data.notes || data.clinical_notes || '';
            if (notes && notes !== complaint) { secHeader("Doctor's Clinical Notes", 60, 80, 150); txtBlock(notes); }

            const rxRaw = data.prescription || data.prescriptions;
            const rxList = Array.isArray(rxRaw) ? rxRaw
                : (typeof rxRaw === 'string' && rxRaw.length > 0 ? rxRaw.split(/,\s*/) : []);
            if (rxList.length > 0) {
                secHeader('Prescribed Medications', 28, 140, 90);
                rxList.forEach((med, i) => {
                    if (y > pageH - 22) { doc.addPage(); y = 20; }
                    doc.setFont('helvetica', 'bold'); doc.text((i + 1) + '.', mg + 2, y);
                    doc.setFont('helvetica', 'normal');
                    const ls = doc.splitTextToSize(med, pageW - mg * 2 - 12);
                    ls.forEach(ln => { doc.text(ln, mg + 9, y); y += 5.5; });
                    y += 1;
                });
            }

            // Footer on every page
            const total = doc.internal.getNumberOfPages();
            for (let i = 1; i <= total; i++) {
                doc.setPage(i);
                doc.setFillColor(245, 246, 252);
                doc.rect(0, pageH - 13, pageW, 13, 'F');
                doc.setFontSize(7.5);
                doc.setTextColor(140, 140, 160);
                doc.setFont('helvetica', 'normal');
                doc.text('This document is computer-generated. HMS · For clinical use only.', mg, pageH - 6);
                doc.text('Page ' + i + ' / ' + total, pageW - mg - 14, pageH - 6);
            }

            const safeName = pName.replace(/\s+/g, '_');
            const safeDate = (data.date || new Date().toLocaleDateString('en-IN')).replace(/[\s/]/g, '-');
            doc.save('HMS_Report_' + safeName + '_' + safeDate + '.pdf');
        },

        async _fetchImageAsBase64(url) {
            try {
                const res = await fetch(url);
                const blob = await res.blob();
                return await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            } catch { return null; }
        },
        // ── END PDF ──────────────────────────────────────────────────────

        playAlertSound() {
            const audio = document.getElementById('urgentAlarm');
            if (audio) { audio.pause(); audio.currentTime = 0; audio.play().catch(() => { }); }
        },

        showToast(message, type = 'success') {
            const id = Date.now();
            globalState.toasts.push({ id, message, type });
            setTimeout(() => { globalState.toasts = globalState.toasts.filter(t => t.id !== id); }, 4000);
        },

        async showConfirm(title, message) {
            return new Promise(resolve => {
                globalState.confirmModal = {
                    show: true, title, message,
                    onConfirm: () => { globalState.confirmModal.show = false; resolve(true); },
                    onCancel: () => { globalState.confirmModal.show = false; resolve(false); }
                };
            });
        },

        async handleUrgentAction(id, action) {
            if (action === 'Dismissed') {
                // Just hide the modal for now
                globalState.urgentQueue.shift();
                globalState.currentUrgent = globalState.urgentQueue.length > 0 ? globalState.urgentQueue[0] : null;
                return;
            }
            if (action === 'Cancelled') {
                const confirmed = await sharedMethods.showConfirm("Reject Urgent Request?", "Are you sure you want to reject this urgent case?");
                if (!confirmed) return;
                const success = await sharedMethods.processReq(id, 'Cancelled');
                if (success) {
                    sharedMethods.showToast("Urgent request rejected.");
                }
                return;
            }
            // If action is 'Booked', process it (this might trigger Duration Modal)
            const success = await sharedMethods.processReq(id, 'Booked');
            if (success) {
                sharedMethods.showToast("Urgent case accepted!");
            }
        },

        async processReq(id, status, payload = {}) {
            if (status === 'Booked' && !payload.duration) {
                sharedMethods.openDurationModal(id);
                return false;
            }
            try {
                const res = await fetch(`/doctor/api/appointment/handle/${id}/${status}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) {
                    sharedMethods.showToast(status === 'Booked' ? "Request accepted!" : "Request processed.");
                    await sharedMethods.fetchGlobalData();
                    if (globalState.currentUrgent && globalState.currentUrgent.id === id) {
                        globalState.urgentQueue.shift();
                        globalState.currentUrgent = globalState.urgentQueue.length > 0 ? globalState.urgentQueue[0] : null;
                    }
                    return true;
                } else {
                    sharedMethods.showToast(data.message || "Action failed.", "error");
                    return false;
                }
            } catch (e) { sharedMethods.showToast("Connection failed.", "error"); return false; }
        },

        openRejectModal(id) {
            globalState.selectedReqId = id;
            globalState.rejectReason = '';
            globalState.showRejectModal = true;
        },

        async submitRejection() {
            if (!globalState.rejectReason) {
                sharedMethods.showToast("Please provide a reason.", "warning");
                return;
            }
            const success = await sharedMethods.processReq(globalState.selectedReqId, 'Rejected', { reason: globalState.rejectReason });
            if (success) {
                globalState.showRejectModal = false;
            }
        },

        registerDirectives(app) {
            app.directive('click-outside', {
                mounted(el, binding) {
                    el.clickOutsideEvent = e => { if (!(el === e.target || el.contains(e.target))) binding.value(e); };
                    document.body.addEventListener('click', el.clickOutsideEvent);
                },
                unmounted(el) { document.body.removeEventListener('click', el.clickOutsideEvent); }
            });
        },

        // NEW: Multi-purpose swipe handlers for request cards
        handleTouchStart(e, id) {
            globalState.touchStart = e.touches[0].clientX;
            globalState.swipingId = id;
            globalState.swipeOffset = 0;
            console.log("HMS_DEBUG: Swipe start for ID:", id);
        },

        handleTouchMove(e, id) {
            if (globalState.swipingId !== id) return;
            const currentX = e.touches[0].clientX;
            globalState.swipeOffset = currentX - globalState.touchStart;

            // Minimal threshold to consider it a swipe and prevent vertical scroll
            if (Math.abs(globalState.swipeOffset) > 15) {
                if (e.cancelable) e.preventDefault();
            }
        },

        handleTouchEnd(id) {
            if (globalState.swipingId !== id || globalState.swipeOffset === 0) return;

            const offset = globalState.swipeOffset;
            const threshold = 100; // Require 100px swipe for action

            console.log("HMS_DEBUG: Swipe end for ID:", id, "Offset:", offset);

            if (offset > threshold) {
                // Swipe Right -> Accept
                sharedMethods.showToast("Accepting Request...", "success");
                sharedMethods.processReq(id, 'Booked');
            } else if (offset < -threshold) {
                // Swipe Left -> Reject
                sharedMethods.showToast("Opening Rejection Modal...", "warning");
                sharedMethods.openRejectModal(id);
            }

            // Reset with slight delay
            setTimeout(() => {
                globalState.swipingId = null;
                globalState.swipeOffset = 0;
            }, 50);
        }
    };

    window.HMS_DOCTOR_SHARED = { globalState, sharedMethods };
})();
