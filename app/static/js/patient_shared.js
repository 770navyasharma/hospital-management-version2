const { reactive } = Vue;

const globalState = reactive({
    notifications: [],
    showNotifications: false,
    toasts: [],
    loading: false
});



const seenToastIds = new Set();
let isFirstFetch = true;

const sharedMethods = {
    showToast(message, type = 'success') {
        const id = Date.now();
        globalState.toasts.push({ id, message, type });
        setTimeout(() => {
            globalState.toasts = globalState.toasts.filter(t => t.id !== id);
        }, 5000);
    },

    async fetchNotifications() {
        try {
            const res = await fetch('/patient/api/notifications');
            if (!res.ok) return;
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) return;

            const newNotifs = await res.json();

            if (isFirstFetch) {
                
                
                newNotifs.forEach(n => seenToastIds.add(n.id));
                isFirstFetch = false;
            } else {
                
                
                newNotifs.forEach(n => {
                    if (!n.is_read && !seenToastIds.has(n.id)) {
                        seenToastIds.add(n.id);
                        this.showToast(n.message, n.type || 'info');
                    }
                });
            }

            globalState.notifications = newNotifs;
        } catch (e) {
            console.error("Failed to fetch notifications:", e);
        }
    },

    async markAllAsRead() {
        try {
            const res = await fetch('/patient/api/notifications/mark-read', { method: 'POST' });
            if (res.ok) {
                globalState.notifications.forEach(n => {
                    n.is_read = true;
                    seenToastIds.add(n.id); 
                });
            }
        } catch (e) {
            console.error("Failed to mark notifications read:", e);
        }
    },

    copyToClipboard(text) {
        if (!text || text === 'Contact not provided' || text === 'Contact not visible') {
            return this.showToast("No contact number to copy!", "warning");
        }
        navigator.clipboard.writeText(text).then(() => {
            this.showToast("Number copied to clipboard!");
        }).catch(err => {
            console.error('Could not copy text: ', err);
            this.showToast("Failed to copy number", "error");
        });
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
    }
};


const clickOutside = {
    mounted(el, binding) {
        el.clickOutsideEvent = (event) => {
            if (!(el === event.target || el.contains(event.target))) {
                binding.value();
            }
        };
        document.body.addEventListener('click', el.clickOutsideEvent);
    },
    unmounted(el) {
        document.body.removeEventListener('click', el.clickOutsideEvent);
    }
};


sharedMethods.fetchNotifications();
setInterval(() => sharedMethods.fetchNotifications(), 30000);
