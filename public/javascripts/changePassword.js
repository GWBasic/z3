"use strict";

function runChangePassword() {
    const currentPasswordElement = document.getElementById('currentPassword');
    const newPasswordElement = document.getElementById('newPassword');
    const confirmPasswordElement = document.getElementById('confirmPassword');
    const passwordsDontMatchElement = document.getElementById('passwordsDontMatch');
    const submitButtonElement = document.getElementById('submitButton');

    function enableDisableSubmit() {
        var canSubmit = true;

        if (currentPasswordElement.value.length < 1) {
            canSubmit = false;
        }

        if (newPasswordElement.value.length < 1) {
            canSubmit = false;
        }

        if (confirmPasswordElement.value.length < 1) {
            canSubmit = false;
        }

        if (newPasswordElement.value.length > 0 &&
            confirmPasswordElement.value.length > 0 &&
            newPasswordElement.value != confirmPasswordElement.value) {
            
            canSubmit = false;
            passwordsDontMatchElement.hidden = false;
        } else {
            passwordsDontMatchElement.hidden = true;
        }

        submitButtonElement.disabled = !canSubmit;
    }

    currentPasswordElement.addEventListener('input', enableDisableSubmit);
    newPasswordElement.addEventListener('input', enableDisableSubmit);
    confirmPasswordElement.addEventListener('input', enableDisableSubmit);
}


if (document.readyState === "complete" ||
    (document.readyState !== "loading" && !document.documentElement.doScroll)) {
    runChangePassword()
} else {
    document.addEventListener("DOMContentLoaded", () => runChangePassword());
}