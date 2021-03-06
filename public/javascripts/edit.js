"use strict";

async function runEditor() {
    const contentElement = document.getElementById('content');
    const titleElement = document.getElementById('post_title');
    const savedElement = document.getElementById('saved');
    const savingElement = document.getElementById('saving');
    const errorElement = document.getElementById('error');
    const oldVersionPublishedElement = document.getElementById('oldVersionPublished');
    const suggestedLocationElement = document.getElementById('suggestedLocation');

    var editor = null;

    async function setUpEditor() {
        try {
            editor = new Jodit('#content', {
                enableDragAndDropFileToEditor: true,
                uploader: {
                    url: `/edit/image/${postId}`,
                    format: 'json',
                    pathVariableName: 'path',
                    filesVariableName: () => 'image',
                    isSuccess: (resp) => resp.uploaded,
                    getMsg: (resp) => resp.msg,
                    process: (resp) => resp,
                    defaultHandlerSuccess: (resp) => {
                        for (const url of resp.urls) {
                            editor.selection.insertImage(url);
                        }
                    },
                    error: (e) => {
                        editor.events.fire('errorPopap', [e.message, 'error', 4000]);
                    }
                }
            });

            editor.events.on('change', onContentChanged);
        } catch (err) {
            document.body.textContent = `Can not set up the editor: ${err}`;
        }
    }

    await setUpEditor();
    onWindowResize();

    var sending = false;
    var contentChanged = false;

    function updateDocumentTitle() {
        document.title = `Editing: ${titleElement.value}`;
    }
    updateDocumentTitle();

    suggestedLocationElement.onchange = onContentChanged;


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
                return editor.value;
            }

            const draft = {
                title: titleElement.value,
                content: getContent()
            };

            draft.suggestedLocation = suggestedLocationElement.value;

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

    
    function onWindowResize() {
        // TODO: Is there a better way to do this in css?
        const location = contentElement.getBoundingClientRect();
        const height = window.innerHeight - location.top - 200;
        editor.initOptions({
            maxHeight: height,
            minHeight: height
        });
    }

    window.addEventListener('resize', onWindowResize);
}

if (document.readyState === "complete" ||
    (document.readyState !== "loading" && !document.documentElement.doScroll)) {
    runEditor()
} else {
    document.addEventListener("DOMContentLoaded", () => runEditor());
}