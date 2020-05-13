function runConfig() {
    $uploadCrop = document.getElementById('upload-avatar').croppie({
        enableExif: true,
        viewport: {
            width: 200,
            height: 200,
            type: 'circle'
        },
        boundary: {
            width: 300,
            height: 300
        }
    });
}

if (document.readyState === "complete" ||
    (document.readyState !== "loading" && !document.documentElement.doScroll)) {
    runConfig()
} else {
    document.addEventListener("DOMContentLoaded", () => runConfig());
}