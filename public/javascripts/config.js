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
    const publishElement = document.getElementById('publish');

    const titleEmptyElement = document.getElementById('titleEmpty');
    const authorEmptyElement = document.getElementById('authorEmpty');
    const profilePictureEmptyElement = document.getElementById('profilePictureEmpty');
    const templateEmptyElement = document.getElementById('templateEmpty');
    const publishRequirementsElement = document.getElementById('publishRequirements');
    const unpublishWarningElement = document.getElementById('unpublishWarning');

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
            currentAvatarElement.hidden = false;
            profilePictureEmptyElement.hidden = true;

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

    const blogWasPublished = publishElement.checked;
    const isAvatarConfigured = !currentAvatarElement.hidden;

    function verifyCanPublish() {

        function disablePublish() {
            unpublishWarningElement.hidden = true;
            publishRequirementsElement.hidden = false;

            publishElement.disabled = true;
            publishElement.checked = false;
        }

        function enablePublish() {
            unpublishWarningElement.hidden = false;
            publishRequirementsElement.hidden = true;

            publishElement.disabled = false;
            publishElement.checked = blogWasPublished;
        }

        var allowPublish = true;

        if (titleElement.value.length < 1) {
            titleEmptyElement.hidden = false;
            allowPublish = false;
        } else {
            titleEmptyElement.hidden = true;
        }

        if (authorElement.value.length < 1) {
            authorEmptyElement.hidden = false;
            allowPublish = false;
        } else {
            authorEmptyElement.hidden = true;
        }

        if (!isAvatarConfigured) {
            profilePictureEmptyElement.hidden = false;
            allowPublish = false;
        } else {
            profilePictureEmptyElement.hidden = true;
        }

        var templateRadioButtonElementChecked = false;
        for (var templateRadioButtonElement of templateRadioButtonElements) {
            if (templateRadioButtonElement.checked) {
                templateRadioButtonElementChecked = true;
            }
        }

        if (!templateRadioButtonElementChecked) {
            templateEmptyElement.hidden = false;
            allowPublish = false;
        } else {
            templateEmptyElement.hidden = true;
        }

        if (allowPublish) {
            enablePublish();
        } else {
            disablePublish();
        }
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