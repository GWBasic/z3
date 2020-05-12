const publishDataElement = document.getElementsByTagName('z3-publishData')[0];
const publishData = JSON.parse(publishDataElement.textContent);

const isPublished = publishData.isPublished;
const title = publishData.title;

function validateDate(elementName, setToNowIfInvalid) {
    const element = document.getElementById(elementName);

    var isValid = true;
    if (element.value.length <= 0) {
        isValid = false;
    } else {
        try {
            const parsedDate = new Date(element.value);
            isValid = !isNaN(parsedDate);
        } catch {
            isValid = false;
        }
    }

    if (!isValid) {
        if (setToNowIfInvalid) {
            element.value = new Date();
        } else {
            element.value = '';
        }
    }
}

function checkPublish() {
    const confirmed = confirm(`Do you really want to publish ${title}?`);

    if (confirmed) {
        validateDate('publishedAt', true);
        validateDate('republishedAt', isPublished)
    }

    return confirmed;
}