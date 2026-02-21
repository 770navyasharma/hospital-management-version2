// app/static/js/auth_preview.js
document.addEventListener('DOMContentLoaded', (event) => {
    
    const inputElement = document.getElementById('profile_pic_input');
    const previewElement = document.getElementById('pic-preview');

    if (inputElement && previewElement) {
        inputElement.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    previewElement.src = event.target.result;
                }
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
});