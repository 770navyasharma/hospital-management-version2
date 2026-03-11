
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
        notifications: [],
        seenToastIds: new Set(),
        doctorName: '',
        statusOverride: 'auto',
        currentStatus: 'offline',
        ongoingAppt: null,
        showCompleteModal: false,
        
        showRejectModal: false,
        rejectReason: '',
        selectedReqId: null,
        
        touchStart: 0,
        swipeOffset: 0,
        swipingId: null,
        
        activePreview: { show: false, path: '', type: '', name: '' },
        
        showPastApptModal: false,
        selectedPastAppt: {},
        isEditingPastAppt: false,
        
        dismissedUrgentIds: JSON.parse(localStorage.getItem('hms_dismissed_urgents') || '[]'),
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

        getStatusText(status) {
            const texts = {
                'available': 'Available',
                'busy': 'Busy (Ongoing Session)',
                'break': 'On Break',
                'offline': 'Offline',
                'auto': 'Automatic (Based on Schedule)'
            };
            return texts[status] || 'Unknown';
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

                const activeUrgent = (data.requests || []).filter(r => r.is_urgent && !globalState.dismissedUrgentIds.includes(r.id));
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

        async fetchOngoingSession(apptId) {
            if (!apptId) return;
            try {
                const res = await fetch(`/doctor/api/doctor/appointment-detail/${apptId}`);
                if (res.ok) {
                    const data = await res.json();

                    
                    globalState.ongoingAppt = {
                        id: data.id,
                        status: data.status,
                        patient: {
                            id: data.patient.id,
                            name: data.patient.name,
                            pic: data.patient.pic,
                            gender: data.patient.gender,
                            age: data.patient.age,
                            medical_history: data.patient.medical_history
                        },
                        start_time: data.start_time,
                        end_time: data.end_time,
                        duration: data.duration,
                        datetime: data.datetime,
                        diagnosis: data.diagnosis,
                        problem_stated: data.problem_stated,
                        clinical_notes: data.clinical_notes,
                        prescriptions: data.prescriptions || [],
                        attachments: data.attachments || [],
                        meet_link: data.meet_link
                    };
                    console.log("HMS_DEBUG: Ongoing session populated:", globalState.ongoingAppt);
                }
            } catch (e) {
                console.error("Failed to fetch ongoing session:", e);
                sharedMethods.showToast("Critical: Failed to load active session details.", "error");
            }
        },

        async fetchNotifications() {
            try {
                const res = await fetch('/api/notifications');
                if (res.ok) {
                    const newNotifs = await res.json();
                    
                    
                    if (globalState.seenToastIds.size === 0 && newNotifs.length > 0) {
                        newNotifs.forEach(n => globalState.seenToastIds.add(n.id));
                    } else {
                        
                        newNotifs.forEach(n => {
                            if (!globalState.seenToastIds.has(n.id) && !n.is_read) {
                                sharedMethods.showToast(n.message, n.type || 'info');
                                globalState.seenToastIds.add(n.id);
                            }
                        });
                    }

                    globalState.notifications = newNotifs;
                }
            } catch (e) {
                console.error("Failed to fetch notifications:", e);
            }
        },

        async markAllAsRead() {
            try {
                const res = await fetch('/api/notifications/mark-read', { method: 'POST' });
                if (res.ok) {
                    globalState.notifications.forEach(n => n.is_read = true);
                }
            } catch (e) {
                console.error("Failed to mark notifications read:", e);
            }
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
            globalState.isEditingPastAppt = false;
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

        async saveUpdatedHistory() {
            const appt = globalState.selectedPastAppt;
            if (!appt.id) return;

            sharedMethods.showToast("Saving clinical updates...");
            try {
                const res = await fetch(`/doctor/api/doctor/update-treatment-history/${appt.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        diagnosis: appt.diagnosis,
                        clinical_notes: appt.notes,
                        prescription: appt.prescription,
                        complaint: appt.complaint,
                        patient_history: appt.patient_history
                    })
                });

                if (res.ok) {
                    sharedMethods.showToast("Medical record updated successfully!");
                    globalState.isEditingPastAppt = false;
                    
                    if (typeof fetchGlobalData === 'function') fetchGlobalData();
                } else {
                    sharedMethods.showToast("Failed to save changes.", "error");
                }
            } catch (e) {
                console.error("Save Error:", e);
                sharedMethods.showToast("Connection error.", "error");
            }
        },

        
        async generatePDF(data) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const mg = 18;
            let y = 0;

            
            doc.setFillColor(26, 46, 100);
            doc.rect(0, 0, pageW, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('CLINICAL VISIT REPORT', mg, 18);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text('HMS · Hospital Management System', mg, 26);
            doc.text('Generated: ' + new Date().toLocaleString('en-IN'), mg, 32);

            
            y = 52;
            const photoW = 32;
            const photoH = 32;

            
            doc.setFillColor(240, 242, 248);
            doc.roundedRect(mg, y, photoW, photoH, 3, 3, 'F');
            doc.setFontSize(7);
            doc.setTextColor(140, 150, 190);
            doc.text('PATIENT', mg + photoW / 2, y + photoH / 2, { align: 'center' });

            const pPic = data.patient_pic || (data.patient && data.patient.pic);
            if (pPic) {
                try {
                    const absP = pPic.startsWith('http') ? pPic : (window.location.origin + pPic);
                    
                    if (!absP.toLowerCase().endsWith('.svg')) {
                        const b64P = await sharedMethods._fetchImageAsBase64(absP);
                        if (b64P) doc.addImage(b64P, 'JPEG', mg, y, photoW, photoH);
                    }
                } catch (e) { console.warn("PDF_DEBUG: Patient photo error:", e); }
            }

            
            const dPhotoX = pageW - mg - photoW;
            doc.setFillColor(240, 242, 248);
            doc.roundedRect(dPhotoX, y, photoW, photoH, 3, 3, 'F');
            doc.text('DOCTOR', dPhotoX + photoW / 2, y + photoH / 2, { align: 'center' });

            const dPic = data.doctor_pic;
            if (dPic) {
                try {
                    const absD = dPic.startsWith('http') ? dPic : (window.location.origin + dPic);
                    if (!absD.toLowerCase().endsWith('.svg')) {
                        const b64D = await sharedMethods._fetchImageAsBase64(absD);
                        if (b64D) doc.addImage(b64D, 'JPEG', dPhotoX, y, photoW, photoH);
                    }
                } catch (e) { console.warn("PDF_DEBUG: Doctor photo error:", e); }
            }

            
            const centerX = pageW / 2;
            doc.setTextColor(26, 46, 100);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(data.patient_name || 'Patient', centerX, y + 8, { align: 'center' });

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 110);
            const pMeta = [data.patient_gender, data.patient_age ? data.patient_age + ' yrs' : ''].filter(Boolean).join('  ·  ');
            doc.text(pMeta, centerX, y + 16, { align: 'center' });

            doc.setTextColor(26, 46, 100);
            doc.setFont('helvetica', 'bold');
            doc.text('Treated By:', centerX, y + 24, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.text(data.doctor_name || 'Assigned Doctor', centerX, y + 29, { align: 'center' });
            if (data.doctor_dept) {
                doc.setFontSize(8);
                doc.setTextColor(120, 120, 140);
                doc.text(data.doctor_dept, centerX, y + 33, { align: 'center' });
            }

            y = y + photoH + 12;

            
            doc.setDrawColor(210, 215, 235);
            doc.setLineWidth(0.4);
            doc.line(mg, y, pageW - mg, y);
            y += 6;
            doc.setFontSize(8.5);
            doc.setTextColor(100, 100, 120);
            doc.text('Visit Date: ' + (data.date || 'N/A'), mg, y);
            doc.text('Report ID: #CMS-' + data.id + '-' + Math.floor(Math.random() * 1000), pageW - mg, y, { align: 'right' });
            y += 10;

            
            const secHeader = (title, r, g, b) => {
                if (y > pageH - 35) { doc.addPage(); y = 20; }
                doc.setFillColor(r || 26, g || 46, b || 100);
                doc.roundedRect(mg, y, pageW - mg * 2, 8, 1.5, 1.5, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8.5);
                doc.setFont('helvetica', 'bold');
                doc.text(title.toUpperCase(), mg + 4, y + 5.5);
                y += 13;
                doc.setTextColor(40, 40, 60);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
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
            };

            
            const complaint = data.complaint || '';
            if (complaint) { secHeader('Reason for Visit', 70, 80, 160); doc.setFont('helvetica', 'italic'); txtBlock('"' + complaint + '"'); }

            const history = data.patient_history || '';
            if (history) { secHeader('Medical background', 30, 110, 70); txtBlock(history); }

            const diagnosis = data.diagnosis || '';
            if (diagnosis) { secHeader('Diagnosis', 170, 50, 30); txtBlock(diagnosis, true); }

            const notes = data.notes || '';
            if (notes) { secHeader("Clinical Notes", 60, 80, 150); txtBlock(notes); }

            const rxRaw = data.prescription;
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

            
            const total = doc.internal.getNumberOfPages();
            for (let i = 1; i <= total; i++) {
                doc.setPage(i);
                doc.setFillColor(248, 249, 253);
                doc.rect(0, pageH - 14, pageW, 14, 'F');
                doc.setFontSize(7.5);
                doc.setTextColor(150, 150, 170);
                doc.text('This clinical report is computer-generated and verified by HMS encrypted systems.', mg, pageH - 7);
                doc.text('Page ' + i + ' / ' + total, pageW - mg, pageH - 7, { align: 'right' });
            }

            const safeName = (data.patient_name || 'Report').replace(/\s+/g, '_');
            const safeDate = (data.date || new Date().toLocaleDateString('en-IN')).replace(/[\s/]/g, '-');
            doc.save('Clinical_Report_' + safeName + '_' + safeDate + '.pdf');
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
        

        playAlertSound() {
            const audio = document.getElementById('urgentAlarm');
            if (audio) { audio.pause(); audio.currentTime = 0; audio.play().catch(() => { }); }
        },

        showToast(message, type = 'success') {
            const id = Date.now();
            globalState.toasts.push({ id, message, type });
            setTimeout(() => { globalState.toasts = globalState.toasts.filter(t => t.id !== id); }, 4000);
        },

        dismissUrgent(id) {
            if (!id) return;
            if (!globalState.dismissedUrgentIds.includes(id)) {
                globalState.dismissedUrgentIds.push(id);
                localStorage.setItem('hms_dismissed_urgents', JSON.stringify(globalState.dismissedUrgentIds));
            }
            globalState.urgentQueue = globalState.urgentQueue.filter(r => r.id !== id);
            globalState.currentUrgent = globalState.urgentQueue.length > 0 ? globalState.urgentQueue[0] : null;
            globalState.swipeOffset = 0;
            globalState.swipingId = null;
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
                sharedMethods.dismissUrgent(id);
                return;
            }
            if (action === 'Cancelled') {
                const confirmed = await sharedMethods.showConfirm("Reject Urgent Request?", "Are you sure you want to reject this urgent case?");
                if (!confirmed) return;
                const success = await sharedMethods.processReq(id, 'Cancelled');
                if (success) {
                    sharedMethods.showToast("Urgent request rejected.");
                    sharedMethods.dismissUrgent(id);
                }
                return;
            }
            
            const success = await sharedMethods.processReq(id, 'Booked');
            if (success) {
                sharedMethods.showToast("Urgent case accepted!");
                sharedMethods.dismissUrgent(id);
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
                    sharedMethods.dismissUrgent(id);
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

        
        handleTouchStart(e, id) {
            globalState.touchStart = e.touches[0].clientX;
            globalState.swipingId = id;
            globalState.swipeOffset = 0;
            console.log("HMS_DEBUG: Swipe start for ID:", id);
        },

        handleTouchMove(e, id) {
            if (globalState.swipingId !== id || !e.touches) return;
            const currentX = e.touches[0].clientX;
            globalState.swipeOffset = currentX - globalState.touchStart;

            
            if (Math.abs(globalState.swipeOffset) > 15) {
                if (e.cancelable) e.preventDefault();
            }
        },

        handleTouchEnd(id) {
            if (globalState.swipingId !== id || globalState.swipeOffset === 0) return;

            const offset = globalState.swipeOffset;
            const threshold = 100; 

            console.log("HMS_DEBUG: Swipe end for ID:", id, "Offset:", offset);

            if (offset > threshold) {
                
                sharedMethods.handleUrgentAction(id, 'Booked');
            } else if (offset < -threshold) {
                
                sharedMethods.handleUrgentAction(id, 'Cancelled');
            }

            
            setTimeout(() => {
                globalState.swipingId = null;
                globalState.swipeOffset = 0;
            }, 50);
        }
    };

    window.HMS_DOCTOR_SHARED = { globalState, sharedMethods };

    
    
    sharedMethods.fetchGlobalData();
    sharedMethods.fetchNotifications();
    setInterval(() => {
        sharedMethods.fetchGlobalData();
        sharedMethods.fetchNotifications();
    }, 10000);
})();
