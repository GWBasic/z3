"use strict";

function runConfig() {

    // Based on https://foliotek.github.io/Croppie/demo/demo.js

    const surroundCropAvatarElement = document.getElementById('surroundCropAvatar');
    const cropAvatarElement = document.getElementById('cropAvatar');
    const uploadAvatarElement = document.getElementById('uploadAvatar');
    const submitAvatarElement = document.getElementById('submitAvatar');
    const uploadStatusElement = document.getElementById('uploadStatus');
    const currentAvatarElement = document.getElementById('currentAvatar');
    const displaySelectTemplateElement = document.getElementById('displaySelectTemplate');
    const hideSelectTemplateElement = document.getElementById('hideSelectTemplate');
    const templateSelectorElement = document.getElementById('templateSelector');
    const templateRadioButtonElements = document.getElementsByClassName('templateRadioButton');
    const previewFrameElements = document.getElementsByClassName('previewFrame');
    const titleElement = document.getElementById('title');
    const authorElement = document.getElementById('author');
    const z3UnpublishedElements = document.getElementsByTagName('z3-unpublished');
    const publishElement = document.getElementById('publish');
    const submitElement = document.getElementById('submit');
    const z3UnpublishElements = document.getElementsByTagName('z3-unpublish');

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

            for (var previewFrameElement of previewFrameElements) {
                previewFrameElement.contentWindow.location.reload(true);
            }
        } catch (err) {
            uploadStatusElement.textContent = err;
        }
    }

    uploadAvatarElement.addEventListener('change', readImage);
    submitAvatarElement.addEventListener('click', uploadAvatar);

    function displaySelectTemplate() {
        displaySelectTemplateElement.style.display = 'none';
        hideSelectTemplateElement.style.display = 'block';
        templateSelectorElement.style.display = 'block';
    }

    function hideSelectTemplate() {
        displaySelectTemplateElement.style.display = 'block';
        hideSelectTemplateElement.style.display = 'none';
        templateSelectorElement.style.display = 'none';
    }

    displaySelectTemplateElement.addEventListener('click', displaySelectTemplate);
    hideSelectTemplateElement.addEventListener('click', hideSelectTemplate);

    for (var templateRadioButtonElement of templateRadioButtonElements) {
        templateRadioButtonElement.addEventListener('click', hideSelectTemplate);
    }

    function verifyCanPublish() {

        function disablePublish() {
            for (var z3UnpublishedElement of z3UnpublishedElements) {
                z3UnpublishedElement.style.display = '';
            }

            for (var z3UnpublishElement of z3UnpublishElements) {
                z3UnpublishElement.style.display = 'none';
            }

            publishElement.disabled = true;
            submitElement.disabled = true;
        }

        function enablePublish() {
            for (var z3UnpublishedElement of z3UnpublishedElements) {
                z3UnpublishedElement.style.display = 'none';
            }

            for (var z3UnpublishElement of z3UnpublishElements) {
                z3UnpublishElement.style.display = '';
            }

            publishElement.disabled = false;
            submitElement.disabled = false;
        }

        if (titleElement.value.length < 1) {
            disablePublish();
            return;
        }

        if (authorElement.value.length < 1) {
            disablePublish();
            return;
        }

        // TODO: Check that an image was uploaded

        for (var templateRadioButtonElement of templateRadioButtonElements) {
            if (templateRadioButtonElement.checked) {
                enablePublish();
                return;
            }
        }

        disablePublish();
    }

    titleElement.addEventListener('input', verifyCanPublish);
    authorElement.addEventListener('input', verifyCanPublish);

    for (var templateRadioButtonElement of templateRadioButtonElements) {
        templateRadioButtonElement.addEventListener('change', verifyCanPublish);
    }

    verifyCanPublish();
}

if (document.readyState === "complete" ||
    (document.readyState !== "loading" && !document.documentElement.doScroll)) {
    runConfig()
} else {
    document.addEventListener("DOMContentLoaded", () => runConfig());
}