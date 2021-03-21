const showHidePasswordInputs = document.getElementsByClassName('showHidePasswordInput');
const showHidePasswordLinks = document.getElementsByClassName('showHidePasswordLink');

for (const showHidePasswordLink of showHidePasswordLinks) {
    showHidePasswordLink.onclick = togglePasswordVisibility;
}

function togglePasswordVisibility() {
    for (const showHidePasswordInput of showHidePasswordInputs) {
        if (showHidePasswordInput.type == 'password') {
            showHidePasswordInput.type = 'text';
        } else {
            showHidePasswordInput.type = 'password';
        }
    }
}

