"use strict";

const queuedCallbacks = [];

async function runZ3() {

    // Format dates for the locale
    var dateElements = document.getElementsByTagName('z3-date');
    for (var dateElement of dateElements) {
        try {
            const date = new Date(dateElement.innerHTML);
            dateElement.innerHTML = date.toLocaleString();
        } catch (err) {
            console.log(`Can not format date from ${dateElement.outerHTML}`);
        }
    }

    dateElements = document.getElementsByTagName('z3-shortdate');
    for (var dateElement of dateElements) {
        try {
            const date = new Date(dateElement.innerHTML);
            dateElement.innerHTML = date.toLocaleDateString();
        } catch (err) {
            console.log(`Can not format date from ${dateElement.outerHTML}`);
        }
    }

    // Run queued callbacks
    for (var callback of queuedCallbacks) {
        try {
            callback();
        } catch (err) {
            console.log(err);
        }
    }
}

function callAtReady(callback) {
    queuedCallbacks.push(callback);
}

if (document.readyState === "complete" ||
(document.readyState !== "loading" && !document.documentElement.doScroll)) {
    runZ3()
} else {
    document.addEventListener("DOMContentLoaded", () => runZ3());
}