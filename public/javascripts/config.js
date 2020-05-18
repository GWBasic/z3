"use strict";

function runConfig() {

    // Based on https://foliotek.github.io/Croppie/demo/demo.js

    const surroundCropAvatarElement = document.getElementById('surroundCropAvatar');
    const cropAvatarElement = document.getElementById('cropAvatar');
    const uploadAvatarElement = document.getElementById('uploadAvatar');
    const submitAvatarElement = document.getElementById('submitAvatar');
    const uploadStatusElement = document.getElementById('uploadStatus');
    const currentAvatarElement = document.getElementById('currentAvatar');

    const currentAvatarElementSrc = currentAvatarElement.src;

    const cropAvatarCroppie = new Croppie(cropAvatarElement, {
        enableExif: true,
        mouseWheelZoom: false,
        viewport: {
            width: 512,
            height: 512,
            type: 'circle'
        },
        boundary: {
            width: 1000,
            height: 800
        }
    });

    function readImage() {
        if (uploadAvatarElement.files && uploadAvatarElement.files[0]) {

            var reader = new FileReader();
           
            reader.onload = async function (e) {
                await cropAvatarCroppie.bind({
                    url: e.target.result
                });               

                surroundCropAvatarElement.style.display = 'block';
            }           
            
            reader.readAsDataURL(uploadAvatarElement.files[0]);
        } else {
            alert("Your browser doesn't support the FileReader API");
        }
    }

    async function uploadAvatar() {
        uploadStatusElement.textContent = 'Uploading';

        try {
            const croppedImageBlob = await cropAvatarCroppie.result({
                type: 'blob',
                size: 'viewport',
                circle: true,
            });

            const uploadResponse = await fetch('/config/avatar', {
                method: 'PUT',
                credentials: 'same-origin',
                body: croppedImageBlob
            });

            if (!uploadResponse.ok) {
                uploadStatusElement.textContent = `Upload error: ${uploadResponse.statusText}`;
                return;
            }

            uploadStatusElement.textContent = '';
            surroundCropAvatarElement.style.display = 'none';
            currentAvatarElement.src = `${currentAvatarElement.src}?q=${new Date().getTime()}`;
        } catch (err) {
            uploadStatusElement.textContent = err;
        }
    }

    uploadAvatarElement.addEventListener('change', readImage);
    submitAvatarElement.addEventListener('click', uploadAvatar);
}

if (document.readyState === "complete" ||
    (document.readyState !== "loading" && !document.documentElement.doScroll)) {
    runConfig()
} else {
    document.addEventListener("DOMContentLoaded", () => runConfig());
}