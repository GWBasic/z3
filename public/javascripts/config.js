function runConfig() {

    // Based on https://foliotek.github.io/Croppie/demo/demo.js

    const cropAvatarElement = document.getElementById('cropAvatar');
    const cropAvatarCroppie = new Croppie(cropAvatarElement, {
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

    const uploadAvatarElement = document.getElementById('uploadAvatar');

    function readFile() {
        if (uploadAvatarElement.files && uploadAvatarElement.files[0]) {
            var reader = new FileReader();
           
            reader.onload = function (e) {
                //$('.upload-demo').addClass('ready');
                cropAvatarCroppie.bind({
                    url: e.target.result
                }).then(function(){
                   console.log('bind complete');
                });
               
            }           
            
            reader.readAsDataURL(uploadAvatarElement.files[0]);
        } else {
           console.error("Sorry - you're browser doesn't support the FileReader API");
        }
    }

    uploadAvatarElement.addEventListener("change", readFile);

    /*$('.upload-result').on('click', function (ev) {
        $uploadCrop.croppie('result', {
            type: 'canvas',
            size: 'viewport'
        }).then(function (resp) {
            popupResult({
                src: resp
            });
        });
    });*/
}

if (document.readyState === "complete" ||
    (document.readyState !== "loading" && !document.documentElement.doScroll)) {
    runConfig()
} else {
    document.addEventListener("DOMContentLoaded", () => runConfig());
}