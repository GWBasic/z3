"use strict";

async function runEditor() {
    const contentElement = document.getElementById('content');
    const contentHtmlElement = document.getElementById('contentHtml');
    const titleElement = document.getElementById('post_title');
    const savedElement = document.getElementById('saved');
    const savingElement = document.getElementById('saving');
    const errorElement = document.getElementById('error');
    const oldVersionPublishedElement = document.getElementById('oldVersionPublished');
    const suggestedLocationInputElements = document.getElementsByClassName('suggestedLocationInput');

    const editorType_wysiwygElement = document.getElementById("editorType_wysiwyg");
    const editorType_HTMLElement = document.getElementById("editorType_HTML");

    var editor = null;

    async function setUpEditor() {
        try {
            editor = await BalloonEditor.create(contentElement, {
                ckfinder: {
                    uploadUrl: `/edit/image/${postId}`
                }
            });

            editor.model.document.on('change:data', () => {
                onContentChanged();
            });

            editor.editing.view.focus();
        } catch (err) {
            document.body.textContent = `Can not set up the editor: ${err}`;
        }
    }

    onWindowResize();
    await setUpEditor();

    var sending = false;
    var contentChanged = false;

    function updateDocumentTitle() {
        document.title = `Editing: ${titleElement.value}`;
    }
    updateDocumentTitle();

    async function onContentChanged() {
        try {
            contentChanged = true;

            // Do not re-queue sending when there is an open request pending
            if (sending) {
                return;
            }

            while (contentChanged) {
                await sendChangedContent();
            }
        } catch (err) {
            savingElement.style.display = 'none';
            savedElement.style.display = 'none';
            errorElement.style.display = 'block'
            errorElement.innerHTML = `Error: ${err}`;

        } finally {
            sending = false;
        }

        return true;

        async function sendChangedContent() {
            function getContent() {
                if (editor) {
                    return editor.getData();
                } else {
                    return contentHtmlElement.value;
                }
            }

            const draft = {
                title: titleElement.value,
                content: getContent()
            };

            for (var suggestedLocationInputElement of suggestedLocationInputElements) {
                if (suggestedLocationInputElement.checked) {
                    draft.suggestedLocation = suggestedLocationInputElement.value;
                }
            }

            updateDocumentTitle();

            sending = true;
            contentChanged = false;

            savedElement.style.display = 'none';
            savingElement.style.display = 'block';

            const saveResult = await fetch(window.location.pathname, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(draft)
            });

            savingElement.style.display = 'none';

            if (saveResult.ok) {
                savedElement.style.display = 'block';
                errorElement.style.display = 'none';
                errorElement.innerHTML = '';

                const response = await saveResult.json();
                if (response.draftIsOutdated) {
                    oldVersionPublishedElement.style.display = 'block';
                }
                else {
                    oldVersionPublishedElement.style.display = 'none';
                }
            }
            else {
                errorElement.style.display = 'block';
                errorElement.innerHTML = `status: ${saveResult.status}: ${saveResult.statusText}`;
            }
        }
    }

    contentHtmlElement.addEventListener('input', onContentChanged);

    async function switchEditor() {
        if (editorType_wysiwygElement.checked) {
            await switchToWysiwyg();
        } else if (editorType_HTMLElement.checked) {
            switchToHtml();
        }
    }

    async function switchToWysiwyg() {
        const data = contentHtmlElement.value;

        contentElement.hidden = false;
        contentHtmlElement.hidden = true;

        contentElement.innerHTML = data;

        await setUpEditor();
    }

    function switchToHtml() {
        const data = editor.getData();
        editor.destroy();
        editor = null;

        contentElement.hidden = true;
        contentHtmlElement.hidden = false;

        var dataCleaned = data;
        dataCleaned = dataCleaned.replace(/<\/p></g, '</p>\n<');
        dataCleaned = dataCleaned.replace(/<\/figure></g, '</figure>\n<');
        dataCleaned = dataCleaned.replace(/<\/h2></g, '</h2\n<');
        dataCleaned = dataCleaned.replace(/<\/h3></g, '</h3\n<');
        dataCleaned = dataCleaned.replace(/<\/h4></g, '</h4\n<');
        contentHtmlElement.value = dataCleaned;

        onWindowResize();
    }

    editorType_wysiwygElement.addEventListener('change', switchEditor);
    editorType_HTMLElement.addEventListener('change', switchEditor);

    function onWindowResize() {
        var toResize;
        if (contentHtmlElement.hidden) {
            toResize = contentElement;
        } else {
            toResize = contentHtmlElement;
        }

        const location = toResize.getBoundingClientRect();
        toResize.style.height = `${window.innerHeight - location.top - 150}px`;
    }

    window.addEventListener('resize', onWindowResize);
}

if (document.readyState === "complete" ||
    (document.readyState !== "loading" && !document.documentElement.doScroll)) {
    runEditor()
} else {
    document.addEventListener("DOMContentLoaded", () => runEditor());
}